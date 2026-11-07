# Import dialog guidance

**Status:** approved by the owner on November 7, 2026: “I approve this change.”
**Requested:** November 7, 2026. The owner wants Import to explain its purpose
and requirements to people who are not experts.
**Advances:** Milestone 1 / HIST-4–HIST-5: understandable, independent copying
of page-owned layer sets through the existing editor.

## What people see and do

Readers see no change. Clicking **Import** in the editor opens the existing
dialog with explanatory text immediately below its title and above the source
search. It is visible without opening another help control. The explanation
uses the current destination's media type, matching name and file, so users
only read the requirements relevant to their work.

## Exact approved wording

Common introduction:

> Import lets you reuse saved work from another wiki page. It makes an independent copy: changes here do not change the original, and later changes to the original do not update your copy.

Show one matching-source paragraph:

- **Image:** “You can import a layer set named ‘$1’ from another wiki page using the same image, $2. Other names, files and media types are not supported.”
- **Slide:** “You can import a slide named ‘$1’ from another wiki page. Other slide names, images and PDFs are not supported.”
- **PDF:** “You can import a layer set named ‘$1’ from another wiki page using the same PDF, $2. The whole layer set is copied, matching PDF pages by page number. Other names, files and media types are not supported.”

Common search guidance:

> Enter the beginning of the source wiki page's title below. The source must be saved and readable by you. Sources on this wiki page are not offered.

Common action guidance:

> Choosing a source imports it immediately if this layer set is empty. Otherwise, you can append its layers or replace all existing layers. You can undo the import. Click Save in the editor to keep your changes.

`$1` is the actual name used by the source filter, including its saved name
while a rename is pending; `$2` is the matching file title. Both are rendered
as text through translated messages, never interpreted as markup.

## Preservation and presentation

Nothing is removed. Existing title, search wording, results, status messages,
version notices, confirmation, Append, Replace all layers, Cancel, keyboard
behavior and focus remain. Guidance stays available during confirmation.
Text wraps on narrow screens; the dialog scrolls and its controls remain
reachable. Associate search guidance with the search field for assistive
technology. This changes explanation only, not eligibility, copying, canvas
handling, PDF mapping, Undo, draft recovery or Save. General import from
arbitrary files or names is a separate proposal.

## Verification after approval

Use the current Import dialog tests to check image, slide and PDF variants;
check matching names during pending renames and literal special characters.
Verify the actual dialog on the maintained 8080 wiki at desktop and narrow
widths, including search, confirmation and Cancel, and show the owner the
screens. The frozen 8082 candidate is not silently replaced.

## Implementation and verification — November 7, 2026

Implemented in the checkout used by port 8080. The shared Import control renders
the approved text through six registered, documented translation messages.
It uses the source filter's matching identity rather than an unsaved new name.
Search guidance is associated with the input using `aria-describedby`.

All 71 tests in the Import control, image/slide integration, whole-PDF
integration and ResourceLoader suites passed. Tests cover literal special
characters, saved names during pending renames, all three help variants and
existing Import/Undo/Save/Cancel flows. JavaScript and CSS lint, translation
validation, message wiring and code-growth checks passed; the wiring checker
retains its 72 existing unused-message warnings.

Browser checks loaded the real dialog, CSS and messages through MediaWiki's
ResourceLoader on 8080, using an isolated sample source catalog without login
or wiki writes. All three media types passed at 1280 × 900 and 390 × 640:
guidance starts at the top, no horizontal overflow, search works, confirmation
retains the guidance, and Cancel remains reachable and restores focus without
applying an import. A preceding 390 × 900 check also passed. Desktop and narrow
screenshots were captured and visually reviewed. These are component layout
checks on the native wiki, not a new authenticated end-to-end publication or
physical-device qualification. The frozen 8082 candidate remains unchanged.
