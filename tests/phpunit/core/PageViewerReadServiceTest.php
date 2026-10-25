<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageViewerReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageViewerReadService
 * @covers \MediaWiki\Extension\Layers\Revision\SourceRenditions
 * @group Database
 */
class PageViewerReadServiceTest extends RealAssetTestCase {
	private function reader( ?SourceRenditions $renditions = null ): PageViewerReadService {
		$services = $this->getServiceContainer();
		return new PageViewerReadService( new PageHistoryAccess( $services->getRevisionLookup() ),
			$this->resolver, $renditions ?? new SourceRenditions( $services->getUrlUtils() ),
			'/custom/rest.php/layers/v0/pdf' );
	}

	private function publishSurfaces( array $surfaces ): array {
		$owner = $this->getExistingTestPage()->getTitle();
		$actor = $this->actor();
		$revision = $this->publisher->publish( $owner, $actor, $owner->getLatestRevID(),
			$this->buildDocument( $surfaces ), 'Viewer test snapshot' );
		return [ $owner, $revision, $actor, 'v1:' . $owner->getArticleID() . ':' . $surfaces[0]['id'] ];
	}

	private function pdf( string $name = 'Viewer.pdf' ): array {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:' . $name );
		return [ $file, $this->makePdfSurface( 'first', 'ABC', 'File:' . $name,
			$file->getTimestamp(), $file->getSha1() ) ];
	}

