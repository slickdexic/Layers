<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPreparation;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfSetPreparation;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Exact native admission and core PDF renditions in an isolated repository.
 * @covers \MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPreparation
 * @covers \MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService
 * @group Database
 */
class PageMissingPdfImportPreparationTest extends \MediaWikiIntegrationTestCase {

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
		$text = json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ], JSON_THROW_ON_ERROR );
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

	private function invoke( array $target, array $source, array $overrides = [],
		?Authority $authority = null, ?SourceRenditions $renditions = null
	): array {
		$service = new PageMissingPdfImportPreparation( $this->service( $target ),
			$this->importReader( $renditions ) );
		$args = array_replace( [ $target['page']->getId(), $target['revision'], $target['start'],
			$target['expected'], $source['page']->getId(), $source['revision'], $source['anchor'] ], $overrides );
		return $service->prepare( ...array_merge( $args, [ $authority ?? $this->actor ] ) );
	}

	private function unavailable( callable $call ): void {
		try {
			$call();
			$this->fail( 'Expected complete Import refusal' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
			$this->assertNull( $error->getPrevious() );
		}
	}

	public static function provideInitialPages(): array {
		return [ [ 1, false ], [ 2, false ], [ 1, true ], [ 2, true ] ];
	}

	/** @dataProvider provideInitialPages */
	public function testCompleteAdmissionKeepsStoredBaseSeparateWithoutWriting( int $initial, bool $slot ): void {
		$f = $this->fixture( $initial, $slot );
		$source = $this->sourceFixture( $f );
		$before = $this->witness();
		$result = $this->invoke( $f, $source );
		$this->assertSame( $before, $this->witness() );
		$target = $result['targetAdmission'];
		$this->assertSame( $f['main'], $target['mainText'] );
		$this->assertSame( $f['base'], $target['baseText'] );
		$this->assertSame( $slot, $target['hasLayersSlot'] );
		$this->assertSame( $initial, $target['initialPage'] );
		$this->assertSame( $f['revision'], $target['target']['revisionId'] );
		$this->assertSame( [ 'start' => $f['start'], 'expected' => $f['expected'] ], $target['selection'] );
		$this->assertSame( [ 1, 2 ], array_column( $target['pages'], 'page' ) );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( array_column( $target['pages'], 'surface' ), 'label' ) );
		$this->assertSame( [ [], [] ], array_column( array_column( $target['pages'], 'surface' ), 'layers' ) );
		$this->assertSame( $slot ? json_decode( $f['base'], true ) : null,
			$target['baseBundle']['snapshot'] ?? null );
		$this->assertEquals( json_decode( $source['text'] ), $result['sourceBundle']['snapshot'] );
		$this->assertSame( $source['revision'], $result['source']['revisionId'] );
		$this->assertSame( $source['page']->getId(), $result['source']['pageId'] );
		$this->assertSame( [ 1, 2 ], array_column( $result['sourceGroup']['members'], 'page' ) );
		foreach ( $target['pages'] as $entry ) {
			$this->assertNotContains( $entry['surface']['id'], array_column( $source['surfaces'], 'id' ) );
			$this->assertSame( $f['file']->getSha1(), $entry['surface']['source']['sha1'] );
			$this->assertSame( $f['file']->getWidth( $entry['page'] ), $entry['sourceGeometry']['width'] );
			$this->assertSame( $f['file']->getHeight( $entry['page'] ), $entry['sourceGeometry']['height'] );
		}
		$this->assertArrayNotHasKey( 'publicationToken', $result );
	}

	public function testSparseSourceStillPreparesEveryEmptyDestinationPage(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f, [ 2 ] );
		$before = $this->witness();
		$result = $this->invoke( $f, $source );
		$this->assertSame( [ 2 ], array_column( $result['sourceGroup']['members'], 'page' ) );
		$this->assertSame( [ 1, 2 ], array_column( $result['targetAdmission']['pages'], 'page' ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testExplicitHistoricalSourceDoesNotSubstituteItsNewerPayload(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$new = json_decode( $source['text'], true );
		$new['surfaces'][0]['layers'][0]['text'] = 'Newer independent work';
		$this->registration['publisher']->publish( $source['page']->getTitle(), $this->actor,
			$source['revision'], json_encode( $new ), 'Newer source' );
		$before = $this->witness();
		$result = $this->invoke( $f, $source );
		$this->assertEquals( json_decode( $source['text'] ), $result['sourceBundle']['snapshot'] );
		$this->assertSame( $source['revision'], $result['source']['revisionId'] );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideBadSelection(): array {
		return [ [ 0, 0 ], [ 1, 0 ], [ 2, -1 ], [ 2, 0 ], [ 3, 'wrong embedding' ],
			[ 4, 0 ], [ 5, 0 ], [ 6, '' ], [ 6, 'foreign-anchor' ] ];
	}

	/** @dataProvider provideBadSelection */
	public function testInvalidSelectionsRefuseCompletely( int $index, $value ): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $source, [ $index => $value ] ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testSameOwnerAndForeignRevisionRefuse(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $source, [ 4 => $f['page']->getId() ] ) );
		$this->unavailable( fn () => $this->invoke( $f, $source, [ 5 => $f['revision'] ] ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testDifferentFileOrNameNeverSubstitutesAnotherSet(): void {
		$f = $this->fixture();
		$wrongName = $this->sourceFixture( $f, [ 2 ], 'Another' );
		$other = $this->upload();
		$wrongFile = $this->sourceFixture( $f, [ 2 ], 'ABC', $other->getTitle()->getPrefixedDBkey() );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $wrongName ) );
		$this->unavailable( fn () => $this->invoke( $f, $wrongFile ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testStoredTargetEvenWhenEmptyUsesExistingPathInstead(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$surface = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ), 'Existing target' );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $source ) );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideDeniedRights(): array {
		return [ [ 'read' ], [ 'edit' ], [ 'editlayers' ] ];
	}

	/** @dataProvider provideDeniedRights */
	public function testDeniedRightsDoNotDisclosePartialResults( string $right ): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static fn ( $r ) => $r !== $right );
		$authority->method( 'authorizeRead' )->willReturnCallback( static fn ( $r ) => $r !== $right );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $source, [], $authority ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testSourceRenditionFailureReturnsNoPartialPreparation(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willThrowException( new \DomainException( 'Private source problem' ) );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, $source, [], null, $renditions ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testTargetEditDuringSourceRenderingPreservesNewerWorkAndRefuses(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$after = null;
		$renditions->method( 'forSurface' )->willReturnCallback(
			function ( $file, $surface ) use ( $native, $f, &$after ): array {
				$result = $native->forSurface( $file, $surface );
				if ( $after === null ) {
					$this->editPage( $f['page'], $f['main'] . ' Newer work remains' );
					$after = $this->witness();
				}
				return $result;
			}
		);
		$this->unavailable( fn () => $this->invoke( $f, $source, [], null, $renditions ) );
		$this->assertNotNull( $after );
		$this->assertSame( $after, $this->witness() );
	}

	public function testSourceReadAuthorityIsRepeatedAfterFinalTargetAdmission(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$allowed = true;
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static function () use ( &$allowed ): bool {
			return $allowed;
		} );
		$authority->method( 'authorizeRead' )->willReturnCallback( static function () use ( &$allowed ): bool {
			return $allowed;
		} );
		$native = $this->service( $f );
		$missing = $this->createMock( PageMissingPdfSetPreparation::class );
		$calls = 0;
		$missing->method( 'prepare' )->willReturnCallback(
			static function ( ...$args ) use ( $native, &$calls, &$allowed ): array {
				$result = $native->prepare( ...$args );
				if ( ++$calls === 2 ) {
					$allowed = false;
				}
				return $result;
			}
		);
		$service = new PageMissingPdfImportPreparation( $missing, $this->importReader() );
		$before = $this->witness();
		$this->unavailable( static fn () => $service->prepare( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $source['page']->getId(), $source['revision'],
			$source['anchor'], $authority ) );
		$this->assertSame( 2, $calls );
		$this->assertSame( $before, $this->witness() );
	}
}
