<?php
/**
 * Simple verification script to check if Layers extension is properly set up
 * Run this as: php verify-layers-installation.php from the extension directory
 * phpcs:disable MediaWiki.Usage.ForbiddenFunctions.exec,Generic.WhiteSpace
 */

echo "Layers Extension Installation Verification\n";
echo "==========================================\n\n";

$errors = 0;

// Check 1: Extension files exist
echo "1. Checking extension files...\n";
$requiredFiles = [
    'extension.json',
    'src/Hooks.php',
    'src/Hooks/UIHooks.php',
    'src/Hooks/WikitextHooks.php',
    'resources/ext.layers/init.js',
    'resources/ext.layers/LayersViewer.js',
    'i18n/en.json'
];

foreach ( $requiredFiles as $file ) {
    if ( file_exists( $file ) ) {
        echo "   ✅ $file exists\n";
    } else {
        echo "   ❌ $file is missing\n";
        $errors++;
    }
}

// Check 2: Extension.json syntax
echo "\n2. Checking extension.json syntax...\n";
if ( file_exists( 'extension.json' ) ) {
    $json = file_get_contents( 'extension.json' );
    $data = json_decode( $json, true );
    if ( $data === null ) {
        echo "   ❌ extension.json has invalid JSON syntax\n";
        $errors++;
    } else {
        echo "   ✅ extension.json is valid JSON\n";

        // Check key fields
        if ( isset( $data['name'] ) && $data['name'] === 'Layers' ) {
            echo "   ✅ Extension name is correct\n";
        } else {
            echo "   ❌ Extension name is incorrect or missing\n";
            $errors++;
        }

        if ( isset( $data['GroupPermissions']['user']['editlayers'] ) && $data['GroupPermissions']['user']['editlayers'] === true ) {
            echo "   ✅ User group has editlayers permission\n";
        } else {
            echo "   ❌ User group missing editlayers permission\n";
            $errors++;
        }

        if ( isset( $data['Hooks']['SkinTemplateNavigation'] ) ) {
            echo "   ✅ SkinTemplateNavigation hook registered\n";
        } else {
            echo "   ❌ SkinTemplateNavigation hook not registered\n";
            $errors++;
        }
    }
}

// Check 3: PHP syntax
echo "\n3. Checking PHP syntax...\n";
$phpFiles = [
    'src/Hooks.php',
    'src/Hooks/UIHooks.php',
    'src/Hooks/WikitextHooks.php'
];

foreach ( $phpFiles as $file ) {
    if ( file_exists( $file ) ) {
        $output = [];
        $return = 0;
        exec( "php -l $file 2>&1", $output, $return );
        if ( $return === 0 ) {
            echo "   ✅ $file syntax OK\n";
        } else {
            echo "   ❌ $file has syntax errors:\n";
            echo "      " . implode( "\n      ", $output ) . "\n";
            $errors++;
        }
    }
}

// Check 4: JavaScript syntax (basic check)
echo "\n4. Checking JavaScript files...\n";
$jsFiles = [
    'resources/ext.layers/init.js',
    'resources/ext.layers/LayersViewer.js'
];

foreach ( $jsFiles as $file ) {
    if ( file_exists( $file ) ) {
        $content = file_get_contents( $file );
        // Basic check for common syntax issues
        if ( strpos( $content, 'mw.layers' ) !== false || strpos( $content, 'LayersViewer' ) !== false ) {
            echo "   ✅ $file contains expected code\n";
        } else {
            echo "   ⚠️  $file may have issues (no expected patterns found)\n";
        }
    }
}

// Check 5: Message files
echo "\n5. Checking message files...\n";
if ( file_exists( 'i18n/en.json' ) ) {
    $messages = json_decode( file_get_contents( 'i18n/en.json' ), true );
    if ( isset( $messages['layers-editor-title'] ) ) {
        echo "   ✅ Required messages exist\n";
    } else {
        echo "   ❌ Required messages missing\n";
        $errors++;
    }
} else {
    echo "   ❌ i18n/en.json not found\n";
    $errors++;
}

// Summary
echo "\n==========================================\n";
if ( $errors === 0 ) {
    echo "🎉 All checks passed! Extension files are properly set up.\n\n";
    echo "Next steps:\n";
    echo "1. Ensure wfLoadExtension('Layers'); is in LocalSettings.php\n";
    echo "2. Run php maintenance/update.php from MediaWiki root\n";
    echo "3. Check a File page for the 'Edit Layers' tab\n";
} else {
    echo "❌ Found $errors error(s). Please fix these issues before proceeding.\n";
}

echo "\nFor MediaWiki integration issues, check:\n";
echo "- MediaWiki error logs\n";
echo "- Browser JavaScript console\n";
echo "- Special:Version (should list Layers extension)\n";
