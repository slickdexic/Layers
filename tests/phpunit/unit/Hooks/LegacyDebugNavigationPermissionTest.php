<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks;

use MediaWiki\Extension\Layers\Hooks\UIHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use PHPUnit\Framework\TestCase;

/**
 * Standalone hook checks isolate the native-service substitute to each subprocess.
 * @covers \MediaWiki\Extension\Layers\Hooks\UIHooks
 */
class LegacyDebugNavigationPermissionTest extends TestCase {

	/** @return array */
	public static function provideAdmission(): array {
		$cases = [];
		foreach ( [ false, true ] as $universal ) {
			foreach ( [
				'allowed debug' => [ true, true, false, false ],
				'allowed normal' => [ true, false, false, false ],
				'denied debug' => [ false, true, false, false ],
				'denied normal' => [ false, false, false, false ],
				'permission failure debug' => [ false, true, false, true ],
				'completed debug' => [ true, true, true, false ]
			] as $name => $case ) {
				$cases[$name . ( $universal ? ' universal' : ' legacy' )] = [ ...$case, $universal ];
			}
		}
		return $cases;
	}

	// phpcs:disable MediaWiki.Commenting.PhpunitAnnotations.ForbiddenRunInSeparateProcess,MediaWiki.Commenting.PhpunitAnnotations.ForbiddenPreserveGlobalState,MediaWiki.Commenting.FunctionAnnotations.UnrecognizedAnnotation -- Standalone service alias must never escape its subprocess.

	/**
	 * @dataProvider provideAdmission
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 * @param bool $allowed
	 * @param bool $debug
	 * @param bool $complete
	 * @param bool $lookupFails
	 * @param bool $universal
	 */
	public function testDebugCannotGrantNavigation( bool $allowed, bool $debug, bool $complete,
		bool $lookupFails, bool $universal
	): void {
		$this->assertFalse( class_exists( 'MediaWiki\\MediaWikiServices' ) );
		$permissions = $this->getMockBuilder( \stdClass::class )->addMethods( [ 'userHasRight' ] )->getMock();
		$permission = $permissions->method( 'userHasRight' )->with( $this->anything(), 'editlayers' );
		if ( $lookupFails ) {
			$permission->willThrowException( new \RuntimeException( 'Unavailable permission lookup' ) );
		} else {
			$permission->willReturn( $allowed );
		}
		$repos = $this->getMockBuilder( \stdClass::class )->addMethods( [ 'findFile' ] )->getMock();
		$repos->method( 'findFile' )->willReturn( null );
		$services = new class {
			/** @var self */
			public static $instance;

			/** @var \stdClass */
			public $permissions;

			/** @var \stdClass */
			public $repos;

			/** @return self */
			public static function getInstance() {
				return self::$instance;
			}

			/** @return \stdClass */
			public function getPermissionManager() {
				return $this->permissions;
			}

			/** @return \stdClass */
			public function getRepoGroup() {
				return $this->repos;
			}
		};
		$services::$instance = $services;
		$services->permissions = $permissions;
		$services->repos = $repos;
		class_alias( get_class( $services ), 'MediaWiki\\MediaWikiServices' );
		$current = new \ReflectionProperty( MigrationState::class, 'current' );
		$current->setAccessible( true );
		$current->setValue( null, $complete );
		$request = $this->getMockBuilder( \stdClass::class )->addMethods( [ 'getVal' ] )->getMock();
		$request->method( 'getVal' )->willReturn( null );
		$skin = $this->getMockBuilder( \stdClass::class )
			->addMethods( [ 'getConfig', 'getRequest', 'getTitle', 'getUser' ] )->getMock();
		$config = new \HashConfig( [ 'LayersDebug' => $debug, 'LayersEnable' => true ] );
		$skin->method( 'getConfig' )->willReturn( $config );
		$skin->method( 'getRequest' )->willReturn( $request );
		$skin->method( 'getTitle' )->willReturn( \Title::makeTitle( NS_FILE, 'Permission.png' ) );
		$skin->method( 'getUser' )->willReturn( new \stdClass() );
		$before = [ 'views' => [ 'view' => [ 'text' => 'Read' ], 'edit' => [ 'text' => 'Edit' ] ],
			'actions' => [ 'custom' => [ 'text' => 'Custom' ] ] ];
		$links = $before;
		if ( $universal ) {
			UIHooks::onSkinTemplateNavigation__Universal( $skin, $links );
		} else {
			UIHooks::onSkinTemplateNavigation( $skin, $links );
		}
		if ( $allowed && !$complete && !$lookupFails ) {
			$this->assertArrayHasKey( 'editlayers', $links['views'] );
			unset( $links['views']['editlayers'] );
			if ( $debug ) {
				$this->assertArrayHasKey( 'editlayers-debug', $links['actions'] );
				unset( $links['actions']['editlayers-debug'] );
			}
		}
		$this->assertSame( $before, $links );
	}

	// phpcs:enable MediaWiki.Commenting.PhpunitAnnotations.ForbiddenRunInSeparateProcess,MediaWiki.Commenting.PhpunitAnnotations.ForbiddenPreserveGlobalState,MediaWiki.Commenting.FunctionAnnotations.UnrecognizedAnnotation
}
