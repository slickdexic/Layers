<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks\Processors;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Logging\LoggerAwareTrait;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

/**
 * Handles thumbnail-related layer injection logic.
 *
 * Extracted from WikitextHooks to centralize thumbnail processing
 * for the ThumbnailBeforeProduceHTML hook and related operations.
 */
class ThumbnailProcessor {
	use LoggerAwareTrait;

	/**
	 * Maximum recursion depth for JSON decoding to prevent stack overflow
	 */
	private const JSON_DECODE_MAX_DEPTH = 512;

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
	 * @param array &$linkAttribs Link attributes (modified by reference for layerslink)
	 * @param string|null $setNameFromQueue Set name from wikitext queue
	 * @param string|null $linkTypeFromQueue Link type from wikitext queue (editor, viewer, lightbox)
	 * @return bool
	 */
	public function processThumbnail(
		$thumbnail,
		array &$attribs,
		array &$linkAttribs,
		?string $setNameFromQueue = null,
		?string $linkTypeFromQueue = null
	): bool {
		$file = ( $thumbnail !== null && method_exists( $thumbnail, 'getFile' ) )
			? $thumbnail->getFile() : null;
		$fileName = $file ? $file->getName() : 'unknown';
		$isForeign = $file && $this->isForeignFile( $file );
		$this->log( "ThumbnailBeforeProduceHTML for: $fileName (foreign=" . ( $isForeign ? 'yes' : 'no' ) . ")" );
		$this->log(
			"linkTypeFromQueue=" . ( $linkTypeFromQueue ?? 'null' ) .
			", setNameFromQueue=" . ( $setNameFromQueue ?? 'null' )
		);

		// Extract layer data and flag from transform params
		[ $layerData, $layersFlag ] = $this->extractLayerDataFromThumbnail( $thumbnail );

		// Use set name from queue if not in params
		if ( $layersFlag === null && $setNameFromQueue !== null ) {
			$layersFlag = $setNameFromQueue;
			$this->log( "Using set name from queue: $setNameFromQueue" );
		}

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
		if ( $layerData === null && $thumbnail !== null && method_exists( $thumbnail, 'getFile' ) ) {
			$layerData = $this->fetchLayerDataForThumbnailDirect(
				$thumbnail,
				$layersFlag,
				$linkAttribs
			);
		}

		// Inject layer data into attributes
		$this->injectThumbnailLayerData( $attribs, $layerData, $layersFlag, $thumbnail );

		// Apply layerslink deep linking if specified
		if ( $linkTypeFromQueue !== null && $thumbnail !== null && method_exists( $thumbnail, 'getFile' ) ) {
			$file = $thumbnail->getFile();
			if ( $file ) {
				$this->applyLayersLink( $linkAttribs, $attribs, $file, $linkTypeFromQueue, $layersFlag );
			}
		}

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

		if ( $thumbnail === null || !method_exists( $thumbnail, 'getParams' ) ) {
			return [ null, null ];
		}

		$params = $thumbnail->getParams();

		// Check layersjson param (JSON string)
		if ( isset( $params['layersjson'] ) && is_string( $params['layersjson'] ) ) {
			try {
				$decoded = json_decode( $params['layersjson'], true, self::JSON_DECODE_MAX_DEPTH, JSON_THROW_ON_ERROR );
				if ( is_array( $decoded ) ) {
					// Preserve full structure with background settings if available
					if ( isset( $decoded['layers'] ) && is_array( $decoded['layers'] ) ) {
						$layerData = [
							'layers' => $decoded['layers'],
							'backgroundVisible' => $decoded['backgroundVisible'] ?? true,
							'backgroundOpacity' => $decoded['backgroundOpacity'] ?? 1.0
						];
					} else {
						// Raw layers array
						$layerData = [
							'layers' => $decoded,
							'backgroundVisible' => true,
							'backgroundOpacity' => 1.0
						];
					}
				}
			} catch ( \JsonException $e ) {
				// Invalid JSON, continue to fallback
			}
		}

		// Fallback to layerData param
		if ( $layerData === null && isset( $params['layerData'] ) ) {
			$raw = $params['layerData'];
			// Handle both array and object formats
			if ( isset( $raw['layers'] ) && is_array( $raw['layers'] ) ) {
				$layerData = [
					'layers' => $raw['layers'],
					'backgroundVisible' => $raw['backgroundVisible'] ?? true,
					'backgroundOpacity' => $raw['backgroundOpacity'] ?? 1.0
				];
			} elseif ( is_array( $raw ) ) {
				$layerData = [
					'layers' => $raw,
					'backgroundVisible' => true,
					'backgroundOpacity' => 1.0
				];
			}
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
	 * @return array|null Layer data with 'layers', 'backgroundVisible', 'backgroundOpacity',
	 *                    'revision', 'setName' for freshness checking
	 */
	private function fetchLayersFromDatabase( $file, ?string $layersFlag ): ?array {
		try {
			$db = $this->getLayersDatabase();
			if ( !$db ) {
				throw new \Exception( 'LayersDatabase service unavailable' );
			}

			$filename = $file->getName();
			$sha1 = $file->getSha1();

			// For foreign files without SHA1, use fallback identifier
			if ( empty( $sha1 ) && $this->isForeignFile( $file ) ) {
				$sha1 = 'foreign_' . sha1( $filename );
				$this->log( "Using fallback SHA1 for foreign file: $filename" );
			}

			$isDefaultSet = $layersFlag === null || in_array( $layersFlag, [ 'on', 'all', 'true' ], true );
			$this->log( sprintf(
				'fetchLayersFromDatabase: filename=%s, layersFlag=%s, isDefaultSet=%s',
				$filename,
				$layersFlag ?? 'null',
				$isDefaultSet ? 'true' : 'false'
			) );

			$layerSet = $isDefaultSet
				? $db->getLatestLayerSet( $filename, $sha1 )
				: $db->getLayerSetByName( $filename, $sha1, $layersFlag );

			$this->log( 'fetchLayersFromDatabase: layerSet returned = ' . ( $layerSet ? 'yes' : 'no' ) );

			if ( $layerSet && isset( $layerSet['data']['layers'] ) && is_array( $layerSet['data']['layers'] ) ) {
				$data = $layerSet['data'];
				$layers = $data['layers'];
				$setLabel = $layersFlag ?? LayersConstants::DEFAULT_SET_NAME;
				$this->log( sprintf( 'DB fallback: %d layers (set: %s)', count( $layers ), $setLabel ) );
				return [
					'layers' => $layers,
					'backgroundVisible' => $data['backgroundVisible'] ?? true,
					'backgroundOpacity' => $data['backgroundOpacity'] ?? 1.0,
					// Include revision and set name for client-side freshness checking (FR-10)
					'revision' => $layerSet['revision'] ?? null,
					'setName' => $layerSet['name'] ?? $layerSet['setName'] ?? LayersConstants::DEFAULT_SET_NAME
				];
			} else {
				$this->log( 'fetchLayersFromDatabase: layerSet has no valid layers array' );
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
	 * @param array|null $layerData Layer data (array with 'layers' key or raw layers array)
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

		// Get file reference for base dimensions and filename lookup
		$file = ( $thumbnail !== null && method_exists( $thumbnail, 'getFile' ) )
			? $thumbnail->getFile() : null;

		if ( $layerData !== null ) {
			$this->pageHasLayers = true;

			// Normalize layer data format - handle both old (raw array) and new (object) formats
			if ( isset( $layerData['layers'] ) && is_array( $layerData['layers'] ) ) {
				// New format: { layers: [...], backgroundVisible, backgroundOpacity }
				$layers = $layerData['layers'];
				$backgroundVisible = $layerData['backgroundVisible'] ?? true;
				$backgroundOpacity = $layerData['backgroundOpacity'] ?? 1.0;
				// Extract revision and setName for freshness checking (FR-10)
				$revision = $layerData['revision'] ?? null;
				$setName = $layerData['setName'] ?? LayersConstants::DEFAULT_SET_NAME;
			} else {
				// Old format: raw layers array
				$layers = $layerData;
				$backgroundVisible = true;
				$backgroundOpacity = 1.0;
				$revision = null;
				$setName = LayersConstants::DEFAULT_SET_NAME;
			}

			$payload = [
				'layers' => $layers,
				'backgroundVisible' => $backgroundVisible,
				'backgroundOpacity' => $backgroundOpacity
			];

			if ( $file ) {
				$payload['baseWidth'] = (int)$file->getWidth();
				$payload['baseHeight'] = (int)$file->getHeight();
			}

			$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );

			try {
				$jsonData = json_encode( $payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE );
			} catch ( \JsonException $e ) {
				$this->log( 'Failed to encode layer data as JSON: ' . $e->getMessage() );
				// Fall back to API-based loading
				$attribs['data-layers-intent'] = $layersFlag ?? 'on';
				if ( $file && method_exists( $file, 'getName' ) ) {
					$attribs['data-file-name'] = $file->getName();
				}
				return;
			}

			// Check if JSON is too large for inline embedding (>100KB may cause browser issues)
			$jsonSize = strlen( $jsonData );
			if ( $jsonSize > 100000 ) {
				// For large payloads, use intent marker for client-side API fallback
				$this->log( sprintf(
					'JSON too large for inline (%d bytes), using API fallback for instance: %s',
					$jsonSize,
					$instanceId
				) );
				$attribs['data-layers-intent'] = $layersFlag ?? 'on';
				$attribs['data-layers-large'] = '1';
				// Add filename for API lookup
				if ( $file && method_exists( $file, 'getName' ) ) {
					$attribs['data-file-name'] = $file->getName();
				}
			} else {
				$attribs['data-layer-data'] = $jsonData;
			}

			// Add revision and set name for client-side freshness checking (FR-10)
			// This allows the viewer to detect stale inline data and fetch fresh data via API
			if ( $revision !== null ) {
				$attribs['data-layer-revision'] = (string)$revision;
			}
			if ( $setName !== null && $setName !== '' ) {
				$attribs['data-layer-setname'] = $setName;
			}
			// Add filename for API lookup in freshness checks
			if ( $file && method_exists( $file, 'getName' ) ) {
				$attribs['data-file-name'] = $file->getName();
			}

			$msg = 'Added %d layers, instance: %s, JSON size: %d bytes, revision: %s';
			$this->log( sprintf( $msg, count( $layers ), $instanceId, $jsonSize, $revision ?? 'null' ) );
		} else {
			$this->log( "No layer data, instance: $instanceId, layersFlag: " . ( $layersFlag ?? 'null' ) );

			// Mark intent for client-side API fetch
			// Include named sets (any non-null, non-empty, non-disabled value)
			$disabledValues = [ 'off', 'none', 'false', '0' ];
			$shouldAddIntent = $layersFlag !== null
				&& $layersFlag !== ''
				&& !in_array( strtolower( $layersFlag ), $disabledValues, true );

			if ( $shouldAddIntent ) {
				$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
				// Use the actual set name for named sets, 'on' for generic enable
				$intentValue = in_array( $layersFlag, [ 'on', 'all', 'true', true ], true ) ? 'on' : $layersFlag;
				$attribs['data-layers-intent'] = $intentValue;
				$this->log( "Set data-layers-intent: $intentValue" );
				// Also add filename for API lookup (needed by JS viewers)
				if ( $file && method_exists( $file, 'getName' ) ) {
					$attribs['data-file-name'] = $file->getName();
				}
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

	/**
	 * Fetch layer data from database for a thumbnail (direct version without callback).
	 *
	 * @param mixed $thumbnail
	 * @param string|null $layersFlag
	 * @param array $linkAttribs
	 * @return array|null
	 */
	private function fetchLayerDataForThumbnailDirect(
		$thumbnail,
		?string $layersFlag,
		array $linkAttribs
	): ?array {
		$file = $thumbnail->getFile();
		if ( !$file ) {
			return null;
		}

		$shouldFallback = false;

		// Check if flag indicates layers should show
		if ( $layersFlag !== null && !in_array( $layersFlag, [ 'off', 'none' ], true ) ) {
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
	 * Apply layerslink deep linking by modifying link attributes.
	 *
	 * @param array &$linkAttribs Link attributes (modified by reference)
	 * @param array &$attribs Image attributes (modified by reference for data attrs)
	 * @param mixed $file The File object
	 * @param string $linkType 'editor', 'editor-newtab', 'editor-return', 'editor-modal', 'viewer', or 'lightbox'
	 * @param string|null $setName Optional layer set name
	 */
	private function applyLayersLink(
		array &$linkAttribs,
		array &$attribs,
		$file,
		string $linkType,
		?string $setName
	): void {
		$filename = $file->getName();
		$title = $file->getTitle();

		// For foreign files, $file->getTitle() might not work correctly for local URLs.
		// Ensure we have a valid local File: title for building the editor URL.
		if ( !$title ) {
			$title = Title::makeTitleSafe( NS_FILE, $filename );
		} elseif ( $this->isForeignFile( $file ) ) {
			// Foreign files may have a title that doesn't produce correct local URLs
			// Create a local File: title for the editor link
			$localTitle = Title::makeTitleSafe( NS_FILE, $filename );
			if ( $localTitle ) {
				$title = $localTitle;
			}
		}

		if ( !$title ) {
			$this->log( "applyLayersLink: Could not resolve title for $filename" );
			return;
		}

		$setNameStr = $setName ?? 'null';
		$this->log( "applyLayersLink: file=$filename, linkType=$linkType, setName=$setNameStr" );

		if ( $this->paramExtractor->isEditorLink( $linkType ) ) {
			// Build base editor URL parameters
			$urlParams = [
				'action' => 'editlayers',
				'setname' => $setName ?? ''
			];

			// Add autocreate flag when linking to a specific named set
			// This allows auto-creation of the set if it doesn't exist
			// (only for named sets, not for generic 'on' or 'default')
			if ( $setName !== null && $setName !== '' && $setName !== LayersConstants::DEFAULT_SET_NAME ) {
				$urlParams['autocreate'] = '1';
			}

			// Add returnto parameter for ALL editor links from article pages
			// This ensures closing the editor returns to the originating page
			$context = \RequestContext::getMain();
			$currentTitle = $context->getTitle();
			if ( $currentTitle && !$currentTitle->equals( $title ) ) {
				$urlParams['returnto'] = $currentTitle->getPrefixedDBkey();
			}

			// Handle modal mode: pass modal flag
			if ( $this->paramExtractor->isEditorModal( $linkType ) ) {
				$urlParams['modal'] = '1';
			}

			$editorUrl = $title->getLocalURL( $urlParams );

			// Handle editor-modal: use JavaScript handler instead of navigation
			if ( $this->paramExtractor->isEditorModal( $linkType ) ) {
				$linkAttribs['href'] = '#';
				$linkAttribs['data-layers-modal'] = '1';
				$linkAttribs['data-layers-filename'] = $filename;
				$linkAttribs['data-layers-setname'] = $setName ?? '';
				$linkAttribs['data-layers-editor-url'] = $editorUrl;
				$linkAttribs['data-layers-link'] = 'editor-modal';
				$linkAttribs['title'] = wfMessage( 'layers-link-editor-modal-title' )->text();
				$attribs['data-layers-link'] = 'editor-modal';
				$linkAttribs['class'] = trim( ( $linkAttribs['class'] ?? '' ) . ' layers-editor-modal-trigger' );
				$this->log( "Applied modal editor link for: $filename" );
			} else {
				// Standard navigation modes
				$linkAttribs['href'] = $editorUrl;
				$linkAttribs['data-layers-link'] = 'editor';
				$linkAttribs['title'] = wfMessage( 'layers-link-editor-title' )->text();
				$attribs['data-layers-link'] = 'editor';

				// Handle editor-newtab: open in new tab
				if ( $this->paramExtractor->isEditorNewtab( $linkType ) ) {
					$linkAttribs['target'] = '_blank';
					$linkAttribs['rel'] = 'noopener noreferrer';
					$linkAttribs['title'] = wfMessage( 'layers-link-editor-newtab-title' )->text();
				}

				$this->log( "Applied editor deep link: $editorUrl" );
			}

		} elseif ( $this->paramExtractor->isViewerLink( $linkType ) ) {
			// For viewer/lightbox, set up client-side handler
			$viewerUrl = $title->getLocalURL( [
				'layers' => $setName ?? 'on'
			] );

			$linkAttribs['href'] = $viewerUrl;
			$linkAttribs['data-layers-link'] = 'viewer';
			$linkAttribs['data-layers-setname'] = $setName ?? '';
			$linkAttribs['title'] = wfMessage( 'layers-link-viewer-title' )->text();
			$linkAttribs['class'] = trim( ( $linkAttribs['class'] ?? '' ) . ' layers-lightbox-trigger' );
			$attribs['data-layers-link'] = 'viewer';

			$this->log( "Applied viewer deep link: $viewerUrl" );
		}
	}

	/**
	 * Check if a file is from a foreign repository (like InstantCommons)
	 *
	 * @param mixed $file File object
	 * @return bool True if the file is from a foreign repository
	 */
	private function isForeignFile( $file ): bool {
		// Check for ForeignAPIFile or ForeignDBFile
		if ( $file instanceof \ForeignAPIFile || $file instanceof \ForeignDBFile ) {
			return true;
		}

		// Check using class name (for namespaced classes)
		$className = get_class( $file );
		if ( strpos( $className, 'Foreign' ) !== false ) {
			return true;
		}

		// Check if the file's repo is foreign
		if ( method_exists( $file, 'getRepo' ) ) {
			$repo = $file->getRepo();
			if ( $repo && method_exists( $repo, 'isLocal' ) && !$repo->isLocal() ) {
				return true;
			}
		}

		return false;
	}
}
