<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\Processors\ImageLinkProcessor;
use MediaWiki\Extension\Layers\Hooks\Processors\LayeredFileRenderer;
use MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use MediaWiki\Extension\Layers\Hooks\Processors\ThumbnailProcessor;
use MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

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
	 * Per-filename pending render counter set by onParserMakeImageParams for each
	 * [[File:...]] occurrence. onThumbnailBeforeProduceHTML consumes one count per
	 * render when it fires and, if consumed, uses the queue to look up the layer set.
	 *
	 * A counter is required instead of a boolean because parse and render phases can
	 * be decoupled in some code paths; multiple onParserMakeImageParams calls may happen
	 * before one or more ThumbnailBeforeProduceHTML calls.
	 *
	 * @var array<string, int>
	 */
	private static array $pendingRender = [];

	/**
	 * Per-image layer set hints pre-registered by {{#layers_hint:filename|setname}}.
	 *
	 * Populated during the parse phase (before thumbnails render) by the
	 * #layers_hint parser function.  When onThumbnailBeforeProduceHTML fires
	 * for a non-wikitext render (Cargo gallery, native <gallery>, etc.), it
	 * consults this map to find the correct named set for the image instead of
	 * always falling back to the latest set ('on' semantics).
	 *
	 * Keys are normalized file names (without "File:" prefix), values are set names.
	 * @var array<string, string>
	 */
	private static array $galleryHints = [];

	/**
	 * Queue of layerslink values per filename detected from wikitext (in order of appearance)
	 * e.g. ['ImageTest02.jpg' => ['editor', null, 'viewer']]
	 * @var array<string, array<string|null>>
	 */
	private static $fileLinkTypes = [];

	/**
	 * Fallback set-name queue populated by onParserMakeImageParams (indexed by render position).
	 * Used for template-embedded [[File:...|layerset=...]] references that onParserBeforeInternalParse
	 * cannot see because they exist inside templates not yet expanded when that hook fires.
	 * getFileParamsForRender falls back to this when the primary $fileSetNames queue has no entry.
	 * @var array<string, array<int, string>>
	 */
	private static array $fileParamLayerset = [];

	/**
	 * Counter tracking how many times onParserMakeImageParams has fired for each file
	 * during the current page parse. Used to correctly index into $fileParamLayerset.
	 *
	 * This is separate from $fileRenderCount because in PageForms multi-instance templates
	 * ALL onParserMakeImageParams calls happen during the parse phase, BEFORE any
	 * onThumbnailBeforeProduceHTML calls in the render phase. Using $fileRenderCount
	 * as the write index would cause all N instances to overwrite index 0.
	 * @var array<string, int>
	 */
	private static array $fileParseCount = [];

	/**
	 * Timestamp of the last request that triggered a state reset.
	 * Used to detect request boundaries in PHP-FPM (max_requests > 1).
	 * @var float
	 */
	private static float $lastResetRequestTime = 0.0;

	/**
	 * Ensure per-page static state is reset between HTTP requests.
	 *
	 * In PHP-FPM with max_requests > 1, static properties persist across
	 * requests. This method detects request boundaries using
	 * REQUEST_TIME_FLOAT and resets page-specific state (but NOT the
	 * stateless processor singletons, which are safe to reuse).
	 */
	private static function ensureRequestStateReset(): void {
		$requestTime = $_SERVER['REQUEST_TIME_FLOAT'] ?? 0.0;
		if ( $requestTime !== self::$lastResetRequestTime ) {
			self::$lastResetRequestTime = $requestTime;
			self::$pageHasLayers = false;
			self::$fileSetNames = [];
			self::$fileRenderCount = [];
			self::$fileLinkTypes = [];
			self::$fileParamLayerset = [];
			self::$fileParseCount = [];
			self::$pendingRender = [];
			self::$galleryHints = [];
		}
	}

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
		try {
			if ( self::isFilePageContext() ) {
				return true;
			}
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
					// Register viewer module via ParserOutput for reliable cached delivery
					if ( $parser && method_exists( $parser, 'getOutput' ) ) {
						$parser->getOutput()->addModules( [ 'ext.layers' ] );
					}
				}
			}
		} catch ( \Throwable $e ) {
			self::logError( 'ImageBeforeProduceHTML error', [ 'exception' => $e ] );
		}

		return true;
	}

	/**
	 * Handle wikitext after parsing to find and replace layer image syntax
	 * This catches [[File:Example.jpg|layerset=on]] (or layers= for backwards compatibility)
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
		// The extension works through the layerset= parameter in file syntax instead
		// To enable parser functions, define magic words in i18n and uncomment below:
		// $parser->setFunctionHook( 'layeredfile', [ self::class, 'renderLayeredFile' ], \Parser::SFH_OBJECT_ARGS );

		// Pre-register per-image layer set hints for gallery renders.
		// {{#layers_hint:filename|setname}} is called before a gallery renders
		// (e.g. via Cargo format=template hint pass) so the correct named set
		// is used when ThumbnailBeforeProduceHTML fires for non-wikitext renders.
		$parser->setFunctionHook( 'layers_hint', [ self::class, 'parserFunctionLayersHint' ] );

		return true;
	}

	/**
	 * Parser function: {{#layers_hint:filename|setname}}
	 *
	 * Registers a per-image layer set hint that is consumed by
	 * onThumbnailBeforeProduceHTML for non-wikitext gallery renders.
	 * Returns an empty string (no visible output).
	 *
	 * @param mixed $parser Unused
	 * @param string $filename File name (with or without "File:" prefix)
	 * @param string $setname Layer set name (e.g. 'default', 'anatomy')
	 * @return string Empty string
	 */
	public static function parserFunctionLayersHint( $parser, string $filename = '', string $setname = '' ): string {
		self::registerGalleryHint( trim( $filename ), trim( $setname ) );
		return '';
	}

	/**
	 * Register a per-image layer set hint for non-wikitext gallery renders.
	 *
	 * Called by {{#layers_hint:}} and by CargoLayersGalleryFormat when it
	 * iterates Cargo query rows before the gallery renders thumbnails.
	 *
	 * @param string $filename File name (with or without "File:"/"Image:" prefix)
	 * @param string $setname Layer set name (e.g. 'anatomy', 'default')
	 */
	public static function registerGalleryHint( string $filename, string $setname ): void {
		$filename = trim( $filename );
		$setname  = trim( $setname );
		if ( $filename === '' || $setname === '' ) {
			return;
		}
		// Normalize: strip "File:" or "Image:" prefix if present.
		$normalized = preg_replace( '/^(?:File|Image):\s*/i', '', $filename );
		if ( $normalized !== '' ) {
			self::$galleryHints[$normalized] = $setname;
		}
	}

	/**
	 * Render a file with layers
	 * Usage: {{#layeredfile:ImageTest02.jpg|500px|layerset=on|caption}}
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

		// Only consume queue entries for renders that originated from wikitext [[File:...]].
		// onParserMakeImageParams increments $pendingRender[$filename] immediately before
		// each such render. Cargo gallery (#cargo_query format=gallery), native
		// <gallery> tags, and other parser-function thumbnails do NOT go through
		// onParserMakeImageParams, so they never increment the counter.
		// We consume one queued count here so it cannot accidentally match a later
		// non-wikitext render of the same filename.
		$isWikitextRender = $filename && ( ( self::$pendingRender[$filename] ?? 0 ) > 0 );
		if ( $isWikitextRender ) {
			self::$pendingRender[$filename]--;
			if ( self::$pendingRender[$filename] <= 0 ) {
				unset( self::$pendingRender[$filename] );
			}
		}

		// Get both set name and link type from queue.
		// For wikitext renders: use the queued set name and link type.
		// For non-wikitext renders (Cargo gallery, native <gallery>, etc.): check
		// $galleryHints first (pre-registered by {{#layers_hint:filename|setname}}),
		// then fall back to 'on' (latest available layer set) if no hint is present.
		if ( $isWikitextRender ) {
			$fileParams = self::getFileParamsForRender( $filename );
		} else {
			$defaultFallback = self::isFilePageContext() ? null : 'on';
			$hintedSetName = ( $filename && isset( self::$galleryHints[$filename] ) )
				? self::$galleryHints[$filename]
				: $defaultFallback;
			$fileParams = [ 'setName' => $hintedSetName, 'linkType' => null ];
		}

		// Log queue state for troubleshooting foreign file issues
		self::logDebug(
			"onThumbnailBeforeProduceHTML: filename=$filename, linkType=" .
			( $fileParams['linkType'] ?? 'null' )
		);
		self::logDebug(
			"Queue state for $filename: " . json_encode( self::$fileLinkTypes[$filename] ?? [] )
		);

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

		// Always track parse occurrences BEFORE any early returns, so $fileParseCount stays
		// aligned with $fileRenderCount (both increment once per image occurrence, in the same order).
		// This ensures the fallback $fileParamLayerset indices are correct even when some
		// images on the page have no layerset= param.
		$parseIndex = null;
		if ( $fileName !== 'null' ) {
			if ( !isset( self::$fileParseCount[$fileName] ) ) {
				self::$fileParseCount[$fileName] = 0;
			}
			$parseIndex = self::$fileParseCount[$fileName]++;
		}

		// Signal to onThumbnailBeforeProduceHTML that this file has one more pending
		// wikitext [[File:...]] render to consume. This is placed BEFORE any early
		// returns so ALL occurrences (with or without layerset=) are counted.
		if ( $fileName !== 'null' ) {
			self::$pendingRender[$fileName] = ( self::$pendingRender[$fileName] ?? 0 ) + 1;
		}

		// Handle layerslink parameter - queue it and remove from params to prevent caption leakage
		if ( isset( $params['layerslink'] ) ) {
			$linkValue = strtolower( trim( (string)$params['layerslink'] ) );
			$validLinkValues = [ 'viewer', 'lightbox', 'editor', 'editor-newtab', 'editor-return', 'editor-modal' ];
			if ( in_array( $linkValue, $validLinkValues, true ) && $fileName !== 'null' ) {
				if ( !isset( self::$fileLinkTypes[$fileName] ) ) {
					self::$fileLinkTypes[$fileName] = [];
				}
				self::$fileLinkTypes[$fileName][] = $linkValue;
				self::log( "Queued layerslink=$linkValue for $fileName from ParserMakeImageParams" );
			}
			// Remove from params to prevent it from becoming caption text
			unset( $params['layerslink'] );
		}

		// Normalize aliases: 'layer', 'layers' -> 'layerset' (layerset is primary)
		// 'layerset' is the preferred parameter, 'layers' and 'layer' are for backwards compatibility
		if ( !isset( $params['layerset'] ) ) {
			if ( isset( $params['layers'] ) ) {
				$params['layerset'] = $params['layers'];
				unset( $params['layers'] );
			} elseif ( isset( $params['layer'] ) ) {
				$params['layerset'] = $params['layer'];
				unset( $params['layer'] );
			}
		}

		// MediaWiki does not recognise 'layerset', 'layers', or 'layer' as image-option keywords,
		// so it treats them as caption text instead of setting $params['layerset'] directly.
		// This happens for BOTH inline and template-embedded images, but inline images already
		// work via onParserBeforeInternalParse which pre-scans raw wikitext.
		// For template-embedded images (where the pre-scan cannot see the [[File:...]] inside
		// a template body), we must extract the value from the frame caption here.
		// Example: [[File:{{{img}}}|x300px|layerset=default]] → caption = 'layerset=default'
		if ( !isset( $params['layerset'] ) ) {
			$captionText = isset( $params['frame']['caption'] )
				? trim( (string)$params['frame']['caption'] )
				: '';
			if ( $captionText !== ''
				&& preg_match( '/^(layerset|layers?)\s*=\s*(.+)$/i', $captionText, $matches )
			) {
				$params['layerset'] = trim( $matches[2] );
				// Clear the caption-derived attributes so 'layerset=default' does not
				// appear as visible alt text, tooltip, or caption on the rendered image.
				$params['frame']['caption'] = '';
				if ( isset( $params['frame']['alt'] )
					&& (string)$params['frame']['alt'] === $captionText
				) {
					unset( $params['frame']['alt'] );
				}
				if ( isset( $params['frame']['title'] )
					&& (string)$params['frame']['title'] === $captionText
				) {
					$params['frame']['title'] = '';
				}
			}
		}

		if ( !isset( $params['layerset'] ) ) {
			return true;
		}

		// Ensure we have a File object
		$file = self::ensureFileObject( $file, $title );

		// Normalize the layerset parameter value
		$layersRaw = self::normalizeLayersParam( $params['layerset'] );

		// Handle disabled layers
		if ( $layersRaw === false || $layersRaw === 'none' || $layersRaw === 'off' ) {
			unset( $params['layerSetId'], $params['layerData'], $params['layersjson'], $params['layersetid'] );
			return true;
		}

		// Mark page has layers
		self::$pageHasLayers = true;
		if ( $parser && method_exists( $parser, 'getOutput' ) ) {
			$output = $parser->getOutput();
			if ( $output && method_exists( $output, 'setPageProperty' ) ) {
				$output->setPageProperty( 'layers-present', '1' );
			}
		}
		// Register viewer module via ParserOutput for reliable cached delivery
		if ( $parser && method_exists( $parser, 'getOutput' ) ) {
			$parser->getOutput()->addModules( [ 'ext.layers' ] );
		}

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

		// Register set name for template-embedded file fallback.
		// onParserBeforeInternalParse fires before template expansion and cannot see [[File:...]]
		// patterns inside templates. We record the set name here so onThumbnailBeforeProduceHTML
		// can find it via getFileParamsForRender even when the primary $fileSetNames queue has no
		// entry for this file occurrence (i.e. render index is beyond what the pre-parse hook saw).
		//
		// Use $parseIndex (pre-computed at function entry from $fileParseCount) NOT $fileRenderCount.
		// In PageForms multi-instance templates, ALL onParserMakeImageParams calls happen during
		// the parse phase, BEFORE any onThumbnailBeforeProduceHTML calls in the render phase.
		// If we used $fileRenderCount here, every template instance would see render count = 0
		// and all N instances would overwrite $fileParamLayerset[filename][0], leaving only
		// the last occurrence's set name. The render phase would then find data at index 0 only.
		if ( $fileName !== 'null' && $parseIndex !== null ) {
			if ( !isset( self::$fileParamLayerset[$fileName] ) ) {
				self::$fileParamLayerset[$fileName] = [];
			}
			$queueVal = ( $layersRaw === true || $layersRaw === 'on' || $layersRaw === 'all' )
				? 'on'
				: (string)$layersRaw;
			self::$fileParamLayerset[$fileName][$parseIndex] = $queueVal;
			self::log( "Registered fallback set name '$queueVal' for $fileName at index $parseIndex" );
		}

		// Finalize params
		$params['layerset'] = 'on';
		if ( isset( $params['layerData'] ) && is_array( $params['layerData'] ) ) {
			$params['layersjson'] = json_encode( $params['layerData'], JSON_UNESCAPED_UNICODE );
		}
		if ( isset( $params['layerSetId'] ) ) {
			$params['layersetid'] = (string)$params['layerSetId'];
		}

		self::log( sprintf(
			'Processed layerset param: hasData=%s, hasSetId=%s',
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
	 * Normalize a raw filename captured from wikitext to MediaWiki's canonical
	 * file DB key, so queue keys match the name later reported by
	 * File::getName() in onParserMakeImageParams / onThumbnailBeforeProduceHTML.
	 *
	 * Without this, a lower-case first letter in wikitext (e.g. [[File:somepdf.pdf]])
	 * would be keyed as "somepdf.pdf" while the render side looks it up as the
	 * canonical "Somepdf.pdf", so the layerset queue never matches and overlays
	 * silently fail to appear. Respects $wgCapitalLinks via Title normalization.
	 *
	 * @param string $raw Raw filename captured from the [[File:...]] regex
	 * @return string Canonical file DB key (underscores, wiki-cased)
	 */
	private static function normalizeFileKey( string $raw ): string {
		$raw = trim( $raw );
		$title = Title::makeTitleSafe( NS_FILE, $raw );
		if ( $title ) {
			return $title->getDBkey();
		}
		// Fallback: mimic default MediaWiki normalization ($wgCapitalLinks = true)
		return str_replace( ' ', '_', ucfirst( $raw ) );
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
		// Fallback: use set name captured in onParserMakeImageParams for template-embedded files
		// that onParserBeforeInternalParse did not see (templates are not yet expanded at that point).
		if ( $setName === null ) {
			$setName = self::$fileParamLayerset[$filename][$index] ?? null;
			if ( $setName !== null ) {
				self::log( "getFileParamsForRender: using fileParamLayerset fallback for $filename[$index]: $setName" );
			}
		}
		$linkType = self::$fileLinkTypes[$filename][$index] ?? null;

		// Increment counter for next call
		self::$fileRenderCount[$filename]++;

		return [
			'setName' => $setName,
			'linkType' => $linkType
		];
	}

	/**
	 * Reset the page layers flag (useful for testing)
	 */
	public static function resetPageLayersFlag(): void {
		self::$pageHasLayers = false;
		self::$fileSetNames = [];
		self::$fileRenderCount = [];
		self::$fileLinkTypes = [];
		self::$fileParamLayerset = [];
		self::$fileParseCount = [];
		self::$pendingRender = [];
		self::$galleryHints = [];
		self::$lastResetRequestTime = $_SERVER['REQUEST_TIME_FLOAT'] ?? 0.0;
		// Reset processor singletons to prevent stale state in long-running processes
		self::$imageLinkProcessor = null;
		self::$thumbnailProcessor = null;
		self::$htmlInjector = null;
		self::$paramExtractor = null;
		self::$layeredFileRenderer = null;
		self::$layerInjector = null;
	}

	/**
	 * Hook: ParserBeforeInternalParse
	 * Scan the raw wikitext for layerset= (or layers= for backwards compatibility)
	 * parameters as a fallback when parameter registration hooks don't work properly.
	 *
	 * @param mixed $parser Parser instance
	 * @param string &$text Wikitext being parsed (by reference)
	 * @param mixed $stripState Strip state object from core
	 * @return bool
	 */
	public static function onParserBeforeInternalParse( $parser, &$text, $stripState ): bool {
		// Ensure stale state from previous requests is cleared (PHP-FPM reuse)
		self::ensureRequestStateReset();

		// Handle null or non-string text (PHP 8.1+ strict)
		if ( $text === null || !is_string( $text ) ) {
			return true;
		}

		try {
			$textLen = strlen( $text );
			$preview = substr( $text, 0, 200 );
			self::logDebug( "ParserBeforeInternalParse: text length=$textLen, preview: $preview" );

			// First, find ALL File: usages to establish the complete render order
			// This captures [[File:name.ext...]] patterns (with or without layerset=)
			$allFilesPattern = '/\[\[File:([^|\]]+)(?:\|[^\]]*?)?\]\]/i';
			$allFileMatches = [];
			$fileMatchCount = preg_match_all( $allFilesPattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE );
			self::log( "File pattern matched $fileMatchCount times" );
			if ( $fileMatchCount ) {
				foreach ( $matches as $match ) {
					// Normalize to MediaWiki's canonical file DB key so queue lookups
					// match the name reported by File::getName() at render time.
					// This ensures queue lookups work correctly when ThumbnailBeforeProduceHTML is called
					$filename = self::normalizeFileKey( $match[1][0] );
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

				// Now extract layerset=/layers= values with their offsets
			// Matches: layerset=, layers=, layer= (backwards compatibility)
			$fileLayersPattern = '/\[\[File:([^|\]]+)\|[^\]]*?(?:layerset|layers?)\s*=\s*([^|\]]+)/i';
			// filename => [offset => value, ...]
			$layersMap = [];
			self::logDebug( 'Running layerset/layers regex on text: ' . substr( $text, 0, 200 ) );
			$matchCount = preg_match_all(
				$fileLayersPattern,
				$text,
				$allMatches,
				PREG_SET_ORDER | PREG_OFFSET_CAPTURE
			);
			self::log( "Layerset/layers regex matched $matchCount times" );
			if ( $matchCount > 0 && $parser && method_exists( $parser, 'getOutput' ) ) {
				$output = $parser->getOutput();
				if ( $output && method_exists( $output, 'setPageProperty' ) ) {
					$output->setPageProperty( 'layers-present', '1' );
				}
			}
			if ( $matchCount > 0 && $parser && method_exists( $parser, 'getOutput' ) ) {
				$parser->getOutput()->addModules( [ 'ext.layers' ] );
			}
			if ( $matchCount ) {
				foreach ( $allMatches as $match ) {
					// Normalize to canonical file DB key (see normalizeFileKey)
					$filename = self::normalizeFileKey( $match[1][0] );
					$offset = $match[0][1];
					$layersValue = trim( $match[2][0] );

					if ( !isset( $layersMap[$filename] ) ) {
						$layersMap[$filename] = [];
					}
					$layersMap[$filename][$offset] = $layersValue;
				}
			}

			// Build queues with correct positions (null for files without layerset/layers= at that position)
			foreach ( $allFileMatches as $fileMatch ) {
				$filename = $fileMatch['filename'];
				$offset = $fileMatch['offset'];

				// Initialize queue for this file if not exists
				if ( !isset( self::$fileSetNames[$filename] ) ) {
					self::$fileSetNames[$filename] = [];
				}

				// Check if this occurrence has a layerset= or layers= value
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

				if ( $layersValue !== null ) {
					self::$pageHasLayers = true;
					$normalized = strtolower( $layersValue );
					$isBoolean = in_array( $normalized, [ 'on', 'off', 'none', 'true', 'false', 'all' ], true );
					self::$fileSetNames[$filename][] = $isBoolean ? $normalized : $layersValue;
					$queueLen = count( self::$fileSetNames[$filename] );
					self::log( "Detected layerset=$layersValue for $filename (occurrence #$queueLen)" );
				} else {
					// Add null placeholder to keep queue aligned with render order
					self::$fileSetNames[$filename][] = null;
									$queueLen = count( self::$fileSetNames[$filename] );
					self::log( "No layerset/layers param for $filename (occurrence #$queueLen, placeholder added)" );
				}
			}

			// Extract layerslink= values (editor, viewer, lightbox) and REMOVE from text
			// to prevent them from appearing as caption text in thumbnails
			$layerslinkPattern = '/\[\[File:([^|\]]+)\|[^\]]*?layerslink\s*=\s*([^|\]]+)/i';
			$layerslinkMap = [];
			$linkMatchCount = preg_match_all(
				$layerslinkPattern,
				$text,
				$linkMatches,
				PREG_SET_ORDER | PREG_OFFSET_CAPTURE
			);
			self::log( "Layerslink regex matched $linkMatchCount times" );
			if ( $linkMatchCount ) {
				foreach ( $linkMatches as $match ) {
					// Normalize to canonical file DB key (see normalizeFileKey)
					$filename = self::normalizeFileKey( $match[1][0] );
					$offset = $match[0][1];
					$linkValue = strtolower( trim( $match[2][0] ) );
					// Validate against allowed values
					$allowedLinks = [
						'editor', 'editor-newtab', 'editor-return',
						'editor-modal', 'viewer', 'lightbox'
					];
					if ( in_array( $linkValue, $allowedLinks, true ) ) {
						if ( !isset( $layerslinkMap[$filename] ) ) {
							$layerslinkMap[$filename] = [];
						}
						$layerslinkMap[$filename][$offset] = $linkValue;
						self::log( "Detected layerslink=$linkValue for $filename at offset $offset" );
					}
				}
			}

			// Strip layerslink=value from wikitext to prevent caption leakage
			// Pattern matches: |layerslink=value (with optional whitespace)
			// We remove just the parameter, keeping surrounding pipe delimiters intact
			$text = preg_replace(
				'/\|layerslink\s*=\s*[^|\]]+/i',
				'',
				$text
			);
			self::log( 'Stripped layerslink parameters from wikitext' );

			// Build fileLinkTypes queues matching file render order
			foreach ( $allFileMatches as $fileMatch ) {
				$filename = $fileMatch['filename'];
				$offset = $fileMatch['offset'];

				// Initialize queue for this file if not exists
				if ( !isset( self::$fileLinkTypes[$filename] ) ) {
					self::$fileLinkTypes[$filename] = [];
				}

				// Check if this occurrence has a layerslink= value
				$linkType = null;
				if ( isset( $layerslinkMap[$filename][$offset] ) ) {
					$linkType = $layerslinkMap[$filename][$offset];
					unset( $layerslinkMap[$filename][$offset] );
				}

				self::$fileLinkTypes[$filename][] = $linkType;
				if ( $linkType !== null ) {
					self::log( "Queued layerslink=$linkType for $filename" );
				}
			}

			// Pre-process <gallery> blocks: extract per-image layerset= hints and
			// strip the option so it does not appear as visible caption text.
			if ( stripos( $text, '<gallery' ) !== false && stripos( $text, 'layerset=' ) !== false ) {
				$text = preg_replace_callback(
					'/<gallery\b[^>]*>.*?<\/gallery>/si',
					[ self::class, 'preprocessGalleryBlock' ],
					$text
				);
				self::log( 'Preprocessed <gallery> blocks for layerset= hints' );
			}

			// Strip layerset=, layers=, and layer= ONLY from within [[File:...]] or [[Image:...]] links
			// to prevent caption leakage. We must NOT strip these from {{#slide:...}} parser functions!
			// Use a callback to selectively strip only within file link contexts.
			$text = preg_replace_callback(
				'/\[\[(File|Image):([^\]]+)\]\]/i',
				static function ( $match ) {
					// Strip layerset=, layers=, layer= parameters from within the file link
					$inner = preg_replace(
						'/\|(?:layerset|layers?)\s*=\s*[^|\]]+/i',
						'',
						$match[0]
					);
					return $inner;
				},
				$text
			);
			self::log( 'Stripped layerset/layers/layer parameters from file links' );
		} catch ( \Throwable $e ) {
			self::logError( 'ParserBeforeInternalParse error: ' . $e->getMessage() );
		}

		return true;
	}

	/**
	 * Callback for preg_replace_callback over native <gallery> blocks.
	 *
	 * For each image line that contains a |layerset=X option, registers a
	 * gallery hint via registerGalleryHint() and strips the option from the
	 * line so it does not appear as visible caption text in the rendered
	 * gallery.
	 *
	 * @param array $matches Regex match; $matches[0] is the full <gallery> block
	 * @return string Gallery block with layerset= stripped from image lines
	 */
	private static function preprocessGalleryBlock( array $matches ): string {
		$block = $matches[0];
		// Fast-path: skip blocks that contain no layerset= at all.
		if ( stripos( $block, 'layerset=' ) === false ) {
			return $block;
		}
		return preg_replace_callback(
			// Match image lines: optional indent + File:/Image: + filename + pipe options
			'/^([ \t]*(?:File|Image):([^\|\n]+))(\|[^\n]*)$/mi',
			static function ( $line ) {
				// "  File:Name.jpg" (with any indent)
				$prefix = $line[1];
				// "Name.jpg"
				$filename = trim( $line[2] );
				// "|opt1|opt2|caption"
				$rest = $line[3];
				if ( !preg_match( '/\blayerset\s*=\s*([^\|\n]+)/i', $rest, $lsMatch ) ) {
					// No layerset= on this line — leave untouched.
					return $line[0];
				}
				$setname = trim( $lsMatch[1] );
				self::registerGalleryHint( $filename, $setname );
				// Strip the layerset= option (and its leading pipe) from the options string.
				$rest = preg_replace( '/\|?\s*layerset\s*=\s*[^\|\n]*/i', '', $rest );
				// Re-normalise: ensure remaining options start with a single pipe.
				$rest = ( $rest !== '' ) ? '|' . ltrim( $rest, '|' ) : '';
				return $prefix . $rest;
			},
			$block
		);
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
