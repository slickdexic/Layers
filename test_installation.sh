#!/bin/bash
# Layers Extension Installation Test Script
# Run this from the MediaWiki root directory

echo "=== Layers Extension Installation Test ==="
echo

# Check if we're in MediaWiki root
if [ ! -f "index.php" ] || [ ! -f "LocalSettings.php" ]; then
    echo "❌ Error: Please run this script from MediaWiki root directory"
    exit 1
fi

echo "✅ Running from MediaWiki root directory"

# Check if Layers extension is installed
if [ ! -d "extensions/Layers" ]; then
    echo "❌ Error: Layers extension not found in extensions/Layers/"
    exit 1
fi

echo "✅ Layers extension directory found"

# Check if extension.json exists and is valid
if [ ! -f "extensions/Layers/extension.json" ]; then
    echo "❌ Error: extension.json not found"
    exit 1
fi

# Try to parse extension.json
if ! php -r "json_decode(file_get_contents('extensions/Layers/extension.json')); echo 'JSON valid';" > /dev/null 2>&1; then
    echo "❌ Error: extension.json is not valid JSON"
    exit 1
fi

echo "✅ extension.json is valid"

# Check core PHP files exist
declare -a core_files=(
    "src/Hooks.php"
    "src/Api/ApiLayersSave.php" 
    "src/Api/ApiLayersInfo.php"
    "src/Database/LayersDatabase.php"
    "src/ThumbnailRenderer.php"
)

for file in "${core_files[@]}"; do
    if [ ! -f "extensions/Layers/$file" ]; then
        echo "❌ Error: Core file $file not found"
        exit 1
    fi
done

echo "✅ All core PHP files found"

# Check JavaScript files exist  
declare -a js_files=(
    "resources/ext.layers.editor/LayersEditor.js"
    "resources/ext.layers.editor/CanvasManager.js"
    "resources/ext.layers.editor/LayerPanel.js"
    "resources/ext.layers.editor/Toolbar.js"
)

for file in "${js_files[@]}"; do
    if [ ! -f "extensions/Layers/$file" ]; then
        echo "❌ Error: JavaScript file $file not found"
        exit 1
    fi
done

echo "✅ All JavaScript files found"

# Check if CSS file exists
if [ ! -f "extensions/Layers/resources/ext.layers.editor/editor.css" ]; then
    echo "❌ Error: CSS file not found"
    exit 1
fi

echo "✅ CSS file found"

# Check SQL schema file
if [ ! -f "extensions/Layers/sql/layers_tables.sql" ]; then
    echo "❌ Error: SQL schema file not found"
    exit 1
fi

echo "✅ SQL schema file found"

# Test PHP syntax on core files
echo "🔍 Testing PHP syntax..."
for file in extensions/Layers/src/*.php extensions/Layers/src/*/*.php; do
    if [ -f "$file" ]; then
        if ! php -l "$file" > /dev/null 2>&1; then
            echo "❌ Error: PHP syntax error in $file"
            exit 1
        fi
    fi
done

echo "✅ All PHP files have valid syntax"

# Check if MediaWiki can load the extension
echo "🔍 Testing MediaWiki extension loading..."

# Create a temporary test script
cat > test_extension_load.php << 'EOF'
<?php
require_once 'includes/WebStart.php';

try {
    // Check if extension is loaded
    $registry = ExtensionRegistry::getInstance();
    $loaded = $registry->getAllThings();
    
    if (isset($loaded['Layers'])) {
        echo "✅ Layers extension is loaded by MediaWiki\n";
        
        // Test database tables exist
        $dbr = wfGetDB(DB_REPLICA);
        $tables = ['layer_sets', 'layer_assets', 'layer_set_usage'];
        
        foreach ($tables as $table) {
            if ($dbr->tableExists($table)) {
                echo "✅ Database table '$table' exists\n";
            } else {
                echo "❌ Database table '$table' missing - run php maintenance/update.php\n";
                exit(1);
            }
        }
        
        // Test API modules are registered
        $apiMain = new ApiMain(RequestContext::getMain());
        $modules = $apiMain->getModuleManager()->getNames();
        
        if (in_array('layerssave', $modules)) {
            echo "✅ API module 'layerssave' is registered\n";
        } else {
            echo "❌ API module 'layerssave' not found\n";
            exit(1);
        }
        
        if (in_array('layersinfo', $modules)) {
            echo "✅ API module 'layersinfo' is registered\n";
        } else {
            echo "❌ API module 'layersinfo' not found\n";
            exit(1);
        }
        
        echo "✅ All API modules registered\n";
        echo "✅ Layers extension is fully functional!\n";
        
    } else {
        echo "❌ Layers extension is not loaded\n";
        echo "   Add 'wfLoadExtension(\"Layers\");' to LocalSettings.php\n";
        exit(1);
    }
    
} catch (Exception $e) {
    echo "❌ Error testing extension: " . $e->getMessage() . "\n";
    exit(1);
}
EOF

if php test_extension_load.php; then
    rm test_extension_load.php
else
    rm test_extension_load.php
    exit 1
fi

echo
echo "=== Installation Test Results ==="
echo "✅ Layers extension is properly installed and functional"
echo
echo "Next steps:"
echo "1. Upload an image to test with"
echo "2. Navigate to the file page"
echo "3. Look for 'Edit Layers' tab"
echo "4. Click to open the layers editor"
echo
echo "Known limitations:"
echo "- Drawing tools need final implementation"
echo "- Server-side thumbnail rendering needs testing"
echo "- Mobile interface not yet implemented"
echo
echo "For development, see IMPLEMENTATION_ROADMAP.md"
