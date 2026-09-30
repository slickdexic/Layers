<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Storage\NameTableStore;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IExpression;
use Wikimedia\Rdbms\LikeValue;

/**
 * Other pages' current drawings that this editor may copy (D1, HIST-5). Every page is read with the
 * caller's own rights, so a page, revision or file the caller cannot see is left out, not reported.
 */
class DrawingCatalog {
	private const MAX_CANDIDATES = 40;

	private IConnectionProvider $db;
	private NameTableStore $roles;
	private TitleFactory $titles;
	/** @var callable (Title, int, Authority): array[] [ id, label ] for each drawing; throws \DomainException */
	private $surfaces;

	/**
	 * @param IConnectionProvider $db
	 * @param NameTableStore $roles Slot roles
	 * @param TitleFactory $titles
	 * @param callable $surfaces Authorized drawing list of one page revision
	 */
	public function __construct( IConnectionProvider $db, NameTableStore $roles,
		TitleFactory $titles, callable $surfaces
	) {
		$this->db = $db;
		$this->roles = $roles;
		$this->titles = $titles;
		$this->surfaces = $surfaces;
	}

	/**
	 * @param string $search Start of a page title, with or without a namespace; empty lists the latest edited
	 * @param int $excludePageId The page being edited, whose own drawings are not offered
	 * @param int $limit Pages to return
	 * @param Authority $authority
	 * @return array[] title (Title), pageId, revisionId and drawings (id, label, kind) of each page
	 */
	public function search( string $search, int $excludePageId, int $limit, Authority $authority ): array {
		$search = trim( $search );
		$title = $search === '' ? null : $this->titles->newFromText( $search );
		if ( $search !== '' && !$title ) {
			return [];
		}
		try {
			$role = $this->roles->getId( PageRevisionWriter::SLOT );
		} catch ( \Exception $e ) {
			return [];
		}
		$db = $this->db->getReplicaDatabase();
		$query = $db->newSelectQueryBuilder()
			->select( [ 'page_id', 'page_namespace', 'page_title', 'page_latest' ] )
			->from( 'page' )
			->join( 'slots', null, 'slot_revision_id = page_latest' )
			->where( [ 'slot_role_id' => $role ] )
			->limit( self::MAX_CANDIDATES );
		if ( $excludePageId > 0 ) {
			$query->where( $db->expr( 'page_id', '!=', $excludePageId ) );
		}
		if ( $title ) {
			// A title without a namespace prefix looks in every namespace.
			if ( $title->getNamespace() !== NS_MAIN || str_starts_with( $search, ':' ) ) {
				$query->where( [ 'page_namespace' => $title->getNamespace() ] );
			}
			$query->where( $db->expr( 'page_title', IExpression::LIKE,
				new LikeValue( $title->getDBkey(), $db->anyString() ) ) )
				->orderBy( [ 'page_namespace', 'page_title' ] );
		} else {
			$query->orderBy( 'page_latest', 'DESC' );
		}
		$pages = [];
		foreach ( $query->caller( __METHOD__ )->fetchResultSet() as $row ) {
			if ( count( $pages ) >= $limit ) {
				break;
			}
			$page = Title::makeTitle( (int)$row->page_namespace, $row->page_title );
			try {
				$drawings = ( $this->surfaces )( $page, (int)$row->page_latest, $authority );
			} catch ( \DomainException $e ) {
				continue;
			}
			if ( !$drawings ) {
				continue;
			}
			$pages[] = [ 'title' => $page, 'pageId' => (int)$row->page_id, 'revisionId' => (int)$row->page_latest,
				'drawings' => $drawings ];
		}
		return $pages;
	}
}
