# Layers GitHub Wiki

This folder contains the source files for the GitHub Wiki.

## Publishing to GitHub Wiki

GitHub wikis are stored in a separate git repository. To publish these pages:

### Option 1: Clone and Push (Recommended)

```bash
# Clone the wiki repository
git clone https://github.com/slickdexic/Layers.wiki.git
cd Layers.wiki

# Copy wiki files from the main repo
cp -r ../Layers/wiki/*.md .

# Commit and push
git add .
git commit -m "Update wiki documentation"
git push origin master
```

### Option 2: GitHub Web Interface

1. Go to https://github.com/slickdexic/Layers/wiki
2. Click "Create the first page" (or "New Page" for additional pages)
3. Copy content from each `.md` file in this folder
4. Save each page

## Wiki Structure

| File | Description |
|------|-------------|
| `Home.md` | Main landing page |
| `_Sidebar.md` | Navigation sidebar (appears on all pages) |
| `Installation.md` | Setup instructions |
| `Quick-Start-Guide.md` | 5-minute tutorial |
| `Drawing-Tools.md` | All 17 tools explained |
| `Keyboard-Shortcuts.md` | Shortcut reference |
| `Style-Presets.md` | Preset system guide |
| `Named-Layer-Sets.md` | Multiple annotation sets |
| `Alignment-and-Distribution.md` | Layout tools |
| `Configuration-Reference.md` | All config parameters |
| `Wikitext-Syntax.md` | Using layers in wiki pages |
| `Permissions.md` | User rights configuration |
| `Troubleshooting.md` | Problem solving |
| `FAQ.md` | Frequently asked questions |
| `Architecture-Overview.md` | System design |
| `API-Reference.md` | Backend API documentation |
| `Contributing-Guide.md` | How to contribute |
| `Testing-Guide.md` | Running and writing tests |
| `Changelog.md` | Version history |

## Page Naming

GitHub Wiki converts filenames to page titles:
- `Quick-Start-Guide.md` → "Quick Start Guide" page
- Access via: `https://github.com/slickdexic/Layers/wiki/Quick-Start-Guide`

## Updating

When making changes:
1. Edit files in this `wiki/` folder
2. Commit to main repository
3. Copy to wiki repository and push

This keeps wiki source versioned with the main codebase.

## Wiki Links

Use double brackets for internal wiki links:
```markdown
See [[Installation]] for setup instructions.
```

External links use standard markdown:
```markdown
[GitHub Repository](https://github.com/slickdexic/Layers)
```
