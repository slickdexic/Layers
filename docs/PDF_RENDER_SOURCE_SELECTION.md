# Page-owned PDF rendering after reupload

A PDF layer set keeps one name across its internal pages. Its owning wiki page
revision records the file version and each stored page's layers. Reuploading a
shorter or longer PDF does not change those saved identities.

For named direct embeds, expanded templates and native gallery occurrences,
Layers retains the complete ordered native page options before core clamps them
to the current upload. It applies the resulting page number to the saved PDF
version, then binds only that internal page. A requested page beyond the saved
version's last page follows native upper-bound behavior. An absent stored member
does not substitute a different member. Images and still-missing sets keep their
existing current-file interpretation.

The parser stores binding and revision identities only. The existing private
read API checks the actual reader, exact owner revision, source visibility,
timestamp and hash before returning layers, the saved background and edit
controls. The bounds helper does not grant read or edit authority, transform an
archived file, or add saved-source URLs or layer payloads to shared parser output.
Unavailable, hidden, mismatched or inconsistent saved PDF sources refuse binding.

Linked captions do not contribute page options. Repeated occurrences and nested
gallery captions keep their own descriptors; native captions, alt text, links,
page syntax and the existing overlay/viewer controls remain intact.

Native coverage uses isolated repositories and actual MediaWiki parser/API calls.
The editor-selection contract is documented in
[PDF editor source selection](PDF_EDITOR_SOURCE_SELECTION.md). Full browser,
mobile, supported-version and project-owner acceptance remain separate release
checks. Rebuild or purge affected parser caches when deploying a rendering fix.
