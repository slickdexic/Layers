<?php
/**
 * Layers Parameter Extractor
 *
 * Centralized class for extracting layer parameters from various sources.
 * Eliminates code duplication across WikitextHooks methods.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks\Processors;

/**
 * Handles extraction of layer parameters from various sources.
 *
 * Layer parameters can come from:
 * - Handler params (handlerParams['layers'])
 * - Frame params (frameParams['layers'])
 * - Link URLs (href with layers= query param)
 * - data-mw JSON attributes
 * - Direct attribute arrays
 */
class LayersParamExtractor {

	/**
	 * Values that indicate layers should be disabled
	 */
	private const DISABLED_VALUES = [ 'off', 'none', 'false', '0' ];

	/**
	 * Values that indicate layers should be enabled with default behavior
	 */
	private const ENABLED_VALUES = [ 'on', 'all', 'true', '1' ];

	/**
	 * Extract layers parameter from handler and frame params
	 *
	 * @param array $handlerParams Handler parameters
	 * @param array $frameParams Frame parameters
	 * @return string|null The layers flag value, or null if not found
	 */
	public function extractFromParams( array $handlerParams, array $frameParams ): ?string {
		// Check handler params first (more specific)
		foreach ( [ 'layers', 'layer' ] as $key ) {
			if ( isset( $handlerParams[$key] ) ) {
				return strtolower( trim( (string)$handlerParams[$key] ) );
			}
		}

		// Check frame params
		foreach ( [ 'layers', 'layer' ] as $key ) {
			if ( isset( $frameParams[$key] ) ) {
				return strtolower( trim( (string)$frameParams[$key] ) );
			}
		}

		return null;
	}

	/**
	 * Extract layers parameter from a URL (href)
	 *
	 * @param string $href The URL to parse
	 * @return string|null The layers flag value, or null if not found
	 */
	public function extractFromHref( string $href ): ?string {
		// Parse query string for layers param
		$parsed = parse_url( $href );
		if ( isset( $parsed['query'] ) ) {
			parse_str( $parsed['query'], $queryParams );
			foreach ( [ 'layers', 'layer' ] as $key ) {
				if ( isset( $queryParams[$key] ) ) {
					return strtolower( trim( (string)$queryParams[$key] ) );
				}
			}
		}

		// Also check for layers= in the path (some MediaWiki URL schemes)
		if ( preg_match( '/[?&]layers=([^&]+)/i', $href, $matches ) ) {
			return strtolower( trim( urldecode( $matches[1] ) ) );
		}

		return null;
	}

	/**
	 * Extract layers parameter from data-mw JSON attribute
	 *
	 * @param string $html HTML string containing data-mw attribute
	 * @return string|null The layers flag value, or null if not found
	 */
	public function extractFromDataMw( string $html ): ?string {
		// Find data-mw attribute value
		if ( !preg_match( '/data-mw\s*=\s*(["\'])(.*?)\1/is', $html, $matches ) ) {
			return null;
		}

		$raw = html_entity_decode( $matches[2], ENT_QUOTES, 'UTF-8' );

		try {
			$dmw = json_decode( $raw, true, 512, JSON_THROW_ON_ERROR );
			if ( !is_array( $dmw ) ) {
				return null;
			}

			// Check various data-mw paths where layers param might be stored
			$paths = [
				[ 'attrs', 'originalArgs' ],
				[ 'attrs', 'options' ],
				[ 'body', 'attrs', 'options' ],
			];

			foreach ( $paths as $path ) {
				$result = $this->searchDataMwPath( $dmw, $path );
				if ( $result !== null ) {
					return $result;
				}
			}
		} catch ( \Throwable $e ) {
			// JSON parsing failed, ignore
		}

		return null;
	}

	/**
	 * Search a data-mw path for layers parameter
	 *
	 * @param array $dmw The data-mw structure
	 * @param array $path The path to search
	 * @return string|null The layers value if found
	 */
	private function searchDataMwPath( array $dmw, array $path ): ?string {
		$node = $dmw;

		// Navigate to the target node
		foreach ( $path as $segment ) {
			if ( is_array( $node ) && array_key_exists( $segment, $node ) ) {
				$node = $node[$segment];
			} else {
				return null;
			}
		}

		if ( !is_array( $node ) ) {
			return null;
		}

		// Check if it's an indexed array (like ["thumb","x500px","layers=all"])
		if ( array_values( $node ) === $node ) {
			foreach ( $node as $val ) {
				if ( is_string( $val ) && preg_match( '/^layers?\s*=\s*(.+)$/i', $val, $matches ) ) {
					return strtolower( trim( $matches[1] ) );
				}
			}
		} else {
			// Associative array (like {layers: "all"})
			foreach ( [ 'layers', 'layer' ] as $key ) {
				if ( isset( $node[$key] ) && is_string( $node[$key] ) ) {
					return strtolower( trim( (string)$node[$key] ) );
				}
			}
		}

		return null;
	}

