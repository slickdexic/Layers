<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\MutableRevisionRecord;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';
require_once __DIR__ . '/TestingAdmissionRegistration.php';
if ( !class_exists( PageWorkingCopyPdfImportReadService::class ) ) {
	require_once __DIR__ . '/../../../src/Revision/PageWorkingCopyPdfImportReadService.php';
}

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService
 * @group Database
 */
class PageWorkingCopyPdfImportReadServiceTest extends \MediaWikiIntegrationTestCase {
	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;
	private array $pair;
	private SourceVersionResolver $sources;
	private SourceRenditions $renditions;
	private PageHistoryAccess $access;
	private NewPageDrawing $newSurface;
	private array $pin;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->setUpIsolatedLocalRepoFixture();
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$services = $this->getServiceContainer();
		$this->access = new PageHistoryAccess( $services->getRevisionLookup() );
		$repo = $services->getRepoGroup()->getLocalRepo();
		$this->sources = new SourceVersionResolver( $repo, $services->getTitleFactory() );
		$this->renditions = new SourceRenditions( $services->getUrlUtils() );
		$this->newSurface = new NewPageDrawing( $this->sources, $this->renditions, $repo,
			$services->getTitleFactory(), [] );
		$name = 'File:Whole-pdf-import-' . wfRandomString( 8 ) . '.pdf';
		$file = $this->upload( $name );
		$this->pin = [ 'repository' => 'local', 'fileTitle' => $name,
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1() ];
		$this->pair = [];
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'WholePdf' . $role . wfRandomString( 8 ) );
			$surfaces = $role === 'target' ? [ $this->surface( 'target-two', 2 ) ] :
				[ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ) ];
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$page->getLatest(), $this->document( $surfaces ), 'Isolated whole-PDF Import fixture' );
			$this->pair[$role] = [ 'pageId' => $page->getId(), 'title' => $page->getTitle(),
				'revisionId' => $revision, 'surfaceId' => $surfaces[0]['id'] ];
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
			'Isolated Import asset', 'Fixture', 0, false, $timestamp, $this->getTestSysop()->getUser() );
		$this->assertStatusGood( $status );
		self::guardIsolatedFixtureRepository( $repo );
		return $file;
	}

	private function surface( string $id, int $page, ?array $pin = null, string $label = 'ABC' ): array {
		return [ 'id' => $id, 'kind' => 'pdf', 'label' => $label,
			'canvas' => [ 'width' => 416, 'height' => 208, 'backgroundColor' => '#eeeeee',
				'backgroundVisible' => false, 'backgroundOpacity' => 0.5 ],
			'source' => ( $pin ?? $this->pin ) + [ 'page' => $page ],
			'layers' => [ [ 'id' => 'text', 'type' => 'text', 'text' => $id,
				'x' => 24, 'y' => 31, 'rotation' => 15 ] ], 'readingOrder' => [ 'text' ] ];
	}

	private function document( array $surfaces ): string {
		return json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ], JSON_THROW_ON_ERROR );
	}

	private function service( ?SourceRenditions $renditions = null, ?NewPageDrawing $newSurface = null,
		?PageHistoryAccess $access = null, ?SourceVersionResolver $sources = null
	): PageWorkingCopyPdfImportReadService {
		$services = $this->getServiceContainer();
		return new PageWorkingCopyPdfImportReadService( new PageOwnedIdentityResolver(
			$services->getTitleFactory(), $services->getRevisionLookup(), $this->access ),
			$services->getTitleFactory(), PageOwnedScope::newFromServices( $services, [] ),
			$access ?? $this->access, $sources ?? $this->sources, $renditions ?? $this->renditions,
			$newSurface ?? $this->newSurface );
	}

	private function invoke( ?PageWorkingCopyPdfImportReadService $service = null,
		?Authority $authority = null, array $overrides = []
	): array {
		$args = [];
		foreach ( [ 'target', 'source' ] as $role ) {
			foreach ( [ 'pageId', 'revisionId', 'surfaceId' ] as $key ) {
				$args[] = $this->pair[$role][$key];
			}
		}
		return ( $service ?? $this->service() )->read( ...array_merge(
			array_replace( $args, $overrides ), [ $authority ?? $this->actor ] ) );
	}

	private function state(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text' ] as $table ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$rows[] = serialize( (array)$row );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	private function unavailable( callable $operation ): void {
		try {
			$operation();
			$this->fail( 'Whole-PDF Import preparation must refuse' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		}
	}

	public function testCompleteSparseGroupsAndNativeMissingMemberNeverWrite(): void {
		$before = $this->state();
		$result = $this->invoke();
		$this->assertSame( [ [ 'page' => 1, 'surfaceId' => 'source-one' ],
			[ 'page' => 2, 'surfaceId' => 'source-two' ] ], $result['sourceGroup']['members'] );
		$this->assertSame( [ [ 'page' => 2, 'surfaceId' => 'target-two' ] ], $result['targetGroup']['members'] );
		$this->assertSame( 'ABC', $result['targetGroup']['label'] );
		$this->assertSame( 'ABC', $result['sourceGroup']['label'] );
		$this->assertSame( 2, $result['targetGroup']['pageCount'] );
		$this->assertCount( 1, $result['admittedTargetSurfaces'] );
		$admitted = $result['admittedTargetSurfaces'][0];
		$this->assertSame( [], $admitted['layers'] );
		$this->assertEquals( $this->pin + [ 'page' => 1 ], $admitted['source'] );
		$this->assertSame( NewPageDrawing::surfaceId( $this->pair['target']['pageId'],
			$this->pair['target']['revisionId'], 'ABC', $this->pin['fileTitle'], 1 ), $admitted['id'] );
		$this->assertSame( 416, $result['admittedTargetGeometry'][$admitted['id']]['width'] );
		$this->assertSame( 208, $result['admittedTargetGeometry'][$admitted['id']]['height'] );
		$this->assertStringContainsString( 'page1-', $result['admittedTargetRenditions'][$admitted['id']]['url'] );
		foreach ( [ 'target', 'source' ] as $role ) {
			$expected = $this->access->read( $this->pair[$role]['title'], $this->pair[$role]['revisionId'],
				$this->actor, $this->pair[$role]['pageId'] )->getText();
			$this->assertSame( JsonSnapshotCodec::encode( json_decode( $expected ) ),
				JsonSnapshotCodec::encode( $result[$role . 'Bundle']['snapshot'] ) );
		}
		$this->assertEquals( $result, $this->invoke() );
		$this->assertSame( $before, $this->state() );
	}

	private function replace( string $role, array $surfaces ): void {
		$owner = &$this->pair[$role];
		$owner['revisionId'] = $this->registration['publisher']->publish( $owner['title'], $this->actor,
			$owner['revisionId'], $this->document( $surfaces ), 'Isolated Import version change' );
		$owner['surfaceId'] = $surfaces[0]['id'];
	}

	public function testArchivedTargetAdmissionsNeverUseDifferentSourceVersion(): void {
		$current = $this->upload( $this->pin['fileTitle'], 'test-multipage-replacement.pdf', '20260906130000' );
		$newPin = array_replace( $this->pin,
			[ 'timestamp' => $current->getTimestamp(), 'sha1' => $current->getSha1() ] );
		$this->replace( 'source', [ $this->surface( 'new-source', 1, $newPin, 'abc' ) ] );
		$before = $this->state();
		$result = $this->invoke();
		$this->assertSame( 1, $result['sourceGroup']['pageCount'] );
		$this->assertSame( 2, $result['targetGroup']['pageCount'] );
		$this->assertEquals( $this->pin, $result['targetGroup']['source'] );
		$this->assertEquals( $newPin, $result['sourceGroup']['source'] );
		$admission = $result['admittedTargetSurfaces'][0];
		$this->assertSame( 'ABC', $admission['label'] );
		$this->assertEquals( $this->pin + [ 'page' => 1 ], $admission['source'] );
		$this->assertStringContainsString( '/archive/', $result['admittedTargetRenditions'][$admission['id']]['url'] );
		$this->assertSame( $before, $this->state() );
	}

	public function testShorterTargetRefusesWholeRequestBeforeAnyAdmission(): void {
		$current = $this->upload( $this->pin['fileTitle'], 'test-multipage-replacement.pdf', '20260906130000' );
		$newPin = array_replace( $this->pin,
			[ 'timestamp' => $current->getTimestamp(), 'sha1' => $current->getSha1() ] );
		$this->replace( 'target', [ $this->surface( 'short-target', 1, $newPin ) ] );
		$new = $this->createMock( NewPageDrawing::class );
		$new->expects( $this->never() )->method( 'prepare' );
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( $this->service( null, $new ) ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testExactReadableHistoryAndUnrelatedFileNameAndSlideStayComplete(): void {
		$otherFile = $this->upload( 'File:Other-import-' . wfRandomString( 8 ) . '.pdf' );
		$otherPin = array_replace( $this->pin, [ 'fileTitle' => 'File:' . $otherFile->getName(),
			'timestamp' => $otherFile->getTimestamp(), 'sha1' => $otherFile->getSha1() ] );
		$surfaces = [ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ),
			$this->surface( 'other-name', 1, null, 'XYZ' ), $this->surface( 'other-file', 1, $otherPin ) ];
		$slide = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$surfaces[] = $slide['surfaces'][0];
		$this->replace( 'source', $surfaces );
		$old = $this->pair['source'];
		$this->replace( 'source', [ $this->surface( 'later', 1, null, 'Later' ) ] );
		$authority = $this->authority( static fn ( $right, $title ): bool =>
			$title->getPrefixedDBkey() !== $otherPin['fileTitle'] );
		$before = $this->state();
		$result = $this->invoke( null, $authority, [ 4 => $old['revisionId'], 5 => 'source-two' ] );
		$this->assertCount( 5, $result['sourceBundle']['snapshot']->surfaces );
		$this->assertCount( 2, $result['sourceGroup']['members'] );
		$this->assertEquals( json_decode( $this->document( $surfaces ) ), $result['sourceBundle']['snapshot'] );
		$this->assertSame( $old['revisionId'], $result['source']['revisionId'] );
		$this->assertSame( $before, $this->state() );
	}

	private function authority( callable $allow ): Authority {
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'authorizeRead' )->willReturnCallback( $allow );
		$authority->method( 'definitelyCan' )->willReturnCallback( $allow );
		return $authority;
	}

	/** @dataProvider provideDeniedBoundary */
	public function testNativeDenialHasNoPartialResultOrWrites( string $denied ): void {
		$target = $this->pair['target']['pageId'];
		$source = $this->pair['source']['pageId'];
		$authority = $this->authority( static fn ( $right, $title ): bool =>
			!( $denied === 'source-file' && $title->getNamespace() === NS_FILE ) &&
			!( $denied === 'source-owner' && $title->getArticleID() === $source ) &&
			!( $title->getArticleID() === $target && $right === $denied ) );
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( null, $authority ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideDeniedBoundary(): array {
		return [ [ 'read' ], [ 'edit' ], [ 'editlayers' ], [ 'source-owner' ], [ 'source-file' ] ];
	}

	/** @dataProvider provideInvalidSelection */
	public function testInvalidOrForeignSelectionsRefuse( array $overrides ): void {
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( null, null, $overrides ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideInvalidSelection(): array {
		return [ [ [ 0 => 0 ] ], [ [ 1 => 2147483648 ] ], [ [ 2 => '' ] ],
			[ [ 2 => 'missing' ] ], [ [ 5 => 'missing' ] ] ];
	}

	public function testSameOwnerForeignRevisionAndStaleTargetRefuse(): void {
		$this->unavailable( fn () => $this->invoke( null, null,
			[ 3 => $this->pair['target']['pageId'] ] ) );
		$this->unavailable( fn () => $this->invoke( null, null,
			[ 4 => $this->pair['target']['revisionId'] ] ) );
		$old = $this->pair['target']['revisionId'];
		$this->replace( 'target', [ $this->surface( 'target-two', 2 ), $this->surface( 'target-one', 1 ) ] );
		$this->unavailable( fn () => $this->invoke( null, null, [ 1 => $old ] ) );
	}

	public function testLateSourceDenialAfterRenditionPreparationRefuses(): void {
		$denied = false;
		$authority = $this->authority( static function ( $right, $title ) use ( &$denied ): bool {
			return !$denied || $title->getNamespace() !== NS_FILE;
		} );
		$native = $this->renditions;
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willReturnCallback( static function ( $file, $surface ) use (
			&$denied, $native
		): array {
			$value = $native->forSurface( $file, $surface );
			$denied = true;
			return $value;
		} );
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( $this->service( $renditions ), $authority ) );
		$this->assertTrue( $denied );
		$this->assertSame( $before, $this->state() );
	}

	public function testChangedOffscreenSourceOnFreshReadRefusesEvenIfItChangesBack(): void {
		$native = $this->access;
		$count = 0;
		$sourceId = $this->pair['source']['pageId'];
		$access = $this->createMock( PageHistoryAccess::class );
		$access->method( 'read' )->willReturnCallback( static function ( $owner, $revision, $authority, $pageId ) use (
			$native, &$count, $sourceId
		): LayersDocumentContent {
			$content = $native->read( $owner, $revision, $authority, $pageId );
			if ( $pageId === $sourceId && ++$count === 2 ) {
				$data = json_decode( $content->getText() );
				$data->surfaces[1]->layers[0]->text = 'Changed offscreen source';
				return new LayersDocumentContent( json_encode( $data ) );
			}
			return $content;
		} );
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( $this->service( null, null, $access ) ) );
		$this->assertSame( 2, $count );
		$this->assertSame( $before, $this->state() );
	}

	/** @dataProvider provideBadAdmission */
	public function testMalformedAdmissionRefusesCompleteResult( string $mutation ): void {
		$native = $this->newSurface;
		$collision = $this->pair['target']['surfaceId'];
		$new = $this->createMock( NewPageDrawing::class );
		$new->method( 'prepare' )->willReturnCallback( static function ( ...$args ) use (
			$native, $collision, $mutation
		) {
			$value = $native->prepare( ...$args );
			if ( $mutation === 'collision' ) {
				$value['surface']['id'] = $collision;
			} elseif ( $mutation === 'page' ) {
				$value['surface']['source']['page'] = 2;
			} elseif ( $mutation === 'pin' ) {
				$value['surface']['source']['sha1'] = str_repeat( 'a', 31 );
			} elseif ( $mutation === 'label' ) {
				$value['surface']['label'] = 'Other';
			} else {
				$value['surface']['layers'] = [ [ 'id' => 'x', 'type' => 'text', 'text' => 'Not empty' ] ];
			}
			return $value;
		} );
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( $this->service( null, $new ) ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideBadAdmission(): array {
		return [ [ 'collision' ], [ 'page' ], [ 'pin' ], [ 'label' ], [ 'nonempty' ] ];
	}

	/** @dataProvider provideLateTargetRight */
	public function testLateTargetEditDenialRefusesWithoutWrites( string $right ): void {
		$denied = false;
		$targetId = $this->pair['target']['pageId'];
		$authority = $this->authority( static function ( $asked, $title ) use ( &$denied, $right, $targetId ): bool {
			return !$denied || $asked !== $right || $title->getArticleID() !== $targetId;
		} );
		$native = $this->renditions;
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willReturnCallback( static function ( $file, $surface ) use (
			&$denied, $native
		): array {
			$value = $native->forSurface( $file, $surface );
			$denied = true;
			return $value;
		} );
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( $this->service( $renditions ), $authority ) );
		$this->assertTrue( $denied );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideLateTargetRight(): array {
		return [ [ 'edit' ], [ 'editlayers' ] ];
	}

	public function testNativeHistoricalUnknownNullAndEmptyJsonTypesStayExact(): void {
		$document = json_decode( $this->document( [ $this->surface( 'source-two', 2 ),
			$this->surface( 'source-one', 1 ) ] ) );
		$document->surfaces[0]->layers[0]->futureData = (object)[ 'emptyObject' => new \stdClass(),
			'emptyList' => [], 'nullable' => null, 'nested' => [ (object)[ 'text' => 'Preserve Ω' ] ] ];
		$text = json_encode( $document, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION );
		$content = new LayersDocumentContent( $text );
		$this->assertTrue( $content->isReadable() );
		$this->assertFalse( $content->isValid() );
		$owner = $this->pair['source'];
		$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( 'revision' ) );
		$record = new MutableRevisionRecord( $owner['title'] );
		$record->setUser( $this->actor );
		$record->setTimestamp( wfTimestampNow() );
		$record->setComment( CommentStoreComment::newUnsavedComment( 'Isolated readable historical PDF fixture' ) );
		$record->setParentId( $owner['revisionId'] );
		$record->setContent( 'main', new WikitextContent( 'Isolated historical PDF Import source' ) );
		// Fixture-only insertion exception; discard it before an uncached production handler reload.
		$insertion = new class( $text ) extends LayersDocumentContent {
			public bool $allowInsertion = false;

			public function isValid() {
				return $this->allowInsertion || parent::isValid();
			}
		};
		$record->setContent( 'layers', $insertion );
		try {
			$insertion->allowInsertion = true;
			$id = $this->getServiceContainer()->getRevisionStore()
				->insertRevisionOn( $record, $this->getDb() )->getId();
		} finally {
			$insertion->allowInsertion = false;
			$this->assertFalse( $insertion->isValid() );
			unset( $record, $insertion );
		}
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$id, IDBAccessObject::READ_LATEST )->getContent( 'layers', RevisionRecord::RAW );
		$this->assertSame( LayersDocumentContent::class, get_class( $stored ) );
		$this->assertSame( $text, $stored->getText() );
		$this->assertFalse( $stored->isValid() );
		$before = $this->state();
		$result = $this->invoke( null, null, [ 4 => $id ] );
		$actual = $result['sourceBundle']['snapshot'];
		$this->assertSame( JsonSnapshotCodec::encode( $document ), JsonSnapshotCodec::encode( $actual ) );
		$this->assertInstanceOf( \stdClass::class, $actual->surfaces[0]->layers[0]->futureData->emptyObject );
		$this->assertSame( [], $actual->surfaces[0]->layers[0]->futureData->emptyList );
		$this->assertNull( $actual->surfaces[0]->layers[0]->futureData->nullable );
		$this->assertSame( $before, $this->state() );
		try {
			$this->registration['publisher']->publish( $owner['title'], $this->actor, $owner['revisionId'],
				$text, 'Ordinary publication must remain strict' );
			$this->fail( 'Strict publication accepted historical unknown fields' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-invalid-snapshot', $error->getMessage() );
		}
		$this->assertSame( $before, $this->state() );
	}

	/** @dataProvider provideMalformedGroup */
	public function testMalformedCompleteGroupRefusesBeforeResolvingFiles( string $mutation ): void {
		$native = $this->access;
		$access = $this->createMock( PageHistoryAccess::class );
		$access->method( 'read' )->willReturnCallback( static function ( ...$args ) use ( $native, $mutation ) {
			$document = json_decode( $native->read( ...$args )->getText() );
			$copy = clone $document->surfaces[0];
			$copy->source = clone $copy->source;
			$copy->id = 'conflicting-member';
			if ( $mutation === 'label' ) {
				$copy->label = 'abc';
			} elseif ( $mutation === 'pin' ) {
				$copy->source->page = 1;
				$copy->source->sha1 = str_repeat( 'a', 31 );
			} elseif ( $mutation === 'kind' ) {
				$copy->kind = 'image';
				$copy->source->page = 1;
			}
			$document->surfaces[] = $copy;
			return new LayersDocumentContent( json_encode( $document ) );
		} );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( $this->service( null, null, $access, $sources ) ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideMalformedGroup(): array {
		return [ [ 'duplicate-page' ], [ 'label' ], [ 'pin' ], [ 'kind' ] ];
	}

	/** @dataProvider provideUnavailableHandlerValue */
	public function testUnavailableHandlerCountOrGeometryRefusesBeforeRenditions( string $mutation ): void {
		$file = $this->createMock( File::class );
		$file->method( 'getMimeType' )->willReturn( 'application/pdf' );
		$file->method( 'pageCount' )->willReturn( $mutation === 'count' ? false : 2 );
		$file->method( 'getWidth' )->willReturn( $mutation === 'geometry' ? 0 : 416 );
		$file->method( 'getHeight' )->willReturn( 208 );
		$native = $this->sources;
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturnCallback( static function ( ...$args ) use ( $native, $file ) {
			return array_map( static fn () => $file, $native->resolve( ...$args ) );
		} );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->never() )->method( 'forSurface' );
		$before = $this->state();
		$this->unavailable( fn () => $this->invoke( $this->service( $renditions, null, null, $sources ) ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideUnavailableHandlerValue(): array {
		return [ [ 'count' ], [ 'geometry' ] ];
	}

	public function testReuploadDuringPreparationRefusesStaleRenditionAssociation(): void {
		$changed = false;
		$afterFixture = null;
		$native = $this->renditions;
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->method( 'forSurface' )->willReturnCallback( function ( $file, $surface ) use (
			&$changed, &$afterFixture, $native
		): array {
			$value = $native->forSurface( $file, $surface );
			if ( !$changed ) {
				$changed = true;
				$this->upload( $this->pin['fileTitle'], 'test-multipage-replacement.pdf', '20260906130000' );
				$afterFixture = $this->state();
			}
			return $value;
		} );
		$this->unavailable( fn () => $this->invoke( $this->service( $renditions ) ) );
		$this->assertTrue( $changed );
		$this->assertSame( $afterFixture, $this->state() );
		$retry = $this->invoke();
		$this->assertEquals( $this->pin, $retry['targetGroup']['source'] );
		$this->assertSame( 2, $retry['targetGroup']['pageCount'] );
		$this->assertStringContainsString( '/archive/',
			$retry['targetBundle']['sourceRenditions']['target-two']['url'] );
		$this->assertSame( $afterFixture, $this->state() );
	}
}
