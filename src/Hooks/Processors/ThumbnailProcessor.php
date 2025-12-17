<?php

namespace MediaWiki\Extension\Layers\Hooks\Processors;

use RequestContext;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Logging\LoggerAwareTrait;
use MediaWiki\MediaWikiServices;

/**
 * Handles thumbnail-related layer injection logic.
 *
 * Extracted from WikitextHooks to centralize thumbnail processing
 * for the ThumbnailBeforeProduceHTML hook and related operations.
 */
class ThumbnailProcessor {
	use LoggerAwareTrait;

	/**
	 * @var LayersParamExtractor
	 */
	private LayersParamExtractor $paramExtractor;

	/**
	 * Track if page has layers (propagated back to WikitextHooks)
	 * @var bool
	 */
	private bool $pageHasLayers = false;

	/**
	 * @param LayersParamExtractor $paramExtractor
	 */
	public function __construct( LayersParamExtractor $paramExtractor ) {
		$this->paramExtractor = $paramExtractor;
	}

	/**
	 * Check if page has layers flag set during processing
	 *
	 * @return bool
	 */
	public function pageHasLayers(): bool {
		return $this->pageHasLayers;
	}

	/**
	 * Reset the page has layers flag
	 */
	public function resetPageHasLayers(): void {
		$this->pageHasLayers = false;
	}

	/**
	 * Process ThumbnailBeforeProduceHTML hook.
	 * Adds layer data attributes to thumbnails for client-side rendering.
	 *
	 * @param mixed $thumbnail The thumbnail object
	 * @param array &$attribs Image attributes (modified by reference)
	 * @param array &$linkAttribs Link attributes
	 * @param callable|null $getFileSetName Callback to get file set name from WikitextHooks queue
	 * @return bool
	 */
	public function processThumbnail(
		$thumbnail,
		array &$attribs,
		array &$linkAttribs,
		?callable $getFileSetName = null
	): bool {
		$fileName = ( method_exists( $thumbnail, 'getFile' ) && $thumbnail->getFile() )
			? $thumbnail->getFile()->getName()
			: 'unknown';
		$this->log( "ThumbnailBeforeProduceHTML for: $fileName" );

		// Extract layer data and flag from transform params
		[ $layerData, $layersFlag ] = $this->extractLayerDataFromThumbnail( $thumbnail );

		// Try to get layers flag from link href if not in params
		if ( $layersFlag === null && isset( $linkAttribs['href'] ) ) {
			$layersFlag = $this->paramExtractor->extractFromHref( (string)$linkAttribs['href'] );
		}

		$this->log( "layersFlag=$layersFlag, hasData=" . ( $layerData !== null ? 'yes' : 'no' ) );

		// Respect explicit disable
		if ( $layersFlag === 'off' || $layersFlag === 'none' || $layersFlag === false ) {
			$this->log( 'Layers explicitly disabled' );
			return true;
		}

		// Try to fetch from DB if no data yet
		if ( $layerData === null && method_exists( $thumbnail, 'getFile' ) ) {
			$layerData = $this->fetchLayerDataForThumbnail(
				$thumbnail,
				$layersFlag,
				$linkAttribs,
				$getFileSetName
			);
		}

		// Inject layer data into attributes
		$this->injectThumbnailLayerData( $attribs, $layerData, $layersFlag, $thumbnail );

		return true;
	}

	/**
	 * Extract layer data and flag from thumbnail transform params.
	 *
	 * @param mixed $thumbnail
	 * @return array [ ?array $layerData, ?string $layersFlag ]
	 */
	private function extractLayerDataFromThumbnail( $thumbnail ): array {
		$layerData = null;
		$layersFlag = null;

		if ( !method_exists( $thumbnail, 'getParams' ) ) {
			return [ null, null ];
		}

		$params = $thumbnail->getParams();

		// Check layersjson param (JSON string)
		if ( isset( $params['layersjson'] ) && is_string( $params['layersjson'] ) ) {
			try {
				$decoded = json_decode( $params['layersjson'], true, 512, JSON_THROW_ON_ERROR );
				if ( is_array( $decoded ) ) {
					$layerData = isset( $decoded['layers'] ) && is_array( $decoded['layers'] )
						? $decoded['layers']
						: $decoded;
				}
			} catch ( \JsonException $e ) {
				// Invalid JSON, continue to fallback
			}
		}

		// Fallback to layerData param
		if ( $layerData === null && isset( $params['layerData'] ) ) {
			$layerData = $params['layerData'];
			$this->log( 'Found layer data in transform params' );
		}

		// Get layers flag
		if ( array_key_exists( 'layers', $params ) ) {
			$layersFlag = $params['layers'];
		} elseif ( array_key_exists( 'layer', $params ) ) {
			$layersFlag = $params['layer'];
		}

		// Normalize flag
		if ( is_string( $layersFlag ) ) {
			$layersFlag = strtolower( trim( $layersFlag ) );
		}

		return [ $layerData, $layersFlag ];
	}

