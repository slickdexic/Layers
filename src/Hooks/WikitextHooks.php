<?php

namespace MediaWiki\Extension\Layers\Hooks;

use RequestContext;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\Processors\ImageLinkProcessor;
use MediaWiki\Extension\Layers\Hooks\Processors\LayeredFileRenderer;
use MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use MediaWiki\Extension\Layers\Hooks\Processors\ThumbnailProcessor;
use MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait;
use MediaWiki\MediaWikiServices;

class WikitextHooks {
	use StaticLoggerAwareTrait;

	/**
	 * Singleton instance of ImageLinkProcessor
	 * @var ImageLinkProcessor|null
	 */
	private static ?ImageLinkProcessor $imageLinkProcessor = null;

	/**
	 * Singleton instance of ThumbnailProcessor
	 * @var ThumbnailProcessor|null
	 */
	private static ?ThumbnailProcessor $thumbnailProcessor = null;

	/**
	 * Singleton instance of LayersHtmlInjector
	 * @var LayersHtmlInjector|null
	 */
	private static ?LayersHtmlInjector $htmlInjector = null;

	/**
	 * Singleton instance of LayersParamExtractor
	 * @var LayersParamExtractor|null
	 */
	private static ?LayersParamExtractor $paramExtractor = null;

	/**
	 * Singleton instance of LayeredFileRenderer
	 * @var LayeredFileRenderer|null
	 */
	private static ?LayeredFileRenderer $layeredFileRenderer = null;

	/**
	 * Singleton instance of LayerInjector
	 * @var LayerInjector|null
	 */
	private static ?LayerInjector $layerInjector = null;

	/**
	 * Get HTML injector instance (lazy singleton)
	 *
	 * @return LayersHtmlInjector
	 */
	private static function getHtmlInjector(): LayersHtmlInjector {
		if ( self::$htmlInjector === null ) {
			self::$htmlInjector = new LayersHtmlInjector();
		}
		return self::$htmlInjector;
	}

	/**
	 * Get parameter extractor instance (lazy singleton)
	 *
	 * @return LayersParamExtractor
	 */
	private static function getParamExtractor(): LayersParamExtractor {
		if ( self::$paramExtractor === null ) {
			self::$paramExtractor = new LayersParamExtractor();
		}
		return self::$paramExtractor;
	}

	/**
	 * Get layered file renderer instance (lazy singleton)
	 *
	 * @return LayeredFileRenderer
	 */
	private static function getLayeredFileRenderer(): LayeredFileRenderer {
		if ( self::$layeredFileRenderer === null ) {
			self::$layeredFileRenderer = new LayeredFileRenderer(
				self::getLogger()
			);
		}
		return self::$layeredFileRenderer;
	}

	/**
	 * Get layer injector instance (lazy singleton)
	 *
	 * @return LayerInjector
	 */
	private static function getLayerInjector(): LayerInjector {
		if ( self::$layerInjector === null ) {
			self::$layerInjector = new LayerInjector(
				self::getLogger()
			);
		}
		return self::$layerInjector;
	}

	/**
	 * Get image link processor instance (lazy singleton)
	 *
	 * @return ImageLinkProcessor
	 */
	private static function getImageLinkProcessor(): ImageLinkProcessor {
		if ( self::$imageLinkProcessor === null ) {
			self::$imageLinkProcessor = new ImageLinkProcessor(
				self::getHtmlInjector(),
				self::getParamExtractor()
			);
		}
		return self::$imageLinkProcessor;
	}

	/**
	 * Get thumbnail processor instance (lazy singleton)
	 *
	 * @return ThumbnailProcessor
	 */
	private static function getThumbnailProcessor(): ThumbnailProcessor {
		if ( self::$thumbnailProcessor === null ) {
			self::$thumbnailProcessor = new ThumbnailProcessor(
				self::getParamExtractor()
			);
		}
		return self::$thumbnailProcessor;
	}

