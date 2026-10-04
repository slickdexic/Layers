<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions;
use MediaWiki\Extension\Layers\Revision\PageOwnedRenderCapability;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Extension\Layers\Utility\SetNameResolver;
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Step 2 of the D3 migration: a page that shows shared sets or slides gets its own copy of each, and its
 * direct embeds name the copies, in one bot edit. File sets are copied from the drawing step 1 put on the
 * File: page; slides from their legacy rows. plan() writes nothing.
 */
class PageCopyMigration {
	private LayersDatabase $legacy;
	private PageOwnedScope $scope;
	private RepoGroup $repos;
	private TitleFactory $titles;
	private RevisionLookup $revisions;
	private PageHistoryAccess $access;
	private LegacySurfaceConverter $converter;
	private DirectEmbeddingRewriter $rewriter;
	/** @var callable */
	private $fileTargets;
	private IConnectionProvider $db;
	private PagePublicationService $publisher;
	/** @var callable|null */
	private $pendingFile = null;
	/** @var callable|null */
	private $sourcePages;

	/**
	 * @param LayersDatabase $legacy
	 * @param PageOwnedScope $scope
	 * @param RepoGroup $repos
	 * @param TitleFactory $titles
	 * @param RevisionLookup $revisions
	 * @param PageHistoryAccess $access
	 * @param LegacySurfaceConverter $converter
	 * @param DirectEmbeddingRewriter $rewriter Scanner configured with the wiki's extension tags
	 * @param callable $fileTargets Native file title normalizer for the scanner
	 * @param IConnectionProvider $db
	 * @param PagePublicationService $publisher
	 * @param callable|null $sourcePages (array $candidate): int Native effective page for a direct file embed
	 */
	public function __construct( LayersDatabase $legacy, PageOwnedScope $scope, RepoGroup $repos,
		TitleFactory $titles, RevisionLookup $revisions, PageHistoryAccess $access,
		LegacySurfaceConverter $converter, DirectEmbeddingRewriter $rewriter, callable $fileTargets,
		IConnectionProvider $db, PagePublicationService $publisher, ?callable $sourcePages = null
	) {
		$this->legacy = $legacy;
		$this->scope = $scope;
		$this->repos = $repos;
		$this->titles = $titles;
		$this->revisions = $revisions;
		$this->access = $access;
		$this->converter = $converter;
		$this->rewriter = $rewriter;
		$this->fileTargets = $fileTargets;
		$this->db = $db;
		$this->publisher = $publisher;
		$this->sourcePages = $sourcePages;
	}

