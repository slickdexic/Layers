# Shape Library Feature Proposal

**Status:** Proposed  
**Author:** Development Team  
**Date:** January 2026  
**Target Version:** 1.5.0

## Executive Summary

Add a built-in shape library with categorized, searchable vector shapes that users can place and customize. This brings the Layers extension closer to professional annotation tools like Figma, Illustrator, and Canva.

## Motivation

Currently, users are limited to basic geometric shapes (rectangle, circle, ellipse, polygon, star). Many annotation tasks require:

- Flowchart symbols (process, decision, data, terminator)
- Directional arrows and connectors
- Callout variations beyond the current single style
- Common symbols (checkmarks, warnings, info icons)
- Decorative elements (banners, badges, ribbons)

## Security Considerations

### The SVG Security Problem

Full SVG files can contain:
- `<script>` tags with executable JavaScript
- Event handlers (`onclick`, `onload`, etc.)
- External references (`<image href="...">`, `<use xlink:href="...">`)
- CSS with `url()` references to external resources
- XML entity expansion attacks (XXE)

### Our Solution: Path Data Only

We store **only** the `d` attribute from SVG `<path>` elements:

```javascript
// What we store - pure geometry, zero attack surface
{
  id: 'chevron-right',
  path: 'M9 18l6-6-6-6',
  viewBox: [0, 0, 24, 24]
}
```

Path data is a string containing only:
- Commands: `M` (move), `L` (line), `C` (cubic bezier), `Q` (quadratic bezier), `A` (arc), `Z` (close)
- Numbers: coordinates and parameters

**This is impossible to exploit** - it's just drawing instructions with no executable content.

### Validation Layer

Despite the inherent safety, we add validation:

```javascript
// Path command whitelist - only these characters allowed
const VALID_PATH_CHARS = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-+eE]+$/;

function validatePathData(path) {
  if (typeof path !== 'string') return false;
  if (path.length > 10000) return false;  // Reasonable limit
  return VALID_PATH_CHARS.test(path);
}
```

## Architecture

### File Structure

```
resources/ext.layers.editor/
├── shapeLibrary/
│   ├── ShapeLibraryData.js        # Shape definitions (paths + metadata)
│   ├── ShapeLibraryManager.js     # Search, filter, category navigation
│   ├── ShapeLibraryPanel.js       # UI component
│   ├── ShapePathValidator.js      # Path validation
│   └── categories/
│       ├── arrows.js              # Arrow shapes
│       ├── callouts.js            # Speech bubbles, callouts
│       ├── flowchart.js           # Process, decision, data, etc.
│       ├── geometric.js           # Triangles, pentagons, hexagons
│       ├── symbols.js             # Check, X, warning, info
│       └── decorative.js          # Banners, ribbons, badges

resources/ext.layers.shared/
├── CustomShapeRenderer.js         # Renders path data to canvas
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `ShapeLibraryData` | Static shape definitions, category hierarchy |
| `ShapeLibraryManager` | Search, filtering, recent shapes, favorites |
| `ShapeLibraryPanel` | UI rendering, user interaction, drag-to-canvas |
| `ShapePathValidator` | Validates path data before use |
| `CustomShapeRenderer` | Renders validated paths to canvas context |

### Data Model

#### Shape Definition

```javascript
{
  id: 'flowchart/decision',           // Unique identifier
  name: 'Decision',                    // Display name (i18n key)
  category: 'flowchart',               // Primary category
  subcategory: 'basic',                // Optional subcategory
  tags: ['diamond', 'condition', 'if'], // Search tags
  path: 'M50 0 L100 50 L50 100 L0 50 Z', // SVG path data
  viewBox: [0, 0, 100, 100],           // Original viewBox
  defaultAspectRatio: 1,               // Suggested aspect ratio
  fillRule: 'nonzero',                 // Optional: 'evenodd' for complex shapes
  version: 1                           // For future migrations
}
```

#### Layer Type

```javascript
// New layer type: 'customShape'
{
  id: 'layer_abc123',
  type: 'customShape',
  shapeId: 'flowchart/decision',       // Reference to library shape
  
  // Geometry
  x: 100,
  y: 200,
  width: 150,
  height: 100,
  rotation: 0,
  
  // Standard styling (same as other shapes)
  fill: '#3498db',
  fillOpacity: 1,
  stroke: '#2c3e50',
  strokeWidth: 2,
  strokeOpacity: 1,
  
  // Effects (existing system)
  shadow: false,
  shadowColor: '#000000',
  shadowBlur: 10,
  shadowOffsetX: 5,
  shadowOffsetY: 5
}
```

### Rendering Pipeline

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Layer Data     │───▶│  Path Validator  │───▶│  Path2D Object  │
│  (shapeId)      │    │  (security gate) │    │  (browser API)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Canvas Output  │◀───│  Apply Transform │◀───│  Apply Styling  │
│  (rendered)     │    │  (scale/rotate)  │    │  (fill/stroke)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Category Structure

```
├── Arrows & Lines
│   ├── Directional (right, left, up, down, diagonal)
│   ├── Curved (bent, circular)
│   ├── Double-ended (horizontal, vertical)
│   └── Specialty (undo, redo, refresh)
│
├── Callouts & Speech
│   ├── Rectangular (square corners, rounded)
│   ├── Oval (elliptical bubbles)
│   ├── Cloud (thought bubbles)
│   └── Pointer positions (left, right, top, bottom)
│
├── Flowchart
│   ├── Process (rectangle, rounded rectangle)
│   ├── Decision (diamond)
│   ├── Data (parallelogram, cylinder)
│   ├── Terminator (stadium/pill shape)
│   ├── Connector (circle, small circle)
│   └── Document (wavy bottom)
│
├── Geometric
│   ├── Triangles (equilateral, right, isoceles)
│   ├── Quadrilaterals (trapezoid, parallelogram, rhombus)
│   ├── Regular polygons (pentagon, hexagon, octagon)
│   └── Stars (4-point, 5-point, 6-point, burst)
│
├── Symbols & Icons
│   ├── Status (checkmark, X, warning, info, question)
│   ├── Actions (plus, minus, edit, delete, search)
│   ├── Media (play, pause, stop, record)
│   └── Common (heart, star, lightning, flag)
│
└── Decorative
    ├── Banners (ribbon, scroll, flag)
    ├── Badges (shield, seal, certificate)
    ├── Brackets (curly, square, angle)
    └── Frames (simple, ornate)
