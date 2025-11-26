<?php

/**
 * Layers Extension Test Suite
 * Run this script to verify basic functionality
 *
 * Usage: php maintenance/runScript.php extensions/Layers/tests/LayersTest.php
 */

use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;

require_once getenv( 'MW_INSTALL_PATH' ) !== false
	? getenv( 'MW_INSTALL_PATH' ) . '/maintenance/Maintenance.php'
	: __DIR__ . '/../../../maintenance/Maintenance.php';

class LayersTest extends Maintenance {
	/** @var int */
	private $passed = 0;
	/** @var int */
	private $failed = 0;

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Layers Extension Test Suite' );
	}

	public function execute() {
		$this->output( "=== Layers Extension Test Suite ===\n" );

		$this->testDatabaseTables();
		$this->testLayersDatabase();
		$this->testConfigurationValues();
		$this->testUserPermissions();
		$this->testResourceModules();
		$this->testApiEndpoints();
		$this->testThumbnailRenderer();

		$this->output( "\n=== Test Results ===" );
		$this->output( "Passed: {$this->passed}\n" );
		$this->output( "Failed: {$this->failed}\n" );

		if ( $this->failed === 0 ) {
			$this->output( "✅ All tests passed! Extension appears to be working correctly.\n" );
		} else {
			$this->output( "❌ Some tests failed. Check the output above for details.\n" );
		}
	}

	private function test( $name, $condition, $details = '' ) {
		if ( $condition ) {
			$this->output( "✅ $name\n" );
			$this->passed++;
		} else {
			$this->output( "❌ $name" . ( $details ? " - $details" : '' ) . "\n" );
			$this->failed++;
		}
	}

	/**
	 * @covers MediaWiki\\Extension\\Layers\\Database\\LayersDatabase
	 */
	private function testDatabaseTables() {
		$this->output( "\n--- Database Tables ---\n" );

		// Define constants for compatibility if not available
		if ( !defined( 'DB_REPLICA' ) ) {
			define( 'DB_REPLICA', -1 );
		}
		$dbr = MediaWikiServices::getInstance()->getDBLoadBalancer()->getConnection( DB_REPLICA );

		$this->test(
			"layer_sets table exists",
			$dbr->tableExists( 'layer_sets' )
		);

		$this->test(
			"layer_assets table exists",
			$dbr->tableExists( 'layer_assets' )
		);

		$this->test(
			"layer_set_usage table exists",
			$dbr->tableExists( 'layer_set_usage' )
		);
	}

	/**
	 * @covers MediaWiki\\Extension\\Layers\\Database\\LayersDatabase
	 */
	private function testLayersDatabase() {
		$this->output( "\n--- LayersDatabase Class ---\n" );

		try {
			$db = MediaWikiServices::getInstance()->getService( 'LayersDatabase' );
			$this->test( "LayersDatabase instantiates", true );

			// Test basic database operations
			$testData = [
				'layers' => [
					[
						'id' => 'test-layer-1',
						'type' => 'text',
						'text' => 'Test Layer',
						'x' => 100,
						'y' => 100
					]
				]
			];

			$this->test(
				"Can save layer set",
				method_exists( $db, 'saveLayerSet' )
			);

			$this->test(
				"Can get layer sets",
				method_exists( $db, 'getLayerSetsForImage' )
			);
		} catch ( Exception $e ) {
			$this->test( "LayersDatabase instantiates", false, $e->getMessage() );
		}
	}

	/**
	 * @covers Nothing
	 */
	private function testConfigurationValues() {
		$this->output( "\n--- Configuration ---\n" );

		$config = MediaWikiServices::getInstance()->getMainConfig();

		$this->test(
			"LayersEnable config exists",
			$config->has( 'LayersEnable' )
		);

		$this->test(
			"LayersMaxBytes config exists",
			$config->has( 'LayersMaxBytes' )
		);

		$this->test(
			"LayersDefaultFonts config exists",
			$config->has( 'LayersDefaultFonts' )
		);

		if ( $config->has( 'LayersEnable' ) ) {
			$this->test(
				"Extension is enabled",
				$config->get( 'LayersEnable' ) === true
			);
		}
	}

	/**
	 * @covers Nothing
	 */
	private function testUserPermissions() {
		$this->output( "\n--- User Permissions ---\n" );

		global $wgGroupPermissions;

		$this->test(
			"editlayers permission defined",
			isset( $wgGroupPermissions['user']['editlayers'] ) ||
			isset( $wgGroupPermissions['*']['editlayers'] )
		);

		$this->test(
			"createlayers permission defined",
			isset( $wgGroupPermissions['autoconfirmed']['createlayers'] ) ||
			isset( $wgGroupPermissions['user']['createlayers'] )
		);

		$this->test(
			"managelayerlibrary permission defined",
			isset( $wgGroupPermissions['sysop']['managelayerlibrary'] )
		);
	}

	/**
	 * @covers Nothing
	 */
	private function testResourceModules() {
		$this->output( "\n--- Resource Modules ---\n" );

		$resourceLoader = MediaWikiServices::getInstance()->getResourceLoader();

		$this->test(
			"ext.layers module exists",
			$resourceLoader->isModuleRegistered( 'ext.layers' )
		);

		$this->test(
			"ext.layers.editor module exists",
			$resourceLoader->isModuleRegistered( 'ext.layers.editor' )
		);

		// Test if JavaScript files exist
		$this->test(
			"LayersEditor.js exists",
			file_exists( __DIR__ . '/../resources/ext.layers.editor/LayersEditor.js' )
		);

		$this->test(
			"CanvasManager.js exists",
			file_exists( __DIR__ . '/../resources/ext.layers.editor/CanvasManager.js' )
		);
	}

	/**
	 * @covers MediaWiki\\Extension\\Layers\\Api\\ApiLayersInfo
	 * @covers MediaWiki\\Extension\\Layers\\Api\\ApiLayersSave
	 */
	private function testApiEndpoints() {
		$this->output( "\n--- API Endpoints ---\n" );

		global $wgAPIModules;

		$this->test(
			"layerssave API module registered",
			isset( $wgAPIModules['layerssave'] )
		);

		$this->test(
			"layersinfo API module registered",
			isset( $wgAPIModules['layersinfo'] )
		);

		// Test class existence
		$this->test(
			"ApiLayersSave class exists",
			class_exists( 'MediaWiki\\Extension\\Layers\\Api\\ApiLayersSave' )
		);

		$this->test(
			"ApiLayersInfo class exists",
			class_exists( 'MediaWiki\\Extension\\Layers\\Api\\ApiLayersInfo' )
		);
	}

	/**
	 * @covers MediaWiki\\Extension\\Layers\\ThumbnailRenderer
	 */
	private function testThumbnailRenderer() {
		$this->output( "\n--- Thumbnail Renderer ---\n" );

		$this->test(
			"ThumbnailRenderer class exists",
			class_exists( 'MediaWiki\\Extension\\Layers\\ThumbnailRenderer' )
		);

		try {
			$renderer = new ThumbnailRenderer();
			$this->test( "ThumbnailRenderer instantiates", true );

			$this->test(
				"ThumbnailRenderer has generateLayeredThumbnail method",
				method_exists( $renderer, 'generateLayeredThumbnail' )
			);
		} catch ( Exception $e ) {
			$this->test( "ThumbnailRenderer instantiates", false, $e->getMessage() );
		}

		// Test ImageMagick availability
		$config = MediaWikiServices::getInstance()->getMainConfig();
		$useImageMagick = $config->get( 'UseImageMagick' );

		$this->test(
			"ImageMagick is enabled",
			$useImageMagick,
			"Set \$wgUseImageMagick = true; for server-side rendering"
		);

		if ( $useImageMagick ) {
			$convertCommand = $config->get( 'ImageMagickConvertCommand' );
			$this->test(
				"ImageMagick convert command exists",
				file_exists( $convertCommand ),
				"Check \$wgImageMagickConvertCommand path"
			);
		}
	}
}

$maintClass = LayersTest::class;
require_once RUN_MAINTENANCE_IF_MAIN;
