# Project: God Class Reduction Initiative

**Project Start:** January 29, 2026  
**Target Completion:** Q1 2026  
**Owner:** Lead Engineer  
**Status:** 🟢 ACTIVE

---

## Executive Summary

This initiative addresses the primary architectural debt identified in the v47
codebase review: **20 hand-written JavaScript files exceeding 1,000 lines**. 
These "god classes" increase cognitive load, reduce testability, and create 
maintenance challenges. This project will reduce the count to **≤12** through
strategic extraction of cohesive modules.

### Goals

1. **Reduce god class count** from 20 to ≤12 (40% reduction)
2. **Improve testability** — extracted modules will be independently testable
3. **Reduce cognitive load** — each file should have a single responsibility
4. **Maintain 100% backward compatibility** — no public API changes
5. **Maintain test coverage** — 95%+ statement coverage throughout

### Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| JS god classes (hand-written) | 20 | ≤12 | 🟡 In Progress |
| Test coverage | 95.85% | ≥95% | ✅ Maintained |
| All tests passing | 10,860 | 10,860+ | ✅ Maintained |
| ESLint errors | 0 | 0 | ✅ Maintained |

---

## Phase Overview

| Phase | Target File | Lines | Extraction Strategy | Priority |
|-------|-------------|-------|---------------------|----------|
| **1** | InlineTextEditor.js | 2,282 | Extract RichTextToolbar, FormattingEngine | HIGH |
| **2** | ViewerManager.js | 2,026 | Extract SlideRenderer, ViewerState | HIGH |
| **3** | APIManager.js | 1,523 | Extract RetryManager, RequestQueue | MEDIUM |
| **4** | TextBoxRenderer.js | 1,117 | Extract RichTextMeasurement | MEDIUM |
| **5** | CalloutRenderer.js | 1,289 | Extract TailCalculator | LOW |
| **6** | ArrowRenderer.js | 1,310 | Extract CurvedArrowCalculator | LOW |

### Files Already Well-Delegated (No Action Needed)

These files are large but use proper delegation patterns:

- **CanvasManager.js** (1,981 lines) — Facade delegating to 10+ controllers
- **LayerPanel.js** (1,806 lines) — Delegates to 9 specialized controllers
- **SelectionManager.js** (1,426 lines) — Clean module separation
- **Toolbar.js** (1,652 lines) — Facade with ToolbarKeyboard, ToolbarStyleControls
- **LayersEditor.js** (1,847 lines) — Main entry point with clear responsibilities

---

## Phase 1: InlineTextEditor Extraction

**Target:** Reduce InlineTextEditor.js from 2,282 lines to ~1,400 lines  
**Timeline:** 3-5 days  
**Status:** 🟢 ACTIVE

### Current Structure Analysis

```
InlineTextEditor.js (2,282 lines)
├── Constructor & Core (~300 lines)
│   ├── constructor(), destroy()
│   ├── canEdit(), startEditing(), finishEditing()
│   └── cancelEditing(), isActive(), getEditingLayer()
│
├── Editor Element Management (~400 lines)
│   ├── _createEditorElement(), _positionEditorElement()
│   ├── _applyLayerStyle(), _handleInput()
│   └── _handleKeyDown(), _handleBlur()
│
├── Toolbar Management (~500 lines) ← EXTRACT TO RichTextToolbar
│   ├── _createToolbar(), _removeToolbar(), _positionToolbar()
│   ├── _createFontSelect(), _createFontSizeInput()
│   ├── _createFormatButton(), _createAlignButton()
│   ├── _createColorPicker(), _createHighlightButton()
│   └── _setupToolbarDrag(), _handleToolbarDrag()
│
├── Format Application (~400 lines) ← EXTRACT TO FormattingEngine
│   ├── _applyFormat(), _applyFormatToSelection()
│   ├── _syncPropertiesPanel()
│   └── _updateToolbarState()
│
├── Rich Text Conversion (~500 lines) ← EXTRACT TO RichTextConverter
│   ├── _richTextToHtml(), _htmlToRichText()
│   ├── _parseHtmlNode(), _mergeAdjacentRuns()
│   ├── _escapeHtml(), _getPlainTextFromEditor()
│   └── Selection preservation (_saveSelection, _restoreSelection)
│
└── Utilities (~180 lines)
    ├── _measureTextWidth(), _getContainer()
    ├── _msg(), _isMultilineType()
    └── Debug helpers
```

### Extraction Plan

#### 1.1 Extract RichTextToolbar (~500 lines)

Create `resources/ext.layers.editor/canvas/RichTextToolbar.js`:

```javascript
class RichTextToolbar {
    constructor(inlineTextEditor, options) {
        this._editor = inlineTextEditor;
        this._container = options.container;
        this._toolbarElement = null;
        this._isDragging = false;
    }
    
    create(layer) { /* _createToolbar logic */ }
    remove() { /* _removeToolbar logic */ }
    position() { /* _positionToolbar logic */ }
    updateState(layer) { /* _updateToolbarState logic */ }
    
    // Private builders
    _createFontSelect() { }
    _createFontSizeInput() { }
    _createFormatButton(format, icon) { }
    _createAlignButton(alignment, icon) { }
    _createColorPicker(options) { }
    _createHighlightButton() { }
    _createSeparator() { }
    
    // Drag handling
    _setupDrag() { }
    _handleDrag(e) { }
    _stopDrag() { }
}
```

#### 1.2 Extract RichTextConverter (~350 lines)

Create `resources/ext.layers.editor/canvas/RichTextConverter.js`:

