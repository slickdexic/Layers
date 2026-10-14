<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfSetPreparation;
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
 * @covers \MediaWiki\Extension\Layers\Revision\PageMissingPdfSetPreparation
 * @group Database
 */
class PageMissingPdfSetPreparationTest extends \MediaWikiIntegrationTestCase {

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

	private function invoke( array $f, ?PageMissingPdfSetPreparation $service = null,
		array $overrides = [], ?Authority $authority = null
	): array {
		$args = array_replace( [ $f['page']->getId(), $f['revision'], $f['start'], $f['expected'] ], $overrides );
		return ( $service ?? $this->service( $f ) )->prepare( ...array_merge( $args, [ $authority ?? $this->actor ] ) );
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

	public static function provideInitialPages(): array {
		return [ [ 1, false ], [ 2, false ], [ 1, true ], [ 2, true ] ];
	}

	/** @dataProvider provideInitialPages */
	public function testBothPagesKeepOneNameAndExactNativeGeometryWithoutWriting( int $initial, bool $slot ): void {
		$f = $this->fixture( $initial, $slot );
		$before = $this->witness();
		$result = $this->invoke( $f );
		$this->assertSame( $before, $this->witness() );
		$this->assertSame( $result, $this->invoke( $f ) );
		$this->assertSame( 2, $result['pageCount'] );
		$this->assertSame( $initial, $result['initialPage'] );
		$this->assertSame( 'ABC', $result['label'] );
		$this->assertSame( $slot, $result['hasLayersSlot'] );
		$this->assertSame( $f['main'], $result['mainText'] );
		$this->assertSame( $f['base'], $result['baseText'] );
		$this->assertSame( [ 'start' => $f['start'], 'expected' => $f['expected'] ], $result['selection'] );
		$this->assertSame( [ 1, 2 ], array_column( $result['pages'], 'page' ) );
		$this->assertCount( 2, array_unique( array_column( array_column( $result['pages'], 'surface' ), 'id' ) ) );
		foreach ( $result['pages'] as $entry ) {
			$page = $entry['page'];
			$this->assertSame( 'ABC', $entry['surface']['label'] );
			$this->assertSame( [], $entry['surface']['layers'] );
			$this->assertSame( NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'], 'ABC',
				$f['file']->getTitle()->getPrefixedDBkey(), $page ), $entry['surface']['id'] );
			$this->assertSame( $f['file']->getSha1(), $entry['surface']['source']['sha1'] );
			$this->assertSame( $f['file']->getTimestamp(), $entry['surface']['source']['timestamp'] );
			$this->assertSame( $page, $entry['surface']['source']['page'] );
			$this->assertSame( $f['file']->getWidth( $page ), $entry['sourceGeometry']['width'] );
			$this->assertSame( $f['file']->getHeight( $page ), $entry['sourceGeometry']['height'] );
			$this->assertSame( $entry['sourceGeometry']['width'], $entry['surface']['canvas']['width'] );
			$this->assertSame( $entry['sourceGeometry']['height'], $entry['surface']['canvas']['height'] );
			$this->assertStringContainsString( 'page' . $page . '-', $entry['rendition']['url'] );
			$this->assertGreaterThan( 0, $entry['rendition']['height'] );
		}
		$this->assertSame( $result['pages'][$initial - 1]['surface']['id'], $result['target']['surfaceId'] );
		$this->assertSame( $f['page']->getTitle()->getPrefixedDBkey(), $result['target']['owner'] );
		if ( $slot ) {
			$this->assertSame( json_decode( $f['base'], true ), $result['baseBundle']['snapshot'] );
		} else {
			$this->assertNull( $result['baseBundle'] );
		}
	}