	/**
	 * Fetch layer data from database for a thumbnail.
	 *
	 * @param mixed $thumbnail
	 * @param string|null &$layersFlag Modified if wikitext queue has set name
	 * @param array $linkAttribs
	 * @param callable|null $getFileSetName Callback to get file set name from WikitextHooks queue
	 * @return array|null
	 */
	private function fetchLayerDataForThumbnail(
		$thumbnail,
		?string &$layersFlag,
		array $linkAttribs,
		?callable $getFileSetName = null
	): ?array {
		$file = $thumbnail->getFile();
		if ( !$file ) {
			return null;
		}

		$filename = $file->getName();
		$shouldFallback = false;

		// Check wikitext preprocessing queue via callback
		if ( $getFileSetName !== null ) {
			$storedSetName = $getFileSetName( $filename );
			if ( $storedSetName !== null ) {
				if ( in_array( $storedSetName, [ 'off', 'none', 'false' ], true ) ) {
					$this->log( "Layers disabled via wikitext for $filename" );
					return null;
				}
				$shouldFallback = true;
				$layersFlag = $storedSetName;
				$this->log( "Using wikitext set name: $storedSetName for $filename" );
			}
		}

		// Check if flag indicates layers should show
		if ( !$shouldFallback && $layersFlag !== null && !in_array( $layersFlag, [ 'off', 'none' ], true ) ) {
			$shouldFallback = true;
		}

		// Check href for layers param
		if ( !$shouldFallback && isset( $linkAttribs['href'] ) ) {
			$hrefParam = $this->paramExtractor->extractFromHref( (string)$linkAttribs['href'] );
			if ( $hrefParam !== null && !in_array( $hrefParam, [ 'off', 'none' ], true ) ) {
				$shouldFallback = true;
				$layersFlag = $hrefParam;
			}
		}

		// Enable for editlayers action
		if ( !$shouldFallback && $this->isEditLayersAction() ) {
			$shouldFallback = true;
			$this->log( 'Enabling fallback for action=editlayers' );
		}

		if ( !$shouldFallback ) {
			return null;
		}

		// Fetch from database
		return $this->fetchLayersFromDatabase( $file, $layersFlag );
	}

	/**
	 * Fetch layers from database for a file
	 *
	 * @param mixed $file File object
	 * @param string|null $layersFlag Layer set identifier
	 * @return array|null
	 */
	private function fetchLayersFromDatabase( $file, ?string $layersFlag ): ?array {
		try {
			$db = $this->getLayersDatabase();
			if ( !$db ) {
				throw new \Exception( 'LayersDatabase service unavailable' );
			}

			$filename = $file->getName();
			$isDefaultSet = $layersFlag === null || in_array( $layersFlag, [ 'on', 'all', 'true' ], true );
			$layerSet = $isDefaultSet
				? $db->getLatestLayerSet( $filename, $file->getSha1() )
				: $db->getLayerSetByName( $filename, $file->getSha1(), $layersFlag );

			if ( $layerSet && isset( $layerSet['data']['layers'] ) && is_array( $layerSet['data']['layers'] ) ) {
				$layers = $layerSet['data']['layers'];
				$this->log( sprintf( 'DB fallback: %d layers (set: %s)', count( $layers ), $layersFlag ?? 'default' ) );
				return $layers;
			}
		} catch ( \Throwable $e ) {
			$logger = $this->getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: Error retrieving layer data', [ 'exception' => $e ] );
			}
		}

		return null;
	}

	/**
	 * Inject layer data into thumbnail attributes.
	 *
	 * @param array &$attribs
	 * @param array|null $layerData
	 * @param string|null $layersFlag
	 * @param mixed $thumbnail
	 */
	private function injectThumbnailLayerData(
		array &$attribs,
		?array $layerData,
		?string $layersFlag,
		$thumbnail
	): void {
		// Always add instance marker
		$instanceId = 'layers-' . substr( md5( uniqid( (string)mt_rand(), true ) ), 0, 8 );
		$attribs['data-layers-instance'] = $instanceId;

		if ( $layerData !== null ) {
			$this->pageHasLayers = true;

			// Get base dimensions for scaling
			$file = method_exists( $thumbnail, 'getFile' ) ? $thumbnail->getFile() : null;
			$payload = [ 'layers' => $layerData ];
			if ( $file && method_exists( $file, 'getWidth' ) && method_exists( $file, 'getHeight' ) ) {
				$payload['baseWidth'] = (int)$file->getWidth();
				$payload['baseHeight'] = (int)$file->getHeight();
			}

			$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
			$attribs['data-layer-data'] = json_encode( $payload );

			$this->log( sprintf( 'Added %d layers, instance: %s', count( $layerData ), $instanceId ) );
		} else {
			$this->log( "No layer data, instance: $instanceId" );

			// Mark intent for client-side API fetch
			if ( in_array( $layersFlag, [ 'on', 'all', true ], true ) ) {
				$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
				$attribs['data-layers-intent'] = 'on';
			}
		}
	}

	/**
	 * Detect whether the active action is the editlayers view.
	 *
	 * @return bool
	 */
	private function isEditLayersAction(): bool {
		try {
			$context = RequestContext::getMain();
			$request = $context ? $context->getRequest() : null;
			$action = $request ? $request->getVal( 'action', '' ) : '';
			return $action === 'editlayers';
		} catch ( \Throwable $e ) {
			return false;
		}
	}

	/**
	 * Get the LayersDatabase service
	 *
	 * @return LayersDatabase|null
	 */
	private function getLayersDatabase(): ?LayersDatabase {
		try {
			return MediaWikiServices::getInstance()->getService( 'LayersDatabase' );
		} catch ( \Throwable $e ) {
			$logger = $this->getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: Unable to resolve LayersDatabase service', [ 'exception' => $e ] );
			}
			return null;
		}
	}
}
