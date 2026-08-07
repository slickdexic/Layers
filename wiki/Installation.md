# Installation

This guide covers downloading, configuring, and setting up the Layers extension for MediaWiki.

---

## Requirements

| Requirement | Minimum Version |
|-------------|-----------------|
| **MediaWiki** | 1.44+ (or 1.43.x with REL1_43, or 1.39+ with REL1_39 branch) |
| **PHP** | 8.1+ |
| **Database** | MySQL 5.7+ / MariaDB 10.3+ / PostgreSQL 10+ / SQLite 3.8+ |

### Branch Selection

`main` is the **primary development and testing branch**. REL branches receive cherry-picked changes from `main`.

| MediaWiki Version | Branch | Current Version | Notes |
|-------------------|--------|-----------------|-------|
| 1.44+ | **`main`** | 1.5.84 | Primary branch |
| 1.43.x (LTS) | `REL1_43` | 1.5.68-REL1_43 | Current LTS; receives security backports |
| 1.39.x - 1.42.x | `REL1_39` | 1.5.67-REL1_39 | **Unmaintained** — see below |

> ⚠️ **`REL1_39` is no longer maintained.** MediaWiki 1.39 reached end-of-life on
> December 31, 2025. The branch is left in place for existing installs but
> receives no fixes of any kind, **including security fixes** — several that are
> already fixed on `main` and `REL1_43` remain present there. If you are on
> MediaWiki 1.39–1.42, upgrade to 1.43+ and switch to `REL1_43`.

---

## Download

### Option 1: Git Clone (Recommended)

```bash
cd /path/to/mediawiki/extensions
git clone https://github.com/slickdexic/Layers.git
cd Layers
```

### Option 2: Download ZIP

1. Go to [GitHub Releases](https://github.com/slickdexic/Layers/releases)
2. Download the latest release ZIP
3. Extract to `extensions/Layers`

---

## Install Dependencies (Optional - Development Only)

The extension works out of the box without any dependency installation. The following commands are **only needed for development and testing**:

```bash
cd extensions/Layers

# PHP development tools (linting, static analysis, unit tests)
composer install

# JavaScript development tools (linting, unit tests, build tools)
npm install
```

> **Note:** If you just want to use the extension, skip this section entirely. These dependencies are only required if you plan to run tests, contribute code, or use the development tools.

> **Windows Users:** If you encounter issues with `composer`, you may have a Python package named "composer" shadowing PHP Composer. Use `php composer.phar install` instead.

---

## Configure MediaWiki

Add the following to your `LocalSettings.php`:

```php
// Load the extension
wfLoadExtension( 'Layers' );

// Grant permissions (adjust as needed)
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['sysop']['layers-admin'] = true;
```

---

## Update Database Schema

Run the MediaWiki update script to create the required database tables:

### MediaWiki 1.44+
```bash
php maintenance/run.php update.php
```

### MediaWiki 1.39 - 1.43
```bash
php maintenance/update.php
```

This creates the `layers_sets` table for storing layer data.

---

## Verify Installation

1. Navigate to **Special:Version** in your wiki
2. Look for "Layers" under "Installed extensions"
3. Go to any **File:** page and look for the "Edit Layers" tab

If you see the "Edit Layers" tab, installation was successful!

---

## Optional Configuration

See [[Configuration Reference]] for all available settings. Here are the most common:

```php
// Increase max layers per set (default: 100)
$wgLayersMaxLayerCount = 200;

// Increase max layer sets per image (default: 15)
$wgLayersMaxNamedSets = 25;

// Enable debug logging (default: false)
$wgLayersDebug = true;

// Rate limiting. Sensible defaults ship with the extension since v1.5.83;
// anything set here overrides them per group.
$wgRateLimits['editlayers-save']['user'] = [ 60, 60 ];
$wgRateLimits['editlayers-render']['user'] = [ 5, 60 ];      // PDF export is expensive
```

---

## Upgrading

To upgrade to a new version:

```bash
cd extensions/Layers
git pull origin main
php maintenance/run.php update.php
```

> **Note:** If you previously installed development dependencies, you may also want to run `composer install` and `npm install` to update them.

Always check the [CHANGELOG](https://github.com/slickdexic/Layers/blob/main/CHANGELOG.md) for breaking changes before upgrading.

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Edit Layers" tab not visible | Check permissions in LocalSettings.php |
| Database errors on save | Run `maintenance/update.php` |
| Blank editor | Check browser console for JavaScript errors |
| Composer conflicts on Windows | Use `php composer.phar install` |

For more help, see [[Troubleshooting]] or [open an issue](https://github.com/slickdexic/Layers/issues).

---

## Next Steps

- [[Quick Start Guide]] — Create your first annotation
- [[Drawing Tools]] — Learn about available tools
- [[Configuration Reference]] — Fine-tune your setup
