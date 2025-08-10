<?php
/**
 * Wikitext parser integration for layers parameter
 * Handles [[File:Example.jpg|layers=on]] syntax
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks;

use Exception;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\ThumbnailRenderer;

class WikitextHooks {

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
	 * @param mixed $frameParams Frame params
	 * @param int $page Page number
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
			// Debug log
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: ImageBeforeProduceHTML fired' );
			}
			// Peek layers intent from the file link href, e.g., ...?layers=all
			$layersFlag = null;
			if ( isset( $linkAttribs['href'] ) ) {
				$href = (string)$linkAttribs['href'];
				if ( strpos( $href, 'layers=all' ) !== false || strpos( $href, 'layers=on' ) !== false
					|| strpos( $href, 'layer=all' ) !== false || strpos( $href, 'layer=on' ) !== false ) {
					$layersFlag = 'all';
				} elseif ( strpos( $href, 'layers=none' ) !== false || strpos( $href, 'layers=off' ) !== false ) {
					$layersFlag = 'off';
				}
			}

			// Respect explicit off/none
			if ( $layersFlag === 'off' || $layersFlag === 'none' ) {
				return true;
			}

			// Inject when explicitly requested or when rendering on a File: page
			$onFilePage = ( $title && method_exists( $title, 'inNamespace' ) && defined( 'NS_FILE' ) && $title->inNamespace( NS_FILE ) );
			if ( ( $layersFlag === 'all' || $layersFlag === 'on' || $layersFlag === true || $onFilePage ) && $file ) {
				$db = new LayersDatabase();
				$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
				if ( $latest && isset( $latest['data'] ) ) {
					$layerData = isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] )
						? $latest['data']['layers']
						: [];

					// Build payload with base dimensions for correct scaling
					$baseWidth = method_exists( $file, 'getWidth' ) ? (int)$file->getWidth() : null;
					$baseHeight = method_exists( $file, 'getHeight' ) ? (int)$file->getHeight() : null;
					$payload = [ 'layers' => $layerData ];
					if ( $baseWidth && $baseHeight ) {
						$payload['baseWidth'] = $baseWidth;
						$payload['baseHeight'] = $baseHeight;
					}

					// Inject attributes for client overlay
					$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
					$attribs['data-layer-data'] = json_encode( $payload, JSON_UNESCAPED_UNICODE );
					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->info( 'Layers: Injected attributes in ImageBeforeProduceHTML (' . count( $layerData ) . ' layers)' );
					}
				}
			}
		} catch ( \Throwable $e ) {
			// Swallow errors to avoid breaking rendering; optionally log
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Error in ImageBeforeProduceHTML', [ 'exception' => $e ] );
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
	 * MakeImageLink2 hook: last-chance injection point to alter the generated <img> HTML.
	 * This helps in galleries and contexts where Thumbnail/Image hooks miss.
	 *
	 * @param mixed $skin
	 * @param mixed $title
	 * @param mixed $file
	 * @param mixed $frameParams
	 * @param array $handlerParams
	 * @param string $time
	 * @param array $res
	 * @return bool
	 */
	public static function onMakeImageLink2( $skin, $title, $file, $frameParams, $handlerParams, $time, &$res, ...$rest ): bool {
		try {
			// Determine if layers are requested
			$layersFlag = null;
			if ( isset( $handlerParams['layers'] ) ) {
				$layersFlag = strtolower( (string)$handlerParams['layers'] );
			} elseif ( isset( $handlerParams['layer'] ) ) {
				$layersFlag = strtolower( (string)$handlerParams['layer'] );
			}
			if ( $layersFlag === null && isset( $frameParams['link-url'] ) ) {
				$href = (string)$frameParams['link-url'];
				if ( strpos( $href, 'layers=all' ) !== false || strpos( $href, 'layers=on' ) !== false
					|| strpos( $href, 'layer=all' ) !== false || strpos( $href, 'layer=on' ) !== false ) {
					$layersFlag = 'all';
				}
			}

			if ( $layersFlag === 'off' || $layersFlag === 'none' ) {
				return true;
			}

			if ( $file && ( $layersFlag === 'all' || $layersFlag === 'on' || isset( $handlerParams['layersjson'] ) || isset( $handlerParams['layerData'] ) ) ) {
				// Prefer JSON param, then array param, then DB fallback
				$layersArray = null;
				if ( isset( $handlerParams['layersjson'] ) && is_string( $handlerParams['layersjson'] ) ) {
					$decoded = json_decode( $handlerParams['layersjson'], true );
					if ( is_array( $decoded ) ) {
						$layersArray = isset( $decoded['layers'] ) && is_array( $decoded['layers'] ) ? $decoded['layers'] : $decoded;
					}
				}
				if ( $layersArray === null && isset( $handlerParams['layerData'] ) && is_array( $handlerParams['layerData'] ) ) {
					$layersArray = $handlerParams['layerData'];
				}
				if ( $layersArray === null ) {
					$db = new LayersDatabase();
					$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
					if ( $latest && isset( $latest['data'] ) ) {
						$layersArray = isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] )
							? $latest['data']['layers']
							: [];
					}
				}

				if ( $layersArray !== null ) {
					// Include base dimensions when available to allow correct scaling in the viewer
					$baseWidth = null;
					$baseHeight = null;
					if ( $file && method_exists( $file, 'getWidth' ) ) {
						$baseWidth = (int)$file->getWidth();
					}
					if ( $file && method_exists( $file, 'getHeight' ) ) {
						$baseHeight = (int)$file->getHeight();
					}

					$payload = [ 'layers' => $layersArray ];
					if ( $baseWidth && $baseHeight ) {
						$payload['baseWidth'] = $baseWidth;
						$payload['baseHeight'] = $baseHeight;
					}

					// Safely encode JSON for attribute usage
					$json = htmlspecialchars( json_encode( $payload, JSON_UNESCAPED_UNICODE ), ENT_QUOTES );

					// Update first <img ...> tag in $res: append class and add/replace data-layer-data
					$res = preg_replace_callback( '/<img\b([^>]*)>/i', function ( $m ) use ( $json ) {
						$attrs = $m[1];

						// Append layers-thumbnail to existing class or add new class attr
						if ( preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm ) ) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							// Avoid duplicate token
							$classesOut = preg_match( '/(^|\s)layers-thumbnail(\s|$)/', $classes ) ? $classes : trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}

						// Add or replace data-layer-data
						if ( preg_match( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', $attrs, $dm ) ) {
							$attrs = preg_replace( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', 'data-layer-data="' . $json . '"', $attrs );
						} else {
							$attrs .= ' data-layer-data="' . $json . '"';
						}

						return '<img' . $attrs . '>';
					}, (string)$res, 1 );

					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->info( 'Layers: Injected attributes in MakeImageLink2 (' . count( $layersArray ) . ' layers)' );
					}
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
	 * @param mixed $linker
	 * @param mixed $title
	 * @param mixed $file
	 * @param array $frameParams
	 * @param array $handlerParams
	 * @param string $time
	 * @param string &$res
	 * @return bool
	 */
	public static function onLinkerMakeImageLink( $linker, $title, $file, $frameParams, $handlerParams, $time, &$res, ...$rest ): bool {
		try {
			// Debug: log entry
			if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: onLinkerMakeImageLink fired' );
			}
			$layersFlag = null;
			if ( isset( $handlerParams['layers'] ) ) {
				$layersFlag = strtolower( (string)$handlerParams['layers'] );
			} elseif ( isset( $handlerParams['layer'] ) ) {
				$layersFlag = strtolower( (string)$handlerParams['layer'] );
			}
			// Do not rely on href sniffing here; handler params are authoritative

			if ( $layersFlag === 'off' || $layersFlag === 'none' ) {
				return true;
			}

			if ( $file && ( $layersFlag === 'all' || $layersFlag === 'on' || isset( $handlerParams['layersjson'] ) || isset( $handlerParams['layerData'] ) ) ) {
				$layersArray = null;
				if ( isset( $handlerParams['layersjson'] ) && is_string( $handlerParams['layersjson'] ) ) {
					$decoded = json_decode( $handlerParams['layersjson'], true );
					if ( is_array( $decoded ) ) {
						$layersArray = isset( $decoded['layers'] ) && is_array( $decoded['layers'] ) ? $decoded['layers'] : $decoded;
					}
				}
				if ( $layersArray === null && isset( $handlerParams['layerData'] ) && is_array( $handlerParams['layerData'] ) ) {
					$layersArray = $handlerParams['layerData'];
				}
				if ( $layersArray === null ) {
					$db = new LayersDatabase();
					$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
					if ( $latest && isset( $latest['data'] ) ) {
						$layersArray = isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] )
							? $latest['data']['layers']
							: [];
					}
				}

				if ( $layersArray !== null ) {
					$baseWidth = null;
					$baseHeight = null;
					if ( $file && method_exists( $file, 'getWidth' ) ) {
						$baseWidth = (int)$file->getWidth();
					}
					if ( $file && method_exists( $file, 'getHeight' ) ) {
						$baseHeight = (int)$file->getHeight();
					}
					$payload = [ 'layers' => $layersArray ];
					if ( $baseWidth && $baseHeight ) {
						$payload['baseWidth'] = $baseWidth;
						$payload['baseHeight'] = $baseHeight;
					}
					$json = htmlspecialchars( json_encode( $payload, JSON_UNESCAPED_UNICODE ), ENT_QUOTES );
					$res = preg_replace_callback( '/<img\b([^>]*)>/i', function ( $m ) use ( $json ) {
						$attrs = $m[1];
						// Ensure class contains layers-thumbnail
						if ( preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm ) ) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							$classesOut = preg_match( '/(^|\s)layers-thumbnail(\s|$)/', $classes ) ? $classes : trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}
						// Add or replace data-layer-data
						if ( preg_match( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', $attrs ) ) {
							$attrs = preg_replace( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', 'data-layer-data="' . $json . '"', $attrs );
						} else {
							$attrs .= ' data-layer-data="' . $json . '"';
						}
						return '<img' . $attrs . '>';
					}, (string)$res, 1 );

					if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->info( 'Layers: Injected attributes in LinkerMakeImageLink (' . count( $layersArray ) . ' layers)' );
					}
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
	 * @param mixed $linker
	 * @param mixed $title
	 * @param mixed $file
	 * @param array $frameParams
	 * @param array $handlerParams
	 * @param string $time
	 * @param string &$res
	 * @return bool
	 */
	public static function onLinkerMakeMediaLinkFile( $title, $file, &$res, &$attribs, $time, ...$rest ): bool {
		try {
			if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: onLinkerMakeMediaLinkFile fired' );
			}

			// In this hook variant, handler params are not provided; when present on file pages,
			// we conservatively overlay the latest layer set for this file.
			if ( $file ) {
				$layersArray = null;
				$db = new LayersDatabase();
				$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
				if ( $latest && isset( $latest['data'] ) ) {
					$layersArray = isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] )
						? $latest['data']['layers']
						: [];
				}

				if ( $layersArray !== null ) {
					$baseWidth = null;
					$baseHeight = null;
					if ( $file && method_exists( $file, 'getWidth' ) ) {
						$baseWidth = (int)$file->getWidth();
					}
					if ( $file && method_exists( $file, 'getHeight' ) ) {
						$baseHeight = (int)$file->getHeight();
					}
					$payload = [ 'layers' => $layersArray ];
					if ( $baseWidth && $baseHeight ) {
						$payload['baseWidth'] = $baseWidth;
						$payload['baseHeight'] = $baseHeight;
					}
					$rawJson = json_encode( $payload, JSON_UNESCAPED_UNICODE );
					$json = htmlspecialchars( $rawJson, ENT_QUOTES );

					// Also set attributes via reference array for core-generated markup paths
					if ( is_array( $attribs ) ) {
						$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
						$attribs['data-layer-data'] = $rawJson;
					}
					$res = preg_replace_callback( '/<img\b([^>]*)>/i', function ( $m ) use ( $json ) {
						$attrs = $m[1];
						if ( preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm ) ) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							$classesOut = preg_match( '/(^|\s)layers-thumbnail(\s|$)/', $classes ) ? $classes : trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}
						if ( preg_match( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', $attrs ) ) {
							$attrs = preg_replace( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', 'data-layer-data="' . $json . '"', $attrs );
						} else {
							$attrs .= ' data-layer-data="' . $json . '"';
						}
						return '<img' . $attrs . '>';
					}, (string)$res, 1 );

						// Log a small snippet for verification (truncate to avoid noise)
						if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
							$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
							$snippet = substr( strip_tags( (string)$res ), 0, 200 );
							$logger->info( 'Layers: LinkerMakeMediaLinkFile result snippet: ' . $snippet );
						}

					if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->info( 'Layers: Injected attributes in LinkerMakeMediaLinkFile (' . count( $layersArray ) . ' layers)' );
					}
				}
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
			$db = new LayersDatabase();
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
			$db = new LayersDatabase();
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
	 * Handle file link parameters
	 * This handles the actual file link generation with layers
	 *
	 * @param mixed $file
	 * @param array &$params
	 * @param mixed $parser
	 * @param array &$time
	 * @param array &$descQuery
	 * @param array &$query
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
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
			$logger->info( 'Layers: ThumbnailBeforeProduceHTML hook called' );
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
					$layerData = isset( $decoded['layers'] ) && is_array( $decoded['layers'] ) ? $decoded['layers'] : $decoded;
				}
			}
			if ( $layerData === null && isset( $params['layerData'] ) ) {
				$layerData = $params['layerData'];
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
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
			if ( strpos( $href, 'layers=all' ) !== false || strpos( $href, 'layers=on' ) !== false
				|| strpos( $href, 'layer=all' ) !== false || strpos( $href, 'layer=on' ) !== false ) {
				$layersFlag = 'all';
			}
		}

		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
			$logger->info( 'Layers: layersFlag = ' . ( $layersFlag ?: 'null' ) );
		}

		// Respect explicit off/none
		if ( $layersFlag === 'off' || $layersFlag === 'none' || $layersFlag === false ) {
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: Layers explicitly disabled' );
			}
			return true;
		}

		// Fallback to latest set when layerData missing; if not explicitly disabled, we enable overlays
		if ( $layerData === null && method_exists( $thumbnail, 'getFile' ) ) {
			$file = $thumbnail->getFile();
			if ( $file ) {
				try {
					$db = new LayersDatabase();
					$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
					if ( $latest && isset( $latest['data'] ) ) {
						$layerData = isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] )
							? $latest['data']['layers']
							: [];
						if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
								$logger = \call_user_func(
									[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
									'Layers'
								);
							$logger->info( sprintf( 'Layers: DB fallback provided %d layers for thumbnail', count( $layerData ) ) );
						}
					}
				} catch ( \Throwable $e ) {
					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->error( 'Layers: Error retrieving layer data from database', [ 'exception' => $e ] );
					}
					// Swallow to avoid breaking core rendering
				}
			}
		}

		if ( $layerData !== null ) {
			// Include base dimensions to allow correct scaling in the viewer
			$baseWidth = ( method_exists( $thumbnail, 'getFile' ) && $thumbnail->getFile() && method_exists( $thumbnail->getFile(), 'getWidth' ) )
				? (int)$thumbnail->getFile()->getWidth()
				: null;
			$baseHeight = ( method_exists( $thumbnail, 'getFile' ) && $thumbnail->getFile() && method_exists( $thumbnail->getFile(), 'getHeight' ) )
				? (int)$thumbnail->getFile()->getHeight()
				: null;
			$payload = [ 'layers' => $layerData ];
			if ( $baseWidth && $baseHeight ) {
				$payload['baseWidth'] = $baseWidth;
				$payload['baseHeight'] = $baseHeight;
			}
			$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
			$attribs['data-layer-data'] = json_encode( $payload );
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: Added layer data attribute with ' . count( $layerData ) . ' layers' );
			}
		} else {
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: No layer data to add' );
			}
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
		// Normalize and interpret layers parameter (support alias 'layer')
		if ( !isset( $params['layers'] ) && isset( $params['layer'] ) ) {
			$params['layers'] = $params['layer'];
			unset( $params['layer'] );
		}
		if ( !isset( $params['layers'] ) ) {
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
			return true;
		}

		if ( is_string( $layersRaw ) ) {
			// Comma-separated short IDs: 4bfa,77e5,0cf2
			if ( preg_match( '/^[0-9a-fA-F]{2,8}(\s*,\s*[0-9a-fA-F]{2,8})*$/', $layersRaw ) ) {
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
	 * Add latest layer set to image parameters
	 * @param mixed $file
	 * @param array &$params
	 */
	private static function addLatestLayersToImage( $file, array &$params ): void {
		$db = new LayersDatabase();
		$layerSet = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );

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
		$db = new LayersDatabase();

		if ( strpos( $layersParam, 'id:' ) === 0 ) {
			// Layer set by ID
			$layerSetId = (int)substr( $layersParam, 3 );
			$layerSet = $db->getLayerSet( $layerSetId );
		} elseif ( strpos( $layersParam, 'name:' ) === 0 ) {
			// Layer set by name
			$layerSetName = substr( $layersParam, 5 );
			$db = new LayersDatabase();
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
		$db = new LayersDatabase();
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
}
