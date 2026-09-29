<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;

/** @covers \MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter */
class LegacySurfaceConverterTest extends \MediaWikiUnitTestCase {
	public function testFileVersionTimeDoesNotComeFromAnnotationTime(): void {
		[ $record, $media ] = self::provideFixtures()['image-text-callout.json:0'];
		$media['source']['timestamp'] = '20200101000000';
		$surface = json_decode( ( new LegacySurfaceConverter() )->convert( $record, 'A', $media ) )->surfaces[0];
		$this->assertSame( '20200101000000', $surface->source->timestamp );
		$this->assertNotSame( $record['timestamp'], $surface->source->timestamp );
	}

	public function testOlderSavesWithoutOwnerOrBackgroundShowTheBackgroundFully(): void {
		foreach ( [ 'image-text-callout.json:0', 'slide-falsy-zero.json:0' ] as $case ) {
			[ $record, $media ] = self::provideFixtures()[$case];
			$data = json_decode( $record['json'] );
			unset( $data->ownerId, $data->backgroundVisible, $data->backgroundOpacity );
			$record['json'] = json_encode( $data );
			$surface = json_decode( ( new LegacySurfaceConverter() )->convert( $record, 'A', $media ) )->surfaces[0];
			$this->assertSame( [ true, 1 ],
				[ $surface->canvas->backgroundVisible, $surface->canvas->backgroundOpacity ], $case );
			$this->assertEquals( $data->layers, $surface->layers, $case );
		}
	}

	public function testFileSaveMayCarryUnusedSlideSettingsOnlyWhenMarkedNotASlide(): void {
		[ $record, $media ] = self::provideFixtures()['image-text-callout.json:0'];
		$data = json_decode( $record['json'] );
		$data->isSlide = false;
		$data->canvasWidth = null;
		$data->canvasHeight = null;
		$data->backgroundColor = null;
		$record['json'] = json_encode( $data );
		$surface = json_decode( ( new LegacySurfaceConverter() )->convert( $record, 'A', $media ) )->surfaces[0];
		$this->assertSame( [ $media['width'], '#ffffff' ],
			[ $surface->canvas->width, $surface->canvas->backgroundColor ] );

		foreach ( [ [ 'isSlide', true ], [ 'ownerId', -1 ], [ 'ownerId', '3' ] ] as [ $key, $value ] ) {
			$bad = json_decode( $record['json'] );
			$bad->$key = $value;
			try {
				( new LegacySurfaceConverter() )->convert( [ 'json' => json_encode( $bad ) ] + $record, 'A', $media );
				$this->fail( "$key accepted" );
			} catch ( \InvalidArgumentException $e ) {
				$this->assertSame( 'layers-legacy-conversion-unavailable', $e->getMessage() );
			}
		}
	}

	public function testDoesNotScaleAnOversizedLegacySlide(): void {
		[ $record ] = self::provideFixtures()['slide-falsy-zero.json:0'];
		$data = json_decode( $record['json'] );
		$data->canvasWidth = 7680;
		$record['json'] = json_encode( $data );
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-legacy-conversion-unavailable' );
		( new LegacySurfaceConverter() )->convert( $record, 'A' );
	}

	/**
	 * @dataProvider provideFixtures
	 * @param array $record
	 * @param array|null $media
	 */
	public function testPreservesStoredDrawingWithoutInventingOrder( array $record, ?array $media ): void {
		$before = $record;
		$raw = json_decode( $record['json'] );
		$result = json_decode( ( new LegacySurfaceConverter() )->convert( $record, 'New_Drawing', $media ) );
		$this->assertCount( 1, $result->surfaces );
		$surface = $result->surfaces[0];
		$this->assertEquals( $raw->layers, $surface->layers );
		$this->assertSame( $raw->backgroundVisible, $surface->canvas->backgroundVisible );
		$this->assertEquals( $raw->backgroundOpacity, $surface->canvas->backgroundOpacity );
		$this->assertSame( $record['name'], $surface->label );
		$this->assertFalse( property_exists( $surface, 'readingOrder' ) );
		$this->assertFalse( property_exists( $surface, 'ownerId' ) );
		$this->assertSame( $before, $record );
		if ( $media !== null ) {
			$this->assertEquals( (object)$media['source'], $surface->source );
			$this->assertSame( $media['width'], $surface->canvas->width );
			$this->assertSame( $media['height'], $surface->canvas->height );
		} else {
			$this->assertFalse( property_exists( $surface, 'source' ) );
			$this->assertSame( $raw->canvasWidth, $surface->canvas->width );
		}
	}

