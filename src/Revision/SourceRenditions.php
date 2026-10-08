<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\FileRepo\File\File;
use MediaWiki\Utils\UrlUtils;

/**
 * Core renditions of the exact source version a surface is pinned to.
 * Only called after the reader is authorized for the owner revision and that file version.
 * The URLs are MediaWiki's own for that version (archived versions included), so they carry the
 * wiki's configured protection (for example img_auth.php) and stop working when core hides the version.
 */
class SourceRenditions {
	/** Widest rendition requested; the viewer scales it to the surface canvas. */
	public const MAX_WIDTH = 2048;

	private UrlUtils $urls;

	public function __construct( UrlUtils $urls ) {
		$this->urls = $urls;
	}

	/**
	 * @param File $file Exact resolved version from SourceVersionResolver
	 * @param array $surface Decoded image or PDF surface
	 * @param bool $fullSize Use the file's native width for the full-size image viewer
	 * @return array{url:string,width:int,height:int}
	 * @throws \DomainException layers-source-unavailable when core cannot produce a rendition
	 */
	public function forSurface( File $file, array $surface, bool $fullSize = false ): array {
		$width = $fullSize ? $file->getWidth( (int)$surface['source']['page'] ) :
			min( (int)$surface['canvas']['width'], self::MAX_WIDTH );
		if ( !is_int( $width ) || $width < 1 ) {
			throw new \DomainException( 'layers-source-unavailable' );
		}
		$params = [ 'width' => $width ];
		if ( $surface['kind'] === 'pdf' ) {
			$params['page'] = (int)$surface['source']['page'];
			try {
				$thumb = $file->transform( $params, File::RENDER_NOW );
				if ( !$thumb || $thumb->isError() ) {
					throw new \DomainException( 'layers-source-unavailable' );
				}
				$reference = $thumb->getLocalCopyPath();
				$pixels = is_string( $reference ) && is_file( $reference ) && is_readable( $reference ) ?
					\Wikimedia\AtEase\AtEase::quietCall( 'getimagesize', $reference ) : false;
				if ( !$pixels || !is_int( $pixels[0] ) || !is_int( $pixels[1] ) ||
					$pixels[0] < 1 || $pixels[1] < 1
				) {
					throw new \DomainException( 'layers-source-unavailable' );
				}
				$width = $pixels[0];
				$height = $pixels[1];
			} catch ( \Throwable $exception ) {
				throw new \DomainException( 'layers-source-unavailable' );
			}
		} else {
			$thumb = $file->transform( $params );
			$width = $thumb ? $thumb->getWidth() : 0;
			$height = $thumb ? $thumb->getHeight() : 0;
		}
		$url = $thumb && !$thumb->isError() ? $thumb->getUrl() : false;
		$expanded = is_string( $url ) && $url !== '' ? $this->urls->expand( $url, PROTO_CURRENT ) : null;
		if ( $expanded === null || !preg_match( '#^https?://#i', $expanded ) ||
			!is_int( $width ) || !is_int( $height ) || $width < 1 || $height < 1
		) {
			throw new \DomainException( 'layers-source-unavailable' );
		}
		return [ 'url' => $expanded, 'width' => $width, 'height' => $height ];
	}
}
