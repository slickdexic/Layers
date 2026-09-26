<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Api\ApiMain;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotLifecycleHooks;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\MediaWikiServices;
use MediaWiki\Page\MergeHistoryFactory;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use OldRevisionImporter;
use Wikimedia\Rdbms\IDBAccessObject;

/** Shared native pilot composition. Does not register endpoints or hooks by itself. */
class PageOwnedPilot {
	private MediaWikiServices $services;
	private bool $enabled;
	private array $ownerKeys;
	private PagePublicationService $publisher;
	private PageReadService $reader;

	/**
	 * @param MediaWikiServices $services Fully initialized native service container
	 * @param bool $enabled Default-off API switch; guards are independent of this switch
	 * @param string[] $ownerKeys Exact prefixed DB keys, retained while stored pilot revisions exist
	 */
	public function __construct( MediaWikiServices $services, bool $enabled = false, array $ownerKeys = [] ) {
		foreach ( $ownerKeys as $key ) {
			if ( !is_string( $key ) || $key === '' ) {
				throw new \InvalidArgumentException( 'Invalid Layers pilot owner scope' );
			}
			$title = $services->getTitleFactory()->newFromText( $key );
			if ( !$title || !$title->canExist() || $title->hasFragment() || $title->getPrefixedDBkey() !== $key ) {
				throw new \InvalidArgumentException( 'Invalid Layers pilot owner scope' );
			}
		}
		$this->services = $services;
		$this->enabled = $enabled;
		$this->ownerKeys = array_values( array_unique( $ownerKeys ) );
		$access = new PageHistoryAccess( $services->getRevisionLookup() );
		$sources = new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(), $services->getTitleFactory() );
		$this->publisher = new PagePublicationService( $services->getWikiPageFactory(), $access, $sources,
			new PageRevisionWriter(), new PublicationAdmissionContext(), $services->getHookContainer(),
			$services->getUserFactory() );
		$this->reader = new PageReadService( $access, $sources );
	}

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @return ApiLayersPublish
	 */
	public function newPublishApi( ApiMain $main, string $name ): ApiLayersPublish {
		return new ApiLayersPublish( $main, $name, $this->publisher, $this->services->getTitleFactory(),
			$this->enabled, $this->ownerKeys );
	}

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @return ApiLayersRead
	 */
	public function newReadApi( ApiMain $main, string $name ): ApiLayersRead {
		return new ApiLayersRead( $main, $name, $this->reader, $this->services->getTitleFactory(),
			$this->enabled, $this->ownerKeys, [ $this, 'prepareBoundViewers' ] );
	}

	/**
	 * Prepare the existing-surface editor bootstrap; does not register or render a route.
	 * Callers must serve this user-specific configuration without public caching.
	 * Historical viewing uses a separate read-only entry point, never this editor.
	 *
	 * @param string $ownerText Owner requested by the route
	 * @param int $revisionId Explicit current revision; no latest fallback
	 * @param string $surfaceId Literal selected surface ID
	 * @param Authority $authority Request authority, never a privileged substitute
	 * @return array Editor initialization without snapshot data or source URLs
	 * @throws \DomainException Fixed unavailable result
	 */
	public function prepareEditor( string $ownerText, int $revisionId, string $surfaceId,
		Authority $authority
	): array {
		$owner = $this->services->getTitleFactory()->newFromText( $ownerText );
		if ( !$this->enabled || !$owner || !$owner->canExist() || $owner->hasFragment() ||
			!in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ||
			$revisionId < 1 || $revisionId > 2147483647 || $surfaceId === '' ||
			$authority->getUser()->getId() <= 0
		) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		try {
			$lookup = $this->services->getRevisionLookup();
			( new PageHistoryAccess( $lookup ) )->assertCanPrepareEdit( $owner, $authority );
			$bundle = $this->reader->read( $owner, $revisionId, $authority, null, [ $surfaceId ] );
			$current = $lookup->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
			if ( !$current || $current->getId() !== $revisionId || $current->getPageId() < 1 ||
				$current->getPageId() !== $owner->getArticleID()
			) {
				throw new \DomainException();
			}
		} catch ( \DomainException $e ) {
			throw new \DomainException( 'layers-editor-unavailable', 0, $e );
		}
		foreach ( $bundle['snapshot']['surfaces'] as $surface ) {
			if ( $surface['id'] !== $surfaceId ) {
				continue;
			}
			// Asset-backed surfaces need pinned source delivery before editor exposure.
			if ( $surface['kind'] !== 'slide' ) {
				break;
			}
			$config = $this->services->getMainConfig();
			return [
				'filename' => $owner->getPrefixedText(), 'imageUrl' => null, 'isSlide' => true,
				'autoCreate' => false, 'canvasWidth' => $surface['canvas']['width'],
				'canvasHeight' => $surface['canvas']['height'],
				'backgroundColor' => $surface['canvas']['backgroundColor'] ?? null,
				'pageOwned' => [
					'owner' => $owner->getPrefixedDBkey(), 'revisionId' => $revisionId,
					'pageId' => $current->getPageId(),
					'surfaceId' => $surfaceId, 'readOnly' => false,
					'draftScope' => [
						'wiki' => json_encode(
							[ $config->get( 'DBname' ), $config->get( 'DBprefix' ) ], JSON_THROW_ON_ERROR ),
						'user' => (string)$authority->getUser()->getId()
					]
				]
			];
		}
		throw new \DomainException( 'layers-editor-unavailable' );
	}

	/**
	 * Publish a deliberately confirmed direct adoption from selection identity only.
	 * Internal composition: HTTP callers must enforce POST, CSRF, rate limits and confirmation.
	 * Never accepts a client-prepared snapshot, surface ID or rewritten main content.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param int $start UTF-8 byte offset of the selected direct embedding
	 * @param string $expected Complete original source bytes
	 * @param int $legacyRevisionId Explicit immutable legacy row ID, never latest
	 * @param string|null $fileTimestamp Exact upload version; null for slides
	 * @param Authority $authority Original actor
	 * @param string $summary
	 * @return array Confirmed native page/revision/surface identity
	 * @throws PublicationException No automatic retry, including uncertain publication failures
	 */
	public function adoptDirectEmbedding( int $pageId, int $baseRevisionId, int $start, string $expected,
		int $legacyRevisionId, ?string $fileTimestamp, Authority $authority, string $summary
	): array {
		$identities = $this->assertAdoptionScope( $pageId, $baseRevisionId, $start, $expected,
			$legacyRevisionId, $authority );
		$proposal = $this->newAdoptionPreparer( $identities )->prepare( $pageId, $baseRevisionId, $start, $expected,
			$legacyRevisionId, $fileTimestamp, $authority );
		$revisionId = ( new PageOwnedAdoptionService( $identities, $this->services->getRevisionLookup(),
			$this->publisher ) )->publishPreparedSurface( $pageId, $baseRevisionId, $authority,
				$proposal['document'], $proposal['main'], $summary );
		return [ 'pageId' => $pageId, 'revisionId' => $revisionId,
			'surfaceId' => $proposal['surfaceId'], 'binding' => $proposal['binding'] ];
	}

	/**
	 * Run every adoption check without writing, for the confirmation step.
	 * The result describes what the reader is asked to confirm; it is not an authorization token.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $legacyRevisionId
	 * @param Authority $authority
	 * @return array owner Title, label, setName, revision, timestamp and userId of the copied drawing
	 * @throws PublicationException Same fixed failures adoption would report
	 */
	public function previewDirectAdoption( int $pageId, int $baseRevisionId, int $start, string $expected,
		int $legacyRevisionId, Authority $authority
	): array {
		$identities = $this->assertAdoptionScope( $pageId, $baseRevisionId, $start, $expected,
			$legacyRevisionId, $authority );
		$proposal = $this->newAdoptionPreparer( $identities )->prepare( $pageId, $baseRevisionId, $start, $expected,
			$legacyRevisionId, null, $authority );
		$record = $this->services->getService( 'LayersDatabase' )->getLayerSetForAdoption( $legacyRevisionId );
		if ( !$record ) {
			throw new PublicationException( 'layers-legacy-revision-unavailable' );
		}
		try {
			$owner = $identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() );
		}
		return [
			'owner' => $owner,
			'label' => substr( $proposal['legacySelection']['imgName'], strlen( LayersConstants::SLIDE_PREFIX ) ),
			'setName' => $proposal['legacySelection']['name'], 'revision' => (int)$record['revision'],
			'timestamp' => (string)$record['timestamp'], 'userId' => (int)( $record['userId'] ?? 0 )
		];
	}

	/**
	 * Shared slides on the current revision that an editor can make owned by the page.
	 * Each entry names the exact legacy row the slide shows now; confirmation revalidates everything.
	 * @param int $pageId
	 * @param int $revisionId Displayed revision; must still be current
	 * @param Authority $authority
	 * @return array[] label, setName and confirmation route parameters
	 */
	public function listAdoptionCandidates( int $pageId, int $revisionId, Authority $authority ): array {
		try {
			if ( !$this->enabled || $authority->getUser()->getId() <= 0 ) {
				return [];
			}
			$lookup = $this->services->getRevisionLookup();
			$owner = $this->newIdentityResolver()->resolveForEdit( $pageId, $revisionId, $authority );
			if ( !in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ) {
				return [];
			}
			$revision = $lookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
			$main = $revision ? $revision->getContent( SlotRecord::MAIN,
				RevisionRecord::FOR_THIS_USER, $authority ) : null;
			if ( !$main instanceof WikitextContent ) {
				return [];
			}
			$db = $this->services->getService( 'LayersDatabase' );
			$entries = [];
			foreach ( $this->newRewriter()->scan( $main->getText(), static fn () => null ) as $candidate ) {
				try {
					if ( $candidate['kind'] !== 'slide' ||
						PageOwnedBindingOptions::extract( $candidate['options'] ) !== null ) {
						continue;
					}
					$imgName = LayersConstants::SLIDE_PREFIX . $candidate['target'];
					$setName = self::explicitSetName( $candidate['options'] );
					$row = $setName === null ?
						$db->getLatestLayerSet( $imgName, LayersConstants::TYPE_SLIDE ) :
						$db->getLayerSetByName( $imgName, LayersConstants::TYPE_SLIDE, $setName );
					if ( !$row ) {
						continue;
					}
					// getLayerSetByName() returns setName; getLatestLayerSet() returns name.
					$rowName = (string)( $row['setName'] ?? $row['name'] ?? '' );
					DirectEmbeddingSelection::assertMatches( $candidate,
						[ 'imgName' => $imgName, 'name' => $rowName, 'page' => 1 ],
						$setName === null ? $rowName : null );
					$entries[] = [ 'label' => $candidate['target'], 'setName' => $rowName, 'params' => [
						'pageid' => $pageId, 'revid' => $revisionId, 'start' => $candidate['start'],
						'expected' => $candidate['raw'], 'legacyrev' => (int)$row['id']
					] ];
				} catch ( \InvalidArgumentException $e ) {
					// Embeds the conservative source rules cannot adopt are simply not offered.
				}
			}
			return $entries;
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			return [];
		}
	}

	/**
	 * @param string[] $options
	 * @return string|null Literal selector value, or null when the slide shows its latest set
	 */
	private static function explicitSetName( array $options ): ?string {
		foreach ( $options as $option ) {
			$parts = explode( '=', $option, 2 );
			$key = strtolower( trim( $parts[0], " \t\r\n\f" ) );
			if ( in_array( $key, [ 'layerset', 'layers', 'layer' ], true ) && isset( $parts[1] ) ) {
				return trim( $parts[1], " \t\r\n\f" );
			}
		}
		return null;
	}

	/**
	 * Common adoption preflight: pilot switch, actor, bounds, native owner/base and scope.
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $legacyRevisionId
	 * @param Authority $authority
	 * @return PageOwnedIdentityResolver
	 */
	private function assertAdoptionScope( int $pageId, int $baseRevisionId, int $start, string $expected,
		int $legacyRevisionId, Authority $authority
	): PageOwnedIdentityResolver {
		if ( !$this->enabled || $authority->getUser()->getId() <= 0 ) {
			throw new PublicationException( 'layers-publication-disabled' );
		}
		if ( $start < 0 || $expected === '' || $legacyRevisionId < 1 || $legacyRevisionId > 2147483647 ) {
			throw new PublicationException( 'layers-invalid-publication-request' );
		}
		$identities = $this->newIdentityResolver();
		try {
			$owner = $identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() );
		}
		if ( !in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ) {
			throw new PublicationException( 'layers-publication-disabled' );
		}
		return $identities;
	}

	/** @return PageOwnedIdentityResolver */
	private function newIdentityResolver(): PageOwnedIdentityResolver {
		$lookup = $this->services->getRevisionLookup();
		return new PageOwnedIdentityResolver( $this->services->getTitleFactory(), $lookup,
			new PageHistoryAccess( $lookup ) );
	}

	/**
	 * @param PageOwnedIdentityResolver $identities
	 * @return DirectAdoptionPreparationService
	 */
	private function newAdoptionPreparer( PageOwnedIdentityResolver $identities ): DirectAdoptionPreparationService {
		$db = $this->services->getService( 'LayersDatabase' );
		$sources = new SourceVersionResolver( $this->services->getRepoGroup()->getLocalRepo(),
			$this->services->getTitleFactory() );
		$legacy = new LegacyAdoptionPreparationService( $identities, $db, new LegacyMediaResolver( $sources ),
			new LegacySurfaceConverter() );
		return new DirectAdoptionPreparationService( $identities, $this->services->getRevisionLookup(),
			$this->services->getTitleFactory(), $legacy, $this->newRewriter(),
			static fn ( string $slide ): ?string => $db->getLatestLayerSet(
				LayersConstants::SLIDE_PREFIX . $slide, LayersConstants::TYPE_SLIDE )['name'] ?? null );
	}

	/**
	 * List independently editable saved direct bindings for a page-level control.
	 * Never maps rendered occurrences to source offsets or exposes template-generated candidates.
	 * @param int $pageId
	 * @param int $revisionId Explicit displayed revision; must still be current
	 * @param Authority $authority
	 * @return array Validated route parameters and escaped-at-output labels
	 */
	public function listBoundEditorSelections( int $pageId, int $revisionId, Authority $authority ): array {
		try {
			if ( !$this->enabled || $authority->getUser()->getId() <= 0 ) {
				return [];
			}
			$lookup = $this->services->getRevisionLookup();
			$owner = ( new PageOwnedIdentityResolver( $this->services->getTitleFactory(), $lookup,
				new PageHistoryAccess( $lookup ) ) )->resolveForEdit( $pageId, $revisionId, $authority );
			if ( !in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ) {
				return [];
			}
			$revision = $lookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
			$main = $revision ? $revision->getContent( SlotRecord::MAIN,
				RevisionRecord::FOR_THIS_USER, $authority ) : null;
			if ( !$main instanceof WikitextContent ) {
				return [];
			}
			// One exact read for every entry; the editor route repeats full admission when opened.
			$slides = [];
			foreach ( $this->reader->read( $owner, $revisionId, $authority, $pageId, [] )['snapshot']['surfaces']
				as $surface
			) {
				if ( $surface['kind'] === 'slide' ) {
					$slides[$surface['id']] = true;
				}
			}
			$candidates = $this->newRewriter()->scan( $main->getText(), static fn () => null );
			$selections = [];
			foreach ( $candidates as $candidate ) {
				try {
					$binding = PageOwnedBindingOptions::extract( $candidate['options'] );
					if ( !$binding || $candidate['kind'] !== 'slide' || $binding['pageId'] !== $pageId ||
						!isset( $slides[$binding['surfaceId']] ) || isset( $selections[$binding['surfaceId']] ) ) {
						continue;
					}
					$selections[$binding['surfaceId']] = [ 'label' => $candidate['target'], 'params' => [
						'pageid' => $pageId, 'revid' => $revisionId, 'start' => $candidate['start'],
						'expected' => $candidate['raw']
					] ];
				} catch ( \InvalidArgumentException $e ) {
					// A malformed binding must not redirect another drawing's entry.
				}
			}
			return array_values( $selections );
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			return [];
		}
	}

	/**
	 * Internal ordinary-entry admission from an exact saved direct embedding.
	 * Source bytes are checked against native main content; caller IDs are not binding proof.
	 * No public route is installed here. Existing pilot scope and slide-only gates remain.
	 *
	 * @param int $pageId Native owner identity
	 * @param int $revisionId Explicit current base
	 * @param int $start UTF-8 byte offset of selected direct embedding
	 * @param string $expected Complete selected embedding bytes
	 * @param Authority $authority Original request actor
	 * @return array Authorized editor bootstrap
	 */
	public function prepareBoundEditor( int $pageId, int $revisionId, int $start, string $expected,
		Authority $authority
	): array {
		try {
			if ( !$this->enabled || $start < 0 || $expected === '' || $authority->getUser()->getId() <= 0 ) {
				throw new \DomainException();
			}
			$lookup = $this->services->getRevisionLookup();
			$owner = ( new PageOwnedIdentityResolver( $this->services->getTitleFactory(), $lookup,
				new PageHistoryAccess( $lookup ) ) )->resolveForEdit( $pageId, $revisionId, $authority );
			if ( !in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ) {
				throw new \DomainException();
			}
			$revision = $lookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
			$main = $revision ? $revision->getContent( SlotRecord::MAIN,
				RevisionRecord::FOR_THIS_USER, $authority ) : null;
			if ( !$main instanceof WikitextContent ) {
				throw new \DomainException();
			}
			// File-backed editing remains closed until pinned source delivery is integrated.
			$candidates = $this->newRewriter()->scan( $main->getText(), static fn () => null );
			foreach ( $candidates as $candidate ) {
				if ( $candidate['kind'] !== 'slide' || $candidate['start'] !== $start ||
					$candidate['raw'] !== $expected ) {
					continue;
				}
				$binding = PageOwnedBindingOptions::extract( $candidate['options'] );
				if ( !$binding || $binding['pageId'] !== $pageId ) {
					throw new \DomainException();
				}
				$init = $this->prepareEditor( $owner->getPrefixedText(), $revisionId,
					$binding['surfaceId'], $authority );
				if ( $init['pageOwned']['pageId'] !== $pageId ) {
					throw new \DomainException();
				}
				return $init;
			}
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			// Fixed denial without reflecting source bytes or privileged diagnostics.
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		throw new \DomainException( 'layers-editor-unavailable' );
	}

	/**
	 * Explicit current-editor entry. Resolve once, then use the exact editor admission path.
	 * Does not reinterpret stale numeric revision links or affect historical reads.
	 *
	 * @param string $ownerText
	 * @param string $surfaceId
	 * @param Authority $authority
	 * @return array
	 */
	public function prepareCurrentEditor( string $ownerText, string $surfaceId, Authority $authority ): array {
		$owner = $this->services->getTitleFactory()->newFromText( $ownerText );
		if ( !$this->enabled || !$owner || !$owner->canExist() || $owner->hasFragment() ||
			!in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ||
			$surfaceId === '' || $authority->getUser()->getId() <= 0
		) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		try {
			$lookup = $this->services->getRevisionLookup();
			( new PageHistoryAccess( $lookup ) )->assertCanPrepareEdit( $owner, $authority );
			$current = $lookup->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
			if ( !$current ) {
				throw new \DomainException();
			}
			return $this->prepareEditor( $ownerText, $current->getId(), $surfaceId, $authority );
		} catch ( \DomainException $e ) {
			throw new \DomainException( 'layers-editor-unavailable', 0, $e );
		}
	}

	/**
	 * Return an authorized exact surface for the separate historical viewer.
	 * No editor configuration, local drafts, edit permission requirement or latest fallback.
	 * The caller must use non-cacheable output and a renderer with no mutation controls.
	 *
	 * @param string $ownerText
	 * @param int $revisionId
	 * @param string $surfaceId
	 * @param Authority $authority
	 * @return array Read-only viewer data
	 * @throws \DomainException Fixed unavailable result
	 */
	public function prepareViewer( string $ownerText, int $revisionId, string $surfaceId,
		Authority $authority
	): array {
		$owner = $this->services->getTitleFactory()->newFromText( $ownerText );
		if ( !$this->enabled || !$owner || !$owner->canExist() || $owner->hasFragment() ||
			!in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ||
			$revisionId < 1 || $revisionId > 2147483647 || $surfaceId === ''
		) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$bundle = $this->reader->read( $owner, $revisionId, $authority, null, [ $surfaceId ] );
		foreach ( $bundle['snapshot']['surfaces'] as $surface ) {
			if ( $surface['id'] === $surfaceId ) {
				// Pinned image/PDF delivery must precede asset-backed viewer exposure.
				if ( $surface['kind'] !== 'slide' ) {
					break;
				}
				return [ 'owner' => $owner->getPrefixedDBkey(), 'revisionId' => $revisionId,
					'surface' => $surface ];
			}
		}
		throw new \DomainException( 'layers-revision-unavailable' );
	}

	/**
	 * List surface identity only after an exact authorized read, for history navigation.
	 * @param \MediaWiki\Title\Title $owner
	 * @param int $revisionId
	 * @param Authority $authority
	 * @return array[]
	 */
	public function getHistorySurfaces( \MediaWiki\Title\Title $owner, int $revisionId, Authority $authority ): array {
		if ( !$this->enabled || !in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ||
			$owner->hasFragment() || $revisionId < 1 || $revisionId > 2147483647 ) {
			return [];
		}
		// Listing only; the viewer resolves the selected surface's source when a link is opened.
		$bundle = $this->reader->read( $owner, $revisionId, $authority, null, [] );
		$surfaces = [];
		foreach ( $bundle['snapshot']['surfaces'] as $surface ) {
			if ( $surface['kind'] === 'slide' ) {
				$surfaces[] = [ 'id' => $surface['id'], 'label' => $surface['label'] ?? $surface['id'] ];
			}
		}
		return $surfaces;
	}

	/**
	 * @param \MediaWiki\Title\Title $owner Native displayed owner
	 * @param int $revisionId Exact displayed revision
	 * @param string $binding Canonical PageID binding
	 * @param Authority $authority Actual reader
	 * @return array Authorized slide bundle for uncached response output
	 */
	public function prepareBoundViewer( \MediaWiki\Title\Title $owner, int $revisionId,
		string $binding, Authority $authority
	): array {
		$bundles = $this->prepareBoundViewers( $owner, $revisionId, [ $binding ], $authority );
		if ( !isset( $bundles[$binding] ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		return $bundles[$binding];
	}

	/**
	 * Authorize every binding of one displayed revision with a single snapshot read.
	 * @param \MediaWiki\Title\Title $owner Native displayed owner
	 * @param int $revisionId Exact displayed revision
	 * @param string[] $bindings Canonical PageID bindings
	 * @param Authority $authority Actual reader
	 * @return array[] Authorized slide bundles keyed by binding, for uncached response output only
	 */
	public function prepareBoundViewers( \MediaWiki\Title\Title $owner, int $revisionId,
		array $bindings, Authority $authority
	): array {
		if ( !$this->enabled || !in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ) {
			return [];
		}
		$result = [];
		$bundles = $this->reader->readBoundSurfaces( $owner, $revisionId, $bindings, $authority );
		foreach ( $bundles as $binding => $bundle ) {
			if ( $bundle['surface']['kind'] === 'slide' ) {
				$result[$binding] = $bundle + [ 'owner' => $owner->getPrefixedDBkey() ];
			}
		}
		return $result;
	}

	/**
	 * Scanner honouring this wiki's registered extension tags, whose bodies are opaque to wikitext links.
	 * @return DirectEmbeddingRewriter
	 */
	private function newRewriter(): DirectEmbeddingRewriter {
		return new DirectEmbeddingRewriter( $this->services->getParserFactory()->getMainInstance()->getTags() );
	}

	/** @return PageOwnedAdmissionHooks */
	public function newAdmissionHooks(): PageOwnedAdmissionHooks {
		return new PageOwnedAdmissionHooks( $this->publisher->getAdmissionContext(),
			$this->services->getRevisionLookup() );
	}

	/** @return PageOwnedPilotLifecycleHooks */
	public function newLifecycleHooks(): PageOwnedPilotLifecycleHooks {
		return new PageOwnedPilotLifecycleHooks( $this->services->getTitleFactory(), $this->ownerKeys );
	}

	/**
	 * @param OldRevisionImporter $native
	 * @return PageOwnedPilotImporter
	 */
	public function wrapImporter( OldRevisionImporter $native ): PageOwnedPilotImporter {
		return new PageOwnedPilotImporter( $native, $this->ownerKeys );
	}

	/**
	 * @param MergeHistoryFactory $native
	 * @return PageOwnedPilotMergeFactory
	 */
	public function wrapMergeFactory( MergeHistoryFactory $native ): PageOwnedPilotMergeFactory {
		return new PageOwnedPilotMergeFactory( $native, $this->services->getTitleFactory(), $this->ownerKeys );
	}
}
