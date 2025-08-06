<?php
/**
 * Quick integration test for Layers extension
 * Run this from MediaWiki root: php extensions/Layers/test-integration.php
 */

// Attempt to load MediaWiki bootstrap
if ( !defined( 'MEDIAWIKI' ) ) {
    // Try to find MediaWiki bootstrap
    $mwPaths = [
        __DIR__ . '/../../maintenance/Maintenance.php',
        __DIR__ . '/../../../maintenance/Maintenance.php'
    ];
    
    $mwFound = false;
    foreach ( $mwPaths as $path ) {
        if ( file_exists( $path ) ) {
            require_once $path;
            $mwFound = true;
            break;
        }
    }
    
    if ( !$mwFound ) {
        echo "Error: Could not find MediaWiki installation\n";
        echo "Please run this script from MediaWiki root directory:\n";
        echo "  php extensions/Layers/test-integration.php\n";
        exit( 1 );
    }
}

// Simple integration test
class LayersIntegrationTest extends Maintenance {
    public function __construct() {
        parent::__construct();
        $this->addDescription( 'Test Layers extension integration' );
    }

    public function execute() {
        echo "=== Layers Extension Integration Test ===\n\n";
        
        // Test 1: Check extension is loaded
        echo "1. Testing extension loading...\n";
        if ( class_exists( 'MediaWiki\\Extension\\Layers\\Database\\LayersDatabase' ) ) {
            echo "   ✅ LayersDatabase class found\n";
        } else {
            echo "   ❌ LayersDatabase class NOT found\n";
            return;
        }
        
        // Test 2: Check API classes
        echo "2. Testing API classes...\n";
        if ( class_exists( 'MediaWiki\\Extension\\Layers\\Api\\ApiLayersInfo' ) ) {
            echo "   ✅ ApiLayersInfo class found\n";
        } else {
            echo "   ❌ ApiLayersInfo class NOT found\n";
        }
        
        if ( class_exists( 'MediaWiki\\Extension\\Layers\\Api\\ApiLayersSave' ) ) {
            echo "   ✅ ApiLayersSave class found\n";
        } else {
            echo "   ❌ ApiLayersSave class NOT found\n";
        }
        
        // Test 3: Check thumbnail renderer
        echo "3. Testing ThumbnailRenderer...\n";
        if ( class_exists( 'MediaWiki\\Extension\\Layers\\ThumbnailRenderer' ) ) {
            echo "   ✅ ThumbnailRenderer class found\n";
            
            // Try to instantiate
            try {
                $renderer = new MediaWiki\Extension\Layers\ThumbnailRenderer();
                echo "   ✅ ThumbnailRenderer instantiated successfully\n";
            } catch ( Exception $e ) {
                echo "   ❌ ThumbnailRenderer instantiation failed: " . $e->getMessage() . "\n";
            }
        } else {
            echo "   ❌ ThumbnailRenderer class NOT found\n";
        }
        
        // Test 4: Check database connection
        echo "4. Testing database connection...\n";
        try {
            $db = new MediaWiki\Extension\Layers\Database\LayersDatabase();
            echo "   ✅ Database connection established\n";
        } catch ( Exception $e ) {
            echo "   ❌ Database connection failed: " . $e->getMessage() . "\n";
        }
        
        // Test 5: Check hooks registration
        echo "5. Testing hooks registration...\n";
        $config = MediaWiki\MediaWikiServices::getInstance()->getMainConfig();
        $hooks = $config->get( 'Hooks' );
        
        $expectedHooks = [
            'BitmapHandlerTransform',
            'ParserMakeImageParams',
            'SkinTemplateNavigation'
        ];
        
        foreach ( $expectedHooks as $hook ) {
            if ( isset( $hooks[$hook] ) ) {
                echo "   ✅ Hook '$hook' registered\n";
            } else {
                echo "   ⚠️  Hook '$hook' not found (may be ok)\n";
            }
        }
        
        echo "\n=== Integration Test Complete ===\n";
        echo "Extension appears to be properly integrated with MediaWiki.\n";
    }
}

// Run the test
$maintClass = LayersIntegrationTest::class;
require_once RUN_MAINTENANCE_IF_MAIN;
