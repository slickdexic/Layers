#!/bin/bash

# Simple test script to verify Layers extension loads
# Run from MediaWiki root directory

echo "=== Layers Extension Loading Test ==="
echo

# Test 1: Check if extension files exist
echo "Testing file structure..."
if [ -f "extensions/Layers/extension.json" ]; then
    echo "✅ extension.json found"
else
    echo "❌ extension.json missing"
    exit 1
fi

if [ -f "extensions/Layers/src/Hooks.php" ]; then
    echo "✅ Hooks.php found"
else
    echo "❌ Hooks.php missing"
    exit 1
fi

# Test 2: Check if extension can be loaded (basic syntax check)
echo
echo "Testing PHP syntax..."
php -l extensions/Layers/src/Hooks.php
if [ $? -eq 0 ]; then
    echo "✅ Hooks.php syntax OK"
else
    echo "❌ Hooks.php syntax error"
    exit 1
fi

# Test 3: Try to get extension info
echo
echo "Testing MediaWiki extension loading..."
php maintenance/showJobs.php --group > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ MediaWiki loads without fatal errors"
else
    echo "❌ MediaWiki loading error - check logs"
    exit 1
fi

# Test 4: Check if extension is listed
echo
echo "Checking extension registration..."
php -r "
require_once 'includes/WebStart.php';
if (class_exists('MediaWiki\\Extension\\Layers\\Hooks')) {
    echo '✅ Layers extension class loaded\n';
} else {
    echo '❌ Layers extension class not found\n';
    exit(1);
}
"

echo
echo "=== Basic loading test completed successfully ==="
echo "Next steps:"
echo "1. Visit Special:Version to see if Layers is listed"
echo "2. Go to any File: page to check for 'Edit Layers' tab"
echo "3. Run: php maintenance/update.php (to create database tables)"
