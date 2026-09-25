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
		try {
			$identity = PageOwnedBinding::parse( $binding );
			if ( $revisionId < 1 || $revisionId > 2147483647 || $owner->hasFragment() || $owner->isExternal() ||
				$owner->getArticleID( IDBAccessObject::READ_LATEST ) !== $identity['pageId'] ) {
				throw new \DomainException();
			}
			$bundle = $this->read( $owner, $revisionId, $authority, $identity['pageId'] );
			foreach ( $bundle['snapshot']['surfaces'] as $surface ) {
				if ( $surface['id'] === $identity['surfaceId'] ) {
					return [ 'pageId' => $identity['pageId'], 'revisionId' => $revisionId, 'surface' => $surface ];
				}
			}
		} catch ( \InvalidArgumentException | \DomainException $e ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		throw new \DomainException( 'layers-revision-unavailable' );
	}

	/**
	 * Read one complete authorized snapshot and its exact source geometry.
	 * No latest fallback. Adds no asset URLs, backend paths or File objects.
	 * A missing/denied source rejects the whole bundle; partial rendering is not implemented.
	 *
	 * @param Title $owner Requested owner
	 * @param int $revisionId Explicit positive revision ID; never "latest"
	 * @param Authority $authority Original reader authority
	 * @param int|null $expectedPageId Required identity when resolving a page binding
	 * @return array Internal bundle; source dimensions are handler pixels, not canvas units
	 * @throws \DomainException Generic unavailable result for denied/missing revision or source
	 */
	public function read( Title $owner, int $revisionId, Authority $authority, ?int $expectedPageId = null ): array {
		try {
			$content = $this->access->read( $owner, $revisionId, $authority, $expectedPageId );
			$files = $this->sources->resolve( $content, $authority );
		} catch ( \DomainException $e ) {
			throw new \DomainException( 'layers-revision-unavailable', 0, $e );
		}
		$snapshot = json_decode( $content->getCanonicalText(), true, 64, JSON_THROW_ON_ERROR );
		$geometry = [];
		foreach ( $snapshot['surfaces'] as $surface ) {
			if ( $surface['kind'] === 'slide' ) {
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
