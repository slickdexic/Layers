<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPreparation;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPublicationService;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfSetPreparation;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Exact native admission and core PDF renditions in an isolated repository.
 * @covers \MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPublicationService
 * @group Database
 */
class MissingPdfImportPublicationTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->setContentLang( 'en' );
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		MigrationState::markComplete( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
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

	private function upload( ?string $title = null, string $asset = 'test-multipage.pdf',
		string $timestamp = '20260906120000'
	): \MediaWiki\FileRepo\File\LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			$title ?? 'File:EmptyPdf-' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( __DIR__ . '/../../fixtures/assets/' . $asset,
			'Isolated PDF preparation', 'Fixture only', 0, false, $timestamp,
			$this->getTestSysop()->getUser() )->isOK() );
		return $file;
	}

	private function fixture( int $pageNumber = 2, bool $slot = false, string $selector = 'ABC' ): array {
		$file = $this->upload();
		$embed = '[[' . $file->getTitle()->getPrefixedDBkey() . '|page=' . $pageNumber .
			'|layerset=' . $selector . '|Plain caption]]';
		$prefix = "Préface π\n";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		if ( $slot ) {
			$document = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$revision, $document, 'Preserved native sibling' );
		}
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
		return [ 'file' => $file, 'page' => $page, 'revision' => $revision, 'start' => strlen( $prefix ),
			'expected' => $embed, 'main' => $stored->getContent( 'main' )->serialize(),
			'base' => $slot ? $stored->getContent( 'layers' )->serialize() : null,
			'pilot' => new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] ) ];
	}

	private function service( array $f, ?SourceRenditions $renditions = null,
		?SourceVersionResolver $sources = null
	): PageMissingPdfSetPreparation {
		$services = $this->getServiceContainer();
		$lookup = $services->getRevisionLookup();
		$access = new PageHistoryAccess( $lookup );
		$nativeSources = new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
			$services->getTitleFactory() );
		$renditions ??= new SourceRenditions( $services->getUrlUtils() );
		return new PageMissingPdfSetPreparation( $f['pilot'],
			new PageOwnedIdentityResolver( $services->getTitleFactory(), $lookup, $access ), $lookup,
			new PageReadService( $access, $nativeSources ), $sources ?? $nativeSources,
			new NewPageDrawing( $nativeSources, $renditions, $services->getRepoGroup()->getLocalRepo(),
				$services->getTitleFactory(), [] ), $renditions );
	}

	private function sourceFixture( array $target, array $pages = [ 2, 1 ], string $label = 'ABC',
		?string $fileTitle = null
	): array {
		$page = $this->getExistingTestPage();
		$surfaces = [];
		foreach ( $pages as $number ) {
			$surface = $target['pilot']->prepareBoundEditor( $target['page']->getId(), $target['revision'],
				$target['start'], $target['expected'], $this->actor )['pageOwned']['newSurface'];
			$surface['id'] = 'source-' . $number;
			$surface['source']['page'] = $number;
			$surface['label'] = $label;
			if ( $fileTitle !== null ) {
				$surface['source']['fileTitle'] = $fileTitle;
			}
			$surface['layers'] = [ [ 'id' => 'text-' . $number, 'type' => 'text',
				'text' => 'Source page ' . $number, 'x' => 17, 'y' => 23 ] ];
			$surfaces[] = $surface;
		}
		$text = JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] );
		$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
			$page->getLatest(), $text, 'Isolated Import source' );
		return [ 'page' => $page, 'revision' => $revision, 'anchor' => $surfaces[0]['id'],
			'text' => $text, 'surfaces' => $surfaces ];
	}

	private function importReader( ?SourceRenditions $renditions = null ): PageWorkingCopyPdfImportReadService {
		$services = $this->getServiceContainer();
		$access = new PageHistoryAccess( $services->getRevisionLookup() );
		$repo = $services->getRepoGroup()->getLocalRepo();
		$sources = new SourceVersionResolver( $repo, $services->getTitleFactory() );
		$renditions ??= new SourceRenditions( $services->getUrlUtils() );
		return new PageWorkingCopyPdfImportReadService( new PageOwnedIdentityResolver(
			$services->getTitleFactory(), $services->getRevisionLookup(), $access ),
			$services->getTitleFactory(), PageOwnedScope::newFromServices( $services, [], [ NS_MAIN ] ),
			$access, $sources, $renditions,
			new NewPageDrawing( $sources, $renditions, $repo, $services->getTitleFactory(), [] ) );
	}

	private function publication( array $f ): PageMissingPdfImportPublicationService {
		$s = $this->getServiceContainer();
		$access = new PageHistoryAccess( $s->getRevisionLookup() );
		return new PageMissingPdfImportPublicationService(
			new PageMissingPdfImportPreparation( $this->service( $f ), $this->importReader() ),
			$this->registration['publisher'],
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $s->getRevisionLookup(), $access ),
			$s->getTitleFactory(), PageOwnedScope::newFromServices( $s, [], [ NS_MAIN ] ),
			$s->getRevisionLookup(), $access,
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ),
			$s->getConnectionProvider() );
	}

	private function descriptor( array $source, ?string $anchor = null ): array {
		return [ 'sourcePageId' => $source['page']->getId(), 'sourceRevisionId' => $source['revision'],
			'sourceSurfaceId' => $anchor ?? $source['anchor'] ];
	}

	private function proposed( array $f, array $source ): array {
		$selected = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$document = $f['base'] === null ? [ 'schemaVersion' => 1, 'surfaces' => [] ] :
			json_decode( $f['base'], true );
		foreach ( [ 1, 2 ] as $number ) {
			$surface = $selected;
			$surface['id'] = NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'],
				$selected['label'], $selected['source']['fileTitle'], $number );
			$surface['source']['page'] = $number;
			$surface['canvas']['width'] = $f['file']->getWidth( $number );
			$surface['canvas']['height'] = $f['file']->getHeight( $number );
			$surface['layers'] = [];
			foreach ( $source['surfaces'] as $member ) {
				if ( $member['source']['page'] === $number ) {
					$surface['layers'] = $member['layers'];
					$surface['readingOrder'] = array_column( $member['layers'], 'id' );
				}
			}
			$document['surfaces'][] = $surface;
		}
		return $document;
	}

	private function invoke( array $f, array $source, ?array $document = null, ?array $descriptors = null,
		string $note = '', ?Authority $authority = null
	): int {
		return $this->publication( $f )->publish( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], JsonSnapshotCodec::encode( $document ?? $this->proposed( $f, $source ) ),
			$descriptors ?? [ $this->descriptor( $source ) ], $authority ?? $this->actor, $note );
	}

	private function refused( callable $operation ): void {
		$this->runDeferredUpdates();
		$before = $this->witness();
		try {
			$operation();
			$this->fail( 'Unsafe first Save must be refused' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->witness(), 'Refusal preserves full native rows' );
	}

	public static function provideTargets(): array {
		return [ [ 1, false ], [ 2, false ], [ 1, true ], [ 2, true ] ];
	}

	/** @dataProvider provideTargets */
	public function testFirstSaveCreatesNativeRevisionWithCompletePagesAndProvenance( int $page, bool $slot ): void {
		$f = $this->fixture( $page, $slot );
		$source = $this->sourceFixture( $f );
		$document = $this->proposed( $f, $source );
		$this->runDeferredUpdates();
		$count = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();
		$id = $this->invoke( $f, $source, $document, null, 'Owner explanation' );
		$this->runDeferredUpdates();
		$this->assertGreaterThan( $f['revision'], $id );
		$record = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id,
			IDBAccessObject::READ_LATEST );
		$this->assertSame( $f['page']->getId(), $record->getPageId() );
		$this->assertSame( $f['revision'], $record->getParentId() );
		$this->assertSame( $this->actor->getId(), $record->getUser()->getId() );
		$this->assertSame( $f['main'], $record->getContent( SlotRecord::MAIN )->serialize() );
		$stored = json_decode( $record->getContent( PageRevisionWriter::SLOT )->serialize(), true );
		$this->assertSame( JsonSnapshotCodec::encode( $document ),
			$record->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( array_slice( $stored['surfaces'], -2 ), 'label' ) );
		$this->assertSame( [ 1, 2 ], array_column(
			array_column( array_slice( $stored['surfaces'], -2 ), 'source' ), 'page' ) );
		$this->assertSame( (int)$count + 1, (int)$this->getDb()->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );
		$summary = wfMessage( 'layers-copy-summary' )->plaintextParams( 'ABC' )
			->params( $source['page']->getTitle()->getPrefixedText(), (string)$source['revision'] )
			->inContentLanguage()->text() .
			wfMessage( 'colon-separator' )->inContentLanguage()->text() . 'Owner explanation';
		$this->assertSame( $summary, $record->getComment()->text );
		$this->assertSame( $source['text'], $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $source['revision'] )->getContent( 'layers' )->serialize() );
		$this->assertContains( PagePublicationService::CHANGE_TAG,
			$this->getServiceContainer()->getChangeTagsStore()->getTags( $this->getDb(), null, $id ) );
	}

	public function testSparseSourceStillSavesEmptyDestinationPageAndDeduplicatesCitations(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f, [ 2 ] );
		$d = $this->descriptor( $source );
		$id = $this->invoke( $f, $source, null, [ $d, $d ] );
		$record = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$doc = json_decode( $record->getContent( 'layers' )->serialize(), true );
		$this->assertCount( 2, $doc['surfaces'] );
		$this->assertSame( [], $doc['surfaces'][0]['layers'] );
		$this->assertSame( 'Source page 2', $doc['surfaces'][1]['layers'][0]['text'] );
		$this->assertSame( wfMessage( 'layers-copy-summary' )->plaintextParams( 'ABC' )
			->params( $source['page']->getTitle()->getPrefixedText(), (string)$source['revision'] )
			->inContentLanguage()->text(), $record->getComment()->text );
	}

	public function testDifferentAnchorsDeduplicateTheWholeGroupCitation(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$id = $this->invoke( $f, $source, null, [
			$this->descriptor( $source, 'source-1' ), $this->descriptor( $source, 'source-2' )
		] );
		$record = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$this->assertSame( wfMessage( 'layers-copy-summary' )->plaintextParams( 'ABC' )
			->params( $source['page']->getTitle()->getPrefixedText(), (string)$source['revision'] )
			->inContentLanguage()->text(), $record->getComment()->text );
	}

	public function testRequestedHistoricalSourceIsNotSubstitutedByLatest(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$members = $source['surfaces'];
		$members[0]['layers'][0]['text'] = 'Later source work';
		$this->registration['publisher']->publish( $source['page']->getTitle(), $this->actor,
			$source['revision'], JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $members ] ),
			'Later source revision' );
		$id = $this->invoke( $f, $source );
		$record = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$this->assertStringNotContainsString( 'Later source work', $record->getContent( 'layers' )->serialize() );
		$this->assertStringContainsString( (string)$source['revision'], $record->getComment()->text );
	}

	public static function provideBadProposals(): array {
		return [ [ 'omit-page' ], [ 'wrong-id' ], [ 'different-pin' ], [ 'wrong-page' ],
			[ 'renamed' ], [ 'sibling' ], [ 'extra-member' ], [ 'unsupported-field' ] ];
	}

	/** @dataProvider provideBadProposals */
	public function testChangedAdmissionOrOriginalSiblingRefuses( string $change ): void {
		$f = $this->fixture( 2, true );
		$source = $this->sourceFixture( $f );
		$doc = $this->proposed( $f, $source );
		switch ( $change ) {
			case 'omit-page':
				array_splice( $doc['surfaces'], 1, 1 );
				break;
			case 'wrong-id':
				$doc['surfaces'][1]['id'] = 'foreign-owner-member';
				break;
			case 'different-pin':
				$doc['surfaces'][1]['source']['sha1'] = str_repeat( '1', 31 );
				break;
			case 'wrong-page':
				$doc['surfaces'][1]['source']['page'] = 2;
				break;
			case 'renamed':
				$doc['surfaces'][1]['label'] = 'Different name';
				break;
			case 'sibling':
				$doc['surfaces'][0]['layers'][0]['text'] = 'Unrelated work changed';
				break;
			case 'extra-member':
				$extra = $doc['surfaces'][0];
				$extra['id'] = 'extra-slide';
				$extra['label'] = 'Extra slide';
				$doc['surfaces'][] = $extra;
				break;
			case 'unsupported-field':
				$doc['surfaces'][1]['layers'][0]['unsupportedFutureField'] = [ 'nested' => null ];
				break;
		}
		$this->refused( fn () => $this->invoke( $f, $source, $doc ) );
	}

	public function testMalformedDescriptorsAndDuplicateMembersRefuseWithoutWrites(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$doc = $this->proposed( $f, $source );
		$d = $this->descriptor( $source );
		$this->refused( fn () => $this->invoke( $f, $source, $doc, [] ) );
		$this->refused( fn () => $this->invoke( $f, $source, $doc, [ $d + [ 'owner' => 'forged' ] ] ) );
		$this->refused( fn () => $this->invoke( $f, $source, $doc, [
			array_replace( $d, [ 'sourcePageId' => $f['page']->getId() ] )
		] ) );
		$json = JsonSnapshotCodec::encode( $doc );
		$json = '{"schemaVersion":1,' . substr( $json, 1 );
		$this->refused( fn () => $this->publication( $f )->publish( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $json, [ $d ], $this->actor ) );
		$this->refused( fn () => $this->invoke( $f, $source, $doc, null, str_repeat( '長', 600 ) ) );
	}

	public function testConcurrentTargetRevisionIsPreservedAndNeverRetried(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$doc = $this->proposed( $f, $source );
		$winner = $this->editPage( $f['page'], $f['main'] . "\nConcurrent work" )->getNewRevision()->getId();
		$this->refused( fn () => $this->invoke( $f, $source, $doc ) );
		$this->assertSame( $winner, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $f['page']->getTitle(), 0, IDBAccessObject::READ_LATEST )->getId() );
	}

	public function testStoredTargetCannotBeReplacedThroughMissingTargetAdmission(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$doc = $this->proposed( $f, $source );
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], JsonSnapshotCodec::encode( $doc ), 'Existing target' );
		$this->refused( fn () => $this->invoke( $f, $source, $doc ) );
	}

	public function testDifferentNativePdfVersionCannotReceiveImportedCoordinates(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$this->upload( $f['file']->getTitle()->getPrefixedDBkey(), 'test-multipage-replacement.pdf',
			'20260907120000' );
		$f['file']->purgeCache();
		$doc = $this->proposed( $f, $source );
		$this->refused( fn () => $this->invoke( $f, $source, $doc ) );
	}

	public static function provideSuppressionHooks(): array {
		return [ [ 'MultiContentSave' ], [ 'RevisionFromEditComplete' ] ];
	}

	/** @dataProvider provideSuppressionHooks */
	public function testLateSourceSuppressionRollsBackAndHealthyReplayWorks( string $hook ): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$doc = $this->proposed( $f, $source );
		$entered = false;
		$sourceRevision = $source['revision'];
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
		$this->refused( fn () => $this->invoke( $f, $source, $doc ) );
		$this->assertTrue( $entered, 'Reach the actual native save callback' );
		$this->assertGreaterThan( $f['revision'], $this->invoke( $f, $source, $doc ) );
	}
}