	/**
	 * Track if any image on the current page has layers enabled
	 * @var bool
	 */
	private static $pageHasLayers = false;

	/**
	 * Queue of set names per filename detected from wikitext (in order of appearance)
	 * e.g. ['ImageTest02.jpg' => ['Paul', 'default', 'anatomy']]
	 * This allows multiple instances of the same image with different layer sets
	 * @var array<string, array<string>>
	 */
	private static $fileSetNames = [];

	/**
	 * Counter tracking how many times each file has been rendered
	 * Used to match render calls to their corresponding set name in the queue
	 * @var array<string, int>
	 */
	private static $fileRenderCount = [];

	/**
	 * Queue of layerslink values per filename detected from wikitext (in order of appearance)
	 * e.g. ['ImageTest02.jpg' => ['editor', null, 'viewer']]
	 * @var array<string, array<string|null>>
	 */
	private static $fileLinkTypes = [];

	/**
	 * Handle file parameter parsing in wikitext
	 * Called when MediaWiki processes [[File:...]] syntax
	 *
	 * @param mixed &$dummy Kept for signature compatibility
	 * @param mixed $title Title object
	 * @param mixed $file File object
	 * @param array &$attribs Image attributes
	 * @param array &$linkAttribs Link attributes
	 * @param bool $isLinked Link flag
	 * @param mixed $thumb Thumbnail
	 * @param mixed $parser Parser
	 * @param mixed $time Timestamp or time param (core-provided)
	 * @param int|null $page Page number
	 * @param mixed ...$rest Additional parameters provided by core for forward-compat
	 * @return bool
	 */
	public static function onImageBeforeProduceHTML(
		&$dummy,
		$title,
		$file,
		array &$attribs = [],
		array &$linkAttribs = [],
		$isLinked = false,
		$thumb = null,
		$parser = null,
		$time = null,
		$page = null,
		...$rest
	) {
		// Add data attributes for full-size images (non-thumbnail) when layers are requested.
		// Additionally, on file pages we inject overlays unconditionally when layer data exists.
		try {
			$extractor = self::getParamExtractor();

			// Extract layers parameter from file link href
			$layersFlag = $extractor->extractFromLinkAttribs( $linkAttribs );

			// Respect explicit off/none
			if ( $extractor->isDisabled( $layersFlag ) ) {
				return true;
			}

			// Inject only when explicitly requested
			if ( $extractor->isDefaultEnabled( $layersFlag ) && $file ) {
				// Use injector for clean injection
				$setName = $extractor->getSetName( $layersFlag );
				$injector = self::getLayerInjector();
				if ( $injector->injectIntoAttributes( $attribs, $file, $setName, 'ImageBeforeProduceHTML' ) ) {
					self::$pageHasLayers = true;
				}
			}
		} catch ( \Throwable $e ) {
			self::logError( 'ImageBeforeProduceHTML error', [ 'exception' => $e ] );
		}

		return true;
	}

	/**
	 * Handle wikitext after parsing to find and replace layer image syntax
	 * This catches [[File:Example.jpg|layers=on]] after MediaWiki has processed it
	 *
	 * @param mixed $parser
	 * @param string &$text
	 * @param mixed $stripState
	 * @return bool
	 */
	public static function onParserAfterTidy( $parser, &$text, $stripState ) {
		// This hook can be used for post-processing if needed
		// Currently, layer processing is handled at the file level
		return true;
	}

