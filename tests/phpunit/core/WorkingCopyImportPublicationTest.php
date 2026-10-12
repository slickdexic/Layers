<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportPublicationService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * First-Save provenance uses native identities and the real guarded page publisher.
 * @covers \MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportPublicationService
 * @group Database
 */
class WorkingCopyImportPublicationTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private array $registration;
	private array $pair;
	private array $target;
	private array $source;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'move', 'createpage' ] );
		$this->target = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$this->source = $this->target;
		$this->source['surfaces'][0]['layers'][0]['text'] = 'Independent source text';
		$sibling = $this->target['surfaces'][0];
		$sibling['id'] = 'unrelated';
		$sibling['label'] = 'Unrelated';
		$sibling['layers'][0]['text'] = 'Preserve this sibling';
		$this->target['surfaces'][] = $sibling;
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'ImportPublication ' . $role . ' ' . wfRandomString( 8 ) );
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$page->getLatest(), JsonSnapshotCodec::encode( $this->$role ), 'Isolated provenance fixture' );
			$this->pair[$role] = [ 'page' => $page, 'pageId' => $page->getId(), 'revisionId' => $revision ];
		}
	}

	private function service(): object {
		$s = $this->getServiceContainer();
		$access = new PageHistoryAccess( $s->getRevisionLookup() );
		$reader = new PageWorkingCopyImportReadService( new PageOwnedIdentityResolver( $s->getTitleFactory(),
			$s->getRevisionLookup(), $access ), $s->getTitleFactory(), new PageReadService( $access,
				new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ) ),
			PageOwnedScope::newFromServices( $s, [] ) );
		$class = getenv( 'LAYERS_N_PUBLICATION_SOURCE' ) ?
			'MediaWiki\\Extension\\Layers\\Revision\\J116NCopiedImportPublication' :
			PageWorkingCopyImportPublicationService::class;
		return new $class( $reader, $this->registration['publisher'], $s->getTitleFactory(),
			$s->getConnectionProvider() );
	}

	private function descriptor(): array {
		return [ 'targetSurfaceId' => 'presentation', 'sourcePageId' => $this->pair['source']['pageId'],
			'sourceRevisionId' => $this->pair['source']['revisionId'], 'sourceSurfaceId' => 'presentation' ];
	}

	private function proposed(): array {
		$document = $this->target;
		$document['surfaces'][0]['layers'] = $this->source['surfaces'][0]['layers'];
		$document['surfaces'][0]['layers'][0]['id'] = 'fresh';
		$document['surfaces'][0]['layers'][0]['text'] .= ' edited in this working copy';
		$document['surfaces'][0]['readingOrder'] = [ 'fresh' ];
		return $document;
	}

	private function invoke( ?array $document = null, ?array $sources = null, string $note = '' ): int {
		return $this->service()->publish( $this->pair['target']['pageId'], $this->pair['target']['revisionId'],
			JsonSnapshotCodec::encode( $document ?? $this->proposed() ), $sources ?? [ $this->descriptor() ],
			$this->actor, $note );
	}

	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page' => 'page_id', 'revision' => 'rev_id', 'slots' => [ 'slot_revision_id', 'slot_role_id' ],
			'content' => 'content_id', 'text' => 'old_id', 'comment' => 'comment_id',
			'change_tag' => 'ct_id', 'change_tag_def' => 'ctd_id' ] as $table => $order ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$state[$table] = array_map( static fn ( $row ) => (array)$row, iterator_to_array(
				$this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )->orderBy( $order )
					->caller( __METHOD__ )->fetchResultSet() ) );
		}
		return $state;
	}

	private function refused( callable $call ): void {
		$before = $this->state();
		try {
			$call();
			$this->fail( 'Expected unavailable Import provenance' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->state(), 'Refusal preserves all eight captured fixture tables' );
	}

	public function testFirstSaveRecordsNativeSourceAndNoteInOneOwnerRevision(): void {
		$s = $this->getServiceContainer();
		$base = $s->getRevisionLookup()->getRevisionById( $this->pair['target']['revisionId'] );
		$before = $this->state();
		$id = $this->invoke( null, null, 'Owner note 世界' );
		$this->runDeferredUpdates();
		$revision = $s->getRevisionLookup()->getRevisionById( $id, IDBAccessObject::READ_LATEST );
		$this->assertGreaterThan( $base->getId(), $id );
		$this->assertSame( $this->pair['target']['pageId'], $revision->getPageId() );
		$this->assertSame( $this->actor->getUser()->getId(), $revision->getUser()->getId() );
		$this->assertSame( $base->getContent( SlotRecord::MAIN )->serialize(),
			$revision->getContent( SlotRecord::MAIN )->serialize() );
		$expected = wfMessage( 'layers-copy-summary' )->plaintextParams( 'Welcome Slide' )
			->params( $this->pair['source']['page']->getTitle()->getPrefixedText(),
				(string)$this->pair['source']['revisionId'] )->inContentLanguage()->text() . ': Owner note 世界';
		$this->assertSame( $expected, $revision->getComment()->text );
		$this->assertSame( JsonSnapshotCodec::encode( $this->proposed() ),
			$revision->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertCount( count( $before['revision'] ) + 1, $this->state()['revision'] );
		$this->assertSame( $this->pair['source']['revisionId'], $s->getRevisionLookup()
			->getRevisionByTitle( $this->pair['source']['page']->getTitle(), 0,
				IDBAccessObject::READ_LATEST )->getId() );
		$this->assertSame( JsonSnapshotCodec::encode( $this->source ), $s->getRevisionLookup()->getRevisionById(
			$this->pair['source']['revisionId'] )->getContent( PageRevisionWriter::SLOT )->serialize() );
	}

	public function testMultipleSourcesAreRecordedAndRepeatedCitationsDeduplicated(): void {
		$page = $this->getExistingTestPage( 'Additional Import Source ' . wfRandomString( 8 ) );
		$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
			$page->getLatest(), JsonSnapshotCodec::encode( $this->source ), 'Isolated additional source' );
		$other = array_replace( $this->descriptor(), [ 'sourcePageId' => $page->getId(),
			'sourceRevisionId' => $revision ] );
		$id = $this->invoke( null, [ $this->descriptor(), $other, array_reverse( $this->descriptor(), true ) ] );
		$text = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )->getComment()->text;
		$this->assertStringContainsString( $page->getTitle()->getPrefixedText(), $text );
		$this->assertStringContainsString( (string)$revision, $text );
		$this->assertSame( 1, substr_count( $text,
			$this->pair['source']['page']->getTitle()->getPrefixedText() ) );
	}

	public function testReadableHistoricalSourceDoesNotFollowLaterEdits(): void {
		$new = $this->source;
		$new['surfaces'][0]['layers'][0]['text'] = 'Later source text';
		$this->registration['publisher']->publish( $this->pair['source']['page']->getTitle(), $this->actor,
			$this->pair['source']['revisionId'], JsonSnapshotCodec::encode( $new ), 'Later source' );
		$id = $this->invoke();
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$this->assertStringContainsString( (string)$this->pair['source']['revisionId'], $revision->getComment()->text );
		$this->assertSame( JsonSnapshotCodec::encode( $this->proposed() ),
			$revision->getContent( PageRevisionWriter::SLOT )->serialize() );
	}

	public function testSourceMoveUsesCurrentCanonicalNativeOwner(): void {
		$old = $this->pair['source']['page']->getTitle();
		$new = $this->getNonexistingTestPage( 'Moved Import Source ' . wfRandomString( 8 ) )->getTitle();
		$this->assertTrue( $this->getServiceContainer()->getMovePageFactory()->newMovePage( $old, $new )
			->moveIfAllowed( $this->actor, 'Isolated source move' )->isOK() );
		$id = $this->invoke();
		$text = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )->getComment()->text;
		$this->assertStringContainsString( $new->getPrefixedText(), $text );
		$this->assertStringNotContainsString( $old->getPrefixedText(), $text );
	}

	public function testUnsavedTargetRenameRetainsOriginalSourceProvenance(): void {
		$document = $this->proposed();
		$document['surfaces'][0]['label'] = 'Renamed working copy';
		$id = $this->invoke( $document );
		$this->assertStringContainsString( 'Welcome Slide',
			$this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )->getComment()->text );
	}

	public function testUnchangedPayloadCannotClaimAnImport(): void {
		$this->refused( fn () => $this->invoke( $this->target ) );
	}

	public function testOversizedNoteNeverTruncatesNativeProvenance(): void {
		$this->refused( fn () => $this->invoke( null, null, str_repeat( '世', 500 ) ) );
	}

	public function testDifferentLayerSetNameIsRefused(): void {
		$document = $this->source;
		$document['surfaces'][0]['label'] = 'Different';
		$this->pair['source']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['source']['page']->getTitle(), $this->actor, $this->pair['source']['revisionId'],
			JsonSnapshotCodec::encode( $document ), 'Isolated different name' );
		$this->refused( fn () => $this->invoke() );
	}

	/** @return array[] */
	public static function provideMalformedDescriptors(): array {
		return [ [ 'sourcePageId', 0 ], [ 'sourcePageId', '1' ], [ 'sourceRevisionId', 0 ],
			[ 'sourceSurfaceId', 'missing' ], [ 'targetSurfaceId', 'missing' ], [ 'owner', 'Forged owner' ] ];
	}

	/**
	 * @dataProvider provideMalformedDescriptors
	 * @param string $key
	 * @param mixed $value
	 */
	public function testMalformedSourceDescriptorRefusesWithoutWrites( string $key, $value ): void {
		$this->refused( fn () => $this->invoke( null, [ array_replace( $this->descriptor(), [ $key => $value ] ) ] ) );
	}

	public function testSameOwnerAndAnotherOwnerRevisionAreRefused(): void {
		$this->refused( fn () => $this->invoke( null, [ array_replace( $this->descriptor(),
			[ 'sourcePageId' => $this->pair['target']['pageId'] ] ) ] ) );
		$this->refused( fn () => $this->invoke( null, [ array_replace( $this->descriptor(),
			[ 'sourceRevisionId' => $this->pair['target']['revisionId'] ] ) ] ) );
	}

	/** @return array[] */
	public static function provideSuppressionHooks(): array {
		return [ 'before native write' => [ 'MultiContentSave' ],
			'after native write' => [ 'RevisionFromEditComplete' ] ];
	}

	/**
	 * @dataProvider provideSuppressionHooks
	 * @param string $hook
	 */
	public function testLateSourceSuppressionRollsBackAndPermitsAHealthyReplay( string $hook ): void {
		$entered = false;
		$source = $this->pair['source']['revisionId'];
		$caller = __METHOD__;
		$this->setTemporaryHook( $hook, function () use ( &$entered, $source, $caller ) {
			if ( !$entered ) {
				$entered = true;
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( [ 'rev_id' => $source ] )->caller( $caller )->execute();
			}
			return true;
		}, false );
		$this->refused( fn () => $this->invoke() );
		$this->assertTrue( $entered, 'Actual native save callback must run' );
		$id = $this->invoke();
		$this->assertGreaterThan( $this->pair['target']['revisionId'], $id );
	}

	private function imageFixtures( bool $differentFile = false ): void {
		$s = $this->getServiceContainer();
		$repo = $s->getRepoGroup()->getLocalRepo();
		$pins = [];
		foreach ( $differentFile ? [ 'target', 'source' ] : [ 'target' ] as $role ) {
			$title = $s->getTitleFactory()->newFromText( 'File:ImportProvenance' . wfRandomString( 8 ) . '.png' );
			$input = $this->getNewTempFile();
			file_put_contents( $input, base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAA' .
				'C0lEQVR42mP8/x8AAwMCAO+j6X8AAAAASUVORK5CYII=' ) );
			$file = $repo->newFile( $title );
			$this->assertTrue( $file->upload( $input, 'Isolated PNG', 'Import provenance', 0, false,
				'20260906120000', $this->getTestSysop()->getUser() )->isOK() );
			$pins[$role] = [ 'repository' => 'local', 'fileTitle' => $title->getPrefixedDBkey(),
				'sha1' => $file->getSha1(),
				'timestamp' => '20260906120000', 'page' => 1 ];
		}
		foreach ( [ 'target', 'source' ] as $role ) {
			$document = $this->$role;
			$document['surfaces'][0]['kind'] = 'image';
			$document['surfaces'][0]['source'] = $pins[$role] ?? $pins['target'];
			$this->pair[$role]['revisionId'] = $this->registration['publisher']->publish(
				$this->pair[$role]['page']->getTitle(), $this->actor, $this->pair[$role]['revisionId'],
				JsonSnapshotCodec::encode( $document ), 'Isolated image provenance fixture' );
			$this->$role = $document;
		}
	}

	public function testImagePinAndUnrelatedMemberArePreservedWithReorderedPinKeys(): void {
		$this->imageFixtures();
		$document = $this->proposed();
		$document['surfaces'][0]['source'] = array_reverse( $document['surfaces'][0]['source'], true );
		$id = $this->invoke( $document );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$this->assertEquals( $document, json_decode(
			$revision->getContent( PageRevisionWriter::SLOT )->serialize(), true ) );
	}

	public function testSameNameOnAnotherImageFileIsRefused(): void {
		$this->imageFixtures( true );
		$this->refused( fn () => $this->invoke() );
	}

	public function testChangedTargetSourcePinIsRefused(): void {
		$this->imageFixtures();
		$document = $this->proposed();
		$document['surfaces'][0]['source']['sha1'] = 'changed';
		$this->refused( fn () => $this->invoke( $document ) );
	}

	public function testSourceNeedsReadPermissionButNotEditPermission(): void {
		$source = $this->pair['source']['page']->getTitle();
		$this->setTemporaryHook( 'getUserPermissionsErrors',
			static function ( $title, $user, $action, &$result ) use ( $source ) {
				if ( $action === 'edit' && $title->equals( $source ) ) {
					$result = false;
					return false;
				}
			}, false );
		$this->assertGreaterThan( $this->pair['target']['revisionId'], $this->invoke() );
	}

	public function testUnreadableSourceRefusesWithoutWrites(): void {
		$source = $this->pair['source']['page']->getTitle();
		$this->setTemporaryHook( 'getUserPermissionsErrors',
			static function ( $title, $user, $action, &$result ) use ( $source ) {
				if ( $action === 'read' && $title->equals( $source ) ) {
					$result = false;
					return false;
				}
			}, false );
		$this->refused( fn () => $this->invoke() );
	}

	public function testStaleTargetBaseRefusesWithoutWrites(): void {
		$document = $this->target;
		$document['surfaces'][0]['layers'][0]['text'] = 'Intervening target edit';
		$this->registration['publisher']->publish( $this->pair['target']['page']->getTitle(),
			$this->actor, $this->pair['target']['revisionId'], JsonSnapshotCodec::encode( $document ),
			'Intervening edit' );
		$this->refused( fn () => $this->invoke() );
	}

	public function testDifferentSourceFileVersionPreservesTargetPin(): void {
		$this->imageFixtures();
		$s = $this->getServiceContainer();
		$title = $s->getTitleFactory()->newFromText( $this->target['surfaces'][0]['source']['fileTitle'] );
		$file = $s->getRepoGroup()->getLocalRepo()->newFile( $title );
		$input = $this->getNewTempFile();
		file_put_contents( $input, base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAA' .
			'C0lEQVR42mP8/x8AAwMCAO+j6X8AAAAASUVORK5CYII=' ) . "\n" );
		$this->assertTrue( $file->upload( $input, 'Isolated new version', 'Import provenance', 0, false,
			'20260907120000', $this->getTestSysop()->getUser() )->isOK() );
		$this->target['surfaces'][0]['source']['sha1'] = $file->getSha1();
		$this->target['surfaces'][0]['source']['timestamp'] = '20260907120000';
		$this->pair['target']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['target']['page']->getTitle(), $this->actor, $this->pair['target']['revisionId'],
			JsonSnapshotCodec::encode( $this->target ), 'Isolated different target version' );
		$id = $this->invoke();
		$document = json_decode( $s->getRevisionLookup()->getRevisionById( $id )
			->getContent( PageRevisionWriter::SLOT )->serialize(), true );
		$this->assertSame( JsonSnapshotCodec::encode( $this->target['surfaces'][0]['source'] ),
			JsonSnapshotCodec::encode( $document['surfaces'][0]['source'] ) );
		$this->assertNotSame( $this->source['surfaces'][0]['source']['sha1'],
			$document['surfaces'][0]['source']['sha1'] );
	}
}
