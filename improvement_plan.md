# Improvement Plan

**Last Updated:** February 7, 2026 (v24 — Comprehensive Critical Review)
**Version:** 1.5.52
**Overall Grade:** B (downgraded from A- in v23)

Cross-reference: [codebase_review.md](codebase_review.md) and
[docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)

---

## Executive Summary

v24 review identified **4 critical security/correctness issues** that
v22/v23 missed or incorrectly marked as fixed. The codebase has excellent
test infrastructure (95%+ coverage, 11,228 tests) and clean ES6 patterns,
but several verified bugs affect production correctness. The documentation
has significant accuracy problems (50 issues, 11 HIGH).

**Key Changes from v23:**
- Grade downgraded B ← A- (4 new CRITICALs found, 1 was false-fix)
- Rate limiting reclassified from "FIXED" to "CRITICAL" (P0.3)
- 11 new HIGH-priority bugs identified
- 50 documentation issues catalogued (11 factually wrong)

---

## Fix Schedule

### Phase 0: Critical Security (This Week)

**Must fix before any release. All are exploitable or cause data loss.**

| # | Issue | Effort | Risk |
|---|-------|--------|------|
| P0.1 | IM `@` file disclosure | 1h | Server file read |
| P0.2 | Slide permission bypass | 30m | Data leak on private wikis |
| P0.3 | Rate limiting no-op | 2h | Abuse/DoS |
| P0.4 | preg_replace corruption | 1h | Silent data corruption |

**P0.1 Fix — ImageMagick `@` file disclosure:**
```php
// In ThumbnailRenderer.php, before passing to IM:
$text = ltrim( $layer['text'], '@' );
```
Also add to TextSanitizer for defense-in-depth.

**P0.2 Fix — Slide permission bypass:**
```php
// In ApiLayersInfo.php, move permission check BEFORE
// executeSlideRequest():
$title = Title::newFromText( $filename, NS_FILE );
if ( !$title || !$title->userCan( 'read', $user ) ) {
    $this->dieWithError( 'apierror-permissiondenied' );
}
// THEN handle slide requests
if ( $this->getVal( 'slideid' ) ) {
    return $this->executeSlideRequest( ... );
}
```

**P0.3 Fix — Rate limiting registration:**
Add to extension.json `config` section or `Hooks/MW Setup`:
```json
"RateLimits": {
    "editlayers-save": { "user": [30, 3600], "newbie": [5, 3600] },
    "editlayers-render": { "user": [60, 3600] },
    "editlayers-create": { "user": [10, 3600] }
}
```
Also update RateLimiter to verify limits are active.

**P0.4 Fix — preg_replace backreference corruption:**
```php
// In LayersHtmlInjector.php, escape replacement string:
$replacement = addcslashes( $value, '\\$' );
// OR use str_replace if pattern is simple enough
```

---

### Phase 1: High Bugs (Next Sprint — 1–2 Weeks)

| # | Issue | Effort | Notes |
|---|-------|--------|-------|
| P1.1 | GroupManager undo order | 3h | 10 methods to fix |
| P1.2 | Double rotation blur | 1h | Remove canvas rotation |
| P1.3 | Alignment bounds | 2h | Add shape-type cases |
| P1.4 | SetName validation | 2h | Unify create/rename |
| P1.5 | Short ID matching | 1h | Pick prefix or suffix |
| P1.6 | noedit bare flag | 1h | Add else branch |
| P1.7 | Import sanitization | 2h | Validate before use |
| P1.8 | SVG2 href check | 1h | Add href to validator |
| P1.9 | 20-layer hash cap | 30m | Hash all layers |
| P1.10 | try/finally context | 30m | Add finally block |
| P1.11 | richText cache hash | 30m | Use full JSON or hash |

**P1.1 Fix pattern — GroupManager:**
```javascript
// BEFORE (broken): saves pre-mutation state
this.historyManager.saveState();
this.stateManager.set( 'layers', newLayers );

// AFTER (correct): save, then mutate, then snapshot
const beforeState = this.stateManager.getSnapshot();
this.stateManager.set( 'layers', newLayers );
this.historyManager.saveState( beforeState );
```
Apply to all 10 methods: createGroup, ungroup, moveToGroup,
removeFromGroup, deleteGroup, renameGroup, toggleGroupVisibility,
toggleGroupLock, mergeGroups, flattenGroup.

