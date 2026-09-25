<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Revision\LegacyAdoptionPreparationService;
use MediaWiki\Extension\Layers\Revision\LegacyMediaResolver;
use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;

/**
 * @group Database
 * @covers \MediaWiki\Extension\Layers\Revision\LegacyMediaResolver
 */
class LegacyMediaResolverTest extends RealAssetTestCase {
	public function testImagePreparationCombinesExactStoredDrawingWithAuthorizedUpload(): void {
		$file = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-image.png', 'File:Prepared_adoption.png' );
		$fixture = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/adoption/image-text-callout.json' ), true );
		$row = $fixture['legacyRecord']['database']['row'];
		$record = $this->record( $file ) + [
			'id' => $row['ls_id'], 'name' => $row['ls_name'], 'revision' => $row['ls_revision'],
			'json' => $row['ls_json_blob']
		];
		$record['timestamp'] = $row['ls_timestamp'];
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->once() )->method( 'getLayerSetForAdoption' )
			->with( $row['ls_id'] )->willReturn( $record );
		$s = $this->getServiceContainer();
		$lookup = $s->getRevisionLookup();
		$preparer = new LegacyAdoptionPreparationService(
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $lookup, new PageHistoryAccess( $lookup ) ),
			$legacy, new LegacyMediaResolver( $this->resolver ), new LegacySurfaceConverter() );
		$page = $this->getExistingTestPage();
		$base = $page->getLatest();
		$result = $preparer->prepare( $page->getId(), $base, $row['ls_id'], '20260906120000', $this->actor() );
		$surface = json_decode( $result['document'] )->surfaces[0];
		$this->assertSame( 'image', $surface->kind );
		$this->assertSame( 1, $surface->canvas->width );
		$this->assertSame( 1, $surface->canvas->height );
		$this->assertSame( '20260906120000', $surface->source->timestamp );
		$this->assertSame( $record['sha1'], $surface->source->sha1 );
		$this->assertEquals( json_decode( $record['json'] )->layers, $surface->layers );
		$this->assertSame( $base, $lookup->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	private function record( File $file, int $page = 1 ): array {
		return [
			'imgName' => $file->getName(), 'sha1' => $file->getSha1(),
			'mime' => $file->getMimeType(), 'page' => $page,
			'timestamp' => '20260923120000'
		];
	}

	public function testImageAndPdfGeometryUsesExplicitSourceVersion(): void {
		$actor = $this->actor();
		$resolver = new LegacyMediaResolver( $this->resolver );
		$image = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-image.png', 'File:Adoption_geometry.png' );
		$result = $resolver->resolve( $this->record( $image ), '20260906120000', $actor );
		$this->assertSame( [
			'source' => [
				'repository' => 'local', 'fileTitle' => 'File:Adoption_geometry.png',
				'timestamp' => '20260906120000', 'sha1' => $image->getSha1(), 'page' => 1
			],
			'width' => 1, 'height' => 1
		], $result );
		$pdf = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage.pdf', 'File:Adoption_geometry.pdf' );
		$record = $this->record( $pdf, 2 );
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			'File:Adoption_geometry.pdf', '20260907120000' );
		$result = $resolver->resolve( $record, '20260906120000', $actor );
		$this->assertSame( 208, $result['width'] );
		$this->assertSame( 416, $result['height'] );
		$this->assertSame( 2, $result['source']['page'] );
		$this->assertSame( '20260906120000', $result['source']['timestamp'] );
		$this->assertSame( $record['sha1'], $result['source']['sha1'] );
	}

	public function testWrongIdentityMimePageAndDeniedAuthorityAreRedacted(): void {
		$image = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-image.png', 'File:Adoption_denials.png' );
		$pdf = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage.pdf', 'File:Adoption_denials.pdf' );
		$record = $this->record( $image );
		$allowed = $this->actor();
		$denied = $this->createMock( Authority::class );
		$denied->method( 'authorizeRead' )->willReturn( false );
		$cases = [
			[ array_replace( $record, [ 'sha1' => str_repeat( 'z', 31 ) ] ), '20260906120000', $allowed ],
			[ $record, '20260906120001', $allowed ],
			[ $record, $record['timestamp'], $allowed ],
			[ array_replace( $record, [ 'mime' => 'image/jpeg' ] ), '20260906120000', $allowed ],
			[ array_replace( $record, [ 'page' => 2 ] ), '20260906120000', $allowed ],
			[ $this->record( $pdf, 3 ), '20260906120000', $allowed ],
			[ $record, '20260906120000', $denied ],
			[ array_replace( $record, [ 'mime' => 'application/x-layers-slide' ] ), '20260906120000', $allowed ],
			[ array_replace( $record, [ 'imgName' => [] ] ), '20260906120000', $allowed ],
			[ array_replace( $record, [ 'page' => '1' ] ), '20260906120000', $allowed ],
			[ $record, 'private-diagnostic', $allowed ]
		];
		$resolver = new LegacyMediaResolver( $this->resolver );
		foreach ( $cases as [ $input, $timestamp, $authority ] ) {
			try {
				$resolver->resolve( $input, $timestamp, $authority );
				$this->fail( 'Unavailable source must reject.' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
				$this->assertNull( $e->getPrevious() );
			}
		}
	}
}
