# Layers Extension — Improvement Plan

**Last updated:** February 9, 2026 — v33 review (version 1.5.54)

This plan organizes all open issues from the codebase review into
prioritized phases with effort estimates. Each phase targets related
issues for efficient batching.

---

## Phase Summary

| Phase | Focus | Items | Fixed | Open | Est. Effort |
|-------|-------|-------|-------|------|-------------|
| 1 | Critical bugs & data safety | 14 | 14 | 0 | 4-6 hours |
| 2 | Security hardening | 8 | 8 | 0 | 3-4 hours |
| 3 | Reliability & correctness | 12 | 12 | 0 | 4-5 hours |
| 4 | Code quality & dead code | 10 | 8 | 2 | 6-8 hours |
| 5 | Performance | 5 | 5 | 0 | 2-3 hours |
| 6 | Infrastructure | 5 | 5 | 0 | 3-4 hours |
| 7 | Documentation debt | 46 | 0 | 46 | 4-6 hours |
| **Total** | | **100** | **53** | **47** | **26-36 hrs** |

---

## Phase 1: Critical Bugs & Data Safety

*Target: Fix HIGH-priority bugs that affect data integrity, save
reliability, and rendering correctness.*

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 1.1 | ON DELETE CASCADE destroys user content | P1-011 | ✅ Fixed v34 | 30m |
| 1.2 | ls_name allows NULL in schema | P1-012 | ✅ Fixed v34 | 30m |
| 1.3 | Triple source of truth for selection | P1-013 | ✅ Fixed v34 | 2h |
| 1.4 | Rich text word wrap wrong font metrics | P1-014 | ✅ Fixed v34 | 1h |
| 1.5 | ThumbnailRenderer shadow blur corrupts canvas | P1-015 | ✅ Done | 1h |
| 1.6 | SQLite-incompatible schema migrations | P1-016 | ✅ Fixed v34 | 2h |
| 1.7 | ShadowRenderer discards scale on rotation | P1-017 | ✅ Fixed v34 | 45m |
| 1.8 | DimensionRenderer hitTest ignores offset | P1-018 | ✅ Fixed v34 | 30m |
| 1.9 | APIManager saveInProgress stuck on throw | P1-019 | ✅ Fixed v34 | 15m |
| 1.10 | PresetStorage strips gradient data | P1-020 | ✅ Fixed v34 | 15m |
| 1.11 | groupSelected() passes object not ID | P0-001 | ✅ Fixed v28 | — |
| 1.12 | HitTest fails on rotated shapes | P1-005 | ✅ Fixed v29 | — |
| 1.13 | normalizeLayers mutates input | P1-008 | ✅ Fixed v29 | — |
| 1.14 | isSchemaReady 23 uncached queries | P1-009 | ✅ Fixed v27 | — |

### Phase 1 Quick Wins (< 30 minutes each)

**P1-019 (saveInProgress):** Add try/finally around L859-870:
```javascript
try {
    this.saveInProgress = true;
    const payload = this.buildSavePayload();
    const json = JSON.stringify(payload);
    // ... save logic
} catch (e) {
    this.saveInProgress = false;
    throw e;
} finally {
    // saveInProgress reset in success/error callbacks
}
```

**P1-020 (gradient presets):** Add `'gradient'` to
ALLOWED_STYLE_PROPERTIES array in PresetStorage.js L20-56.

**P1-011 (CASCADE):** Change `ON DELETE CASCADE` to
`ON DELETE SET NULL` in layers_tables.sql and add a migration patch.

---

## Phase 2: Security Hardening

*Target: Close latent security gaps and strengthen input validation.*

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 2.1 | Toolbar innerHTML with .text() | P2-014 | ✅ Fixed v34 | 30m |
| 2.2 | Client SVG sanitization regex bypassable | P2-007 | ✅ Done | 1h |
| 2.3 | sanitizeString strips `<>` destroying math | P2-008 | ✅ Fixed v34 | 45m |
| 2.4 | window.open without noopener | P2-017 | ✅ Fixed v34 | 10m |
| 2.5 | init.js event listener accumulation | P2-015 | ✅ Fixed v34 | 15m |
| 2.6 | Hardcoded 'Anonymous' not i18n | P3-005 | ✅ Fixed v34 | 15m |
| 2.7 | ThumbnailRenderer Exception not Throwable | P3-004 | ✅ Fixed v34 | 5m |
| 2.8 | checkSizeLimit .length vs bytes | P3-007 | ✅ Fixed v34 | 20m |

### Phase 2 Quick Wins

**P2-017 (noopener):** Add `'noopener,noreferrer'` as third arg to
`window.open()` at ViewerOverlay.js L465, L468.

