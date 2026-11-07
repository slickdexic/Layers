<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\TitleFactory;

/** Source-filtered projection of legacy sets; not an index-invalidation mechanism. */
final class VisibleLegacySearchProjection {
	public function __construct(
		private LayersDatabase $db,
		private LegacySearchSourceAdmission $sources,
		private TitleFactory $titles
	) {
	}

	/** @return string Searchable text for a file's selected legacy sets. */
	public function file( string $name, Authority $authority, bool $fromPrimary = false ): string {
		return $this->fileRows( $name, $this->db->getFileSetsForSearchWithSources( $name, $fromPrimary ), $authority );
	}

	/** @return string Searchable text for a shown file set or standalone slide. */
	public function shown( string $name, string $set, bool $slide, Authority $authority,
		bool $fromPrimary = false
	): string {
		if ( $slide ) {
			$rows = $this->db->getSetForSearch( LayersConstants::SLIDE_PREFIX . $name, $set, true, $fromPrimary );
			return implode( "\n", array_filter( array_map( [ PageDrawingSearchText::class, 'layerText' ], $rows ),
				'strlen' ) );
		}
		return $this->fileRows( $name, $this->db->getSetForSearchWithSources( $name, $set, false, $fromPrimary ),
			$authority );
	}

	/** @param string $name @param array[] $rows @param Authority $authority @return string */
	private function fileRows( string $name, array $rows, Authority $authority ): string {
		$title = $this->titles->newFromText( 'File:' . $name );
		if ( !$title ) {
			return '';
		}
		$lines = [];
		foreach ( $rows as $row ) {
			if ( $this->sources->allows( $title, $row['sha1'], $row['page'], $authority ) ) {
				$lines[] = PageDrawingSearchText::layerText( $row['data'] );
			}
		}
		return implode( "\n", array_filter( $lines, 'strlen' ) );
	}
}
