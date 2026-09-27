<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\DocumentSchema
 * @covers \MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec
 */
class DocumentSchemaTest extends \MediaWikiUnitTestCase {
	private static function fixture(): \stdClass {
		return json_decode( file_get_contents( __DIR__ . '/../../../fixtures/revisions/mixed-document-v1.json' ) );
	}

	public function testMixedDocumentRoundTripsAndCanonicalizes(): void {
		$schema = new DocumentSchema();
		$input = json_encode( self::fixture(), JSON_PRETTY_PRINT );
		$canonical = $schema->canonicalize( $input );
		$this->assertSame( $canonical, $schema->canonicalize( $canonical ) );
		$this->assertEquals( self::fixture(), json_decode( $canonical ) );
		$reordered = self::fixture();
		$reordered = (object)[ 'surfaces' => $reordered->surfaces, 'schemaVersion' => 1 ];
		$this->assertSame( $canonical, $schema->canonicalize( json_encode( $reordered ) ) );
		$reordered->surfaces = array_reverse( $reordered->surfaces );
		$this->assertNotSame( $canonical, $schema->canonicalize( json_encode( $reordered ) ) );
	}

	/**
	 * A later, stricter layer validator must not make stored history unreadable.
	 */
	public function testStoredDocumentsAreReadableWhenLayerRulesTighten(): void {
		$schema = new DocumentSchema();
		$doc = self::fixture();
		$doc->surfaces[0]->layers[0]->propertyRetiredByLaterRelease = 'kept';
		$json = json_encode( $doc );
		try {
			$schema->canonicalize( $json );
			$this->fail( 'Save-time validation must reject properties the current validator drops' );
		} catch ( \InvalidArgumentException $e ) {
			$this->assertSame( 'invalid-or-lossy-layer-data', $e->getMessage() );
		}
		$stored = $schema->decodeStored( $json );
		$this->assertSame( 'kept', $stored->surfaces[0]->layers[0]->propertyRetiredByLaterRelease );

		foreach ( [ '{"schemaVersion":2,"surfaces":[]}', '{"schemaVersion":1,"surfaces":[],"extra":1}',
			'{"schemaVersion":1,"surfaces":[{"id":"a","id":"b"}]}' ] as $broken ) {
			try {
				$schema->decodeStored( $broken );
				$this->fail( 'Structural read validation must still reject ' . $broken );
			} catch ( \InvalidArgumentException $e ) {
				$this->assertNotSame( '', $e->getMessage() );
			}
		}
		$untyped = self::fixture();
		unset( $untyped->surfaces[0]->layers[0]->type );
		$this->expectExceptionMessage( 'invalid-layer-type' );
		$schema->decodeStored( json_encode( $untyped ) );
	}

	public function testEmptyDocumentAndEmptySurfaceRemainValid(): void {
		$schema = new DocumentSchema();
		$this->assertSame( '{"schemaVersion":1,"surfaces":[]}',
			$schema->canonicalize( '{"schemaVersion":1,"surfaces":[]}' ) );
		$doc = self::fixture();
		$doc->surfaces[0]->layers = [];
		$doc->surfaces[0]->readingOrder = [];
		$this->assertNotEmpty( $schema->canonicalize( json_encode( $doc ) ) );
	}

	/**
	 * @dataProvider provideInvalidDocuments
	 * @param string $json
	 */
	public function testRejectsInvalidDocuments( string $json ): void {
		$this->expectException( \InvalidArgumentException::class );
		( new DocumentSchema() )->canonicalize( $json );
	}

