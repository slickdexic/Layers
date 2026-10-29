<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 * @group Database
 * @group API
 */
class LegacyImageLiteralTextSaveTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, true, $session );
	}

	public function testImageSavePreservesLiteralTextAndRefusesUnsafeReplacement(): void {
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'upload' ] );
		$file = $this->upload( 'Literal_text_image.png' );
		$layer = [ 'id' => 'one', 'type' => 'textbox', 'x' => 0, 'y' => 0,
	  'width' => 100, 'height' => 100, 'text' => 'condition=true 👩‍💻 <button>' ];
		$params = [ 'action' => 'layerssave', 'filename' => $file->getName(),
	  'setname' => 'Default', 'data' => json_encode( [ 'layers' => [ $layer ] ] ) ];
		$saved = $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layerssave'];
		$this->assertSame( 'Success', $saved['result'] );
		$before = [];
		foreach ( $this->getDb()->select( 'layer_sets', [ 'ls_id', 'ls_json_blob' ],
		[ 'ls_img_name' => $file->getName() ], __METHOD__ ) as $row
		) {
			$before[$row->ls_id] = $row->ls_json_blob;
		}
		$this->assertCount( 1, $before );
		$this->assertSame( $layer['text'], json_decode( reset( $before ), true )['layers'][0]['text'] );

		foreach ( [ 'textbox', 'callout' ] as $type ) {
			$layer['type'] = $type;
			$layer['text'] = '<script>bad</script>';
			$params['data'] = json_encode( [ 'layers' => [ $layer ] ] );
			try {
				$this->doApiRequestWithToken( $params, null, $this->actor );
				$this->fail( 'Invalid text must refuse Save' );
			} catch ( ApiUsageException $e ) {
				$this->assertTrue( self::apiExceptionHasCode( $e, 'validationfailed' ) );
			}
		}
		$after = [];
		foreach ( $this->getDb()->select( 'layer_sets', [ 'ls_id', 'ls_json_blob' ],
		[ 'ls_img_name' => $file->getName() ], __METHOD__ ) as $row
		) {
			$after[$row->ls_id] = $row->ls_json_blob;
		}
		$this->assertSame( $before, $after );
	}
}
