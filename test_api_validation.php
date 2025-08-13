<?php
// Simple test script to debug Layers API save functionality
// Run this from the MediaWiki root directory

require_once 'includes/WebStart.php';

// Test layer data with drop shadow
$testData = [
    [
        'id' => 'test-1',
        'type' => 'text',
        'text' => 'Test Drop Shadow',
        'x' => 100,
        'y' => 100,
        'shadow' => true,
        'shadowColor' => '#000000',
        'shadowBlur' => 5,
        'shadowOffsetX' => 2,
        'shadowOffsetY' => 2,
        'shadowSpread' => 1
    ]
];

echo "Test Data: " . json_encode($testData, JSON_PRETTY_PRINT) . "\n\n";

// Try to directly test the validation function
// We need to access the ApiLayersSave class
$api = new ApiLayersSave(new ApiMain(), 'layerssave');

// Use reflection to call the private method
$reflection = new ReflectionClass($api);
$method = $reflection->getMethod('validateAndSanitizeLayersData');
$method->setAccessible(true);

$result = $method->invoke($api, $testData);

if ($result === false) {
    echo "❌ Validation FAILED\n";
} else {
    echo "✅ Validation PASSED\n";
    echo "Sanitized Data: " . json_encode($result, JSON_PRETTY_PRINT) . "\n";
}
