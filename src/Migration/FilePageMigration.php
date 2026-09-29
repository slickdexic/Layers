<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\LegacyMediaResolver;
use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;
use MediaWiki\Extension\Layers\Revision\LossyLayerException;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedRenderCapability;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Step 1 of the D3 migration: the shared sets saved for a file's current version become drawings of its
 * File: page, in one bot edit. plan() writes nothing; commit() publishes a plan with its exact base.
 */
class FilePageMigration {
	private LayersDatabase $legacy;
	private PageOwnedScope $scope;
	private RepoGroup $repos;
	private TitleFactory $titles;
	private RevisionLookup $revisions;
	private PageHistoryAccess $access;
	private LegacyMediaResolver $media;
	private LegacySurfaceConverter $converter;
	private PagePublicationService $publisher;

	/**
	 * @param LayersDatabase $legacy
	 * @param PageOwnedScope $scope
	 * @param RepoGroup $repos
	 * @param TitleFactory $titles
	 * @param RevisionLookup $revisions
	 * @param PageHistoryAccess $access
	 * @param LegacyMediaResolver $media
	 * @param LegacySurfaceConverter $converter
	 * @param PagePublicationService $publisher
	 */
	public function __construct( LayersDatabase $legacy, PageOwnedScope $scope, RepoGroup $repos,
		TitleFactory $titles, RevisionLookup $revisions, PageHistoryAccess $access, LegacyMediaResolver $media,
		LegacySurfaceConverter $converter, PagePublicationService $publisher
	) {
		$this->legacy = $legacy;
		$this->scope = $scope;
		$this->repos = $repos;
		$this->titles = $titles;
		$this->revisions = $revisions;
		$this->access = $access;
		$this->media = $media;
		$this->converter = $converter;
		$this->publisher = $publisher;
	}

	/**
	 * The ID a legacy row's drawing gets on a page, so that a rerun recognises work already done.
	 * @param int $legacyId
	 * @param int $pageId
	 * @return string
	 */
	public static function surfaceId( int $legacyId, int $pageId ): string {
		return 'm' . substr( hash( 'sha256', 'migration:' . $legacyId . ':' . $pageId ), 0, 24 );
	}

	/**
	 * @param string $imgName File name as layer_sets stores it
	 * @param Authority $authority The migration's actor
	 * @return array file; title (?Title); pageId; baseRevisionId; add (legacyId, set, page, name of each drawing
	 *  to add); done and notMoved (set and page, and for notMoved the reason); problem (?string, why nothing
	 *  can move); document (complete proposed JSON, or null when nothing is added)
	 */
	public function plan( string $imgName, Authority $authority ): array {
		$plan = [ 'file' => $imgName, 'title' => null, 'pageId' => 0, 'baseRevisionId' => 0,
			'add' => [], 'done' => [], 'notMoved' => [], 'problem' => null, 'document' => null ];
		$title = $this->titles->makeTitleSafe( NS_FILE, $imgName );
		if ( !$title ) {
			$plan['problem'] = 'invalid-name';
			return $plan;
		}
		$plan['title'] = $title;
		$file = $this->repos->getLocalRepo()->newFile( $title );
		if ( !$file || !$file->exists() ) {
			$plan['problem'] = $this->repos->findFile( $title ) ? 'foreign-file' : 'missing-file';
			return $plan;
		}
		$pageId = $title->getArticleID( IDBAccessObject::READ_LATEST );
		if ( $pageId <= 0 ) {
			$plan['problem'] = 'no-file-page';
			return $plan;
		}
		if ( !$this->scope->includes( $title ) ) {
			$plan['problem'] = 'namespace-not-enabled';
			return $plan;
		}
		$base = $this->revisions->getRevisionByPageId( $pageId, 0, IDBAccessObject::READ_LATEST );
		if ( !$base ) {
			$plan['problem'] = 'no-file-page';
			return $plan;
		}
		$plan['pageId'] = $pageId;
		$plan['baseRevisionId'] = $base->getId();
		$document = $base->hasSlot( PageRevisionWriter::SLOT ) ?
			json_decode( $this->access->read( $title, $base->getId(), $authority, $pageId )->getText(), false, 64,
				JSON_THROW_ON_ERROR ) :
			(object)[ 'schemaVersion' => DocumentSchema::VERSION, 'surfaces' => [] ];
		$existing = [];
		$taken = [];
		foreach ( $document->surfaces as $surface ) {
			$existing[$surface->id] = true;
			$taken[] = (string)$surface->label;
		}

		$current = [];
		foreach ( $this->legacy->listLatestSetRows( $file->getName(), $file->getSha1() ) as $row ) {
			$current[$row['name'] . "\n" . $row['page']] = true;
			$entry = [ 'set' => $row['name'], 'page' => $row['page'] ];
			$surfaceId = self::surfaceId( $row['id'], $pageId );
			if ( isset( $existing[$surfaceId] ) ) {
				$plan['done'][] = $entry;
				continue;
			}
			$reason = null;
			$surface = $this->convert( $row['id'], $surfaceId, $file->getTimestamp(), $file->getWidth( $row['page'] ),
				$file->getHeight( $row['page'] ), $authority, $reason );
			if ( !$surface ) {
				$plan['notMoved'][] = $entry + [ 'reason' => $reason ];
				continue;
			}
			$wanted = $row['page'] === 1 ? $row['name'] : wfMessage( 'layers-migration-pdf-page-name' )
				->plaintextParams( $row['name'] )->numParams( $row['page'] )->inContentLanguage()->text();
			$surface->label = DrawingName::unused( DrawingName::normalize( $wanted ) ?? $surfaceId, $taken );
			$taken[] = $surface->label;
			$document->surfaces[] = $surface;
			$plan['add'][] = [ 'legacyId' => $row['id'], 'name' => $surface->label ] + $entry;
		}
		foreach ( $this->legacy->listSetsOnOtherVersions( $file->getName(), $file->getSha1() ) as $row ) {
			if ( !isset( $current[$row['name'] . "\n" . $row['page']] ) ) {
				$plan['notMoved'][] = [ 'set' => $row['name'], 'page' => $row['page'],
					'reason' => 'earlier-file-version' ];
			}
		}
		if ( $plan['add'] ) {
			$json = JsonSnapshotCodec::encode( $document );
			try {
				( new LayersDocumentContent( $json ) )->getCanonicalText();
				$plan['document'] = $json;
			} catch ( \InvalidArgumentException $e ) {
				$plan['problem'] = 'document-limits';
			}
		}
		return $plan;
	}

