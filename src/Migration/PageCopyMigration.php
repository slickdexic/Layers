<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedBinding;
use MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions;
use MediaWiki\Extension\Layers\Revision\PageOwnedRenderCapability;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Extension\Layers\Utility\SetNameResolver;
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\MutableRevisionRecord;
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
	private array $snapshots = [];
	private array $pendingDocuments = [];

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
		$this->snapshots = [];
		$this->pendingDocuments = [];
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
		if ( $pending !== null ) {
			$this->access->assertCanPrepareEdit( $title, $authority );
		}
		$document = $pending !== null ? json_decode( $pending, false, 64, JSON_THROW_ON_ERROR ) :
			$this->document( $title, $base, $authority );
		$existing = [];
		foreach ( $document->surfaces as $surface ) {
			$existing[$surface->id] = $surface;
		}
		$indirect = $this->indirectSets( $main->getText(), $candidates, $title, $base->getId(), $shown );

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
			$rewrites[] = [ $candidate, $source['key'], $source['legacyId'] ];
		}
		foreach ( $shown as [ $kind, $name, $set ] ) {
			if ( $kind === ShownLayerSets::SLIDE && self::validSlide( $name ) ) {
				$plan['slides'][] = str_replace( ' ', '_', $name );
			}
			$shownKey = self::shownKey( $kind, $name, $set === '' ? null : $set );
			if ( isset( $direct[$shownKey] ) && !isset( $indirect[$shownKey] ) ) {
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
			// Every unchanged occurrence constrains the same group, including named and show-intent uses.
			$key = $source['key'];
			$copies[$key] ??= $source;
			$copies[$key]['template'] = true;
			$copies[$key]['constraints'][] = [ 'latest' => $set === '' && $kind === ShownLayerSets::FILE,
				'name' => $kind === ShownLayerSets::FILE ? $set : $name, 'what' => $what ];
		}
		$plan['slides'] = array_values( array_unique( $plan['slides'] ) );

		$names = [];
		$done = [];
		$incoming = [];
		$setsPerSlide = array_count_values( array_map( static fn ( $s ) => $s['source'],
			array_filter( $copies, static fn ( $s ) => $s['kind'] === 'slide' && empty( $s['template'] ) ) ) );
		foreach ( $copies as $key => $source ) {
			if ( $source['kind'] === 'slide' && empty( $source['template'] ) && $setsPerSlide[$source['source']] > 1 ) {
				// Several sets of one slide on the page: the set names tell the copies apart.
				$source['wanted'] = wfMessage( 'layers-migration-slide-set-name' )
					->plaintextParams( $source['source'], $source['set'] )->inContentLanguage()->text();
			}
			$copies[$key] = $source;
			$present = [];
			$members = [];
			foreach ( $source['members'] as $member ) {
				$id = FilePageMigration::surfaceId( $member['legacyId'], $pageId );
				if ( isset( $existing[$id] ) ) {
					if ( !self::sameMember( $existing[$id], $member['surface'] ) ) {
						$plan['problem'] = 'changed-copy-scope';
						return $plan;
					}
					$present[$member['legacyId']] = $existing[$id]->label;
				}
				$surface = clone $member['surface'];
				$surface->id = $id;
				if ( $source['kind'] === 'slide' ) {
					$surface->label = $source['wanted'];
				}
				$members[] = $surface;
			}
			if ( count( $present ) === count( $members ) ) {
				$names[$key] = $present;
				$done[$key] = $present;
				continue;
			}
			$prior = $present !== [];
			foreach ( $source['priorIds'] as $id ) {
				$prior = $prior || isset( $existing[FilePageMigration::surfaceId( $id, $pageId )] );
			}
			if ( $prior ) {
				$plan['notMoved'][] = [ 'what' => $source['source'], 'reason' => 'existing-migration-group',
					'missing' => array_values( array_map( static fn ( $member ) => $member['legacyId'],
						array_filter( $source['members'], static fn ( $member ) =>
							!isset( $present[$member['legacyId']] ) ) ) ) ];
				continue;
			}
			$incoming[] = [ 'key' => $key, 'wanted' => $source['wanted'], 'members' => $members ];
		}
		try {
			$allocations = MigrationNameAllocator::allocate( $document->surfaces, $incoming );
		} catch ( \InvalidArgumentException $e ) {
			$plan['problem'] = 'invalid-source-group';
			return $plan;
		}
		$allocated = [];
		foreach ( $allocations as $index => $allocation ) {
			$key = $allocation['key'];
			foreach ( $incoming[$index]['members'] as $memberIndex => $surface ) {
				$surface->label = $allocation['name'];
				$allocated[$key][] = $surface;
				$rowId = $copies[$key]['members'][$memberIndex]['legacyId'];
				$names[$key][$rowId] = $surface->label;
			}
		}
		// Removing a refused group can change bare-name resolution. Recheck each survivor against
		// the document that will actually be saved, without reallocating or changing existing bytes.
		do {
			$proposed = $document->surfaces;
			foreach ( $allocated as $key => $members ) {
				if ( isset( $names[$key] ) ) {
					array_push( $proposed, ...$members );
				}
			}
			$refused = [];
			foreach ( $names as $key => $memberNames ) {
				$problem = $this->templateProblem( $copies[$key], $proposed, $pageId );
				if ( $problem === null && !$this->directMatches( $copies[$key], $memberNames,
					$rewrites, $proposed, $pageId ) ) {
					$problem = [ 'what' => $copies[$key]['source'], 'reason' => 'ambiguous-copy-name' ];
				}
				if ( $problem !== null ) {
					$refused[$key] = $problem;
				}
			}
			foreach ( $refused as $key => $problem ) {
				$plan['notMoved'][] = $problem;
				unset( $names[$key], $done[$key] );
			}
		} while ( $refused );
		$document->surfaces = $proposed;
		foreach ( $done as $memberNames ) {
			array_push( $plan['done'], ...array_values( $memberNames ) );
		}
		foreach ( $allocated as $key => $members ) {
			if ( !isset( $names[$key] ) ) {
				continue;
			}
			$source = $copies[$key];
			foreach ( $members as $memberIndex => $surface ) {
				$rowId = $source['members'][$memberIndex]['legacyId'];
				$plan['copies'][] = [ 'name' => $surface->label, 'kind' => $source['kind'],
					'source' => $source['source'], 'sourceRevision' => $source['sourceRevision'], 'legacyId' => $rowId,
					'template' => !empty( $source['template'] ),
					'embeds' => count( array_filter( $rewrites, static fn ( $r ) =>
						$r[1] === $key && $r[2] === $rowId ) ) ];
			}
		}
		$plan['sources'] = [];
		foreach ( array_keys( $names ) as $key ) {
			if ( isset( $copies[$key]['fileKey'] ) ) {
				$fileKey = $copies[$key]['fileKey'];
				$plan['sources'][$fileKey] = $this->snapshots[$fileKey];
			}
		}

		$text = $main->getText();
		// From the end, so that earlier offsets stay valid.
		usort( $rewrites, static fn ( $a, $b ) => $b[0]['start'] <=> $a[0]['start'] );
		try {
			foreach ( $rewrites as [ $candidate, $key, $rowId ] ) {
				if ( !isset( $names[$key][$rowId] ) ) {
					continue;
				}
				$text = $this->rewriter->rewrite( $text, $candidate['start'], $candidate['raw'], $pageId,
					$names[$key][$rowId],
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
		$copiedIds = array_map( static fn ( $copy ) =>
			FilePageMigration::surfaceId( $copy['legacyId'], $plan['pageId'] ), $plan['copies'] );
		$content = new LayersDocumentContent( $plan['document'] );
		$media = new SourceVersionResolver( $this->repos->getLocalRepo(), $this->titles );
		$verifySources = function ( ?int $publishedRevision = null ) use (
			$plan, $authority, $copiedIds, $content, $media
		): void {
			foreach ( $plan['sources'] ?? [] as $snapshot ) {
				// A File page may only rewrite its own embeds. Its successful destination
				// save advances that same source owner, while the admitted source is still the base.
				$latest = $snapshot['pageId'] === $plan['pageId'] &&
					$snapshot['baseRevisionId'] === $plan['baseRevisionId'] ? $publishedRevision : null;
				$this->verifySnapshot( $snapshot, $authority, $latest );
			}
			try {
				// Recheck only incoming members: unrelated retained historical pins remain unchanged.
				$media->resolve( $content, $authority, $copiedIds );
			} catch ( \DomainException $e ) {
				throw new PublicationException( 'layers-source-unavailable', 0, $e );
			}
		};
		$verifySources();
		$groups = [];
		foreach ( $plan['copies'] as $copy ) {
			$key = JsonSnapshotCodec::encode( [ $copy['kind'], $copy['source'], $copy['name'] ] );
			if ( isset( $groups[$key] ) ) {
				continue;
			}
			$groups[$key] = true;
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
		$dbw = $this->db->getPrimaryDatabase();
		return $dbw->doAtomicSection( __METHOD__, function () use (
			$plan, $authority, $summary, $verifySources
		) {
			$id = $this->publisher->publish( $plan['title'], $authority, $plan['baseRevisionId'], $plan['document'],
				$summary, $plan['main'] === null ? null : new WikitextContent( $plan['main'] ), $plan['pageId'],
				PagePublicationService::MIGRATION_TAG, $verifySources );
			// Core's later save hooks still run inside this connection's outer atomic section.
			$verifySources( $id );
			return $id;
		}, $dbw::ATOMIC_CANCELABLE );
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
		$fileKey = 'File:' . $filePage->getDBkey();
		if ( !array_key_exists( $fileKey, $this->snapshots ) ) {
			try {
				$revision = $filePageId > 0 ?
					$this->revisions->getRevisionByPageId( $filePageId, 0, IDBAccessObject::READ_LATEST ) : null;
				if ( !$revision || !$authority->authorizeRead( 'read', $filePage ) ||
					!RevisionRecord::userCanBitfield( $revision->getVisibility(), RevisionRecord::DELETED_TEXT,
						$authority, $revision->getPage() ) ) {
					throw new \DomainException( 'layers-revision-unavailable' );
				}
				$current = $this->document( $filePage, $revision, $authority );
				$pending = $this->pendingDocument( $file->getName() );
				$json = $pending ?? JsonSnapshotCodec::encode( $current );
				$content = new LayersDocumentContent( $json );
				if ( !$content->isReadable() ) {
					throw new \DomainException( 'layers-revision-unavailable' );
				}
				$this->snapshots[$fileKey] = [ 'title' => $filePage, 'pageId' => $filePageId,
					'baseRevisionId' => $revision->getId(), 'pending' => $pending !== null,
					'json' => $json, 'surfaces' => json_decode( $json, false, 64, JSON_THROW_ON_ERROR )->surfaces,
					'rows' => $this->legacy->listRetainedFileSetRows( $file->getName() ) ];
			} catch ( \DomainException $e ) {
				$this->snapshots[$fileKey] = [ 'error' => 'source-unavailable' ];
			}
		}
		$snapshot = $this->snapshots[$fileKey];
		if ( isset( $snapshot['error'] ) ) {
			$reason = $snapshot['error'];
			return null;
		}
		$selected = array_values( array_filter( $snapshot['surfaces'],
			static fn ( $surface ) => $surface->id === $surfaceId ) );
		if ( count( $selected ) !== 1 ) {
			$reason = 'file-not-migrated';
			return null;
		}
		$selected = $selected[0];
		if ( ( $selected->source->fileTitle ?? null ) !== $fileKey ||
			( $selected->source->page ?? null ) !== $page ) {
			$reason = 'invalid-source-group';
			return null;
		}
		$members = [];
		$legacyNames = [];
		foreach ( $snapshot['surfaces'] as $surface ) {
			if ( $surface->label !== $selected->label || ( $surface->source->fileTitle ?? null ) !== $fileKey ) {
				continue;
			}
			$matches = array_values( array_filter( $snapshot['rows'], static fn ( $retained ) =>
				FilePageMigration::surfaceId( $retained['id'], $filePageId ) === $surface->id ) );
			if ( count( $matches ) !== 1 ) {
				$reason = 'unmapped-source-member';
				return null;
			}
			$metadata = $matches[0];
			$metadataTitle = $this->titles->makeTitleSafe( NS_FILE, $metadata['imgName'] );
			$kind = $metadata['mime'] === 'application/pdf' ? 'pdf' :
				( str_starts_with( $metadata['mime'], 'image/' ) ? 'image' : null );
			if ( !$metadataTitle || 'File:' . $metadataTitle->getDBkey() !== $fileKey ||
				$kind !== $surface->kind || $metadata['page'] !== ( $surface->source->page ?? null ) ) {
				$reason = 'invalid-source-group';
				return null;
			}
			$members[] = [ 'legacyId' => $metadata['id'], 'surface' => $surface ];
			$legacyNames[$metadata['name']] = true;
		}
		$priorIds = [];
		foreach ( $snapshot['rows'] as $metadata ) {
			if ( isset( $legacyNames[$metadata['name']] ) ) {
				$priorIds[] = $metadata['id'];
			}
		}
		return [ 'key' => JsonSnapshotCodec::encode( [ $fileKey, $selected->label ] ),
			'legacyId' => (int)$row['id'], 'kind' => $selected->kind, 'surface' => $selected,
			'members' => $members, 'priorIds' => $priorIds, 'wanted' => (string)$selected->label,
			'source' => $filePage->getPrefixedText(), 'fileKey' => $fileKey,
			'sourceRevision' => $snapshot['pending'] ? null : $snapshot['baseRevisionId'] ];
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
			'surface' => $surface, 'members' => [ [ 'legacyId' => (int)$row['id'], 'surface' => $surface ] ],
			'priorIds' => [], 'wanted' => $slide, 'source' => $slide, 'set' => $set, 'sourceRevision' => null ];
	}

	/**
	 * @param \stdClass $existing
	 * @param \stdClass $source
	 * @return bool
	 */
	private static function sameMember( \stdClass $existing, \stdClass $source ): bool {
		return $existing->kind === $source->kind && ( $source->kind === 'slide' ||
			( ( $existing->source->fileTitle ?? null ) === $source->source->fileTitle &&
				( $existing->source->page ?? null ) === $source->source->page ) );
	}

	/**
	 * @param array $source
	 * @param array $surfaces
	 * @param int $pageId
	 * @return array|null Refusal for an unchanged occurrence that cannot select this group
	 */
	private function templateProblem( array $source, array $surfaces, int $pageId ): ?array {
		foreach ( $source['constraints'] ?? [] as $constraint ) {
			if ( !$this->constraintMatches( $source, $constraint, $surfaces, $pageId ) ) {
				return [ 'what' => $constraint['latest'] ? $constraint['what'] : $source['source'],
					'reason' => $constraint['latest'] ? 'template-latest-set' : 'template-name-taken' ];
			}
		}
		return null;
	}

	/**
	 * @param array $source
	 * @param array $constraint
	 * @param array $surfaces
	 * @param int $pageId
	 * @return bool
	 */
	private function constraintMatches( array $source, array $constraint, array $surfaces, int $pageId ): bool {
		$content = new LayersDocumentContent( JsonSnapshotCodec::encode(
			(object)[ 'schemaVersion' => DocumentSchema::VERSION, 'surfaces' => $surfaces ] ) );
		$title = $this->titles->newFromID( $pageId );
		$revision = new MutableRevisionRecord( $title );
		$revision->setId( 1 );
		$revision->setTimestamp( wfTimestampNow() );
		$revision->setContent( 'main', new WikitextContent( 'Fixture' ) );
		$revision->setContent( PageRevisionWriter::SLOT, $content );
		$parser = MediaWikiServices::getInstance()->getParserFactory()->create();
		$options = ParserOptions::newFromAnon();
		$options->setCurrentRevisionRecordCallback( static fn () => $revision );
		$name = $constraint['name'];
		if ( $source['kind'] !== 'slide' ) {
			$parser->setHook( 'layers-migration-probe', static function ( $input, $args, Parser $active ) use (
				$source, $constraint, &$name
			) {
				$name = $constraint['latest'] ? BoundSlideHooks::onlyDrawingOf( $active, $source['fileKey'] ) :
					BoundSlideHooks::drawingOfFileNamed( $active, $source['fileKey'], $name );
				return '';
			} );
			$parser->parse( '<layers-migration-probe/>', $title, $options, true, true, 1 );
		}
		if ( $name === null ) {
			return false;
		}
		$decoded = json_decode( $content->getText(), true, 64, JSON_THROW_ON_ERROR )['surfaces'];
		foreach ( $source['members'] as $member ) {
			$id = PageOwnedBinding::resolveNamed( [ 'pageId' => $pageId, 'name' => $name ], $decoded,
				$source['kind'] === 'slide' ? 'slide' : 'file', $source['fileKey'] ?? null,
				$member['surface']->source->page ?? null );
			if ( $id !== FilePageMigration::surfaceId( $member['legacyId'], $pageId ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param array $source
	 * @param array $names Names keyed by retained member ID
	 * @param array $rewrites
	 * @param array $surfaces
	 * @param int $pageId
	 * @return bool
	 */
	private function directMatches( array $source, array $names, array $rewrites, array $surfaces,
		int $pageId
	): bool {
		$decoded = json_decode( JsonSnapshotCodec::encode( $surfaces ), true, 64, JSON_THROW_ON_ERROR );
		$members = array_column( $source['members'], 'surface', 'legacyId' );
		foreach ( $rewrites as [ , $key, $rowId ] ) {
			if ( $key !== $source['key'] ) {
				continue;
			}
			$id = PageOwnedBinding::resolveNamed( [ 'pageId' => $pageId, 'name' => $names[$rowId] ],
				$decoded, $source['kind'] === 'slide' ? 'slide' : 'file', $source['fileKey'] ?? null,
				$members[$rowId]->source->page ?? null );
			if ( $id !== FilePageMigration::surfaceId( $rowId, $pageId ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param array $snapshot
	 * @param Authority $authority
	 * @param int|null $expectedLatest The returned destination revision, only for a source that is that owner
	 */
	private function verifySnapshot( array $snapshot, Authority $authority, ?int $expectedLatest = null ): void {
		$title = $snapshot['title'];
		// Preparation callbacks can change rows already memoized by Title/RevisionLookup.
		// Recheck primary identity, latest revision and visibility without those object caches.
		$stored = $this->db->getPrimaryDatabase()->newSelectQueryBuilder()
			->select( [ 'page_id', 'page_namespace', 'page_title', 'page_latest', 'rev_page', 'rev_deleted' ] )
			->from( 'page' )->join( 'revision', null, 'rev_page = page_id' )
			->where( [ 'page_id' => $snapshot['pageId'], 'rev_id' => $snapshot['baseRevisionId'] ] )
			->caller( __METHOD__ )->fetchRow();
		if ( !$stored || (int)$stored->page_id !== $snapshot['pageId'] ||
			(int)$stored->page_namespace !== $title->getNamespace() || $stored->page_title !== $title->getDBkey() ||
			(int)$stored->page_latest !== ( $expectedLatest ?? $snapshot['baseRevisionId'] ) ||
			(int)$stored->rev_page !== $snapshot['pageId'] ) {
			throw new PublicationException( 'layers-edit-conflict' );
		}
		$revision = $this->revisions->getRevisionById( $snapshot['baseRevisionId'], IDBAccessObject::READ_LATEST );
		if ( !$revision || $revision->getPageId() !== $snapshot['pageId'] ) {
			throw new PublicationException( 'layers-edit-conflict' );
		}
		if ( !$authority->authorizeRead( 'read', $title ) ||
			!RevisionRecord::userCanBitfield( (int)$stored->rev_deleted, RevisionRecord::DELETED_TEXT,
				$authority, $revision->getPage() ) ) {
			throw new PublicationException( 'layers-revision-unavailable' );
		}
		try {
			$this->document( $title, $revision, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( 'layers-revision-unavailable', 0, $e );
		}
	}

	/**
	 * @param string $text
	 * @param array $candidates
	 * @param Title $title
	 * @param int $revisionId
	 * @param array $shown
	 * @return array
	 */
	private function indirectSets( string $text, array $candidates, Title $title, int $revisionId,
		array $shown
	): array {
		if ( !$shown ) {
			return [];
		}
		usort( $candidates, static fn ( $left, $right ) => $right['start'] <=> $left['start'] );
		foreach ( $candidates as $candidate ) {
			$text = substr_replace( $text, str_repeat( ' ', strlen( $candidate['raw'] ) ),
				$candidate['start'], strlen( $candidate['raw'] ) );
		}
		$output = MediaWikiServices::getInstance()->getParserFactory()->create()->parse( $text, $title,
			ParserOptions::newFromAnon(), true, true, $revisionId );
		$indirect = [];
		foreach ( ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) as $entry ) {
			$indirect[self::shownKey( $entry[0], $entry[1], $entry[2] === '' ? null : $entry[2] )] = true;
		}
		return $indirect;
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
		if ( !array_key_exists( $fileName, $this->pendingDocuments ) ) {
			$this->pendingDocuments[$fileName] = $this->pendingFile ? ( $this->pendingFile )( $fileName ) : null;
		}
		return $this->pendingDocuments[$fileName];
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
