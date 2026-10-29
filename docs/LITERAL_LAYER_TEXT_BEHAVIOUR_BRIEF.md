# Literal layer text: proposed behavior

**Status:** Owner approved October 28, 2026; implementation and acceptance in
progress. Advances DATA-1 and page-owned history.

## What a reader and editor see

Text entered in a text layer, text box, callout or rich-text run stays as
written through editing, Save, reopen and viewing. For example, `a<b>c` and
`<button>` remain visible as those literal characters. Markup-looking text is
text, not executable HTML or a new link. Viewing and export should display the
saved text subject to their existing supported formatting and media limits.

If text cannot be safely accepted or exceeds an existing bound, the editor
must not silently delete or rewrite it. A refusal preserves current work and
uses the existing error/recovery flow. Layer names, identifiers, links, SVG,
other properties, controls and authorization keep their existing rules.

## Validation before completion

Trace the text through inline editing, plain and rich text, native and legacy
Save, history, viewing, search/Cargo boundaries and export. Check that unsafe
markup is rendered as text in every HTML context, cannot execute, and does not
become a file or command reference. Test exact round trips, rejected inputs,
malicious-looking strings, migration and pre-existing history. Do not weaken
source authorization, payload limits or the native loss-detection guard.
Show the implemented behavior to the owner before declaring it complete.

## Candidate evidence, October 28

The local candidate preserves the examples through the real editor update and
native revision publication paths. Focused tests check that markup-looking text
is escaped in the editor and that executable markup is refused without creating
a revision. Server-side thumbnail text handling is covered for six layer types.
The full client suite passed 19,036 tests; standalone PHP passed 1,684 tests with
one skip. The native publication slice passed two tests and seven assertions,
including reading the original revision after a later edit. A legacy conversion
test preserves the literal plain and rich text as well.
These results do not replace the outstanding browser Save/reopen, broader output
context and owner screen checks above.
