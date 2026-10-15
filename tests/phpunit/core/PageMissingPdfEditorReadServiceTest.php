<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfEditorReadService;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Exact native admission and core PDF renditions in an isolated repository.
 * @covers \MediaWiki\Extension\Layers\Revision\PageMissingPdfEditorReadService
 * @group Database
 */
class PageMissingPdfEditorReadServiceTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
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
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
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
	): PageMissingPdfEditorReadService {
		$services = $this->getServiceContainer();
		$lookup = $services->getRevisionLookup();
		$access = new PageHistoryAccess( $lookup );
		$nativeSources = new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
			$services->getTitleFactory() );
		$renditions ??= new SourceRenditions( $services->getUrlUtils() );
		return new PageMissingPdfEditorReadService( $f['pilot'],
			new PageOwnedIdentityResolver( $services->getTitleFactory(), $lookup, $access ), $lookup,
			new PageReadService( $access, $nativeSources ), $sources ?? $nativeSources,
			new NewPageDrawing( $nativeSources, $renditions, $services->getRepoGroup()->getLocalRepo(),
				$services->getTitleFactory(), [] ), $renditions );
	}

	private function invoke( array $f, ?PageMissingPdfEditorReadService $service = null,
		array $overrides = [], ?Authority $authority = null
	): array {
		$args = array_replace( [ $f['page']->getId(), $f['revision'], $f['start'], $f['expected'], 2 ], $overrides );
		return ( $service ?? $this->service( $f ) )->read( ...array_merge( $args, [ $authority ?? $this->actor ] ) );
	}

	private function unavailable( callable $call ): void {
		try {
			$call();
			$this->fail( 'Expected complete PDF preparation refusal' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-editor-unavailable', $error->getMessage() );
			$this->assertNull( $error->getPrevious() );
		}
	}

	public static function providePages(): array {
		return [ [ 1, 1, false ], [ 1, 2, false ], [ 2, 1, false ], [ 2, 2, false ],
			[ 1, 1, true ], [ 1, 2, true ], [ 2, 1, true ], [ 2, 2, true ] ];
	}

	/** @dataProvider providePages */
	public function testRequestedPageKeepsExactBaseAndOneName( int $initial, int $target, bool $slot ): void {
		$f = $this->fixture( $initial, $slot );
		$before = $this->witness();
		$result = $this->invoke( $f, null, [ 4 => $target ] );
		$this->assertSame( $before, $this->witness() );
		$this->assertSame( $result, $this->invoke( $f, null, [ 4 => $target ] ) );
		$this->assertSame( $f['main'], $result['mainText'] );
		$this->assertSame( $f['base'], $result['baseText'] );
		$this->assertSame( $slot, $result['hasLayersSlot'] );
		$this->assertSame( $initial, $result['anchorSurface']['source']['page'] );
		$context = $result['context'];
		$this->assertSame( 2, $context['pageCount'] );
		$this->assertSame( $target, $context['page'] );
		$this->assertSame( $initial, $context['initialPage'] );
		$this->assertSame( 'ABC', $context['label'] );
		$this->assertSame( [], $context['members'] );
		$this->assertFalse( $context['stored'] );
		$this->assertSame( [], $context['surface']['layers'] );
		$this->assertSame( 'ABC', $context['surface']['label'] );
		$this->assertSame( NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'], 'ABC',
			$f['file']->getTitle()->getPrefixedDBkey(), $target ), $context['surface']['id'] );
		$this->assertSame( $target, $context['surface']['source']['page'] );
		$this->assertSame( $f['file']->getTimestamp(), $context['surface']['source']['timestamp'] );
		$this->assertSame( $f['file']->getSha1(), $context['surface']['source']['sha1'] );
		$this->assertSame( $f['file']->getWidth( $target ), $context['sourceGeometry']['width'] );
		$this->assertSame( $f['file']->getHeight( $target ), $context['sourceGeometry']['height'] );
		$this->assertStringContainsString( 'page' . $target . '-', $context['rendition']['url'] );
		$this->assertSame( $result['anchorSurface']['id'], $result['target']['surfaceId'] );
		if ( $slot ) {
			$this->assertSame( json_decode( $f['base'], true ), $result['baseBundle']['snapshot'] );
		} else {
			$this->assertNull( $result['baseBundle'] );
		}
	}

	public function testDefaultDuplicateOccurrencesShareTargetAndPreserveMain(): void {
		$f = $this->fixture( 2, false, 'on' );
		$f['main'] = $f['expected'] . "\n" . $f['expected'];
		$f['revision'] = $this->editPage( $f['page'], $f['main'] )->getNewRevision()->getId();
		$f['start'] = 0;
		$before = $this->witness();
		$first = $this->invoke( $f, null, [ 4 => 1 ] );
		$second = $this->invoke( $f, null, [ 2 => strlen( $f['expected'] . "\n" ), 4 => 1 ] );
		$this->assertSame( 'Default', $first['context']['label'] );
		$this->assertSame( $first['context'], $second['context'] );
		$this->assertSame( $f['main'], $first['mainText'] );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideInvalidRequests(): array {
		return [ [ 2, -1 ], [ 2, 0 ], [ 3, 'wrong embedding' ], [ 4, 0 ], [ 4, 3 ], [ 4, 101 ] ];
	}

	/** @dataProvider provideInvalidRequests */
	public function testInvalidSelectionOrPageRefusesWithoutWrites( int $index, $value ): void {
		$f = $this->fixture();
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, null, [ $index => $value ] ) );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideDeniedRights(): array {
		return [ [ 'read' ], [ 'edit' ], [ 'editlayers' ] ];
	}

	/** @dataProvider provideDeniedRights */
	public function testMissingRightsRefuseWithoutWrites( string $right ): void {
		$f = $this->fixture();
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static fn ( $action ) => $action !== $right );
		$authority->method( 'authorizeRead' )->willReturnCallback( static fn ( $action ) => $action !== $right );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, null, [], $authority ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testExistingSparseSetNeverBecomesAnEmptyCreation(): void {
		$f = $this->fixture();
		$init = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor );
		$surface = $init['pageOwned']['newSurface'];
		$surface['id'] = 'saved-p2';
		$surface['layers'] = [ [ 'id' => 'preserved', 'type' => 'text', 'x' => 1, 'y' => 2,
			'text' => 'Stored PDF work' ] ];
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ),
			'Stored sparse member' );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, null, [ 4 => 1 ] ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testForeignAndStaleRevisionsRefuseWithoutWrites(): void {
		$f = $this->fixture();
		$foreign = $this->getExistingTestPage();
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, null, [ 1 => $foreign->getLatest() ] ) );
		$this->assertSame( $before, $this->witness() );
		$this->editPage( $f['page'], $f['main'] . ' Newer owner work' );
		$after = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $after, $this->witness() );
	}

	public static function provideUnavailableCount(): array {
		return [ [ null ], [ false ], [ '2' ], [ 0 ], [ -1 ], [ 101 ] ];
	}

	/** @dataProvider provideUnavailableCount */
	public function testUnknownOrUnrepresentableCountRefuses( $count ): void {
		$f = $this->fixture();
		$file = $this->createMock( File::class );
		$file->method( 'pageCount' )->willReturn( $count );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturnCallback( static function ( $document ) use ( $file ): array {
			return [ json_decode( $document->getText(), true )['surfaces'][0]['id'] => $file ];
		} );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, null, $sources ) ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testNinetyNinePageMetadataDoesNotRequestUnvisitedRenditions(): void {
		$f = $this->fixture();
		$file = $this->createMock( File::class );
		$file->method( 'pageCount' )->willReturn( 99 );
		$file->method( 'getWidth' )->willReturn( 208 );
		$file->method( 'getHeight' )->willReturn( 416 );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturnCallback( static function ( $document ) use ( $file ): array {
			return [ json_decode( $document->getText(), true )['surfaces'][0]['id'] => $file ];
		} );
		$pages = [];
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willReturnCallback( static function ( $file, $surface )
			use ( &$pages ): array {
			$pages[] = $surface['source']['page'];
			return [ 'url' => 'http://example.test/exact-p2', 'width' => 208, 'height' => 417 ];
		} );
		$before = $this->witness();
		$result = $this->invoke( $f, $this->service( $f, $renditions, $sources ) );
		$this->assertSame( 99, $result['context']['pageCount'] );
		$this->assertSame( [ 2, 2 ], $pages );
		$this->assertSame( [], $result['context']['members'] );
		$this->assertArrayNotHasKey( 'pages', $result );
		$this->assertSame( $before, $this->witness() );
	}

	public function testFailedRequestedRenditionRefuses(): void {
		$f = $this->fixture();
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willThrowException( new \RuntimeException( 'Private error' ) );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, $renditions ) ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testChangedRenditionBetweenCapturesRefuses(): void {
		$f = $this->fixture();
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$calls = 0;
		$renditions->method( 'forSurface' )->willReturnCallback( static function ( $file, $surface )
			use ( $native, &$calls ): array {
			$result = $native->forSurface( $file, $surface );
			$result['height'] += $calls++;
			return $result;
		} );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, $renditions ) ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testReuploadDuringReadRefusesAndPreservesOwner(): void {
		$f = $this->fixture();
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$afterUpload = null;
		$renditions->method( 'forSurface' )->willReturnCallback( function ( $file, $surface )
			use ( $native, &$afterUpload, $f ): array {
			$result = $native->forSurface( $file, $surface );
			if ( $afterUpload === null ) {
				$this->upload( $f['file']->getTitle()->getPrefixedDBkey(),
					'test-multipage-replacement.pdf', '20261001000000' );
				$afterUpload = $this->witness();
			}
			return $result;
		} );
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, $renditions ) ) );
		$this->assertNotNull( $afterUpload );
		$this->assertSame( $afterUpload, $this->witness() );
	}

	public function testSameNameFileAndSlideSiblingsRemainByteExact(): void {
		$f = $this->fixture( 2, true );
		$other = $this->fixture( 1 );
		$member = $other['pilot']->prepareBoundEditor( $other['page']->getId(), $other['revision'],
			$other['start'], $other['expected'], $this->actor )['pageOwned']['newSurface'];
		$member['id'] = 'another-file';
		$document = json_decode( $f['base'], true );
		$document['surfaces'][0]['label'] = 'ABC';
		$document['surfaces'][] = $member;
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( $document ), 'Independent siblings' );
		$base = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $f['revision'] )
			->getContent( 'layers' )->serialize();
		$before = $this->witness();
		$result = $this->invoke( $f );
		$this->assertSame( $base, $result['baseText'] );
		$this->assertSame( json_decode( $base, true ), $result['baseBundle']['snapshot'] );
		$this->assertSame( $f['file']->getTitle()->getPrefixedDBkey(),
			$result['context']['surface']['source']['fileTitle'] );
		$this->assertSame( [], $result['context']['surface']['layers'] );
		$this->assertSame( $before, $this->witness() );
	}

	public function testAnotherOwnersSameFileAndNameCannotSupplyLayers(): void {
		$f = $this->fixture();
		$other = $this->getExistingTestPage();
		$revision = $this->editPage( $other, $f['expected'] )->getNewRevision()->getId();
		$surface = $f['pilot']->prepareBoundEditor( $other->getId(), $revision, 0,
			$f['expected'], $this->actor )['pageOwned']['newSurface'];
		$surface['layers'] = [ [ 'id' => 'foreign-note', 'type' => 'text', 'x' => 4, 'y' => 7,
			'text' => 'Other owner only' ] ];
		$this->registration['publisher']->publish( $other->getTitle(), $this->actor, $revision,
			json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ), 'Other owner setup' );
		$before = $this->witness();
		$result = $this->invoke( $f );
		$this->assertSame( [], $result['context']['surface']['layers'] );
		$this->assertNotSame( $surface['id'], $result['context']['surface']['id'] );
		$this->assertSame( $f['page']->getId(), $result['target']['pageId'] );
		$this->assertSame( $before, $this->witness() );
	}

	public function testUnvisitedRenditionFailureDoesNotBlockRequestedPage(): void {
		$f = $this->fixture();
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$pages = [];
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willReturnCallback( static function ( $file, $surface )
			use ( $native, &$pages ): array {
			$pages[] = $surface['source']['page'];
			if ( $surface['source']['page'] !== 2 ) {
				throw new \DomainException( 'Unvisited page unavailable' );
			}
			return $native->forSurface( $file, $surface );
		} );
		$before = $this->witness();
		$result = $this->invoke( $f, $this->service( $f, $renditions ) );
		$this->assertSame( 2, $result['context']['page'] );
		$this->assertSame( [ 2, 2 ], $pages );
		$this->assertSame( $before, $this->witness() );
	}

	public function testPreservedSiblingsCountTowardsWholePdfCapacity(): void {
		$f = $this->fixture( 2, true );
		$template = json_decode( $f['base'], true )['surfaces'][0];
		$surfaces = [];
		for ( $index = 1; $index <= 99; $index++ ) {
			$surface = $template;
			$surface['id'] = 'retained-' . $index;
			$surface['label'] = 'Sibling ' . $index;
			$surfaces[] = $surface;
		}
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ), 'Capacity fixture' );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideBases(): array {
		return [ [ false ], [ true ] ];
	}

	public function testDifferentRequestedPageNeverSubstitutesTheInitialPage(): void {
		$f = $this->fixture();
		$before = $this->witness();
		$result = $this->invoke( $f, null, [ 4 => 1 ] );
		$this->assertSame( 2, $result['anchorSurface']['source']['page'] );
		$this->assertSame( 1, $result['context']['page'] );
		$this->assertSame( 1, $result['context']['surface']['source']['page'] );
		$this->assertStringContainsString( 'page1-', $result['context']['rendition']['url'] );
		$this->assertSame( $before, $this->witness() );
	}

	public function testStoredEmptyFirstPageRefusesMissingSecondPageCreation(): void {
		$f = $this->fixture();
		$surface = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$surface['id'] = 'saved-first';
		$surface['source']['page'] = 1;
		$surface['canvas']['width'] = $f['file']->getWidth( 1 );
		$surface['canvas']['height'] = $f['file']->getHeight( 1 );
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ),
			'Stored empty member' );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $before, $this->witness() );
	}

	/** @dataProvider provideBases */
	public function testNativeFirstSavePreservesMainAndCompleteSiblings( bool $slot ): void {
		$f = $this->fixture( 2, $slot );
		$first = $this->invoke( $f, null, [ 4 => 1 ] );
		$second = $this->invoke( $f );
		$base = $first['baseBundle']['snapshot'] ?? [ 'schemaVersion' => 1, 'surfaces' => [] ];
		$preserved = $base['surfaces'];
		foreach ( [ $first, $second ] as $prepared ) {
			$surface = $prepared['context']['surface'];
			$surface['layers'] = [ [ 'id' => 'created-note', 'type' => 'text', 'x' => 4, 'y' => 7,
				'text' => 'New page ' . $surface['source']['page'] ] ];
			$base['surfaces'][] = $surface;
		}
		// Explicit native publication is separate from read admission; no new caller is installed.
		$revision = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( $base ), 'Created layer set ABC' );
		$this->assertGreaterThan( $f['revision'], $revision );
		$saved = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
		$this->assertSame( $f['revision'], $saved->getParentId() );
		$this->assertSame( $f['main'], $saved->getContent( 'main' )->serialize() );
		$document = json_decode( $saved->getContent( 'layers' )->serialize(), true );
		$this->assertSame( json_decode( JsonSnapshotCodec::encode( $base ), true ), $document );
		$this->assertSame( $preserved, array_slice( $document['surfaces'], 0, count( $preserved ) ) );
		$init = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $revision,
			$f['start'], $f['expected'], $this->actor );
		$this->assertArrayNotHasKey( 'newSurface', $init['pageOwned'] );
		$this->assertSame( 2, $init['pageOwned']['pdfContext']['pageCount'] );
		$this->assertSame( 2, $init['pageOwned']['pdfContext']['page'] );
		$this->assertSame( 'ABC', $init['pageOwned']['pdfContext']['label'] );
	}

	public function testCompetingNativeOwnerEditAtFinalAdmissionPreservesNewerWork(): void {
		$f = $this->fixture( 2, true );
		$native = $f['pilot'];
		$pilot = $this->getMockBuilder( PageOwnedPilot::class )
			->setConstructorArgs( [ $this->getServiceContainer(), [], [ NS_MAIN ] ] )
			->onlyMethods( [ 'prepareBoundEditor' ] )->getMock();
		$calls = 0;
		$afterEdit = null;
		$pilot->method( 'prepareBoundEditor' )->willReturnCallback(
			function ( ...$args ) use ( $native, &$calls, &$afterEdit, $f ) {
				$result = $native->prepareBoundEditor( ...$args );
				if ( ++$calls === 4 ) {
					$this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
						$f['revision'], $f['base'], 'Competing native owner edit',
						new \MediaWiki\Content\WikitextContent( $f['main'] . ' Newer owner text' ) );
					$afterEdit = $this->witness();
				}
				return $result;
			} );
		$f['pilot'] = $pilot;
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertNotNull( $afterEdit );
		$this->assertSame( 4, $calls );
		$this->assertSame( $afterEdit, $this->witness() );
	}

	public function testFilePermissionLossDuringReadRefusesWithoutWrites(): void {
		$f = $this->fixture();
		$denied = false;
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturn( true );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static function ( $right, $title ) use ( &$denied, $f ): bool {
				return !$denied || $title->getPrefixedDBkey() !== $f['file']->getTitle()->getPrefixedDBkey();
			}
		);
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willReturnCallback(
			static function ( $file, $surface ) use ( $native, &$denied ): array {
				$result = $native->forSurface( $file, $surface );
				$denied = true;
				return $result;
			} );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, $renditions ), [], $authority ) );
		$this->assertTrue( $denied );
		$this->assertSame( $before, $this->witness() );
	}

}
