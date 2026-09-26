<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

/**
 * layersinfo must name the slide set it returned, whichever lookup found it.
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersInfo
 * @group Database
 * @group API
 */
class ApiLayersInfoSlideNameTest extends \MediaWiki\Tests\Api\ApiTestCase {
	public function testSlideResponsesNameTheReturnedSet(): void {
		if ( !$this->getDb()->tableExists( 'layer_sets', __METHOD__ ) ) {
			$this->markTestSkipped( 'Layers schema is not installed in this test database' );
		}
		$this->overrideConfigValues( [ 'RateLimits' => [], 'LayersSlidesEnable' => true ] );
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers' ] );
		$slide = 'SlideNameProbe' . mt_rand();
		$save = function ( ?string $set ) use ( $user, $slide ): int {
			$params = [ 'action' => 'layerssave', 'slidename' => $slide, 'data' => json_encode( [
				'canvasWidth' => 800, 'canvasHeight' => 600,
				'layers' => [ [ 'id' => 'r', 'type' => 'rectangle', 'x' => 1, 'y' => 1, 'width' => 5, 'height' => 5 ] ]
			] ) ];
			if ( $set !== null ) {
				$params['setname'] = $set;
			}
			return (int)$this->doApiRequestWithToken( $params, null, $user )[0]['layerssave']['layersetid'];
		};
		$info = fn ( array $extra ) => $this->doApiRequest(
			[ 'action' => 'layersinfo', 'slidename' => $slide ] + $extra, null, false, $user )[0]['layersinfo'];

		$first = $save( 'First_set' );
		$second = $save( 'Second_set' );
		$latest = $info( [] );
		$this->assertSame( 'Second_set', $latest['layerset']['name'] );
		// The revision list belongs to the returned set, not to whichever set was requested.
		$this->assertSame( [ $second ], array_column( $latest['all_layersets'], 'ls_id' ) );
		$this->assertSame( 'First_set', $info( [ 'setname' => 'First_set' ] )['layerset']['name'] );
		$byId = $info( [ 'layersetid' => $first ] );
		$this->assertSame( 'First_set', $byId['layerset']['name'] );
		$this->assertSame( [ $first ], array_column( $byId['all_layersets'], 'ls_id' ) );
	}
}
