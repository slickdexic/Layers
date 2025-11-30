<?php

namespace MediaWiki\Extension\Layers\Hooks;

use Exception;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;

class WikitextHooks {

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
	 * Cached logger instance
	 * @var LoggerInterface|null
	 */
	private static ?LoggerInterface $logger = null;

	/**
	 * Get logger instance (lazy singleton via DI container)
	 *
	 * @return LoggerInterface|null
	 */
	private static function getLogger(): ?LoggerInterface {
		if ( self::$logger === null ) {
			try {
				$services = MediaWikiServices::getInstance();
				self::$logger = $services->get( 'LayersLogger' );
			} catch ( \Throwable $e ) {
				// Fallback if service is unavailable
				return null;
			}
		}
		return self::$logger;
	}

	/**
	 * Log a debug message if logger is available
	 *
	 * @param string $message
	 * @param array $context
	 */
	private static function log( string $message, array $context = [] ): void {
		$logger = self::getLogger();
		if ( $logger ) {
			$logger->info( "Layers: $message", $context );
		}
	}

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
				// Use helper method for clean injection
				$setName = $extractor->getSetName( $layersFlag );
				self::injectLayersIntoAttributes( $attribs, $file, $setName, 'ImageBeforeProduceHTML' );
			}
		} catch ( \Throwable $e ) {
			$logger = self::getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: ImageBeforeProduceHTML error', [ 'exception' => $e ] );
			}
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
	 * Attempt to extract layers flag from data-mw JSON embedded in generated HTML.
	 * Looks into originalArgs and options arrays for 'layers' or 'layer'.
	 *
	 * @param string $html
	 * @return string|null 'all'|'on'|'off'|'none' or null if not found
	 * @deprecated Use LayersParamExtractor::extractFromDataMw() directly for new code
	 */
	private static function extractLayersFromDataMw( string $html ): ?string {
		return self::getParamExtractor()->extractFromDataMw( $html );
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
		try {
			$extractor = self::getParamExtractor();
			$injector = self::getHtmlInjector();

			// Extract layers flag from all available sources
			$layersFlag = $extractor->extractFromAll(
				$handlerParams,
				$frameParams,
				[],
				is_string( $res ) ? $res : null
			);

			// Respect explicit off/none
			if ( $extractor->isDisabled( $layersFlag ) ) {
				return true;
			}

			// Check for direct JSON layer data in params
			$layersArray = $extractor->extractLayersJson( $handlerParams );

			// Enable layers if we have a valid parameter or direct JSON
			if ( $file && ( $layersFlag !== null || $layersArray !== null ) ) {
				// If no direct JSON, fetch from database
				if ( $layersArray === null ) {
					$setName = $extractor->getSetName( $layersFlag );
					// Also check queue for set name (backward compat)
					if ( $setName === null ) {
						$setName = self::getFileSetName( $file->getName() );
					}

					$res = self::injectLayersIntoHtml(
						(string)$res,
						$file,
						$setName,
						'MakeImageLink2'
					);
				} else {
					// Direct injection with provided layer data
					$dimensions = $injector->getFileDimensions( $file );
					$res = $injector->injectIntoHtml(
						(string)$res,
						$layersArray,
						$dimensions['width'],
						$dimensions['height'],
						'MakeImageLink2-direct'
					);
					self::$pageHasLayers = true;
				}

				// If no layers were found but intent was explicit, add intent marker
				if ( strpos( $res, 'data-layer-data=' ) === false && $layersFlag !== null ) {
					$res = $injector->injectIntentMarker( (string)$res );
				}
			}
		} catch ( \Throwable $e ) {
			$logger = self::getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: MakeImageLink2 error', [ 'exception' => $e ] );
			}
		}

		return true;
	}

	/**
	 * LinkerMakeImageLink hook: MW 1.44 path for altering generated <img> HTML.
	 * Mirrors onMakeImageLink2 so we work across core versions.
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
		try {
			$extractor = self::getParamExtractor();
			$injector = self::getHtmlInjector();

			// Extract layers flag from all available sources
			$layersFlag = $extractor->extractFromAll(
				$handlerParams,
				$frameParams,
				[],
				is_string( $res ) ? $res : null
			);

			// Respect explicit off/none
			if ( $extractor->isDisabled( $layersFlag ) ) {
				return true;
			}

			// Check for direct JSON layer data in params
			$layersArray = $extractor->extractLayersJson( $handlerParams );

			// Enable layers if we have a valid parameter or direct JSON
			if ( $file && ( $extractor->isDefaultEnabled( $layersFlag ) || $layersArray !== null ) ) {
				// If no direct JSON, fetch from database
				if ( $layersArray === null ) {
					$setName = $extractor->getSetName( $layersFlag );

					$res = self::injectLayersIntoHtml(
						(string)$res,
						$file,
						$setName,
						'LinkerMakeImageLink'
					);
				} else {
					// Direct injection with provided layer data
					$dimensions = $injector->getFileDimensions( $file );
					$res = $injector->injectIntoHtml(
						(string)$res,
						$layersArray,
						$dimensions['width'],
						$dimensions['height'],
						'LinkerMakeImageLink-direct'
					);
					self::$pageHasLayers = true;
				}

				// If no layers were found but intent was explicit, add intent marker
				if ( strpos( $res, 'data-layer-data=' ) === false && $layersFlag !== null ) {
					$res = $injector->injectIntentMarker( (string)$res );
				}
			}
		} catch ( \Throwable $e ) {
			$logger = self::getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: LinkerMakeImageLink error', [ 'exception' => $e ] );
			}
		}

		return true;
	}

	/**
	 * LinkerMakeMediaLinkFile hook: another path used by MW to render <img> HTML within links.
	 * We mirror the same injection logic here.
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
		try {
			if ( !$file ) {
				return true;
			}

			// Extract layers param from result HTML or attributes
			$param = self::extractLayersParamFromMediaLink( (string)$res, $attribs );
			if ( $param === null ) {
				return true;
			}

			$extractor = self::getParamExtractor();
			$injector = self::getHtmlInjector();

			// Respect explicit off/none
			if ( $extractor->isDisabled( $param ) ) {
				return true;
			}

			// Resolve layer data based on the param value
			$layersArray = self::resolveLayerSetFromParam( $file, $param );

			if ( $layersArray !== null ) {
				// Use injector for HTML modification
				$dimensions = $injector->getFileDimensions( $file );
				$res = $injector->injectIntoHtml(
					(string)$res,
					$layersArray,
					$dimensions['width'],
					$dimensions['height'],
					'LinkerMakeMediaLinkFile'
				);

				// Also set attributes via reference array for core-generated markup paths
				if ( is_array( $attribs ) ) {
					$injector->injectIntoAttributes(
						$attribs,
						$layersArray,
						$dimensions['width'],
						$dimensions['height']
					);
				}

				self::$pageHasLayers = true;
			} else {
				// No inline data, but explicit param detected: mark for client API fallback
				if ( is_array( $attribs ) ) {
					$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
					$attribs['data-layers-intent'] = 'on';
				}
				$res = $injector->injectIntentMarker( (string)$res );
			}
		} catch ( \Throwable $e ) {
			$logger = self::getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: LinkerMakeMediaLinkFile error', [ 'exception' => $e ] );
			}
		}
		return true;
	}

	/**
	 * Extract layers parameter from media link HTML or attributes
	 *
	 * @param string $html The HTML string
	 * @param array $attribs The attributes array
	 * @return string|null The normalized param value, or null if not found
	 */
	private static function extractLayersParamFromMediaLink( string $html, array $attribs ): ?string {
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
	private static function resolveLayerSetFromParam( $file, string $param ): ?array {
		$db = self::getLayersDatabaseService();
		if ( !$db ) {
			return null;
		}

		$filename = $file->getName();
		$sha1 = $file->getSha1();

		// 'on' or 'all' => show default set
		if ( $param === 'on' || $param === 'all' ) {
			$latest = $db->getLatestLayerSet( $filename, $sha1 );
			return self::extractLayersFromSet( $latest );
		}

		// 'id:123' => specific set by ID
		if ( preg_match( '/^id:(\d+)$/', $param, $idM ) ) {
			$ls = $db->getLayerSet( (int)$idM[1] );
			return self::extractLayersFromSet( $ls );
		}

		// 'name:setname' => specific named set
		if ( preg_match( '/^name:(.+)$/', $param, $nm ) ) {
			$ls = $db->getLayerSetByName( $filename, $sha1, $nm[1] );
			return self::extractLayersFromSet( $ls );
		}

		// CSV of short IDs (e.g., 'abc1,def2') => subset from latest
		if ( preg_match( '/^[0-9a-f]{2,8}(?:\s*,\s*[0-9a-f]{2,8})*$/i', $param ) ) {
			$latest = $db->getLatestLayerSet( $filename, $sha1 );
			if ( $latest && isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] ) ) {
				$wanted = array_map( 'trim', explode( ',', strtolower( $param ) ) );
				$subset = [];
				foreach ( (array)$latest['data']['layers'] as $layer ) {
					$id = strtolower( (string)( $layer['id'] ?? '' ) );
					$short = substr( $id, 0, 4 );
					if ( in_array( $short, $wanted, true ) ) {
						$subset[] = $layer;
					}
				}
				return $subset;
			}
			return null;
		}

		// Any other value => treat as named set lookup
		$ls = $db->getLayerSetByName( $filename, $sha1, $param );
		return self::extractLayersFromSet( $ls );
	}

	/**
	 * Extract layers array from a layer set result
	 *
	 * @param array|null $layerSet The layer set from database
	 * @return array|null The layers array, or null
	 */
	private static function extractLayersFromSet( ?array $layerSet ): ?array {
		if ( !$layerSet || !isset( $layerSet['data'] ) ) {
			return null;
		}
		return ( isset( $layerSet['data']['layers'] ) && is_array( $layerSet['data']['layers'] ) )
			? $layerSet['data']['layers']
			: null;
	}

	/**
	 * Register parser functions and hooks
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
		return true;
	}

	/**
	 * Newer MW: ensure our options are recognized in image syntax so they propagate.
	 * @param array &$options
	 * @return bool
	 */
	public static function onParserGetImageLinkOptions( array &$options ): bool {
		self::log( 'Adding image link options' );

		foreach ( [ 'layers', 'layer', 'layersjson', 'layersetid' ] as $opt ) {
			if ( !in_array( $opt, $options, true ) ) {
				$options[] = $opt;
			}
		}
		return true;
	}

	/**
	 * Render a file with layers
	 * Usage: {{#layeredfile:ImageTest02.jpg|500px|layers=on|caption}}
	 * @param mixed $parser The parser object
	 * @param mixed $frame The frame object
	 * @param array $args The arguments array
	 * @return string
	 */
	public static function renderLayeredFile( $parser, $frame, $args ) {
		try {
			// Parse arguments - first is filename, rest are key=value or simple values
			if ( empty( $args ) ) {
				return '<span class="error">No filename specified</span>';
			}

			$filename = isset( $args[0] ) ? trim( $frame->expand( $args[0] ) ) : '';
			$size = isset( $args[1] ) ? trim( $frame->expand( $args[1] ) ) : '';
			$layersArg = isset( $args[2] ) ? trim( $frame->expand( $args[2] ) ) : '';
			$caption = isset( $args[3] ) ? trim( $frame->expand( $args[3] ) ) : '';

			if ( empty( $filename ) ) {
				return '<span class="error">No filename specified</span>';
			}

			// Parse the layers parameter
			// default to off
			$layersParam = 'off';
			if ( !empty( $layersArg ) && strpos( $layersArg, 'layers=' ) === 0 ) {
				// Remove 'layers=' prefix
				$layersParam = substr( $layersArg, 7 );
			} elseif ( $layersArg === 'layers' || $layersArg === 'on' ) {
				$layersParam = 'on';
			}

			// Get the file
			$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
				? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
				: null;
			$repoGroup = $services ? $services->getRepoGroup() : null;
			$file = $repoGroup ? $repoGroup->findFile( $filename ) : null;

			if ( !$file ) {
				$fn = htmlspecialchars( $filename );
				return '<span class="error">File not found: ' . $fn . '</span>';
			}

			// If layers are not requested, fall back to normal image display
			if ( $layersParam === 'off' ) {
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}

			// Check for layer data
			$db = self::getLayersDatabaseService();
			if ( !$db ) {
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}
			$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );
			if ( empty( $layerSets ) ) {
				// Fall back to normal image display
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}

			// Parse size parameter
			// default width
			$width = 300;
			if ( preg_match( '/(\d+)px/', $size, $sizeMatch ) ) {
				$width = intval( $sizeMatch[1] );
			} elseif ( preg_match( '/x(\d+)px/', $size, $sizeMatch ) ) {
				$width = intval( $sizeMatch[1] );
			} elseif ( $size === 'thumb' ) {
				// MediaWiki default thumb size
				$width = 220;
			}

			// Generate layered thumbnail
			$layeredSrc = self::generateLayeredThumbnailUrl( $filename, $width, $layersParam );

			if ( $layeredSrc ) {
				// Generate HTML for layered image
				$alt = !empty( $caption ) ? htmlspecialchars( $caption ) : htmlspecialchars( $filename );
				$title = !empty( $caption ) ? htmlspecialchars( $caption ) : '';

				// Build basic file page URL; avoid hard dependency on Title for static analysis.
				$href = '/wiki/File:' . rawurlencode( $filename );
				return '<span class="mw-default-size" typeof="mw:File">' .
				   '<a href="' . htmlspecialchars( $href ) . '" class="mw-file-description"' .
				   ( $title ? ' title="' . $title . '"' : '' ) . '>' .
				   '<img alt="' . $alt . '" src="' . htmlspecialchars( $layeredSrc ) . '" ' .
				   'decoding="async" width="' . $width . '" class="mw-file-element" />' .
				   '</a></span>';
			}

			// Fall back to normal image display
			return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
		} catch ( Exception $e ) {
			$logger = self::getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: renderLayeredFile error', [ 'exception' => $e ] );
			}
			return '<span class="error">Error rendering layered file</span>';
		}
	}

	/**
	 * Generate URL for layered thumbnail
	 * @param string $filename The filename to generate URL for
	 * @param int $width The width for the thumbnail
	 * @param string $layersParam The layers parameter
	 * @return string|null
	 */
	private static function generateLayeredThumbnailUrl( $filename, $width, $layersParam ) {
		try {
			$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
				? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
				: null;
			$repoGroup = $services ? $services->getRepoGroup() : null;
			$file = $repoGroup ? $repoGroup->findFile( $filename ) : null;

			if ( !$file ) {
				return null;
			}

			// Get layer data
			$db = self::getLayersDatabaseService();
			if ( !$db ) {
				return null;
			}
			$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );

			if ( empty( $layerSets ) ) {
				return null;
			}

			// Find the right layer set
			// Default to first
			$selectedLayerSet = $layerSets[0];

			if ( $layersParam !== 'on' ) {
				foreach ( $layerSets as $layerSet ) {
					if ( $layerSet['ls_name'] === $layersParam ) {
						$selectedLayerSet = $layerSet;
						break;
					}
				}
			}

			// Generate layered thumbnail
			$params = [
				'width' => intval( $width ),
				'layers' => 'on',
				'layerSetId' => $selectedLayerSet['ls_id'],
				'layerData' => json_decode( $selectedLayerSet['ls_json_blob'], true )['layers']
			];

			$renderer = new ThumbnailRenderer();
			$layeredPath = $renderer->generateLayeredThumbnail( $file, $params );

			if ( $layeredPath ) {
				// Build a LayeredThumbnail to resolve a proper web URL consistently
				$thumb = new \MediaWiki\Extension\Layers\LayeredThumbnail( $file, $layeredPath, $params );
				return $thumb->getUrl();
			}
		} catch ( Exception $e ) {
			$logger = self::getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: generateLayeredThumbnailUrl error', [ 'exception' => $e ] );
			}
		}

		return null;
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
	 * @param mixed $thumbnail
	 * @param array &$attribs
	 * @param array &$linkAttribs
	 * @return bool
	 */
	public static function onThumbnailBeforeProduceHTML( $thumbnail, array &$attribs, array &$linkAttribs ): bool {
		$fileName = ( method_exists( $thumbnail, 'getFile' ) && $thumbnail->getFile() )
			? $thumbnail->getFile()->getName()
			: 'unknown';
		self::log( "ThumbnailBeforeProduceHTML for: $fileName" );

		// Extract layer data and flag from transform params
		[ $layerData, $layersFlag ] = self::extractLayerDataFromThumbnail( $thumbnail );

		// Try to get layers flag from link href if not in params
		if ( $layersFlag === null && isset( $linkAttribs['href'] ) ) {
			$layersFlag = self::extractLayersParamFromHref( (string)$linkAttribs['href'] );
		}

		self::log( "layersFlag=$layersFlag, hasData=" . ( $layerData !== null ? 'yes' : 'no' ) );

		// Respect explicit disable
		if ( $layersFlag === 'off' || $layersFlag === 'none' || $layersFlag === false ) {
			self::log( 'Layers explicitly disabled' );
			return true;
		}

		// Try to fetch from DB if no data yet
		if ( $layerData === null && method_exists( $thumbnail, 'getFile' ) ) {
			$layerData = self::fetchLayerDataForThumbnail( $thumbnail, $layersFlag, $linkAttribs );
		}

		// Inject layer data into attributes
		self::injectThumbnailLayerData( $attribs, $layerData, $layersFlag, $thumbnail );

		return true;
	}

	/**
	 * Extract layer data and flag from thumbnail transform params.
	 *
	 * @param mixed $thumbnail
	 * @return array [ ?array $layerData, ?string $layersFlag ]
	 */
	private static function extractLayerDataFromThumbnail( $thumbnail ): array {
		$layerData = null;
		$layersFlag = null;

		if ( !method_exists( $thumbnail, 'getParams' ) ) {
			return [ null, null ];
		}

		$params = $thumbnail->getParams();

		// Check layersjson param (JSON string)
		if ( isset( $params['layersjson'] ) && is_string( $params['layersjson'] ) ) {
			$decoded = json_decode( $params['layersjson'], true );
			if ( is_array( $decoded ) ) {
				$layerData = isset( $decoded['layers'] ) && is_array( $decoded['layers'] )
					? $decoded['layers']
					: $decoded;
			}
		}

		// Fallback to layerData param
		if ( $layerData === null && isset( $params['layerData'] ) ) {
			$layerData = $params['layerData'];
			self::log( 'Found layer data in transform params' );
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
	 * @return array|null
	 */
	private static function fetchLayerDataForThumbnail( $thumbnail, ?string &$layersFlag, array $linkAttribs ): ?array {
		$file = $thumbnail->getFile();
		if ( !$file ) {
			return null;
		}

		$filename = $file->getName();
		$shouldFallback = false;

		// Check wikitext preprocessing queue
		$storedSetName = self::getFileSetName( $filename );
		if ( $storedSetName !== null ) {
			if ( in_array( $storedSetName, [ 'off', 'none', 'false' ], true ) ) {
				self::log( "Layers disabled via wikitext for $filename" );
				return null;
			}
			$shouldFallback = true;
			$layersFlag = $storedSetName;
			self::log( "Using wikitext set name: $storedSetName for $filename" );
		}

		// Check if flag indicates layers should show
		if ( !$shouldFallback && $layersFlag !== null && !in_array( $layersFlag, [ 'off', 'none' ], true ) ) {
			$shouldFallback = true;
		}

		// Check href for layers param
		if ( !$shouldFallback && isset( $linkAttribs['href'] ) ) {
			$hrefParam = self::extractLayersParamFromHref( (string)$linkAttribs['href'] );
			if ( $hrefParam !== null && !in_array( $hrefParam, [ 'off', 'none' ], true ) ) {
				$shouldFallback = true;
				$layersFlag = $hrefParam;
			}
		}

		// Enable for editlayers action
		if ( !$shouldFallback && self::isEditLayersAction() ) {
			$shouldFallback = true;
			self::log( 'Enabling fallback for action=editlayers' );
		}

		if ( !$shouldFallback ) {
			return null;
		}

		// Fetch from database
		try {
			$db = self::getLayersDatabaseService();
			if ( !$db ) {
				throw new Exception( 'LayersDatabase service unavailable' );
			}

			$isDefaultSet = $layersFlag === null || in_array( $layersFlag, [ 'on', 'all', 'true' ], true );
			$layerSet = $isDefaultSet
				? $db->getLatestLayerSet( $filename, $file->getSha1() )
				: $db->getLayerSetByName( $filename, $file->getSha1(), $layersFlag );

			if ( $layerSet && isset( $layerSet['data']['layers'] ) && is_array( $layerSet['data']['layers'] ) ) {
				$layers = $layerSet['data']['layers'];
				self::log( sprintf( 'DB fallback: %d layers (set: %s)', count( $layers ), $layersFlag ?? 'default' ) );
				return $layers;
			}
		} catch ( \Throwable $e ) {
			$logger = self::getLogger();
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
	private static function injectThumbnailLayerData(
		array &$attribs,
		?array $layerData,
		?string $layersFlag,
		$thumbnail
	): void {
		// Always add instance marker
		$instanceId = 'layers-' . substr( md5( uniqid( (string)mt_rand(), true ) ), 0, 8 );
		$attribs['data-layers-instance'] = $instanceId;

		if ( $layerData !== null ) {
			self::$pageHasLayers = true;

			// Get base dimensions for scaling
			$file = method_exists( $thumbnail, 'getFile' ) ? $thumbnail->getFile() : null;
			$payload = [ 'layers' => $layerData ];
			if ( $file && method_exists( $file, 'getWidth' ) && method_exists( $file, 'getHeight' ) ) {
				$payload['baseWidth'] = (int)$file->getWidth();
				$payload['baseHeight'] = (int)$file->getHeight();
			}

			$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
			$attribs['data-layer-data'] = json_encode( $payload );

			self::log( sprintf( 'Added %d layers, instance: %s', count( $layerData ), $instanceId ) );
		} else {
			self::log( "No layer data, instance: $instanceId" );

			// Mark intent for client-side API fetch
			if ( in_array( $layersFlag, [ 'on', 'all', true ], true ) ) {
				$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
				$attribs['data-layers-intent'] = 'on';
			}
		}
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

		// Process based on parameter type
		if ( $layersRaw === true || $layersRaw === 'on' || $layersRaw === 'all' ) {
			// Show latest/default set
			if ( $file ) {
				self::addLatestLayersToImage( $file, $params );
			}
		} elseif (
			is_string( $layersRaw ) &&
			preg_match( '/^[0-9a-fA-F]{2,8}(\s*,\s*[0-9a-fA-F]{2,8})*$/', $layersRaw )
		) {
			// Comma-separated short IDs
			if ( $file ) {
				self::addSubsetLayersToImage( $file, $layersRaw, $params );
			}
		} elseif ( is_string( $layersRaw ) ) {
			// Named set or id: prefix
			if ( $file ) {
				self::addSpecificLayersToImage( $file, $layersRaw, $params );
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
	 * Get the stored set name for the next occurrence of a specific file
	 * This consumes from the queue, so each call returns the next set name in order
	 * @param string $filename The filename (without namespace prefix)
	 * @return string|null The set name, or null if not specified
	 */
	public static function getFileSetName( string $filename ): ?string {
		if ( !isset( self::$fileSetNames[$filename] ) || empty( self::$fileSetNames[$filename] ) ) {
			return null;
		}

		// Initialize render count for this file if not set
		if ( !isset( self::$fileRenderCount[$filename] ) ) {
			self::$fileRenderCount[$filename] = 0;
		}

		// Get the set name for the current occurrence
		$index = self::$fileRenderCount[$filename];
		$queue = self::$fileSetNames[$filename];

		// Increment the counter for next call
		self::$fileRenderCount[$filename]++;

		// Return the set name at this index, or null if we've exhausted the queue
		return $queue[$index] ?? null;
	}

	/**
	 * Reset the page layers flag (useful for testing)
	 */
	public static function resetPageLayersFlag(): void {
		self::$pageHasLayers = false;
		self::$fileSetNames = [];
		self::$fileRenderCount = [];
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
		try {
			self::log( 'ParserBeforeInternalParse: text length=' . strlen( $text ) );

			// Extract [[File:filename.ext|...layers=value...]] patterns and store setname per file
			$fileLayersPattern = '/\[\[File:([^|\]]+)\|[^\]]*?layers?\s*=\s*([^|\]]+)/i';
			if ( preg_match_all( $fileLayersPattern, $text, $allMatches, PREG_SET_ORDER ) ) {
				foreach ( $allMatches as $match ) {
					$filename = trim( $match[1] );
					$layersValue = trim( $match[2] );

					self::$pageHasLayers = true;

					// Initialize queue for this file if not exists
					if ( !isset( self::$fileSetNames[$filename] ) ) {
						self::$fileSetNames[$filename] = [];
					}

					// Store the set name in the queue (in order of appearance)
					$normalized = strtolower( $layersValue );
					$isBoolean = in_array( $normalized, [ 'on', 'off', 'none', 'true', 'false', 'all' ], true );
					self::$fileSetNames[$filename][] = $isBoolean ? $normalized : $layersValue;

					$queueLen = count( self::$fileSetNames[$filename] );
					self::log( "Detected layers=$layersValue for $filename (occurrence #$queueLen)" );
				}
			}

			// Fallback: check for any layers= text
			if ( strpos( $text, 'layers=' ) !== false || strpos( $text, 'layer=' ) !== false ) {
				self::$pageHasLayers = true;
				self::log( 'Found layers= in wikitext, setting pageHasLayers=true' );
			}
		} catch ( \Throwable $e ) {
			$logger = self::getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: ParserBeforeInternalParse error: ' . $e->getMessage() );
			}
		}

		return true;
	}

	/**
	 * Add latest layer set to image parameters
	 * @param mixed $file
	 * @param array &$params
	 */
	private static function addLatestLayersToImage( $file, array &$params ): void {
		$db = self::getLayersDatabaseService();
		if ( !$db ) {
			return;
		}

		// Check if a specific set name was requested for this file in wikitext
		$filename = $file->getName();
		$setNameFromQueue = self::getFileSetName( $filename );

		// Determine which layer set to fetch
		$layerSet = null;
		if ( $setNameFromQueue === null
			|| $setNameFromQueue === 'on'
			|| $setNameFromQueue === 'all'
			|| $setNameFromQueue === 'true' ) {
			// Default behavior - get the default/latest set
			$layerSet = $db->getLatestLayerSet( $filename, $file->getSha1() );
		} elseif ( $setNameFromQueue === 'off' || $setNameFromQueue === 'none' || $setNameFromQueue === 'false' ) {
			// Explicitly disabled - don't fetch any layer set
			return;
		} else {
			// Named set
			$layerSet = $db->getLayerSetByName( $filename, $file->getSha1(), $setNameFromQueue );
		}

		if ( $layerSet ) {
			$params['layerSetId'] = $layerSet['id'];
			// Pass only the layers array
			$params['layerData'] = isset( $layerSet['data']['layers'] )
				? $layerSet['data']['layers']
				: $layerSet['data'];
		}
	}

	/**
	 * Add specific layer set to image parameters
	 * @param mixed $file
	 * @param string $layersParam
	 * @param array &$params
	 */
	private static function addSpecificLayersToImage( $file, string $layersParam, array &$params ): void {
		$db = self::getLayersDatabaseService();
		if ( !$db ) {
			return;
		}

		if ( strpos( $layersParam, 'id:' ) === 0 ) {
			// Layer set by ID
			$layerSetId = (int)substr( $layersParam, 3 );
			$layerSet = $db->getLayerSet( $layerSetId );
		} elseif ( strpos( $layersParam, 'name:' ) === 0 ) {
			// Layer set by name
			$layerSetName = substr( $layersParam, 5 );
			$layerSet = $db->getLayerSetByName( $file->getName(), $file->getSha1(), $layerSetName );
		} else {
			// Legacy format or other formats
			$layerSet = null;
		}

		if ( $layerSet ) {
			$params['layerSetId'] = $layerSet['id'];
			$params['layerData'] = isset( $layerSet['data']['layers'] )
				? $layerSet['data']['layers']
				: $layerSet['data'];
		}
	}

	/**
	 * Add subset of layers (by comma-separated short IDs) into params
	 * @param mixed $file
	 * @param string $shortIdsCsv
	 * @param array &$params
	 */
	private static function addSubsetLayersToImage( $file, string $shortIdsCsv, array &$params ): void {
		$db = self::getLayersDatabaseService();
		if ( !$db ) {
			return;
		}
		$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
		if ( !$latest || !isset( $latest['data']['layers'] ) ) {
			return;
		}
		$wanted = array_map( 'trim', explode( ',', strtolower( $shortIdsCsv ) ) );
		$subset = [];
		foreach ( (array)$latest['data']['layers'] as $layer ) {
			$id = strtolower( (string)( $layer['id'] ?? '' ) );
			$short = substr( $id, 0, 4 );
			if ( in_array( $short, $wanted, true ) ) {
				$subset[] = $layer;
			}
		}
		if ( $subset ) {
			$params['layerSetId'] = $latest['id'];
			$params['layerData'] = $subset;
		}
	}

	/**
	 * Helper: Inject layer data into image attributes using the processor classes.
	 * This is the preferred method for attribute injection - eliminates duplication.
	 *
	 * @param array &$attribs Reference to image attributes array
	 * @param mixed $file The File object
	 * @param string|null $setName Optional named set (defaults to 'default')
	 * @param string $context Description of calling context for logging
	 * @return bool True if layers were injected, false otherwise
	 */
	private static function injectLayersIntoAttributes(
		array &$attribs,
		$file,
		?string $setName = null,
		string $context = 'unknown'
	): bool {
		if ( !$file ) {
			return false;
		}

		$db = self::getLayersDatabaseService();
		if ( !$db ) {
			return false;
		}

		// Get layer data from database
		if ( $setName !== null && $setName !== 'default' && $setName !== 'on' && $setName !== 'all' ) {
			$layerSet = $db->getLatestLayerSetByName( $file->getName(), $setName );
		} else {
			$layerSet = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
		}

		if ( !$layerSet || !isset( $layerSet['data'] ) ) {
			return false;
		}

		$layers = (
			isset( $layerSet['data']['layers'] )
			&& is_array( $layerSet['data']['layers'] )
		)
			? $layerSet['data']['layers']
			: [];

		if ( empty( $layers ) ) {
			return false;
		}

		// Use the HTML injector to add attributes
		$injector = self::getHtmlInjector();
		$dimensions = $injector->getFileDimensions( $file );

		$injector->injectIntoAttributes(
			$attribs,
			$layers,
			$dimensions['width'],
			$dimensions['height']
		);

		self::$pageHasLayers = true;

		return true;
	}

	/**
	 * Helper: Inject layer data into HTML string using the processor classes.
	 * This is the preferred method for HTML injection - eliminates duplication.
	 *
	 * @param string $html The HTML to modify
	 * @param mixed $file The File object
	 * @param string|null $setName Optional named set (defaults to 'default')
	 * @param string $context Description of calling context for logging
	 * @return string Modified HTML with layer data, or original if no layers
	 */
	private static function injectLayersIntoHtml(
		string $html,
		$file,
		?string $setName = null,
		string $context = 'unknown'
	): string {
		if ( !$file ) {
			return $html;
		}

		$db = self::getLayersDatabaseService();
		if ( !$db ) {
			return $html;
		}

		// Get layer data from database
		if ( $setName !== null && $setName !== 'default' && $setName !== 'on' && $setName !== 'all' ) {
			$layerSet = $db->getLatestLayerSetByName( $file->getName(), $setName );
		} else {
			$layerSet = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
		}

		if ( !$layerSet || !isset( $layerSet['data'] ) ) {
			return $html;
		}

		$layers = (
			isset( $layerSet['data']['layers'] )
			&& is_array( $layerSet['data']['layers'] )
		)
			? $layerSet['data']['layers']
			: [];

		if ( empty( $layers ) ) {
			return $html;
		}

		// Use the HTML injector
		$injector = self::getHtmlInjector();
		$dimensions = $injector->getFileDimensions( $file );

		$result = $injector->injectIntoHtml(
			$html,
			$layers,
			$dimensions['width'],
			$dimensions['height'],
			$context
		);

		self::$pageHasLayers = true;

		return $result;
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
			$logger = self::getLogger();
			if ( $logger ) {
				$logger->error( 'Layers: Unable to resolve LayersDatabase service', [ 'exception' => $e ] );
			}
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

	/**
	 * Detect whether the active action is the editlayers view.
	 *
	 * @return bool
	 */
	private static function isEditLayersAction(): bool {
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
	 * Extract layers parameter value from URL/href string.
	 * Returns the value of layers= or layer= parameter, or null if not found.
	 * Returns 'off' for explicit none/off values.
	 *
	 * @param string $href URL or href string to parse
	 * @return string|null The layers parameter value, 'off' for none/off, or null if not found
	 * @deprecated Use LayersParamExtractor::extractFromHref() directly for new code
	 */
	private static function extractLayersParamFromHref( string $href ): ?string {
		// Delegate to the processor class for centralized extraction logic
		return self::getParamExtractor()->extractFromHref( $href );
	}
}
