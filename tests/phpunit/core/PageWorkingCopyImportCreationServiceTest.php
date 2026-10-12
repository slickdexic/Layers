<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationTarget;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';
require_once __DIR__ . '/../../../maintenance/migrateLayersToPageHistory.php';

/**
 * Real native current revisions and guarded isolated file storage; no editor/API activation.
 * @covers \MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationService
 * @group Database
 */
class PageWorkingCopyImportCreationServiceTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;

	protected function setUp(): void {
		parent::setUp();
		$this->setContentLang( 'en' );
		$this->setUpIsolatedLocalRepoFixture();
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		$maintenance = new \MigrateLayersToPageHistory();
		$maintenance->setDB( $this->getDb() );
		$maintenance->setOption( 'user', $this->getTestSysop()->getUser()->getName() );
		$maintenance->setOption( 'commit', true );
		ob_start();
		try {
			$this->assertTrue( $maintenance->execute() );
		} finally {
			ob_end_clean();
		}
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage',
			'comment', 'change_tag', 'change_tag_def' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	private function upload( string $letter = 'A' ): \MediaWiki\FileRepo\File\LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			'File:ImportCreation' . $letter . wfRandomString( 8 ) . '.png' );
		$input = $this->getNewTempFile();
		copy( __DIR__ . '/../../fixtures/assets/test-image.png', $input );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( $input, 'Isolated creation target', 'Fixture only', 0, false,
			'20260906120000', $this->getTestSysop()->getUser() )->isOK() );
		return $file;
	}

	private function fixture( string $kind = 'slide', bool $slot = false,
		string $selector = 'ABC', bool $linkedCaption = false
	): array {
		$file = $kind === 'image' ? $this->upload() : null;
		$embed = $file ? '[[' . $file->getTitle()->getPrefixedDBkey() . '|layerset=' . $selector .
			( $linkedCaption ? '|A [[Main Page|linked caption]]]]' : '|Plain caption]]' ) :
			'{{#Slide:' . $selector . '}}';
		$prefix = "Préface π\n";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$document['surfaces'][0]['label'] = 'Preserved sibling';
		if ( $slot ) {
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$revision, json_encode( $document ), 'Isolated sibling setup' );
			$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
			$document = json_decode( $stored->getContent( 'layers' )->getText(), true );
		}
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] );
		$label = $selector === 'on' ? 'Default' : $selector;
		$id = NewPageDrawing::surfaceId( $page->getId(), $revision, $label,
			$file ? $file->getTitle()->getPrefixedDBkey() : null );
		return [ 'page' => $page, 'revision' => $revision, 'id' => $id, 'start' => strlen( $prefix ),
			'expected' => $embed, 'pilot' => $pilot, 'document' => $document, 'file' => $file, 'label' => $label ];
	}

	private function nativeReader(): PageReadService {
		$s = $this->getServiceContainer();
		return new PageReadService( new PageHistoryAccess( $s->getRevisionLookup() ),
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ) );
	}

	private function service( array $f, ?PageReadService $reader = null ): PageWorkingCopyImportCreationService {
		$s = $this->getServiceContainer();
		$identities = new PageOwnedIdentityResolver( $s->getTitleFactory(), $s->getRevisionLookup(),
			new PageHistoryAccess( $s->getRevisionLookup() ) );
		$native = $this->nativeReader();
		$creation = new PageWorkingCopyImportCreationTarget( $f['pilot'], $identities,
			$s->getRevisionLookup(), $native );
		$stored = new PageWorkingCopyImportReadService( $identities, $s->getTitleFactory(), $native,
			$f['pilot']->getScope() );
		return new PageWorkingCopyImportCreationService( $creation, $reader ?? $native, $stored,
			$this->registration['publisher'], $s->getTitleFactory(), $f['pilot']->getScope(),
			$s->getConnectionProvider() );
	}

	private function pair( string $kind = 'slide', bool $slot = false, string $selector = 'ABC' ): array {
		$f = $this->fixture( $kind, $slot, $selector );
		$new = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$member = $f['document']['surfaces'][0];
		$member['label'] = $f['label'];
		$member['kind'] = $kind;
		if ( $kind === 'image' ) {
			$member['source'] = $new['source'];
			$member['canvas'] = $new['canvas'];
		} else {
			$member['canvas']['width'] = 500;
			$member['canvas']['height'] = 280;
		}
		$member['layers'][0]['text'] = 'Independent native source';
		$document = [ 'schemaVersion' => 1, 'surfaces' => [ $member ] ];
		$source = $this->getExistingTestPage();
		$sourceRevision = $this->registration['publisher']->publish( $source->getTitle(), $this->actor,
			$source->getLatest(), JsonSnapshotCodec::encode( $document ), 'Isolated source setup' );
		$f['sourcePage'] = $source;
		$f['source'] = [ 'sourcePageId' => $source->getId(), 'sourceRevisionId' => $sourceRevision,
			'sourceSurfaceId' => $member['id'] ];
		$f['sourceDocument'] = $document;
		$f['newSurface'] = $new;
		$f['proposed'] = $slot ? $f['document'] : [ 'schemaVersion' => 1, 'surfaces' => [] ];
		$new['canvas'] = $member['canvas'];
		$new['layers'] = $member['layers'];
		$new['readingOrder'] = $member['readingOrder'];
		$new['layers'][0]['text'] .= ' with newer local edits';
		$f['proposed']['surfaces'][] = $new;
		return $f;
	}

	private function read( array $f, ?PageWorkingCopyImportCreationService $service = null,
		?Authority $authority = null
	): array {
		return ( $service ?? $this->service( $f ) )->read( $f['page']->getId(), $f['revision'], $f['id'],
			$f['start'], $f['expected'], $f['source'], $authority ?? $this->actor );
	}

	private function save( array $f, string $note = '', ?string $json = null ): int {
		return $this->service( $f )->publish( $f['page']->getId(), $f['revision'], $f['id'], $f['start'],
			$f['expected'], $json ?? JsonSnapshotCodec::encode( $f['proposed'] ), [ $f['source'] ],
			$this->actor, $note );
	}

	private function refused( callable $call, bool $publication = false ): void {
		$this->runDeferredUpdates();
		$before = $this->witness();
		try {
			$call();
			$this->fail( 'Expected fixed missing-target Import refusal' );
		} catch ( \DomainException | PublicationException $error ) {
			$this->assertSame( $publication ? PublicationException::class : \DomainException::class,
				get_class( $error ) );
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		}
		$this->runDeferredUpdates();
		$this->assertSame( $before, $this->witness(), 'Complete native fixture bytes survive refusal' );
	}

	/** @return array */
	public static function provideTargets(): array {
		return [ [ 'slide', false ], [ 'slide', true ], [ 'image', false ], [ 'image', true ] ];
	}

	/** @dataProvider provideTargets @param string $kind @param bool $slot */
	public function testExactReadKeepsVirtualTargetSeparateAndWritesNothing( string $kind, bool $slot ): void {
		$f = $this->pair( $kind, $slot );
		$before = $this->witness();
		$result = $this->read( $f );
		$this->assertSame( [ 'creation', 'source', 'sourceBundle' ], array_keys( $result ) );
		$this->assertSame( $slot, $result['creation']['hasLayersSlot'] );
		$this->assertSame( $f['newSurface'], $result['creation']['newSurface'] );
		$this->assertSame( $slot ? $f['document'] : null, $result['creation']['baseBundle']['snapshot'] ?? null );
		$this->assertSame( $f['source']['sourceRevisionId'], $result['source']['revisionId'] );
		$this->assertSame( $this->nativeReader()->read( $f['sourcePage']->getTitle(),
			$f['source']['sourceRevisionId'], $this->actor, $f['sourcePage']->getId(),
			[ $f['source']['sourceSurfaceId'] ] ), $result['sourceBundle'] );
		$result['sourceBundle']['snapshot']['surfaces'][0]['layers'][0]['text'] = 'Detached';
		$this->assertNotSame( $result, $this->read( $f ) );
		$this->assertSame( $before, $this->witness() );
	}

	/** @dataProvider provideTargets @param string $kind @param bool $slot */
	public function testFirstSaveCreatesOneOwnerRevisionWithProvenanceAndExactPreservation(
		string $kind, bool $slot
	): void {
		$f = $this->pair( $kind, $slot );
		$s = $this->getServiceContainer();
		$base = $s->getRevisionLookup()->getRevisionById( $f['revision'] );
		$before = $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->caller( __METHOD__ )->fetchResultSet()->numRows();
		$id = $this->save( $f, 'Owner note 世界' );
		$revision = $s->getRevisionLookup()->getRevisionById( $id, IDBAccessObject::READ_LATEST );
		$this->assertGreaterThan( $f['revision'], $id );
		$this->assertSame( $f['page']->getId(), $revision->getPageId() );
		$this->assertSame( $f['revision'], $revision->getParentId() );
		$this->assertSame( $this->actor->getUser()->getId(), $revision->getUser()->getId() );
		$this->assertSame( $base->getContent( 'main' )->serialize(), $revision->getContent( 'main' )->serialize() );
		$this->assertSame( JsonSnapshotCodec::encode( $f['proposed'] ),
			$revision->getContent( 'layers' )->serialize() );
		$this->assertSame( $slot, $base->hasSlot( 'layers' ) );
		$this->assertSame( $before + 1, $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->caller( __METHOD__ )->fetchResultSet()->numRows() );
		$expected = wfMessage( 'layers-copy-summary' )->plaintextParams( $f['label'] )
			->params( $f['sourcePage']->getTitle()->getPrefixedText(), (string)$f['source']['sourceRevisionId'] )
			->inContentLanguage()->text() . ': Owner note 世界';
		$this->assertSame( $expected, $revision->getComment()->text );
		$this->assertSame( $f['source']['sourceRevisionId'], $s->getRevisionLookup()
			->getRevisionByTitle( $f['sourcePage']->getTitle(), 0, IDBAccessObject::READ_LATEST )->getId() );
		$this->assertSame( JsonSnapshotCodec::encode( $f['sourceDocument'] ),
			$s->getRevisionLookup()->getRevisionById( $f['source']['sourceRevisionId'] )->getContent( 'layers' )
				->serialize() );
		$this->refused( fn () => $this->read( $f ) );
	}

	/** @return array */
	public static function provideMalformedSources(): array {
		return [ [ 'sourcePageId', 0 ], [ 'sourcePageId', '1' ], [ 'sourceRevisionId', 2147483648 ],
			[ 'sourceSurfaceId', 'missing' ], [ 'owner', 'Forged owner' ] ];
	}

	/** @dataProvider provideMalformedSources @param string $key @param mixed $value */
	public function testMalformedSourceRefusesBothBoundaries( string $key, $value ): void {
		$f = $this->pair();
		$f['source'][$key] = $value;
		$this->refused( fn () => $this->read( $f ) );
		$this->refused( fn () => $this->save( $f ), true );
	}

	public function testNativeDefaultShortcutHasTheSameCreationContract(): void {
		$f = $this->pair( 'image', false, 'on' );
		$this->assertSame( 'Default', $this->read( $f )['creation']['newSurface']['label'] );
		$this->assertGreaterThan( $f['revision'], $this->save( $f ) );
	}

	public function testSiblingChangeCannotHideInFirstSave(): void {
		$f = $this->pair( 'slide', true );
		$f['proposed']['surfaces'][0]['layers'][0]['text'] = 'Unauthorized sibling mutation';
		$this->refused( fn () => $this->save( $f ), true );
	}

	public function testChangedTargetIdentityAndImagePinRefuse(): void {
		$f = $this->pair( 'image' );
		$original = $f['proposed'];
		foreach ( [ 'id', 'label' ] as $field ) {
			$f['proposed'] = $original;
			$f['proposed']['surfaces'][0][$field] = 'Forged';
			$this->refused( fn () => $this->save( $f ), true );
		}
		$f['proposed'] = $original;
		$f['proposed']['surfaces'][0]['source']['sha1'] = 'Forged';
		$this->refused( fn () => $this->save( $f ), true );
	}

	public function testSameOwnerForeignRevisionAndDifferentNameRefuse(): void {
		$f = $this->pair();
		$source = $f['source'];
		$f['source']['sourcePageId'] = $f['page']->getId();
		$this->refused( fn () => $this->read( $f ) );
		$f['source'] = $source;
		$f['source']['sourceRevisionId'] = $f['revision'];
		$this->refused( fn () => $this->read( $f ) );
		$f['source'] = $source;
		$f['sourceDocument']['surfaces'][0]['label'] = 'Another set';
		$f['source']['sourceRevisionId'] = $this->registration['publisher']->publish(
			$f['sourcePage']->getTitle(), $this->actor, $source['sourceRevisionId'],
			JsonSnapshotCodec::encode( $f['sourceDocument'] ), 'Different name' );
		$this->refused( fn () => $this->read( $f ) );
	}

	public function testHistoricalSourceRemainsExactAfterLaterEdit(): void {
		$f = $this->pair();
		$document = $f['sourceDocument'];
		$document['surfaces'][0]['layers'][0]['text'] = 'Later native source';
		$this->registration['publisher']->publish( $f['sourcePage']->getTitle(), $this->actor,
			$f['source']['sourceRevisionId'], JsonSnapshotCodec::encode( $document ), 'Later source' );
		$this->assertSame( $f['source']['sourceRevisionId'], $this->read( $f )['source']['revisionId'] );
		$id = $this->save( $f );
		$this->assertStringContainsString( (string)$f['source']['sourceRevisionId'],
			$this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )->getComment()->text );
	}

	public function testSourceReadPermissionIsRequiredWithoutSourceEditPermission(): void {
		$f = $this->pair();
		$allowed = true;
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static function ( $right, $title ) use ( $f ) {
			return $right === 'read' || !$title->equals( $f['sourcePage']->getTitle() );
		} );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static function ( $right, $title ) use ( $f, &$allowed ) {
				return $allowed || !$title->equals( $f['sourcePage']->getTitle() );
			} );
		$this->assertSame( $f['source']['sourceRevisionId'],
			$this->read( $f, null, $authority )['source']['revisionId'] );
		$allowed = false;
		$this->refused( fn () => $this->read( $f, null, $authority ) );
	}

	public function testChangedSourceCaptureRefuses(): void {
		$f = $this->pair();
		$native = $this->nativeReader();
		$reader = $this->createMock( PageReadService::class );
		$count = 0;
		$reader->method( 'read' )->willReturnCallback( static function ( ...$args ) use ( $native, &$count ) {
			$result = $native->read( ...$args );
			if ( ++$count > 1 ) {
				$result['snapshot']['surfaces'][0]['layers'][0]['text'] = 'Changed during preparation';
			}
			return $result;
		} );
		$this->refused( fn () => $this->read( $f, $this->service( $f, $reader ) ) );
	}

	public function testSourceReadCallbackCannotAdvanceTargetWithoutRefusal(): void {
		$f = $this->pair();
		$native = $this->nativeReader();
		$reader = $this->createMock( PageReadService::class );
		$changed = false;
		$afterEdit = null;
		$reader->method( 'read' )->willReturnCallback( function ( ...$args ) use ( $native, $f, &$changed,
			&$afterEdit
		) {
			$result = $native->read( ...$args );
			if ( !$changed ) {
				$changed = true;
				$this->editPage( $f['page'], $f['expected'] . ' concurrent change' );
				$afterEdit = $this->witness();
			}
			return $result;
		} );
		try {
			$this->read( $f, $this->service( $f, $reader ) );
			$this->fail( 'Expected current-target refusal' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		}
		$this->assertSame( $afterEdit, $this->witness() );
	}

	/** @return array */
	public static function provideSuppressionHooks(): array {
		return [ [ 'MultiContentSave' ], [ 'RevisionFromEditComplete' ] ];
	}

	/** @dataProvider provideSuppressionHooks @param string $hook */
	public function testLateNativeSourceSuppressionRollsBackAndHealthyReplayPasses( string $hook ): void {
		$f = $this->pair();
		$entered = false;
		$caller = __METHOD__;
		$this->setTemporaryHook( $hook, function () use ( &$entered, $f, $caller ) {
			if ( !$entered ) {
				$entered = true;
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( [ 'rev_id' => $f['source']['sourceRevisionId'] ] )->caller( $caller )->execute();
			}
			return true;
		}, false );
		$this->refused( fn () => $this->save( $f ), true );
		$this->assertTrue( $entered, 'Actual native callback ran' );
		$this->assertGreaterThan( $f['revision'], $this->save( $f ) );
	}

	public function testDuplicateJsonAndOversizedNotesRefuseBeforeWrite(): void {
		$f = $this->pair();
		$this->refused( fn () => $this->save( $f, '', '{"schemaVersion":1,"schemaVersion":1,"surfaces":[]}' ), true );
		$this->refused( fn () => $this->save( $f, str_repeat( '世', 500 ) ), true );
	}

	public function testSameNameOnAnotherFileRefuses(): void {
		$f = $this->pair( 'image' );
		$file = $this->upload( 'B' );
		$document = $f['sourceDocument'];
		$document['surfaces'][0]['source'] = [ 'repository' => 'local',
			'fileTitle' => $file->getTitle()->getPrefixedDBkey(), 'timestamp' => '20260906120000',
			'sha1' => $file->getSha1(), 'page' => 1 ];
		$f['source']['sourceRevisionId'] = $this->registration['publisher']->publish(
			$f['sourcePage']->getTitle(), $this->actor, $f['source']['sourceRevisionId'],
			JsonSnapshotCodec::encode( $document ), 'Independent file setup' );
		$this->refused( fn () => $this->read( $f ) );
		$this->refused( fn () => $this->save( $f ), true );
	}

	public function testSeveralSourcesHaveNativeDeduplicatedCitations(): void {
		$f = $this->pair();
		$other = $this->getExistingTestPage();
		$revision = $this->registration['publisher']->publish( $other->getTitle(), $this->actor,
			$other->getLatest(), JsonSnapshotCodec::encode( $f['sourceDocument'] ), 'Additional source' );
		$second = array_replace( $f['source'], [ 'sourcePageId' => $other->getId(),
			'sourceRevisionId' => $revision ] );
		$id = $this->service( $f )->publish( $f['page']->getId(), $f['revision'], $f['id'], $f['start'],
			$f['expected'], JsonSnapshotCodec::encode( $f['proposed'] ),
			[ $f['source'], $second, array_reverse( $f['source'], true ) ], $this->actor );
		$comment = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )->getComment()->text;
		$this->assertSame( 1, substr_count( $comment, $f['sourcePage']->getTitle()->getPrefixedText() ) );
		$this->assertSame( 1, substr_count( $comment, $other->getTitle()->getPrefixedText() ) );
		$this->assertStringContainsString( (string)$revision, $comment );
	}

	/** @return array */
	public static function provideInvalidReadBundles(): array {
		return [ [ 'duplicate' ], [ 'pdf' ], [ 'nonfinite' ] ];
	}

	/** @dataProvider provideInvalidReadBundles @param string $invalid */
	public function testMalformedSelectedSourceBundleRefuses( string $invalid ): void {
		$f = $this->pair();
		$native = $this->nativeReader();
		$reader = $this->createMock( PageReadService::class );
		$reader->method( 'read' )->willReturnCallback( static function ( ...$args ) use ( $native, $invalid ) {
			$result = $native->read( ...$args );
			if ( $invalid === 'duplicate' ) {
				$result['snapshot']['surfaces'][] = $result['snapshot']['surfaces'][0];
			} elseif ( $invalid === 'pdf' ) {
				$result['snapshot']['surfaces'][0]['kind'] = 'pdf';
			} else {
				$result['unknownFiniteField'] = INF;
			}
			return $result;
		} );
		$this->refused( fn () => $this->read( $f, $this->service( $f, $reader ) ) );
	}

	public function testCompleteSourceBundleMetadataIsPreservedWithoutRequestingSiblings(): void {
		$f = $this->pair();
		$native = $this->nativeReader();
		$reader = $this->createMock( PageReadService::class );
		$expected = null;
		$reader->method( 'read' )->willReturnCallback( function ( ...$args ) use ( $native, $f, &$expected ) {
			$this->assertSame( [ $f['source']['sourceSurfaceId'] ], $args[4] );
			$result = $native->read( ...$args );
			$result['futureMetadata'] = [ 'explicitNull' => null, 'unknown' => [ 1, true, 'retained' ] ];
			$result['unavailableSibling'] = [ 'status' => 'unavailable', 'rendition' => null ];
			$expected = $result;
			return $result;
		} );
		$result = $this->read( $f, $this->service( $f, $reader ) );
		$this->assertSame( $expected, $result['sourceBundle'] );
	}
}
