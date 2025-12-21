{{Extension
|name            = Layers
|status          = stable
|type1           = media
|type2           = interface
|type3           = api
|author          = [[User:Pvodrazka|Pvodrazka]]
|version         = 1.1.9
|update          = 2025-12-21
|download        = {{GithubDownload|slickdexic|Layers}}
|readme          = [https://github.com/slickdexic/Layers/blob/main/README.md README]
|changelog       = [https://github.com/slickdexic/Layers/blob/main/CHANGELOG.md CHANGELOG]
|license         = GPL-2.0-or-later
|tags            = <image editor><image markup><annotation><canvas><drawing>
|mediawiki       = >= 1.44
|php             = >= 8.1
|needs-updatephp = yes
|description     = A professional-grade, non-destructive image annotation and markup system with 13 drawing tools.
}}

[[File:ExtensionLayersEditor.png|thumb|600px|right|The Layers editor interface showing drawing tools and layer management.]]

'''Layers''' is a modern, non-destructive image annotation and editing tool for MediaWiki. It enables users to add captions, callouts, highlights, shapes, and freehand drawings to images '''without altering the original file'''.

All edits are stored as validated JSON and rendered client-side for precise positioning. The system fully integrates into MediaWiki's file pages and parser.

Click the {{key press|'''Edit Layers'''}} tab on any image's File: page to access the editor.

Inspired by industry standards like [[w:Figma|Figma]], [[w:Canva|Canva]], and [[w:Adobe Photoshop|Photoshop]], users familiar with these tools will feel right at home.

{{Note|For '''MediaWiki 1.39.x - 1.43.x''', use the [https://github.com/slickdexic/Layers/tree/REL1_39 REL1_39 branch].}}

== Key Features ==
* '''Professional Editor''': A responsive, single-panel canvas with 13 drawing tools.
* '''Style Presets''': Save and reuse style configurations per tool type. Create custom presets from selected layers or use built-in defaults.
* '''Named Layer Sets''': Multiple annotation sets per image (e.g., "default", "anatomy-labels", "notes").
* '''Revision History''': Automatically tracks up to 50 revisions per layer set, integrated with MediaWiki permissions.
* '''Import Images''': Add external images (logos, icons, photos) as new layers.
* '''Export as PNG''': Download annotated images with optional background.
* '''Accessibility-First''': Built with WCAG 2.1 compliance, featuring keyboard shortcuts, skip links, and ARIA landmarks.
* '''Wikitext Integration''': Simple syntax to toggle layers on/off in standard image links.
* '''TypeScript Support''': Full type definitions (<code>types/layers.d.ts</code>) for extension developers.

== Drawing Tools ==
{| class="wikitable"
! Tool !! Shortcut !! Purpose !! Key Features
|-
| Pointer || {{key press|V}} || Select and manipulate objects || Multi-select, bounding box handles, resize, rotate
|-
| Zoom || {{key press|Z}} || Zoom and pan the canvas || Mouse wheel zoom, pan with drag
|-
| Text || {{key press|T}} || Add text labels || Font selection, size, color, stroke, shadow
|-
| Text Box || {{key press|X}} || Multi-line text in container || Word wrap, alignment, padding, corner radius
|-
| Pen || {{key press|P}} || Freehand drawing || Smooth paths, adjustable stroke
|-
| Rectangle || {{key press|R}} || Draw rectangles || Adjustable stroke and fill
|-
| Circle || {{key press|C}} || Draw circles || Radius-based drawing
|-
| Ellipse || {{key press|E}} || Draw ellipses || Independent X/Y radius control
|-
| Polygon || {{key press|G}} || Draw polygons || Configurable sides, rounded corners
|-
| Star || {{key press|S}} || Draw star shapes || Configurable points, radii, rounded corners
|-
| Arrow || {{key press|A}} || Annotation arrows || Configurable head types, sizes, and line styles
|-
| Line || {{key press|L}} || Straight lines || Stroke width and color options
|-
| Blur || {{key press|B}} || Apply blur effect || Create depth and focus effects
|}

== Layer Management ==
* '''Visibility toggles''': Show/hide individual layers
* '''Lock/unlock''': Prevent accidental modifications
* '''Drag-and-drop reorder''': Change layer stacking order
* '''Duplicate layers''': Quick copy of existing layers
* '''Per-set background settings''': Background visibility and opacity saved independently

== Style Options ==
* Stroke color and width
* Fill colors with transparency
* Shadow effects (with spread, offset, color)
* Text stroke and text shadow
* Blend modes
* Font family and size selection
* Opacity controls

== Usage ==
=== In Wikitext ===
To display layers on a page, use the {{para|layers}} parameter in your file link:
<syntaxhighlight lang="wikitext">
[[File:Example.jpg|layers=on]]              <!-- Default layer set -->
[[File:Example.jpg|layers=anatomy]]         <!-- Named set "anatomy" -->
[[File:Example.jpg|layers=none]]            <!-- Explicitly disable -->
</syntaxhighlight>

{{Note|On File: pages, layers are NOT auto-displayed. You must explicitly use <code>layers=on</code> or <code>layers=setname</code> in wikitext.}}

=== Keyboard Shortcuts ===
{| class="wikitable"
! Action !! Shortcut
|-
| Undo || {{key press|Ctrl|Z}}
|-
| Redo || {{key press|Ctrl|Y}} or {{key press|Ctrl|Shift|Z}}
|-
| Copy || {{key press|Ctrl|C}}
|-
| Paste || {{key press|Ctrl|V}}
|-
| Delete || {{key press|Delete}}
|-
| Toggle Background || {{key press|Shift|B}}
|-
| Marquee Select || {{key press|M}}
|-
| Show Keyboard Help || {{key press|Shift|?}}
|}

== Installation ==
=== Download ===
<syntaxhighlight lang="bash">
cd extensions/
git clone https://github.com/slickdexic/Layers.git
cd Layers
composer install
npm install
</syntaxhighlight>

=== Configuration ===
Add to your [[Manual:LocalSettings.php|LocalSettings.php]]:
<syntaxhighlight lang="php">
wfLoadExtension( 'Layers' );

// Permissions
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;
</syntaxhighlight>

=== Database Update ===
Run the maintenance script:
<syntaxhighlight lang="bash">
php maintenance/run.php update.php
</syntaxhighlight>

== Configuration Parameters ==
{| class="wikitable"
! Parameter !! Type !! Default !! Description
|-
| <code>$wgLayersEnable</code> || boolean || <code>true</code> || Master switch to enable/disable extension.
|-
| <code>$wgLayersDebug</code> || boolean || <code>true</code> || Enable debug logging to 'Layers' channel.
|-
| <code>$wgLayersMaxBytes</code> || integer || <code>2097152</code> || Max JSON size per layer set (2 MB).
|-
| <code>$wgLayersMaxLayerCount</code> || integer || <code>100</code> || Max layers per set.
|-
| <code>$wgLayersMaxNamedSets</code> || integer || <code>15</code> || Max named sets per image.
|-
| <code>$wgLayersMaxRevisionsPerSet</code> || integer || <code>50</code> || Max revisions kept per named set.
|-
| <code>$wgLayersMaxImageBytes</code> || integer || <code>1048576</code> || Max size for imported image layers (1 MB).
|-
| <code>$wgLayersMaxImageSize</code> || integer || <code>4096</code> || Max image dimension (px) for editing.
|-
| <code>$wgLayersImageMagickTimeout</code> || integer || <code>30</code> || Timeout for ImageMagick operations (seconds).
|}

=== Rate Limiting ===
<syntaxhighlight lang="php">
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];   // 30 saves per hour
$wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ]; // 5 saves per hour
</syntaxhighlight>

== Permissions ==
{| class="wikitable"
! Right !! Description !! Default Groups
|-
| <code>editlayers</code> || Edit existing layer sets || user
|-
| <code>createlayers</code> || Create new layer sets || autoconfirmed
|-
| <code>managelayerlibrary</code> || Manage layer library || sysop
|}

== Technical Details ==
* '''Backend''': PHP 8.1+ with 4 custom API endpoints (<code>layersinfo</code>, <code>layerssave</code>, <code>layersdelete</code>, <code>layersrename</code>).
* '''Frontend''': HTML5 Canvas-based editor with 81 JS files (~41K lines), 72 ES6 classes.
* '''Code Splitting''': Viewer module (~610 lines) + Shared module (~5K lines) loads separately from Editor (~35K lines).
* '''Testing''': 5,412 Jest tests (~92% coverage), PHPUnit integration tests, Playwright E2E tests.
* '''Security''': Full CSRF protection, strict property whitelisting (50+ fields), rate limiting, text sanitization.

== Accessibility ==
Layers follows [[w:WCAG|WCAG 2.1]] guidelines:
* '''Skip Links''': Jump directly to toolbar, canvas, or layer panel (WCAG 2.4.1)
* '''ARIA Landmarks''': Semantic regions for screen reader navigation (WCAG 1.3.1)
* '''Keyboard Navigation''': Full keyboard support with discoverable shortcuts
* '''Focus Management''': Visible focus indicators throughout the interface
* '''Live Regions''': Status updates announced to assistive technologies

== Troubleshooting ==
* [https://github.com/slickdexic/Layers/blob/main/docs/layers-all-troubleshooting.md Troubleshooting Guide]
* [https://github.com/slickdexic/Layers/blob/main/docs/KNOWN_ISSUES.md Known Issues]

'''Windows Composer Conflict:''' Some Windows systems have a Python package named "composer" that shadows PHP Composer. Use <code>npm run test:php</code> as an alternative.

== Documentation ==
* [https://github.com/slickdexic/Layers/blob/main/docs/ARCHITECTURE.md Technical Architecture]
* [https://github.com/slickdexic/Layers/blob/main/docs/ACCESSIBILITY.md Accessibility Features]
* [https://github.com/slickdexic/Layers/blob/main/docs/DEVELOPER_ONBOARDING.md Developer Onboarding]
* [https://github.com/slickdexic/Layers/blob/main/docs/NAMED_LAYER_SETS.md Named Layer Sets]
* [https://github.com/slickdexic/Layers/blob/main/docs/WIKITEXT_USAGE.md Wikitext Syntax]
* [https://github.com/slickdexic/Layers/blob/main/docs/CSP_GUIDE.md Content Security Policy Guide]

== Support ==
* [https://github.com/slickdexic/Layers/issues Issue Tracker]
* [https://github.com/slickdexic/Layers/blob/main/CONTRIBUTING.md Contributing Guide]

[[Category:Image extensions]]
[[Category:User interface extensions]]
[[Category:API extensions]]
