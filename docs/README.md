# Layers documentation

Destination: the [project charter](PROJECT_CHARTER.md) defines what Layers 2.0 contains and what must be true to declare it finished.

Active milestone: [page ownership and native page history](MILESTONE_1_RELEASE_CHECKLIST.md). The [release preparation checklist](RELEASE_PREPARATION.md) tracks cleanup, documentation and upgrade readiness. Work stays in this milestone until its acceptance; search, Cargo readiness, Cargo and on-page links follow in that order.

**Layers is a MediaWiki extension, not a Docker-based application. Docker is only used for our development/test environment. Layers features must not require or provide Docker workers, host supervisors, PowerShell or .NET backends.**

Entry guides updated October 24, 2026. The candidate covers images, PDFs and standalone slides after migration completion. The manifest still reports 1.5.95; this is not a tagged Layers 2.0 release. Dated designs and older wiki guides require the review tracked in release preparation.

## Find the right guide

| Audience/task | Start here |
| --- | --- |
| Understand current behavior and limitations | [Release checklist](MILESTONE_1_RELEASE_CHECKLIST.md) · [Current status](CURRENT_STATUS.md) · [Known limits](KNOWN_ISSUES.md) |
| Install, configure and upgrade | [Installation](../wiki/Installation.md) · [Upgrade and recovery](UPGRADING.md) · [Configuration](../wiki/Configuration-Reference.md) · [Permissions](../wiki/Permissions.md) |
| Create diagrams, presentations and annotations | [Quick start](../wiki/Quick-Start-Guide.md) · [Slides](../wiki/Slide-Mode.md) · [Tools](../wiki/Drawing-Tools.md) |
| Embed content and choose sets | [Wikitext](../wiki/Wikitext-Syntax.md) · [Named sets](../wiki/Named-Layer-Sets.md) |
| Integrate with the current API | [API entry point](API.md) · [Native API guide](PAGE_OWNED_API_GUIDE.md) · [Legacy API reference](../wiki/API-Reference.md) |
| Contribute code | [Contributing](../CONTRIBUTING.md) · [Architecture](ARCHITECTURE.md) · [Onboarding](DEVELOPER_ONBOARDING.md) · [Testing](../wiki/Testing-Guide.md) |
| Assign implementation work | [Ordered junior/lead task packets](IMPLEMENTATION_HANDOFF_PLAN.md) · [Junior implementation review](JUNIOR_IMPLEMENTATION_REVIEW.md) · [Product roadmap](../improvement_plan.md) |
| Investigate a defect | [Troubleshooting](../wiki/Troubleshooting.md) · [R6 review](../codebase_review.md) · [Security](../SECURITY.md) |
| Plan revision-controlled visual content | [Implementation contract](PAGE_OWNED_HISTORY_IMPLEMENTATION.md) · [Internal document format](PAGE_OWNED_DOCUMENT_FORMAT.md) · [Current native API guide](PAGE_OWNED_API_GUIDE.md) · [Dated API design contract](PAGE_OWNED_API_CONTRACT.md) · [Admission design](PAGE_OWNED_ADMISSION_DESIGN.md) · [Internal read contract](PAGE_OWNED_READ_CONTRACT.md) · [Private delivery design](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md) · [Page history, search and Cargo proposal](proposals/CARGO_SEARCH_PAGE_HISTORY.md) |
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
