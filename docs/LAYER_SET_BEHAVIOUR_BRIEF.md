# Layer sets on pages: behaviour brief

**Status:** for the project owner's approval, September 30, 2026. Nothing in this brief is built until it is approved. It restates decisions the owner has already made (charter D1 as amended, UI-10, HIST-9) and adds the wording and the cases around them. It is written in plain words: what a reader sees, what an editor sees and clicks, and what goes away.

Vocabulary: people see **layers** and **layer set**, never "drawing". Page IDs never appear in wikitext.

## 1. The model, in one paragraph

A layer set belongs to a file (or a slide), to a page, and has a name. A page's layer set called ABC on `Manual.pdf` is a different layer set from another page's ABC on the same file, and from this page's ABC on a different file. The same file used twice on one page with `layerset=ABC` is one layer set. Each page controls only its own layer sets. A PDF has one layer set name for the whole document; its pages are shown as "Page 1", "Page 2" and so on inside it. The author writes `[[File:Name.jpg|layerset=ABC]]` and nothing else; the system finds this page's layer set.

## 2. What a reader sees on a page

- The image, slide or PDF page with its layers, as today.
- **Hover** (or keyboard focus, or a tap on touch screens) shows the old overlay: **View full size**, and, only for people who may edit this page and have the right to edit layers, **Edit layers**. Readers who cannot edit see only View full size.
- There is **no list, box or notice** of links on the page.

## 3. The full-size viewer

The viewer the old overlay opened, for every page-owned layer set: zoom, pan, fit, paging for PDFs, **Print** and **Download** (the marked-up document as a PDF), Escape to close. It shows exactly the file version the layers were drawn on.

## 4. What an editor sees and clicks

**Edit layers** opens the editor on that embed's layer set. Cases:

| Case | What happens |
| --- | --- |
| The page already has this layer set | The editor opens it. |
| The page has none yet | The editor opens empty, titled with the name. The first save creates it. The page text is not changed. |
| Other pages have a layer set of that name on this file | The editor opens empty and says: "A layer set named “ABC” already exists on other pages. To start from one of them, use Import." **Import** lists those pages; choosing one copies it. The copy never follows the original. |
| The same file is used twice with the same name | One layer set; both embeds open it. |
| Two different files use the same name | Two layer sets. |
| A PDF | One layer set; the layers panel groups the pages under "Page 1", "Page 2"…; each page's layers are separate. |

Nobody can edit another page's layer set. The editor may show the page's name beside the layer set, for understanding. Page IDs are never shown or typed.

## 5. When the file gets a new version

- **Readers** keep seeing the file version the layers were drawn on, with its layers. Nothing changes for them, and no page revision is needed, because the page shows what it showed.
- **Editors** see a badge on the Edit layers overlay: "File updated: review layers".
- The editor opens on the version the layers were drawn on, with a banner: "A newer version of this file exists." and a button **Update to the new version**. That shows the new file with the layers on top, so they can be checked and moved. **Saving creates a revision in the page's history**, with the summary "Layers updated to the new version of File:Name.pdf".
- A PDF that now has fewer pages keeps the layers of the missing pages. Readers do not see them. The editor lists them as "Page 3 (not in the current version of this PDF)" with **Delete** and **Move to page…**. A PDF with more pages starts the new pages empty.
- A special page lists the layer sets whose file has a newer version, so reviewers can find them. Nothing is added to the pages themselves.

## 6. What goes away

- The box "Drawings on this page" and its links (edit, create, adopt, copy).
- The **Edit Layers** tab and `action=editlayers` on `File:` pages. Layers are edited where they are shown, on the page that owns them.
- Page IDs in wikitext: the migration, rename and copy write names only. Existing `layerset=8:002` embeds are tidied to `layerset=002` by a maintenance step (dry run first; the owner runs the commit).
- "Adopt": after the migration, shared sets are read-only, so there is nothing left to adopt.

## 7. The migration under this model

Each old shared set becomes a layer set of the page that shows it, with the **same name**. No numbering, no "(page N)" and no "<slide> (<set>)" names are needed. The wikitext does not change at all. If a page shows set ABC of file A and set ABC of file B, they are two layer sets. A PDF's per-page sets become one layer set with pages.

## 8. New and changed wording

Existing overlay words stay: "Edit layers", "View full size", "Print", "Download", "Fit". New: the badge, banners, Import message, Update button and page labels in sections 4 and 5. **Edit summaries** (new ones only; old history entries cannot change) say "layer set", for example "Copied the layer set “002” from [[:File:X.jpg]] (revision 2523)", "Restored the layer set “002” from revision 2523", "Created the layer set “002”". Every remaining message that says "drawing" (about 77) becomes "layer set" or "layers". The internal change tag keeps its name; its visible label says "Layer set edit".

## 9. Slides and `layerset=on` (owner's answers, September 30)

- **`layerset=on`** means the layer set called "Default" of that file on this page. If the page has none, Edit opens an empty one named "Default" and the first save creates it, like any other. It is kept as a deprecated shortcut for `layerset=Default`; the documentation recommends writing the name. (Old meaning, "the file's most recently saved set", ends with the migration: an embed that used it is rewritten to the name of the set it showed, unless that name is "Default".)
- **Slides** have no separate file, so a slide is identified by the page and its name: `{{#Slide:Name}}` on a page is that page's slide "Name". Another page's slide "Name" is a different slide, with its own canvas size and layers, and nothing links them. The editor can offer to **Import** from other pages' slides of the same name (the list shows each one's canvas size); Import copies the whole slide, canvas and background included, into a slide that is still empty, and never follows the original. `Slide:Name` pages made by the migration are ordinary pages that own a slide of that name.

## 10. For the owner to decide

1. **The test wiki:** may I run the step that removes `8:` from existing embeds, after a dry run you can look at?
2. **Import into a layer set that already has layers:** I propose it is not offered (nothing is overwritten); the editor's copy and paste of layers covers adding some. Agreed?

After approval: one build packet per section (overlays and viewer; the model and the migration; the editor cases; file updates; wording), each reviewed by the owner on screen before it is called done.
