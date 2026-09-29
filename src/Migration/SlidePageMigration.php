<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\NameTableAccessException;
use MediaWiki\Storage\NameTableStore;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\Rdbms\IExpression;
use Wikimedia\Rdbms\LikeValue;

/**
 * Step 3 of the D3 migration: a shared slide that no page shows gets a new main-namespace page
 * `Slide:<name>` that shows each of its sets. Step 2 then gives that page its copies, like any other page.
 */
class SlidePageMigration {
	private LayersDatabase $legacy;
	private PageOwnedScope $scope;
	private TitleFactory $titles;
	private RevisionLookup $revisions;
	private IConnectionProvider $db;
	private NameTableStore $roles;
	private PagePublicationService $publisher;

	/**
	 * @param LayersDatabase $legacy
	 * @param PageOwnedScope $scope
	 * @param TitleFactory $titles
	 * @param RevisionLookup $revisions
	 * @param IConnectionProvider $db
	 * @param NameTableStore $roles Slot role store
	 * @param PagePublicationService $publisher
	 */
	public function __construct( LayersDatabase $legacy, PageOwnedScope $scope, TitleFactory $titles,
		RevisionLookup $revisions, IConnectionProvider $db, NameTableStore $roles, PagePublicationService $publisher
	) {
		$this->legacy = $legacy;
		$this->scope = $scope;
		$this->titles = $titles;
		$this->revisions = $revisions;
		$this->db = $db;
		$this->roles = $roles;
		$this->publisher = $publisher;
	}

	/**
	 * @return string[] Names of all shared slides, in order
	 */
	public function listSlides(): array {
		$slides = [];
		$after = '';
		do {
			$names = $this->legacy->listSlidesWithSets( $after, 500 );
			foreach ( $names as $name ) {
				$after = $name;
				$slides[] = substr( $name, strlen( LayersConstants::SLIDE_PREFIX ) );
			}
		} while ( count( $names ) === 500 );
		return $slides;
	}

	/**
	 * Slides of which some page already has a copy made by step 2, found by the copies' derived IDs.
	 * @param string[] $slides Slide names
	 * @return true[] Keyed by slide name
	 */
	public function copiedSlides( array $slides ): array {
		$rows = [];
		foreach ( $slides as $slide ) {
			foreach ( $this->legacy->listLatestSetRows( LayersConstants::SLIDE_PREFIX . $slide,
				LayersConstants::TYPE_SLIDE ) as $row
			) {
				$rows[$row['id']] = $slide;
			}
		}
		try {
			$role = $this->roles->getId( PageRevisionWriter::SLOT );
		} catch ( NameTableAccessException $e ) {
			return [];
		}
		$db = $this->db->getReplicaDatabase();
		$copied = [];
		$last = 0;
		do {
			$res = $db->newSelectQueryBuilder()->select( [ 'page_id', 'page_latest' ] )->from( 'page' )
				->join( 'slots', null, 'slot_revision_id = page_latest' )
				->where( [ 'slot_role_id' => $role, $db->expr( 'page_id', '>', $last ) ] )
				->orderBy( 'page_id' )->limit( 200 )->caller( __METHOD__ )->fetchResultSet();
			foreach ( $res as $page ) {
				$last = (int)$page->page_id;
				$revision = $this->revisions->getRevisionById( (int)$page->page_latest );
				// Only drawing IDs are read, to recognise copies; nothing is shown to anyone.
				$content = $revision ? $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW ) : null;
				if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ) {
					continue;
				}
				$ids = array_flip( array_column( json_decode( $content->getText(), true )['surfaces'], 'id' ) );
				foreach ( $rows as $rowId => $slide ) {
					if ( isset( $ids[FilePageMigration::surfaceId( $rowId, $last )] ) ) {
						$copied[$slide] = true;
					}
				}
			}
		} while ( $res->numRows() === 200 );
		return $copied;
	}

	/**
	 * Whether a page showed the slide when last parsed; for runs that skip step 2's scan of every page.
	 * @param string $slide
	 * @return bool
	 */
	public function shownByPageProperties( string $slide ): bool {
		$db = $this->db->getReplicaDatabase();
		return (bool)$db->newSelectQueryBuilder()->select( 'pp_page' )->from( 'page_props' )
			->where( [ 'pp_propname' => ShownLayerSets::PROPERTY, $db->expr( 'pp_value', IExpression::LIKE,
				new LikeValue( $db->anyString(), ShownLayerSets::fragment( ShownLayerSets::SLIDE, $slide ),
					$db->anyString() ) ) ] )
			->limit( 1 )->caller( __METHOD__ )->fetchField();
	}

	/**
	 * @param string $slide A slide no page shows or has a copy of
	 * @return array slide; title (?Title); sets; problem (?string); main (text of the new page, or null)
	 */
	public function plan( string $slide ): array {
		$plan = [ 'slide' => $slide, 'title' => null, 'sets' => [], 'problem' => null, 'main' => null ];
		$title = $this->titles->newFromText( LayersConstants::SLIDE_PREFIX . $slide );
		if ( !$title || $title->getNamespace() !== NS_MAIN || $title->isExternal() || $title->hasFragment() ) {
			$plan['problem'] = 'invalid-title';
			return $plan;
		}
		$plan['title'] = $title;
		if ( !$this->scope->includes( $title ) ) {
			$plan['problem'] = 'namespace-not-enabled';
			return $plan;
		}
		if ( $title->exists( IDBAccessObject::READ_LATEST ) ) {
			// Never overwrite a page someone made.
			$plan['problem'] = 'title-taken';
			return $plan;
		}
		$plan['sets'] = array_values( array_unique( array_column( $this->legacy->listLatestSetRows(
			LayersConstants::SLIDE_PREFIX . $slide, LayersConstants::TYPE_SLIDE ), 'name' ) ) );
		if ( $plan['sets'] ) {
			$plan['main'] = implode( "\n", array_map( static fn ( string $set ) =>
				'{{#Slide:' . $slide . '|layerset=' . $set . '}}', $plan['sets'] ) );
		}
		return $plan;
	}

	/**
	 * Create the page showing the shared slide's sets, with no drawings yet.
	 * @param array $plan From plan()
	 * @param Authority $authority
	 * @return int|null ID of the new page; null when the plan creates nothing
	 * @throws \MediaWiki\Extension\Layers\Revision\PublicationException When the page now exists, or
	 *  publication refuses; nothing is written
	 */
	public function commit( array $plan, Authority $authority ): ?int {
		if ( $plan['problem'] !== null || $plan['main'] === null ) {
			return null;
		}
		$summary = wfMessage( 'layers-migration-slide-page-summary' )->plaintextParams( $plan['slide'] )
			->inContentLanguage()->text();
		$this->publisher->publish( $plan['title'], $authority, 0,
			json_encode( [ 'schemaVersion' => DocumentSchema::VERSION, 'surfaces' => [] ] ), $summary,
			new WikitextContent( $plan['main'] ), null, true );
		return $plan['title']->getArticleID( IDBAccessObject::READ_LATEST );
	}
}
