# Quick start

This guide describes the page-history candidate after migration completion.
First follow [[Installation]] and the [upgrade guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md), and
confirm your account has page-edit and layer-edit permission. Legacy 1.5.x shared
editing uses a different workflow.

## Annotate an image

1. Save this embed on the wiki page that will own the layer set:

```wikitext
[[File:Diagram.png|600px|layerset=annotations]]
```

2. Hover, focus or tap the embed and choose **Edit layers**.
3. Add a textbox, callout or shape, then Save. The change belongs to this page's
   native history.
4. Return to the owning page, reopen the overlay and check the saved layers.

## Create a standalone slide

1. Save this embed on the owning page:

```wikitext
{{#Slide: SafetyProcedure | size=800x600}}
```

2. Choose **Edit layers** on the slide, add content and Save.
3. Check the owning page's history and reopen the slide.

Add `canvas=1200x800` to specify creation dimensions. `size=800x600` controls
display size; it does not change canvas coordinates. Slides need no placeholder
image. The slide name is scoped to its owning page.

## Annotate a PDF

The wiki must first display PDF thumbnails correctly. Save this embed on the
owning page, choose its **Edit layers** overlay and navigate inside the editor:

```wikitext
[[File:Manual.pdf|page=2|600px|layerset=annotations]]
```

All PDF members share the visible name `annotations`; `page=2` selects the
displayed PDF page. Each member retains its own page geometry internally.
Page turns preserve pending work. Save publishes the complete owner snapshot in
one native revision. If Save refuses, keep the editor open and resolve the
reported condition. Review local drafts before explicitly restoring them.

## View and share

Choose **View full size** on the overlay. Images/slides offer **Download PNG**
and **Download PDF**; PDFs offer **Download PDF** only. Print and PDF Download
include the document's saved layers. Verify exported layout when distributing it.
To copy from another owner, use the editor's Import or Copy controls; equal
names do not merge different owners' layer sets.

## Before using slides for controlled SOPs

Confirm migration completion, a native owner revision for each successful Save,
historical viewing, recovery and permissions on your wiki. Then complete the
[candidate acceptance checklist](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_RELEASE_CHECKLIST.md).
Text search and Cargo acceptance follow page ownership as separate milestones.
