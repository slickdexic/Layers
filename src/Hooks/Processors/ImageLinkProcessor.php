<?php

declare( strict_types=1 );
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

	/** @var LayersDatabase|null */
	private ?LayersDatabase $database = null;

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
	 * @param string|null $linkTypeFromQueue Optional layerslink type from wikitext queue (editor, viewer, lightbox)
	 * @return bool True to continue hook processing
	 */
	public function processImageLink(
		$file,
		array $handlerParams,
		array $frameParams,
		string &$res,
		?string $setNameFromQueue = null,
		string $context = 'ImageLink',
		?string $linkTypeFromQueue = null
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

			// Extract layerslink parameter for deep linking
			// First try from params, then fall back to queue
			$layersLink = $this->paramExtractor->extractLayersLink( $handlerParams, $frameParams );
			if ( $layersLink === null && $linkTypeFromQueue !== null ) {
				$layersLink = $linkTypeFromQueue;
			}

			// Get set name for deep linking
			$setName = $this->paramExtractor->getSetName( $layersFlag );
			if ( $setName === null && $setNameFromQueue !== null ) {
				$setName = $setNameFromQueue;
			}

			// Check for direct JSON layer data in params
			$layersArray = $this->paramExtractor->extractLayersJson( $handlerParams );

			// Determine if layers are enabled from any source:
			// - $layersFlag: extracted from handler/frame params, link attribs, or data-mw
			// - $setNameFromQueue: extracted from wikitext by onParserBeforeInternalParse
			// - $layersArray: direct JSON layer data in params
			$layersEnabled = ( $layersFlag !== null || $setNameFromQueue !== null || $layersArray !== null );

			// Log layer processing state for troubleshooting
			$this->logDebug( sprintf(
				'processImageLink: layersFlag=%s, setNameFromQueue=%s, linkTypeFromQueue=%s, layersEnabled=%s',
				$layersFlag ?? 'null',
				$setNameFromQueue ?? 'null',
				$linkTypeFromQueue ?? 'null',
				$layersEnabled ? 'yes' : 'no'
			) );

			// Enable layers if we have a valid parameter or direct JSON
			if ( $file && $layersEnabled ) {
				if ( $layersArray === null ) {
					// No direct JSON - fetch from database
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
				if ( strpos( $res, 'data-layer-data=' ) === false && $layersEnabled ) {
					$res = $this->htmlInjector->injectIntentMarker( $res );
				}

				// Apply layerslink deep linking if specified (only when layers are enabled)
				if ( $layersLink !== null ) {
					$this->logDebug( sprintf(
						'Calling applyLayersLink: linkType=%s, setName=%s',
						$layersLink,
						$setName ?? 'null'
					) );
					$res = $this->applyLayersLink( $res, $file, $layersLink, $setName );
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

			// Resolve layer data based on the param value (now returns full data object)
			$layerData = $this->resolveLayerSetFromParam( $file, $param );

			if ( $layerData !== null ) {
				// Use injector for HTML modification with background settings
				$dimensions = $this->htmlInjector->getFileDimensions( $file );
				$res = $this->htmlInjector->injectIntoHtml(
					$res,
					$layerData['layers'],
					$dimensions['width'],
					$dimensions['height'],
					'LinkerMakeMediaLinkFile',
					$layerData['backgroundVisible'],
					$layerData['backgroundOpacity']
				);

				// Also set attributes via reference array for core-generated markup paths
				if ( is_array( $attribs ) ) {
					$this->htmlInjector->injectIntoAttributes(
						$attribs,
						$layerData['layers'],
						$dimensions['width'],
						$dimensions['height'],
						$layerData['backgroundVisible'],
						$layerData['backgroundOpacity']
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
		$sha1 = $this->getFileSha1( $file );

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

		// Extract full layer data from the set (including background settings)
		$layerData = $this->extractLayerDataFromSet( $layerSet );
		if ( $layerData === null || empty( $layerData['layers'] ) ) {
			return $html;
		}

		// Use injector for HTML modification with background settings
		$dimensions = $this->htmlInjector->getFileDimensions( $file );
		$result = $this->htmlInjector->injectIntoHtml(
			$html,
			$layerData['layers'],
			$dimensions['width'],
			$dimensions['height'],
			$context,
			$layerData['backgroundVisible'],
			$layerData['backgroundOpacity']
		);

		$this->pageHasLayers = true;
		return $result;
	}

	/**
	 * Inject layers directly from provided array
	 *
	 * @param string $html The HTML to modify
	 * @param mixed $file The File object
	 * @param array $layerData The layers to inject
	 * @param string $context Logging context
	 * @return string Modified HTML
	 */
	private function injectLayersDirect(
		string $html,
		$file,
		array $layerData,
		string $context
	): string {
		// Handle both old format (raw layers array) and new format (object with layers + settings)
		$layers = isset( $layerData['layers'] ) ? $layerData['layers'] : $layerData;
		$backgroundVisible = $layerData['backgroundVisible'] ?? true;
		$backgroundOpacity = $layerData['backgroundOpacity'] ?? 1.0;

		$dimensions = $this->htmlInjector->getFileDimensions( $file );
		$result = $this->htmlInjector->injectIntoHtml(
			$html,
			$layers,
			$dimensions['width'],
			$dimensions['height'],
			$context,
			$backgroundVisible,
			$backgroundOpacity
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
	 * @return array|null Array with 'layers', 'backgroundVisible', 'backgroundOpacity', or null if not found
	 */
	private function resolveLayerSetFromParam( $file, string $param ): ?array {
		$db = $this->getDatabase();
		if ( !$db ) {
			return null;
		}

		$filename = $file->getName();
		$sha1 = $this->getFileSha1( $file );

		// 'on' or 'all' => show default set
		if ( $param === 'on' || $param === 'all' ) {
			$latest = $db->getLatestLayerSet( $filename, $sha1 );
			return $this->extractLayerDataFromSet( $latest );
		}

		// 'id:123' => specific set by ID
		if ( preg_match( '/^id:(\d+)$/', $param, $idM ) ) {
			$ls = $db->getLayerSet( (int)$idM[1] );
			return $this->extractLayerDataFromSet( $ls );
		}

		// 'name:setname' => specific named set
		if ( preg_match( '/^name:(.+)$/', $param, $nameM ) ) {
			$ls = $db->getLatestLayerSet( $filename, $sha1, $nameM[1] );
			return $this->extractLayerDataFromSet( $ls );
		}

		// Short IDs like 'abc1,def2' => filter layers by short ID
		if ( preg_match( '/^[a-z0-9,]+$/i', $param ) && strpos( $param, ',' ) !== false ) {
			$shortIds = array_map( 'trim', explode( ',', $param ) );
			$latest = $db->getLatestLayerSet( $filename, $sha1 );
			$layerData = $this->extractLayerDataFromSet( $latest );
			if ( $layerData === null ) {
				return null;
			}
			// Filter layers by short ID while preserving background settings
			$filteredLayers = array_values( array_filter(
				$layerData['layers'],
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
			return [
				'layers' => $filteredLayers,
				'backgroundVisible' => $layerData['backgroundVisible'],
				'backgroundOpacity' => $layerData['backgroundOpacity']
			];
		}

		// Plain string => treat as named set
		$ls = $db->getLatestLayerSet( $filename, $sha1, $param );
		return $this->extractLayerDataFromSet( $ls );
	}

	/**
	 * Extract layers array from a layer set object
	 *
	 * @param mixed $layerSet The layer set object from database
	 * @return array|null The layers array, or null if invalid
	 */
	private function extractLayersFromSet( $layerSet ): ?array {
		$layerData = $this->extractLayerDataFromSet( $layerSet );
		return $layerData !== null ? $layerData['layers'] : null;
	}

	/**
	 * Extract full layer data from a layer set object
	 * Returns layers array plus background settings
	 *
	 * @param mixed $layerSet The layer set object from database
	 * @return array|null Array with 'layers', 'backgroundVisible', 'backgroundOpacity', or null if invalid
	 */
	private function extractLayerDataFromSet( $layerSet ): ?array {
		if ( !$layerSet ) {
			return null;
		}

		// Try multiple key formats for compatibility:
		// - 'data' from getLatestLayerSet(), getLayerSetByName(), etc.
		// - 'ls_data' from raw database row (legacy)
		$data = $layerSet['data'] ?? $layerSet->data ?? $layerSet['ls_data'] ?? $layerSet->ls_data ?? null;
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
		$layers = null;
		if ( isset( $data['layers'] ) && is_array( $data['layers'] ) ) {
			$layers = $data['layers'];
		} elseif ( is_array( $data ) && isset( $data[0] ) ) {
			// Direct array of layers (old format)
			$layers = $data;
		}

		if ( $layers === null ) {
			return null;
		}

		// Return full data object with background settings
		return [
			'layers' => $layers,
			'backgroundVisible' => $data['backgroundVisible'] ?? true,
			'backgroundOpacity' => $data['backgroundOpacity'] ?? 1.0
		];
	}

	/**
	 * Apply layerslink deep linking to modify image link behavior
	 *
	 * @param string $html The HTML containing the image link
	 * @param mixed $file The File object
	 * @param string $linkType 'editor', 'editor-newtab', 'editor-return', 'editor-modal', 'viewer', or 'lightbox'
	 * @param string|null $setName Optional layer set name for deep linking
	 * @return string Modified HTML
	 */
	private function applyLayersLink( string $html, $file, string $linkType, ?string $setName ): string {
		$filename = $file->getName();
		$title = $file->getTitle();

		// For foreign files, $file->getTitle() might not work correctly for local URLs.
		// Ensure we have a valid local File: title for building the editor URL.
		if ( !$title ) {
			$title = \Title::makeTitleSafe( NS_FILE, $filename );
		} elseif ( $this->isForeignFile( $file ) ) {
			// Foreign files may have a title that doesn't produce correct local URLs
			// Create a local File: title for the editor link
			$localTitle = \Title::makeTitleSafe( NS_FILE, $filename );
			if ( $localTitle ) {
				$title = $localTitle;
			}
		}

		if ( !$title ) {
			$this->logDebug( "applyLayersLink: Could not resolve title for $filename" );
			return $html;
		}

		if ( $this->paramExtractor->isEditorLink( $linkType ) ) {
			// Build base editor URL parameters
			$urlParams = [
				'action' => 'editlayers',
				'setname' => $setName ?? ''
			];

			// Add autocreate flag when linking to a specific named set
			// This allows auto-creation of the set if it doesn't exist
			// (only for named sets, not for generic 'on' or 'default')
			if ( $setName !== null && $setName !== '' && $setName !== 'default' ) {
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

					// Handle editor-modal: use JavaScript handler
			if ( $this->paramExtractor->isEditorModal( $linkType ) ) {
				$html = preg_replace( '/<a\s+([^>]*?)href="[^"]*"/', '<a $1href="#"', $html, 1 );

				$escapedFilename = htmlspecialchars( $filename );
				$escapedSetName = htmlspecialchars( $setName ?? '' );
				$escapedEditorUrl = htmlspecialchars( $editorUrl );
				$modalAttrs = 'data-layers-modal="1" ' .
					"data-layers-filename=\"$escapedFilename\" " .
					"data-layers-setname=\"$escapedSetName\" " .
					"data-layers-editor-url=\"$escapedEditorUrl\" " .
					'data-layers-link="editor-modal"';
				$html = $this->addLinkAttributes(
					$html,
					$modalAttrs,
					wfMessage( 'layers-link-editor-modal-title' )->text()
				);

				// Add modal trigger class
				$html = preg_replace(
					'/<a\s+([^>]*?)class="([^"]*)"/',
					'<a $1class="$2 layers-editor-modal-trigger"',
					$html,
					1
				);
				if ( strpos( $html, 'layers-editor-modal-trigger' ) === false ) {
					$html = preg_replace( '/<a\s+/', '<a class="layers-editor-modal-trigger" ', $html, 1 );
				}

				$this->logDebug( 'Applied modal editor link', [ 'file' => $filename, 'setName' => $setName ] );
			} else {
				// Standard navigation modes
				$html = $this->replaceHref( $html, $editorUrl );

				$dataAttr = 'data-layers-link="editor"';
				$titleMsg = wfMessage( 'layers-link-editor-title' )->text();

				// Handle editor-newtab: open in new tab
				if ( $this->paramExtractor->isEditorNewtab( $linkType ) ) {
					$dataAttr .= ' target="_blank" rel="noopener noreferrer"';
					$titleMsg = wfMessage( 'layers-link-editor-newtab-title' )->text();
				}

				$html = $this->addLinkAttributes( $html, $dataAttr, $titleMsg );

				$this->logDebug( 'Applied editor deep link', [ 'file' => $filename, 'setName' => $setName ] );
			}
		} elseif ( $this->paramExtractor->isViewerLink( $linkType ) ) {
			// For viewer/lightbox, set up client-side handler
			// The link will open a fullscreen viewer via JavaScript

			// Build viewer URL with layers parameter for fallback (no-JS case)
			$viewerUrl = $title->getLocalURL( [
				'layers' => $setName ?? 'on'
			] );

			$html = $this->replaceHref( $html, $viewerUrl );

			// Add data attributes for lightbox initialization
			$html = $this->addLinkAttributes(
				$html,
				'data-layers-link="viewer" data-layers-setname="' . htmlspecialchars( $setName ?? '' ) . '"',
				wfMessage( 'layers-link-viewer-title' )->text()
			);

			// Add class for JS initialization
			$html = preg_replace(
				'/<a\s+([^>]*?)class="([^"]*)"/',
				'<a $1class="$2 layers-lightbox-trigger"',
				$html,
				1
			);

			// If no class attribute, add one
			if ( strpos( $html, 'layers-lightbox-trigger' ) === false ) {
				$html = preg_replace(
					'/<a\s+/',
					'<a class="layers-lightbox-trigger" ',
					$html,
					1
				);
			}

			$this->logDebug( 'Applied viewer deep link', [ 'file' => $filename, 'setName' => $setName ] );
		}

		return $html;
	}

	/**
	 * Replace the href attribute in an anchor tag
	 *
	 * @param string $html HTML containing anchor tag
	 * @param string $newHref New href value
	 * @return string Modified HTML
	 */
	private function replaceHref( string $html, string $newHref ): string {
		return preg_replace(
			'/<a\s+([^>]*?)href="[^"]*"/',
			'<a $1href="' . htmlspecialchars( $newHref ) . '"',
			$html,
			1
		);
	}

	/**
	 * Add data attributes and title to a link
	 *
	 * @param string $html HTML containing anchor tag
	 * @param string $attrs Additional attributes to add
	 * @param string $title Title attribute value
	 * @return string Modified HTML
	 */
	private function addLinkAttributes( string $html, string $attrs, string $title ): string {
		// Add attributes before the closing >
		$html = preg_replace(
			'/<a\s+([^>]*)>/',
			'<a $1 ' . $attrs . ' title="' . htmlspecialchars( $title ) . '">',
			$html,
			1
		);

		return $html;
	}

	/**
	 * Get a stable SHA1 identifier for a file.
	 *
	 * For foreign files (from InstantCommons, etc.) that don't have a SHA1,
	 * we generate a stable fallback identifier based on the filename.
	 *
	 * @param mixed $file File object
	 * @return string SHA1 hash or fallback identifier
	 */
	private function getFileSha1( $file ): string {
		$sha1 = $file->getSha1();
		if ( !empty( $sha1 ) ) {
			return $sha1;
		}

		// Check if this is a foreign file
		if ( $this->isForeignFile( $file ) ) {
			// Use a hash of the filename as a fallback (prefixed for clarity)
			return 'foreign_' . sha1( $file->getName() );
		}

		return $sha1 ?? '';
	}

	/**
	 * Check if a file is from a foreign repository (like InstantCommons)
	 *
	 * @param mixed $file File object
	 * @return bool True if the file is from a foreign repository
	 */
	private function isForeignFile( $file ): bool {
		// Check if file is a ForeignAPIFile or ForeignDBFile
		$className = get_class( $file );
		if ( strpos( $className, 'Foreign' ) !== false ) {
			return true;
		}

		// Check if the file's repository is not local
		if ( method_exists( $file, 'getRepo' ) ) {
			$repo = $file->getRepo();
			if ( $repo && method_exists( $repo, 'isLocal' ) && !$repo->isLocal() ) {
				return true;
			}
		}

		return false;
	}
}
