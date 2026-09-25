<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotLifecycleHooks;
use MediaWiki\MediaWikiServices;
use MediaWiki\Page\MergeHistoryFactory;
use MediaWiki\Permissions\Authority;
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
			new PageRevisionWriter(), new PublicationAdmissionContext() );
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
			$this->enabled, $this->ownerKeys );
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
			$bundle = $this->reader->read( $owner, $revisionId, $authority );
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
		$bundle = $this->reader->read( $owner, $revisionId, $authority );
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
		$bundle = $this->reader->read( $owner, $revisionId, $authority );
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
		if ( !$this->enabled || !in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$bundle = $this->reader->readBoundSurface( $owner, $revisionId, $binding, $authority );
		if ( $bundle['surface']['kind'] !== 'slide' ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		return $bundle + [ 'owner' => $owner->getPrefixedDBkey() ];
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
