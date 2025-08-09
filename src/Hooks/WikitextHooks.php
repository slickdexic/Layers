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
	 * @param mixed $title
	 * @param mixed $file
	 * @param array &$params
	 * @param mixed $parser
	 * @return bool
	 */
	public static function onImageBeforeProduceHTML(
		&$dummy,
		$title,
		$file,
		array &$attribs,
		array &$linkAttribs = [],
		$isLinked = false,
		$thumb = null,
		$parser = null,
		$frameParams = false,
		$page = 0
	) {
		// Intentionally a no-op. Layers processing is handled earlier in
		// ParserMakeImageParams and later in ThumbnailBeforeProduceHTML.
		// Keeping this hook to maintain compatibility with MW's call sequence.
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
			$layersParam = 'off'; // default to off
			if ( !empty( $layersArg ) && strpos( $layersArg, 'layers=' ) === 0 ) {
				$layersParam = substr( $layersArg, 7 ); // Remove 'layers=' prefix
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
				return '<span class="error">File not found: ' . htmlspecialchars( $filename ) . '</span>';
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
			$width = 300; // default
			if ( preg_match( '/(\d+)px/', $size, $sizeMatch ) ) {
				$width = intval( $sizeMatch[1] );
			} elseif ( preg_match( '/x(\d+)px/', $size, $sizeMatch ) ) {
				$width = intval( $sizeMatch[1] );
			} elseif ( $size === 'thumb' ) {
				$width = 220; // MediaWiki default thumb size
			}

			// Generate layered thumbnail
			$layeredSrc = self::generateLayeredThumbnailUrl( $filename, $width, $layersParam );

			if ( $layeredSrc ) {
				// Generate HTML for layered image
				$alt = !empty( $caption ) ? htmlspecialchars( $caption ) : htmlspecialchars( $filename );
				$title = !empty( $caption ) ? htmlspecialchars( $caption ) : '';

				$destTitle = \Title::newFromText( 'File:' . $filename );
				$href = $destTitle ? $destTitle->getLocalURL() : ( '/wiki/File:' . rawurlencode( $filename ) );
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
			$selectedLayerSet = $layerSets[0]; // Default to first

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
	 * @param object $file
	 * @param array &$params
	 * @param object $parser
	 * @param array &$time
	 * @param array &$descQuery
	 * @param array &$query
	 * @return bool
	 */
	public static function onFileLink( $file, array &$params, $parser, array &$time, array &$descQuery, array &$query ): bool {
		// If this file has layers enabled, add query parameters for the file page
		if ( isset( $params['layers'] ) && $params['layers'] !== 'off' ) {
			$query['layers'] = $params['layers'];
		}

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
			if ( isset( $params['layerData'] ) ) {
				$layerData = $params['layerData'];
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
					$logger->info( 'Layers: Found layer data in transform params' );
				}
			}
			if ( array_key_exists( 'layers', $params ) ) {
				$layersFlag = $params['layers'];
			}
		}

		// Normalize layers flag (also peek at link attribs href for layers flag)
		if ( is_string( $layersFlag ) ) {
			$layersFlag = strtolower( trim( $layersFlag ) );
		}
		if ( $layersFlag === null && isset( $linkAttribs['href'] ) ) {
			$href = (string)$linkAttribs['href'];
			if ( strpos( $href, 'layers=all' ) !== false || strpos( $href, 'layers=on' ) !== false ) {
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

		// Fallback to latest set when explicitly requested (on/true/all) and layerData missing
		if ( $layerData === null && ( $layersFlag === 'on' || $layersFlag === true || $layersFlag === 'all' ) && method_exists( $thumbnail, 'getFile' ) ) {
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
							$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
							$logger->info( 'Layers: Retrieved layer data from database: ' . count( $layerData ) . ' layers' );
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
			$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
			$attribs['data-layer-data'] = json_encode( [ 'layers' => $layerData ] );
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

    public static function onParserMakeImageParams( $title, $file, array &$params, $parser ): bool {
		// Normalize and interpret layers parameter
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
			return true;
		}

		// Accept 'all' as show latest set; accept 'on' for legacy
		if ( $layersRaw === true || $layersRaw === 'on' || $layersRaw === 'all' ) {
			if ( $file ) {
				self::addLatestLayersToImage( $file, $params );
			}
			$params['layers'] = 'on';
			return true;
		}

		if ( is_string( $layersRaw ) ) {
			// Comma-separated short IDs: 4bfa,77e5,0cf2
			if ( preg_match( '/^[0-9a-fA-F]{2,8}(\s*,\s*[0-9a-fA-F]{2,8})*$/', $layersRaw ) ) {
				if ( $file ) {
					self::addSubsetLayersToImage( $file, $layersRaw, $params );
				}
				$params['layers'] = 'on';
				return true;
			}
			// Named or id: prefixes
			if ( $file ) {
				self::addSpecificLayersToImage( $file, $layersRaw, $params );
			}
			$params['layers'] = 'on';
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
			$params['layerData'] = isset( $layerSet['data']['layers'] ) ? $layerSet['data']['layers'] : $layerSet['data'];
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
			$params['layerData'] = isset( $layerSet['data']['layers'] ) ? $layerSet['data']['layers'] : $layerSet['data'];
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
