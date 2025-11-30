<?php

namespace MediaWiki\Extension\Layers\Hooks;

use Exception;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\MediaWikiServices;

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
			// Swallow errors to avoid breaking rendering; optionally log
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error(
					'Layers: Error in ImageBeforeProduceHTML',
					[ 'exception' => $e ]
				);
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
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Error in MakeImageLink2', [ 'exception' => $e ] );
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
			if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Error in LinkerMakeImageLink', [ 'exception' => $e ] );
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
			if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Error in LinkerMakeMediaLinkFile', [ 'exception' => $e ] );
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
		// Debug logging
		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info(
					'Layers: onGetLinkParamDefinitions called, registering layers parameter'
				);
		}

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
		// Debug logging
		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
			$currentParams = implode( ',', $params );
			$logger->info(
				"Layers: onParserGetImageLinkParams called, current params: $currentParams"
			);
		}

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
		// Debug logging
		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
			$currentOptions = implode( ',', $options );
			$logger->info(
				"Layers: onParserGetImageLinkOptions called, current options: $currentOptions"
			);
		}

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
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
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
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
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
		// Debug logging
		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func(
				[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
				'Layers'
			);
			$logger->info( 'Layers: ThumbnailBeforeProduceHTML hook called' );

			// Log what we received
			$fileName = 'unknown';
			if ( method_exists( $thumbnail, 'getFile' ) && $thumbnail->getFile() ) {
				$fileName = $thumbnail->getFile()->getName();
			}
			$logger->info( 'Layers: Processing thumbnail for file: ' . $fileName );

			// Log current attributes
			$hasLayerData = isset( $attribs['data-layer-data'] );
			$hasLayerClass = isset( $attribs['class'] ) && strpos( $attribs['class'], 'layers-thumbnail' ) !== false;
			$logger->info(
				'Layers: Current attributes - has data-layer-data: '
				. ( $hasLayerData ? 'yes' : 'no' )
				. ', has layers-thumbnail class: '
				. ( $hasLayerClass ? 'yes' : 'no' )
			);
		}

		// Prefer layer data passed via transform params (when available), else fall back to latest set
		$layerData = null;
		$layersFlag = null;

		// Some MediaWiki versions do not expose transform params on ThumbnailImage
		if ( method_exists( $thumbnail, 'getParams' ) ) {
			$params = $thumbnail->getParams();
			if ( isset( $params['layersjson'] ) && is_string( $params['layersjson'] ) ) {
				$decoded = json_decode( $params['layersjson'], true );
				if ( is_array( $decoded ) ) {
					$layerData = isset( $decoded['layers'] ) && is_array( $decoded['layers'] )
						? $decoded['layers']
						: $decoded;
				}
			}
			if ( $layerData === null && isset( $params['layerData'] ) ) {
				$layerData = $params['layerData'];
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					$logger->info( 'Layers: Found layer data in transform params' );
				}
			}
			if ( array_key_exists( 'layers', $params ) ) {
				$layersFlag = $params['layers'];
			} elseif ( array_key_exists( 'layer', $params ) ) {
				$layersFlag = $params['layer'];
			}
		}

		// Normalize layers flag (also peek at link attribs href for layers flag)
		if ( is_string( $layersFlag ) ) {
			$layersFlag = strtolower( trim( $layersFlag ) );
		}
		if ( $layersFlag === null && isset( $linkAttribs['href'] ) ) {
			$href = (string)$linkAttribs['href'];
			$layersFlag = self::extractLayersParamFromHref( $href );
		}

		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
			$logger->info(
				'Layers: layersFlag = '
				. ( $layersFlag ?: 'null' )
				. ', layerData present = '
				. ( $layerData !== null ? 'yes' : 'no' )
			);
		}

		// Respect explicit off/none
		if ( $layersFlag === 'off' || $layersFlag === 'none' || $layersFlag === false ) {
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: Layers explicitly disabled' );
			}
			return true;
		}

		// Additional check: look for layers parameter in link attributes if not found in transform params
		if ( $layersFlag === null && isset( $linkAttribs['href'] ) ) {
			$href = (string)$linkAttribs['href'];
			$layersFlag = self::extractLayersParamFromHref( $href );
			if ( $layersFlag !== null && \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func(
					[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
					'Layers'
				);
				$logger->info( 'Layers: Found layers parameter in link href: ' . $href );
			}
		}

	// Fallback to DB when layers flag is explicitly on/all, or when we detect layers should be shown
	// but don't have layer data yet
		if ( $layerData === null && method_exists( $thumbnail, 'getFile' ) ) {
			$shouldFallback = false;
			$file = $thumbnail->getFile();
			$filename = $file ? $file->getName() : null;

		// First, check the per-file queue from wikitext preprocessing
		// This tells us if this specific image had layers= in its wikitext syntax
		$storedSetName = null;
		if ( $filename !== null ) {
			$storedSetName = self::getFileSetName( $filename );
			if ( $storedSetName !== null ) {
				// Check if it's explicitly disabled
				if ( $storedSetName === 'off' || $storedSetName === 'none' || $storedSetName === 'false' ) {
					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func(
							[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
							'Layers'
						);
						$logger->info(
							"Layers: Layers explicitly disabled for this " .
							"instance of $filename via wikitext"
						);
					}
					// Skip this instance entirely
					return true;
				}
				// This image had layers= in wikitext, so we should show layers
				$shouldFallback = true;
				$layersFlag = $storedSetName;
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					// Skip inline comment
					$logger->info(
						"Layers: Using stored set name from wikitext queue: " .
						"$storedSetName for $filename"
					);
				}
			}
		}

		// Check if layers flag indicates we should show layers (any value except off/none)
		if ( !$shouldFallback && $layersFlag !== null && $layersFlag !== 'off' && $layersFlag !== 'none' ) {
			$shouldFallback = true;
		}

		// Also check link attributes for layers parameter as additional fallback
		if ( !$shouldFallback && isset( $linkAttribs['href'] ) ) {
			$href = (string)$linkAttribs['href'];
			$hrefParam = self::extractLayersParamFromHref( $href );
			if ( $hrefParam !== null && $hrefParam !== 'off' && $hrefParam !== 'none' ) {
				$shouldFallback = true;
				$layersFlag = $hrefParam;
			}
		}

		// Allow file pages (including action=editlayers) to always receive overlays
		$contextIsFile = self::isFilePageContext();
		$contextIsEdit = self::isEditLayersAction();
		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func(
				[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
				'Layers'
			);
			$logger->info(
				'Layers: context check - isFilePage=' . ( $contextIsFile ? 'yes' : 'no' ) .
				', isEditLayers=' . ( $contextIsEdit ? 'yes' : 'no' )
			);
		}
		// Note: File: pages no longer auto-enable layers. Users must explicitly use layers=on.
		// if ( !$shouldFallback && $contextIsFile ) {
		// 	$shouldFallback = true;
		// }
		if ( !$shouldFallback && $contextIsEdit ) {
			$shouldFallback = true;
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: enabling fallback because action=editlayers' );
			}
		}

		// Strict gating: do not auto-enable overlays in debug mode without explicit layers intent.

		if ( $shouldFallback ) {
			// Note: $file and $filename were already set above when we checked the per-file queue
			if ( $file ) {
				try {
					$db = self::getLayersDatabaseService();
					if ( !$db ) {
						throw new Exception( 'LayersDatabase service unavailable' );
					}

					$layerSet = null;

					// Determine which layer set to fetch based on layersFlag
					// (layersFlag may have been set from the wikitext queue above)
					$isDefaultSet = $layersFlag === null || $layersFlag === 'on' ||
						$layersFlag === 'all' || $layersFlag === 'true';
					if ( $isDefaultSet ) {
						// 'on'/'all'/null => fetch the default set (latest revision)
						$layerSet = $db->getLatestLayerSet( $filename, $file->getSha1() );
					} elseif ( $layersFlag !== 'off' && $layersFlag !== 'none' ) {
						// Any other value => treat as named set
						$layerSet = $db->getLayerSetByName( $filename, $file->getSha1(), $layersFlag );
					}

					if ( $layerSet && isset( $layerSet['data'] ) ) {
						$layerData = isset( $layerSet['data']['layers'] ) && is_array( $layerSet['data']['layers'] )
							? $layerSet['data']['layers']
							: [];
						if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
							$logger = \call_user_func(
								[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
								'Layers'
							);
							$logger->info(
								sprintf(
									'Layers: DB fallback provided %d layers for thumbnail (set: %s)',
									count( $layerData ),
									$layersFlag ?? 'default'
								)
							);
						}
					}
				} catch ( \Throwable $e ) {
						if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
							$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
							$logger->error(
						'Layers: Error retrieving layer data from database',
						[ 'exception' => $e ]
					);
						}
						// Swallow to avoid breaking core rendering
				}
			}
		}
		}

	// If transform params provided data, render regardless of missing flag (treat as on)
		if ( $layerData !== null ) {
			// Mark that page has layers for client configuration
			self::$pageHasLayers = true;

			// Include base dimensions to allow correct scaling in the viewer
			$baseWidth = (
				method_exists( $thumbnail, 'getFile' )
				&& $thumbnail->getFile()
				&& method_exists( $thumbnail->getFile(), 'getWidth' )
			)
				? (int)$thumbnail->getFile()->getWidth()
				: null;
			$baseHeight = (
				method_exists( $thumbnail, 'getFile' )
				&& $thumbnail->getFile()
				&& method_exists( $thumbnail->getFile(), 'getHeight' )
			)
				? (int)$thumbnail->getFile()->getHeight()
				: null;
			$payload = [ 'layers' => $layerData ];
			if ( $baseWidth && $baseHeight ) {
				$payload['baseWidth'] = $baseWidth;
				$payload['baseHeight'] = $baseHeight;
			}
			$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
			$attribs['data-layer-data'] = json_encode( $payload );

			// Add unique instance marker to prevent cross-instance interference
			$instanceId = 'layers-' . substr( md5( uniqid( mt_rand(), true ) ), 0, 8 );
			$attribs['data-layers-instance'] = $instanceId;

			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info(
					'Layers: Added layer data attribute with '
					. count( $layerData )
					. ' layers, instance: '
					. $instanceId
				);
			}
		} else {
			// Add unique instance marker to prevent cross-instance interference
			$instanceId = 'layers-' . substr( md5( uniqid( mt_rand(), true ) ), 0, 8 );
			$attribs['data-layers-instance'] = $instanceId;

			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info(
					'Layers: No layer data to add, instance: '
					. $instanceId
				);
			}
			// Mark intent if layers were explicitly requested so client can API-fetch
			if ( $layersFlag === 'on' || $layersFlag === 'all' || $layersFlag === true ) {
				$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
				$attribs['data-layers-intent'] = 'on';
			}
			// NOTE: We no longer use $pageHasLayers as a fallback here.
			// Only images with explicit layers= parameter should get the marker class.
		}

		return true;
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
		// Debug logging for onParserMakeImageParams
		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
			$fileName = $file ? $file->getName() : 'null';
			$titleText = $title ? $title->getText() : 'null';
			$paramsKeys = array_keys( $params );
			$hasLayersParam = isset( $params['layers'] );
			$hasLayerParam = isset( $params['layer'] );
			$layersValue = $hasLayersParam ? $params['layers'] : 'none';
			$layerValue = $hasLayerParam ? $params['layer'] : 'none';

			$logger->info(
				"Debug logging for onParserMakeImageParams - fileName: $fileName, titleText: $titleText, "
				. 'hasLayersParam: ' . ( $hasLayersParam ? 'yes' : 'no' )
				. ", layersValue: $layersValue, hasLayerParam: " . ( $hasLayerParam ? 'yes' : 'no' )
				. ", layerValue: $layerValue, paramsKeys: " . implode( ',', $paramsKeys )
			);
		}

		// Normalize and interpret layers parameter (support alias 'layer')
		if ( !isset( $params['layers'] ) && isset( $params['layer'] ) ) {
			$params['layers'] = $params['layer'];
			unset( $params['layer'] );
		}
		if ( !isset( $params['layers'] ) ) {
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info(
					"Debug logging for onParserMakeImageParams - No layers parameter found, returning early"
				);
			}
			return true;
		}

		// Ensure we have a File object; in some code paths it may be null here
		if ( !$file ) {
			try {
				$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
					? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
					: null;
				$repoGroup = $services ? $services->getRepoGroup() : null;
				if ( $repoGroup && $title ) {
					$file = $repoGroup->findFile( $title );
				}
			} catch ( \Throwable $e ) {
				// ignore; fallback behavior below
			}
		}

		$layersRaw = $params['layers'];
		// Normalize boolean-like strings
		if ( is_string( $layersRaw ) ) {
			$trimmed = strtolower( trim( $layersRaw ) );
			if ( $trimmed === 'true' ) {
				$layersRaw = true;
			} elseif ( $trimmed === 'false' ) {
				$layersRaw = false;
			} else {
				$layersRaw = $trimmed;
			}
		}
		if ( $layersRaw === false || $layersRaw === 'none' || $layersRaw === 'off' ) {
			// Explicitly disable layers
			unset( $params['layerSetId'], $params['layerData'] );
			unset( $params['layersjson'], $params['layersetid'] );
			return true;
		}

		// Accept 'all' as show latest set; accept 'on' for legacy
		if ( $layersRaw === true || $layersRaw === 'on' || $layersRaw === 'all' ) {
			// Mark that this page has layers enabled
			self::$pageHasLayers = true;

			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info(
					"Debug logging for onParserMakeImageParams - Processing layers='all' or 'on',"
					. " layersRaw: $layersRaw, file exists: "
					. ( $file ? 'yes' : 'no' )
					. ', pageHasLayers set to true'
				);
			}
			if ( $file ) {
				self::addLatestLayersToImage( $file, $params );
			}
			$params['layers'] = 'on';
			if ( isset( $params['layerData'] ) && is_array( $params['layerData'] ) ) {
				$params['layersjson'] = json_encode( $params['layerData'], JSON_UNESCAPED_UNICODE );
			}
			if ( isset( $params['layerSetId'] ) ) {
				$params['layersetid'] = (string)$params['layerSetId'];
			}
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$hasLayerData = isset( $params['layerData'] );
				$hasLayerSetId = isset( $params['layerSetId'] );
				$layersNormalized = $params['layers'];
				$logger->info(
					"Debug logging for onParserMakeImageParams - After processing layers='all': "
					. "layersNormalized: $layersNormalized, hasLayerData: "
					. ( $hasLayerData ? 'yes' : 'no' )
					. ', hasLayerSetId: '
					. ( $hasLayerSetId ? 'yes' : 'no' )
				);
			}
			return true;
		}

		if ( is_string( $layersRaw ) ) {
			// Comma-separated short IDs: 4bfa,77e5,0cf2
			if ( preg_match( '/^[0-9a-fA-F]{2,8}(\s*,\s*[0-9a-fA-F]{2,8})*$/', $layersRaw ) ) {
				// Mark that this page has layers enabled
				self::$pageHasLayers = true;

				if ( $file ) {
					self::addSubsetLayersToImage( $file, $layersRaw, $params );
				}
				$params['layers'] = 'on';
				if ( isset( $params['layerData'] ) && is_array( $params['layerData'] ) ) {
					$params['layersjson'] = json_encode( $params['layerData'], JSON_UNESCAPED_UNICODE );
				}
				if ( isset( $params['layerSetId'] ) ) {
					$params['layersetid'] = (string)$params['layerSetId'];
				}
				return true;
			}
			// Named or id: prefixes
			// Mark that this page has layers enabled
			self::$pageHasLayers = true;

			if ( $file ) {
				self::addSpecificLayersToImage( $file, $layersRaw, $params );
			}
			$params['layers'] = 'on';
			if ( isset( $params['layerData'] ) && is_array( $params['layerData'] ) ) {
				$params['layersjson'] = json_encode( $params['layerData'], JSON_UNESCAPED_UNICODE );
			}
			if ( isset( $params['layerSetId'] ) ) {
				$params['layersetid'] = (string)$params['layerSetId'];
			}
		}

		return true;
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
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: ParserBeforeInternalParse called with text length: ' . strlen( $text ) );
				// Debug: Show actual text content for debugging
				if ( strlen( $text ) < 200 ) {
					$logger->info( 'Layers: Text content: ' . $text );
				} elseif ( strpos( $text, 'File:' ) !== false ) {
					$logger->info( 'Layers: Text contains File: reference' );
				}
			}

			// Extract [[File:filename.ext|...layers=value...]] patterns and store setname per file
			// This pattern captures: filename, and layers/layer value (any string until | or ]])
			// Multiple occurrences of the same file are stored in order in a queue
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
					// For boolean-like values, store null to indicate default behavior
					$normalized = strtolower( $layersValue );
					if ( $normalized !== 'on' && $normalized !== 'off' && $normalized !== 'none'
						&& $normalized !== 'true' && $normalized !== 'false' && $normalized !== 'all' ) {
						// This is a named set like "Paul"
						self::$fileSetNames[$filename][] = $layersValue;
					} else {
						// Store the boolean-like value so we maintain order
						self::$fileSetNames[$filename][] = $normalized;
					}

					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func(
							[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
							'Layers'
						);
						$queueLen = count( self::$fileSetNames[$filename] );
						$logger->info(
							"Layers: ParserBeforeInternalParse detected layers=$layersValue " .
							"for file=$filename (occurrence #$queueLen)"
						);
					}
				}
			}

			// Also check for any occurrence of layers= anywhere in the text as a fallback
			if (
				( strpos( $text, 'layers=' ) !== false || strpos( $text, 'layer=' ) !== false )
			) {
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					$logger->info(
						'Layers: Found layers= or layer= text in wikitext, '
						. 'setting pageHasLayers=true as fallback'
					);
				}
				self::$pageHasLayers = true;
			}

		} catch ( \Throwable $e ) {
			// Ignore errors in regex parsing
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error(
					'Layers: Error in ParserBeforeInternalParse: ' . $e->getMessage()
				);
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
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func(
					[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
					'Layers'
				);
				$logger->error(
					'Layers: Unable to resolve LayersDatabase service',
					[ 'exception' => $e ]
				);
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
