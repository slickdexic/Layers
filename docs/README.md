# Layers Extension Documentation

**Last Updated:** January 27, 2026

This directory contains technical documentation for the Layers MediaWiki extension. For user-facing documentation, see the [wiki/](../wiki/) directory.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | **Start here** - System architecture, module relationships, Mermaid diagrams |
| [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md) | Getting started guide for new contributors |
| [API.md](API.md) | API endpoints reference (layersinfo, layerssave, layersdelete, layersrename) |
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

### Features
- [NAMED_LAYER_SETS.md](NAMED_LAYER_SETS.md) - Multiple named annotation sets per image
- [WIKITEXT_USAGE.md](WIKITEXT_USAGE.md) - Wikitext syntax for embedding layers
- [SHAPE_LIBRARY_PROPOSAL.md](SHAPE_LIBRARY_PROPOSAL.md) - **NEW** Built-in shape library feature proposal

### Quality & Standards
- [ACCESSIBILITY.md](ACCESSIBILITY.md) - ARIA roles, keyboard navigation, screen reader support
- [UX_STANDARDS_AUDIT.md](UX_STANDARDS_AUDIT.md) - UX consistency audit results

### Troubleshooting
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md) - Current bugs and limitations
- [layers-all-troubleshooting.md](layers-all-troubleshooting.md) - Troubleshooting guide for layer visibility issues
- [POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md](POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md) - Boolean serialization bug analysis

### Planning
- [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md) - Active feature proposals and ideas
- [SHAPE_LIBRARY_PROPOSAL.md](SHAPE_LIBRARY_PROPOSAL.md) - Shape library feature proposal (v1.5.0)
- [RELEASE_GUIDE.md](RELEASE_GUIDE.md) - Release checklist and process

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