	/**
	 * @param int $pageId
	 * @param Authority $authority The migration's actor
	 * @param callable|null $pendingFile (string $fileName): ?string The document step 1 would write on that file's
	 *  page, for a dry run in which step 1 has written nothing
	 * @return array title (?Title); pageId; baseRevisionId; copies (name, source, sourceRevision, embeds, template
	 *  for each new drawing); done (names of copies already made); notMoved (what and why); problem (?string);
	 *  document and main (proposed JSON and text, or null when nothing changes); slides (shared slides it shows)
	 */
	public function plan( int $pageId, Authority $authority, ?callable $pendingFile = null ): array {
		$this->pendingFile = $pendingFile;
		$plan = [ 'title' => null, 'pageId' => $pageId, 'baseRevisionId' => 0, 'copies' => [], 'done' => [],
			'notMoved' => [], 'problem' => null, 'document' => null, 'main' => null, 'slides' => [] ];
		$title = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		$base = $title ? $this->revisions->getRevisionByPageId( $pageId, 0, IDBAccessObject::READ_LATEST ) : null;
		if ( !$title || !$base ) {
			$plan['problem'] = 'no-page';
			return $plan;
		}
		$plan['title'] = $title;
		$plan['baseRevisionId'] = $base->getId();
		if ( !$this->scope->includes( $title ) ) {
			$plan['problem'] = 'namespace-not-enabled';
			return $plan;
		}
		$main = $base->getContent( SlotRecord::MAIN, RevisionRecord::FOR_THIS_USER, $authority );
		if ( !$main instanceof WikitextContent ) {
			$plan['problem'] = 'not-wikitext';
			return $plan;
		}
		$shown = $this->shownSets( $pageId );
		if ( !$shown && !preg_match( '/layer|#slide/i', $main->getText() ) ) {
			return $plan;
		}
		try {
			$candidates = $this->rewriter->scan( $main->getText(), $this->fileTargets );
		} catch ( \InvalidArgumentException $e ) {
			$plan['problem'] = 'unscannable-text';
			return $plan;
		}
		$pending = $title->getNamespace() === NS_FILE ? $this->pendingDocument( $title->getDBkey() ) : null;
		$document = $pending !== null ? json_decode( $pending, false, 64, JSON_THROW_ON_ERROR ) :
			$this->document( $title, $base, $authority );
		$labels = [];
		foreach ( $document->surfaces as $surface ) {
			$labels[$surface->id] = (string)$surface->label;
		}

		$copies = [];
		$rewrites = [];
		$direct = [];
		foreach ( $candidates as $candidate ) {
			$options = $candidate['options'];
			if ( PageOwnedBindingOptions::extract( $options ) !== null ||
				PageOwnedBindingOptions::named( $options, $candidate['kind'], $candidate['target'] ) !== null
			) {
				continue;
			}
			if ( $candidate['kind'] === 'slide' && self::validSlide( $candidate['target'] ) ) {
				$plan['slides'][] = str_replace( ' ', '_', $candidate['target'] );
			}
			$selector = self::option( $options, [ 'layerset', 'layers', 'layer' ] );
			$direct[self::shownKey( $candidate['kind'], $candidate['target'], $selector )] = true;
			if ( self::option( $options, [ 'layersetid' ] ) !== null ) {
				$plan['notMoved'][] = [ 'what' => $candidate['raw'], 'reason' => 'pinned-revision' ];
				continue;
			}
			$reason = null;
			if ( $candidate['kind'] === 'file' ) {
				$page = $this->sourcePages ? ( $this->sourcePages )( $candidate ) :
					(int)( self::option( $options, [ 'page' ] ) ?? 1 );
				$source = $this->fileSource( $candidate['target'], $selector, $page, $authority, $reason );
			} else {
				$source = $this->slideSource( $candidate['target'], $selector, $reason );
			}
			if ( !$source ) {
				if ( $reason !== null ) {
					$plan['notMoved'][] = [ 'what' => $candidate['raw'], 'reason' => $reason ];
				}
				continue;
			}
			$copies[$source['key']] ??= $source;
			$rewrites[] = [ $candidate, $source['key'] ];
		}
		$latest = [];
		foreach ( $shown as [ $kind, $name, $set ] ) {
			if ( $kind === ShownLayerSets::SLIDE && self::validSlide( $name ) ) {
				$plan['slides'][] = str_replace( ' ', '_', $name );
			}
			if ( isset( $direct[self::shownKey( $kind, $name, $set === '' ? null : $set )] ) ) {
				// The page's own text shows it; that embed was handled above.
				continue;
			}
			$what = $kind . ' ' . $name . ( $set === '' ? '' : ' ' . $set );
			$reason = null;
			$source = $kind === ShownLayerSets::FILE ?
				$this->fileSource( 'File:' . $name, $set === '' ? 'on' : $set, 1, $authority, $reason ) :
				$this->slideSource( $name, $set === '' ? null : $set, $reason );
			if ( !$source ) {
				if ( $reason !== null ) {
					$plan['notMoved'][] = [ 'what' => $what, 'reason' => $reason ];
				}
				continue;
			}
			if ( isset( $copies[$source['key']] ) ) {
				continue;
			}
			// Shown through a template or gallery: after the migration the bare name must find the copy.
			if ( $set === '' && $kind === ShownLayerSets::FILE ) {
				// "The latest set" becomes the page's only drawing of the file; decided once the others are known.
				$latest[] = [ $what, $source, 'File:' . str_replace( ' ', '_', $name ) ];
				continue;
			}
			$source['template'] = true;
			$source['wanted'] = $kind === ShownLayerSets::FILE ? $set : $name;
			$copies[$source['key']] = $source;
		}
		foreach ( $latest as [ $what, $source, $fileTitle ] ) {
			if ( isset( $copies[$source['key']] ) ) {
				continue;
			}
			if ( !isset( $labels[FilePageMigration::surfaceId( $source['legacyId'], $pageId )] ) &&
				self::drawingsOf( $fileTitle, $document->surfaces, $copies ) > 0
			) {
				$plan['notMoved'][] = [ 'what' => $what, 'reason' => 'template-latest-set' ];
				continue;
			}
			$source['template'] = true;
			$copies[$source['key']] = $source;
		}
		$plan['slides'] = array_values( array_unique( $plan['slides'] ) );

		$names = [];
		$taken = array_values( $labels );
		$setsPerSlide = array_count_values( array_map( static fn ( $s ) => $s['source'],
			array_filter( $copies, static fn ( $s ) => $s['kind'] === 'slide' && empty( $s['template'] ) ) ) );
		foreach ( $copies as $key => $source ) {
			if ( $source['kind'] === 'slide' && empty( $source['template'] ) && $setsPerSlide[$source['source']] > 1 ) {
				// Several sets of one slide on the page: the set names tell the copies apart.
				$source['wanted'] = wfMessage( 'layers-migration-slide-set-name' )
					->plaintextParams( $source['source'], $source['set'] )->inContentLanguage()->text();
			}
			$copyId = FilePageMigration::surfaceId( $source['legacyId'], $pageId );
			if ( isset( $labels[$copyId] ) ) {
				// Made by an earlier run, or this is the file's own page, which already has it.
				$names[$key] = $labels[$copyId];
				$plan['done'][] = $labels[$copyId];
				continue;
			}
			$wanted = DrawingName::normalize( $source['wanted'] ) ?? $copyId;
			$name = DrawingName::unused( $wanted, $taken );
			if ( !empty( $source['template'] ) && $name !== $wanted && $source['kind'] === 'slide' ) {
				// A bare slide name finds only that exact name; a file's finds a numbered one of the same file.
				$plan['notMoved'][] = [ 'what' => $source['source'] . ' ' . $wanted,
					'reason' => 'template-name-taken' ];
				continue;
			}
			$surface = clone $source['surface'];
			$surface->id = $copyId;
			$surface->label = $name;
			$document->surfaces[] = $surface;
			$taken[] = $name;
			$names[$key] = $name;
			$plan['copies'][] = [ 'name' => $name, 'kind' => $source['kind'], 'source' => $source['source'],
				'sourceRevision' => $source['sourceRevision'], 'legacyId' => $source['legacyId'],
				'template' => !empty( $source['template'] ),
				'embeds' => count( array_filter( $rewrites, static fn ( $r ) => $r[1] === $key ) ) ];
		}

		$text = $main->getText();
		// From the end, so that earlier offsets stay valid.
		usort( $rewrites, static fn ( $a, $b ) => $b[0]['start'] <=> $a[0]['start'] );
		try {
			foreach ( $rewrites as [ $candidate, $key ] ) {
				$text = $this->rewriter->rewrite( $text, $candidate['start'], $candidate['raw'], $pageId, $names[$key],
					$this->fileTargets );
			}
		} catch ( \InvalidArgumentException $e ) {
			$plan['problem'] = 'embed-not-rewritable';
			return $plan;
		}
		if ( $plan['copies'] || $text !== $main->getText() ) {
			$json = JsonSnapshotCodec::encode( $document );
			try {
				( new LayersDocumentContent( $json ) )->getCanonicalText();
			} catch ( \InvalidArgumentException $e ) {
				$plan['problem'] = 'document-limits';
				return $plan;
			}
			$plan['document'] = $json;
			$plan['main'] = $text !== $main->getText() ? $text : null;
		}
		return $plan;
	}

