# Quick start

This guide covers images, standalone slides and PDFs. First install Layers and confirm your account can edit layers; see [[Installation]] and [[Permissions]].

## Annotate an image

1. Open an uploaded image's File page and choose **Edit Layers**.
2. Add a textbox, callout or shape. Use the Pointer tool to select and position it.
3. Save the set with a descriptive name, such as `annotations`.
4. Embed it in an article:

```wikitext
[[File:Diagram.png|600px|layerset=annotations]]
```

## Create a standalone slide

1. Visit `Special:Slides` and create a slide, or open `Special:EditSlide/SafetyProcedure`.
2. Add your instructions using textboxes/callouts and drawing tools, then save.
3. Embed it:

```wikitext
{{#Slide: SafetyProcedure | size=800x600}}
```

To specify creation dimensions in markup, add `canvas=1200x800`. Display size and canvas coordinates are different. Add `layerset=annotations` if you saved that named set. Slides need no placeholder image.

## Annotate a PDF

The wiki must first display PDF thumbnails correctly. Open the File page, choose Edit Layers and navigate to the required page. Each PDF page has its own sets and dimensions.

```wikitext
[[File:Manual.pdf|page=2|600px|layerset=annotations]]
```

Page turns keep edited pages in memory. Save writes changed pages one at a time. If a save fails, keep the editor open and retry; the whole document is not saved atomically. A browser refresh can lose unsaved in-memory work.

## View and share

Use the lightbox action for a larger view. `layerslink=editor-modal` opens the editor in a modal when same-origin framing is configured. See [[Wikitext Syntax]] for click behavior and named sets. Check exported output when layout or complete document coverage matters; current export limitations are listed in [[Current Status]].

## Before using slides for controlled SOPs

Saving Layers does not reliably create an article history revision, and slide text is not yet integrated with wiki full-text search. Existing layer revisions and slide-name filtering do not replace those capabilities. See [[Current Status]] for the implementation roadmap.
