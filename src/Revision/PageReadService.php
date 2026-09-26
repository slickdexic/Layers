<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/** Internal exact-revision read bundle. No endpoint, asset delivery or cache registration. */
class PageReadService {
	private PageHistoryAccess $access;
	private SourceVersionResolver $sources;

	public function __construct( PageHistoryAccess $access, SourceVersionResolver $sources ) {
		$this->access = $access;
		$this->sources = $sources;
	}

	/**
	 * Resolve a binding against the displayed owner's exact revision, never its latest drawing.
	 * The owner and revision must come from the native displayed-page context, not template text.
	 * Returned data is authority-specific and must not enter a shared parser/output cache.
	 * No route is registered here; kind-specific rendering remains the caller's responsibility.
	 * @param Title $owner Native displayed owner
	 * @param int $revisionId Exact displayed revision
	 * @param string $binding Canonical binding from the selected embedding
	 * @param Authority $authority Reader, not the parser's anonymous cache identity
	 * @return array Exact selected surface and identity
	 */
	public function readBoundSurface( Title $owner, int $revisionId, string $binding, Authority $authority ): array {
		$bundles = $this->readBoundSurfaces( $owner, $revisionId, [ $binding ], $authority );
		if ( !isset( $bundles[$binding] ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		return $bundles[$binding];
	}

	/**
	 * Resolve several bindings of one displayed revision with a single snapshot read.
	 * Same rules as readBoundSurface(); unavailable, foreign or malformed bindings are omitted.
	 * @param Title $owner Native displayed owner
	 * @param int $revisionId Exact displayed revision
	 * @param string[] $bindings Canonical bindings from the displayed revision's embeddings
	 * @param Authority $authority Reader
	 * @return array[] Exact selected surfaces keyed by binding
	 */
	public function readBoundSurfaces( Title $owner, int $revisionId, array $bindings, Authority $authority ): array {
		$ownerId = $owner->getArticleID( IDBAccessObject::READ_LATEST );
		if ( $revisionId < 1 || $revisionId > 2147483647 || $owner->hasFragment() || $owner->isExternal() ||
			$ownerId < 1 ) {
			return [];
		}
		$wanted = [];
		foreach ( $bindings as $binding ) {
			try {
				$identity = PageOwnedBinding::parse( $binding );
			} catch ( \InvalidArgumentException $e ) {
				continue;
			}
			if ( $identity['pageId'] === $ownerId ) {
				$wanted[$binding] = $identity['surfaceId'];
			}
		}
		if ( !$wanted ) {
			return [];
		}
		try {
			$content = $this->access->read( $owner, $revisionId, $authority, $ownerId );
		} catch ( \DomainException $e ) {
			return [];
		}
		$bundles = [];
		foreach ( json_decode( $content->getText(), true, 64, JSON_THROW_ON_ERROR )['surfaces'] as $surface ) {
			if ( !in_array( $surface['id'], $wanted, true ) ) {
				continue;
			}
			try {
				// Each surface's source is checked on its own, so one unavailable file hides only its drawing.
				$this->sources->resolve( $content, $authority, [ $surface['id'] ] );
			} catch ( \DomainException $e ) {
				continue;
			}
			foreach ( array_keys( $wanted, $surface['id'], true ) as $binding ) {
				$bundles[$binding] = [ 'pageId' => $ownerId, 'revisionId' => $revisionId, 'surface' => $surface ];
			}
		}
		return $bundles;
	}

	/**
	 * Read one complete authorized snapshot and the exact source geometry of the requested surfaces.
	 * No latest fallback. Adds no asset URLs, backend paths or File objects.
	 * A missing/denied source among the requested surfaces rejects the bundle; other surfaces' sources
	 * are not consulted, so one unavailable file cannot hide unrelated drawings.
	 *
	 * @param Title $owner Requested owner
	 * @param int $revisionId Explicit positive revision ID; never "latest"
	 * @param Authority $authority Original reader authority
	 * @param int|null $expectedPageId Required identity when resolving a page binding
	 * @param string[]|null $surfaceIds Surfaces whose sources to resolve; null means all
	 * @return array Internal bundle; source dimensions are handler pixels, not canvas units
	 * @throws \DomainException Generic unavailable result for denied/missing revision or source
	 */
	public function read( Title $owner, int $revisionId, Authority $authority, ?int $expectedPageId = null,
		?array $surfaceIds = null
	): array {
		try {
			$content = $this->access->read( $owner, $revisionId, $authority, $expectedPageId );
			$files = $this->sources->resolve( $content, $authority, $surfaceIds );
		} catch ( \DomainException $e ) {
			throw new \DomainException( 'layers-revision-unavailable', 0, $e );
		}
		$snapshot = json_decode( $content->getText(), true, 64, JSON_THROW_ON_ERROR );
		$geometry = [];
		foreach ( $snapshot['surfaces'] as $surface ) {
			if ( !isset( $files[$surface['id']] ) ) {
				continue;
			}
			$file = $files[$surface['id']];
			$page = $surface['source']['page'];
			$width = $file->getWidth( $page );
			$height = $file->getHeight( $page );
			if ( !is_int( $width ) || !is_int( $height ) || $width <= 0 || $height <= 0 ) {
				throw new \DomainException( 'layers-revision-unavailable' );
			}
			$geometry[$surface['id']] = [
				'page' => $page,
				'width' => $width,
				'height' => $height,
				'units' => 'file-handler-pixels'
			];
		}
		return [ 'revisionId' => $revisionId, 'snapshot' => $snapshot, 'sourceGeometry' => $geometry ];
	}
}
