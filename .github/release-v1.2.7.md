# v1.2.7 Release Notes

## Features

### Blur Fill for Arrows
- Extended blur fill effect to arrow layers (previously shapes-only)
- Arrows can now use `fill='blur'` for frosted glass effect in both editor and viewer
- Same `blurRadius` control (1-64px) as shapes

### Compact Layer Panel UI
- Reduced layer item height from 36px to 28px
- Smaller control buttons (22px) for more efficient use of space
- Properties panel maintains priority over layer list

## Bug Fixes

### Validation Fix
- Fixed "Invalid blend mode" validation error that incorrectly rejected 'blur'
- 'blur' is now correctly recognized as a fill type, not a blend mode
- Complete Canvas 2D blend modes list in both JavaScript and PHP validators

## Documentation
- Updated all documentation files for v1.2.7
- Updated wiki pages: Home, Changelog, Drawing-Tools, API-Reference, Style-Presets
- Test count: 6,756 passing (+38 from v1.2.6)

## Compatibility
- MediaWiki 1.44+
- PHP 8.1+
- Fully backwards compatible with v1.2.x layer data
