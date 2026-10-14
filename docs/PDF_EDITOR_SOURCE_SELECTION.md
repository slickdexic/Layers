# PDF editor source selection

A saved PDF layer set uses the file version recorded in its source pin.
Editor admission interprets native page options against that version's page
count, including when a newer upload has fewer or more pages. All internal
pages retain the same layer-set name.

Native option spellings and ordering remain supported. An out-of-range page
uses the existing native upper-bound behavior within the selected source
version. A stored internal page opens its exact saved payload; an unstored
internal page starts empty with that same source pin. Neither operation saves
a revision or changes another member.

The source resolver checks native authorization, visibility, exact timestamp
and hash, and complete matching PDF members before selection. An unavailable
or contradictory saved source refuses admission rather than selecting the
newer upload. Same-name sets on different files or owning pages stay independent.

A still-missing layer set uses the current file's native page selection.
Existing image/slide selection, migration/copy interpretation and earlier-draft
matching keep their existing behavior. This contract covers editor admission;
on-page thumbnail binding and complete missing-PDF editor integration require
separate qualification.
