
console.log("Starting test...");
try {
    const CM = require('./resources/ext.layers.editor/CanvasManager.js');
    console.log("CanvasManager loaded successfully");
    console.log("Type:", typeof CM);
} catch (e) {
    console.error("Error loading CanvasManager:", e);
}
