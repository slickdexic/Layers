<?php

declare( strict_types=1 );

/**
 * Read-only retained-row evidence for file/PDF layer sets in an exact owner revision.
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

use MediaWiki\Extension\Layers\Migration\FileMigrationAudit;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\Permissions\UltimateAuthority;

/** Administrative report only: no actor creation, publication, cleanup or migration-state changes. */
class AuditLayerSetMigration extends Maintenance {

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Report retained legacy-row matches for an exact page revision as JSON. ' .
			'File/PDF metadata only; no names or content are changed. This is not a reconciliation plan.' );
		$this->addOption( 'page', 'Owning wiki page title (including namespace)', true, true );
		$this->addOption( 'revision', 'Exact owner revision ID', true, true );
		$this->requireExtension( 'Layers' );
	}

	/** @inheritDoc */
	public function execute() {
		$services = $this->getServiceContainer();
		$title = $services->getTitleFactory()->newFromText( (string)$this->getOption( 'page' ) );
		$revision = filter_var( $this->getOption( 'revision' ), FILTER_VALIDATE_INT, [
			'options' => [ 'min_range' => 1 ]
		] );
		if ( !$title || !$revision ) {
			$this->fatalError( 'Specify an owning page and a positive, exact revision ID.' );
		}
		$audit = new FileMigrationAudit( $services->getService( 'LayersDatabase' ),
			new PageHistoryAccess( $services->getRevisionLookup() ), $services->getTitleFactory() );
		// Like migration dry runs, this administrative report creates no system user.
		$authority = new UltimateAuthority( $services->getUserFactory()->newAnonymous() );
		try {
			$report = $audit->inspect( $title, $revision, $authority );
		} catch ( \DomainException $e ) {
			$this->fatalError( 'The exact owner revision has no available Layers snapshot.' );
		}
		$this->output( json_encode( $report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES |
			JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR ) . "\n" );
		return true;
	}
}

// @codeCoverageIgnoreStart
$maintClass = AuditLayerSetMigration::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
