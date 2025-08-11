<?php
// Test if Layers extension is loaded properly
// Call this via http://localhost:8080/extensions/Layers/debug_mw.php

// Basic MediaWiki bootstrap
require_once('/var/www/html/includes/WebStart.php');

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Layers Extension Debug</title>
    <style>
        body { font-family: monospace; padding: 20px; }
        .good { color: green; }
        .bad { color: red; }
        .info { color: blue; }
    </style>
</head>
<body>
    <h1>Layers Extension Debug</h1>
    
    <?php
    echo "<h2>Extension Status</h2>\n";
    
    // Check if extension is loaded
    global $wgResourceModules;
    if (isset($wgResourceModules['ext.layers.editor'])) {
        echo "<p class='good'>✓ ext.layers.editor module is registered</p>\n";
        $module = $wgResourceModules['ext.layers.editor'];
        echo "<p class='info'>Scripts: " . implode(', ', $module['scripts'] ?? []) . "</p>\n";
        echo "<p class='info'>Dependencies: " . implode(', ', $module['dependencies'] ?? []) . "</p>\n";
    } else {
        echo "<p class='bad'>✗ ext.layers.editor module is NOT registered</p>\n";
    }
    
    // Check actions
    global $wgActions;
    if (isset($wgActions['editlayers'])) {
        echo "<p class='good'>✓ editlayers action is registered</p>\n";
    } else {
        echo "<p class='bad'>✗ editlayers action is NOT registered</p>\n";
    }
    
    // Check config
    global $wgLayersEnable;
    echo "<p class='info'>LayersEnable: " . ($wgLayersEnable ? 'true' : 'false') . "</p>\n";
    
    // Test ResourceLoader
    echo "<h2>ResourceLoader Test</h2>\n";
    echo "<p><a href='/load.php?modules=ext.layers.editor&only=scripts&debug=1' target='_blank'>View ext.layers.editor scripts</a></p>\n";
    echo "<p><a href='/load.php?modules=ext.layers.editor&only=styles&debug=1' target='_blank'>View ext.layers.editor styles</a></p>\n";
    
    // Test direct file access
    echo "<h2>Direct File Access Test</h2>\n";
    $files = [
        'LayersEditor.js',
        'CanvasManager.js', 
        'LayerPanel.js',
        'Toolbar.js'
    ];
    
    foreach ($files as $file) {
        $path = "/var/www/html/extensions/Layers/resources/ext.layers.editor/$file";
        if (file_exists($path)) {
            echo "<p class='good'>✓ $file exists</p>\n";
            echo "<p><a href='/extensions/Layers/resources/ext.layers.editor/$file' target='_blank'>View $file</a></p>\n";
        } else {
            echo "<p class='bad'>✗ $file missing</p>\n";
        }
    }
    ?>
    
    <h2>Manual Editor Test</h2>
    <button onclick="testEditor()">Test Editor Loading</button>
    <div id="test-output"></div>
    <div id="editor-test" style="width: 100%; height: 400px; border: 1px solid #ccc; margin-top: 10px;"></div>
    
    <script>
        function log(msg, type = 'info') {
            const output = document.getElementById('test-output');
            const div = document.createElement('div');
            div.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue';
            div.textContent = new Date().toLocaleTimeString() + ': ' + msg;
            output.appendChild(div);
        }
        
        async function testEditor() {
            log('Starting editor test...');
            
            // Load ResourceLoader module
            try {
                if (window.mw && mw.loader) {
                    log('Using MediaWiki ResourceLoader...');
                    
                    mw.loader.using('ext.layers.editor').done(function() {
                        log('ResourceLoader module loaded successfully', 'success');
                        
                        // Check if classes are available
                        log('CanvasManager available: ' + !!window.CanvasManager);
                        log('LayerPanel available: ' + !!window.LayerPanel);
                        log('Toolbar available: ' + !!window.Toolbar);
                        log('LayersEditor available: ' + !!window.LayersEditor);
                        
                        if (window.LayersEditor) {
                            try {
                                // Mock mw.config for testing
                                if (!mw.config.get('wgLayersEditorInit')) {
                                    mw.config.set('wgLayersEditorInit', {
                                        filename: 'TestImage.jpg',
                                        imageUrl: '/images/TestImage.jpg'
                                    });
                                }
                                
                                log('Attempting to create LayersEditor instance...', 'info');
                                const editor = new window.LayersEditor({
                                    filename: 'TestImage.jpg',
                                    imageUrl: '/images/TestImage.jpg',
                                    container: document.getElementById('editor-test')
                                });
                                log('LayersEditor created successfully!', 'success');
                            } catch (error) {
                                log('Error creating LayersEditor: ' + error.message, 'error');
                                console.error(error);
                            }
                        }
                    }).fail(function(error) {
                        log('ResourceLoader failed: ' + error, 'error');
                    });
                } else {
                    log('MediaWiki ResourceLoader not available', 'error');
                }
            } catch (error) {
                log('Error: ' + error.message, 'error');
            }
        }
    </script>
</body>
</html>