	public function testDefaultAndDuplicateOccurrencesUseTheSameInternalMembers(): void {
		$f = $this->fixture( 2, false, 'on' );
		$f['revision'] = $this->editPage( $f['page'], $f['expected'] . "\n" . $f['expected'] )
			->getNewRevision()->getId();
		$f['start'] = 0;
		$before = $this->witness();
		$first = $this->invoke( $f );
		$second = $this->invoke( $f, null, [ 2 => strlen( $f['expected'] . "\n" ) ] );
		$this->assertSame( 'Default', $first['label'] );
		$this->assertSame( [ 'Default', 'Default' ],
			array_column( array_column( $first['pages'], 'surface' ), 'label' ) );
		$this->assertSame( $first['pages'], $second['pages'] );
		$this->assertSame( $first['target'], $second['target'] );
		$this->assertSame( $before, $this->witness() );
	}

	public function testExistingSparseSetIsNotReplacedByEmptyPreparation(): void {
		$f = $this->fixture( 2 );
		$selected = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$selected['source']['page'] = 1;
		$selected['id'] = 'retained-first';
		$selected['layers'] = [ [ 'id' => 'saved', 'type' => 'text', 'x' => 9, 'y' => 19, 'text' => 'Keep me' ] ];
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $selected ] ] ), 'Sparse set setup' );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideInvalidSelection(): array {
		return [ [ 0, 0 ], [ 0, 2147483648 ], [ 1, 0 ], [ 1, 2147483648 ], [ 2, -1 ],
			[ 2, 0 ], [ 3, '[[File:Another.pdf|layerset=ABC]]' ], [ 3, "\xff" ] ];
	}

	/** @dataProvider provideInvalidSelection */
	public function testInvalidNativeSelectionRefusesWithoutWrites( int $index, $value ): void {
		$f = $this->fixture();
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, null, [ $index => $value ] ) );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideDeniedRights(): array {
		return [ [ 'read' ], [ 'edit' ], [ 'editlayers' ] ];
	}

	/** @dataProvider provideDeniedRights */
	public function testMissingRightsNeverPreparePages( string $denied ): void {
		$f = $this->fixture();
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static fn ( $right ) => $right !== $denied );
		$authority->method( 'authorizeRead' )->willReturnCallback( static fn ( $right ) => $right !== $denied );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, null, [], $authority ) );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideUnavailableCount(): array {
		return [ [ null ], [ false ], [ '2' ], [ 0 ], [ -1 ], [ 101 ] ];
	}

	/** @dataProvider provideUnavailableCount */
	public function testUnknownAndUnrepresentableCountsNeverReturnPartialSets( $count ): void {
		$f = $this->fixture();
		$init = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor );
		$file = $this->createMock( File::class );
		$file->method( 'pageCount' )->willReturn( $count );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturn( [ $init['pageOwned']['surfaceId'] => $file ] );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, null, $sources ) ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testOneUnavailablePageRefusesTheCompleteSet(): void {
		$f = $this->fixture();
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willReturnCallback( static function ( $file, $surface ): array {
			if ( $surface['source']['page'] === 1 ) {
				throw new \DomainException( 'Private page-one failure' );
			}
			return [ 'url' => 'http://example.test/page2', 'width' => 208, 'height' => 417 ];
		} );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, $renditions ) ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testChangedRenditionBetweenCapturesRefuses(): void {
		$f = $this->fixture();
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$calls = 0;
		$renditions->method( 'forSurface' )->willReturnCallback(
			static function ( $file, $surface ) use ( $native, &$calls ): array {
				$result = $native->forSurface( $file, $surface );
				if ( ++$calls > 3 ) {
					$result['height']++;
				}
				return $result;
			} );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, $renditions ) ) );
		$this->assertSame( 6, $calls );
		$this->assertSame( $before, $this->witness() );
	}

	public function testForeignAndStaleRevisionsRefuseWithoutChangingHistory(): void {
		$f = $this->fixture();
		$foreign = $this->getExistingTestPage();
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, null, [ 1 => $foreign->getLatest() ] ) );
		$this->assertSame( $before, $this->witness() );
		$this->editPage( $f['page'], $f['main'] . ' newer owner text' );
		$after = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $after, $this->witness() );
	}

	public function testSameNameOnAnotherFileAndSlideLeavesCompleteBaseExact(): void {
		$f = $this->fixture( 2, true );
		$other = $this->fixture( 1 );
		$member = $other['pilot']->prepareBoundEditor( $other['page']->getId(), $other['revision'],
			$other['start'], $other['expected'], $this->actor )['pageOwned']['newSurface'];
		$member['id'] = 'another-file';
		$document = json_decode( $f['base'], true );
		$document['surfaces'][0]['label'] = 'ABC';
		$document['surfaces'][] = $member;
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( $document ), 'Independent same-name siblings' );
		$base = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $f['revision'] )
			->getContent( 'layers' )->serialize();
		$before = $this->witness();
		$result = $this->invoke( $f );
		$this->assertSame( $base, $result['baseText'] );
		$this->assertSame( json_decode( $base, true ), $result['baseBundle']['snapshot'] );
		$this->assertCount( 2, $result['baseBundle']['snapshot']['surfaces'] );
		foreach ( $result['pages'] as $entry ) {
			$this->assertSame( $f['file']->getTitle()->getPrefixedDBkey(), $entry['surface']['source']['fileTitle'] );
			$this->assertSame( 'ABC', $entry['surface']['label'] );
			$this->assertSame( [], $entry['surface']['layers'] );
		}
		$this->assertSame( $before, $this->witness() );
	}

	public function testAnotherOwnersSameFileAndNameDoesNotSupplyItsLayers(): void {
		$f = $this->fixture();
		$other = $this->getExistingTestPage();
		$revision = $this->editPage( $other, $f['expected'] )->getNewRevision()->getId();
		$surface = $f['pilot']->prepareBoundEditor( $other->getId(), $revision, 0,
			$f['expected'], $this->actor )['pageOwned']['newSurface'];
		$surface['layers'] = [ [ 'id' => 'foreign-note', 'type' => 'text', 'x' => 4, 'y' => 7,
			'text' => 'Only the other owner' ] ];
		$this->registration['publisher']->publish( $other->getTitle(), $this->actor,
			$revision, json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ), 'Other owner setup' );
		$before = $this->witness();
		$result = $this->invoke( $f );
		foreach ( $result['pages'] as $entry ) {
			$this->assertSame( [], $entry['surface']['layers'] );
			$this->assertNotSame( $surface['id'], $entry['surface']['id'] );
		}
		$this->assertSame( $f['page']->getId(), $result['target']['pageId'] );
		$this->assertSame( $before, $this->witness() );
	}

	public function testStoredEmptyMemberIsAnExistingSetAndRefuses(): void {
		$f = $this->fixture();
		$surface = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ), 'Stored empty set' );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testNativeReuploadDuringPreparationRefusesAndPreservesOwner(): void {
		$f = $this->fixture();
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$calls = 0;
		$afterUpload = null;
		$renditions->method( 'forSurface' )->willReturnCallback(
			function ( $file, $surface ) use ( $native, &$calls, &$afterUpload, $f ): array {
				$result = $native->forSurface( $file, $surface );
				if ( ++$calls === 4 ) {
					$this->upload( $f['file']->getTitle()->getPrefixedDBkey(),
						'test-multipage-replacement.pdf', '20260906130000' );
					$afterUpload = $this->witness();
				}
				return $result;
			} );
		$this->unavailable( fn () => $this->invoke( $f, $this->service( $f, $renditions ) ) );
		$this->assertNotNull( $afterUpload );
		$this->assertSame( $afterUpload, $this->witness() );
		$this->assertSame( $f['revision'], $f['page']->getLatest() );
	}

	public function testCompetingNativeEditAtFinalAdmissionPreservesNewerWork(): void {
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
						new \MediaWiki\Content\WikitextContent( $f['main'] . ' Newer text π' ) );
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

	public function testFilePermissionLossDuringPreparationRefusesWithoutWrites(): void {
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

	public function testPreservedSiblingsCountTowardsTheExistingDocumentLimit(): void {
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
}
