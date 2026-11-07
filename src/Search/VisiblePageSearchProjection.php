<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;

/** Builds a source-filtered projection; callers still own page authorization and index invalidation. */
final class VisiblePageSearchProjection {
	public function __construct( private SourceVersionResolver $sources ) {
	}

	/**
	 * @param LayersDocumentContent $content Exact revision content already authorized by the caller
	 * @param Authority $authority Visibility boundary for the intended index or reader
	 * @return string Searchable text; unreadable snapshots fail closed
	 */
	public function get( LayersDocumentContent $content, Authority $authority ): string {
		$ids = [];
		foreach ( PageDrawingSearchText::surfaces( $content ) as $surface ) {
			if ( in_array( $surface['kind'] ?? null, [ 'image', 'pdf' ], true ) &&
				is_string( $surface['id'] ?? null ) ) {
				$ids[] = $surface['id'];
			}
		}
		try {
			$files = $this->sources->resolveIndividually( $content, $authority, $ids );
		} catch ( \DomainException $e ) {
			return '';
		}
		return PageDrawingSearchText::extractWithAdmittedSources( $content, array_keys( $files ) );
	}
}