```javascript
class RichTextConverter {
    static htmlToRichText(html) { }
    static richTextToHtml(richText) { }
    static mergeAdjacentRuns(runs) { }
    static escapeHtml(text) { }
    static getPlainText(html) { }
    static parseHtmlNode(node) { }
}
```

#### 1.3 Extract FormattingEngine (~250 lines)

Create `resources/ext.layers.editor/canvas/FormattingEngine.js`:

```javascript
class FormattingEngine {
    constructor(options) {
        this._displayScale = options.displayScale || 1;
    }
    
    applyToSelection(property, value) { }
    applyToLayer(layer, property, value) { }
    
    saveSelection() { }
    restoreSelection() { }
    clearSavedSelection() { }
}
```

### Post-Extraction InlineTextEditor (~1,200 lines)

```javascript
class InlineTextEditor {
    constructor(canvasManager) {
        this._canvasManager = canvasManager;
        this._toolbar = null;  // RichTextToolbar instance
        this._formatter = null;  // FormattingEngine instance
        // ... core state only
    }
    
    startEditing(layer) {
        this._toolbar = new RichTextToolbar(this, { container });
        this._formatter = new FormattingEngine({ displayScale });
        this._toolbar.create(layer);
        // ... minimal delegation
    }
    
    _applyFormat(property, value) {
        if (this._isRichTextMode) {
            this._formatter.applyToSelection(property, value);
        } else {
            this._formatter.applyToLayer(this.editingLayer, property, value);
        }
        this._toolbar.updateState(this.editingLayer);
        this._syncPropertiesPanel();
    }
}
```

### Definition of Done

- [ ] RichTextToolbar.js created and tested (≥90% coverage)
- [ ] RichTextConverter.js created and tested (≥95% coverage)
- [ ] FormattingEngine.js created and tested (≥90% coverage)
- [ ] InlineTextEditor.js reduced to <1,400 lines
- [ ] All 10,860+ tests passing
- [ ] Coverage maintained at ≥95%
- [ ] No public API changes (backward compatible)
- [ ] ESLint clean (0 errors)

---

## Phase 2: ViewerManager Extraction

**Target:** Reduce ViewerManager.js from 2,026 lines to ~1,200 lines  
**Timeline:** 3-5 days  
**Status:** ⏳ PLANNED

### Extraction Plan

1. **ViewerState.js** (~300 lines) — Track viewer instances, active state
2. **SlideRenderer.js** (~400 lines) — Slide mode rendering logic
3. **ImageDimensionCalculator.js** (~200 lines) — Size/position calculations

---

## Phase 3: APIManager Extraction

**Target:** Reduce APIManager.js from 1,523 lines to ~900 lines  
**Timeline:** 2-3 days  
**Status:** ⏳ PLANNED

### Extraction Plan

1. **RetryManager.js** (~200 lines) — Retry logic with exponential backoff
2. **RequestQueue.js** (~250 lines) — Request deduplication and queuing
3. **ResponseNormalizer.js** (~150 lines) — API response normalization

---

## Risk Mitigation

### Risk 1: Breaking Changes

**Mitigation:** All extractied modules will be internal implementation details.
The public API of each parent class remains unchanged.

### Risk 2: Test Coverage Drop

**Mitigation:** Write new tests for extracted modules BEFORE extraction.
Ensure coverage thresholds are met throughout.

### Risk 3: Circular Dependencies

**Mitigation:** Extract to pure utility classes with no imports from parent.
Use dependency injection for callbacks.

---

## Progress Tracking

| Date | Action | Impact |
|------|--------|--------|
| Jan 29, 2026 | Project plan created | Baseline: 20 god classes |
| | | |

---

## Appendix: Current God Class Inventory

*Last updated: January 29, 2026*

| File | Lines | Type | Status |
|------|-------|------|--------|
| InlineTextEditor.js | 2,282 | Controller | 🟢 Phase 1 Target |
| ViewerManager.js | 2,026 | Manager | ⏳ Phase 2 |
| CanvasManager.js | 1,981 | Facade | ✅ Well-delegated |
| Toolbar.js | 1,652 | UI | ✅ Well-delegated |
| LayersEditor.js | 1,847 | Main Entry | ✅ Acceptable |
| LayerPanel.js | 1,806 | UI Controller | ✅ Well-delegated |
| APIManager.js | 1,523 | Service | ⏳ Phase 3 |
| SelectionManager.js | 1,426 | Manager | ✅ Clean separation |
| ArrowRenderer.js | 1,310 | Renderer | ⏳ Phase 6 |
| CalloutRenderer.js | 1,289 | Renderer | ⏳ Phase 5 |
| InlineTextEditor.js | 1,273 | Controller | (duplicate entry?) |
| GroupManager.js | 1,132 | Manager | ⚖️ Borderline |
| CanvasRenderer.js | 1,132 | Renderer | ⚖️ Borderline |
| ToolManager.js | 1,219 | Controller | ⚖️ Borderline |
| TextBoxRenderer.js | 1,117 | Renderer | ⏳ Phase 4 |
| TransformController.js | 1,097 | Controller | ⚖️ Borderline |
| ResizeCalculator.js | 1,090 | Calculator | ⚖️ Borderline |
| PropertyBuilders.js | 1,250 | Builder | ✅ Intentional |
| PropertiesForm.js | 1,006 | UI | ⚖️ Borderline |
| ToolbarStyleControls.js | 1,067 | UI Controller | ⚖️ Borderline |

**Legend:**
- 🟢 Active target for extraction
- ⏳ Planned for future phase
- ✅ Acceptable as-is (good delegation or intentional design)
- ⚖️ Borderline (monitor, refactor if grows further)
