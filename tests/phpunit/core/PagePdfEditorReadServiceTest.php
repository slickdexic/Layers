<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePdfEditorReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\Title;
use MediaWiki\User\UserIdentity;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/RealAssetTestCase.php';
if ( !class_exists( PagePdfEditorReadService::class ) ) {
	require_once __DIR__ . '/../../../src/Revision/PagePdfEditorReadService.php';
}

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PagePdfEditorReadService
 * @group Database
 */
class PagePdfEditorReadServiceTest extends RealAssetTestCase {
	private function reader( ?SourceRenditions $renditions = null, ?PageHistoryAccess $access = null,
		?NewPageDrawing $newSurface = null
	): PagePdfEditorReadService {
		$services = $this->getServiceContainer();
		$renditions ??= new SourceRenditions( $services->getUrlUtils() );
		return new PagePdfEditorReadService( $access ?? new PageHistoryAccess( $services->getRevisionLookup() ),
			$this->resolver, $renditions, $newSurface ?? new NewPageDrawing( $this->resolver, $renditions,
				$this->repo, $services->getTitleFactory(), [] ), $services->getRevisionLookup() );
	}

	private function fixture(): array {
		$name = 'File:Editor-context-' . wfRandomString( 8 ) . '.pdf';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $name );
		$surface = $this->makePdfSurface( 'second', 'ABC', $name, $file->getTimestamp(), $file->getSha1(), 2 );
		return [ $file, $surface ];
	}

	private function publish( array $surfaces ): array {
		$owner = $this->getExistingTestPage()->getTitle();
		$actor = $this->actor();
		$revision = $this->publisher->publish( $owner, $actor, $owner->getLatestRevID(),
			$this->buildDocument( $surfaces ), 'PDF editor context fixture' );
		return [ $owner, $revision, $actor, 'v1:' . $owner->getArticleID() . ':' . $surfaces[0]['id'] ];
	}

	private function witness( $owner ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$owner, 0, IDBAccessObject::READ_LATEST );
		return [ 'revision' => $revision->getId(), 'main' => $revision->getContent( SlotRecord::MAIN,
			RevisionRecord::RAW )->serialize(), 'layers' => $revision->getContent( 'layers',
			RevisionRecord::RAW )->serialize() ];
	}

	public function testSparseOriginalCountAndDeterministicMissingMemberNeverWrite(): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$before = $this->witness( $owner );
		$reader = $this->reader();
		$missing = $reader->read( $owner, $revision, $binding, 1, $actor );
		$this->assertSame( 2, $missing['pageCount'] );
		$stored = $reader->read( $owner, $revision, $binding, 2, $actor );
		$this->assertSame( 2, $stored['pageCount'] );
		$this->assertSame( 2, $stored['initialPage'] );
		$this->assertTrue( $stored['stored'] );
		$this->assertEquals( $surface, $stored['surface'] );
		$this->assertSame( [ 'page' => 2, 'width' => $file->getWidth( 2 ), 'height' => $file->getHeight( 2 ),
			'units' => 'file-handler-pixels' ], $stored['sourceGeometry'] );
		$this->assertSame( $missing, $reader->read( $owner, $revision, $binding, 1, $actor ) );
		$this->assertFalse( $missing['stored'] );
		$this->assertSame( 2, $missing['pageCount'] );
		$this->assertSame( [], $missing['surface']['layers'] );
		$this->assertSame( 'ABC', $missing['surface']['label'] );
		$this->assertSame( NewPageDrawing::surfaceId( $owner->getArticleID(), $revision, 'ABC',
			$surface['source']['fileTitle'], 1 ), $missing['surface']['id'] );
		$this->assertEquals( array_replace( $surface['source'], [ 'page' => 1 ] ), $missing['surface']['source'] );
		$this->assertSame( [ [ 'page' => 2, 'surfaceId' => 'second' ] ], $missing['members'] );
		$this->assertSame( $file->getWidth( 1 ), $missing['sourceGeometry']['width'] );
		$this->assertSame( $file->getHeight( 1 ), $missing['sourceGeometry']['height'] );
		$this->assertNotSame( $stored['sourceGeometry']['width'], $missing['sourceGeometry']['width'] );
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	public function testStoredPayloadAndSortedGroupTransformOnlyRequestedPage(): void {
		[ $file, $second ] = $this->fixture();
		$second['canvas'] = [ 'width' => 333, 'height' => 111, 'backgroundColor' => '#eeeeee',
			'backgroundVisible' => false, 'backgroundOpacity' => 0.5 ];
		$second['layers'] = [ [ 'id' => 'note', 'type' => 'text', 'x' => 19, 'y' => 31,
			'text' => 'Page two only', 'rotation' => 21, 'opacity' => 0.75 ] ];
		$second['readingOrder'] = [ 'note' ];
		$first = $second;
		$first['id'] = 'first';
		$first['source']['page'] = 1;
		$otherName = $first;
		$otherName['id'] = 'other-name';
		$otherName['label'] = 'XYZ';
		[ $otherFile, $other ] = $this->fixture();
		$other['id'] = 'other-file';
		[ $otherOwner, $otherRevision, $actor, $otherBinding ] = $this->publish( [ $other ] );
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $second, $first, $otherName, $other ] );
		$before = $this->witness( $owner );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturn( true );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static fn ( $right, $title ): bool => $title->getPrefixedDBkey() !== $other['source']['fileTitle']
		);
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->once() )->method( 'forSurface' )->with( $this->anything(), $second )
			->willReturnCallback(
				static fn ( $resolved, $surface ): array => $native->forSurface( $resolved, $surface )
			);
		$result = $this->reader( $renditions )->read( $owner, $revision, $binding, 2, $authority );
		$this->assertEquals( $second, $result['surface'] );
		$this->assertSame( [ [ 'page' => 1, 'surfaceId' => 'first' ], [ 'page' => 2, 'surfaceId' => 'second' ] ],
			$result['members'] );
		$this->assertSame( 'ABC', $result['label'] );
		$this->assertSame( $owner->getPrefixedDBkey(), $result['owner'] );
		$this->assertSame( $owner->getArticleID(), $result['pageId'] );
		$this->assertSame( $revision, $result['revisionId'] );
		$this->assertSame( $binding, $result['binding'] );
		$this->assertSame( 2, $result['page'] );
		$this->assertSame( 'pdf', $result['kind'] );
		$this->assertSame( 333, $result['rendition']['width'] );
		$bitmap = $file->transform( [ 'width' => 333, 'page' => 2 ], File::RENDER_NOW );
		$this->assertInstanceOf( \MediaTransformOutput::class, $bitmap );
		$reference = $bitmap->getLocalCopyPath();
		$this->assertIsString( $reference );
		$pixels = getimagesize( $reference );
		$this->assertIsArray( $pixels );
		$this->assertSame( $pixels[1], $result['rendition']['height'] );
		$this->assertStringContainsString( 'page2-333px-', $result['rendition']['url'] );
		$this->assertSame( $file->getWidth( 2 ), $result['sourceGeometry']['width'] );
		$this->assertSame( $file->getHeight( 2 ), $result['sourceGeometry']['height'] );
		$this->assertEquals( $other,
			$this->reader()->read( $otherOwner, $otherRevision, $otherBinding, 2, $actor )['surface'] );
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	public function testArchivedOriginalAndMissingMemberSurviveShorterCurrentUpload(): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$before = $this->witness( $owner );
		$reader = $this->reader();
		$stored = $reader->read( $owner, $revision, $binding, 2, $actor );
		$missing = $reader->read( $owner, $revision, $binding, 1, $actor );
		$current = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			$surface['source']['fileTitle'], '20260906130000' );
		$this->assertSame( 1, $current->pageCount() );
		$this->assertNotSame( $file->getSha1(), $current->getSha1() );
		$archived = $this->resolver->resolve( new LayersDocumentContent( $before['layers'] ), $actor )['second'];
		$this->assertSame( $file->getSha1(), $archived->getSha1() );
		$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
			file_get_contents( $archived->getLocalRefPath() ) );
		$storedAfter = $reader->read( $owner, $revision, $binding, 2, $actor );
		$missingAfter = $reader->read( $owner, $revision, $binding, 1, $actor );
		foreach ( [ [ $stored, $storedAfter ], [ $missing, $missingAfter ] ] as [ $earlier, $later ] ) {
			$this->assertSame( 2, $later['pageCount'] );
			$this->assertSame( $earlier['sourceGeometry'], $later['sourceGeometry'] );
			$this->assertEquals( $earlier['surface'], $later['surface'] );
			$this->assertSame( $earlier['rendition']['width'], $later['rendition']['width'] );
			$this->assertSame( $earlier['rendition']['height'], $later['rendition']['height'] );
			$this->assertStringContainsString( '/archive/', $later['rendition']['url'] );
		}
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	/** @dataProvider provideInvalidPage */
	public function testInvalidTargetPagesFailWithoutTransform( int $page ): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->never() )->method( 'forSurface' );
		$this->expectExceptionMessage( 'layers-editor-unavailable' );
		$this->reader( $renditions )->read( $owner, $revision, $binding, $page, $actor );
	}

	public static function provideInvalidPage(): array {
		return [ [ 0 ], [ -1 ], [ 3 ], [ 2147483648 ] ];
	}

	public function testBindingsKindsAndStaleRevisionRefused(): void {
		[ $file, $surface ] = $this->fixture();
		$slide = $this->makeSlideSurface();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface, $slide ] );
		$before = $this->witness( $owner );
		foreach ( [ 'bad', 'v1:2147483647:second', 'v1:' . $owner->getArticleID() . ':missing',
			'v1:' . $owner->getArticleID() . ':presentation' ] as $wrong ) {
			$this->unavailable( fn () => $this->reader()->read( $owner, $revision, $wrong, 2, $actor ) );
		}
		foreach ( [ 0, -1, 2147483648 ] as $wrong ) {
			$this->unavailable( fn () => $this->reader()->read( $owner, $wrong, $binding, 2, $actor ) );
		}
		$this->assertSame( $before, $this->witness( $owner ) );
		$this->publisher->publish( $owner, $actor, $revision,
			$this->buildDocument( [ $surface ] ), 'New fixture revision' );
		$this->unavailable( fn () => $this->reader()->read( $owner, $revision, $binding, 2, $actor ) );
	}

	private function unavailable( callable $operation ): void {
		try {
			$operation();
			$this->fail( 'Unavailable PDF preparation returned data' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-editor-unavailable', $error->getMessage() );
		}
	}

	/** @dataProvider provideDeniedRight */
	public function testOwnerRightsAndSourceDenial( string $denied ): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static fn ( $right ): bool => $right !== $denied );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static fn ( $right, $title ): bool => $denied !== 'source' || $title->getNamespace() !== NS_FILE );
		$before = $this->witness( $owner );
		$this->unavailable( fn () => $this->reader()->read( $owner, $revision, $binding, 2, $authority ) );
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	public static function provideDeniedRight(): array {
		return [ [ 'read' ], [ 'edit' ], [ 'editlayers' ], [ 'source' ] ];
	}

	/** @dataProvider providePostPreparationDenial */
	public function testPostPreparationFreshAdmissionRefuses( string $denied, int $page ): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$admitted = true;
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static function ( $right ) use (
			&$admitted, $denied
		): bool {
			return $admitted || $right !== $denied;
		} );
		$authority->method( 'authorizeRead' )->willReturnCallback( static function ( $right, $title ) use (
			&$admitted, $denied
		): bool {
			return $admitted || $denied !== 'source' || $title->getNamespace() !== NS_FILE;
		} );
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->once() )->method( 'forSurface' )->willReturnCallback(
			static function ( $resolved, $member ) use ( $native, &$admitted ): array {
				$result = $native->forSurface( $resolved, $member );
				$admitted = false;
				return $result;
			} );
		$before = $this->witness( $owner );
		$this->expectException( \DomainException::class );
		$this->expectExceptionMessage( 'layers-editor-unavailable' );
		try {
			$this->reader( $renditions )->read( $owner, $revision, $binding, $page, $authority );
		} finally {
			$this->assertSame( $before, $this->witness( $owner ) );
		}
	}

	public static function providePostPreparationDenial(): array {
		return [ 'stored owner edit' => [ 'edit', 2 ], 'missing owner edit' => [ 'edit', 1 ],
			'stored owner read' => [ 'read', 2 ], 'missing owner read' => [ 'read', 1 ],
			'stored layer right' => [ 'editlayers', 2 ], 'missing layer right' => [ 'editlayers', 1 ],
			'stored source' => [ 'source', 2 ], 'missing source' => [ 'source', 1 ] ];
	}

	/** @dataProvider provideRequestedPage */
	public function testOwnerRevisionChangedDuringTransformRefuses( int $page ): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->once() )->method( 'forSurface' )->willReturnCallback(
			function ( $resolved, $member ) use ( $native, $owner, $revision, $actor, $surface ): array {
				$result = $native->forSurface( $resolved, $member );
				$surface['canvas']['backgroundOpacity'] = 0.5;
				$this->publisher->publish( $owner, $actor, $revision,
					$this->buildDocument( [ $surface ] ), 'Concurrent fixture edit' );
				return $result;
			} );
		$this->unavailable( fn () => $this->reader( $renditions )->read( $owner, $revision, $binding, $page, $actor ) );
		$this->assertNotSame( $revision, $this->witness( $owner )['revision'] );
	}

	public static function provideRequestedPage(): array {
		return [ [ 1 ], [ 2 ] ];
	}

	public function testHiddenOwnerRevisionRefused(): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )->where( [ 'rev_id' => $revision ] )
			->caller( __METHOD__ )->execute();
		$this->unavailable( fn () => $this->reader()->read( $owner, $revision, $binding, 2, $actor ) );
	}

	/** @dataProvider provideContradictoryGroup */
	public function testContradictoryStoredGroupsRefused( string $mode ): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$other = $surface;
		$other['id'] = 'conflicting';
		if ( $mode === 'mixed-pin' ) {
			$other['source']['page'] = 1;
			$other['source']['timestamp'] = '20260906130000';
		} elseif ( $mode === 'unavailable-member' ) {
			$other['source']['page'] = 3;
		}
		$access = $this->createMock( PageHistoryAccess::class );
		$access->method( 'read' )->willReturn(
			new LayersDocumentContent( $this->buildDocument( [ $surface, $other ] ) ) );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->never() )->method( 'forSurface' );
		$this->unavailable(
			fn () => $this->reader( $renditions, $access )->read( $owner, $revision, $binding, 2, $actor ) );
	}

	public static function provideContradictoryGroup(): array {
		return [ [ 'duplicate-page' ], [ 'mixed-pin' ], [ 'unavailable-member' ] ];
	}

	public function testGeneratedIdCollisionWithUnrelatedStoredSurfaceRefused(): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$collision = $this->makeSlideSurface( NewPageDrawing::surfaceId( $owner->getArticleID(), $revision,
			'ABC', $surface['source']['fileTitle'], 1 ), 'Unrelated slide' );
		$access = $this->createMock( PageHistoryAccess::class );
		$access->method( 'read' )->willReturn(
			new LayersDocumentContent( $this->buildDocument( [ $surface, $collision ] ) ) );
		$this->unavailable( fn () => $this->reader( null, $access )->read( $owner, $revision, $binding, 1, $actor ) );
	}

	public function testMissingMemberTransformsOnlyItsOwnPageAndPreservesDefaults(): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$before = $this->witness( $owner );
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->once() )->method( 'forSurface' )->willReturnCallback(
			function ( $resolved, $member ) use ( $native ): array {
				$this->assertSame( 1, $member['source']['page'] );
				return $native->forSurface( $resolved, $member );
			} );
		$result = $this->reader( $renditions )->read( $owner, $revision, $binding, 1, $actor );
		$this->assertSame( [ 'width' => $file->getWidth( 1 ), 'height' => $file->getHeight( 1 ),
			'backgroundColor' => '#ffffff', 'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			$result['surface']['canvas'] );
		$this->assertStringContainsString( 'page1-', $result['rendition']['url'] );
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	public function testAnonymousActorAndNoncanonicalOwnersRefused(): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$authority = $this->createMock( Authority::class );
		$user = $this->createMock( UserIdentity::class );
		$user->method( 'isRegistered' )->willReturn( false );
		$authority->method( 'getUser' )->willReturn( $user );
		$this->unavailable( fn () => $this->reader()->read( $owner, $revision, $binding, 2, $authority ) );
		foreach ( [ Title::makeTitle( $owner->getNamespace(), $owner->getDBkey(), 'fragment' ),
			Title::makeTitle( $owner->getNamespace(), $owner->getDBkey(), '', 'foreign' ) ] as $wrong ) {
			$this->unavailable( fn () => $this->reader()->read( $wrong, $revision, $binding, 2, $actor ) );
		}
	}

	public function testImageAnchorRefused(): void {
		$name = 'File:Editor-context-' . wfRandomString( 8 ) . '.png';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', $name );
		$surface = $this->makeImageSurface( 'image', 'ABC', $name, $file->getTimestamp(), $file->getSha1() );
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$this->unavailable( fn () => $this->reader()->read( $owner, $revision, $binding, 1, $actor ) );
	}

	/** @dataProvider provideRequestedPage */
	public function testSuppressedSourceBeforeReadRefused( int $page ): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			$surface['source']['fileTitle'], '20260906130000' );
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )->set( [ 'oi_deleted' => File::DELETED_FILE ] )
			->where( [ 'oi_name' => $file->getName(), 'oi_timestamp' => $surface['source']['timestamp'] ] )
			->caller( __METHOD__ )->execute();
		$file->purgeCache();
		$before = $this->witness( $owner );
		$this->unavailable( fn () => $this->reader()->read( $owner, $revision, $binding, $page, $actor ) );
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	/** @dataProvider provideTransformSuppression */
	public function testSuppressionDuringTransformRefused( bool $source, int $page ): void {
		$caller = __METHOD__;
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		if ( $source ) {
			$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$surface['source']['fileTitle'], '20260906130000' );
		}
		$native = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->once() )->method( 'forSurface' )->willReturnCallback(
			function ( $resolved, $member ) use ( $native, $source, $file, $revision, $caller ): array {
				$result = $native->forSurface( $resolved, $member );
				if ( $source ) {
					$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
						->set( [ 'oi_deleted' => File::DELETED_FILE ] )
						->where( [ 'oi_name' => $file->getName(), 'oi_timestamp' => $member['source']['timestamp'] ] )
						->caller( $caller )->execute();
					$resolved->purgeCache();
				} else {
					$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
						->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )->where( [ 'rev_id' => $revision ] )
						->caller( $caller )->execute();
				}
				return $result;
			} );
		$before = $this->witness( $owner );
		$this->unavailable( fn () => $this->reader( $renditions )->read( $owner, $revision, $binding, $page, $actor ) );
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	public static function provideTransformSuppression(): array {
		return [ 'stored source' => [ true, 2 ], 'missing source' => [ true, 1 ],
			'stored owner' => [ false, 2 ], 'missing owner' => [ false, 1 ] ];
	}

	public function testOwnerChangeDuringFinalSourceLookupRefused(): void {
		[ $file, $surface ] = $this->fixture();
		[ $owner, $revision, $actor, $binding ] = $this->publish( [ $surface ] );
		$native = $this->resolver;
		$calls = 0;
		$this->resolver = $this->createMock( SourceVersionResolver::class );
		$this->resolver->expects( $this->exactly( 2 ) )->method( 'resolve' )->willReturnCallback(
			function ( $content, $authority, $ids = null ) use (
				$native, &$calls, $owner, $revision, $actor, $surface
			): array {
				$files = $native->resolve( $content, $authority, $ids );
				if ( ++$calls === 2 ) {
					$surface['canvas']['backgroundOpacity'] = 0.5;
					$this->publisher->publish( $owner, $actor, $revision,
						$this->buildDocument( [ $surface ] ), 'Concurrent final-lookup fixture edit' );
				}
				return $files;
			} );
		$this->unavailable( fn () => $this->reader()->read( $owner, $revision, $binding, 2, $actor ) );
	}
}