	/**
	 * @param array $plan From plan()
	 * @param Authority $authority The migration's actor
	 * @return int|null New revision of the File: page; null when the plan adds nothing
	 * @throws \MediaWiki\Extension\Layers\Revision\PublicationException When the page changed since planning,
	 *  or publication refuses; nothing is written
	 */
	public function commit( array $plan, Authority $authority ): ?int {
		if ( $plan['problem'] !== null || $plan['document'] === null ) {
			return null;
		}
		$names = array_map( static fn ( array $add ) => wfMessage( 'quotation-marks' )->plaintextParams( $add['name'] )
			->inContentLanguage()->text(), $plan['add'] );
		$summary = wfMessage( 'layers-migration-file-summary' )->numParams( count( $names ) )
			->plaintextParams( implode( wfMessage( 'comma-separator' )->inContentLanguage()->text(), $names ) )
			->inContentLanguage()->text();
		return $this->publisher->publish( $plan['title'], $authority, $plan['baseRevisionId'], $plan['document'],
			$summary, null, $plan['pageId'], true );
	}

	/**
	 * One legacy row as a drawing of its file's current version, only if nothing is lost.
	 * @param int $legacyId
	 * @param string $surfaceId
	 * @param string $fileTimestamp
	 * @param int|false $width
	 * @param int|false $height
	 * @param Authority $authority
	 * @param string|null &$reason Why not, when null is returned
	 * @return \stdClass|null
	 */
	private function convert( int $legacyId, string $surfaceId, string $fileTimestamp, $width, $height,
		Authority $authority, ?string &$reason
	): ?\stdClass {
		if ( $width > DocumentSchema::MAX_DIMENSION || $height > DocumentSchema::MAX_DIMENSION ) {
			$reason = 'image-too-large';
			return null;
		}
		$record = $this->legacy->getLayerSetForAdoption( $legacyId );
		if ( !$record ) {
			$reason = 'unreadable';
			return null;
		}
		try {
			$media = $this->media->resolve( $record, $fileTimestamp, $authority );
		} catch ( \DomainException $e ) {
			$reason = 'source-unavailable';
			return null;
		}
		try {
			$json = $this->converter->convert( $record, $surfaceId, $media );
			// Refuses layers the current rules would change, as publication does.
			( new LayersDocumentContent( $json ) )->getCanonicalText();
		} catch ( LossyLayerException $e ) {
			$reason = 'would-lose-data';
			return null;
		} catch ( \InvalidArgumentException $e ) {
			$reason = 'unconvertible';
			return null;
		}
		$surface = json_decode( $json, false, 64, JSON_THROW_ON_ERROR )->surfaces[0];
		if ( !PageOwnedRenderCapability::isRenderable( $surface ) ) {
			$reason = 'not-renderable';
			return null;
		}
		return $surface;
	}
}