	/**
	 * MakeImageLink2 hook: last-chance injection point to alter the generated <img> HTML.
	 * This helps in galleries and contexts where Thumbnail/Image hooks miss.
	 *
	 * @param mixed $skin
	 * @param mixed $title
	 * @param mixed $file
	 * @param array $frameParams
	 * @param array $handlerParams
	 * @param string $time
	 * @param string &$res Resulting HTML (modified by reference)
	 * @param mixed ...$rest Additional parameters provided by core for forward-compat
	 * @return bool
	 */
	public static function onMakeImageLink2(
		$skin,
		$title,
		$file,
		$frameParams,
		$handlerParams,
		$time,
		&$res,
		...$rest
	): bool {
		$processor = self::getImageLinkProcessor();
		$filename = $file ? $file->getName() : null;

		// Get both params together to ensure they're from the same queue index
		$fileParams = $filename ? self::getFileParamsForRender( $filename ) : [ 'setName' => null, 'linkType' => null ];

		// DEBUG: Log what we're receiving
		self::log( sprintf(
			'MakeImageLink2: file=%s, setName=%s, linkType=%s, res_len=%d',
			$filename ?? 'null',
			$fileParams['setName'] ?? 'null',
			$fileParams['linkType'] ?? 'null',
			strlen( $res )
		) );

		$result = $processor->processImageLink(
			$file,
			$handlerParams,
			$frameParams,
			$res,
			$fileParams['setName'],
			'MakeImageLink2',
			$fileParams['linkType']
		);

		// Sync page-level flag
		if ( $processor->pageHasLayers() ) {
			self::$pageHasLayers = true;
		}

		return $result;
	}

	/**
	 * LinkerMakeImageLink hook: MW 1.44 path for altering generated <img> HTML.
	 * Delegates to ImageLinkProcessor for consistent handling.
	 *
	 * @param mixed $linker Linker object
	 * @param mixed $title Title object
	 * @param mixed $file File object
	 * @param array $frameParams Frame parameters
	 * @param array $handlerParams Handler parameters
	 * @param string $time Timestamp or time param (core-provided)
	 * @param string &$res Resulting HTML (modified by reference)
	 * @param mixed ...$rest Additional parameters provided by core for forward-compat
	 * @return bool
	 */
	public static function onLinkerMakeImageLink(
		$linker, $title, $file, $frameParams, $handlerParams, $time, &$res, ...$rest
	): bool {
		$processor = self::getImageLinkProcessor();
		$filename = $file ? $file->getName() : null;

		// Get both params together to ensure they're from the same queue index
		$fileParams = $filename ? self::getFileParamsForRender( $filename ) : [ 'setName' => null, 'linkType' => null ];

		$result = $processor->processImageLink(
			$file,
			$handlerParams,
			$frameParams,
			$res,
			$fileParams['setName'],
			'LinkerMakeImageLink',
			$fileParams['linkType']
		);

		// Sync page-level flag
		if ( $processor->pageHasLayers() ) {
			self::$pageHasLayers = true;
		}

		return $result;
	}

	/**
	 * LinkerMakeMediaLinkFile hook: another path used by MW to render <img> HTML within links.
	 * Delegates to ImageLinkProcessor for consistent handling.
	 *
	 * @param mixed $title Title object
	 * @param mixed $file File object
	 * @param string &$res Resulting HTML (modified by reference)
	 * @param array &$attribs Image attributes (modified by reference)
	 * @param string $time Timestamp or time param (core-provided)
	 * @param mixed ...$rest Additional parameters provided by core for forward-compat
	 * @return bool
	 */
	public static function onLinkerMakeMediaLinkFile( $title, $file, &$res, &$attribs, $time, ...$rest ): bool {
		$processor = self::getImageLinkProcessor();
		$result = $processor->processMediaLink( $file, $res, $attribs );

		// Sync page-level flag
		if ( $processor->pageHasLayers() ) {
			self::$pageHasLayers = true;
		}

		return $result;
	}

	/**
	 * Register parser functions and hooks
	 *
	 * @param mixed $parser The parser object
	 * @return bool
	 */
	public static function onParserFirstCallInit( $parser ): bool {
		// Parser functions are currently disabled to avoid magic word conflicts
		// The extension works through the layers= parameter in file syntax instead
		// To enable parser functions, define magic words in i18n and uncomment below:
		// $parser->setFunctionHook( 'layeredfile', [ self::class, 'renderLayeredFile' ], \Parser::SFH_OBJECT_ARGS );
		return true;
	}

