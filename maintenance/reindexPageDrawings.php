<?php

declare( strict_types=1 );
/**
 * Maintenance script: add the text of page-owned drawings to the search index.
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

use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Search\PageDrawingSearchIndex;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\NameTableAccessException;

/**
 * Pages that owned drawings before drawing text was indexed, or after core's rebuildtextindex.php, which
 * indexes only the main slot, need this once.
 */
class ReindexPageDrawings extends Maintenance {
	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Index the text of page-owned Layers drawings together with each page\'s text.' );
		$this->setBatchSize( 100 );
		$this->requireExtension( 'Layers' );
	}

	/** @inheritDoc */
	public function execute() {
		$services = $this->getServiceContainer();
		try {
			$role = $services->getSlotRoleStore()->getId( PageRevisionWriter::SLOT );
		} catch ( NameTableAccessException $e ) {
			$this->output( "No page owns drawings.\n" );
			return true;
		}
		$scope = $services->getService( 'LayersPageOwnedPilot' )->getScope();
		$db = $this->getReplicaDB();
		$last = 0;
		$count = 0;
		do {
			$ids = $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
				->join( 'slots', null, 'slot_revision_id = page_latest' )
				->where( [ 'slot_role_id' => $role, $db->expr( 'page_id', '>', $last ) ] )
				->orderBy( 'page_id' )->limit( $this->getBatchSize() )->caller( __METHOD__ )->fetchFieldValues();
			foreach ( $ids as $id ) {
				$last = (int)$id;
				$page = $services->getPageStore()->getPageById( $last );
				$revision = $page ? $services->getRevisionLookup()->getRevisionByPageId( $last ) : null;
				if ( $page && $revision && !$revision->isDeleted( RevisionRecord::DELETED_TEXT ) &&
					$scope->includesRevision( $page, $revision )
				) {
					PageDrawingSearchIndex::update( $last, $page, $revision );
					$count++;
				}
			}
		} while ( count( $ids ) === $this->getBatchSize() );
		$this->output( "Indexed drawing text for $count page(s).\n" );
		return true;
	}
}

// @codeCoverageIgnoreStart
$maintClass = ReindexPageDrawings::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
