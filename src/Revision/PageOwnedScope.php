<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\MediaWikiServices;
use MediaWiki\Page\PageReference;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\NameTableAccessException;
use MediaWiki\Storage\NameTableStore;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Which pages take part in page history for drawings. A page owns drawings once its current revision carries
 * the drawing slot, which only publication can write, and keeps them under any later title and in any
 * namespace. The configured namespaces (and, for tests, titles) decide where ownership may start.
 */
final class PageOwnedScope {
	/** @var string[] */
	private array $enrolled;
	/** @var int[] */
	private array $namespaces;
	private TitleFactory $titles;
	private RevisionLookup $revisions;
	private IConnectionProvider $db;
	private NameTableStore $slotRoles;

	/**
	 * @param string[] $enrolled Exact canonical prefixed DB keys
	 * @param TitleFactory $titles
	 * @param RevisionLookup $revisions
	 * @param IConnectionProvider $db
	 * @param NameTableStore $slotRoles
	 * @param int[] $namespaces Namespaces all of whose pages are enrolled
	 */
	public function __construct( array $enrolled, TitleFactory $titles, RevisionLookup $revisions,
		IConnectionProvider $db, NameTableStore $slotRoles, array $namespaces = []
	) {
		foreach ( $enrolled as $key ) {
			$title = is_string( $key ) && $key !== '' ? $titles->newFromText( $key ) : null;
			if ( !$title || !$title->canExist() || $title->hasFragment() || $title->getPrefixedDBkey() !== $key ) {
				throw new \InvalidArgumentException( 'Invalid Layers pilot owner scope' );
			}
		}
		foreach ( $namespaces as $namespace ) {
			if ( !is_int( $namespace ) || $namespace < 0 ) {
				throw new \InvalidArgumentException( 'Invalid Layers pilot namespace scope' );
			}
		}
		$this->enrolled = array_values( array_unique( $enrolled ) );
		$this->namespaces = array_values( array_unique( $namespaces ) );
		$this->titles = $titles;
		$this->revisions = $revisions;
		$this->db = $db;
		$this->slotRoles = $slotRoles;
	}

	/**
	 * @param MediaWikiServices $services
	 * @param string[] $enrolled
	 * @param int[] $namespaces
	 * @return self
	 */
	public static function newFromServices( MediaWikiServices $services, array $enrolled,
		array $namespaces = []
	): self {
		return new self( $enrolled, $services->getTitleFactory(), $services->getRevisionLookup(),
			$services->getConnectionProvider(), $services->getSlotRoleStore(), $namespaces );
	}

	/**
	 * @param PageReference $page
	 * @return bool
	 */
	public function isEnrolled( PageReference $page ): bool {
		return in_array( $page->getNamespace(), $this->namespaces, true ) ||
			in_array( $this->titles->newFromPageReference( $page )->getPrefixedDBkey(), $this->enrolled, true );
	}

	/**
	 * @param PageReference $page
	 * @param int $flags IDBAccessObject flags
	 * @return bool
	 */
	public function ownsDrawings( PageReference $page, int $flags = IDBAccessObject::READ_NORMAL ): bool {
		$revision = $this->revisions->getRevisionByTitle( $page, 0, $flags );
		return $revision !== null && $revision->hasSlot( PageRevisionWriter::SLOT );
	}

	/**
	 * @param PageReference $page
	 * @param int $flags IDBAccessObject flags
	 * @return bool
	 */
	public function includes( PageReference $page, int $flags = IDBAccessObject::READ_NORMAL ): bool {
		return $this->isEnrolled( $page ) || $this->ownsDrawings( $page, $flags );
	}

	/**
	 * For a parse of one exact revision, where querying the current revision would be wrong.
	 * @param PageReference $page
	 * @param RevisionRecord $revision
	 * @return bool
	 */
	public function includesRevision( PageReference $page, RevisionRecord $revision ): bool {
		return $revision->hasSlot( PageRevisionWriter::SLOT ) || $this->isEnrolled( $page );
	}

	/**
	 * $wgLayersPageDrawingNamespaces, where null means the content namespaces and File:.
	 * @param \MediaWiki\Config\Config $config
	 * @return int[]
	 */
	public static function configuredNamespaces( \MediaWiki\Config\Config $config ): array {
		$namespaces = $config->get( 'LayersPageDrawingNamespaces' );
		if ( $namespaces === null ) {
			$namespaces = array_merge( $config->get( 'ContentNamespaces' ), [ NS_FILE ] );
		}
		if ( !is_array( $namespaces ) ) {
			throw new \InvalidArgumentException( 'Invalid $wgLayersPageDrawingNamespaces' );
		}
		return array_values( array_unique( array_map( 'intval', $namespaces ) ) );
	}

	/**
	 * Core restore bypasses save admission, so drawings may only come back onto the page they belong to:
	 * no page exists at the title, and every restored revision with drawings left one page whose ID is free.
	 * @param PageReference $page Title being restored
	 * @param string[] $timestamps Selected revisions; empty restores all
	 * @return bool
	 */
	public function canRestore( PageReference $page, array $timestamps ): bool {
		if ( $this->ownsDrawings( $page, IDBAccessObject::READ_LATEST ) ) {
			return false;
		}
		try {
			$role = $this->slotRoles->getId( PageRevisionWriter::SLOT );
		} catch ( NameTableAccessException $e ) {
			return true;
		}
		$db = $this->db->getPrimaryDatabase();
		$where = [ 'ar_namespace' => $page->getNamespace(), 'ar_title' => $page->getDBkey() ];
		if ( $timestamps ) {
			$where['ar_timestamp'] = array_map( [ $db, 'timestamp' ], $timestamps );
		}
		$revisionIds = [];
		$pageIds = [];
		foreach ( $db->newSelectQueryBuilder()->select( [ 'ar_rev_id', 'ar_page_id' ] )->from( 'archive' )
			->where( $where )->caller( __METHOD__ )->fetchResultSet() as $row
		) {
			$revisionIds[] = (int)$row->ar_rev_id;
			$pageIds[(int)$row->ar_page_id] = true;
		}
		if ( !$revisionIds || $db->newSelectQueryBuilder()->select( 'slot_revision_id' )->from( 'slots' )
			->where( [ 'slot_revision_id' => $revisionIds, 'slot_role_id' => $role ] )
			->caller( __METHOD__ )->fetchField() === false
		) {
			return true;
		}
		$pageId = array_key_first( $pageIds );
		if ( count( $pageIds ) !== 1 || $pageId < 1 ) {
			return false;
		}
		$titleTaken = $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
			->where( [ 'page_namespace' => $page->getNamespace(), 'page_title' => $page->getDBkey() ] )
			->caller( __METHOD__ )->fetchField();
		$idTaken = $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
			->where( [ 'page_id' => $pageId ] )->caller( __METHOD__ )->fetchField();
		return $titleTaken === false && $idTaken === false;
	}
}
