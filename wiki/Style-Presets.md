# Style presets

Reviewed September 6, 2026 against the preset dropdown, manager, storage and built-in preset definitions.

Presets reuse tool styles in images, PDF annotations and slides. They are browser-local preferences, not shared wiki records or approval rules.

## Apply and save

Choose a drawing tool, open its preset dropdown, and select a preset. Configure your current style and choose **Save Current Style** to save it under a name. The dropdown uses the current-style callback; there is no separate **Save from Selection** menu item.

Available built-ins depend on the tool. Examples include **Default Arrow** and **Callout** for arrows, **Label** and **Title** for text, **Outline** and **Highlight** for rectangles, and **Speech Bubble**, **Thought Bubble** and **Shout** for callouts. The earlier generic lists of Bold Outline, Warning, Success and similar presets did not match the shipped definitions.

Custom presets have a delete button and confirmation. Built-ins cannot be deleted. The dropdown has no rename action; save under a new name before deleting the old preset.

## What a preset stores

A preset stores supported style properties for its tool, such as colors, stroke width, font settings and shadows. It does not copy a layer's text, position or geometry. Applying one tool's properties to another type may have no effect. Arrow direction (`arrowStyle`, such as `single`) is distinct from line dash styling.

## Storage, backup and sharing

Custom presets use the localStorage key **`mw-layers-style-presets`**, scoped to the browser profile and wiki origin. They do not synchronize through the wiki account. Clearing site data removes them; private browsing or blocked storage can prevent persistence. Another browser profile will not see the same presets.

The preset manager implements JSON export/import methods for developer integrations, but the preset dropdown does **not** expose export/import buttons. The editor's **Import Layers / Export Layers** buttons transfer annotation data, not preset libraries.

For a manual backup, open browser developer tools, locate this wiki's Local Storage, and copy the value of `mw-layers-style-presets` to a local text file. Restoring that value manually replaces the browser's existing preset store; back it up first and reload the editor afterward. Team distribution needs an explicit manual or custom integration workflow.

## Troubleshooting

If a preset is missing, check the tool, wiki origin, browser profile and site-storage settings. If its appearance differs, inspect the selected layer type and supported properties. Save pending annotation work before refreshing.

See [[Drawing Tools]] and [[Keyboard Shortcuts]] for editor usage.
