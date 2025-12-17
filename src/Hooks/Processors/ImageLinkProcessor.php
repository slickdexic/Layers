<?php
/**
 * Layers Image Link Processor
 *
 * Centralized processor for image link hooks, eliminating duplication
 * across onMakeImageLink2, onLinkerMakeImageLink, and onLinkerMakeMediaLinkFile.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks\Processors;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Logging\LoggerAwareTrait;
use MediaWiki\MediaWikiServices;

/**
 * Processes image links to inject layer data attributes.
 *
 * This class consolidates the common logic from multiple MediaWiki hooks
 * that render image links, reducing code duplication in WikitextHooks.php.
 *
 * Supported hooks:
 * - MakeImageLink2 (legacy path)
 * - LinkerMakeImageLink (MW 1.44+)
 * - LinkerMakeMediaLinkFile (media link path)
 */
class ImageLinkProcessor {
	use LoggerAwareTrait;

	/** @var LayersHtmlInjector */
	private LayersHtmlInjector $htmlInjector;

	/** @var LayersParamExtractor */
	private LayersParamExtractor $paramExtractor;

	/**
	 * @var LayersDatabase|null
	 */
	private $database = null;

	/**
	 * Track if any image on the current page has layers enabled
	 * @var bool
	 */
	private bool $pageHasLayers = false;

	/**
	 * @param LayersHtmlInjector $htmlInjector
	 * @param LayersParamExtractor $paramExtractor
	 */
	public function __construct(
		LayersHtmlInjector $htmlInjector,
		LayersParamExtractor $paramExtractor
	) {
		$this->htmlInjector = $htmlInjector;
		$this->paramExtractor = $paramExtractor;
	}

	/**
	 * Get database service instance (lazy initialization)
	 *
	 * @return LayersDatabase|null
	 */
	private function getDatabase(): ?LayersDatabase {
		if ( $this->database === null ) {
			try {
				$services = MediaWikiServices::getInstance();
				$this->database = $services->get( 'LayersDatabase' );
			} catch ( \Throwable $e ) {
				$this->logWarning( 'Database service unavailable', [ 'exception' => $e ] );
				return null;
			}
		}
		return $this->database;
	}

	/**
	 * Check if any image on the page has layers enabled
	 *
	 * @return bool
	 */
	public function pageHasLayers(): bool {
		return $this->pageHasLayers;
	}

	/**
	 * Process an image link for layer data injection.
	 * This is the core method used by all image link hooks.
	 *
	 * @param mixed $file The File object (or null if not available)
	 * @param array $handlerParams Handler parameters from the hook
	 * @param array $frameParams Frame parameters from the hook
	 * @param string &$res The HTML result to modify
	 * @param string|null $setNameFromQueue Optional set name from wikitext queue
	 * @param string $context Hook context for logging
	 * @return bool True to continue hook processing
	 */
	public function processImageLink(
		$file,
		array $handlerParams,
		array $frameParams,
		string &$res,
		?string $setNameFromQueue = null,
		string $context = 'ImageLink'
	): bool {
		try {
			// Extract layers flag from all available sources
			$layersFlag = $this->paramExtractor->extractFromAll(
				$handlerParams,
				$frameParams,
				[],
				$res
			);

			// Respect explicit off/none
			if ( $this->paramExtractor->isDisabled( $layersFlag ) ) {
				return true;
			}

			// Check for direct JSON layer data in params
			$layersArray = $this->paramExtractor->extractLayersJson( $handlerParams );

			// Enable layers if we have a valid parameter or direct JSON
			if ( $file && ( $layersFlag !== null || $layersArray !== null ) ) {
				if ( $layersArray === null ) {
					// No direct JSON - fetch from database
					$setName = $this->paramExtractor->getSetName( $layersFlag );
					if ( $setName === null && $setNameFromQueue !== null ) {
						$setName = $setNameFromQueue;
					}

					$res = $this->injectLayersFromDatabase(
						$res,
						$file,
						$setName,
						$context
					);
				} else {
					// Direct injection with provided layer data
					$res = $this->injectLayersDirect(
						$res,
						$file,
						$layersArray,
						$context . '-direct'
					);
				}

				// If no layers were found but intent was explicit, add intent marker
				if ( strpos( $res, 'data-layer-data=' ) === false && $layersFlag !== null ) {
					$res = $this->htmlInjector->injectIntentMarker( $res );
				}
			}
		} catch ( \Throwable $e ) {
			$this->logError( "$context error", [ 'exception' => $e ] );
		}

		return true;
	}

