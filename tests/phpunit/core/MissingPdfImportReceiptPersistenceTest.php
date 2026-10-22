<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\MissingPdfImportReceipt;
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
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Exact native admission and core PDF renditions in an isolated repository.
 * @covers \MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPublicationService
 * @group Database
 */
class MissingPdfImportReceiptPersistenceTest extends \MediaWikiIntegrationTestCase {

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

	private function publication( array $f,
		?PagePublicationService $publisher = null
	): PageMissingPdfImportPublicationService {
		$s = $this->getServiceContainer();
		$access = new PageHistoryAccess( $s->getRevisionLookup() );
		return new PageMissingPdfImportPublicationService(
			new PageMissingPdfImportPreparation( $this->service( $f ), $this->importReader() ),
			$publisher ?? $this->registration['publisher'],
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

	public static function provideSiblingSlotStates(): array {
		return [ 'without existing layers slot' => [ false ], 'with existing layers slot' => [ true ] ];
	}

	/** @dataProvider provideSiblingSlotStates */
	public function testSuccessfulReceiptPersistsExactNativeCommentDataAndCanonicalSnapshot(
		bool $hasSiblingSlot
	): void {
		$f = $this->fixture( 2, $hasSiblingSlot );
		$source = $this->sourceFixture( $f );
		$document = $this->proposed( $f, $source );
		$json = json_encode( $document, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE |
			JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR );
		$descriptors = [ $this->descriptor( $source ) ];
		$note = " Owner cafe\u{0301} π 日本 😀 ";

		$revisionId = $this->publication( $f )->publish( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $json, $descriptors, $this->actor, $note );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId );
		$comment = $revision->getComment( RevisionRecord::RAW );
		$this->assertNotNull( $comment );
		$this->assertSame( MissingPdfImportReceipt::newCommentData( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $json, $descriptors, $note ), $comment->data );

		$item = wfMessage( 'layers-copy-summary' )->plaintextParams( 'ABC' )
			->params( $source['page']->getTitle()->getPrefixedText(), (string)$source['revision'] )
			->inContentLanguage()->text();
		$expectedSummary = $item . wfMessage( 'colon-separator' )->inContentLanguage()->text() . trim( $note );
		$this->assertSame( $expectedSummary, $comment->text );
		$storedComment = $this->getDb()->newSelectQueryBuilder()->select( [ 'comment_text', 'comment_data' ] )
			->from( 'comment' )->where( [ 'comment_id' => $comment->id ] )->caller( __METHOD__ )->fetchRow();
		$this->assertNotFalse( $storedComment );
		$this->assertSame( $expectedSummary, $storedComment->comment_text );
		$this->assertSame( MissingPdfImportReceipt::newCommentData( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $json, $descriptors, $note ),
			json_decode( $storedComment->comment_data, true, 64, JSON_THROW_ON_ERROR ) );
		$this->assertSame( ( new \MediaWiki\Extension\Layers\Content\LayersDocumentContent( $json ) )
			->getCanonicalText(), $revision->getContent( 'layers' )->serialize() );
	}

	public function testOrdinaryPublicationStoresNoStructuredCommentData(): void {
		$f = $this->fixture();
		$document = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$revisionId = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], $document, 'Ordinary publication without receipt' );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId );
		$comment = $revision->getComment( RevisionRecord::RAW );
		$this->assertNotNull( $comment );
		$this->assertSame( 'Ordinary publication without receipt', $comment->text );
		$this->assertNull( $comment->data );
	}

	public function testMalformedSnapshotRefusalPreservesFullNativeWitness(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$this->refused( function () use ( $f, $source ): void {
			$this->publication( $f )->publish( $f['page']->getId(), $f['revision'], $f['start'],
				$f['expected'], '{malformed', [ $this->descriptor( $source ) ], $this->actor );
		} );
	}

	public function testExceptionAfterNativeSaveRollsBackRevisionAndReceipt(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$actualPublisher = $this->registration['publisher'];
		$publisher = $this->createMock( PagePublicationService::class );
		$publisher->expects( $this->once() )->method( 'publish' )
			->willReturnCallback( static function ( ...$args ) use ( $actualPublisher ): int {
				$actualPublisher->publish( ...$args );
				throw new PublicationException( 'layers-working-copy-import-unavailable' );
			} );

		$this->refused( function () use ( $f, $source, $publisher ): void {
			$this->publication( $f, $publisher )->publish( $f['page']->getId(), $f['revision'],
				$f['start'], $f['expected'], JsonSnapshotCodec::encode( $this->proposed( $f, $source ) ),
				[ $this->descriptor( $source ) ], $this->actor, ' Rollback proof ' );
		} );
	}

}
