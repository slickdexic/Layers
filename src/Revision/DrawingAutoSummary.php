<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** What a publication changed, for the page history when the editor gives no summary. */
final class DrawingAutoSummary {

	/**
	 * @param \stdClass[] $stored The base revision's drawings
	 * @param \stdClass $document Canonical proposed document
	 * @return array[] Message key followed by its parameters, one per change
	 */
	public static function changes( array $stored, \stdClass $document ): array {
		$before = [];
		foreach ( $stored as $surface ) {
			$before[$surface->id] = $surface;
		}
		$changes = [];
		foreach ( $document->surfaces as $surface ) {
			$label = (string)$surface->label;
			$old = $before[$surface->id] ?? null;
			unset( $before[$surface->id] );
			if ( !$old ) {
				$changes[] = [ 'layers-autosummary-added', $label ];
				continue;
			}
			$oldLabel = (string)$old->label;
			if ( $oldLabel !== $label ) {
				$changes[] = [ 'layers-autosummary-renamed', $oldLabel, $label ];
			}
			$unlabelled = clone $surface;
			$unlabelled->label = $oldLabel;
			if ( JsonSnapshotCodec::encode( $unlabelled ) !== JsonSnapshotCodec::encode( $old ) ) {
				$changes[] = [ 'layers-autosummary-edited', $label ];
			}
		}
		foreach ( $before as $surface ) {
			$changes[] = [ 'layers-autosummary-removed', (string)$surface->label ];
		}
		return $changes;
	}

	/**
	 * @param \stdClass[] $stored
	 * @param \stdClass $document
	 * @return string Summary in the wiki's content language, or '' when no drawing changed
	 */
	public static function text( array $stored, \stdClass $document ): string {
		$parts = array_map( static fn ( array $change ) =>
			wfMessage( array_shift( $change ) )->plaintextParams( $change )->inContentLanguage()->text(),
			self::changes( $stored, $document ) );
		return implode( wfMessage( 'semicolon-separator' )->inContentLanguage()->text(), $parts );
	}
}
