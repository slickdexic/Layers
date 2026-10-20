# Whole-PDF Import: first Save into an absent layer set

This inactive native service advances page ownership and revision history,
data preservation and authorization. It adds no caller, endpoint or interface.

PageMissingPdfImportPublicationService publishes a complete proposed document
through the existing MediaWiki page publisher. Its target is an existing owner
whose saved direct PDF embedding names a layer set with no stored member.
The request supplies the current revision, exact embedding bytes and byte
offset, plus exact source owners, revisions and member anchors.

Native admission supplies every PDF page. All internal pages keep the same
visible layer-set name and native current-base member IDs. Different readable
versions of the same PDF are permitted. Source layers match destination pages
by page number; the destination retains its admitted file version, canvas and
background. Layer coordinates are not automatically scaled. Both file versions
remain subject to independent exact-version and visibility checks. The approved
version-difference notice belongs to the separate interface integration.
Pending renames and older temporary member IDs remain separate integration work.

The proposed document must retain the complete original root and sibling layer
sets. Only canvas, layers and reading order may change on the admitted members.
Even an empty source page has a destination member. Unsupported fields, omitted
pages, stale revisions and altered file or owner identities refuse the Save.

Each distinct source owner/revision/file/name group receives one native revision
summary citation. Repeated member anchors do not duplicate it. Optional owner
words are appended; provenance is never truncated to fit.

The service repeats current-owner authorization, original-base visibility,
source visibility and exact file witnesses immediately before publication and
again afterward inside a cancelable native transaction. A late refusal rolls
back the entire Save. The normal publisher retains its secure write and rate
checks; the service does not retry against a newer revision.

Preparation results are detached evidence, not authorization tokens. Complete
editor application, Undo/drafts, HTTP delivery and browser acceptance remain
required before activation.

## Registered native request boundary

Separate native API callers extend the service-only scope above. They are
registered; production editor and Import controls remain unconnected to them.
Existing stored-target APIs and interfaces keep their existing behavior.

The POST-only layersmissingpdfimportread action requires targetpageid, baserevid,
embedstart, embedtext, sourcepageid, sourcerevid and sourcesurface. It repeats
native admission and returns a version-1 ASCII-JSON data envelope containing
targetAdmission, source, sourceBundle and sourceGroup. Responses request private
zero-age caching. The native read rate limiter still applies. A preparation is
never a token authorizing application, recovery or Save.

Embed text, source member IDs and submitted JSON use native raw parameters:
their exact UTF-8 bytes are preserved without Unicode normalization. Native byte
limits and the services' syntax, identity and authorization checks still apply.

The layersmissingpdfimportpublish action requires POST, a CSRF token, editlayers
and native Save rate checks. It takes targetpageid, baserevid, embedstart,
embedtext, data and importsources, with optional summary. Each source record
contains exactly sourcePageId, sourceRevisionId and sourceSurfaceId. Literal
duplicate JSON member names and malformed records refuse before publication;
identical repeated records receive only one native source citation. Arbitrary
maintext replacement is refused.

A successful write returns version 1, result Success and the new revid. If
publication committed but the success response cannot be delivered, the result
is layers-publication-outcome-unknown. Callers must not treat that as a refused
Save or retry automatically. Exact embedding bytes, current revision and fresh
per-side visibility/file checks are repeated by the native services.

Native API execution does not qualify final HTTP/session headers, editor
application, pending names, historical temporary IDs, browser/mobile or owner
acceptance. Those remain required before complete Import activation.

## Literal Unicode in existing Save requests

The existing layerspublish data parameter and
layersworkingcopypdfimportpublish data parameter preserve literal UTF-8 snapshot
text using MediaWiki's native raw parameter type. The ordinary layerspublish
maintext parameter likewise preserves submitted wikitext. A decomposed accent
and its composed equivalent remain distinct, whether the caller uses literal
Unicode or JSON escape sequences. Snapshot serialization still uses the existing
canonical JSON format; content strings are not normalized or repaired.

Existing byte limits, schema validation, owner/source checks, CSRF requirements,
rate limits and failure handling continue to apply. Titles and edit summaries
retain their existing native parameter handling. This preservation correction
does not activate additional editor callers or change the Import interface.