	/**
	 * Extract layers parameter from link attributes
	 *
	 * @param array $linkAttribs Link attributes array
	 * @return string|null The layers flag value, or null if not found
	 */
	public function extractFromLinkAttribs( array $linkAttribs ): ?string {
		if ( isset( $linkAttribs['href'] ) ) {
			return $this->extractFromHref( (string)$linkAttribs['href'] );
		}
		return null;
	}

	/**
	 * Extract layers JSON data from handler params
	 *
	 * @param array $handlerParams Handler parameters
	 * @return array|null Layer data with 'layers', 'backgroundVisible', 'backgroundOpacity', or null if not found
	 */
	public function extractLayersJson( array $handlerParams ): ?array {
		if ( isset( $handlerParams['layersjson'] ) && is_string( $handlerParams['layersjson'] ) ) {
			try {
				$decoded = json_decode( $handlerParams['layersjson'], true, 512, JSON_THROW_ON_ERROR );
				if ( is_array( $decoded ) ) {
					// Handle both direct arrays and wrapped {layers: [...], backgroundVisible, backgroundOpacity} format
					if ( isset( $decoded['layers'] ) && is_array( $decoded['layers'] ) ) {
						return [
							'layers' => $decoded['layers'],
							'backgroundVisible' => $decoded['backgroundVisible'] ?? true,
							'backgroundOpacity' => $decoded['backgroundOpacity'] ?? 1.0
						];
					}
					// Old format: raw layers array
					return [
						'layers' => $decoded,
						'backgroundVisible' => true,
						'backgroundOpacity' => 1.0
					];
				}
			} catch ( \JsonException $e ) {
				// Invalid JSON, continue to fallback
			}
		}

		if ( isset( $handlerParams['layerData'] ) && is_array( $handlerParams['layerData'] ) ) {
			$data = $handlerParams['layerData'];
			// Handle both direct arrays and wrapped format
			if ( isset( $data['layers'] ) && is_array( $data['layers'] ) ) {
				return [
					'layers' => $data['layers'],
					'backgroundVisible' => $data['backgroundVisible'] ?? true,
					'backgroundOpacity' => $data['backgroundOpacity'] ?? 1.0
				];
			}
			// Old format: raw layers array
			return [
				'layers' => $data,
				'backgroundVisible' => true,
				'backgroundOpacity' => 1.0
			];
		}

		return null;
	}

	/**
	 * Check if the layers flag indicates layers should be disabled
	 *
	 * @param string|null $flag The layers flag value
	 * @return bool True if layers should be disabled
	 */
	public function isDisabled( ?string $flag ): bool {
		if ( $flag === null ) {
			return false;
		}
		return in_array( $flag, self::DISABLED_VALUES, true );
	}

	/**
	 * Check if the layers flag indicates enabled with default behavior
	 *
	 * @param string|null $flag The layers flag value
	 * @return bool True if layers should use default behavior
	 */
	public function isDefaultEnabled( ?string $flag ): bool {
		if ( $flag === null ) {
			return false;
		}
		return in_array( $flag, self::ENABLED_VALUES, true );
	}

	/**
	 * Check if the layers flag indicates a specific named set
	 *
	 * @param string|null $flag The layers flag value
	 * @return bool True if this is a named set identifier
	 */
	public function isNamedSet( ?string $flag ): bool {
		if ( $flag === null ) {
			return false;
		}
		return !$this->isDisabled( $flag ) && !$this->isDefaultEnabled( $flag );
	}

	/**
	 * Get the set name from a layers flag
	 *
	 * @param string|null $flag The layers flag value
	 * @return string|null The set name, or null for default/disabled
	 */
	public function getSetName( ?string $flag ): ?string {
		if ( $this->isNamedSet( $flag ) ) {
			return $flag;
		}
		return null;
	}

	/**
	 * Extract layers parameter from all available sources
	 *
	 * This is a convenience method that tries all extraction methods in order.
	 *
	 * @param array $handlerParams Handler parameters
	 * @param array $frameParams Frame parameters
	 * @param array $linkAttribs Link attributes
	 * @param string|null $html HTML string (for data-mw extraction)
	 * @return string|null The layers flag value, or null if not found anywhere
	 */
	public function extractFromAll(
		array $handlerParams = [],
		array $frameParams = [],
		array $linkAttribs = [],
		?string $html = null
	): ?string {
		// 1. Try handler/frame params
		$flag = $this->extractFromParams( $handlerParams, $frameParams );
		if ( $flag !== null ) {
			return $flag;
		}

		// 2. Try link URL
		$flag = $this->extractFromLinkAttribs( $linkAttribs );
		if ( $flag !== null ) {
			return $flag;
		}

		// 3. Try frame params link-url
		if ( isset( $frameParams['link-url'] ) ) {
			$flag = $this->extractFromHref( (string)$frameParams['link-url'] );
			if ( $flag !== null ) {
				return $flag;
			}
		}

		// 4. Try data-mw
		if ( $html !== null && strpos( $html, 'data-mw=' ) !== false ) {
			return $this->extractFromDataMw( $html );
		}

		return null;
	}
}
