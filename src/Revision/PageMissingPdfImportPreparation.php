<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;

/** Inactive native preparation; never adds admitted pages to the saved revision. */
class PageMissingPdfImportPreparation {

	public function __construct(
		private PageMissingPdfSetPreparation $missing,
		private PageWorkingCopyPdfImportReadService $reader
	) {
	}

	/**
	 * Read a complete source group and admit a completely absent target group.
	 * Exact saved embedding admission is repeated after source rendering. The original
	 * target base (including an absent layers slot) remains separate from empty pages.
	 * Nothing returned is authority to apply work, recover a draft or publish a revision.
	 *
	 * @param int $targetPageId
	 * @param int $targetRevisionId Current editable revision
	 * @param int $start Saved embedding byte offset
	 * @param string $expected Complete saved embedding bytes
	 * @param int $sourcePageId Different readable owner
	 * @param int $sourceRevisionId Exact readable revision
	 * @param string $sourceSurfaceId Stored source group anchor
	 * @param Authority $authority
	 * @return array Detached native admission and source evidence
	 */
	public function prepare( int $targetPageId, int $targetRevisionId, int $start, string $expected,
		int $sourcePageId, int $sourceRevisionId, string $sourceSurfaceId, Authority $authority
	): array {
		try {
			if ( $targetPageId === $sourcePageId ) {
				throw new \DomainException();
			}
			$target = $this->missing->prepare( $targetPageId, $targetRevisionId, $start, $expected, $authority );
			$source = $this->reader->readSource( $sourcePageId, $sourceRevisionId, $sourceSurfaceId, $authority );
			$selected = $target['pages'][$target['initialPage'] - 1]['surface'];
			$sourceAnchor = array_values( array_filter( $source['bundle']['snapshot']->surfaces,
				static fn ( $surface ): bool => $surface->id === $sourceSurfaceId ) )[0];
			if ( LayerSetIdentity::key( json_decode( JsonSnapshotCodec::encode( $selected ) ) ) !==
				LayerSetIdentity::key( $sourceAnchor ) ) {
				throw new \DomainException();
			}
			foreach ( $source['group']['members'] as $member ) {
				if ( $member['page'] > $target['pageCount'] ) {
					throw new \DomainException();
				}
			}
			// Source hooks cannot silently change the saved selection, target pin or complete base.
			$freshTarget = $this->missing->prepare( $targetPageId, $targetRevisionId, $start, $expected, $authority );
			$freshSource = $this->reader->readSource( $sourcePageId, $sourceRevisionId, $sourceSurfaceId,
				$authority, false );
			if ( JsonSnapshotCodec::encode( $target ) !== JsonSnapshotCodec::encode( $freshTarget ) ||
				$source['source'] !== $freshSource['source'] ||
				JsonSnapshotCodec::encode( $source['witness'] ) !==
					JsonSnapshotCodec::encode( $freshSource['witness'] ) ) {
				throw new \DomainException();
			}
			return [ 'targetAdmission' => $target, 'source' => $source['source'],
				'sourceBundle' => $source['bundle'], 'sourceGroup' => $source['group'] ];
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-working-copy-import-unavailable' );
		}
	}
}
