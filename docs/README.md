# Layers Extension Documentation

**Last Updated:** March 17, 2026

This directory contains technical documentation for the Layers MediaWiki extension. For user-facing documentation, see the [wiki/](../wiki/) directory.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | **Start here** - System architecture, module relationships, Mermaid diagrams |
| [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md) | Getting started guide for new contributors |
| [API.md](API.md) | API endpoints reference (layersinfo, layerssave, layersdelete, layersrename, layerslist) |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Current bugs, limitations, and workarounds |

---

## Documentation Categories

### Core Architecture
- [ARCHITECTURE.md](ARCHITECTURE.md) - Module structure, delegation patterns, Mermaid diagrams
- [RENDERING_ARCHITECTURE_ANALYSIS.md](RENDERING_ARCHITECTURE_ANALYSIS.md) - Canvas rendering pipeline analysis

### Developer Guides
- [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md) - Setup, testing, contribution workflow
- [CSP_GUIDE.md](CSP_GUIDE.md) - Content Security Policy compliance
- [LTS_BRANCH_STRATEGY.md](LTS_BRANCH_STRATEGY.md) - Long-term support versioning strategy
- [REFACTORING_PLAYBOOK.md](REFACTORING_PLAYBOOK.md) - Patterns and process for safe refactoring
- [DOCUMENTATION_UPDATE_GUIDE.md](DOCUMENTATION_UPDATE_GUIDE.md) - Checklist for doc updates on release
- [RELEASE_GUIDE.md](RELEASE_GUIDE.md) - Release checklist and process

### Features
- [NAMED_LAYER_SETS.md](NAMED_LAYER_SETS.md) - Multiple named annotation sets per image
- [WIKITEXT_USAGE.md](WIKITEXT_USAGE.md) - Wikitext syntax for embedding layers
- [SLIDE_MODE.md](SLIDE_MODE.md) - Slide presentation mode
- [SHAPE_LIBRARY_PROPOSAL.md](SHAPE_LIBRARY_PROPOSAL.md) - Built-in shape library (1,385 shapes)
- [INSTANTCOMMONS_SUPPORT.md](INSTANTCOMMONS_SUPPORT.md) - Foreign file / InstantCommons support

### Quality & Standards
- [ACCESSIBILITY.md](ACCESSIBILITY.md) - ARIA roles, keyboard navigation, screen reader support
- [UX_STANDARDS_AUDIT.md](UX_STANDARDS_AUDIT.md) - UX consistency audit results
- [PROJECT_GOD_CLASS_REDUCTION.md](PROJECT_GOD_CLASS_REDUCTION.md) - God class tracking and reduction plan

### Troubleshooting & Postmortems
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md) - Current bugs and limitations
- [layers-all-troubleshooting.md](layers-all-troubleshooting.md) - Layer visibility troubleshooting
- [POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md](POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md) - Boolean serialization bug
- [POSTMORTEM_IFRAME_MODAL_500_ERROR.md](POSTMORTEM_IFRAME_MODAL_500_ERROR.md) - Iframe modal HTTP 500
- [POSTMORTEM_TEXTBOX_DEFAULTS.md](POSTMORTEM_TEXTBOX_DEFAULTS.md) - Textbox defaults regression

### Planning & Proposals
- [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md) - Active feature proposals and ideas
- [GOD_CLASS_REFACTORING_PLAN.md](GOD_CLASS_REFACTORING_PLAN.md) - Refactoring plan for large files
- [SLIDES_REQUIREMENTS.md](SLIDES_REQUIREMENTS.md) - Slide mode feature requirements
- [SLIDE_MODE_ISSUES.md](SLIDE_MODE_ISSUES.md) - Known slide mode issues

---

## Archive

The [archive/](archive/) directory contains completed feature requests, historical bug fixes, and superseded documentation. These are preserved for reference but are no longer actively maintained.

**Archived documents include:**
- Completed feature requests (Layer Groups, Auto-Create Layer Set, Context-Aware Toolbar, Enhanced Layerslink)
- Historical bug fix documentation and postmortems
- Original developer specification (guide.md)
- One-time audits (Event Listener Audit, Structure Suite Status)
- Full feature implementation history (FUTURE_IMPROVEMENTS_FULL.md)

---

## Related Files

| File | Location | Purpose |
|------|----------|---------|
| [README.md](../README.md) | Root | Project overview, installation, quick start |
| [codebase_review.md](../codebase_review.md) | Root | Comprehensive code quality assessment |
| [improvement_plan.md](../improvement_plan.md) | Root | Technical debt remediation roadmap |
| [copilot-instructions.md](../.github/copilot-instructions.md) | .github | AI contributor guidelines |
| [CHANGELOG.md](../CHANGELOG.md) | Root | Version history |

---

*This index is maintained to reduce documentation sprawl. If you add a new document, please update this index.*