**P1.3 Fix pattern — AlignmentController:**
```javascript
// Add cases for ellipse, polygon, star:
case 'ellipse':
    return {
        left: layer.x - (layer.radiusX || 0),
        top: layer.y - (layer.radiusY || 0),
        width: (layer.radiusX || 0) * 2,
        height: (layer.radiusY || 0) * 2
    };
case 'polygon':
case 'star':
    return this.calculatePolygonBounds( layer );
```

---

### Phase 2: Medium Issues (Next Month)

| # | Issue | Effort |
|---|-------|--------|
| P2.1 | Rate limit after DB work | 1h |
| P2.2 | Module loading perf | 2h |
| P2.3 | CSP header conflicts | 2h |
| P2.4 | LayeredThumbnail ctor | 30m |
| P2.5 | $wgUploadPath global | 30m |
| P2.6 | Date localization | 1h |
| P2.7 | backgroundColor validation | 30m |
| P2.8 | setname sanitization | 30m |
| P2.9 | StateManager reentrance | 1h |
| P2.10 | Blur handler race | 1h |
| P2.11 | Snap cache staleness | 2h |
| P2.12 | addLayer mutation | 1h |
| P2.13 | Blur memory use | 3h |
| P2.14 | Ellipse preview drift | 1h |
| P2.15 | Diagonal handle | 2h |
| P2.16 | Double HTML escaping | 30m |

**Total Phase 2 effort: ~20 hours**

---

### Phase 3: Low Priority (Ongoing)

| # | Issue | Effort |
|---|-------|--------|
| P3.1 | ForeignFile trait duplication | 2h |
| P3.2 | Remove dead ParserHooks.php | 30m |
| P3.3 | Remove MW < 1.44 compat code | 1h |
| P3.4 | Fix logging levels | 30m |
| P3.5 | Remove duplicate URL param check | 15m |
| P3.6 | Deduplicate ColorValidator | 1h |
| P3.7 | Fix null caching pattern | 30m |
| P3.8 | Update schema version string | 15m |
| P3.9 | Upgrade to PSR-3 logging | 1h |
| P3.10 | Fix service locator pattern | 30m |
| P3.11 | Harden schema patches | 1h |
| P3.12 | Standardize error patterns | 2h |
| P3.13 | Remove gradient lookup dup | 15m |
| P3.14 | Use crypto-strength IDs | 30m |

**Total Phase 3 effort: ~12 hours**

---

### Phase 4: Documentation (Parallel — Any Sprint)

**HIGH priority docs (factually wrong — fix first):**

| # | Fix | Effort |
|---|-----|--------|
| DOC-1 | Remove phantom API endpoints from ARCHITECTURE.md | 15m |
| DOC-2 | Remove phantom permission from ARCHITECTURE.md | 5m |
| DOC-3 | Remove ghost configs from README + mediawiki page | 15m |
| DOC-4-6 | Fix wiki/Home.md version highlights | 30m |
| DOC-8 | Remove or mark `lock` param as unimplemented | 15m |
| DOC-9 | Fix API endpoint count in ARCHITECTURE.md | 5m |
| DOC-10 | Fix file extension in RELEASE_GUIDE.md | 5m |
| DOC-11 | Fix namespace version in ARCHITECTURE.md | 5m |

**MEDIUM priority docs (outdated — fix with related code changes):**

| # | Fix | Effort |
|---|-----|--------|
| DOC-12-13 | Add MaxComplexity + Slide Mode configs | 30m |
| DOC-14-15 | Update all line counts | 1h |
| DOC-16-17 | Rewrite NAMED_LAYER_SETS.md as impl doc | 1h |
| DOC-18-19 | Fix SLIDE_MODE.md status inconsistency | 30m |
| DOC-20 | Mark FR-14 as implemented | 5m |
| DOC-21 | Update DEVELOPER_ONBOARDING line counts | 15m |
| DOC-22 | Rename or clarify docs/API.md | 5m |
| DOC-23 | Add M and D shortcuts to ACCESSIBILITY.md | 5m |
| DOC-24-25 | Fix README config/tool table | 15m |
| DOC-26 | Add Slide Mode to update checklist | 5m |
| DOC-27 | Fix date inconsistency in README | 5m |

**Total Phase 4 effort: ~5 hours**

---

## God Class Status (19 Files > 1,000 Lines)

