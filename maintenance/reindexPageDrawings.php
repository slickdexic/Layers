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
use MediaWiki\Extension\Layers\Search\DrawingSearchText;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Storage\NameTableAccessException;
use MediaWiki\Title\Title;

/**
 * Pages that owned drawings, and files that had layer sets, before drawing text was indexed need this once,
 * and so does every such page after core's rebuildtextindex.php, which indexes only the main slot.
 */
class ReindexPageDrawings extends Maintenance {
	private DrawingSearchText $text;
	/** @var true[] Page IDs already indexed */
	private array $indexed = [];

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Index the text of Layers drawings together with the page text: page-owned ' .
			'drawings with their page, and a file\'s layer sets with its file page.' );
		$this->setBatchSize( 100 );
		$this->requireExtension( 'Layers' );
	}

	/** @inheritDoc */
	public function execute() {
		$this->text = $this->getServiceContainer()->getService( 'LayersDrawingSearchText' );
		$this->indexOwners();
		$this->indexFilePages();
		$this->output( 'Indexed drawing text for ' . count( $this->indexed ) . " page(s).\n" );
		return true;
	}

	private function indexOwners(): void {
		$services = $this->getServiceContainer();
		try {
			$role = $services->getSlotRoleStore()->getId( PageRevisionWriter::SLOT );
		} catch ( NameTableAccessException $e ) {
			return;
		}
		$db = $this->getReplicaDB();
		$last = 0;
		do {
			$ids = $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
				->join( 'slots', null, 'slot_revision_id = page_latest' )
				->where( [ 'slot_role_id' => $role, $db->expr( 'page_id', '>', $last ) ] )
				->orderBy( 'page_id' )->limit( $this->getBatchSize() )->caller( __METHOD__ )->fetchFieldValues();
			foreach ( $ids as $id ) {
				$last = (int)$id;
				$page = $services->getPageStore()->getPageById( $last );
				if ( $page ) {
					$this->index( $page );
				}
			}
		} while ( count( $ids ) === $this->getBatchSize() );
	}

	private function indexFilePages(): void {
		$services = $this->getServiceContainer();
		$db = $services->getService( 'LayersDatabase' );
		$last = '';
		do {
			$names = $db->listFilesWithSets( $last, $this->getBatchSize() );
			foreach ( $names as $name ) {
				$last = $name;
				$title = Title::makeTitleSafe( NS_FILE, $name );
				$page = $title ? $services->getPageStore()->getPageByReference( $title ) : null;
				if ( $page ) {
					$this->index( $page );
				}
			}
		} while ( count( $names ) === $this->getBatchSize() );
	}

	/**
	 * @param PageIdentity $page
	 */
	private function index( PageIdentity $page ): void {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByPageId( $page->getId() );
		$text = $revision && !isset( $this->indexed[$page->getId()] ) ? $this->text->get( $page, $revision ) : '';
		if ( $text !== '' ) {
			$this->text->index( $page->getId(), $page, $revision, $text );
			$this->indexed[$page->getId()] = true;
		}
	}
}

// @codeCoverageIgnoreStart
$maintClass = ReindexPageDrawings::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
