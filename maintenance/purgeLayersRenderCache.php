<?php

declare( strict_types=1 );
/**
 * Maintenance script: purge stale Layers render artefacts.
 *
 * @file
 * @ingroup Maintenance
 * @license GPL-2.0-or-later
 */

// @codeCoverageIgnoreStart
$IP = getenv( 'MW_INSTALL_PATH' );
if ( $IP === false ) {
	$IP = __DIR__ . '/../../..';
}
require_once "$IP/maintenance/Maintenance.php";
// @codeCoverageIgnoreEnd

use MediaWiki\Extension\Layers\Utility\RenderCache;
use MediaWiki\Maintenance\Maintenance;

/**
 * Removes composited thumbnails and exported PDFs that are no longer reachable.
 *
 * Export filenames incorporate the layer set revision, so every save of a layer
 * set orphans the previous PDF. Nothing else removes them, so without periodic
 * pruning the export directory grows without bound.
 */
class PurgeLayersRenderCache extends Maintenance {

	/** Default cutoff: artefacts untouched for 30 days. */
	private const DEFAULT_MAX_AGE_DAYS = 30;

	public function __construct() {
		parent::__construct();
		$this->addDescription(
			'Delete stale Layers composited thumbnails and exported PDFs from the upload thumb directory.'
		);
		$this->addOption(
			'max-age-days',
			'Delete artefacts not modified for this many days (default: ' . self::DEFAULT_MAX_AGE_DAYS . ')',
			false,
			true
		);
		$this->addOption( 'dry-run', 'Report what would be deleted without deleting anything' );
		$this->requireExtension( 'Layers' );
	}

	public function execute() {
		$days = (int)$this->getOption( 'max-age-days', self::DEFAULT_MAX_AGE_DAYS );
		if ( $days < 0 ) {
			$this->fatalError( '--max-age-days must not be negative.' );
		}
		$dryRun = $this->hasOption( 'dry-run' );
		$config = $this->getConfig();

		$this->output( 'Thumbnail dir: ' . RenderCache::getThumbDir( $config ) . "\n" );
		$this->output( 'Export dir:    ' . RenderCache::getExportDir( $config ) . "\n" );
		$this->output( "Cutoff:        older than $days day(s)\n" );

		$result = RenderCache::purgeOlderThan( $config, $days * 86400, $dryRun );

		$this->output( sprintf(
			"%s %d file(s), %.2f MB\n",
			$dryRun ? 'Would delete' : 'Deleted',
			$result['deleted'],
			$result['bytes'] / 1048576
		) );
	}
}

// @codeCoverageIgnoreStart
$maintClass = PurgeLayersRenderCache::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