	/**
	 * Define custom link parameters so MediaWiki preserves them for file links.
	 * In particular, register 'layers' used by this extension.
	 *
	 * @param array &$params
	 * @return bool
	 */
	public static function onGetLinkParamDefinitions( array &$params ): bool {
		self::log( 'Registering link param definitions' );

		$params['layers'] = [
			'type' => 'string',
			'default' => null,
			'description' => 'Layers parameter for annotated images (all, none, on, or list)'
		];
		// Accept singular alias 'layer' for robustness
		$params['layer'] = [
			'type' => 'string',
			'default' => null,
			'description' => 'Alias of layers'
		];
		// Carry compact JSON of layers and selected set id through handler params for robust downstream access
		$params['layersjson'] = [
			'type' => 'string',
			'default' => null,
			'description' => 'JSON-encoded layers array for rendering (compact)'
		];
		$params['layersetid'] = [
			'type' => 'string',
			'default' => null,
			'description' => 'Selected layer set id'
		];
		$params['layerslink'] = [
			'type' => 'string',
			'default' => null,
			'description' => 'Deep link behavior: "editor" to open editor, "viewer" or "lightbox" to open full-size viewer'
		];
		return true;
	}

	/**
	 * Back-compat for older MW: define link param types so 'layers' is preserved.
	 *
	 * @param array &$types
	 * @return bool
	 */
	public static function onGetLinkParamTypes( array &$types ): bool {
		$types['layers'] = 'string';
		$types['layer'] = 'string';
		$types['layersjson'] = 'string';
		$types['layersetid'] = 'string';
		$types['layerslink'] = 'string';
		return true;
	}

	/**
	 * Ensure 'layers' is accepted as a valid image option so it reaches handler params.
	 *
	 * @param array &$params Array of option names
	 * @return bool
	 */
	public static function onParserGetImageLinkParams( array &$params ): bool {
		self::log( 'Adding image link params' );

		if ( !in_array( 'layers', $params, true ) ) {
			$params[] = 'layers';
		}
		if ( !in_array( 'layer', $params, true ) ) {
			$params[] = 'layer';
		}
		if ( !in_array( 'layersjson', $params, true ) ) {
			$params[] = 'layersjson';
		}
		if ( !in_array( 'layersetid', $params, true ) ) {
			$params[] = 'layersetid';
		}
		if ( !in_array( 'layerslink', $params, true ) ) {
			$params[] = 'layerslink';
		}
		return true;
	}

	/**
	 * Newer MW: ensure our options are recognized in image syntax so they propagate.
	 * @param array &$options
	 * @return bool
	 */
	public static function onParserGetImageLinkOptions( array &$options ): bool {
		self::log( 'Adding image link options' );

		foreach ( [ 'layers', 'layer', 'layersjson', 'layersetid', 'layerslink' ] as $opt ) {
			if ( !in_array( $opt, $options, true ) ) {
				$options[] = $opt;
			}
		}
		return true;
	}

	/**
	 * Render a file with layers
	 * Usage: {{#layeredfile:ImageTest02.jpg|500px|layers=on|caption}}
	 *
	 * @param mixed $parser The parser object
	 * @param mixed $frame The frame object
	 * @param array $args The arguments array
	 * @return string
	 */
	public static function renderLayeredFile( $parser, $frame, $args ) {
		return self::getLayeredFileRenderer()->render( $parser, $frame, $args );
	}

	/**
	 * Handle file link parameters (variadic for forward/back-compat across MW versions).
	 *
	 * @param mixed ...$args Raw arguments as provided by core hook signature
	 * @return bool
	 */
	public static function onFileLink( ...$args ): bool {
		// Be resilient to signature changes; MakeImageLink2 handles attribute injection.
		return true;
	}

