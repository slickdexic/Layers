<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\Processors\ImageLinkProcessor;
use MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use MediaWiki\Extension\Layers\Hooks\UIHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Title\Title;

/**
 * Real native media dimensions and permissions for the external-review corrections.
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\ImageLinkProcessor
 * @covers \MediaWiki\Extension\Layers\Hooks\UIHooks
 * @group Database
 */
class LegacyReviewBoundaryTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		$this->setUpIsolatedLocalRepoFixture();
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	/** @return array */
	public static function provideInjectionPaths(): array {
		return [ [ 'attributes' ], [ 'direct' ], [ 'database' ] ];
	}

	/** @dataProvider provideInjectionPaths @param string $path */
	public function testNativeSecondPdfPageKeepsItsOwnGeometry( string $path ): void {
		$file = $this->upload( 'ReviewGeometry-' . wfRandomString( 8 ) . '.pdf', 'test-multipage.pdf' );
		$this->assertSame( 2, $file->pageCount() );
		$this->assertNotSame( $file->getWidth( 1 ), $file->getWidth( 2 ) );
		$this->assertNotSame( $file->getHeight( 1 ), $file->getHeight( 2 ) );
		$this->saveSet( $file, 'ABC', 1, 'First page stays separate', 1 );
		$this->saveSet( $file, 'ABC', 2, 'Second page selected', 2 );
		if ( $path === 'attributes' ) {
			$attributes = [];
			$this->assertTrue( ( new LayerInjector() )->injectIntoAttributes( $attributes, $file, 'ABC', 'test', 2 ) );
			$payload = json_decode( $attributes['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		} else {
			$processor = new ImageLinkProcessor( new LayersHtmlInjector(), new LayersParamExtractor() );
			$params = [ 'page' => 2 ];
			if ( $path === 'direct' ) {
				$params['layersjson'] = '{"layers":[{"id":"note","type":"text","text":"Second page selected"}]}';
			}
			$html = '<img src="/native-fixture.jpg">';
			$processor->processImageLink( $file, $params, [], $html, 'ABC' );
			$this->assertSame( 1, preg_match( '/data-layer-data="([^"]+)"/', $html, $matches ) );
			$payload = json_decode( html_entity_decode( $matches[1], ENT_QUOTES ), true, 64, JSON_THROW_ON_ERROR );
		}
		$this->assertSame( (int)$file->getWidth( 2 ), $payload['baseWidth'] );
		$this->assertSame( (int)$file->getHeight( 2 ), $payload['baseHeight'] );
		$this->assertSame( 'Second page selected', $payload['layers'][0]['text'] );
		$this->witness( [ 'path' => $path, 'fileClass' => get_class( $file ),
			'width' => $payload['baseWidth'], 'height' => $payload['baseHeight'], 'selectedPage' => 2 ] );
	}

	/** @return array */
	public static function provideNavigation(): array {
		return [
			'allowed normal' => [ true, false, null, false, false ],
			'allowed debug default' => [ true, true, null, false, true ],
			'allowed debug enabled' => [ true, true, '1', false, true ],
			'allowed debug disabled' => [ true, true, '0', false, false ],
			'denied debug default' => [ false, true, null, false, true ],
			'denied debug enabled' => [ false, true, '1', false, true ],
			'denied normal' => [ false, false, null, false, false ],
			'completed allowed debug' => [ true, true, '1', true, true ]
		];
	}

	/**
	 * @dataProvider provideNavigation
	 * @param bool $allowed
	 * @param bool $debug
	 * @param string|null $requestDebug
	 * @param bool $complete
	 * @param bool $effectiveDebug
	 */
	public function testNativeDebugCannotGrantNavigation( bool $allowed, bool $debug,
		?string $requestDebug, bool $complete, bool $effectiveDebug
	): void {
		$this->overrideConfigValue( 'LayersDebug', $debug );
		$rights = $allowed ? [ 'read', 'edit', 'editlayers' ] : [ 'read', 'edit' ];
		$this->overrideUserPermissions( $this->actor, $rights );
		$permissions = $this->getServiceContainer()->getPermissionManager();
		$this->assertSame( $allowed, $permissions->userHasRight( $this->actor, 'editlayers' ) );
		if ( $complete ) {
			MigrationState::markComplete( $this->getDb() );
		}
		$title = Title::makeTitle( NS_FILE, 'NativeReviewPermission.png' );
		$context = new RequestContext();
		$context->setTitle( $title );
		$context->setUser( $this->actor );
		$params = $requestDebug === null ? [] : [ 'layersdebug' => $requestDebug ];
		$context->setRequest( new FauxRequest( $params ) );
		$before = [ 'views' => [ 'view' => [ 'text' => 'Read' ], 'edit' => [ 'text' => 'Edit' ] ],
			'actions' => [ 'custom' => [ 'text' => 'Custom' ] ] ];
		foreach ( [ false, true ] as $universal ) {
			$links = $before;
			if ( $universal ) {
				UIHooks::onSkinTemplateNavigation__Universal( $context->getSkin(), $links );
			} else {
				UIHooks::onSkinTemplateNavigation( $context->getSkin(), $links );
			}
			$visible = $allowed && !$complete;
			$this->assertSame( $visible, isset( $links['views']['editlayers'] ) );
			$this->assertSame( $visible && $effectiveDebug, isset( $links['actions']['editlayers-debug'] ) );
			if ( $visible ) {
				$this->assertSame( $title->getLocalURL( [ 'action' => 'editlayers' ] ),
					$links['views']['editlayers']['href'] );
				unset( $links['views']['editlayers'], $links['actions']['editlayers-debug'] );
			}
			$this->assertSame( $before, $links );
			$this->witness( [ 'allowed' => $allowed, 'configDebug' => $debug, 'requestDebug' => $requestDebug,
				'completed' => $complete, 'universal' => $universal, 'tabVisible' => $visible,
				'debugActionVisible' => $visible && $effectiveDebug, 'otherNavigationExact' => true,
				'permissionManager' => get_class( $permissions ) ] );
		}
	}

	/** @param array $record */
	private function witness( array $record ): void {
		$target = getenv( 'LAYERS_REVIEW_BOUNDARY_WITNESS' );
		if ( $target ) {
			$record['test'] = $this->getName();
			$record['testSourceSha256'] = hash_file( 'sha256', __FILE__ );
			$uiFile = ( new \ReflectionClass( UIHooks::class ) )->getFileName();
			$record['uiSourceSha256'] = hash_file( 'sha256', $uiFile );
			file_put_contents( $target, json_encode( $record, JSON_THROW_ON_ERROR ) . "\n", FILE_APPEND | LOCK_EX );
		}
	}
}
