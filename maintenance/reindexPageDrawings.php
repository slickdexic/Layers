<?php

declare( strict_types=1 );
/**
 * Maintenance script: add text from page-owned layer sets to the search index.
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

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Search\DrawingSearchText;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\NameTableAccessException;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Pages that owned layer sets, files that had layer sets and pages that showed shared sets or slides before
 * layer text was indexed need this once, and so does every such page after core's rebuildtextindex.php,
 * which indexes only the main slot.
 */
class ReindexPageDrawings extends Maintenance {
	private DrawingSearchText $text;
	/** @var true[] Page IDs already indexed */
	private array $indexed = [];

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Index layer text together with page text: page-owned layer sets with their page, ' .
			'a file\'s layer sets with its file page, and shared sets and slides ' .
			'with the pages that show them.' );
		$this->setBatchSize( 100 );
		$this->requireExtension( 'Layers' );
	}

	/** @inheritDoc */
	public function execute() {
		$this->text = $this->getServiceContainer()->getService( 'LayersDrawingSearchText' );
		if ( MigrationState::isComplete( $this->getPrimaryDB() ) ) {
			if ( $this->getServiceContainer()->getMainConfig()->get( 'DisableSearchUpdate' ) ) {
				throw new RuntimeException( 'Search updates are disabled; layer text cleanup did not run.' );
			}
			// An old index entry can outlive every Layers association. Scan current
			// pages once by primary-key cursor; do not retain an unbounded ID set.
			$count = $this->indexCurrentPages();
			$this->output( 'Indexed layer text for ' . $count . " page(s).\n" );
			return true;
		}
		$this->indexOwners();
		$this->indexFilePages();
		$this->indexPagesShowingSets();
		$this->output( 'Indexed layer text for ' . count( $this->indexed ) . " page(s).\n" );
		return true;
	}

	private function indexCurrentPages(): int {
		$services = $this->getServiceContainer();
		$db = $this->getPrimaryDB();
		$last = 0;
		$count = 0;
		do {
			$ids = $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
				->where( $db->expr( 'page_id', '>', $last ) )->orderBy( 'page_id' )
				->limit( $this->getBatchSize() )->caller( __METHOD__ )->fetchFieldValues();
			foreach ( $ids as $id ) {
				$last = (int)$id;
				$page = $services->getPageStore()->getPageById( $last, IDBAccessObject::READ_LATEST );
				if ( $page ) {
					$this->text->update( $page );
					$count++;
				}
			}
		} while ( count( $ids ) === $this->getBatchSize() );
		return $count;
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

	private function indexPagesShowingSets(): void {
		$db = $this->getReplicaDB();
		$last = 0;
		do {
			$ids = $db->newSelectQueryBuilder()->select( 'pp_page' )->from( 'page_props' )
				->where( [ 'pp_propname' => ShownLayerSets::PROPERTY, $db->expr( 'pp_page', '>', $last ) ] )
				->orderBy( 'pp_page' )->limit( $this->getBatchSize() )->caller( __METHOD__ )->fetchFieldValues();
			foreach ( $ids as $id ) {
				$last = (int)$id;
				$page = $this->getServiceContainer()->getPageStore()->getPageById( $last );
				if ( $page ) {
					$this->index( $page );
				}
			}
		} while ( count( $ids ) === $this->getBatchSize() );
	}

	/**
	 * @param PageIdentity $page
	 */
	private function index( PageIdentity $page ): void {
		if ( isset( $this->indexed[$page->getId()] ) ) {
			return;
		}
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByPageId( $page->getId() );
		if ( !$revision || $revision->isDeleted( RevisionRecord::DELETED_TEXT ) ) {
			return;
		}
		// An empty projection must replace stale layer text while retaining the main slot.
		$this->text->indexWithFence( $page->getId(), $page, $revision, '' );
		$this->indexed[$page->getId()] = true;
	}
}

// @codeCoverageIgnoreStart
$maintClass = ReindexPageDrawings::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
