<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\ApiLayersPdfCreationRead;
use MediaWiki\Extension\Layers\Api\ApiLayersPdfCreationView;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfEditorReadService;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfViewerReadService;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPdfCreationRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPdfCreationView
 * @group Database
 * @group API
 */
class PageOwnedReadRateLimitTest extends \MediaWiki\Tests\Api\ApiTestCase {
	private int $readerCalls = 0;
	private ?\MediaWiki\Api\ApiMain $apiMain = null;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'RateLimits', [
			'editlayers-info' => [ 'user' => [ 1, 3600 ] ],
			'editlayers-render' => [ 'user' => [ 1, 3600 ] ]
		] );
		$read = function (): array {
			$this->readerCalls++;
			return [ 'pageCount' => 2 ];
		};
		$services = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace( $services->getMainConfig()->get( 'APIModules' ), [
			'layersread' => [ 'class' => ApiLayersRead::class, 'factory' => function ( $main, $name ) use ( $read ) {
				$this->apiMain = $main;
				$main->setCacheMode( 'public' );
				$reader = $this->createMock( PageReadService::class );
				$reader->method( 'read' )->willReturnCallback( $read );
				$services = $this->getServiceContainer();
				return new ApiLayersRead( $main, $name, $reader, $services->getTitleFactory(),
					PageOwnedScope::newFromServices( $services, [ 'Rate_admission_owner' ] ),
					$read, 300, $read, $read );
			} ],
			'layerspdfcreationview' => [ 'class' => ApiLayersPdfCreationView::class,
				'factory' => function ( $main, $name ) use ( $read ) {
					$this->apiMain = $main;
					$reader = $this->createMock( PageMissingPdfViewerReadService::class );
					$reader->method( 'read' )->willReturnCallback( $read );
					return new ApiLayersPdfCreationView( $main, $name, $reader );
				} ],
			'layerspdfcreationread' => [ 'class' => ApiLayersPdfCreationRead::class,
				'factory' => function ( $main, $name ) use ( $read ) {
					$this->apiMain = $main;
					$reader = $this->createMock( PageMissingPdfEditorReadService::class );
					$reader->method( 'read' )->willReturnCallback( $read );
					return new ApiLayersPdfCreationRead( $main, $name, $reader );
				} ]
		] ) );
	}

	public static function provideReads(): array {
		$base = [ 'action' => 'layersread', 'owner' => 'Rate_admission_owner', 'revid' => 1 ];
		$bound = $base + [ 'binding' => 'v1:1:fixture' ];
		$missing = [ 'pageid' => 1, 'baserevid' => 1, 'embedstart' => 0,
			'embedtext' => '[[File:Fixture.pdf|layerset=Absent]]' ];
		return [
			'snapshot' => [ $base, 'info' ],
			'bindings' => [ $bound, 'info' ],
			'controls' => [ $bound + [ 'controls' => true ], 'info' ],
			'viewer' => [ $bound + [ 'viewer' => true ], 'info' ],
			'editor-page' => [ $bound + [ 'editorpage' => 2 ], 'info' ],
			'missing-viewer' => [ $missing + [ 'action' => 'layerspdfcreationview' ], 'info' ],
			'missing-editor' => [ $missing + [ 'action' => 'layerspdfcreationread', 'pdfpage' => 2 ], 'render' ]
		];
	}

	/** @dataProvider provideReads */
	public function testExhaustedBudgetRefusesBeforeReader( array $params, string $bucket ): void {
		$user = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read' ] );
		$this->assertFalse( $user->isAllowed( 'noratelimit' ) );
		$this->assertFalse( $user->pingLimiter( 'editlayers-' . $bucket ) );
		$this->assertTrue( $user->pingLimiter( 'editlayers-' . $bucket ) );
		try {
			$this->doApiRequest( $params, null, false, $user );
			$this->fail( 'Exhausted native budget was bypassed' );
		} catch ( ApiUsageException $exception ) {
			$this->assertTrue( self::apiExceptionHasCode( $exception, 'ratelimited' ) );
			$this->assertSame( 'private', $this->apiMain->getCacheMode() );
		}
		$this->assertSame( 0, $this->readerCalls, 'No source resolution or render preparation after refusal' );
	}

	/** @dataProvider provideReads */
	public function testBelowLimitCallsReader( array $params, string $bucket ): void {
		$user = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read' ] );
		$this->doApiRequest( $params, null, false, $user );
		$this->assertSame( 1, $this->readerCalls );
		$this->assertTrue( $user->pingLimiter( 'editlayers-' . $bucket ), 'The successful call spends its own budget' );
	}

	/** @dataProvider provideReads */
	public function testInformationAndRenderBudgetsStaySeparate( array $params, string $bucket ): void {
		$user = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read' ] );
		$other = $bucket === 'info' ? 'render' : 'info';
		$this->assertFalse( $user->pingLimiter( 'editlayers-' . $other ) );
		$this->assertTrue( $user->pingLimiter( 'editlayers-' . $other ) );
		$this->doApiRequest( $params, null, false, $user );
		$this->assertSame( 1, $this->readerCalls );
	}
}