```

## User Interface

### Option A: Toolbar Dropdown (Recommended)

```
┌────────────────────────────────────────────────────────────┐
│  [Select] [Text] [Shapes ▼] [Arrow] [Line]                 │
└────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────┐
│ 🔍 Search shapes...                 │
├─────────────────────────────────────┤
│ ★ Recent                            │
│   ◇ ▭ ➤ ☑                          │
├─────────────────────────────────────┤
│ ▶ Arrows & Lines                    │
│ ▶ Flowchart                         │
│ ▶ Callouts                          │
│ ▼ Symbols                [expanded] │
│   ┌───┬───┬───┬───┐                 │
│   │ ✓ │ ✗ │ ⚠ │ ℹ │                 │
│   ├───┼───┼───┼───┤                 │
│   │ + │ − │ ✎ │ 🔍│                 │
│   └───┴───┴───┴───┘                 │
│ ▶ Decorative                        │
└─────────────────────────────────────┘
```

### Option B: Dedicated Panel

Side panel that stays open, similar to layer panel:

```
┌──────────────────────────────┐
│ SHAPES                    ✕  │
├──────────────────────────────┤
│ 🔍 Search...                 │
├──────────────────────────────┤
│ Category: [Flowchart    ▼]   │
├──────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│ │    │ │    │ │ ◇  │ │ ▱  │ │
│ │ ▭  │ │(▭) │ │    │ │    │ │
│ └────┘ └────┘ └────┘ └────┘ │
│ Process Rounded Decision Data│
│                              │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│ │════│ │ ○  │ │~~~~│ │ ◯  │ │
│ │    │ │    │ │    │ │    │ │
│ └────┘ └────┘ └────┘ └────┘ │
│ Terminal Connector Doc  ...  │
└──────────────────────────────┘
```

### Interaction Flow

1. User clicks shape in library
2. Cursor changes to crosshair with shape preview
3. User clicks canvas to place at default size, OR
4. User drags to define custom size
5. Shape is created as `customShape` layer
6. Normal selection/editing applies

## Open-Source Shape Sources

| Library | License | Count | Quality | Notes |
|---------|---------|-------|---------|-------|
| **Lucide** | ISC | 1,400+ | ★★★★★ | Consistent, modern |
| **Heroicons** | MIT | 450+ | ★★★★★ | Tailwind team |
| **Tabler** | MIT | 4,000+ | ★★★★☆ | Huge variety |
| **Feather** | MIT | 280+ | ★★★★★ | Minimal, clean |
| **Bootstrap** | MIT | 1,800+ | ★★★★☆ | Well-organized |

### Extraction Script

```javascript
// Tool to extract path data from SVG files
const fs = require('fs');
const path = require('path');

function extractPathFromSVG(svgContent) {
  const pathMatch = svgContent.match(/<path[^>]*d="([^"]+)"/);
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  
  return {
    path: pathMatch ? pathMatch[1] : null,
    viewBox: viewBoxMatch ? viewBoxMatch[1].split(' ').map(Number) : [0, 0, 24, 24]
  };
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (3-4 days)

- [ ] `ShapePathValidator.js` - Path validation
- [ ] `CustomShapeRenderer.js` - Canvas rendering
- [ ] `ShapeLibraryData.js` - Data structure and 20 starter shapes
- [ ] Server-side validation in `ServerSideLayerValidator.php`
- [ ] Unit tests for validator and renderer