	/**
	 * Add data attributes to thumbnails for client-side rendering when available
	 *
	 * Note: In MediaWiki 1.39-1.43 LTS, $linkAttribs can be false (boolean) when
	 * the image has no link. We accept mixed type for backward compatibility.
	 *
	 * @param mixed $thumbnail
	 * @param array &$attribs
	 * @param array|bool &$linkAttribs Link attributes array, or false if no link
	 * @return bool
	 */
	public static function onThumbnailBeforeProduceHTML( $thumbnail, array &$attribs, &$linkAttribs ): bool {
		// Handle case where $linkAttribs is false (no link) in older MW versions
		$linkAttribsIsArray = is_array( $linkAttribs );

		$processor = self::getThumbnailProcessor();

		// Get filename for queue lookup
		$filename = null;
		if ( method_exists( $thumbnail, 'getFile' ) && $thumbnail->getFile() ) {
			$filename = $thumbnail->getFile()->getName();
		}

		// Get both set name and link type from queue
		$fileParams = $filename ? self::getFileParamsForRender( $filename ) : [ 'setName' => null, 'linkType' => null ];

		// Convert false to empty array for processor compatibility (MW 1.39-1.43 LTS compat)
		$linkAttribsForProcessor = $linkAttribsIsArray ? $linkAttribs : [];

		$result = $processor->processThumbnail(
			$thumbnail,
			$attribs,
			$linkAttribsForProcessor,
			$fileParams['setName'],
			$fileParams['linkType']
		);

		// Write back any changes if linkAttribs was originally an array
		if ( $linkAttribsIsArray ) {
			$linkAttribs = $linkAttribsForProcessor;
		}

		if ( $processor->pageHasLayers() ) {
			self::$pageHasLayers = true;
		}
		return $result;
	}

	/**
	 * Normalize and interpret the layers parameter during image param assembly.
	 *
	 * @param mixed $title Title
	 * @param mixed $file File
	 * @param array &$params Parameters (modified by reference)
	 * @param mixed $parser Parser
	 * @return bool
	 */
	public static function onParserMakeImageParams( $title, $file, array &$params, $parser ): bool {
		$fileName = $file ? $file->getName() : 'null';
		self::log( "ParserMakeImageParams for: $fileName" );

		// Normalize alias 'layer' to 'layers'
		if ( !isset( $params['layers'] ) && isset( $params['layer'] ) ) {
			$params['layers'] = $params['layer'];
			unset( $params['layer'] );
		}

		if ( !isset( $params['layers'] ) ) {
			return true;
		}

		// Ensure we have a File object
		$file = self::ensureFileObject( $file, $title );

		// Normalize the layers parameter value
		$layersRaw = self::normalizeLayersParam( $params['layers'] );

		// Handle disabled layers
		if ( $layersRaw === false || $layersRaw === 'none' || $layersRaw === 'off' ) {
			unset( $params['layerSetId'], $params['layerData'], $params['layersjson'], $params['layersetid'] );
			return true;
		}

		// Mark page has layers
		self::$pageHasLayers = true;

		// Get injector instance for layer data injection
		$injector = self::getLayerInjector();

		// Process based on parameter type
		if ( $layersRaw === true || $layersRaw === 'on' || $layersRaw === 'all' ) {
			// Show latest/default set
			if ( $file ) {
				// Use peek to avoid consuming the queue entry (it will be consumed in MakeImageLink2)
				$setName = self::peekFileSetName( $file->getName() );
				$injector->addLatestLayersToImage( $file, $params, $setName );
			}
		} elseif (
			is_string( $layersRaw ) &&
			preg_match( '/^[0-9a-fA-F]{2,8}(\s*,\s*[0-9a-fA-F]{2,8})*$/', $layersRaw )
		) {
			// Comma-separated short IDs
			if ( $file ) {
				$injector->addSubsetLayersToImage( $file, $layersRaw, $params );
			}
		} elseif ( is_string( $layersRaw ) ) {
			// Named set or id: prefix
			if ( $file ) {
				$injector->addSpecificLayersToImage( $file, $layersRaw, $params );
			}
		}

		// Finalize params
		$params['layers'] = 'on';
		if ( isset( $params['layerData'] ) && is_array( $params['layerData'] ) ) {
			$params['layersjson'] = json_encode( $params['layerData'], JSON_UNESCAPED_UNICODE );
		}
		if ( isset( $params['layerSetId'] ) ) {
			$params['layersetid'] = (string)$params['layerSetId'];
		}

		self::log( sprintf(
			'Processed layers param: hasData=%s, hasSetId=%s',
			isset( $params['layerData'] ) ? 'yes' : 'no',
			isset( $params['layerSetId'] ) ? 'yes' : 'no'
		) );

		return true;
	}