	/**
	 * @param array $plan From plan()
	 * @param Authority $authority The migration's actor
	 * @return int|null New revision of the page; null when the plan changes nothing
	 * @throws \MediaWiki\Extension\Layers\Revision\PublicationException When the page changed since planning,
	 *  or publication refuses; nothing is written
	 */
	public function commit( array $plan, Authority $authority ): ?int {
		if ( $plan['problem'] !== null || $plan['document'] === null ) {
			return null;
		}
		$items = [];
		foreach ( $plan['copies'] as $copy ) {
			$name = wfMessage( 'quotation-marks' )->plaintextParams( $copy['name'] )->inContentLanguage()->text();
			$items[] = $copy['kind'] === 'slide' ?
				wfMessage( 'layers-migration-slide-item' )->params( $name )->plaintextParams( $copy['source'] )
					->inContentLanguage()->text() :
				wfMessage( 'layers-migration-copy-item' )->params( $name, $copy['source'],
					(string)$copy['sourceRevision'] )->inContentLanguage()->text();
		}
		$summary = $items ? wfMessage( 'layers-migration-page-summary' )->numParams( count( $items ) )
			->params( implode( wfMessage( 'comma-separator' )->inContentLanguage()->text(), $items ) )
			->inContentLanguage()->text() :
			wfMessage( 'layers-migration-embeds-summary' )->inContentLanguage()->text();
		return $this->publisher->publish( $plan['title'], $authority, $plan['baseRevisionId'], $plan['document'],
			$summary, $plan['main'] === null ? null : new WikitextContent( $plan['main'] ), $plan['pageId'],
			PagePublicationService::MIGRATION_TAG );
	}