	/** @return array */
	public static function provideFixtures(): array {
		$cases = [];
		foreach ( glob( __DIR__ . '/../../../fixtures/adoption/*.json' ) as $file ) {
			$fixture = json_decode( file_get_contents( $file ), true );
			$rows = [];
			$collect = static function ( $node ) use ( &$collect, &$rows ) {
				if ( !is_array( $node ) ) {
					return;
				}
				if ( isset( $node['ls_id'] ) && is_int( $node['ls_id'] ) ) {
					$rows[] = $node;
				}
				foreach ( $node as $child ) {
					$collect( $child );
				}
			};
			$collect( $fixture );
			foreach ( $rows as $index => $row ) {
				$surface = $fixture['candidatePageOwnedSnapshot']['document']['surfaces'][$index];
				$record = [
					'id' => $row['ls_id'], 'imgName' => $row['ls_img_name'], 'sha1' => $row['ls_img_sha1'],
					'mime' => $row['ls_img_major_mime'] . '/' . $row['ls_img_minor_mime'],
					'name' => $row['ls_name'], 'page' => $row['ls_page'], 'revision' => $row['ls_revision'],
					'timestamp' => $row['ls_timestamp'], 'json' => $row['ls_json_blob']
				];
				$media = isset( $surface['source'] ) ? [
					'source' => $surface['source'],
					'width' => $surface['canvas']['width'], 'height' => $surface['canvas']['height']
				] : null;
				$cases[basename( $file ) . ':' . $index] = [ $record, $media ];
			}
		}
		return $cases;
	}

	/**
	 * @dataProvider provideLossCases
	 * @param string $case
	 */
	public function testRejectsLossyOrMismatchedInput( string $case ): void {
		$fixtures = self::provideFixtures();
		[ $record, $media ] = $fixtures['image-text-callout.json:0'];
		$data = json_decode( $record['json'] );
		switch ( $case ) {
			case 'unknown-root':
				$data->secret = 'must not be dropped';
				break;
			case 'unknown-layer':
				$data->layers[0]->secret = true;
				break;
			case 'coerced-boolean':
				$data->backgroundVisible = 0;
				break;
			case 'wrong-revision':
				$record['revision']++;
				break;
			case 'wrong-hash':
				$record['sha1'] = str_repeat( '0', 31 );
				break;
			case 'wrong-page':
				$record['page'] = 2;
				break;
			case 'no-media':
				$media = null;
				break;
			case 'oversized-canvas':
				$media['width'] = 4097;
				break;
			case 'fractional-canvas':
				$media['width'] = 200.5;
				break;
		}
		$record['json'] = json_encode( $data );
		if ( $case === 'duplicate-json' ) {
			$record['json'] = substr( $record['json'], 0, -1 ) . ',"schema":1}';
		}
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-legacy-conversion-unavailable' );
		( new LegacySurfaceConverter() )->convert( $record, 'New_Drawing', $media );
	}

	/** @return array */
	public static function provideLossCases(): array {
		return array_map( static function ( $case ) {
			return [ $case ];
		}, [ 'unknown-root', 'unknown-layer', 'coerced-boolean', 'wrong-revision', 'wrong-hash',
			'wrong-page', 'no-media', 'oversized-canvas', 'fractional-canvas', 'duplicate-json' ] );
	}
}
