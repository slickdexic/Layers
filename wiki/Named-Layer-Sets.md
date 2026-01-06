# Named Layer Sets

Organize multiple annotation sets per image for different purposes, audiences, or contributors.

---

## What Are Named Layer Sets?

Named layer sets allow you to maintain **multiple independent annotation sets** for a single image. Each set:

- Has its own collection of layers
- Maintains its own revision history
- Can be displayed independently via wikitext
- Has independent background visibility settings

---

## Use Cases

| Use Case | Example Sets |
|----------|--------------|
| **Educational** | `anatomy`, `labels`, `quiz-answers` |
| **Documentation** | `overview`, `detailed`, `troubleshooting` |
| **Multilingual** | `english`, `spanish`, `french` |
| **Review Process** | `draft`, `reviewed`, `approved` |
| **Different Audiences** | `beginner`, `advanced`, `expert` |

---

## Creating a Named Set

### From the Editor

1. Open the Layers editor on any File: page
2. Click the **layer set dropdown** (shows current set name)
3. Click **"Create New Set..."**
4. Enter a name (letters, numbers, hyphens, underscores only)
5. Click **Create**

### Naming Rules

- **Allowed characters:** `a-z`, `A-Z`, `0-9`, `-`, `_`
- **Length:** 1-50 characters
- **Case-sensitive:** `Labels` and `labels` are different sets
- **Reserved:** `default` is the default set name

### Examples

| Valid | Invalid | Reason |
|-------|---------|--------|
| `anatomy-labels` | `anatomy labels` | No spaces |
| `version_2` | `version 2.0` | No dots or spaces |
| `Tutorial_EN` | `Tutorial (EN)` | No parentheses |
| `step1` | `step#1` | No special characters |

---

## Switching Between Sets

### In the Editor

1. Click the layer set dropdown
2. Select the set you want to edit
3. The canvas updates to show that set's layers

### Revision History Per Set

Each named set maintains its own revision history:
- Up to 50 revisions per set (configurable)
- Independent undo/redo within each set
- Revision list shows who made changes and when

---

## Displaying Named Sets in Wikitext

### Basic Syntax

```wikitext
[[File:Diagram.png|layerset=setname]]
```

> **Note:** `layers=` is also supported for backwards compatibility.

### Examples

```wikitext
<!-- Default set -->
[[File:Heart.png|layerset=on]]
[[File:Heart.png|layerset=default]]

<!-- Named sets -->
[[File:Heart.png|layerset=anatomy]]
[[File:Heart.png|layerset=blood-flow]]
[[File:Heart.png|layerset=quiz]]

<!-- Disable layers -->
[[File:Heart.png|layerset=off]]
[[File:Heart.png|layerset=none]]
```

### With Other Parameters

Named sets work with all standard image parameters:

```wikitext
[[File:Diagram.png|thumb|300px|left|layerset=anatomy|Anatomical diagram with labels]]
```

---

## Managing Named Sets

### Viewing All Sets

In the editor, click the layer set dropdown to see:
- All named sets for this image
- Revision count per set
- Last modified date

### Renaming a Set

1. Click the layer set dropdown
2. Click **"Rename Set..."** next to the set
3. Enter the new name
4. Click **Rename**

> **Note:** You cannot rename the `default` set.

### Deleting a Set

1. Click the layer set dropdown
2. Click **"Delete Set..."** next to the set
3. Confirm deletion

> **Warning:** Deleting a set removes ALL revisions permanently. This cannot be undone.

> **Note:** You cannot delete the `default` set from the UI.

### Permissions

| Action | Required Right |
|--------|----------------|
| Create set | `createlayers` |
| Edit set | `editlayers` |
| Delete set | Owner OR `delete` right (admin) |
| Rename set | Owner OR `delete` right (admin) |

---

## The Default Set

Every image has a `default` set:

- Created automatically on first save
- Cannot be deleted from the UI
- Used when `layerset=on` is specified
- Always available as a fallback

---

## Background Settings Per Set

Each named set remembers its own background settings:

- **Background visibility** — Show/hide the original image
- **Background opacity** — Transparency level (0-100%)

This allows different sets to have different viewing preferences.

---

## Limits

Default limits (configurable in `LocalSettings.php`):

| Limit | Default | Config Variable |
|-------|---------|-----------------|
| Max sets per image | 15 | `$wgLayersMaxNamedSets` |
| Max revisions per set | 50 | `$wgLayersMaxRevisionsPerSet` |
| Max layers per set | 100 | `$wgLayersMaxLayerCount` |

### Adjusting Limits

```php
// Allow more named sets per image
$wgLayersMaxNamedSets = 25;

// Keep more revision history
$wgLayersMaxRevisionsPerSet = 100;
```

---

## API Access

Named sets are accessible via the MediaWiki Action API:

### Get Layer Set

```
GET /api.php?action=layersinfo&filename=File:Example.jpg&setname=anatomy
```

### Save to Named Set

```
POST /api.php?action=layerssave
  filename=File:Example.jpg
  setname=anatomy
  data=[...layers JSON...]
  token=CSRF_TOKEN
```

### Delete Named Set

```
POST /api.php?action=layersdelete
  filename=File:Example.jpg
  setname=anatomy
  token=CSRF_TOKEN
```

### Rename Named Set

```
POST /api.php?action=layersrename
  filename=File:Example.jpg
  oldname=anatomy
  newname=anatomical-labels
  token=CSRF_TOKEN
```

See [[API Reference]] for complete documentation.

---

## Migration Notes

### Existing Layer Sets

When upgrading from a version without named sets:
- Existing layers are automatically migrated to the `default` set
- No data is lost
- Existing wikitext using `layers=on` continues to work

---

## Tips

### Organize by Purpose

Create sets based on what they show:
- `measurements` — Dimension lines
- `callouts` — Explanatory text
- `highlights` — Color overlays

### Use Descriptive Names

Good: `blood-circulation`, `electrical-system`, `anatomical-labels`
Bad: `set1`, `new`, `test`

### Plan Before Creating

Think about what sets you'll need before creating them. While sets can be deleted, planning ahead saves time.

### Document Your Sets

Consider adding a note on the File: page describing available sets:

```wikitext
== Available Layer Sets ==
* '''default''' — General annotations
* '''anatomy''' — Anatomical labels
* '''circulation''' — Blood flow diagram
```

---

## See Also

- [[Wikitext Syntax]] — Complete wikitext reference
- [[API Reference]] — Programmatic access
- [[Configuration Reference]] — Limit settings
