<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Validation\ColorValidator;
use MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator;

/** Internal version-one snapshot format. No public write API is enabled. */
class DocumentSchema {
	public const VERSION = 1;
	public const MAX_BYTES = 2097152;
	public const MAX_SURFACES = 100;
	public const MAX_LAYERS_PER_SURFACE = 100;
	public const MAX_TOTAL_LAYERS = 1000;
	public const MAX_DIMENSION = 4096;

	/**
	 * Validate without silently repairing data and return canonical JSON.
	 *
	 * @param string $json Complete snapshot
	 * @return string
	 * @throws \InvalidArgumentException On malformed or unsupported content
	 */
	public function canonicalize( string $json ): string {
		if ( strlen( $json ) > self::MAX_BYTES ) {
			throw new \InvalidArgumentException( 'document-too-large' );
		}
		try {
			$document = json_decode( $json, false, 64, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
			throw new \InvalidArgumentException( 'invalid-json', 0, $e );
		}
		JsonSnapshotCodec::rejectDuplicateKeys( $json );
		$this->objectKeys( $document, [ 'schemaVersion', 'surfaces' ], [], 'document' );
		if ( $document->schemaVersion !== self::VERSION ) {
			throw new \InvalidArgumentException( 'unsupported-schema-version' );
		}
		$this->listValue( $document->surfaces, self::MAX_SURFACES, 'surfaces' );
		$ids = [];
		$totalLayers = 0;
		foreach ( $document->surfaces as $surface ) {
			$this->surface( $surface );
			if ( isset( $ids[$surface->id] ) ) {
				throw new \InvalidArgumentException( 'duplicate-surface-id' );
			}
			$ids[$surface->id] = true;
			$totalLayers += count( $surface->layers );
			if ( $totalLayers > self::MAX_TOTAL_LAYERS ) {
				throw new \InvalidArgumentException( 'too-many-total-layers' );
			}
		}
		$result = JsonSnapshotCodec::encode( $document );
		if ( strlen( $result ) > self::MAX_BYTES ) {
			throw new \InvalidArgumentException( 'document-too-large' );
		}
		return $result;
	}

	/** @param mixed $surface */
	private function surface( $surface ): void {
		$this->objectKeys( $surface, [ 'id', 'kind', 'label', 'canvas', 'layers' ],
			[ 'source', 'readingOrder' ], 'surface' );
		$this->identifier( $surface->id );
		if ( !in_array( $surface->kind, [ 'image', 'pdf', 'slide' ], true ) ) {
			throw new \InvalidArgumentException( 'invalid-surface-kind' );
		}
		if ( !is_string( $surface->label ) || strlen( $surface->label ) > 512 ||
			preg_match( '/[\x00-\x1f\x7f]/', $surface->label ) ) {
			throw new \InvalidArgumentException( 'invalid-surface-label' );
		}
		$this->objectKeys( $surface->canvas,
			[ 'width', 'height', 'backgroundColor', 'backgroundVisible', 'backgroundOpacity' ], [], 'canvas' );
		foreach ( [ 'width', 'height' ] as $dimension ) {
			$this->integer( $surface->canvas->$dimension, 1, self::MAX_DIMENSION, 'canvas-dimension' );
		}
		if ( !is_string( $surface->canvas->backgroundColor ) ||
			!ColorValidator::isValidColor( $surface->canvas->backgroundColor ) ||
			!is_bool( $surface->canvas->backgroundVisible ) ) {
			throw new \InvalidArgumentException( 'invalid-background' );
		}
		$opacity = $surface->canvas->backgroundOpacity;
		if ( !( is_int( $opacity ) || is_float( $opacity ) ) || !is_finite( (float)$opacity ) ||
			$opacity < 0 || $opacity > 1 ) {
			throw new \InvalidArgumentException( 'invalid-background-opacity' );
		}
		if ( $surface->kind === 'slide' ) {
			if ( property_exists( $surface, 'source' ) ) {
				throw new \InvalidArgumentException( 'slide-must-not-have-source' );
			}
		} else {
			$this->source( $surface->source ?? null, $surface->kind );
		}
		$this->layers( $surface );
	}

	/**
	 * @param mixed $source
	 * @param string $kind
	 */
	private function source( $source, string $kind ): void {
		$this->objectKeys( $source, [ 'repository', 'fileTitle', 'timestamp', 'sha1', 'page' ], [], 'source' );
		// Version one describes retained local upload versions only. Resolving the
		// reference and authorizing it are separate mandatory publication checks.
		if ( $source->repository !== 'local' || !is_string( $source->fileTitle ) ||
			strlen( $source->fileTitle ) > 255 ||
			!preg_match( '/^File:[^\x00-\x1f\x7f#<>\[\]{}|]+$/Du', $source->fileTitle ) ) {
			throw new \InvalidArgumentException( 'invalid-source-title' );
		}
		if ( !is_string( $source->sha1 ) || !preg_match( '/^[0-9a-z]{31}$/D', $source->sha1 ) ) {
			throw new \InvalidArgumentException( 'invalid-source-sha1' );
		}
		if ( !is_string( $source->timestamp ) || !preg_match( '/^[0-9]{14}$/D', $source->timestamp ) ) {
			throw new \InvalidArgumentException( 'invalid-source-timestamp' );
		}
		$date = \DateTimeImmutable::createFromFormat( '!YmdHis', $source->timestamp, new \DateTimeZone( 'UTC' ) );
		if ( !$date || $date->format( 'YmdHis' ) !== $source->timestamp ) {
			throw new \InvalidArgumentException( 'invalid-source-timestamp' );
		}
		$this->integer( $source->page, 1, $kind === 'image' ? 1 : 100000, 'source-page' );
	}

	/** @param \stdClass $surface */
	private function layers( \stdClass $surface ): void {
		$this->listValue( $surface->layers, self::MAX_LAYERS_PER_SURFACE, 'layers' );
		$byId = [];
		foreach ( $surface->layers as $layer ) {
			if ( !$layer instanceof \stdClass ) {
				throw new \InvalidArgumentException( 'layer-must-be-object' );
			}
			$this->identifier( $layer->id ?? null );
			if ( isset( $byId[$layer->id] ) ) {
				throw new \InvalidArgumentException( 'duplicate-layer-id' );
			}
			$byId[$layer->id] = $layer;
		}
		try {
			$raw = json_decode( json_encode( $surface->layers, JSON_THROW_ON_ERROR ), true, 64, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
			throw new \InvalidArgumentException( 'invalid-layer-json-number', 0, $e );
		}
		$validator = new ServerSideLayerValidator( self::MAX_LAYERS_PER_SURFACE, 1048576 );
		$result = $validator->validateLayers( $raw );
		if ( !$result->isValid() || JsonSnapshotCodec::encode( $surface->layers ) !==
			JsonSnapshotCodec::encode( $result->getData() ) ) {
			throw new \InvalidArgumentException( 'invalid-or-lossy-layer-data' );
		}
		$this->references( $surface, $byId );
	}

	/**
	 * @param \stdClass $surface
	 * @param array $byId
	 */
	private function references( \stdClass $surface, array $byId ): void {
		$parents = [];
		foreach ( $byId as $id => $layer ) {
			if ( isset( $layer->children ) ) {
				if ( $layer->type !== 'group' ) {
					throw new \InvalidArgumentException( 'children-require-group' );
				}
				$this->listValue( $layer->children, self::MAX_LAYERS_PER_SURFACE, 'children' );
				foreach ( $layer->children as $child ) {
					$this->identifier( $child );
					if ( !isset( $byId[$child] ) || isset( $parents[$child] ) || $child === (string)$id ) {
						throw new \InvalidArgumentException( 'invalid-group-child' );
					}
					$parents[$child] = (string)$id;
				}
			}
		}
		foreach ( $byId as $id => $layer ) {
			if ( ( $layer->parentGroup ?? null ) !== ( $parents[$id] ?? null ) ) {
				throw new \InvalidArgumentException( 'inconsistent-group-parent' );
			}
			$seen = [];
			$cursor = $id;
			while ( isset( $parents[$cursor] ) ) {
				if ( isset( $seen[$cursor] ) ) {
					throw new \InvalidArgumentException( 'cyclic-group' );
				}
				$seen[$cursor] = true;
				$cursor = $parents[$cursor];
			}
		}
		if ( property_exists( $surface, 'readingOrder' ) ) {
			$this->listValue( $surface->readingOrder, self::MAX_LAYERS_PER_SURFACE, 'reading-order' );
			$seen = [];
			foreach ( $surface->readingOrder as $id ) {
				$this->identifier( $id );
				if ( !isset( $byId[$id] ) || isset( $seen[$id] ) ) {
					throw new \InvalidArgumentException( 'invalid-reading-order' );
				}
				$seen[$id] = true;
			}
		}
	}

	/** @param mixed $value */
	private function identifier( $value ): void {
		if ( !is_string( $value ) || !preg_match( '/^[A-Za-z0-9_-]{1,64}$/D', $value ) ) {
			throw new \InvalidArgumentException( 'invalid-stable-id' );
		}
	}

	/**
	 * @param mixed $value
	 * @param int $min
	 * @param int $max
	 * @param string $field
	 */
	private function integer( $value, int $min, int $max, string $field ): void {
		if ( !is_int( $value ) || $value < $min || $value > $max ) {
			throw new \InvalidArgumentException( 'invalid-' . $field );
		}
	}

	/**
	 * @param mixed $value
	 * @param int $max
	 * @param string $field
	 */
	private function listValue( $value, int $max, string $field ): void {
		if ( !is_array( $value ) || !array_is_list( $value ) || count( $value ) > $max ) {
			throw new \InvalidArgumentException( 'invalid-' . $field . '-list' );
		}
	}

	/**
	 * @param mixed $value
	 * @param array $required
	 * @param array $optional
	 * @param string $field
	 */
	private function objectKeys( $value, array $required, array $optional, string $field ): void {
		if ( !$value instanceof \stdClass ) {
			throw new \InvalidArgumentException( $field . '-must-be-object' );
		}
		$keys = array_keys( get_object_vars( $value ) );
		if ( array_diff( $required, $keys ) || array_diff( $keys, array_merge( $required, $optional ) ) ) {
			throw new \InvalidArgumentException( 'invalid-' . $field . '-fields' );
		}
	}
}
