# PDF creation editor integration

This integration advances milestone 1 criteria HIST-4, HIST-1, DATA-1, and UI-10. It connects creation of a PDF layer set to the existing page-owned editor while preserving the established image, slide, and saved-PDF routes.

## Native admission and editor startup

The bound `Special:EditLayersPage` request first uses the existing page-owned pilot to verify the owning page, selected embed, and revision. For a missing PDF layer set, it then composes complete creation preparation: the exact target and selection, PDF source and requested page, initial page anchor, and the full existing Layers-slot bundle. Preparation supplies editor data; it does not authorize a publication. The existing page and owner return target remain authoritative.

The page-owned ResourceLoader module registers the creation transaction, read client, host, saved-session handoff, outcome reader, draft controller, lifecycle, and editor integration in dependency order. `EditorBootstrap` loads that module for page-owned editor configuration. `APIManager` chooses the creation integration when `pdfCreation` is present, but creates the Host only when the editor calls `loadLayers()`, after Canvas and History state exist. The initial canvas image loader is cancelled before native exact-page staging to prevent competing background loads. This branch routes reads and writes through the page-owned creation and publication clients; legacy file layer-set reads and writes are not used for this session.

## Drafts, Save and explicit check

The creation host and controller preserve the complete finite working snapshot and per-page history. Review occurs before autosave is enabled. The separate exit writer preserves an independent backup before handoff or clean close. Save invokes the native publication path with its expected base revision. A successful reply is retained as known even if later handoff or local backup work fails; the failure does not claim successful handoff or local persistence. Current work and its saved markers remain intact.

After a confirmed first Save, handoff performs fresh saved-PDF admission and returns the ordinary saved bridge and PDF coordinator. The integration installs them and creates the normal draft lifecycle with exact write readback against its own writer, independently of any writer selected for recovery. Installation preserves newer editor work and Undo history. Explicit Check performs reads and reconciliation only; it never automatically posts or retries Save. A present payload is not proof that this request created the revision.

The existing Save/Discard close dialog remains the user's choice. Explicit Discard retires only this controller's exact owned live and exit records. A cancelled, unpublished recovery review can use the same narrow Discard path; it does not authorize Save or clean close. Creation and saved-session exit preservation run in capture phase before editor teardown, including while saved-draft recovery is pending.

## Qualification still open

This integration does not qualify PDF overlay creation, whole-PDF import, or the viewer. Actual browser and mobile behavior, MediaWiki 1.44 acceptance, HTTP behavior, and project-owner acceptance remain open. Existing image, slide, saved-PDF, viewer, and owner-return behavior must remain intact through that qualification.