	/**
	 * Ensure we have a File object, attempting to find it if necessary.
	 *
	 * @param mixed $file Current file (may be null)
	 * @param mixed $title Title to find file for
	 * @return mixed File object or null
	 */
	private static function ensureFileObject( $file, $title ) {
		if ( $file ) {
			return $file;
		}

		try {
			$services = MediaWikiServices::getInstance();
			$repoGroup = $services->getRepoGroup();
			if ( $repoGroup && $title ) {
				return $repoGroup->findFile( $title );
			}
		} catch ( \Throwable $e ) {
			// Ignore errors, return null
		}

		return null;
	}

	/**
	 * Normalize the layers parameter value.
	 *
	 * @param mixed $value Raw parameter value
	 * @return mixed Normalized value (bool, string, or original)
	 */
	private static function normalizeLayersParam( $value ) {
		if ( !is_string( $value ) ) {
			return $value;
		}

		$trimmed = strtolower( trim( $value ) );
		if ( $trimmed === 'true' ) {
			return true;
		}
		if ( $trimmed === 'false' ) {
			return false;
		}
		return $trimmed;
	}

	/**
	 * Check if any image on the current page has layers enabled
	 * @return bool
	 */
	public static function pageHasLayers(): bool {
		return self::$pageHasLayers;
	}

	/**
	 * Peek at the stored set name for the current occurrence without consuming it
	 * Use this when you need the value but don't want to advance the queue
	 * @param string $filename The filename (without namespace prefix)
	 * @return string|null The set name, or null if not specified
	 */
	public static function peekFileSetName( string $filename ): ?string {
		if ( !isset( self::$fileSetNames[$filename] ) || empty( self::$fileSetNames[$filename] ) ) {
			return null;
		}

		$index = self::$fileRenderCount[$filename] ?? 0;
		return self::$fileSetNames[$filename][$index] ?? null;
	}

	/**
	 * Get both set name and link type for the next occurrence of a file
	 * This method ensures both values come from the same queue index
	 *
	 * @param string $filename The filename (without namespace prefix)
	 * @return array Array with 'setName' and 'linkType' keys (both string|null)
	 */
	public static function getFileParamsForRender( string $filename ): array {
		// Initialize render count for this file if not set
		if ( !isset( self::$fileRenderCount[$filename] ) ) {
			self::$fileRenderCount[$filename] = 0;
		}

		$index = self::$fileRenderCount[$filename];

		// Get both values at the same index
		$setName = self::$fileSetNames[$filename][$index] ?? null;
		$linkType = self::$fileLinkTypes[$filename][$index] ?? null;

		// Increment counter for next call
		self::$fileRenderCount[$filename]++;

		return [
			'setName' => $setName,
			'linkType' => $linkType
		];
	}

