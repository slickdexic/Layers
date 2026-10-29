<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Request\FauxRequest;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 * @group Database
 * @group API
 */
class LegacyLiteralTextSaveTest extends \MediaWiki\Tests\Api\ApiTestCase {
	protected function setUp(): void {
		parent::setUp();
		MigrationState::clear( $this->getDb() );
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, true, $session );
	}

	public function testLegacySlideSavePreservesSafeTextAndRefusesLoss(): void {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers' ] );
		$name = 'LiteralTextSaveTest';
		$layer = [ 'id' => 'one', 'type' => 'textbox', 'x' => 0, 'y' => 0,
			'width' => 100, 'height' => 100, 'text' => 'condition=true 👩‍💻 <button>' ];
		$params = [ 'action' => 'layerssave', 'slidename' => $name,
			'setname' => 'Default', 'data' => json_encode( [ 'layers' => [ $layer ] ] ) ];
		$result = $this->doApiRequestWithToken( $params, null, $user )[0]['layerssave'];
		$this->assertSame( 'Success', $result['result'] );
		$db = $this->getDb();
		$rows = $db->select( 'layer_sets', [ 'ls_id', 'ls_json_blob' ],
			[ 'ls_img_name' => 'Slide:' . $name ], __METHOD__ );
		$before = [];
		foreach ( $rows as $row ) {
			$before[$row->ls_id] = $row->ls_json_blob;
		}
		$this->assertCount( 1, $before );
		$this->assertSame( $layer['text'], json_decode( reset( $before ), true )['layers'][0]['text'] );

		foreach ( [ 'textbox', 'callout' ] as $type ) {
			$layer['type'] = $type;
			$layer['text'] = '<script>bad</script>';
			$params['data'] = json_encode( [ 'layers' => [ $layer ] ] );
			try {
				$this->doApiRequestWithToken( $params, null, $user );
				$this->fail( 'Invalid text must refuse Save' );
			} catch ( ApiUsageException $e ) {
				$this->assertTrue( self::apiExceptionHasCode( $e, 'validationfailed' ) );
			}
		}
		$after = [];
		foreach ( $db->select( 'layer_sets', [ 'ls_id', 'ls_json_blob' ],
			[ 'ls_img_name' => 'Slide:' . $name ], __METHOD__ ) as $row
		) {
			$after[$row->ls_id] = $row->ls_json_blob;
		}
		$this->assertSame( $before, $after );
	}
}