	/**
	 * The drawing step 1 made on the File: page for the set a file embed shows.
	 * @param string $target Canonical `File:` DB key text
	 * @param string|null $selector The embed's set selector; null shows no annotations
	 * @param int $page
	 * @param Authority $authority
	 * @param string|null &$reason Why nothing is copied, when that needs listing
	 * @return array|null
	 */
	private function fileSource( string $target, ?string $selector, int $page, Authority $authority,
		?string &$reason
	): ?array {
		$title = $this->titles->newFromText( $target );
		$file = $selector !== null && $title ? $this->repos->getLocalRepo()->newFile( $title ) : null;
		if ( !$file || !$file->exists() ) {
			return null;
		}
		$page = max( 1, $page );
		$set = SetNameResolver::resolve( $this->legacy, $file->getName(), $file->getSha1(), $selector, $page );
		$row = $set === null ? null :
			$this->legacy->getLayerSetByName( $file->getName(), $file->getSha1(), $set, $page );
		if ( !$row ) {
			if ( SetNameResolver::isSpecificName( $selector ) ) {
				// Shown nothing before either, as legacy embeds look only at the current file version.
				$reason = 'no-current-set';
			}
			return null;
		}
		$filePage = $file->getTitle();
		$filePageId = $filePage->getArticleID( IDBAccessObject::READ_LATEST );
		$surfaceId = FilePageMigration::surfaceId( (int)$row['id'], $filePageId );
		$revision = null;
		$pending = $this->pendingDocument( $file->getName() );
		if ( $pending !== null ) {
			$surfaces = json_decode( $pending, false, 64, JSON_THROW_ON_ERROR )->surfaces;
		} else {
			$revision = $filePageId > 0 ?
				$this->revisions->getRevisionByPageId( $filePageId, 0, IDBAccessObject::READ_LATEST ) : null;
			$surfaces = $revision ? $this->document( $filePage, $revision, $authority )->surfaces : [];
		}
		foreach ( $surfaces as $surface ) {
			if ( $surface->id === $surfaceId ) {
				return [ 'key' => 'row:' . $row['id'], 'legacyId' => (int)$row['id'], 'kind' => $surface->kind,
					'surface' => $surface, 'wanted' => (string)$surface->label,
					'source' => $filePage->getPrefixedText(),
					'sourceRevision' => $revision ? $revision->getId() : null ];
			}
		}
		$reason = 'file-not-migrated';
		return null;
	}

	/**
	 * A shared slide's set as a drawing named after the slide.
	 * @param string $slide
	 * @param string|null $selector The embed's set selector; null shows the latest set
	 * @param string|null &$reason Why nothing is copied, when that needs listing
	 * @return array|null
	 */
	private function slideSource( string $slide, ?string $selector, ?string &$reason ): ?array {
		if ( !self::validSlide( $slide ) ) {
			// The legacy parser shows an error for this name, not the slide.
			$reason = 'invalid-slide-name';
			return null;
		}
		$imgName = LayersConstants::SLIDE_PREFIX . $slide;
		$set = SetNameResolver::resolve( $this->legacy, $imgName, LayersConstants::TYPE_SLIDE, $selector );
		$row = $set === null ? null : $this->legacy->getLayerSetByName( $imgName, LayersConstants::TYPE_SLIDE, $set );
		$record = $row ? $this->legacy->getLayerSetForAdoption( (int)$row['id'] ) : null;
		if ( !$record ) {
			return null;
		}
		try {
			$surface = json_decode( $this->converter->convert( $record, 'slide', null ), false, 64,
				JSON_THROW_ON_ERROR )->surfaces[0];
			( new LayersDocumentContent( JsonSnapshotCodec::encode(
				(object)[ 'schemaVersion' => DocumentSchema::VERSION, 'surfaces' => [ $surface ] ] ) ) )
				->getCanonicalText();
		} catch ( \InvalidArgumentException $e ) {
			$reason = 'unconvertible';
			return null;
		}
		if ( !PageOwnedRenderCapability::isRenderable( $surface ) ) {
			$reason = 'not-renderable';
			return null;
		}
		return [ 'key' => 'row:' . $row['id'], 'legacyId' => (int)$row['id'], 'kind' => 'slide',
			'surface' => $surface, 'wanted' => $slide, 'source' => $slide, 'set' => $set, 'sourceRevision' => null ];
	}

