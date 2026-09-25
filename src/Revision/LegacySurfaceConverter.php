<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** Pure structural conversion of an exact server-selected legacy row; no authorization or I/O. */
class LegacySurfaceConverter {
	/**
	 * Produce one version-one surface without normalizing or dropping drawing properties.
	 * Caller must authorize the row/source, resolve exact media geometry, generate the ID,
	 * and verify editor/rendering support before adoption. This is not a public API.
	 *
	 * @param array $record Raw getLayerSetForAdoption result
	 * @param string $surfaceId Server-generated identity
	 * @param array|null $media Exact authorized media: source object plus width and height
	 * @return string Canonical one-surface document
	 * @throws \InvalidArgumentException Fixed error without raw data
	 */
	public function convert( array $record, string $surfaceId, ?array $media = null ): string {
		try {
			return $this->convertRecord( $record, $surfaceId, $media );
		} catch ( \InvalidArgumentException | \JsonException $e ) {
			throw new \InvalidArgumentException( 'layers-legacy-conversion-unavailable' );
		}
	}

	/**
	 * @param array $record
	 * @param string $surfaceId
	 * @param array|null $media
	 * @return string
	 */
	private function convertRecord( array $record, string $surfaceId, ?array $media ): string {
		foreach ( [ 'json', 'imgName', 'sha1', 'mime', 'name', 'timestamp' ] as $key ) {
			if ( !isset( $record[$key] ) || !is_string( $record[$key] ) ) {
				throw new \InvalidArgumentException();
			}
		}
		foreach ( [ 'id', 'revision', 'page' ] as $key ) {
			if ( !isset( $record[$key] ) || !is_int( $record[$key] ) || $record[$key] < 1 ) {
				throw new \InvalidArgumentException();
			}
		}
		if ( strlen( $record['json'] ) > DocumentSchema::MAX_BYTES ) {
			throw new \InvalidArgumentException();
		}
		JsonSnapshotCodec::rejectDuplicateKeys( $record['json'] );
		$data = json_decode( $record['json'], false, 64, JSON_THROW_ON_ERROR );
		if ( !$data instanceof \stdClass ) {
			throw new \InvalidArgumentException();
		}
		$required = [ 'revision', 'ownerId', 'schema', 'created', 'layers', 'backgroundVisible', 'backgroundOpacity' ];
		$slide = $record['mime'] === 'application/x-layers-slide';
		if ( $slide ) {
			$required = array_merge( $required, [ 'isSlide', 'canvasWidth', 'canvasHeight', 'backgroundColor' ] );
		}
		if ( array_diff( array_keys( get_object_vars( $data ) ), $required ) ||
			array_diff( $required, array_keys( get_object_vars( $data ) ) ) ||
			$data->schema !== 1 || $data->revision !== $record['revision'] ||
			$data->created !== $record['timestamp'] || !is_int( $data->ownerId ) || $data->ownerId < 0 ) {
			throw new \InvalidArgumentException();
		}
		$surface = (object)[
			'id' => $surfaceId, 'kind' => $slide ? 'slide' : 'image', 'label' => $record['name'],
			'canvas' => (object)[
				'width' => null, 'height' => null, 'backgroundColor' => '#ffffff',
				'backgroundVisible' => $data->backgroundVisible, 'backgroundOpacity' => $data->backgroundOpacity
			],
			'layers' => $data->layers
		];
		if ( $slide ) {
			if ( $media !== null || $record['sha1'] !== 'slide' || $record['page'] !== 1 ||
				!str_starts_with( $record['imgName'], 'Slide:' ) || $data->isSlide !== true ) {
				throw new \InvalidArgumentException();
			}
			$surface->canvas->width = $data->canvasWidth;
			$surface->canvas->height = $data->canvasHeight;
			$surface->canvas->backgroundColor = $data->backgroundColor;
		} else {
			if ( $media === null || !isset( $media['source'] ) || !isset( $media['width'] ) ||
				!isset( $media['height'] ) ||
				!is_array( $media['source'] ) ||
				( $record['mime'] !== 'application/pdf' && !str_starts_with( $record['mime'], 'image/' ) ) ) {
				throw new \InvalidArgumentException();
			}
			$source = $media['source'];
			if ( ( $source['fileTitle'] ?? null ) !== 'File:' . $record['imgName'] ||
				( $source['sha1'] ?? null ) !== $record['sha1'] ||
				( $source['page'] ?? null ) !== $record['page'] ) {
				throw new \InvalidArgumentException();
			}
			$surface->kind = $record['mime'] === 'application/pdf' ? 'pdf' : 'image';
			$surface->source = (object)$source;
			$surface->canvas->width = $media['width'];
			$surface->canvas->height = $media['height'];
		}
		return ( new DocumentSchema() )->canonicalize( JsonSnapshotCodec::encode(
			(object)[ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ]
		) );
	}
}
