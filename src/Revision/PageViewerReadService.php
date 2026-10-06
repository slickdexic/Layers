<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;

/** Authorized, exact-revision input for the existing full-size viewer. Never writes a snapshot. */
class PageViewerReadService {

	private PageHistoryAccess $access;
	private SourceVersionResolver $sources;
	private SourceRenditions $renditions;
	private string $pdfPath;

	public function __construct( PageHistoryAccess $access, SourceVersionResolver $sources,
		SourceRenditions $renditions, string $pdfPath
	) {
		$this->access = $access;
		$this->sources = $sources;
		$this->renditions = $renditions;
		$this->pdfPath = $pdfPath;
	}

	/**
	 * Select the anchor's file/name group in one authorized owner revision.
	 * PDF pages absent from pages[] have no layers; never synthesize stored surfaces or names.
	 * The PDF URL reauthorizes and captures the anchor's exact bytes when fetched.
	 * Returned reader-specific data must always be served privately with zero age.
	 * @param Title $owner
	 * @param int $revisionId Explicit displayed revision
	 * @param string $binding Canonical owner/anchor identity
	 * @param Authority $authority Original reader
	 * @return array Viewer identity, exact annotated pages and source delivery
	 * @throws \DomainException Generic unavailable result
	 */
	public function read( Title $owner, int $revisionId, string $binding, Authority $authority ): array {
		try {
			$identity = PageOwnedBinding::parse( $binding );
		} catch ( \InvalidArgumentException $e ) {
			throw new \DomainException( 'layers-revision-unavailable', 0, $e );
		}
		if ( $revisionId > 2147483647 || $owner->isExternal() || $owner->hasFragment() ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$content = $this->access->read( $owner, $revisionId, $authority, $identity['pageId'] );
		$surfaces = json_decode( $content->getText(), true, 64, JSON_THROW_ON_ERROR )['surfaces'];
		$selected = array_values( array_filter( $surfaces,
			static fn ( array $surface ): bool => $surface['id'] === $identity['surfaceId'] ) );
		if ( count( $selected ) !== 1 ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$anchor = $selected[0];
		$members = $anchor['kind'] === 'pdf' ? array_values( array_filter( $surfaces,
			static fn ( array $surface ): bool => $surface['kind'] === 'pdf' &&
				$surface['source']['fileTitle'] === $anchor['source']['fileTitle'] &&
				DrawingName::key( $surface['label'] ) === DrawingName::key( $anchor['label'] ) ) ) : [ $anchor ];
		$pages = [];
		foreach ( $members as $surface ) {
			$page = $surface['kind'] === 'pdf' ? $surface['source']['page'] : 1;
			// Never assemble one original from conflicting upload pins or duplicate member pages.
			if ( isset( $pages[$page] ) || ( $surface['kind'] === 'pdf' &&
				( $surface['source']['timestamp'] !== $anchor['source']['timestamp'] ||
					$surface['source']['sha1'] !== $anchor['source']['sha1'] ) ) ) {
				throw new \DomainException( 'layers-revision-unavailable' );
			}
			$pages[$page] = [ 'page' => $page, 'surface' => $surface ];
		}
		$ids = array_column( $members, 'id' );
		$files = $this->sources->resolve( $content, $authority, $ids );
		$source = null;
		$pageCount = 1;
		if ( $anchor['kind'] === 'pdf' ) {
			$pageCount = $files[$anchor['id']]->pageCount();
			if ( !is_int( $pageCount ) || $pageCount < 1 ||
				!preg_match( '~^/(?!/)[^?#]*$~D', $this->pdfPath ) ) {
				throw new \DomainException( 'layers-revision-unavailable' );
			}
			$source = [ 'url' => $this->pdfPath . '?' . wfArrayToCgi( [
				'owner' => $owner->getPrefixedDBkey(), 'revid' => $revisionId, 'binding' => $binding
			] ), 'exactVersion' => true ];
		} elseif ( $anchor['kind'] === 'image' ) {
			$source = $this->renditions->forSurface( $files[$anchor['id']], $anchor, true );
		}
		// A transform or native file lookup may run hooks. Repeat admission before returning data.
		$fresh = $this->access->read( $owner, $revisionId, $authority, $identity['pageId'] );
		if ( $fresh->getText() !== $content->getText() ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$this->sources->resolve( $fresh, $authority, $ids );
		ksort( $pages, SORT_NUMERIC );
		return [ 'owner' => $owner->getPrefixedDBkey(), 'pageId' => $identity['pageId'],
			'revisionId' => $revisionId, 'binding' => $binding, 'kind' => $anchor['kind'],
			'label' => $anchor['label'], 'initialPage' => $anchor['kind'] === 'pdf' ? $anchor['source']['page'] : 1,
			'pageCount' => $pageCount, 'pages' => array_values( $pages ), 'source' => $source ];
	}
}
