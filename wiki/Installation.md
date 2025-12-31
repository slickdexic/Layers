# Installation

This guide covers downloading, configuring, and setting up the Layers extension for MediaWiki.

---

## Requirements

| Requirement | Minimum Version |
|-------------|-----------------|
| **MediaWiki** | 1.43+ (or 1.39+ with REL1_39 branch) |
| **PHP** | 8.1+ |
| **Database** | MySQL 5.7+ / MariaDB 10.3+ / PostgreSQL 10+ / SQLite 3.8+ |

### Branch Selection

| MediaWiki Version | Branch | Current Version |
|-------------------|--------|-----------------|
| 1.44+ | `main` | 1.3.0 |
| 1.43.x | `REL1_43` | 1.3.0-REL1_43 |
| 1.39.x - 1.42.x | `REL1_39` | 1.1.14 (community maintained) |

> **Note:** MediaWiki 1.39 LTS reached end-of-life on December 31, 2025. The REL1_39 branch is now community maintained. Users on MW 1.39-1.42 should upgrade to MW 1.43+ and use the REL1_43 branch for continued support.

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

## Install Dependencies

```bash
cd extensions/Layers

# PHP dependencies (required)
composer install --no-dev

# JavaScript dependencies (optional, for development)
npm install
```

> **Windows Users:** If you encounter issues with `composer`, you may have a Python package named "composer" shadowing PHP Composer. Use `php composer.phar install` instead, or use the Docker-based test commands: `npm run test:php:docker`.

---

## Configure MediaWiki

Add the following to your `LocalSettings.php`:

```php
// Load the extension
wfLoadExtension( 'Layers' );

// Grant permissions (adjust as needed)
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;
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

// Enable debug logging (default: true)
$wgLayersDebug = true;

// Rate limiting for saves
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];     // 30 per hour
$wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ];    // 5 per hour for new users
```

---

## Upgrading

To upgrade to a new version:

```bash
cd extensions/Layers
git pull origin main
composer install --no-dev
php maintenance/run.php update.php
```

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
