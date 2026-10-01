# Links from layers: Unified architectural design

**Date:** September 30, 2026  
**Advances:** FEAT-8, SEC-5, SRCH-3, CARGO-1 (with UI-3, UI-4, SEC-3, HIST-2).  
**Applies to:** MediaWiki 1.44+ (tested on MediaWiki 1.45.3).  
**Status:** Approved with the lead's corrections of section 1a, which override anything below that disagrees. Prerequisite for implementation.

---

## 1. Executive summary

This document settles the architecture for **Links from layers** as one cohesive, MediaWiki-native subsystem before implementation begins.

In Layers 2.0, any shape, text, or image layer can link to a wiki page (with an optional section anchor) or an external URL. Rather than treating drawing links as isolated client-side metadata, Layers integrates links directly into MediaWiki core:

1. **Storage & Schema (FEAT-8, SEC-3):** An optional `link` string property on layer objects in the `layers-document` revision slot.
2. **Security & Validation (SEC-3, SEC-5):** Strict protocol whitelisting against `$wgUrlProtocols`, rejection of dangerous URI schemes (`javascript:`, `data:`, `vbscript:`), `$wgNoFollowLinks` compliance, and automated interception by `$wgSpamRegex`, `SpamBlacklist`, and `AbuseFilter`.
3. **Core Database Tracking (FEAT-8):** Registration in MediaWiki's native `ParserOutput` during revision rendering, populating core `pagelinks` (for "What links here" and cache invalidation) and `externallinks` (for `Special:LinkSearch`).
4. **Missing Page Indication (FEAT-8):** Native red-link styling (`class="new"`) for target pages that do not exist.
5. **Search Indexing (SRCH-3):** Indexing both link text and link target URIs/titles into page search documents (`PageDrawingSearchText`), making targets searchable and highlighting matches in search snippets.
6. **Cargo Projection (CARGO-1):** Expanding `{{#layers_cargo_store:}}` to store one row per text layer (and linked shape/image layers) including the `link_target` column.
7. **Viewer & Lightbox Accessible Overlay (FEAT-8, UI-3, UI-4):** An accessible DOM/SVG anchor overlay positioned over the canvas, supporting mouse click, hover target display, keyboard navigation (Tab/Enter), screen reader announcements (WCAG 2.2 AA), and touch activation.
8. **Diffs & History (FEAT-8, HIST-2):** Line-by-line link target changes in `LayersSlotDiffRenderer` and visual property diffs.
9. **Export Clickability (FEAT-8):** Preservation of clickable URI link annotations (`/Subtype /Link`) in generated PDF documents via `PdfBuilder.js`.

---

## 1a. Corrections after the lead's review (binding)

