<?php
/**
 * Test parameter flow to understand why layers=all doesn't work
 */

// Create a simple page to test parameter parsing
echo "<html><head><title>Test Parameter Flow</title></head><body>";
echo "<h2>Testing MediaWiki Parameter Flow</h2>";

// Test 1: Direct check if hooks are even called
echo "<h3>Test 1: Basic File Link</h3>";
echo "<p>Normal file link: [[File:ImageTest02.jpg|300px]]</p>";

// Test 2: With layers parameter
echo "<h3>Test 2: File Link with layers=all</h3>";
echo "<p>With layers: [[File:ImageTest02.jpg|300px|layers=all]]</p>";

echo "<h3>What to check:</h3>";
echo "<ol>";
echo "<li>Are ParserMakeImageParams hooks being called?</li>";
echo "<li>Are parameters being passed correctly?</li>";
echo "<li>Is BitmapHandlerTransform being triggered?</li>";
echo "<li>Are there any MediaWiki configuration issues?</li>";
echo "</ol>";

echo "<h3>Debug Information:</h3>";
echo "<p>Check your MediaWiki debug logs for messages starting with 'Layers:'</p>";
echo "<p>Error logging destination: " . ( ini_get( 'error_log' ) ?: 'stdout/stderr' ) . "</p>";

echo "</body></html>";
