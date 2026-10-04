<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** Identities within one already-authorized owning page. Source titles are canonical DB keys. */
final class LayerSetIdentity {

	/** @param \stdClass $surface @return string File or standalone-slide namespace */
	public static function scope( \stdClass $surface ): string {
		return JsonSnapshotCodec::encode( $surface->kind === 'slide' ?
			[ 'slide' ] : [ 'file', $surface->source->fileTitle ] );
	}

	/** @param \stdClass $surface @return string One named set, independent of PDF page and source version */
	public static function key( \stdClass $surface ): string {
		return JsonSnapshotCodec::encode( [ self::scope( $surface ), DrawingName::key( $surface->label ) ] );
	}

	/** @param \stdClass $surface @return string One internal page of a named set */
	public static function surfaceKey( \stdClass $surface ): string {
		return JsonSnapshotCodec::encode( [ self::key( $surface ),
			$surface->kind === 'pdf' ? $surface->source->page : 1 ] );
	}

	/**
	 * @param \stdClass[] $surfaces
	 * @param \stdClass $selected
	 * @return string[] Names allocated within the same file/slide namespace
	 */
	public static function namesInScope( array $surfaces, \stdClass $selected ): array {
		$scope = self::scope( $selected );
		return array_values( array_map( static fn ( $surface ) => (string)$surface->label,
			array_filter( $surfaces, static fn ( $surface ) => self::scope( $surface ) === $scope ) ) );
	}
}