### Phase 2: Library UI (2-3 days)

- [ ] `ShapeLibraryManager.js` - Category/search logic
- [ ] `ShapeLibraryPanel.js` - UI component
- [ ] Toolbar integration
- [ ] Click-to-place and drag-to-size interactions
- [ ] Keyboard navigation and accessibility

### Phase 3: Shape Content (1-2 days)

- [ ] Extract 100+ shapes from open-source libraries
- [ ] Organize into categories
- [ ] Add i18n keys for all shape names
- [ ] Quality review and optimization

### Phase 4: Polish (1-2 days)

- [ ] Recent shapes tracking
- [ ] Favorites system (localStorage)
- [ ] Shape preview on hover
- [ ] Performance optimization for large libraries
- [ ] Documentation and wiki updates

### Phase 5: Advanced Features (Future)

- [ ] User-defined shapes (paste SVG path)
- [ ] Shape editor (modify existing shapes)
- [ ] Export shapes to library
- [ ] Compound shapes (multiple paths)

## API Changes

### New Layer Type

The `customShape` layer type will be added to:

1. **Client validation** (`LayersValidator.js`)
2. **Server validation** (`ServerSideLayerValidator.php`)
3. **Property whitelist** - Add `shapeId` property

### Backward Compatibility

- Existing layers unaffected
- Old clients will ignore `customShape` layers (graceful degradation)
- Shape library is purely additive

## Testing Strategy

### Unit Tests

```javascript
describe('ShapePathValidator', () => {
  it('should accept valid path commands', () => {
    expect(validator.isValid('M0 0 L10 10 Z')).toBe(true);
  });
  
  it('should reject script injection attempts', () => {
    expect(validator.isValid('M0 0<script>alert(1)</script>')).toBe(false);
  });
  
  it('should reject excessively long paths', () => {
    const longPath = 'M0 0 ' + 'L1 1 '.repeat(10000);
    expect(validator.isValid(longPath)).toBe(false);
  });
});
```

### Integration Tests

- Shape placement workflow
- Shape styling application
- Save/load round-trip
- Export with custom shapes

## Performance Considerations

1. **Path caching**: Parse path to `Path2D` once, reuse for rendering
2. **Lazy loading**: Load shape categories on demand
3. **Virtual scrolling**: For shape picker with many items
4. **Search indexing**: Pre-build search index for instant results

## Accessibility

- Full keyboard navigation in shape picker
- ARIA labels for all shapes
- Screen reader announcements for selection
- High contrast mode support
- Focus management

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Path validation bypass | Low | High | Strict whitelist, multiple validation layers |
| Performance with many shapes | Medium | Medium | Lazy loading, virtualization |
| Confusing UI | Medium | Medium | User testing, iterative design |
| Breaking existing workflows | Low | Medium | Additive changes only |

## Success Metrics

- User adoption rate of custom shapes
- Average shapes per annotation
- Search usage patterns
- Performance metrics (render time, library load time)

## Open Questions

1. Should favorites sync across devices (via user preferences API)?
2. Maximum number of shapes to support in initial release?
3. Should we support multi-path shapes (compound paths)?
4. Integration with existing polygon/star tools - merge or separate?

## Appendix: Sample Shape Definitions

```javascript
// Example shapes from proposed library
export const FLOWCHART_SHAPES = [
  {
    id: 'flowchart/process',
    name: 'layers-shape-process',
    category: 'flowchart',
    tags: ['rectangle', 'step', 'action'],
    path: 'M0 0 H100 V60 H0 Z',
    viewBox: [0, 0, 100, 60]
  },
  {
    id: 'flowchart/decision',
    name: 'layers-shape-decision',
    category: 'flowchart',
    tags: ['diamond', 'condition', 'if', 'branch'],
    path: 'M50 0 L100 30 L50 60 L0 30 Z',
    viewBox: [0, 0, 100, 60]
  },
  {
    id: 'flowchart/terminator',
    name: 'layers-shape-terminator',
    category: 'flowchart',
    tags: ['start', 'end', 'pill', 'stadium'],
    path: 'M15 0 H85 A15 15 0 0 1 85 30 H15 A15 15 0 0 1 15 0',
    viewBox: [0, 0, 100, 30]
  }
];

export const SYMBOL_SHAPES = [
  {
    id: 'symbols/checkmark',
    name: 'layers-shape-checkmark',
    category: 'symbols',
    tags: ['check', 'yes', 'done', 'complete', 'tick'],
    path: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    viewBox: [0, 0, 24, 24]
  },
  {
    id: 'symbols/warning',
    name: 'layers-shape-warning',
    category: 'symbols',
    tags: ['alert', 'caution', 'danger', 'exclamation'],
    path: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    viewBox: [0, 0, 24, 24]
  }
];
```

---

*This proposal is subject to revision based on implementation discoveries and user feedback.*