	/**
	 * Get the stored set name for the next occurrence of a specific file
	 * @deprecated Use getFileParamsForRender() instead
	 * This consumes from the queue, so each call returns the next set name in order
	 * @param string $filename The filename (without namespace prefix)
	 * @return string|null The set name, or null if not specified
	 */
	public static function getFileSetName( string $filename ): ?string {
		$params = self::getFileParamsForRender( $filename );
		return $params['setName'];
	}

	/**
	 * Reset the page layers flag (useful for testing)
	 */
	public static function resetPageLayersFlag(): void {
		self::$pageHasLayers = false;
		self::$fileSetNames = [];
		self::$fileRenderCount = [];
		self::$fileLinkTypes = [];
	}

	/**
	 * Hook: ParserBeforeInternalParse
	 * Scan the raw wikitext for layers= parameters as a fallback when
	 * parameter registration hooks don't work properly.
	 *
	 * @param mixed $parser Parser instance
	 * @param string &$text Wikitext being parsed (by reference)
	 * @param mixed $stripState Strip state object from core
	 * @return bool
	 */
	public static function onParserBeforeInternalParse( $parser, &$text, $stripState ): bool {
		// Handle null or non-string text (PHP 8.1+ strict)
		if ( $text === null || !is_string( $text ) ) {
			return true;
		}

		try {
			$textLen = strlen( $text );
			$preview = substr( $text, 0, 200 );
			self::log( "ParserBeforeInternalParse: text length=$textLen, preview: $preview" );

			// First, find ALL File: usages to establish the complete render order
			// This captures [[File:name.ext...]] patterns (with or without layers=)
			$allFilesPattern = '/\[\[File:([^|\]]+)(?:\|[^\]]*?)?\]\]/i';
			$allFileMatches = [];
			$fileMatchCount = preg_match_all( $allFilesPattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE );
			self::log( "File pattern matched $fileMatchCount times" );
			if ( $fileMatchCount ) {
				foreach ( $matches as $match ) {
					$filename = trim( $match[1][0] );
					// Use full match offset ($match[0][1]) not filename offset ($match[1][1])
					// This ensures consistent offset comparison with layersMap
					$offset = $match[0][1];
					$allFileMatches[] = [ 'filename' => $filename, 'offset' => $offset ];
				}
			}

			// Sort by offset to maintain document order
			usort( $allFileMatches, static function ( $a, $b ) {
				return $a['offset'] - $b['offset'];
			} );

			// Now extract layers= values with their offsets
			$fileLayersPattern = '/\[\[File:([^|\]]+)\|[^\]]*?layers?\s*=\s*([^|\]]+)/i';
			// filename => [offset => value, ...]
			$layersMap = [];
			self::log( 'Running layers regex on text: ' . substr( $text, 0, 200 ) );
			$matchCount = preg_match_all( $fileLayersPattern, $text, $allMatches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE );
			self::log( "Layers regex matched $matchCount times" );
			if ( $matchCount ) {
				foreach ( $allMatches as $match ) {
					$filename = trim( $match[1][0] );
					$offset = $match[0][1];
					$layersValue = trim( $match[2][0] );

					if ( !isset( $layersMap[$filename] ) ) {
						$layersMap[$filename] = [];
					}
					$layersMap[$filename][$offset] = $layersValue;
				}
			}

			// Extract layerslink= values (editor, viewer, lightbox)
			$layerslinkPattern = '/\[\[File:([^|\]]+)\|[^\]]*?layerslink\s*=\s*([^|\]]+)/i';
			$layerslinkMap = [];
			$linkMatchCount = preg_match_all( $layerslinkPattern, $text, $linkMatches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE );
			self::log( "Layerslink regex matched $linkMatchCount times" );
			if ( $linkMatchCount ) {
				foreach ( $linkMatches as $match ) {
					$filename = trim( $match[1][0] );
					$offset = $match[0][1];
					$linkValue = strtolower( trim( $match[2][0] ) );
					// Validate against allowed values
					if ( in_array( $linkValue, [ 'editor', 'editor-newtab', 'editor-return', 'editor-modal', 'viewer', 'lightbox' ], true ) ) {
						if ( !isset( $layerslinkMap[$filename] ) ) {
							$layerslinkMap[$filename] = [];
						}
						$layerslinkMap[$filename][$offset] = $linkValue;
						self::log( "Detected layerslink=$linkValue for $filename at offset $offset" );
					}
				}
			}

			// Build queues with correct positions (null for files without layers= at that position)
			foreach ( $allFileMatches as $fileMatch ) {
				$filename = $fileMatch['filename'];
				$offset = $fileMatch['offset'];

				// Initialize queues for this file if not exists
				if ( !isset( self::$fileSetNames[$filename] ) ) {
					self::$fileSetNames[$filename] = [];
				}
				if ( !isset( self::$fileLinkTypes[$filename] ) ) {
					self::$fileLinkTypes[$filename] = [];
				}

				// Check if this occurrence has a layers= value
				$layersValue = null;
				if ( isset( $layersMap[$filename] ) ) {
					// Find the layers value that matches this occurrence's offset exactly
					// Since both patterns use $match[0][1] (full match offset), they should be identical
					if ( isset( $layersMap[$filename][$offset] ) ) {
						$layersValue = $layersMap[$filename][$offset];
						// Remove this entry so it's not matched again
						unset( $layersMap[$filename][$offset] );
					}
				}

				// Check if this occurrence has a layerslink= value
				$linkType = null;
				if ( isset( $layerslinkMap[$filename][$offset] ) ) {
					$linkType = $layerslinkMap[$filename][$offset];
					unset( $layerslinkMap[$filename][$offset] );
				}

				// Queue the link type
				self::$fileLinkTypes[$filename][] = $linkType;
				if ( $linkType !== null ) {
					self::log( "Queued layerslink=$linkType for $filename" );
				}

				if ( $layersValue !== null ) {
					self::$pageHasLayers = true;
					$normalized = strtolower( $layersValue );
					$isBoolean = in_array( $normalized, [ 'on', 'off', 'none', 'true', 'false', 'all' ], true );
					self::$fileSetNames[$filename][] = $isBoolean ? $normalized : $layersValue;
					$queueLen = count( self::$fileSetNames[$filename] );
					self::log( "Detected layers=$layersValue for $filename (occurrence #$queueLen)" );
				} else {
					// Add null placeholder to keep queue aligned with render order
					self::$fileSetNames[$filename][] = null;
					$queueLen = count( self::$fileSetNames[$filename] );
					self::log( "No layers param for $filename (occurrence #$queueLen, placeholder added)" );
				}
			}

			// Fallback: check for any layers= text
			if ( strpos( $text, 'layers=' ) !== false || strpos( $text, 'layer=' ) !== false ) {
				self::$pageHasLayers = true;
				self::log( 'Found layers= in wikitext, setting pageHasLayers=true' );
			}
		} catch ( \Throwable $e ) {
			self::logError( 'ParserBeforeInternalParse error: ' . $e->getMessage() );
		}

		return true;
	}

	/**
	 * Resolve the LayersDatabase service while logging failures for diagnostics.
	 *
	 * @return LayersDatabase|null
	 */
	private static function getLayersDatabaseService(): ?LayersDatabase {
		try {
			return MediaWikiServices::getInstance()->getService( 'LayersDatabase' );
		} catch ( \Throwable $e ) {
			self::logError( 'Unable to resolve LayersDatabase service', [ 'exception' => $e ] );
			return null;
		}
	}

	/**
	 * Determine if the current request targets a File namespace page.
	 *
	 * @return bool
	 */
	private static function isFilePageContext(): bool {
		try {
			$context = RequestContext::getMain();
			$title = $context->getTitle();
			return $title && $title->inNamespace( NS_FILE );
		} catch ( \Throwable $e ) {
			return false;
		}
	}
}