	/**
	 * @param Title $title
	 * @param RevisionRecord $revision
	 * @param Authority $authority
	 * @return \stdClass Decoded as objects, so empty JSON objects in layers stay objects
	 */
	private function document( Title $title, RevisionRecord $revision, Authority $authority ): \stdClass {
		return $revision->hasSlot( PageRevisionWriter::SLOT ) ?
			json_decode( $this->access->read( $title, $revision->getId(), $authority, $revision->getPageId() )
				->getText(), false, 64, JSON_THROW_ON_ERROR ) :
			(object)[ 'schemaVersion' => DocumentSchema::VERSION, 'surfaces' => [] ];
	}

	/**
	 * Sets the page showed when it was last parsed, read from the database rather than a cache.
	 * @param int $pageId
	 * @return string[][]
	 */
	private function shownSets( int $pageId ): array {
		return ShownLayerSets::decode( $this->db->getPrimaryDatabase()->newSelectQueryBuilder()
			->select( 'pp_value' )->from( 'page_props' )
			->where( [ 'pp_page' => $pageId, 'pp_propname' => ShownLayerSets::PROPERTY ] )
			->caller( __METHOD__ )->fetchField() );
	}

	/**
	 * @param string $fileName
	 * @return string|null The document step 1 would write on the file's page, in a dry run
	 */
	private function pendingDocument( string $fileName ): ?string {
		return $this->pendingFile ? ( $this->pendingFile )( $fileName ) : null;
	}

	/**
	 * @param string $kind 'file' or 'slide'
	 * @param string $name File title or DB key, or slide name
	 * @param string|null $selector Set selector; null or a show intent for the latest set
	 * @return string Same for an embed in the text and the page property entry it produces
	 */
	private static function shownKey( string $kind, string $name, ?string $selector ): string {
		$name = str_replace( ' ', '_', preg_replace( '/^File:/', '', trim( $name ) ) );
		$set = $selector === null || SetNameResolver::isShowIntent( $selector ) ? '' : trim( $selector );
		return $kind . "\n" . $name . "\n" . $set;
	}

	/**
	 * @param string $fileTitle 'File:<DB key>'
	 * @param \stdClass[] $surfaces The page's drawings
	 * @param array[] $copies Planned copies
	 * @return int How many of them are drawings of that file
	 */
	private static function drawingsOf( string $fileTitle, array $surfaces, array $copies ): int {
		$all = array_merge( $surfaces, array_column( $copies, 'surface' ) );
		return count( array_filter( $all, static fn ( $surface ) =>
			( $surface->source->fileTitle ?? null ) === $fileTitle ) );
	}

	/**
	 * @param string $slide
	 * @return bool Whether the legacy parser accepts the name
	 */
	private static function validSlide( string $slide ): bool {
		return ( new SlideNameValidator() )->isValid( trim( $slide ) );
	}

	/**
	 * @param string[] $options Raw embed options
	 * @param string[] $keys
	 * @return string|null Value of the first option with one of the keys
	 */
	private static function option( array $options, array $keys ): ?string {
		foreach ( $options as $option ) {
			$parts = explode( '=', $option, 2 );
			if ( isset( $parts[1] ) && in_array( strtolower( trim( $parts[0], " \t\r\n\f" ) ), $keys, true ) ) {
				return trim( $parts[1], " \t\r\n\f" );
			}
		}
		return null;
	}
}
