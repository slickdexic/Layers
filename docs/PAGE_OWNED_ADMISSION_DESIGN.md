# Page-owned publication admission: L01 decision record

September 11, 2026. **Implementation plan, not implemented enforcement.** Reviewed against Layers `651d9011` and the installed MediaWiki 1.45.3 source. The experimental publisher, content model and slot remain unregistered for production. Existing editor saves still use `layer_sets`.

This records the lead's chosen boundary for L01. The [history implementation contract](PAGE_OWNED_HISTORY_IMPLEMENTATION.md) controls milestone completion; the [handoff plan](IMPLEMENTATION_HANDOFF_PLAN.md) controls assignments. Images, PDF annotations and general-purpose slides use the same admission policy. A slide needs no backing file or SOP-specific workflow.

## Problem and decision

The internal publication service checks the caller's authority, owner, explicit base revision, document schema and exact sources. Registering the content model without a second boundary would let another save route submit a valid document without going through those checks. Schema validation alone does not establish permission to publish.

Use a request-local, single-use publication scope around the revision writer, matched by a `MultiContentSave` admission hook. Only the publication service may open this scope after its final authorization check. Ordinary edits retaining the exact inherited Layers content pass without a publication scope. New, replaced or removed Layers content must be classified explicitly; removal is initially unsupported and denied.

This is an integration boundary for trusted MediaWiki code, not protection from malicious PHP extensions or direct database writes. Other installed hooks can run afterward; compatible hook ordering and alternate persistence paths must be tested before public registration. Do not claim that one hook covers import or undelete paths that do not call it.

## Core evidence and constraints

Read directly from the running installation under `/var/www/html/includes/`:

| Core source | Consequence |
| --- | --- |
| `content/ValidationParams.php` | Contains page identity, flags and parent revision ID; no original Authority or slot role. Keep content-handler validation structural. |
| `Storage/Hook/MultiContentSaveHook.php` | Receives a rendered proposed revision, author `UserIdentity`, summary, flags and failure status. The author is not the original caller's Authority. |
| `Storage/PageUpdater.php` | Captures the parent, prepares content and invokes `MultiContentSave` before creating/modifying the page; other save hooks follow. Inherited slots are present in the proposed revision. |
| `Revision/RenderedRevision.php` | `getRevision()` exposes the proposed revision. It has not yet acquired its final committed revision identity. |

Never reconstruct unrestricted user authority from the author, use a global request user for a job, or treat a rendering audience as publication authorization. The writer's existing primary-parent comparison and core conflict detection remain mandatory. A matching scope is not a substitute for concurrency checks. These observations establish the 1.45.3 design baseline; supported-version parity remains unproven.

## Scope contract

Proposed new components are `src/Revision/PublicationAdmissionContext.php` and `src/Hooks/PageOwnedAdmissionHooks.php`; names may change during lead implementation. The context is service-instance state, never a static flag, client parameter, persisted token or user preference. Its only write entry point is a callback-scoped operation used by `PagePublicationService`.

The immutable intent contains:

- The original Authority and expected revision-author identity, without widening rights.
- The owner page identity: existing page ID plus namespace/database title; for creation, namespace/database title and base zero. Do not match only a display title.
- The explicit parent revision ID and permitted action (add or replace the `layers` role).
- The expected model and canonical Layers content, compared exactly or through a collision-resistant digest of canonical bytes with model/role bound separately.
- Expected changes to other slots, including an optional main-slot replacement. An unrelated or additional slot mutation cannot borrow the scope.

Open the scope immediately around `PageRevisionWriter::save`, after final owner/source authorization. The hook matches the complete proposed save, consumes the scope once on admission and fails closed on mismatch. Close it in `finally`, including failed saves, exceptions and no-ops. Initially reject nested publication scopes explicitly; supporting nesting is unnecessary for one atomic owner-page publication. A retry must repeat validation and open a fresh scope.

An unchanged Layers save must not consume a scope intended for a different mutation. If the intended publication itself is a no-op, scope cleanup still happens even if core skips a hook or creates no revision. Tests must cover both paths. Do not put authority objects, document JSON, tokens or private source details in admission logs.

## Classification and admission rules

Compare the proposed slots with the exact captured parent belonging to the same owner. Use an internal parent read only for classification; never return privileged parent content or hidden-source details to the caller. Parent lookup failures fail safely where classification cannot be established. Do not use a replica's latest revision as the parent.