**Vocabulary (September 30, owner rule):** this document was written before the vocabulary rule, and "drawing" in it means **layer set**. The Cargo column is `layer_set` (settled October 1: Cargo field names are written by authors in templates, so they use the owner's word).

The first draft had defects that would have shipped silent failures. Each is fixed below or overridden here.

1. **Classification.** `UrlUtils::validProtocols()` returns a *partial* pattern (`https:\/\/|http:\/\/`), not a regex; build `'/^(?:' . $protocols . ')/i'`. Internal links resolve in the **main namespace** by default, exactly like `[[Foo]]`, never in the owning page's namespace (a drawing on a `File:` page linking "Foo" means `Foo`). A bare `#Section` targets the page itself and is never recorded in `pagelinks` (an empty DB key would be).
2. **Raw `link` is never an `href`.** The browser needs a URL and an existence flag for internal targets. It gets them from one batched `action=query&titles=A|B&prop=info&inprop=url` per drawing (`fullurl`, `missing`, `iwurl`). That honours read rights and is never baked into the publicly cached `layersread` response, so a red link turns blue when the page is created without an edit to the drawing. External hrefs are used only after the same protocol test on the client.
3. **One bounds function.** The draft used `x, y, width, height`, which is wrong for `circle`, `ellipse`, `line`, `arrow`, `path`, `polygon`, `star`, `marker` and for rotation. The overlay and the PDF annotations both take the axis-aligned box from **one** shared function (reuse the editor's hit-test geometry; do not write two). Overlay positions are percentages of the surface canvas (or an SVG `viewBox`), so they follow responsive thumbnails and the lightbox.
4. **Cargo compatibility.** Shipped rows are **per drawing** with the fields in `PageOwnedCargoStore::FIELDS`. Changing the granularity under existing tables is not compatible, so those rows stay exactly as they are, and per-layer rows are opt-in: `{{#layers_cargo_store:_table=X|_rows=layers}}` stores `page`, `revision`, `drawing`, `kind`, `layer`, `type`, `text`, `link_target` for each layer that has text or a link. The "compatibility aliases on layer rows" of section 6 are dropped.
5. **Search.** Index the link target (raw and spaced) and nothing new besides: layer *names* such as "Rectangle 3" are noise. Link text is the layer's existing text.
6. **SEC-5 honesty.** `$wgSpamRegex` is checked in code (core applies it only to the main text and summary). SpamBlacklist and AbuseFilter are **not installed on the test wiki**, and the draft's claim that they see links from a non-main slot is unverified. Before PR 2, read their code for how they obtain links; if they do not cover other slots, call the same check explicitly at publication. Until tested on an install that has them, SEC-5 is reported **partial**, not met.
7. **Scope.** The validator accepts `link` (add it to `STRICT_PROPERTIES`: a bad link fails the layer, never dropped). Overlay, link tables and PDF honour it for **page-owned** drawings only. The legacy `layerssave` refuses a layer carrying `link` with its own message rather than storing a link nothing tracks. Copying a drawing keeps its links verbatim.
8. **External link attributes** follow core: `$wgNoFollowLinks`/`$wgNoFollowDomainExceptions` for `rel`, `$wgExternalLinkTarget` for `target` (not a forced `_blank`). Internal links take neither. Missing pages use core's `new` class, `red-link-title` message and the skin's styling, with no custom colour.
9. **PDF.** Only the client `PdfBuilder` path (the lightbox Download, which matches Print) can carry annotations. The server ImageMagick export rasterises and cannot; say so in the docs, as for its other omissions.
10. **Screen-reader text.** `cdx-reader-only` does not exist in core or Codex; ship a small `.layers-link-sr` rule.
11. **Parser output.** `fillParserOutput` must not emit the JSON table HTML that `JsonContentHandler` produces; register links and return empty text. A test must show core really writes `pagelinks`/`externallinks` rows from a secondary slot (the draft assumed it).
12. **Section 6 wording:** `revision` is a column we fill; Cargo's own `_pageID`/`_pageName` remain.

---

## 2. Document schema and layer data model

### 2.1 Layer property definition

The `link` property is an optional string added to drawing layer objects within a surface's `layers` array in the `layers-document` revision slot:

```json
{
  "schemaVersion": 1,
  "surfaces": [
    {
      "id": "canvas-1",
      "kind": "slide",
      "label": "Process Map",
      "canvas": {
        "width": 1200,
        "height": 800,
        "backgroundColor": "#ffffff",
        "backgroundVisible": true,
        "backgroundOpacity": 1
      },
      "layers": [
        {
          "id": "box-step1",
          "type": "rectangle",
          "x": 80,
          "y": 120,
          "width": 240,
          "height": 100,
          "fill": "#e6f2ff",
          "stroke": "#0066cc",
          "strokeWidth": 2,
          "name": "Intake Step",
          "link": "Operations/Intake#Procedure"
        },
        {
          "id": "text-step1",
          "type": "textbox",
          "x": 90,
          "y": 140,
          "width": 220,
          "height": 60,
          "text": "1. Patient Intake",
          "link": "Operations/Intake#Procedure"
        },
        {
          "id": "icon-external",
          "type": "image",
          "x": 360,
          "y": 140,
          "width": 48,
          "height": 48,
          "src": "data:image/png;base64,...",
          "name": "External Documentation",
          "link": "https://standards.iso.org/iso/9001/"
        }
      ]
    }
  ]
}
```

### 2.2 Property constraints and invariants

| Property | Rule |
| --- | --- |
| Name | `link` |
| Type | `string` |
| Presence | Optional on all renderable layer types (`text`, `textbox`, `callout`, `rectangle`, `circle`, `ellipse`, `polygon`, `star`, `line`, `arrow`, `path`, `image`, `customShape`, `marker`). |
| Omission | When an author removes a link, the property is omitted from the JSON object. Empty strings (`""`) or null values are rejected during canonicalization. |
| Maximum length | 2048 UTF-8 bytes (conforming to MediaWiki's external link URL ceiling and title maximum). |
| Control characters | ASCII control characters (`\x00`–`\x1F`, `\x7F`) are strictly forbidden. |

### 2.3 Link syntax classification

The validator classifies `link` into one of two forms:

1. **External URL:**
   - Identified when the string starts with a scheme matching `$wgUrlProtocols` (e.g., `https://`, `http://`, `mailto:`, `//`, `ftp://`).
   - Must parse as a valid URI via PHP's `parse_url()` and MediaWiki's `UrlUtils`.
   - Protocol-relative URLs (`//example.com/path`) are supported when permitted by `$wgUrlProtocols`.

2. **Internal Wiki Link:**
   - Any string that does not start with an allowed protocol is parsed as a wiki page target with an optional section fragment (`Target_Page#Section` or `#Section`).
   - Parsed using MediaWiki's `Title::newFromText()` / `TitleParser::parseTitle()`.
   - The title portion must be syntactically valid (cannot contain forbidden title characters `<>[\]{}\|`, cannot exceed namespace/title length limits).
   - Self-page section links (`#Section_Anchor`) are valid: they resolve to the current owning page with the specified anchor.
   - Interwiki prefixes (e.g. `wikipedia:Article`) are supported if recognized by MediaWiki's `InterwikiLookup`.

---

## 3. Security architecture (SEC-3, SEC-5)

### 3.1 Strict protocol whitelisting ($wgUrlProtocols)

In accordance with `SEC-3` and `SEC-5`:
- The server validator queries `MediaWikiServices::getInstance()->getUrlUtils()->validProtocols()`.
- Dangerous pseudo-protocols (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) are forbidden.
- Any layer with an unrecognized or blacklisted protocol fails save validation with the localized error `layers-invalid-link-protocol`.
- Validation refuses content rather than attempting to strip or sanitize scripts in-flight: "User content is never silently changed. Validation refuses content rather than repairing it" (Charter 4).

### 3.2 Spam and Abuse prevention ($wgSpamRegex, SpamBlacklist, AbuseFilter)

External links in drawings must not become a bypass for wiki abuse filters:

1. **$wgSpamRegex:** During pre-save validation in `LayersDocumentContentHandler::validateSave` and `PageRevisionWriter`, all external URLs extracted from drawing layers are checked against `$wgSpamRegex`. A match aborts publication with standard spam error reporting.
2. **SpamBlacklist:** If the `SpamBlacklist` extension is installed, drawing links are checked using `SpamBlacklist::filter(...)` or by exposing links during the `EditFilterMergedContent` hook. If an external link matches a blacklisted regex, publication fails with `spamprotectiontext`.
3. **AbuseFilter:** AbuseFilter inspects the `added_links` variable during edits. By registering drawing external links in `ParserOutput::addExternalLink()` (see Section 4), AbuseFilter automatically receives all drawing links in `added_links` when evaluating filter rules.

### 3.3 Link relations and nofollow ($wgNoFollowLinks)

When rendering external links in client views:
- The server checks `$wgNoFollowLinks` and `$wgNoFollowDomainExceptions`.
- For external targets, the rendered anchor element includes `rel="nofollow noreferrer noopener"` (or `rel="noreferrer noopener"` if exempt).
- External links open with `target="_blank"`.

---

## 4. MediaWiki core link table integration (FEAT-8)

### 4.1 ParserOutput link registration

MediaWiki tracks links by accumulating them on `ParserOutput` during page parsing. Core then updates the database tables (`pagelinks`, `externallinks`) in `LinksUpdate`.

Because drawings in Layers 2.0 live in the page-owned `layers` slot (`LayersDocumentContent`), slot rendering provides the native bridge:

```php
namespace MediaWiki\Extension\Layers\Content;

use MediaWiki\Content\Content;
use MediaWiki\Content\Renderer\ContentParseParams;
use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;

class LayersDocumentContentHandler extends JsonContentHandler {
    // ...
    
    /**
     * Populate ParserOutput with drawing link metadata for core database tracking.
     */
    public function fillParserOutput(
        Content $content,
        ContentParseParams $cpoParams,
        ParserOutput &$output
    ): void {
        parent::fillParserOutput( $content, $cpoParams, $output );
        if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ) {
            return;
        }

        $document = json_decode( $content->getText(), true );
        $surfaces = is_array( $document['surfaces'] ?? null ) ? $document['surfaces'] : [];
        $urlUtils = MediaWikiServices::getInstance()->getUrlUtils();
        $protocols = '/^(?:' . $urlUtils->validProtocols() . ')/i';

        foreach ( $surfaces as $surface ) {
            foreach ( $surface['layers'] ?? [] as $layer ) {
                $link = trim( (string)( $layer['link'] ?? '' ) );
                if ( $link === '' ) {
                    continue;
                }

                if ( preg_match( $protocols, $link ) ) {
                    // External link -> externallinks table (Special:LinkSearch)
                    $output->addExternalLink( $link );
                    continue;
                }
                // Main namespace by default, as for [[Foo]]; a bare #fragment is the page itself
                $target = Title::newFromText( $link );
                if ( $target && $target->getDBkey() !== '' ) {
                    $output->addLink( $target );
                }
            }
        }
    }
}
```

### 4.2 Database side-effects and native features

By registering links on `ParserOutput`:
1. **WhatLinksHere (`Special:Whatlinkshere`):** When page `Diagram` has a drawing with a layer linking to `Project:Architecture`, `Special:Whatlinkshere/Project:Architecture` automatically includes `Diagram`.
2. **LinkSearch (`Special:LinkSearch`):** When a drawing links to `https://wikimedia.org`, searching for `*.wikimedia.org` in `Special:LinkSearch` lists the page owning the drawing.
3. **Cache Invalidation:** When a target page is edited, moved, or deleted, MediaWiki's core `BacklinkCache` automatically invalidates and purges the parser cache of pages containing drawings that link to it.

### 4.3 Missing page (red link) tracking

`FEAT-8` requires that "links to missing pages show as missing".

In MediaWiki:
- During parsing, `LinkBatch` resolves the existence of all titles recorded via `$output->addLink()`.
- For the interactive viewer overlay, the server delivers an array of link existence flags alongside the drawing snapshot (or the client queries `LinkBatch` / `PageStore` / `action=query&titles=...`).
- When an internal link target does not exist in the database, the link's anchor element is given CSS class `new` (MediaWiki's standard red-link class: `a.new { color: var(--color-destructive, #d33); }`).
- Hovering over a missing link displays the standard tooltip: `"Page Title (page does not exist)"`.

---

## 5. Search indexing integration (SRCH-3)

`SRCH-3` requires that "Link text and link targets from layers are searchable."

In `PageDrawingSearchText.php`, text extraction is extended to harvest both the visible text and the link destination:

```php
public static function layerSearchTerms( array $layer ): array {
    $terms = [];
    
    // 1. Visible text or rich text runs
    if ( is_array( $layer['richText'] ?? null ) ) {
        $terms[] = implode( '', array_map( static fn ( $run ) =>
            is_string( $run['text'] ?? null ) ? $run['text'] : '', $layer['richText'] ) );
    } elseif ( is_string( $layer['text'] ?? null ) && $layer['text'] !== '' ) {
        $terms[] = $layer['text'];
    }
    
    // 2. Link target (SRCH-3); layer names are deliberately not indexed
    if ( is_string( $layer['link'] ?? null ) && $layer['link'] !== '' ) {
        $terms[] = $layer['link'];
        // For internal titles, also index human-readable spaced title and section
        $clean = str_replace( [ '_', '#' ], ' ', $layer['link'] );
        if ( $clean !== $layer['link'] ) {
            $terms[] = $clean;
        }
    }
    
    return array_filter( array_map( 'trim', $terms ), 'strlen' );
}
```

### Search behavior:
- Searching for the target page name (e.g. `Architecture`) finds the page containing the diagram, even if the drawing layer is a non-text shape (e.g. a linked blue rectangle).
- Core search and CirrusSearch receive these terms in `auxiliary_text`.
- In `DrawingSearchHooks::onShowSearchHit`, matches on link targets produce highlighted search snippets showing the context.

---

## 6. Cargo table projection (CARGO-1)

`CARGO-1` requires:
> `{{#layers_cargo_store:}}` stores one row per text layer for every layer set the page owns: page, revision, layer set, kind, layer, type, text and link target.

### 6.1 Expanded field specification

Per-layer rows are an opt-in mode (`_rows=layers`, section 1a item 4); `PageOwnedCargoStore::FIELDS` and the per-drawing rows stay as shipped. The layer mode uses these columns:

| Column | Description | Example |
| --- | --- | --- |
| `page` | The owning page's DB key | `Process_Flow` |
| `revision` | The revision ID storing the layer set | `4521` |
| `layer_set` | The layer set's name (surface label) | `Intake Flow` |
| `kind` | Surface kind | `slide`, `image`, `pdf` |
| `layer` | Unique layer ID within the surface | `box-step1` |
| `type` | Layer type | `textbox`, `rectangle`, `callout` |
| `text` | Extracted plain text (or empty for shapes) | `1. Patient Intake` |
| `link_target` | Link destination (or empty if unlinked) | `Operations/Intake#Procedure` |

*Compatibility note:* For backward compatibility with existing Cargo table schemas created prior to CARGO-1, the store arguments will also supply the legacy surface-level aliases (`surface_id`, `surface_label`, `surface_kind`, `source_file`, `source_page`, `drawing_text`). Cargo ignores columns not declared in a table's `{{#cargo_declare:}}`.

### 6.2 Projection algorithm

For every surface in the revision:
- Iterate through each layer in the surface.
- Emit a row for every layer that has non-empty `text` OR non-empty `link`.
- Project the row into Cargo via `\CargoStore::run()`.

---

## 7. Client viewer: Accessible link overlay (FEAT-8, UI-3, UI-4)

### 7.1 Architectural decision: DOM/SVG overlay over Canvas

HTML5 `<canvas>` is a raster display surface with no native DOM children. Pure canvas hit-testing via JavaScript `click` and `mousemove` listeners fails critical criteria:
- It is invisible to screen readers (violates WCAG 2.2 AA / `UI-3` and `UI-4`).
- It cannot receive standard browser keyboard focus (`Tab` / `Enter`).
- It does not show the URL in the browser status bar on hover.
- It prevents standard browser actions: right-click "Open in new tab", "Copy link address", middle-click.

**Chosen Architecture:**
Over each rendered canvas, Layers mounts an **Accessible Link Overlay** container:
- An absolutely positioned, transparent DOM container aligned exactly with the canvas bounds.
- For each linked layer, an HTML `<a>` (or transformed SVG `<svg class="layers-overlay"><a href="...">...</a></svg>`) element is mounted.
- Coordinates, dimensions, and CSS transforms (`rotate()`) mirror the layer's bounding box and scale.

```html
<div class="layers-viewer-container" style="position: relative;">
  <canvas class="layers-canvas" width="800" height="600"></canvas>
  <div class="layers-link-overlay" aria-label="Interactive drawing links" role="region">
    <a href="/wiki/Operations/Intake#Procedure"
       class="layers-link layers-link-internal"
       title="Operations/Intake > Procedure"
       aria-label="Intake Step: 1. Patient Intake"
       style="position: absolute; left: 6.67%; top: 15%; width: 20%; height: 12.5%;"
       tabindex="0">
      <span class="layers-link-sr">Intake Step: 1. Patient Intake (Operations/Intake)</span>
    </a>
  </div>
</div>
```

### 7.2 Accessibility details (UI-3, UI-4)
- **Focus Indicator:** Linked elements receive a visible, high-contrast focus ring conforming to Codex design tokens (`outline: 2px solid var(--color-progressive, #36c)` with `outline-offset: 2px`).
- **Accessible Name:** Computed in order of precedence:
  1. Layer plain text (for `text`, `textbox`, `callout`).
  2. Layer `name` (for shapes/images).
  3. Destination title / URL.
- **Keyboard Operability:** Standard `Tab` navigation cycles through linked layers in reading order; pressing `Enter` or `Space` follows the link.
- **Screen Reader Only Text:** A hidden `<span class="layers-link-sr">` element ensures assistive technology announces the link purpose and target.

---

## 8. Editor authoring interface (FEAT-8, UI-1, UI-6)

### 8.1 Property panel integration

When any layer is selected in the page-owned editor:
1. The right-hand property panel displays a dedicated **Link** section below styling and dimensions.
2. A toggle / input field allows adding, editing, or clearing a link.
3. **Autocompletion for Wiki Pages:**
   - As the user types into the link field, an autocomplete dropdown queries MediaWiki's `action=opensearch` or `action=query&list=prefixsearch`.
   - Selecting a result populates the canonical wiki page title.
   - An optional `#section` field allows specifying a section fragment.
4. **External URL Mode:**
   - If the input starts with `https://`, `http://`, or `mailto:`, the editor validates against allowed protocols and shows an external link icon indicator.
5. **Validation Feedback:**
   - Real-time inline validation warns immediately if an unsupported protocol (e.g. `javascript:`) or invalid title character is typed.
   - The Save button disables if any layer contains an invalid link.

---

## 9. Visual diffs and revision history (FEAT-8, HIST-2)

### 9.1 Slot text diff
In MediaWiki's native revision comparison (`diff=...&oldid=...`), `LayersSlotDiffRenderer` pretty-prints the JSON snapshot. When a link is added, modified, or removed:

```diff
  "id": "box-step1",
+ "link": "Operations/Intake#Procedure",
  "name": "Intake Step",
```

The change is displayed line-by-line with standard MediaWiki diff highlighting.

### 9.2 Drawing inspector diff
In `Special:ViewLayersPage`, the drawing comparison inspects layer properties and explicitly lists link changes:
- `Link added: [[Operations/Intake#Procedure]]`
- `Link changed: [[Old_Target]] → [[New_Target]]`
- `Link removed`

---

## 10. PDF export clickability (FEAT-8, TYPES-2)

`FEAT-8` requires that "exported PDFs keep the links clickable."

### 10.1 Vector PDF link annotations in `PdfBuilder.js`

Layers exports multi-page PDFs client-side using `PdfBuilder.js`. In PDF 1.4, hyperlinks are represented as `/Subtype /Link` annotation dictionaries associated with a page's `/Annots` array:

```text
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 576.00 432.00]
  /Resources << /XObject << /Im0 5 0 R >> >>
  /Contents 4 0 R
  /Annots [ 6 0 R ]
>>
endobj

6 0 obj
<<
  /Type /Annot
  /Subtype /Link
  /Rect [ 57.60 216.00 230.40 288.00 ]
  /Border [ 0 0 0 ]
  /A <<
    /Type /Action
    /S /URI
    /URI (https://wiki.example.org/wiki/Operations/Intake#Procedure)
  >>
>>
endobj
```

### 10.2 Coordinate transformation
- **Canvas space:** Origin `(0, 0)` is top-left; coordinates in pixels `(x, y, width, height)`.
- **PDF space:** Origin `(0, 0)` is bottom-left; coordinates in points `72 / RENDER_DPI` (where `RENDER_DPI = 150`).
- **Formula:**
  $$\text{llx} = x \times \frac{72}{150}$$
  $$\text{lly} = (\text{canvasHeight} - (y + \text{height})) \times \frac{72}{150}$$
  $$\text{urx} = (x + \text{width}) \times \frac{72}{150}$$
  $$\text{ury} = (\text{canvasHeight} - y) \times \frac{72}{150}$$
  $$\text{Rect} = [ \text{llx}, \text{lly}, \text{urx}, \text{ury} ]$$

### 10.3 URL resolution for PDF export
- External links: Emitted verbatim as `/URI (url)`.
- Internal wiki links: Resolved to full canonical external URLs using MediaWiki's `Title::getFullURL()` so they remain clickable when viewed in standalone PDF reader applications (Acrobat, Preview, mobile viewers).

---

## 11. Verification plan and automated acceptance gates

The implementation must pass automated gates covering all four charter criteria:

| Area | Suite | Coverage |
| --- | --- | --- |
| **Validation** | PHPUnit (`ServerSideLayerValidatorTest`, `DocumentSchemaTest`) | Protocol whitelisting against `$wgUrlProtocols`, rejection of `javascript:`, data URIs, control chars, malformed titles. |
| **Security** | PHPUnit (`LinksSecurityTest`) | Rejection via `$wgSpamRegex`, SpamBlacklist detection, `added_links` inspection by AbuseFilter. |
| **Link Tracking** | PHPIntegrationTest (`LayersDocumentContentHandlerTest`) | `ParserOutput` contains internal and external links; `pagelinks` and `externallinks` rows written on save; WhatLinksHere lists owner. |
| **Search** | PHPUnit (`PageDrawingSearchTextTest`, `DrawingSearchHooksTest`) | Link text and link targets extracted; search query on target finds page. |
| **Cargo** | PHPIntegrationTest (`PageOwnedCargoStoreTest`) | Row per text/linked layer; `link_target` column populated and queryable. |
| **PDF Export** | Jest (`PdfBuilder.test.js`) | Correct PDF 1.4 `/Annots` dictionaries and point coordinate calculations. |
| **Browser E2E** | Playwright (`page-owned-links.spec.js`) | Clicking link navigates; hover status preview; keyboard Tab focus and Enter navigation; red link styling for missing page; WhatLinksHere verification. |

---

## 12. Implementation staging

Implementation will proceed in five clean, incremental PRs:

1. **PR 1: Schema & Validator (FEAT-8, SEC-3, SEC-5)**
   - Add `link` to allowed layer properties.
   - Implement protocol and title validation in `ServerSideLayerValidator` and `DocumentSchema`.
   - Unit tests for validation and security boundaries.

2. **PR 2: Core Link Tracking & Search (FEAT-8, SEC-5, SRCH-3)**
   - Implement `LayersDocumentContentHandler::fillParserOutput`.
   - Update `PageDrawingSearchText` to index link targets and labels.
   - Core integration tests for `pagelinks`, `externallinks`, `Special:LinkSearch`, and search queries.

3. **PR 3: Cargo Projection (CARGO-1)**
   - Update `PageOwnedCargoStore` to project rows per text/linked layer with `link_target`.
   - Core integration tests verifying `#layers_cargo_store` and table row generation.

4. **PR 4: PDF Export Clickability (FEAT-8)**
   - Add link annotation generation to `PdfBuilder.js`.
   - Jest tests for coordinate math and PDF dictionary emission.

5. **PR 5: Viewer Accessible Overlay & Editor UI (FEAT-8, UI-1, UI-3, UI-4)**
   - Implement `PageOwnedLinkOverlay` in the viewer.
   - Add Link input and autocomplete in the editor property panel.
   - Browser acceptance spec `tests/e2e/page-owned-links.spec.js`.
