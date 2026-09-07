<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** Deterministic JSON helpers for bounded, already syntax-checked snapshots. */
class JsonSnapshotCodec {
	/**
	 * Sort object keys recursively; preserve all array ordering and JSON types.
	 *
	 * @param mixed $value
	 * @return string
	 */
	public static function encode( $value ): string {
		return json_encode( self::ordered( $value ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES |
			JSON_THROW_ON_ERROR );
	}

	/**
	 * @param mixed $value
	 * @return mixed
	 */
	private static function ordered( $value ) {
		if ( is_object( $value ) || ( is_array( $value ) && !array_is_list( $value ) ) ) {
			$properties = (array)$value;
			ksort( $properties, SORT_STRING );
			return (object)array_map( [ self::class, 'ordered' ], $properties );
		}
		return is_array( $value ) ? array_map( [ self::class, 'ordered' ], $value ) : $value;
	}

	/**
	 * Reject duplicate object members, including equivalent escaped key names.
	 * Native JSON parsing must succeed first; this is not a replacement parser.
	 *
	 * @param string $json Syntax-checked, bounded JSON
	 */
	public static function rejectDuplicateKeys( string $json ): void {
		$stack = [];
		$length = strlen( $json );
		for ( $i = 0; $i < $length; $i++ ) {
			$char = $json[$i];
			$top = count( $stack ) - 1;
			if ( $char === '"' ) {
				$start = $i++;
				while ( $i < $length && $json[$i] !== '"' ) {
					if ( $json[$i] === '\\' ) {
						$i++;
					}
					$i++;
				}
				if ( $top >= 0 && $stack[$top]['key'] ) {
					$key = json_decode( substr( $json, $start, $i - $start + 1 ), true, 64, JSON_THROW_ON_ERROR );
					if ( isset( $stack[$top]['seen'][$key] ) ) {
						throw new \InvalidArgumentException( 'duplicate-json-key' );
					}
					$stack[$top]['seen'][$key] = true;
					$stack[$top]['key'] = false;
				}
			} elseif ( $char === '{' || $char === '[' ) {
				$stack[] = [ 'object' => $char === '{', 'key' => $char === '{', 'seen' => [] ];
			} elseif ( $char === '}' || $char === ']' ) {
				array_pop( $stack );
			} elseif ( $char === ',' && $top >= 0 && $stack[$top]['object'] ) {
				$stack[$top]['key'] = true;
			}
		}
	}
}
