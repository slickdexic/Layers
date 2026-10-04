<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** Expand rename intent from stable surface IDs against the exact base, before publication admission. */
final class LayerSetRename {

	/**
	 * No input object is mutated. Removed pages remain removed; new pages of a renamed set follow it.
	 * @param \stdClass[] $stored Exact base revision
	 * @param \stdClass[] $proposed Complete proposed snapshot
	 * @return array{surfaces:array,renames:array} Expanded snapshot and scoped source-rewrite instructions
	 * @throws PublicationException On conflicting requests or a merge of distinct existing sets
	 */
	public static function prepare( array $stored, array $proposed ): array {
		$old = [];
		$requests = [];
		foreach ( $stored as $surface ) {
			$old[$surface->id] = $surface;
		}
		foreach ( $proposed as $surface ) {
			$before = $old[$surface->id] ?? null;
			if ( !$before || LayerSetIdentity::scope( $before ) !== LayerSetIdentity::scope( $surface ) ||
				$before->label === $surface->label ) {
				continue;
			}
			$key = LayerSetIdentity::key( $before );
			if ( isset( $requests[$key] ) && $requests[$key]['newName'] !== $surface->label ) {
				throw PublicationException::refusedName( $surface->label, true );
			}
			$requests[$key] = [ 'kind' => $before->kind === 'slide' ? 'slide' : 'file',
				'fileTitle' => $before->kind === 'slide' ? null : $before->source->fileTitle,
				'oldName' => $before->label, 'newName' => $surface->label ];
		}
		$result = [];
		$origins = [];
		foreach ( $proposed as $surface ) {
			$copy = clone $surface;
			$before = $old[$surface->id] ?? null;
			$retained = $before && LayerSetIdentity::scope( $before ) === LayerSetIdentity::scope( $surface );
			$origin = LayerSetIdentity::key( $retained ? $before : $surface );
			if ( isset( $requests[$origin] ) ) {
				$copy->label = $requests[$origin]['newName'];
			}
			if ( $retained ) {
				// Two distinct old sets may swap names, but may not merge even on disjoint PDF pages.
				$destination = LayerSetIdentity::key( $copy );
				if ( isset( $origins[$destination] ) && $origins[$destination] !== $origin ) {
					throw PublicationException::refusedName( $copy->label, true );
				}
				$origins[$destination] = $origin;
			}
			$result[] = $copy;
		}
		// Equivalent name spellings already resolve to the same set; retain existing embed bytes.
		$renames = array_values( array_filter( $requests, static fn ( $rename ) =>
			DrawingName::key( $rename['oldName'] ) !== DrawingName::key( $rename['newName'] ) ) );
		return [ 'surfaces' => $result, 'renames' => $renames ];
	}
}
