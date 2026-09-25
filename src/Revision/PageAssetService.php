<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;

/** Internal authorized raster preparation; no HTTP endpoint or cache registration. */
class PageAssetService {
	private PageHistoryAccess $access;
	private SourceVersionResolver $sources;
	private PrivateRasterRenderer $renderer;
	private SourceRenderAdmission $admission;

	public function __construct(
		PageHistoryAccess $access, SourceVersionResolver $sources, PrivateRasterRenderer $renderer,
		?SourceRenderAdmission $admission = null
	) {
		$this->access = $access;
		$this->sources = $sources;
		$this->renderer = $renderer;
		$this->admission = $admission ?? new SourceRenderAdmission();
	}

	/**
	 * Prepare bytes for immediate delivery to the original reader.
	 * All source identity, including PDF page, comes from the exact authorized snapshot.
	 * Rechecks the whole document after rendering, when private staging is already purged.
	 * A future transport must not cache this result or defer sending it after authorization.
	 *
	 * @param Title $owner Owner page
	 * @param int $revisionId Explicit revision ID
	 * @param string $surfaceId Exact image/PDF surface ID; slides have no source raster
	 * @param int $width Requested raster width
	 * @param Authority $authority Original reader authority
	 * @return array MIME, dimensions and bytes; no URL, path or File object
	 * @throws \DomainException Generic unavailable result, including revoked access
	 */
	public function prepare(
		Title $owner, int $revisionId, string $surfaceId, int $width, Authority $authority
	): array {
		// Reject malformed work before revision reads or potentially expensive source metadata lookups.
		if ( $width < 1 || $width > PrivateRasterRenderer::MAX_SIDE ) {
			throw new \DomainException( 'layers-asset-unavailable' );
		}
		try {
			$content = $this->access->read( $owner, $revisionId, $authority );
			$canonical = $content->getCanonicalText();
			$snapshot = json_decode( $canonical, true, 64, JSON_THROW_ON_ERROR );
			$selected = null;
			foreach ( $snapshot['surfaces'] as $surface ) {
				if ( $surface['id'] === $surfaceId && $surface['kind'] !== 'slide' ) {
					$selected = $surface;
					break;
				}
			}
			if ( $selected === null ) {
				throw new \DomainException( 'layers-asset-unavailable' );
			}
			$files = $this->sources->resolve( $content, $authority );
			$this->admission->assertCanRender( $files[$surfaceId], $selected['source']['page'] );
			$raster = $this->renderer->render( $files[$surfaceId], $selected['source']['page'], $width );
			// Rendering may be slow. Never release bytes based only on its initial authorization.
			$current = $this->access->read( $owner, $revisionId, $authority );
			if ( $current->getCanonicalText() !== $canonical ) {
				throw new \DomainException( 'layers-asset-unavailable' );
			}
			$this->sources->resolve( $current, $authority );
			return $raster;
		} catch ( \DomainException $e ) {
			throw new \DomainException( 'layers-asset-unavailable', 0, $e );
		}
	}
}