	/**
	 * Process a media link for layer data injection.
	 * Handles the LinkerMakeMediaLinkFile hook specifically.
	 *
	 * @param mixed $file The File object
	 * @param string &$res The HTML result to modify
	 * @param array &$attribs Image attributes (modified by reference)
	 * @return bool True to continue hook processing
	 */
	public function processMediaLink( $file, string &$res, array &$attribs ): bool {
		try {
			if ( !$file ) {
				return true;
			}

			// Extract layers param from result HTML or attributes
			$param = $this->extractLayersParamFromMediaLink( $res, $attribs );
			if ( $param === null ) {
				return true;
			}

			// Respect explicit off/none
			if ( $this->paramExtractor->isDisabled( $param ) ) {
				return true;
			}

			// Resolve layer data based on the param value
			$layersArray = $this->resolveLayerSetFromParam( $file, $param );

			if ( $layersArray !== null ) {
				// Use injector for HTML modification
				$dimensions = $this->htmlInjector->getFileDimensions( $file );
				$res = $this->htmlInjector->injectIntoHtml(
					$res,
					$layersArray,
					$dimensions['width'],
					$dimensions['height'],
					'LinkerMakeMediaLinkFile'
				);

				// Also set attributes via reference array for core-generated markup paths
				if ( is_array( $attribs ) ) {
					$this->htmlInjector->injectIntoAttributes(
						$attribs,
						$layersArray,
						$dimensions['width'],
						$dimensions['height']
					);
				}

				$this->pageHasLayers = true;
			} else {
				// No inline data, but explicit param detected: mark for client API fallback
				if ( is_array( $attribs ) ) {
					$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
					$attribs['data-layers-intent'] = 'on';
				}
				$res = $this->htmlInjector->injectIntentMarker( $res );
			}
		} catch ( \Throwable $e ) {
			$this->logError( 'LinkerMakeMediaLinkFile error', [ 'exception' => $e ] );
		}

		return true;
	}

	/**
	 * Inject layers from database into HTML
	 *
	 * @param string $html The HTML to modify
	 * @param mixed $file The File object
	 * @param string|null $setName The layer set name to load
	 * @param string $context Logging context
	 * @return string Modified HTML
	 */
	private function injectLayersFromDatabase(
		string $html,
		$file,
		?string $setName,
		string $context
	): string {
		$db = $this->getDatabase();
		if ( !$db ) {
			return $html;
		}

		$filename = $file->getName();
		$sha1 = $file->getSha1();

		// Get the layer set from database
		// Use getLatestLayerSet with optional setName filter
		$layerSet = null;
		if ( $setName !== null && $setName !== '' && $setName !== 'default' ) {
			$layerSet = $db->getLatestLayerSet( $filename, $sha1, $setName );
		} else {
			$layerSet = $db->getLatestLayerSet( $filename, $sha1 );
		}

		if ( !$layerSet ) {
			return $html;
		}

		// Extract layers array from the set
		$layersArray = $this->extractLayersFromSet( $layerSet );
		if ( $layersArray === null || empty( $layersArray ) ) {
			return $html;
		}

		// Use injector for HTML modification
		$dimensions = $this->htmlInjector->getFileDimensions( $file );
		$result = $this->htmlInjector->injectIntoHtml(
			$html,
			$layersArray,
			$dimensions['width'],
			$dimensions['height'],
			$context
		);

		$this->pageHasLayers = true;
		return $result;
	}

	/**
	 * Inject layers directly from provided array
	 *
	 * @param string $html The HTML to modify
	 * @param mixed $file The File object
	 * @param array $layersArray The layers to inject
	 * @param string $context Logging context
	 * @return string Modified HTML
	 */
	private function injectLayersDirect(
		string $html,
		$file,
		array $layersArray,
		string $context
	): string {
		$dimensions = $this->htmlInjector->getFileDimensions( $file );
		$result = $this->htmlInjector->injectIntoHtml(
			$html,
			$layersArray,
			$dimensions['width'],
			$dimensions['height'],
			$context
		);

		$this->pageHasLayers = true;
		return $result;
	}

