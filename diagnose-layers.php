<?php
/**
 * Diagnostic script for the Layers MediaWiki extension
 * Run from MediaWiki root directory: php extensions/Layers/diagnose-layers.php
 */

// Ensure we're running from MediaWiki root
if ( !file_exists( './includes/WebStart.php' ) && !file_exists( './maintenance/Maintenance.php' ) ) {
	echo "Error: This script must be run from the MediaWiki root directory.\n";
	echo "Usage: php extensions/Layers/diagnose-layers.php\n";
	exit( 1 );
}

// Bootstrap MediaWiki
$IP = getcwd();
require_once "$IP/maintenance/Maintenance.php";

class LayersDiagnostic extends Maintenance {

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Diagnose Layers extension installation and configuration' );
		$this->addOption( 'fix', 'Attempt to fix common issues automatically', false, false );
		$this->addOption( 'verbose', 'Show verbose output', false, false );
	}

	public function execute() {
		$this->output( "Layers Extension Diagnostic Tool\n" );
		$this->output( "================================\n\n" );

		$fixes = $this->hasOption( 'fix' );
		$verbose = $this->hasOption( 'verbose' );
		$issues = 0;

		// 1. Check if extension is loaded
		$this->output( "1. Checking extension loading...\n" );
		if ( !ExtensionRegistry::getInstance()->isLoaded( 'Layers' ) ) {
			$this->output( "   ❌ FAILED: Layers extension is not loaded\n" );
			$this->output( "   💡 FIX: Add wfLoadExtension('Layers'); to LocalSettings.php\n\n" );
			$issues++;
		} else {
			$this->output( "   ✅ PASS: Layers extension is loaded\n\n" );
		}

		// 2. Check configuration
		$this->output( "2. Checking configuration...\n" );
		global $wgLayersEnable;
		if ( !isset( $wgLayersEnable ) || !$wgLayersEnable ) {
			$this->output( "   ⚠️  WARNING: LayersEnable is not set to true\n" );
			$this->output( "   💡 FIX: Add \$wgLayersEnable = true; to LocalSettings.php\n" );
			$issues++;
		} else {
			$this->output( "   ✅ PASS: LayersEnable is set to true\n" );
		}

		// 3. Check database tables
		$this->output( "\n3. Checking database tables...\n" );
		$db = $this->getDB( DB_REPLICA );
		$tables = [
			'layer_sets' => 'Main layer storage table',
			'layer_assets' => 'Layer assets table',
			'layer_set_usage' => 'Layer usage tracking table'
		];

		foreach ( $tables as $table => $description ) {
			if ( !$db->tableExists( $table ) ) {
				$this->output( "   ❌ FAILED: Table '$table' does not exist ($description)\n" );
				if ( $fixes ) {
					$this->output( "   🔧 FIXING: Running database update...\n" );
					$this->runUpdateScript();
				} else {
					$this->output( "   💡 FIX: Run 'php maintenance/update.php' from MediaWiki root\n" );
				}
				$issues++;
			} else {
				$this->output( "   ✅ PASS: Table '$table' exists\n" );
			}
		}

		// 4. Check user permissions
		$this->output( "\n4. Checking user permissions...\n" );
		global $wgGroupPermissions;
		
		if ( !isset( $wgGroupPermissions['user']['editlayers'] ) || !$wgGroupPermissions['user']['editlayers'] ) {
			$this->output( "   ❌ FAILED: 'user' group does not have 'editlayers' permission\n" );
			$this->output( "   💡 FIX: Extension.json should automatically grant this, check LocalSettings.php\n" );
			$issues++;
		} else {
			$this->output( "   ✅ PASS: 'user' group has 'editlayers' permission\n" );
		}

		// 5. Check ResourceLoader modules
		$this->output( "\n5. Checking ResourceLoader modules...\n" );
		$resourceLoader = MediaWiki\MediaWikiServices::getInstance()->getResourceLoader();
		
		$modules = [
			'ext.layers' => 'Layers viewer module',
			'ext.layers.editor' => 'Layers editor module'
		];

		foreach ( $modules as $module => $description ) {
			try {
				$moduleObj = $resourceLoader->getModule( $module );
				if ( !$moduleObj ) {
					$this->output( "   ❌ FAILED: Module '$module' not registered ($description)\n" );
					$issues++;
				} else {
					$this->output( "   ✅ PASS: Module '$module' is registered\n" );
				}
			} catch ( Exception $e ) {
				$this->output( "   ❌ FAILED: Module '$module' error: " . $e->getMessage() . "\n" );
				$issues++;
			}
		}

		// 6. Check hook handlers
		$this->output( "\n6. Checking hook handlers...\n" );
		$hooks = [
			'BeforePageDisplay',
			'SkinTemplateNavigation',
			'SkinTemplateNavigation__Universal',
			'ThumbnailBeforeProduceHTML',
			'ParserMakeImageParams'
		];

		global $wgHooks;
		foreach ( $hooks as $hook ) {
			if ( !isset( $wgHooks[$hook] ) || empty( $wgHooks[$hook] ) ) {
				$this->output( "   ❌ FAILED: Hook '$hook' is not registered\n" );
				$issues++;
			} else {
				$this->output( "   ✅ PASS: Hook '$hook' is registered\n" );
				if ( $verbose ) {
					$this->output( "        Handlers: " . implode( ', ', array_map( function( $h ) {
						return is_array( $h ) ? implode( '::', $h ) : (string)$h;
					}, $wgHooks[$hook] ) ) . "\n" );
				}
			}
		}

		// 7. Test file lookup
		$this->output( "\n7. Testing file lookup...\n" );
		try {
			$repo = MediaWiki\MediaWikiServices::getInstance()->getRepoGroup();
			$testFiles = [ 'Example.jpg', 'Example.png', 'Test.jpg' ];
			$foundFile = null;
			
			foreach ( $testFiles as $testFile ) {
				$file = $repo->findFile( $testFile );
				if ( $file && $file->exists() ) {
					$foundFile = $file;
					break;
				}
			}
			
			if ( $foundFile ) {
				$this->output( "   ✅ PASS: Found test file: " . $foundFile->getName() . "\n" );
				
				// Test creating a layer
				if ( class_exists( 'MediaWiki\\Extension\\Layers\\Database\\LayersDatabase' ) ) {
					$this->output( "   ✅ PASS: LayersDatabase class is available\n" );
					
					// Check for existing layers
					try {
						$db = new MediaWiki\Extension\Layers\Database\LayersDatabase();
						$layers = $db->getLayerSetsForImage( $foundFile->getName(), $foundFile->getSha1() );
						$this->output( "   ℹ️  INFO: Found " . count( $layers ) . " layer sets for this image\n" );
					} catch ( Exception $e ) {
						$this->output( "   ❌ FAILED: Error checking layers: " . $e->getMessage() . "\n" );
						$issues++;
					}
				} else {
					$this->output( "   ❌ FAILED: LayersDatabase class not found\n" );
					$issues++;
				}
			} else {
				$this->output( "   ⚠️  WARNING: No test files found in repo\n" );
				$this->output( "   💡 FIX: Upload a test image to verify layer functionality\n" );
			}
		} catch ( Exception $e ) {
			$this->output( "   ❌ FAILED: Error accessing file repo: " . $e->getMessage() . "\n" );
			$issues++;
		}

		// 8. Test API endpoints
		$this->output( "\n8. Checking API modules...\n" );
		try {
			$apiMain = new ApiMain();
			$moduleManager = $apiMain->getModuleManager();
			
			$apiModules = [ 'layersinfo', 'layerssave' ];
			foreach ( $apiModules as $module ) {
				if ( $moduleManager->moduleExists( $module ) ) {
					$this->output( "   ✅ PASS: API module '$module' is registered\n" );
				} else {
					$this->output( "   ❌ FAILED: API module '$module' is not registered\n" );
					$issues++;
				}
			}
		} catch ( Exception $e ) {
			$this->output( "   ❌ FAILED: Error checking API modules: " . $e->getMessage() . "\n" );
			$issues++;
		}

		// Summary
		$this->output( "\n" . str_repeat( "=", 50 ) . "\n" );
		if ( $issues === 0 ) {
			$this->output( "🎉 SUCCESS: All checks passed! The Layers extension appears to be working correctly.\n" );
		} else {
			$this->output( "⚠️  ISSUES FOUND: $issues problems detected.\n" );
			if ( !$fixes ) {
				$this->output( "💡 TIP: Run with --fix to attempt automatic repairs.\n" );
			}
		}

		$this->output( "\nNext steps:\n" );
		$this->output( "1. Navigate to a File page (e.g., File:Example.jpg)\n" );
		$this->output( "2. Look for the 'Edit Layers' tab\n" );
		$this->output( "3. Test image display with [[File:Example.jpg|layers=all]]\n" );
		$this->output( "\nIf issues persist, check the MediaWiki debug log for errors.\n" );
		
		return $issues === 0;
	}

	private function runUpdateScript() {
		try {
			$this->output( "   Running maintenance script...\n" );
			$maintenance = new UpdateMediaWiki();
			$maintenance->execute();
			$this->output( "   ✅ Database update completed\n" );
		} catch ( Exception $e ) {
			$this->output( "   ❌ Database update failed: " . $e->getMessage() . "\n" );
		}
	}
}

$maintClass = LayersDiagnostic::class;
require_once RUN_MAINTENANCE_IF_MAIN;