### Generated Data Files (Exempt — 2)
| File | Lines | Notes |
|------|-------|-------|
| ShapeLibraryData.js | ~11,299 | Generated |
| EmojiLibraryIndex.js | ~3,055 | Generated |

### Hand-Written JS (15)
| File | Lines | Action |
|------|-------|--------|
| LayerPanel.js | ~2,180 | 9 controllers extracted; monitor |
| CanvasManager.js | ~2,053 | Facade pattern; OK if monitoring |
| Toolbar.js | ~1,891 | Extract tool-group sections |
| LayersEditor.js | ~1,836 | Further decompose to modules |
| InlineTextEditor.js | ~1,670 | Extract selection/formatting |
| APIManager.js | ~1,566 | Split read/write operations |
| PropertyBuilders.js | ~1,464 | Split into per-type builders |
| SelectionManager.js | ~1,415 | Delegates well; monitor |
| CanvasRenderer.js | ~1,365 | Extract effect rendering |
| ViewerManager.js | ~1,320 | Extract init/lifecycle |
| ToolManager.js | ~1,214 | Delegates to handlers; monitor |
| GroupManager.js | ~1,205 | Fix P1.1 first; then evaluate |
| SlideController.js | ~1,131 | Extract slide navigation |
| TransformController.js | ~1,117 | Extract rotation logic |
| LayersValidator.js | ~1,116 | Split client/server validators |

### PHP God Classes (2)
| File | Lines | Action |
|------|-------|--------|
| ServerSideLayerValidator.php | ~1,346 | Extract shape validators |
| LayersDatabase.php | ~1,363 | Extract query builders |

**Recommendation:** Focus on Toolbar.js and PropertyBuilders.js for
next extraction round. Both have clear logical seams.

---

## Security Posture Assessment

### Controls That Work Well
- CSRF token enforcement on all write endpoints
- SQL injection prevention via parameterized queries
- XSS prevention via iterative HTML stripping
- JSON schema validation with strict property whitelist
- Base64 image size limits with clear error messages

### Controls That Need Fixing
- **Rate limiting:** Define defaults AND register them (Phase 0)
- **IM injection:** Strip `@` from text before IM (Phase 0)
- **Permission ordering:** Check read before route (Phase 0)
- **Regex replacement:** Escape backreferences (Phase 0)
- **SVG href:** Check both xlink:href and href (Phase 1)
- **Import validation:** Client-side JSON validation (Phase 1)

### Controls to Add
- Content-Security-Policy coordination with MW core
- Subresource Integrity for external assets (if any)
- Security audit of Slide Mode endpoints
- Rate limit monitoring/logging

---

## Test Coverage Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statement | 95.19% | 90% | ✅ Exceeds |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ Exceeds |
| Lines | 95.32% | 90% | ✅ Exceeds |

### Recommended Additional Tests
- P0 regression tests (IM injection, permission bypass, rate limiting)
- GroupManager undo/redo integration tests
- AlignmentController with all shape types
- Import/export with malicious JSON payloads
- preg_replace with `$` in layer text
- Layers 21+ change detection

---

## Recommendations Summary

### Immediate (This Week)
1. Fix all 4 P0 issues before any release
2. Add regression tests for each P0 fix
3. Fix the 11 HIGH documentation errors

### Short Term (Next Sprint)
4. Fix all 11 P1 bugs with tests
5. Unify SetName validation across create/rename/delete
6. Update ARCHITECTURE.md (remove phantom endpoints/permissions)

### Medium Term (Next Month)
7. Address P2 issues in priority order
8. Update all stale line counts across docs
9. Rewrite NAMED_LAYER_SETS.md as implementation doc

### Long Term (Ongoing)
10. Continue god class reduction (Toolbar.js, PropertyBuilders.js)
11. Standardize error response patterns across API modules
12. Security audit of Slide Mode feature
13. Consider dedicated security review engagement

---

## Change History

| Version | Date | Grade | Changes |
|---------|------|-------|---------|
| v24 | 2026-02-07 | B | Full re-review: 4 CRITICAL, 11 HIGH, 16 MED, 14 LOW code + 50 doc issues. Rate limiting reclassified from FIXED to CRITICAL. Grade downgraded from A-. |
| v23 | 2026-02-06 | A- | Previous review (2 false positive DOC issues found) |
| v22 | 2026-02-02 | B+ | Initial comprehensive review |
