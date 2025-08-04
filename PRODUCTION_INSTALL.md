# Layers Extension - Production Installation Guide

## Prerequisites

### Required Software
- MediaWiki 1.35.0 or higher
- PHP 7.4 or higher  
- MySQL 5.7 or MariaDB 10.3
- ImageMagick with PHP imagick extension
- Web server (Apache/Nginx) with proper permissions

### Required PHP Extensions
```bash
# Check required extensions
php -m | grep -E "(imagick|json|curl|mbstring)"
```

### ImageMagick Verification
```bash
# Test ImageMagick availability
convert -version
identify -version
```

## Installation Steps

### 1. Download Extension
```bash
cd /path/to/mediawiki/extensions
git clone https://github.com/slickdexic/Layers.git
cd Layers
```

### 2. Install Dependencies
```bash
composer install --no-dev --optimize-autoloader
npm install --production
```

### 3. Configure MediaWiki

Add to `LocalSettings.php`:
```php
# Enable Layers Extension
wfLoadExtension( 'Layers' );

# Basic Configuration
$wgLayersEnable = true;
$wgLayersMaxBytes = 2097152; // 2MB limit for layer data
$wgLayersMaxImageSize = 4096; // Maximum image dimension

# ImageMagick Configuration (required for thumbnails)
$wgUseImageMagick = true;
$wgImageMagickConvertCommand = '/usr/bin/convert';

# Permissions
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;

# Rate Limiting (recommended)
$wgRateLimits['editlayers-save'] = [
    'user' => [ 50, 3600 ], // 50 saves per hour
    'newbie' => [ 10, 3600 ] // 10 saves per hour for new users
];

# Optional: Enable thumbnail caching
$wgLayersThumbnailCache = true;

# Optional: Custom fonts
$wgLayersDefaultFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 
    'Courier New', 'Roboto', 'Open Sans'
];
```

### 4. Run Database Updates
```bash
cd /path/to/mediawiki
php maintenance/update.php
```

### 5. Set Directory Permissions
```bash
# Create layers directory with proper permissions
mkdir -p images/layers images/thumb/layers
chown -R www-data:www-data images/layers images/thumb/layers
chmod -R 755 images/layers images/thumb/layers
```

### 6. Verify Installation
```bash
# Run tests
cd extensions/Layers
composer test
npm test

# Check database tables
mysql -u root -p your_wiki_db -e "SHOW TABLES LIKE 'layer_%';"
```

## Security Configuration

### File Upload Security
```php
# Restrict layer data files
$wgFileExtensions[] = 'layers'; // If using file-based storage
$wgTrustedMediaFormats[] = 'application/json';

# Additional security
$wgEnableUploads = true;
$wgStrictFileExtensions = true;
$wgVerifyMimeType = true;
```

### Rate Limiting
```php
# Comprehensive rate limiting
$wgRateLimits = array_merge( $wgRateLimits, [
    'editlayers-save' => [
        'anon' => [ 0, 3600 ], // No saves for anonymous users
        'user' => [ 50, 3600 ],
        'newbie' => [ 10, 3600 ],
        'autoconfirmed' => [ 100, 3600 ]
    ],
    'editlayers-render' => [
        'user' => [ 200, 3600 ],
        'newbie' => [ 50, 3600 ]
    ]
] );
```

## Performance Optimization

### Database Indexing
```sql
-- Add indexes for better performance
ALTER TABLE layer_sets ADD INDEX idx_img_sha1 (img_sha1);
ALTER TABLE layer_sets ADD INDEX idx_timestamp (timestamp);
ALTER TABLE layer_set_usage ADD INDEX idx_page_id (page_id);
```

### Caching Configuration
```php
# Enable object caching
$wgMainCacheType = CACHE_REDIS; // or CACHE_MEMCACHED
$wgMemCachedServers = [ '127.0.0.1:11211' ];

# Enable file cache for thumbnails
$wgUseFileCache = true;
$wgFileCacheDirectory = '/path/to/cache';
```

### Thumbnail Directory Structure
```bash
# Organize thumbnails by hash for better performance
images/thumb/layers/
├── a/ab/
├── b/bc/
└── ...
```

## Monitoring and Logging

### Log Configuration
```php
# Enable detailed logging
$wgDebugLogGroups['Layers'] = '/path/to/logs/layers.log';

# Performance monitoring
$wgDBerrorLog = '/path/to/logs/database-errors.log';
```

### Health Check Script
```php
<?php
// health-check.php - Monitor layers functionality
require_once 'includes/WebStart.php';

$checks = [
    'extension_loaded' => extension_loaded( 'imagick' ),
    'convert_available' => !empty( shell_exec( 'which convert' ) ),
    'directories_writable' => is_writable( "$wgUploadDirectory/layers" ),
    'database_tables' => // Check if layer tables exist
];

echo json_encode( $checks );
?>
```

## Troubleshooting

### Common Issues

1. **"Extension not found" error**
   - Verify composer install ran successfully
   - Check extension.json is valid JSON
   - Ensure proper file permissions

2. **Thumbnails not generating**
   - Verify ImageMagick installation: `convert -version`
   - Check directory permissions
   - Review PHP error logs

3. **Database errors during update**
   - Ensure MySQL user has CREATE/ALTER privileges
   - Check MediaWiki version compatibility
   - Review update.php output for specific errors

4. **Rate limiting too restrictive**
   - Adjust $wgRateLimits configuration
   - Consider different limits for user groups
   - Monitor via logs to find optimal values

### Debug Mode
```php
# Enable debug mode for troubleshooting
$wgLayersDebugMode = true;
$wgShowExceptionDetails = true;
$wgDebugToolbar = true;
```

## Upgrade Process

### From Development Version
1. Backup database and files
2. Run `git pull` or download new version
3. Run `composer install --no-dev`
4. Run `php maintenance/update.php`
5. Clear cache: `php maintenance/invalidateImageCache.php`

### Version-Specific Notes
- v1.0 → v1.1: Added rate limiting, requires config updates
- v1.1 → v1.2: New database columns, requires schema update

## Support

- Documentation: `/extensions/Layers/README.md`
- Issue tracker: GitHub repository
- Log files: Check MediaWiki logs directory
- Performance: Monitor via `Special:Statistics`