| Proposed change | Initial behavior |
| --- | --- |
| Neither parent nor proposed revision contains the Layers role/model | Leave core behavior unchanged. Avoid source resolution or Layers authorization work. |
| Same Layers role, model and exact serialized content inherited; only main/other ordinary slots change | Allow normal core save processing without fresh `editlayers` or source checks. Retaining old annotations must not depend on old asset availability. |
| Add or change Layers content | Require the matching, unconsumed service scope and correct role/model placement. Structural validation and core conflict checks still apply. |
| Remove Layers role, replace it with a foreign model, or put the Layers model in another role | Deny initially, including through an otherwise authorized service scope. |
| Creation with Layers | Require base zero, exact target identity, expected main content and admitted snapshot. |
| Undo, rollback, import, maintenance or restore attempts that change Layers | No implicit bypass based on username, bot/sysop status or edit flags. A future explicit adapter must authorize a new publication. |

Use exact stored content equality for the unchanged fast path, not only a document ID, layer count or source hash. Canonical formatting changes count as a replacement if stored bytes change. Existing malformed/wrong-role content has no sanctioned production history yet; repair policy is deferred, not a hidden bypass. Schema validation may independently reject invalid inherited content.

Source-free slides follow the same owner/base checks. For changed image/PDF content the existing resolver must verify exact local source versions; admission does not newly promise PDF page validation, retained bytes, historical rendering or safe delivery. Those remain J06/L02 work.

## Failure behavior and lifecycle limits

Reject through a fatal hook status without committing any slot or advancing the owner revision. Add a localized, generic admission failure message and explicit publication-service error mapping. Do not report every denial as an edit conflict or expose internal exception text. A real parent conflict keeps its existing conflict meaning. Test responses and database effects together.

Core operations that insert historical revisions without this hook need a route inventory and separate policy. In L01, keep production registration off while documenting which import, undelete and maintenance routes require L03 adapters or controlled prohibition. A test demonstrating denial through `PageUpdater` is not evidence that all import paths are secured.

Eventually disabling new publication must retain read/model support for stored content. Do not add a production feature flag or register only the model/endpoint during this task. Test registration must install the model, role, service and hook coherently in the isolated core harness and restore the test service container afterward.

## Ordered implementation and review gates

1. **L01a, lead:** implement scope lifecycle and hook classification, including exact parent/owner matching, one-use intent and safe status mapping. Integrate only with the internal service and isolated test registration. Inventory bypassing core routes; document unresolved lifecycle gates.
2. **L01b, lead:** prove the security matrix below against real core revisions, including scoped Authority and concurrent writes. Correct the architecture if the hook cannot bind the complete planned save. Freeze the test registration helper and safe fixture teardown contract.
3. **J06, junior, only after L01b:** implement the existing real-image/PDF/slide and HTTP fixture packet using the frozen harness. No new permission policy, live-wiki registration or source-retention design. Return unexpected core behavior to the lead.
4. **L02, lead:** historical read/asset delivery and controlled enablement. Public history remains blocked until the later ownership/lifecycle and release gates also pass.

There is no new ready junior product task before L01b. Avoid spending another batch on speculative editor changes or tests that merely duplicate the proposed hook. J06 remains the next junior assignment; its dependency is specific and intentionally not waived.

## Required real-core acceptance matrix

These are required tests, not passing-test claims. Add them under `tests/phpunit/core/`, alongside the existing publication and revision-writer suites. Every rejection must assert no new revision and unchanged main/Layers content. Successful mutations must assert author, summary, parent and atomic slot contents.

| Case | Required result |
| --- | --- |
| Admitted slide creation; image/PDF/mixed snapshot replacement | One genuine owner revision; main and Layers changes atomic. Mock-source evidence clearly distinguished from real assets. |
| Direct `PageUpdater` add/replace/remove, including a user with `editlayers` | Changed Layers denied without service scope; no revision. |
| Wrong owner, base, author, snapshot, role/model or extra slot mutation | No borrowing a valid scope; no partial write. |
| Replay; nested scope; exception before/during save; no-op then another save | Scope cannot leak or authorize a later operation. |
| Restricted Authority; permission revoked before final publication check | No widening to unrestricted author permissions. |
| Main-only edit with unchanged Layers and unavailable historical asset | New main revision retains exact snapshot without resolving sources again. |
| Concurrent winner after parent capture | Loser rejected; winner and its Layers snapshot preserved. |
| Parent lookup failure; hook fatal status; missing context service | Safe failure and stable error mapping; no private content in response/logs. |
| Legacy named-set operations and pages without Layers slots | Existing behavior remains unaffected by isolated registration. |
| Alternate import/restore route inventory | State whether hook runs; uncovered routes remain explicit enablement blockers. |

L01 completion requires implementation, passing core evidence and updated API/history contracts. This decision record alone satisfies only the design step.