	public function testGroupPreservesPayloadNamesAndExactPageWithoutOtherFileAccess(): void {
		[ $file, $first ] = $this->pdf();
		$second = $first;
		$second['id'] = 'second';
		$second['source']['page'] = 2;
		$second['layers'] = [ [ 'id' => 'note', 'type' => 'text', 'text' => 'Second-page payload' ] ];
		$second['readingOrder'] = [ 'note' ];
		[ $otherFile, $other ] = $this->pdf( 'OtherViewer.pdf' );
		$other['id'] = 'other-file';
		[ $owner, $revision, $actor, $binding ] = $this->publishSurfaces( [ $first, $second, $other ] );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static fn ( $right, $title ): bool => $title->getPrefixedDBkey() !== 'File:OtherViewer.pdf' );
		$result = $this->reader()->read( $owner, $revision, $binding, $authority );
		$this->assertEquals( [ [ 'page' => 1, 'surface' => $first ], [ 'page' => 2, 'surface' => $second ] ],
			$result['pages'] );
		$this->assertSame( 2, $result['pageCount'] );
		$this->assertSame( 'ABC', $result['label'] );
		$secondBinding = 'v1:' . $owner->getArticleID() . ':second';
		$this->assertSame( 2, $this->reader()->read( $owner, $revision, $secondBinding, $actor )['initialPage'] );
		parse_str( parse_url( $result['source']['url'], PHP_URL_QUERY ), $query );
		$this->assertSame( [ 'owner' => $owner->getPrefixedDBkey(), 'revid' => (string)$revision,
			'binding' => $binding ], $query );
		$this->assertSame( '/custom/rest.php/layers/v0/pdf', parse_url( $result['source']['url'], PHP_URL_PATH ) );
		$this->assertTrue( $result['source']['exactVersion'] );
		$this->assertStringNotContainsString( $file->getUrl(), $result['source']['url'] );
	}

	public function testArchivedGroupAndEmptyPageSurviveNewUploadAndOwnerRevision(): void {
		[ $file, $surface ] = $this->pdf();
		[ $owner, $revision, $actor, $binding ] = $this->publishSurfaces( [ $surface ] );
		$before = $this->reader()->read( $owner, $revision, $binding, $actor );
		$this->assertCount( 1, $before['pages'] );
		$this->assertSame( 2, $before['pageCount'] );
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			'File:Viewer.pdf', '20260906130000', 'Replace source' );
		$this->publisher->publish( $owner, $actor, $revision,
			$this->buildDocument( [] ), 'Remove current layers' );
		$this->assertSame( $before, $this->reader()->read( $owner, $revision, $binding, $actor ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )->where( [ 'rev_id' => $revision ] )
			->caller( __METHOD__ )->execute();
		$this->expectException( \DomainException::class );
		$this->reader()->read( $owner, $revision, $binding, $actor );
	}

	public function testSlideNeedsNoFileAndForeignBindingsAreRefused(): void {
		$surface = $this->makeSlideSurface();
		[ $owner, $revision, $actor, $binding ] = $this->publishSurfaces( [ $surface ] );
		$result = $this->reader()->read( $owner, $revision, $binding, $actor );
		$this->assertEquals( [ [ 'page' => 1, 'surface' => $surface ] ], $result['pages'] );
		$this->assertNull( $result['source'] );
		$this->assertSame( 1, $result['pageCount'] );
		foreach ( [ 'v1:2147483647:presentation', 'v1:' . $owner->getArticleID() . ':missing', 'bad' ] as $wrong ) {
			try {
				$this->reader()->read( $owner, $revision, $wrong, $actor );
				$this->fail( 'Foreign or invalid binding accepted' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
			}
		}
	}

	/** @dataProvider providePostTransformDenial */
	public function testImageUsesNativeSizeAndRepeatsReadAdmissionAfterTransform( bool $fileOnly ): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', 'File:Viewer.png' );
		$surface = $this->makeImageSurface( 'image', 'ABC', 'File:Viewer.png',
			$file->getTimestamp(), $file->getSha1() );
		[ $owner, $revision, $actor, $binding ] = $this->publishSurfaces( [ $surface ] );
		$result = $this->reader()->read( $owner, $revision, $binding, $actor );
		$this->assertSame( $file->getWidth(), $result['source']['width'] );
		$this->assertSame( $file->getHeight(), $result['source']['height'] );
		$admitted = true;
		$authority = $this->createMock( Authority::class );
		$authority->method( 'authorizeRead' )->willReturnCallback( static function ( $right, $title ) use (
			&$admitted, $fileOnly
		): bool {
			return $admitted || ( $fileOnly && $title->getNamespace() !== NS_FILE );
		} );
		$renditions = $this->createMock( SourceRenditions::class );
		$renditions->expects( $this->once() )->method( 'forSurface' )->with( $this->anything(), $surface, true )
			->willReturnCallback( static function () use ( &$admitted, $result ): array {
				$admitted = false;
				return $result['source'];
			} );
		$this->expectException( \DomainException::class );
		$this->reader( $renditions )->read( $owner, $revision, $binding, $authority );
	}

	public static function providePostTransformDenial(): array {
		return [ 'owner denied' => [ false ], 'file denied' => [ true ] ];
	}

	public function testConflictingUploadPinsNeverAssembleAndIndividualReadsStayAvailable(): void {
		[ $file, $first ] = $this->pdf();
		$changed = $this->getNewTempDirectory() . '/changed.pdf';
		file_put_contents( $changed, file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) .
			"\n% Different upload bytes\n" );
		$new = $this->uploadFixtureFile( $changed,
			'File:Viewer.pdf', '20260906130000', 'Separate upload' );
		$second = $this->makePdfSurface( 'second', 'ABC', 'File:Viewer.pdf',
			$new->getTimestamp(), $new->getSha1(), 2 );
		$this->assertNotSame( $first['source']['timestamp'], $second['source']['timestamp'] );
		[ $owner, $revision, $actor, $binding ] = $this->publishSurfaces( [ $first, $second ] );
		// Existing per-surface access is preserved; the new assembly has no caller yet.
		$reader = new PageReadService( new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver );
		$this->assertEquals( $first, $reader->readBoundSurface( $owner, $revision, $binding, $actor )['surface'] );
		$this->assertEquals( $second, $reader->readBoundSurface( $owner, $revision,
			'v1:' . $owner->getArticleID() . ':second', $actor )['surface'] );
		$this->expectException( \DomainException::class );
		$this->reader()->read( $owner, $revision, $binding, $actor );
	}
}