	/** @return array */
	public static function provideInvalidDocuments(): array {
		$cases = [];
		foreach ( [ 'null', 'false', '1', '"text"', '[]', '{}', '{',
			'{"schemaVersion":1,"surfaces":{}}', '{"schemaVersion":1,"surfaces":null}',
			'{"schemaVersion":1,"surfaces":[],"schemaVersion":1}',
			'{"schemaVersion":1,"surfaces":[],"\\u0073urfaces":[]}' ] as $i => $json ) {
			$cases['container-' . $i] = [ $json ];
		}
		$mutations = [
			'unknown-version' => static function ( $d ) {
				$d->schemaVersion = 2;
			},
			'string-version' => static function ( $d ) {
				$d->schemaVersion = '1';
			},
			'float-version' => static function ( $d ) {
				$d->schemaVersion = 1.5;
			},
			'owner-injection' => static function ( $d ) {
				$d->owner = 1;
			},
			'unknown-surface-field' => static function ( $d ) {
				$d->surfaces[0]->unknown = true;
			},
			'array-surface' => static function ( $d ) {
				$d->surfaces[0] = [];
			},
			'duplicate-surface' => static function ( $d ) {
				$d->surfaces[] = $d->surfaces[0];
			},
			'unknown-kind' => static function ( $d ) {
				$d->surfaces[0]->kind = 'video';
			},
			'bad-id' => static function ( $d ) {
				$d->surfaces[0]->id = '../x';
			},
			'numeric-id' => static function ( $d ) {
				$d->surfaces[0]->id = 1;
			},
			'control-label' => static function ( $d ) {
				$d->surfaces[0]->label = "a\nb";
			},
			'long-label' => static function ( $d ) {
				$d->surfaces[0]->label = str_repeat( 'x', 513 );
			},
			'missing-canvas-field' => static function ( $d ) {
				unset( $d->surfaces[0]->canvas->width );
			},
			'string-width' => static function ( $d ) {
				$d->surfaces[0]->canvas->width = '800';
			},
			'zero-height' => static function ( $d ) {
				$d->surfaces[0]->canvas->height = 0;
			},
			'oversize-width' => static function ( $d ) {
				$d->surfaces[0]->canvas->width = 4097;
			},
			'string-visible' => static function ( $d ) {
				$d->surfaces[0]->canvas->backgroundVisible = 'false';
			},
			'bad-opacity' => static function ( $d ) {
				$d->surfaces[0]->canvas->backgroundOpacity = 2;
			},
			'string-opacity' => static function ( $d ) {
				$d->surfaces[0]->canvas->backgroundOpacity = '0';
			},
			'css-url' => static function ( $d ) {
				$d->surfaces[0]->canvas->backgroundColor = 'url(https://example.com)';
			},
			'slide-source' => static function ( $d ) {
				$d->surfaces[0]->source = null;
			},
			'image-without-source' => static function ( $d ) {
				unset( $d->surfaces[1]->source );
			},
			'live-source' => static function ( $d ) {
				unset( $d->surfaces[1]->source->timestamp );
			},
			'foreign-source' => static function ( $d ) {
				$d->surfaces[1]->source->repository = 'commons';
			},
			'url-source' => static function ( $d ) {
				$d->surfaces[1]->source->fileTitle = 'https://example.com/a.png';
			},
			'bad-date' => static function ( $d ) {
				$d->surfaces[1]->source->timestamp = '20260230120000';
			},
			'bad-hash' => static function ( $d ) {
				$d->surfaces[1]->source->sha1 = 'abc';
			},
			'image-page-two' => static function ( $d ) {
				$d->surfaces[1]->source->page = 2;
			},
			'pdf-page-zero' => static function ( $d ) {
				$d->surfaces[2]->source->page = 0;
			},
			'layer-map' => static function ( $d ) {
				$d->surfaces[0]->layers = (object)[];
			},
			'layer-scalar' => static function ( $d ) {
				$d->surfaces[0]->layers[0] = null;
			},
			'duplicate-layer' => static function ( $d ) {
				$d->surfaces[0]->layers[] = $d->surfaces[0]->layers[0];
			},
			'unknown-layer-field' => static function ( $d ) {
				$d->surfaces[0]->layers[0]->onload = 'evil';
			},
			'coerced-geometry' => static function ( $d ) {
				$d->surfaces[0]->layers[0]->x = '40';
			},
			'unsafe-text' => static function ( $d ) {
				$d->surfaces[0]->layers[0]->text = '<script>evil</script>';
			},
			'unknown-layer-type' => static function ( $d ) {
				$d->surfaces[0]->layers[0]->type = 'unknown';
			},
			'missing-layer-id' => static function ( $d ) {
				unset( $d->surfaces[0]->layers[0]->id );
			},
			'dangling-reading-order' => static function ( $d ) {
				$d->surfaces[0]->readingOrder = [ 'missing' ];
			},
			'duplicate-reading-order' => static function ( $d ) {
				$d->surfaces[0]->readingOrder = [ 'title', 'title' ];
			},
			'dangling-parent' => static function ( $d ) {
				$d->surfaces[0]->layers[0]->parentGroup = 'missing';
			},
			'non-group-children' => static function ( $d ) {
				$d->surfaces[0]->layers[0]->children = [ 'title' ];
			}
		];
		foreach ( $mutations as $name => $mutate ) {
			$doc = self::fixture();
			$mutate( $doc );
			$cases[$name] = [ json_encode( $doc ) ];
		}
		$cases['bytes'] = [ str_repeat( ' ', DocumentSchema::MAX_BYTES + 1 ) ];
		$cases['depth'] = [ str_repeat( '[', 65 ) . '0' . str_repeat( ']', 65 ) ];
		return $cases;
	}

