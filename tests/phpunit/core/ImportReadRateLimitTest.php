<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationDraftRebase;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRead;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRebase;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService;

/**
 * Native request-budget admission for Import reads and recovery association proofs (SEC-4).
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRebase
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationDraftRebase
 * @group Database
 * @group API
 */
class ImportReadRateLimitTest extends \MediaWiki\Tests\Api\ApiTestCase {
	private int $readerCalls = 0;
	private ?ApiMain $apiMain = null;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'RateLimits', [
			'editlayers-info' => [ 'user' => [ 1, 3600 ] ],
			'editlayers-render' => [ 'user' => [ 1, 3600 ] ]
		] );
		$definitions = [
			'layersworkingcopyimportread' => [ ApiLayersWorkingCopyImportRead::class,
				PageWorkingCopyImportReadService::class, 'read' ],
			'layersworkingcopyimportcreationread' => [ ApiLayersWorkingCopyImportCreationRead::class,
				PageWorkingCopyImportCreationService::class, 'read' ],
			'layersworkingcopyimportcreationrebase' => [ ApiLayersWorkingCopyImportCreationRebase::class,
				PageOwnedPilot::class, 'prepareCreationRebase' ],
			'layersworkingcopyimportcreationdraftrebase' => [ ApiLayersWorkingCopyImportCreationDraftRebase::class,
				PageOwnedPilot::class, 'prepareCreationDraftRebase' ]
		];
		$modules = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		foreach ( $definitions as $name => [ $api, $service, $method ] ) {
			$modules[$name] = [ 'class' => $api,
				'factory' => function ( $main, $name ) use ( $api, $service, $method ) {
					$this->apiMain = $main;
					$main->setCacheMode( 'public' );
					$reader = $this->createMock( $service );
					$reader->method( $method )->willReturnCallback( function (): array {
						$this->readerCalls++;
						return [ 'fixture' => 'authorized read' ];
					} );
					return new $api( $main, $name, $reader );
				} ];
		}
		$this->overrideConfigValue( 'APIModules', $modules );
	}

	public static function provideReads(): array {
		$base = [ 'targetpageid' => 1, 'baserevid' => 1 ];
		$source = [ 'sourcepageid' => 2, 'sourcerevid' => 2, 'sourcesurface' => 'source' ];
		return [
			'existing-member' => [ $base + $source + [
				'action' => 'layersworkingcopyimportread', 'targetsurface' => 'target' ] ],
			'missing-member' => [ $base + $source + [
				'action' => 'layersworkingcopyimportcreationread', 'targetsurface' => 'target',
				'embedstart' => 0, 'embedtext' => '{{#Slide:Target}}' ] ],
			'creation-rebase' => [ $base + [ 'action' => 'layersworkingcopyimportcreationrebase',
				'targetsurface' => 'target', 'originrevid' => 1, 'originstart' => 0,
				'origintext' => '{{#Slide:Target}}' ] ],
			'draft-rebase' => [ $base + [ 'action' => 'layersworkingcopyimportcreationdraftrebase',
				'originsurface' => 'target', 'originrevid' => 1 ] ]
		];
	}

	/** @dataProvider provideReads */
	public function testExhaustedInformationBudgetRefusesBeforeSourceWork( array $params ): void {
		$user = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers' ] );
		$this->assertFalse( $user->isAllowed( 'noratelimit' ) );
		$this->assertFalse( $user->pingLimiter( 'editlayers-info' ) );
		$this->assertTrue( $user->pingLimiter( 'editlayers-info' ) );
		try {
			$this->doApiRequest( $params, null, false, $user );
			$this->fail( 'Import bypassed an exhausted native information budget' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'ratelimited' ) );
			$this->assertSame( 'private', $this->apiMain->getCacheMode() );
		}
		$this->assertSame( 0, $this->readerCalls );
	}

	/** @dataProvider provideReads */
	public function testAdmittedReadSpendsInformationBudgetOnce( array $params ): void {
		$user = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers' ] );
		$this->doApiRequest( $params, null, false, $user );
		$this->assertSame( 1, $this->readerCalls );
		$this->assertTrue( $user->pingLimiter( 'editlayers-info' ) );
		$this->assertSame( 'private', $this->apiMain->getCacheMode() );
	}

	/** @dataProvider provideReads */
	public function testRenderBudgetExhaustionDoesNotBlockInformationRead( array $params ): void {
		$user = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers' ] );
		$this->assertFalse( $user->pingLimiter( 'editlayers-render' ) );
		$this->assertTrue( $user->pingLimiter( 'editlayers-render' ) );
		$this->doApiRequest( $params, null, false, $user );
		$this->assertSame( 1, $this->readerCalls );
	}
}
