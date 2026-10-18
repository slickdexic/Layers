<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportPublicationService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';
require_once __DIR__ . '/TestingAdmissionRegistration.php';
if ( !class_exists( PageWorkingCopyPdfImportReadService::class ) ) {
	require_once __DIR__ . '/../../../src/Revision/PageWorkingCopyPdfImportReadService.php';
}
if ( !class_exists( PageWorkingCopyPdfImportPublicationService::class ) ) {
	require_once __DIR__ . '/../../../src/Revision/PageWorkingCopyPdfImportPublicationService.php';
}

/**
 * Inactive whole-PDF first-Save provenance publishes one citation per source layer set.
 * @covers \MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportPublicationService
 * @group Database
 */
class WholePdfImportPublicationTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private array $registration;
	private array $pair;
	private array $pin;
	private PageHistoryAccess $access;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'move', 'createpage' ] );
		$s = $this->getServiceContainer();
		$this->access = new PageHistoryAccess( $s->getRevisionLookup() );
		$file = $this->upload( 'File:Whole-pdf-publication-' . wfRandomString( 8 ) . '.pdf' );
		$this->pin = [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1() ];
		$this->pair = [];
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'WholePdfPublication ' . $role . ' ' . wfRandomString( 8 ) );
			$members = $role === 'target' ? [ $this->surface( 'target-two', 2 ) ] :
				[ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ) ];
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$page->getLatest(), $this->document( $members ), 'Isolated whole-PDF provenance fixture' );
			$this->pair[$role] = [ 'pageId' => $page->getId(), 'title' => $page->getTitle(),
				'revisionId' => $revision, 'surfaceId' => $members[0]['id'] ];
		}
	}

	private function upload( string $name, string $asset = 'test-multipage.pdf',
		string $timestamp = '20260906120000'
	): File {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( $name );
		$file = $repo->newFile( $title );
		$status = $file->upload( __DIR__ . '/../../fixtures/assets/' . $asset,
			'Isolated whole-PDF Import asset', 'Fixture', 0, false, $timestamp, $this->getTestSysop()->getUser() );
		$this->assertStatusGood( $status );
		self::guardIsolatedFixtureRepository( $repo );
		return $file;
	}

	private function surface( string $id, int $page, ?array $pin = null, string $label = 'ABC',
		?array $layers = null
	): array {
		return [ 'id' => $id, 'kind' => 'pdf', 'label' => $label,
			'canvas' => [ 'width' => 416, 'height' => 208, 'backgroundColor' => '#eeeeee',
				'backgroundVisible' => false, 'backgroundOpacity' => 0.5 ],
			'source' => ( $pin ?? $this->pin ) + [ 'page' => $page ],
			'layers' => $layers ?? [ [ 'id' => 'text-' . $id, 'type' => 'text', 'text' => $id,
				'x' => 24, 'y' => 31, 'rotation' => 15 ] ],
			'readingOrder' => $layers === null ? [ 'text-' . $id ] : array_column( $layers, 'id' ) ];
	}

	private function document( array $surfaces ): string {
		return json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ], JSON_THROW_ON_ERROR );
	}

	private function service(): object {
		$s = $this->getServiceContainer();
		$access = new PageHistoryAccess( $s->getRevisionLookup() );
		$repo = $s->getRepoGroup()->getLocalRepo();
		$sources = new SourceVersionResolver( $repo, $s->getTitleFactory() );
		$reader = new PageWorkingCopyPdfImportReadService( new PageOwnedIdentityResolver(
			$s->getTitleFactory(), $s->getRevisionLookup(), $access ), $s->getTitleFactory(),
			PageOwnedScope::newFromServices( $s, [] ), $access, $sources,
			new SourceRenditions( $s->getUrlUtils() ), new NewPageDrawing( $sources,
				new SourceRenditions( $s->getUrlUtils() ), $repo, $s->getTitleFactory(), [] ) );
		$class = PageWorkingCopyPdfImportPublicationService::class;
		return new $class( $reader, $this->registration['publisher'], $s->getTitleFactory(),
			$s->getConnectionProvider(), $access, $sources, PageOwnedScope::newFromServices( $s, [] ) );
	}

	private function descriptor( ?string $targetId = null, ?string $sourceId = null ): array {
		return [ 'targetSurfaceId' => $targetId ?? $this->pair['target']['surfaceId'],
			'sourcePageId' => $this->pair['source']['pageId'],
			'sourceRevisionId' => $this->pair['source']['revisionId'],
			'sourceSurfaceId' => $sourceId ?? $this->pair['source']['surfaceId'] ];
	}

	private function admission( ?int $revisionId = null, string $id = '' ): array {
		$revisionId ??= $this->pair['target']['revisionId'];
		$id = $id ?: NewPageDrawing::surfaceId( $this->pair['target']['pageId'], $revisionId,
			'ABC', $this->pin['fileTitle'], 1 );
		return $this->surface( $id, 1, $this->pin, 'ABC', [ [ 'id' => 'imported-text', 'type' => 'text',
			'text' => 'Imported page one', 'x' => 12, 'y' => 18 ] ] );
	}

	private function proposed( ?array $extra = null, ?array $target = null ): array {
		$members = $target ?? [ $this->surface( 'target-two', 2 ) ];
		$members[0]['layers'][0]['text'] = 'Imported and edited page two';
		$members[0]['readingOrder'] = [ $members[0]['layers'][0]['id'] ];
		if ( $extra !== null ) {
			$members[] = $extra;
		}
		return [ 'schemaVersion' => 1, 'surfaces' => $members ];
	}

	private function invoke( ?array $document = null, ?array $sources = null, string $note = '',
		array $admissionRevisions = []
	): int {
		return $this->service()->publish( $this->pair['target']['pageId'], $this->pair['target']['revisionId'],
			JsonSnapshotCodec::encode( $document ?? $this->proposed( $this->admission() ) ),
			$sources ?? [ $this->descriptor() ], $this->actor, $note, $admissionRevisions );
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

	private function refused( callable $operation ): void {
		$before = $this->state();
		try {
			$operation();
			$this->fail( 'Expected unavailable whole-PDF Import publication' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->state(), 'Refusal preserves the isolated publication tables' );
	}

	public function testFirstSavePublishesWholeSparseGroupAndOneCitation(): void {
		$s = $this->getServiceContainer();
		$sibling = $this->surface( 'unrelated-slide', 1 );
		$sibling['kind'] = 'slide';
		unset( $sibling['source'] );
		$this->pair['target']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['target']['title'], $this->actor, $this->pair['target']['revisionId'],
			$this->document( [ $this->surface( 'target-two', 2 ), $sibling ] ), 'Unrelated same-name slide' );
		$base = $s->getRevisionLookup()->getRevisionById( $this->pair['target']['revisionId'] );
		$sourceBefore = $s->getRevisionLookup()->getRevisionById( $this->pair['source']['revisionId'] )
			->getContent( PageRevisionWriter::SLOT )->serialize();
		$before = $this->state();
		$admission = $this->admission();
		$proposed = $this->proposed( $admission, [ $this->surface( 'target-two', 2 ), $sibling ] );
		$id = $this->invoke( $proposed, null, 'Owner note 世界' );
		$this->runDeferredUpdates();
		$revision = $s->getRevisionLookup()->getRevisionById( $id, IDBAccessObject::READ_LATEST );
		$this->assertGreaterThan( $base->getId(), $id );
		$this->assertSame( $this->pair['target']['pageId'], $revision->getPageId() );
		$this->assertSame( $this->actor->getUser()->getId(), $revision->getUser()->getId() );
		$this->assertSame( $base->getContent( SlotRecord::MAIN )->serialize(),
			$revision->getContent( SlotRecord::MAIN )->serialize() );
		$comment = $revision->getComment()->text;
		$this->assertSame( 1, substr_count( $comment, $this->pair['source']['title']->getPrefixedText() ) );
		$this->assertStringContainsString( (string)$this->pair['source']['revisionId'], $comment );
		$this->assertStringContainsString( 'Owner note 世界', $comment );
		$this->assertSame( JsonSnapshotCodec::encode( $proposed ),
			$revision->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( $sourceBefore, $s->getRevisionLookup()->getRevisionById(
			$this->pair['source']['revisionId'] )->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertCount( count( $before['revision'] ) + 1, $this->state()['revision'] );
	}

	public function testRepeatedAnchorsAndMemberDescriptorsProduceOneGroupCitation(): void {
		$second = $this->descriptor( 'target-two', 'source-one' );
		$second['targetSurfaceId'] = 'target-two';
		$id = $this->invoke( $this->proposed( $this->admission() ),
			[ $this->descriptor(), $second, $this->descriptor() ] );
		$comment = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )->getComment()->text;
		$this->assertSame( 1, substr_count( $comment, $this->pair['source']['title']->getPrefixedText() ) );
		$this->assertSame( wfMessage( 'layers-copy-summary' )->plaintextParams( 'ABC' )
			->params( $this->pair['source']['title']->getPrefixedText(),
				(string)$this->pair['source']['revisionId'] )->inContentLanguage()->text(), $comment );
	}

	public function testNativeCurrentBaseAdmissionNeedsNoHistoricalClaim(): void {
		$member = $this->admission();
		$id = $this->invoke( $this->proposed( $member ) );
		$stored = json_decode( $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )
			->getContent( PageRevisionWriter::SLOT )->serialize(), true );
		$pages = array_column( array_map( static fn ( $surface ) => $surface['source'],
			$stored['surfaces'] ), 'page' );
		sort( $pages, SORT_NUMERIC );
		$this->assertSame( [ 1, 2 ], $pages );
	}

	public function testReadableHistoricalSourceUsesExactCitedRevision(): void {
		$historical = $this->pair['source']['revisionId'];
		$later = [ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ) ];
		$later[0]['layers'][0]['text'] = 'Later source edit';
		$this->pair['source']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['source']['title'], $this->actor, $this->pair['source']['revisionId'],
			$this->document( $later ), 'Later source edit' );
		$descriptor = array_replace( $this->descriptor(), [ 'sourceRevisionId' => $historical ] );
		$id = $this->invoke( null, [ $descriptor ] );
		$comment = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )->getComment()->text;
		$this->assertStringContainsString( (string)$historical, $comment );
	}

	public function testSourceAndTargetMayUseDifferentPinnedFileVersions(): void {
		$file = $this->upload( $this->pin['fileTitle'], 'test-multipage-replacement.pdf', '20260906130000' );
		$newPin = array_replace( $this->pin,
			[ 'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1() ] );
		$members = [ $this->surface( 'source-one-new', 1, $newPin ) ];
		$this->pair['source']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['source']['title'], $this->actor, $this->pair['source']['revisionId'],
			$this->document( $members ), 'New source file version' );
		$this->pair['source']['surfaceId'] = 'source-one-new';
		$document = $this->proposed( $this->admission() );
		$document['surfaces'][0]['layers'][0]['text'] = 'Imported page two';
		$id = $this->invoke( $document );
		$stored = json_decode( $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )
			->getContent( PageRevisionWriter::SLOT )->serialize(), true );
		$this->assertSame( JsonSnapshotCodec::encode( $this->pin ), JsonSnapshotCodec::encode(
			array_diff_key( $stored['surfaces'][0]['source'], [ 'page' => true ] ) ) );
	}

	public function testTargetOnlyPageEditsArePublishedAsProposed(): void {
		$source = [ $this->surface( 'source-one-only', 1 ) ];
		$this->pair['source']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['source']['title'], $this->actor, $this->pair['source']['revisionId'],
			$this->document( $source ), 'Sparse source set' );
		$this->pair['source']['surfaceId'] = 'source-one-only';
		$document = $this->proposed( $this->admission() );
		$id = $this->invoke( $document );
		$stored = json_decode( $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )
			->getContent( PageRevisionWriter::SLOT )->serialize(), true );
		$this->assertSame( 'target-two', $stored['surfaces'][0]['id'] );
		$this->assertSame( 'Imported and edited page two', $stored['surfaces'][0]['layers'][0]['text'] );
		$this->assertSame( $this->admission()['id'], $stored['surfaces'][1]['id'] );
	}

	public function testConsistentUnsavedSetRenameIsPublished(): void {
		$target = [ $this->surface( 'target-two', 2 ) ];
		$target[0]['label'] = 'Renamed ABC';
		$document = $this->proposed( $this->admission(), $target );
		$document['surfaces'][1]['label'] = 'Renamed ABC';
		$id = $this->invoke( $document );
		$this->assertStringContainsString( 'ABC', $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $id )->getComment()->text );
	}

	public static function provideInvalidCandidates(): array {
		return [
			'missing imported page' => [ 'missing' ],
			'duplicate page' => [ 'duplicate' ],
			'wrong target pin' => [ 'pin' ],
			'wrong page number' => [ 'page' ],
			'wrong file identity' => [ 'file' ],
			'wrong deterministic id' => [ 'id' ],
			'missing group member' => [ 'remove' ],
		];
	}

	/** @dataProvider provideInvalidCandidates */
	public function testIncompleteOrForgedWholeGroupRefusesWithoutWrites( string $case ): void {
		$document = $this->proposed( $this->admission() );
		switch ( $case ) {
			case 'missing':
				$document = $this->proposed();
				break;
			case 'duplicate':
				$copy = $document['surfaces'][1];
				$copy['id'] = 'duplicate-page-id';
				$copy['source']['page'] = 2;
				$document['surfaces'][] = $copy;
				break;
			case 'pin':
				$document['surfaces'][1]['source']['sha1'] = str_repeat( '0', 31 );
				break;
			case 'page':
				$document['surfaces'][1]['source']['page'] = 3;
				break;
			case 'file':
				$document['surfaces'][1]['source']['fileTitle'] = 'File:Other.pdf';
				break;
			case 'id':
				$document['surfaces'][1]['id'] = 'forged-id';
				break;
			case 'remove':
				array_shift( $document['surfaces'] );
				break;
		}
		$this->refused( fn () => $this->invoke( $document ) );
	}

	public function testNoOpCannotClaimImport(): void {
		$this->pair['source']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['source']['title'], $this->actor, $this->pair['source']['revisionId'],
			$this->document( [ $this->surface( 'source-two', 2 ) ] ), 'Isolated single-page source set' );
		$this->refused( fn () => $this->invoke( [ 'schemaVersion' => 1,
			'surfaces' => [ $this->surface( 'target-two', 2 ) ] ] ) );
	}

	public function testMalformedDescriptorRefusesWithoutWrites(): void {
		$bad = $this->descriptor();
		$bad['owner'] = 'forged';
		$this->refused( fn () => $this->invoke( null, [ $bad ] ) );
	}

	public function testHistoricalAdmissionMustBeNamedAndProvenFromTargetHistory(): void {
		$historic = $this->pair['target']['revisionId'];
		$laterMembers = [ $this->surface( 'target-two', 2 ) ];
		$laterMembers[0]['layers'][0]['text'] = 'A later unrelated page revision';
		$this->pair['target']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['target']['title'], $this->actor, $historic, $this->document( $laterMembers ),
			'Intervening target revision' );
		$oldId = NewPageDrawing::surfaceId( $this->pair['target']['pageId'], $historic,
			'ABC', $this->pin['fileTitle'], 1 );
		$doc = $this->proposed( $this->admission( null, $oldId ) );
		$this->refused( fn () => $this->invoke( $doc ) );
		$id = $this->invoke( $doc, null, '', [ [ 'surfaceId' => $oldId, 'revisionId' => $historic ] ] );
		$this->assertGreaterThan( $this->pair['target']['revisionId'], $id );
	}

	public function testForgedOrUnconsumedHistoricalAdmissionClaimRefuses(): void {
		$doc = $this->proposed( $this->admission() );
		$this->refused( fn () => $this->invoke( $doc, null, '', [ [ 'surfaceId' => 'not-in-candidate',
			'revisionId' => $this->pair['target']['revisionId'] ] ] ) );
	}

	public function testAnotherOwnerCannotSupplyHistoricalAdmission(): void {
		$foreignRevision = $this->pair['source']['revisionId'];
		$this->pair['target']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['target']['title'], $this->actor, $this->pair['target']['revisionId'],
			$this->document( [ $this->surface( 'target-two', 2 ) ] ), 'Target no-op' );
		$changed = [ $this->surface( 'target-two', 2 ) ];
		$changed[0]['layers'][0]['text'] = 'Later target';
		$this->pair['target']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['target']['title'], $this->actor, $this->pair['target']['revisionId'],
			$this->document( $changed ), 'Later target' );
		$id = NewPageDrawing::surfaceId( $this->pair['target']['pageId'], $foreignRevision,
			'ABC', $this->pin['fileTitle'], 1 );
		$this->refused( fn () => $this->invoke( $this->proposed( $this->admission( null, $id ) ), null, '',
			[ [ 'surfaceId' => $id, 'revisionId' => $foreignRevision ] ] ) );
	}

	public function testHistoricalPageMustActuallyHaveBeenAbsent(): void {
		$historical = $this->registration['publisher']->publish( $this->pair['target']['title'], $this->actor,
			$this->pair['target']['revisionId'],
			$this->document( [ $this->surface( 'target-two', 2 ), $this->surface( 'old-one', 1 ) ] ),
			'Page one existed in this old revision' );
		$this->pair['target']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['target']['title'], $this->actor, $historical,
			$this->document( [ $this->surface( 'target-two', 2 ) ] ), 'Later sparse target' );
		$id = NewPageDrawing::surfaceId( $this->pair['target']['pageId'], $historical,
			'ABC', $this->pin['fileTitle'], 1 );
		$this->refused( fn () => $this->invoke( $this->proposed( $this->admission( null, $id ) ), null, '',
			[ [ 'surfaceId' => $id, 'revisionId' => $historical ] ] ) );
	}

	public function testUnusedOlderAdmissionClaimIsRefused(): void {
		$historical = $this->pair['target']['revisionId'];
		$changed = [ $this->surface( 'target-two', 2 ) ];
		$changed[0]['layers'][0]['text'] = 'Later target';
		$this->pair['target']['revisionId'] = $this->registration['publisher']->publish(
			$this->pair['target']['title'], $this->actor, $historical, $this->document( $changed ), 'Later target' );
		$this->refused( fn () => $this->invoke( null, null, '',
			[ [ 'surfaceId' => 'not-in-document', 'revisionId' => $historical ] ] ) );
	}

	public function testStaleTargetBaseAndSameOwnerSourceRefuse(): void {
		$changed = [ $this->surface( 'target-two', 2 ) ];
		$changed[0]['layers'][0]['text'] = 'Concurrent saved work';
		$this->registration['publisher']->publish( $this->pair['target']['title'], $this->actor,
			$this->pair['target']['revisionId'], $this->document( $changed ), 'Concurrent saved work' );
		$this->refused( fn () => $this->invoke() );
		$this->refused( fn () => $this->invoke( null, [ array_replace( $this->descriptor(),
			[ 'sourcePageId' => $this->pair['target']['pageId'] ] ) ] ) );
	}

	public function testUnsupportedLayerFieldAndOversizedNoteNeverChangeAnything(): void {
		$document = $this->proposed( $this->admission() );
		$document['surfaces'][1]['layers'][0]['unsupportedFutureField'] = [ 'nested' => null ];
		$this->refused( fn () => $this->invoke( $document ) );
		$this->refused( fn () => $this->invoke( null, null, str_repeat( '長', 600 ) ) );
	}

	public static function provideSuppressionHooks(): array {
		return [ [ 'MultiContentSave' ], [ 'RevisionFromEditComplete' ] ];
	}

	/** @dataProvider provideSuppressionHooks */
	public function testLateSourceSuppressionRollsBackAndHealthyReplayWorks( string $hook ): void {
		$entered = false;
		$sourceRevision = $this->pair['source']['revisionId'];
		$caller = __METHOD__;
		$this->setTemporaryHook( $hook, function () use ( &$entered, $sourceRevision, $caller ) {
			if ( !$entered ) {
				$entered = true;
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( [ 'rev_id' => $sourceRevision ] )->caller( $caller )->execute();
			}
			return true;
		}, false );
		$this->refused( fn () => $this->invoke() );
		$this->assertTrue( $entered, 'Publication must reach the native save callback' );
		$this->assertGreaterThan( $this->pair['target']['revisionId'], $this->invoke() );
	}
}
