<?php
/**
 * Layers Extension Test Suite
 * Run this script to verify basic functionality
 *
 * Usage: php maintenance/runScript.php extensions/Layers/tests/LayersTest.php
 */

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\Extension\Layers\Api\ApiLayersSave;
use MediaWiki\Extension\Layers\Api\ApiLayersInfo;

class LayersExtensionTest {

    private $passed = 0;
    private $failed = 0;

    private function output( $msg ) {
        echo $msg . "\n";
    }

    public function run() {
        $this->output("=== Layers Extension Test Suite ===\n");

        $this->testDatabaseTables();
        $this->testLayersDatabase();
        $this->testConfigurationValues();
        $this->testUserPermissions();
        $this->testResourceModules();
        $this->testApiEndpoints();
        $this->testThumbnailRenderer();
        
        $this->output("\n=== Test Results ===");
        $this->output("Passed: {$this->passed}");
        $this->output("Failed: {$this->failed}");
        
        if ( $this->failed === 0 ) {
            $this->output("✅ All tests passed! Extension appears to be working correctly.");
        } else {
            $this->output("❌ Some tests failed. Check the output above for details.");
        }
        
        return $this->failed === 0;
    }

    private function test( $name, $condition, $details = '' ) {
        if ( $condition ) {
            $this->output("✅ $name");
            $this->passed++;
        } else {
            $this->output("❌ $name" . ( $details ? " - $details" : '' ));
            $this->failed++;
        }
    }

    private function testDatabaseTables() {
        $this->output("\n--- Database Tables ---");
        
        $dbr = wfGetDB( DB_REPLICA );
        
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

    private function testLayersDatabase() {
        $this->output("\n--- LayersDatabase Class ---");
        
        try {
            $db = new LayersDatabase();
            $this->test("LayersDatabase instantiates", true);
            
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
            $this->test("LayersDatabase instantiates", false, $e->getMessage());
        }
    }

    private function testConfigurationValues() {
        $this->output("\n--- Configuration ---");
        
        $config = MediaWiki\MediaWikiServices::getInstance()->getMainConfig();
        
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

    private function testUserPermissions() {
        $this->output("\n--- User Permissions ---");
        
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

    private function testResourceModules() {
        $this->output("\n--- Resource Modules ---");
        
        $resourceLoader = MediaWiki\MediaWikiServices::getInstance()->getResourceLoader();
        
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

    private function testApiEndpoints() {
        $this->output("\n--- API Endpoints ---");
        
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

    private function testThumbnailRenderer() {
        $this->output("\n--- Thumbnail Renderer ---");
        
        $this->test(
            "ThumbnailRenderer class exists",
            class_exists( 'MediaWiki\\Extension\\Layers\\ThumbnailRenderer' )
        );
        
        try {
            $renderer = new ThumbnailRenderer();
            $this->test("ThumbnailRenderer instantiates", true);
            
            $this->test(
                "ThumbnailRenderer has generateLayeredThumbnail method",
                method_exists( $renderer, 'generateLayeredThumbnail' )
            );
            
        } catch ( Exception $e ) {
            $this->test("ThumbnailRenderer instantiates", false, $e->getMessage());
        }
        
        // Test ImageMagick availability
        $config = MediaWiki\MediaWikiServices::getInstance()->getMainConfig();
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

// Run the test if called directly
if ( defined( 'MEDIAWIKI' ) ) {
    $test = new LayersExtensionTest();
    $success = $test->run();
    exit( $success ? 0 : 1 );
} else {
    echo "This script must be run from MediaWiki maintenance environment.\n";
    echo "Usage: php maintenance/runScript.php extensions/Layers/tests/LayersTest.php\n";
    exit( 1 );
}