	/**
	 * Extract layers parameter from media link HTML or attributes
	 *
	 * @param string $html The HTML string
	 * @param array $attribs The attributes array
	 * @return string|null The normalized param value, or null if not found
	 */
	private function extractLayersParamFromMediaLink( string $html, array $attribs ): ?string {
		$param = null;

		// Try to extract layers=<...> from result HTML first
		if ( preg_match( '/(?:[\?&#]|\|)layers=([^\s"\'<>|&#]+)/i', $html, $m ) ) {
			$param = $m[1];
		}

		// Try attributes next
		if ( $param === null && is_array( $attribs ) ) {
			foreach ( [ 'href', 'data-mw-href' ] as $k ) {
				if (
					isset( $attribs[$k] ) && preg_match(
						'/(?:[\?&#]|\|)layers=([^\s"\'<>|&#]+)/i',
						(string)$attribs[$k],
						$mm
					)
				) {
					$param = $mm[1];
					break;
				}
			}
		}

		if ( $param === null ) {
			return null;
		}

		return strtolower( trim( urldecode( $param ) ) );
	}

	/**
	 * Resolve layer set data from a layers parameter value
	 * Supports: 'on', 'all', 'id:123', 'name:setname', 'abc1,def2' (short IDs), or named set
	 *
	 * @param mixed $file The File object
	 * @param string $param The normalized layers parameter value
	 * @return array|null The layers array, or null if not found
	 */
	private function resolveLayerSetFromParam( $file, string $param ): ?array {
		$db = $this->getDatabase();
		if ( !$db ) {
			return null;
		}

		$filename = $file->getName();
		$sha1 = $file->getSha1();

		// 'on' or 'all' => show default set
		if ( $param === 'on' || $param === 'all' ) {
			$latest = $db->getLatestLayerSet( $filename, $sha1 );
			return $this->extractLayersFromSet( $latest );
		}

		// 'id:123' => specific set by ID
		if ( preg_match( '/^id:(\d+)$/', $param, $idM ) ) {
			$ls = $db->getLayerSet( (int)$idM[1] );
			return $this->extractLayersFromSet( $ls );
		}

		// 'name:setname' => specific named set
		if ( preg_match( '/^name:(.+)$/', $param, $nameM ) ) {
			$ls = $db->getLatestLayerSet( $filename, $sha1, $nameM[1] );
			return $this->extractLayersFromSet( $ls );
		}

		// Short IDs like 'abc1,def2' => filter layers by short ID
		if ( preg_match( '/^[a-z0-9,]+$/i', $param ) && strpos( $param, ',' ) !== false ) {
			$shortIds = array_map( 'trim', explode( ',', $param ) );
			$latest = $db->getLatestLayerSet( $filename, $sha1 );
			$allLayers = $this->extractLayersFromSet( $latest );
			if ( $allLayers === null ) {
				return null;
			}
			return array_values( array_filter(
				$allLayers,
				static function ( $layer ) use ( $shortIds ) {
					if ( !isset( $layer['id'] ) ) {
						return false;
					}
					$lid = (string)$layer['id'];
					foreach ( $shortIds as $sid ) {
						if ( str_ends_with( $lid, $sid ) ) {
							return true;
						}
					}
					return false;
				}
			) );
		}

		// Plain string => treat as named set
		$ls = $db->getLatestLayerSet( $filename, $sha1, $param );
		return $this->extractLayersFromSet( $ls );
	}

	/**
	 * Extract layers array from a layer set object
	 *
	 * @param mixed $layerSet The layer set object from database
	 * @return array|null The layers array, or null if invalid
	 */
	private function extractLayersFromSet( $layerSet ): ?array {
		if ( !$layerSet ) {
			return null;
		}

		$data = $layerSet->ls_data ?? $layerSet['ls_data'] ?? null;
		if ( !$data ) {
			return null;
		}

		// Parse JSON if string
		if ( is_string( $data ) ) {
			try {
				$data = json_decode( $data, true, 512, JSON_THROW_ON_ERROR );
			} catch ( \JsonException $e ) {
				return null;
			}
		}

		// Extract layers array
		if ( isset( $data['layers'] ) && is_array( $data['layers'] ) ) {
			return $data['layers'];
		}

		// Direct array of layers
		if ( is_array( $data ) && isset( $data[0] ) ) {
			return $data;
		}

		return null;
	}
}
