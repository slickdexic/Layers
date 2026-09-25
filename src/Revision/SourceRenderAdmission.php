<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\FileRepo\File\File;

/** Internal metadata admission, not a decoder memory limit or execution deadline. */
class SourceRenderAdmission {
	public const MAX_SOURCE_BYTES = 67108864;
	public const MAX_SOURCE_PIXELS = 40000000;

	/**
	 * Admit one selected exact source before raster preparation.
	 * File bytes apply to the whole source; geometry applies to the pinned page.
	 * Metadata is core-reported, not an independent inspection of compressed content.
	 *
	 * @param File $file Authorized exact source
	 * @param int $page Snapshot-pinned page
	 * @throws \DomainException Missing, invalid or excessive source metadata
	 */
	public function assertCanRender( File $file, int $page ): void {
		$size = $file->getSize();
		if ( $page < 1 || !is_int( $size ) || $size < 1 || $size > self::MAX_SOURCE_BYTES ) {
			throw new \DomainException( 'layers-render-unavailable' );
		}
		$width = $file->getWidth( $page );
		$height = $file->getHeight( $page );
		if ( !is_int( $width ) || !is_int( $height ) || $width < 1 || $height < 1 ||
			$width > intdiv( self::MAX_SOURCE_PIXELS, $height )
		) {
			throw new \DomainException( 'layers-render-unavailable' );
		}
	}
}