	public function testGroupsAreAcyclicAndReciprocal(): void {
		$doc = self::fixture();
		$doc->surfaces[0]->layers[] = (object)[ 'id' => 'group', 'type' => 'group', 'children' => [ 'title' ] ];
		$doc->surfaces[0]->layers[0]->parentGroup = 'group';
		$schema = new DocumentSchema();
		$this->assertNotEmpty( $schema->canonicalize( json_encode( $doc ) ) );
		$doc->surfaces[0]->layers = [
			(object)[ 'id' => 'a', 'type' => 'group', 'parentGroup' => 'b', 'children' => [ 'b' ] ],
			(object)[ 'id' => 'b', 'type' => 'group', 'parentGroup' => 'a', 'children' => [ 'a' ] ]
		];
		$doc->surfaces[0]->readingOrder = [];
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'cyclic-group' );
		$schema->canonicalize( json_encode( $doc ) );
	}

	public function testCodecPreservesStringsAndNestedDistinctKeys(): void {
		$json = '{"a":{"a":"quote \\" , braces {} []"},"b":[{"a":1},{"a":2}]}';
		json_decode( $json, false, 64, JSON_THROW_ON_ERROR );
		JsonSnapshotCodec::rejectDuplicateKeys( $json );
		$this->assertSame( '{"a":[],"b":{}}', JsonSnapshotCodec::encode( (object)[ 'b' => (object)[], 'a' => [] ] ) );
	}

	/**
	 * @dataProvider provideCountLimits
	 * @param int $surfaces
	 * @param int $layers
	 * @param bool $valid
	 */
	public function testCountLimits( int $surfaces, int $layers, bool $valid ): void {
		$surface = self::fixture()->surfaces[0];
		$surface->layers = [];
		$surface->readingOrder = [];
		for ( $i = 0; $i < $layers; $i++ ) {
			$surface->layers[] = (object)[ 'id' => 'l' . $i, 'type' => 'text', 'text' => 'Example' ];
		}
		$doc = (object)[ 'schemaVersion' => 1, 'surfaces' => [] ];
		for ( $i = 0; $i < $surfaces; $i++ ) {
			$copy = clone $surface;
			$copy->id = 's' . $i;
			$doc->surfaces[] = $copy;
		}
		if ( !$valid ) {
			$this->expectException( \InvalidArgumentException::class );
		}
		$this->assertNotEmpty( ( new DocumentSchema() )->canonicalize( json_encode( $doc ) ) );
	}

	/** @return array */
	public static function provideCountLimits(): array {
		return [
			'surfaces-at-limit' => [ 100, 0, true ],
			'surfaces-over-limit' => [ 101, 0, false ],
			'layers-at-limit' => [ 1, 100, true ],
			'layers-over-limit' => [ 1, 101, false ],
			'total-at-limit' => [ 10, 100, true ],
			'total-over-limit' => [ 11, 100, false ]
		];
	}

	public function testNestedEscapedDuplicateKeyIsRejected(): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'duplicate-json-key' );
		JsonSnapshotCodec::rejectDuplicateKeys( '{"items":[{"name":1,"\\u006eame":2}]}' );
	}

	public function testOverflowingLayerNumberIsAValidationError(): void {
		$json = str_replace( '"x":40', '"x":1e999', json_encode( self::fixture() ) );
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'invalid-layer-json-number' );
		( new DocumentSchema() )->canonicalize( $json );
	}

	/**
	 * Server half of tests/jest/EditorCreatedLayers.test.js, which draws this fixture with the real tools.
	 */
	public function testEditorCreatedLayersPublishUnchanged(): void {
		$json = file_get_contents( __DIR__ . '/../../../fixtures/revisions/editor-created-document-v1.json' );
		$this->assertEquals( json_decode( $json ), json_decode( ( new DocumentSchema() )->canonicalize( $json ) ) );
	}
}
