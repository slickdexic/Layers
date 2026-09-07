# Layers documentation

Updated September 6, 2026. Current documentation covers images, PDFs and standalone slides. The main branch still reports 1.5.95 with subsequent fixes; a proposal is not a released capability.

## Find the right guide

| Audience/task | Start here |
| --- | --- |
| Understand current behavior and limitations | [Current status](CURRENT_STATUS.md) · [Known issues](KNOWN_ISSUES.md) |
| Install, configure and upgrade | [Installation](../wiki/Installation.md) · [Configuration](../wiki/Configuration-Reference.md) · [Permissions](../wiki/Permissions.md) |
| Create diagrams, presentations and annotations | [Quick start](../wiki/Quick-Start-Guide.md) · [Slides](../wiki/Slide-Mode.md) · [Tools](../wiki/Drawing-Tools.md) |
| Embed content and choose sets | [Wikitext](../wiki/Wikitext-Syntax.md) · [Named sets](../wiki/Named-Layer-Sets.md) |
| Integrate with the current API | [API entry point](API.md) · [Action API reference](../wiki/API-Reference.md) · [Save payload contract](SAVE_PAYLOAD_CONTRACT.md) |
| Contribute code | [Contributing](../CONTRIBUTING.md) · [Architecture](ARCHITECTURE.md) · [Onboarding](DEVELOPER_ONBOARDING.md) · [Testing](../wiki/Testing-Guide.md) |
| Investigate a defect | [Troubleshooting](../wiki/Troubleshooting.md) · [R6 review](../codebase_review.md) · [Security](../SECURITY.md) |
| Plan revision-controlled visual content | [Implementation contract](PAGE_OWNED_HISTORY_IMPLEMENTATION.md) · [Page history, search and Cargo proposal](proposals/CARGO_SEARCH_PAGE_HISTORY.md) |
| Maintain/publish docs | [Maintenance guide](DOCUMENTATION_UPDATE_GUIDE.md) · [Release guide](RELEASE_GUIDE.md) · [Wiki publishing](../wiki/README.md) |
| Review documentation scope | [Inventory](DOCUMENTATION_INVENTORY.md) · [Documentation review](DOCUMENTATION_REVIEW_REPORT.md) |

## Specialized references

[Accessibility](ACCESSIBILITY.md), [CSP](CSP_GUIDE.md), [foreign files](INSTANTCOMMONS_SUPPORT.md), [refactoring](REFACTORING_PLAYBOOK.md), and [branch policy](LTS_BRANCH_STRATEGY.md) describe specific implementation concerns. Design-era documents such as [Slide Mode](SLIDE_MODE.md) explicitly distinguish their original proposal from current user behavior.

## Publication surfaces

- `wiki/` is the maintained source for the separate [GitHub wiki](https://github.com/slickdexic/Layers/wiki).
- [Mediawiki-Extension-Layers.mediawiki](../Mediawiki-Extension-Layers.mediawiki), [LayersGuide.mediawiki](../LayersGuide.mediawiki), and [Mediawiki-layer_sets-table.mediawiki](../Mediawiki-layer_sets-table.mediawiki) are source documents for MediaWiki publication. Editing them does not automatically update mediawiki.org.
- [CHANGELOG.md](../CHANGELOG.md) and [Current status](CURRENT_STATUS.md) have exact wiki mirrors.

## Historical material

[archive/](archive/) contains dated analyses, bug reports and completed design work. Other historical documents carry a notice at the top. Their metrics, file paths and resolved/open labels refer to their original investigation; use the current status and R6 review for present decisions. Historical records are preserved rather than rewritten to appear current.

License notices and the code of conduct are policy/attribution documents, not changing release metrics. Their substance is preserved.