**P2-015 (listener guard):** Add a module-level flag
`let modalListenerRegistered = false;` and check before adding
the listener at init.js L124.

**P3-004 (Throwable):** Change `catch ( \Exception $e )` to
`catch ( \Throwable $e )` at ThumbnailRenderer.php L110.

---

## Phase 3: Reliability & Correctness

*Target: Fix medium-priority bugs affecting editor reliability.*

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 3.1 | SmartGuides cache stale on mutations | P2-009 | ✅ Fixed v34 | 45m |
| 3.2 | ImageLoader timeout orphaned on success | P2-016 | ✅ Fixed v34 | 10m |
| 3.3 | TextBoxRenderer wrapText no long word break | P2-019 | ✅ Fixed v34 | 45m |
| 3.4 | ApiLayersSave redundant token parameter | P2-020 | ✅ Fixed v34 | 5m |
| 3.5 | LayersSchemaManager bypasses DI | P2-021 | ✅ Fixed v34 | 20m |
| 3.6 | enrichWithUserNames duplicated | P2-013 | ✅ Fixed v34 | 30m |
| 3.7 | StateManager malformed JSDoc | P3-003 | ✅ Fixed v34 | 5m |
| 3.8 | ApiLayersList missing unset() | P3-001 | ✅ Fixed v34 | 5m |
| 3.9 | CalloutRenderer blur clips L/R tails | — | ✅ Fixed v31 | — |
| 3.10 | closeAllDialogs leaks handlers | — | ✅ Fixed v30 | — |
| 3.11 | LayerInjector logger arg | — | ✅ Fixed v30 | — |
| 3.12 | SlideHooks isValidColor too weak | — | ✅ Fixed v30 | — |

### Phase 3 Quick Wins

**P2-016 (timeout):** In ImageLoader.js loadTestImage(), save the
timeout ID and call `clearTimeout(timeoutId)` in the onload handler.

**P2-020 (redundant token):** Remove explicit 'token' from
getAllowedParams() in ApiLayersSave.php L589-594; needsToken()
handles it.

**P3-003 (JSDoc):** Close the unclosed `/**` comment at
StateManager.js L894-898.

---

## Phase 4: Code Quality & Dead Code

*Target: Remove dead code, eliminate duplication, improve
maintainability.*

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 4.1 | SlideManager.js dead code (~439 lines) | P2-006 | ✅ Fixed | 30m |
| 4.2 | ToolManager 400+ lines dead fallbacks | P2-010 | ✅ Fixed | 1h |
| 4.3 | HistoryManager duck-type constructor | P2-011 | ✅ Fixed v34 | 30m |
| 4.4 | Duplicate prompt dialog implementations | P2-012 | ✅ Done | 45m |
| 4.5 | UIHooks unused variables | P3-002 | ✅ Fixed v34 | 5m |
| 4.6 | ImageLayerRenderer djb2 collision risk | P3-006 | ✅ By Design | 30m |
| 4.7 | God class reduction (12 JS files >1K) | — | 🔄 In Progress | 8h+ |
| 4.8 | Remove ext.layers.slides dead module | P2-024 | ✅ Fixed | 15m |
| 4.9 | Duplicate message keys in extension.json | P2-025 | ✅ Done | 20m |
| 4.10 | phpunit.xml deprecated attributes | P2-026 | ✅ Fixed v34 | 15m |

---

## Phase 5: Performance

*Target: Reduce GC pressure and unnecessary allocations.*

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 5.1 | ShadowRenderer/EffectsRenderer temp canvas | P2-018 | ✅ Fixed v34 | 1h |
| 5.2 | ext.layers loaded every page | P2-005 | ✅ Fixed v34 | 30m |
| 5.3 | Canvas reuse pool for renderers | — | ✅ Fixed v34 | 1h |
| 5.4 | SmartGuides spatial index | — | ✅ Closed (not needed) | 2h |
| 5.5 | Lazy-load viewer overlay | — | ✅ Closed (marginal benefit) | 30m |

---

## Phase 6: Infrastructure

*Target: Fix schema issues and MW convention violations.*

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 6.1 | Foreign key constraints violate MW conventions | P2-022 | ✅ Fixed v34 | 1h |
| 6.2 | SpecialEditSlide references missing module | P2-023 | ✅ Done | 15m |
| 6.3 | ext.layers.slides incomplete module | P2-024 | ✅ Fixed | 30m |
| 6.4 | SQLite migration compatibility | P1-016 | ✅ Fixed v34 | 2h |
| 6.5 | Schema NULL constraint for ls_name | P1-012 | ✅ Fixed v34 | 30m |

---

## Phase 7: Documentation Debt (46 Items)

*Target: Bring all documentation into sync with actual codebase state.*

### 7A: Version & Metrics Sync (20 items, ~2 hours)

Update stale version numbers, line counts, test counts, and i18n
counts across all documentation files. See the full breakdown in
codebase_review.md § Documentation Debt Summary.

Key files requiring updates:
- README.md (badge, PHPUnit count, line counts, bgcolor→background)
- docs/ARCHITECTURE.md (version, i18n count, line counts)
- .github/copilot-instructions.md (version, SSLV lines, PF lines)
- wiki/Home.md (i18n count, PHPUnit count)
- Mediawiki-Extension-Layers.mediawiki (version, line counts)
- docs/LTS_BRANCH_STRATEGY.md (version)
- docs/SLIDE_MODE.md (version)

### 7B: Stale Documents (10 items, ~2 hours)

| Document | Action |
|----------|--------|
| docs/UX_STANDARDS_AUDIT.md | Major rewrite or archive |
| docs/SHAPE_LIBRARY_PROPOSAL.md | Rename; update status |
| docs/SLIDE_MODE.md | Update implementation status |
| docs/INSTANTCOMMONS_SUPPORT.md | Fix `layers=on` → `layerset=on` |
| docs/NAMED_LAYER_SETS.md | Remove proposal language |
| docs/ARCHITECTURE.md | Fix VERSION code sample |
| docs/FUTURE_IMPROVEMENTS.md | Fix numbering; move completed |
| CHANGELOG.md | Add v1.5.53, v1.5.54 entries |
| wiki/Changelog.md | Mirror CHANGELOG.md |
| README.md | Fix `bgcolor=` → `background=` |

### 7C: Cross-Reference Consistency (16 items, ~1 hour)

Systematic pass to align all metric references. Use
docs/DOCUMENTATION_UPDATE_GUIDE.md as the checklist.

---

## Recommended Execution Order

1. **Quick wins first** (Phases 1-3 quick wins): ~1 hour for 10 fixes
   - P1-019, P1-020, P1-011, P2-017, P2-015, P3-004, P2-016,
     P2-020, P3-003, P3-001
2. **Phase 1 remaining**: Critical rendering and data bugs
3. **Phase 7A**: Version/metrics sync (prevents confusion)
4. **Phase 2**: Security hardening
5. **Phase 3 remaining**: Reliability fixes
6. **Phase 7B-C**: Stale documents and cross-references
7. **Phase 4-6**: Code quality, performance, infrastructure

---

## Progress Tracking

When an issue is fixed:
1. Mark it ✅ in this plan with the version number
2. Update docs/KNOWN_ISSUES.md status
3. Add a CHANGELOG.md entry
4. Add regression test(s) where applicable
5. Run `npm test` and `npm run test:js` to verify no regressions

---

## Change Log

| Date | Changes |
|------|---------|
| 2026-02-10 | v34 (batch 3): Fixed 6 more issues (P1-015, P2-007, P2-012, P2-023, P2-025, P3-006 by-design). ThumbnailRenderer shadow isolation, DOMParser SVG sanitizer, duplicate dialog cleanup (~200 lines removed), dead module reference, duplicate message keys. 12 new tests added. 11,321 tests passing. Phase 2 now 100% complete. |
| 2026-02-10 | v34 (continued): Fixed 5 more issues (P1-014, P2-008, P2-018, P2-019, P2-021). Rich text word wrap font metrics, sanitizeString math angle brackets, shadow/effects canvas caching, long word overflow, SchemaManager DI. 9 regression tests added. 11,337 tests passing. Phase 3 now 100% complete. |
| 2026-02-09 | v34: Fixed 23 issues (P1-011, P1-012, P1-017, P1-018, P1-019, P1-020, P2-009, P2-013, P2-014, P2-015, P2-016, P2-017, P2-020, P2-026, P3-001, P3-002, P3-003, P3-004, P3-005, P3-007). Added version-counter caching for SmartGuides. DB schema patches for CASCADE→SET NULL and ls_name NOT NULL. 13 regression tests added. 11,328 tests passing. |
| 2026-02-09 | v33: Fresh comprehensive review. Added 4 new P1 (v33-1 through v33-4), 8 new P2, 7 new P3. Updated totals. Corrected Phase 1 counts (was claiming 8 fixed, 2 open; actual is 4 fixed, 10 open). |
| 2026-02-08 | v29: Added Phases 5-6, infrastructure items, 42 doc issues |
| 2026-02-08 | v28-fix: Marked 7 items as fixed |
| 2026-02-08 | v28: Restructured from v27 findings |
| 2026-02-07 | v27: Initial improvement plan |
