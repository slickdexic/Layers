<?php

namespace MediaWiki\Extension\Layers\Hooks;

use Exception;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\MediaWikiServices;

class WikitextHooks {
	/**
	 * Track if any image on the current page has layers enabled
	 * @var bool
	 */
	private static $pageHasLayers = false;

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
			// Debug log
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func(
					[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
					'Layers'
				);
				$fileName = $file ? $file->getName() : 'null';
				$hasLinkAttribs = !empty( $linkAttribs['href'] );
				$logger->info(
					'Layers: ImageBeforeProduceHTML fired for file: '
					. $fileName . ', hasLinkAttribs: '
					. ( $hasLinkAttribs ? 'yes' : 'no' )
				);
			}
			// Peek layers intent from the file link href, e.g., ...?layers=all
			$layersFlag = null;
			if ( isset( $linkAttribs['href'] ) ) {
				$href = (string)$linkAttribs['href'];
					if (
						strpos( $href, 'layers=all' ) !== false
						|| strpos( $href, 'layers=on' ) !== false
						|| strpos( $href, 'layer=all' ) !== false
						|| strpos( $href, 'layer=on' ) !== false
					) {
						$layersFlag = 'all';
					} elseif (
						strpos( $href, 'layers=none' ) !== false
						|| strpos( $href, 'layers=off' ) !== false
					) {
						$layersFlag = 'off';
					}
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					$logger->info(
						'Layers: ImageBeforeProduceHTML detected layersFlag: '
						. ( $layersFlag ?: 'none' )
						. ' from href: '
						. substr( $href, 0, 200 )
					);
				}
			} else {
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					$logger->info( 'Layers: ImageBeforeProduceHTML no linkAttribs href available' );
				}
			}

			// Respect explicit off/none
			if ( $layersFlag === 'off' || $layersFlag === 'none' ) {
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					$logger->info( 'Layers: ImageBeforeProduceHTML skipping due to explicit off/none flag' );
				}
				return true;
			}

			// Inject only when explicitly requested
			if ( ( $layersFlag === 'all' || $layersFlag === 'on' || $layersFlag === true ) && $file ) {
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					$logger->info(
						'Layers: ImageBeforeProduceHTML attempting injection for file: '
						. $file->getName()
					);
				}
				$db = self::getLayersDatabaseService();
				if ( !$db ) {
					return true;
				}
				$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
				if ( $latest && isset( $latest['data'] ) ) {
					$layerData = (
						isset( $latest['data']['layers'] )
						&& is_array( $latest['data']['layers'] )
					)
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
					$attribs['data-layer-data'] = json_encode(
						$payload,
						JSON_UNESCAPED_UNICODE
					);
					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
						$logger->info(
							'Layers: Injected attributes in ImageBeforeProduceHTML ('
							. count( $layerData )
							. ' layers)'
						);
					}
				} else {
					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
						$logger->info(
							'Layers: ImageBeforeProduceHTML no layer data found in database for: '
							. $file->getName()
						);
					}
				}
			} else {
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					$hasFile = $file ? 'yes' : 'no';
					$logger->info(
						'Layers: ImageBeforeProduceHTML skipping injection - layersFlag: '
						. ( $layersFlag ?: 'none' )
						. ', hasFile: '
						. $hasFile
					);
				}
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
	 */
	private static function extractLayersFromDataMw( string $html ): ?string {
		try {
			// data-mw='{"attribs":[["class","..."],...],"body":{...},"parts":[{"template"...}]}'
			if ( !preg_match( '/\bdata-mw\s*=\s*("|\")(.*?)(\1)/is', $html, $m ) ) {
				return null;
			}
			$raw = html_entity_decode( $m[2], ENT_QUOTES );
			$dmw = json_decode( $raw, true );
			if ( !is_array( $dmw ) ) {
				return null;
			}
			// Common slot for image: dmw.attrs.origArgs or dmw.caption/attrs.options depending on core version
			$paths = [
				[ 'attrs', 'originalArgs' ],
				[ 'attrs', 'options' ],
				[ 'body', 'attrs', 'options' ],
			];
			foreach ( $paths as $path ) {
				$node = $dmw;
				foreach ( $path as $seg ) {
					if ( is_array( $node ) && array_key_exists( $seg, $node ) ) {
						$node = $node[$seg];
					} else {
						$node = null;
						break;
					}
				}
				if ( is_array( $node ) ) {
					// args often like ["thumb","x500px","layers=all",...] or options like {layers:"all"}
					if ( array_values( $node ) === $node ) {
						foreach ( $node as $val ) {
							if ( is_string( $val ) && preg_match( '/^layers\s*=\s*(.+)$/i', $val, $mm ) ) {
								return strtolower( trim( $mm[1] ) );
							}
						}
					} else {
						foreach ( [ 'layers', 'layer' ] as $k ) {
							if ( isset( $node[$k] ) && is_string( $node[$k] ) ) {
								return strtolower( trim( (string)$node[$k] ) );
							}
						}
					}
				}
			}
		} catch ( \Throwable $e ) {
			// ignore
		}
		return null;
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
			// Determine if layers are requested
			$layersFlag = null;
			if ( isset( $handlerParams['layers'] ) ) {
				$layersFlag = strtolower( (string)$handlerParams['layers'] );
			} elseif ( isset( $handlerParams['layer'] ) ) {
				$layersFlag = strtolower( (string)$handlerParams['layer'] );
			} elseif ( isset( $frameParams['layers'] ) ) {
				$layersFlag = strtolower( (string)$frameParams['layers'] );
			} elseif ( isset( $frameParams['layer'] ) ) {
				$layersFlag = strtolower( (string)$frameParams['layer'] );
			}
			if ( $layersFlag === null && isset( $frameParams['link-url'] ) ) {
				$href = (string)$frameParams['link-url'];
				if (
					strpos( $href, 'layers=all' ) !== false || strpos( $href, 'layers=on' ) !== false
					|| strpos( $href, 'layer=all' ) !== false || strpos( $href, 'layer=on' ) !== false
				) {
					$layersFlag = 'all';
				}
			}
			// Last resort: parse data-mw JSON for original args (when params were not preserved)
			if (
				$layersFlag === null && is_string( $res ) &&
				strpos( $res, 'data-mw=' ) !== false
			) {
				$parsed = self::extractLayersFromDataMw( (string)$res );
				if ( $parsed !== null ) {
					$layersFlag = $parsed;
				}
			}

			if ( $layersFlag === 'off' || $layersFlag === 'none' ) {
				return true;
			}

			if (
				$file && (
					$layersFlag === 'all'
					|| $layersFlag === 'on'
					|| isset( $handlerParams['layersjson'] )
					|| isset( $handlerParams['layerData'] )
				)
			) {
				// Prefer JSON param, then array param, then DB fallback
				$layersArray = null;
				if ( isset( $handlerParams['layersjson'] ) && is_string( $handlerParams['layersjson'] ) ) {
					$decoded = json_decode( $handlerParams['layersjson'], true );
					if ( is_array( $decoded ) ) {
						$layersArray = (
							isset( $decoded['layers'] ) && is_array( $decoded['layers'] )
						)
								? $decoded['layers']
								: $decoded;
					}
				}
				if ( $layersArray === null && isset( $handlerParams['layerData'] ) &&
					is_array( $handlerParams['layerData'] )
				) {
					$layersArray = $handlerParams['layerData'];
				}
				if ( $layersArray === null ) {
					$db = self::getLayersDatabaseService();
					if ( $db ) {
						$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
						if ( $latest && isset( $latest['data'] ) ) {
							$layersArray = isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] )
								? $latest['data']['layers']
								: [];
						}
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
					$json = htmlspecialchars(
						json_encode( $payload, JSON_UNESCAPED_UNICODE ),
						ENT_QUOTES
					);

					// Update first <img ...> tag in $res: append class and add/replace data-layer-data
					$res = preg_replace_callback( '/<img\b([^>]*)>/i', static function ( $m ) use ( $json ) {
						$attrs = $m[1];
						// Append layers-thumbnail to existing class or add new class attr
						if (
							preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm )
						) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							// Avoid duplicate token
							$classesOut = preg_match(
								'/(^|\s)layers-thumbnail(\s|$)/',
								$classes
							)
								? $classes
								: trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}
						// Add or replace data-layer-data
						if (
							preg_match( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', $attrs, $dm )
						) {
							$attrs = preg_replace(
								'/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i',
								'data-layer-data="' . $json . '"',
								$attrs
							);
						} else {
							$attrs .= ' data-layer-data="' . $json . '"';
						}
						return '<img' . $attrs . '>';
					}, (string)$res, 1 );

					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
						$logger->info(
							'Layers: Injected attributes in MakeImageLink2 ('
							. count( $layersArray )
							. ' layers)'
						);
					}
				} else {
					// Mark explicit intent for client-side API fallback
					$res = preg_replace_callback(
						'/<img\b([^>]*)>/i',
						static function ( $m ) {
						$attrs = $m[1];
						if ( preg_match( '/\bdata-layers-intent\s*=\s*("|\')(.*?)(\1)/i', $attrs ) ) {
							$attrs = preg_replace(
								'/\bdata-layers-intent\s*=\s*("|\')(.*?)(\1)/i',
								'data-layers-intent="on"',
								$attrs
							);
						} else {
							$attrs .= ' data-layers-intent="on"';
						}
						// Add marker class for consistent client selection
						if (
							preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm )
						) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							$classesOut = preg_match(
								'/(^|\s)layers-thumbnail(\s|$)/',
								$classes
							)
								? $classes
								: trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}
						return '<img' . $attrs . '>';
						}, (string)$res, 1 );
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
			} elseif ( isset( $frameParams['layers'] ) ) {
				$layersFlag = strtolower( (string)$frameParams['layers'] );
			} elseif ( isset( $frameParams['layer'] ) ) {
				$layersFlag = strtolower( (string)$frameParams['layer'] );
			}
			if ( $layersFlag === null && is_string( $res ) && strpos( $res, 'data-mw=' ) !== false ) {
				$parsed = self::extractLayersFromDataMw( (string)$res );
				if ( $parsed !== null ) {
					$layersFlag = $parsed;
				}
			}
			// Do not rely on href sniffing here; handler params are authoritative

			if ( $layersFlag === 'off' || $layersFlag === 'none' ) {
				return true;
			}

			if (
				$file && (
					$layersFlag === 'all' || $layersFlag === 'on'
					|| isset( $handlerParams['layersjson'] )
					|| isset( $handlerParams['layerData'] )
				)
			) {
				$layersArray = null;
				if ( isset( $handlerParams['layersjson'] ) && is_string( $handlerParams['layersjson'] ) ) {
					$decoded = json_decode( $handlerParams['layersjson'], true );
					if ( is_array( $decoded ) ) {
						$layersArray = (
							isset( $decoded['layers'] ) && is_array( $decoded['layers'] )
						)
								? $decoded['layers']
								: $decoded;
					}
				}
				if (
				$layersArray === null &&
				isset( $handlerParams['layerData'] ) &&
				is_array( $handlerParams['layerData'] )
			) {
					$layersArray = $handlerParams['layerData'];
				}
				if ( $layersArray === null ) {
					$db = self::getLayersDatabaseService();
					if ( $db ) {
						$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
						if ( $latest && isset( $latest['data'] ) ) {
							$layersArray = isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] )
								? $latest['data']['layers']
								: [];
						}
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
					$json = htmlspecialchars(
						json_encode( $payload, JSON_UNESCAPED_UNICODE ),
						ENT_QUOTES
					);
					$res = preg_replace_callback( '/<img\b([^>]*)>/i', static function ( $m ) use ( $json ) {
						$attrs = $m[1];
						// Ensure class contains layers-thumbnail
						if (
							preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm )
						) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							$classesOut = preg_match(
								'/(^|\s)layers-thumbnail(\s|$)/',
								$classes
							)
								? $classes
								: trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}
						// Add or replace data-layer-data
						if (
							preg_match( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', $attrs )
						) {
							$attrs = preg_replace(
								'/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i',
								'data-layer-data="' . $json . '"',
								$attrs
							);
						} else {
							$attrs .= ' data-layer-data="' . $json . '"';
						}
						return '<img' . $attrs . '>';
					}, (string)$res, 1 );

					if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->info(
							'Layers: Injected attributes in LinkerMakeImageLink ('
							. count( $layersArray )
							. ' layers)'
						);
					}
				} else {
					// Mark explicit intent for client-side API fallback
					$res = preg_replace_callback(
						'/<img\b([^>]*)>/i',
						static function ( $m ) {
						$attrs = $m[1];
						if (
							preg_match( '/\bdata-layers-intent\s*=\s*("|\')(.*?)(\1)/i', $attrs )
						) {
							$attrs = preg_replace(
								'/\bdata-layers-intent\s*=\s*("|\')(.*?)(\1)/i',
								'data-layers-intent="on"',
								$attrs
							);
						} else {
							$attrs .= ' data-layers-intent="on"';
						}
						if ( preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm ) ) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							$classesOut = preg_match(
								'/(^|\s)layers-thumbnail(\s|$)/',
								$classes
							)
								? $classes
								: trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}
						return '<img' . $attrs . '>';
						}, (string)$res, 1 );
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
			if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: onLinkerMakeMediaLinkFile fired' );
			}

			// In this hook variant, handler params are not provided; only inject when explicitly requested
			if ( $file ) {
				$param = null;
				// Try to extract layers=<...> from result HTML first
				$resStr = (string)$res;
				if ( preg_match( '/(?:[\?&#]|\|)layers=([^\s"\'<>|&#]+)/i', $resStr, $m ) ) {
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
					// No explicit layers parameter detected
					return true;
				}

				$param = urldecode( $param );
				$param = strtolower( trim( $param ) );

				$layersArray = null;
				$db = self::getLayersDatabaseService();
				if ( !$db ) {
					return true;
				}
				// on/all => show latest set
				if ( $param === 'on' || $param === 'all' ) {
					$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
					if ( $latest && isset( $latest['data'] ) ) {
						$layersArray = (
							isset( $latest['data']['layers'] ) && is_array( $latest['data']['layers'] )
						)
							? $latest['data']['layers']
							: $latest['data'];
					}
				} elseif ( preg_match( '/^id:(\d+)$/', $param, $idM ) ) {
					$ls = $db->getLayerSet( (int)$idM[1] );
					if ( $ls && isset( $ls['data'] ) ) {
						$layersArray = (
							isset( $ls['data']['layers'] ) && is_array( $ls['data']['layers'] )
						)
							? $ls['data']['layers']
							: $ls['data'];
					}
				} elseif ( preg_match( '/^name:(.+)$/', $param, $nm ) ) {
					$ls = $db->getLayerSetByName( $file->getName(), $file->getSha1(), $nm[1] );
					if ( $ls && isset( $ls['data'] ) ) {
						$layersArray = (
							isset( $ls['data']['layers'] ) && is_array( $ls['data']['layers'] )
						)
							? $ls['data']['layers']
							: $ls['data'];
					}
				} elseif ( preg_match( '/^[0-9a-f]{2,8}(?:\s*,\s*[0-9a-f]{2,8})*$/i', $param ) ) {
					// CSV of short IDs => subset from latest
					$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
					if (
						$latest && isset( $latest['data']['layers'] )
						&& is_array( $latest['data']['layers'] )
					) {
						$wanted = array_map( 'trim', explode( ',', strtolower( $param ) ) );
						$subset = [];
						foreach ( (array)$latest['data']['layers'] as $layer ) {
							$id = strtolower( (string)( $layer['id'] ?? '' ) );
							$short = substr( $id, 0, 4 );
							if ( in_array( $short, $wanted, true ) ) {
								$subset[] = $layer;
							}
						}
						$layersArray = $subset;
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
					$rawJson = json_encode( $payload, JSON_UNESCAPED_UNICODE );
					$json = htmlspecialchars( $rawJson, ENT_QUOTES );

					// Also set attributes via reference array for core-generated markup paths
					if ( is_array( $attribs ) ) {
						$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
						$attribs['data-layer-data'] = $rawJson;
					}
					$res = preg_replace_callback(
						'/<img\b([^>]*)>/i',
						static function ( $m ) use ( $json ) {
						$attrs = $m[1];
						if (
							preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm )
						) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							$classesOut = preg_match( '/(^|\s)layers-thumbnail(\s|$)/', $classes )
								? $classes
								: trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}
						if (
							preg_match( '/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i', $attrs )
						) {
							$attrs = preg_replace(
								'/\bdata-layer-data\s*=\s*("|\')(.*?)(\1)/i',
								'data-layer-data="' . $json . '"',
								$attrs
							);
						} else {
							$attrs .= ' data-layer-data="' . $json . '"';
						}
						return '<img' . $attrs . '>';
						}, (string)$res, 1 );

					// Log a small snippet for verification (truncate to avoid noise)
					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
						$snippet = substr( strip_tags( (string)$res ), 0, 200 );
						$logger->info(
							'Layers: LinkerMakeMediaLinkFile result snippet: ' . $snippet
						);
					}

					if ( \class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\MediaWiki\Logger\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->info(
							'Layers: Injected attributes in LinkerMakeMediaLinkFile ('
							. count( $layersArray )
							. ' layers)'
						);
					}
				} else {
					// No inline data, but explicit param detected: mark for client API fallback
					if ( is_array( $attribs ) ) {
						$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
						$attribs['data-layers-intent'] = 'on';
					}
					$res = preg_replace_callback(
						'/<img\b([^>]*)>/i',
						static function ( $m ) {
						$attrs = $m[1];
						if ( preg_match( '/\bdata-layers-intent\s*=\s*("|\')(.*?)(\1)/i', $attrs ) ) {
							$attrs = preg_replace(
								'/\bdata-layers-intent\s*=\s*("|\')(.*?)(\1)/i',
								'data-layers-intent="on"',
								$attrs
							);
						} else {
							$attrs .= ' data-layers-intent="on"';
						}
						if (
							preg_match( '/\bclass\s*=\s*("|\')(.*?)(\1)/i', $attrs, $cm )
						) {
							$full = $cm[0];
							$q = $cm[1];
							$classes = $cm[2];
							$classesOut = preg_match( '/(^|\s)layers-thumbnail(\s|$)/', $classes )
								? $classes
								: trim( $classes . ' layers-thumbnail' );
							$attrs = str_replace( $full, 'class=' . $q . $classesOut . $q, $attrs );
						} else {
							$attrs = ' class="layers-thumbnail"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
						}
						return '<img' . $attrs . '>';
						}, (string)$res, 1 );
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
			if (
				strpos( $href, 'layers=all' ) !== false || strpos( $href, 'layers=on' ) !== false
				|| strpos( $href, 'layer=all' ) !== false || strpos( $href, 'layer=on' ) !== false
			) {
				$layersFlag = 'all';
			}
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
			if (
				strpos( $href, 'layers=all' ) !== false || strpos( $href, 'layers=on' ) !== false
				|| strpos( $href, 'layer=all' ) !== false || strpos( $href, 'layer=on' ) !== false
			) {
				$layersFlag = 'all';
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
					$logger->info( 'Layers: Found layers parameter in link href: ' . $href );
				}
			}
		}

	// Fallback to DB when layers flag is explicitly on/all, or when we detect layers should be shown
	// but don't have layer data yet
		if ( $layerData === null && method_exists( $thumbnail, 'getFile' ) ) {
			$shouldFallback = false;

		// Check if layers flag indicates we should show layers
		if ( $layersFlag === 'on' || $layersFlag === 'all' || $layersFlag === true ) {
			$shouldFallback = true;
		}

		// FALLBACK: Check if pageHasLayers indicates layers should be shown but no flag detected
		if ( !$shouldFallback && self::$pageHasLayers ) {
			// If we detected layers=all in wikitext, enable fallback for all images
			$shouldFallback = true;
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: pageHasLayers=true, enabling fallback layer data fetch' );
			}
		}

		// Also check link attributes for layers parameter as additional fallback
		if ( !$shouldFallback && isset( $linkAttribs['href'] ) ) {
			$href = (string)$linkAttribs['href'];
			if ( strpos( $href, 'layers=all' ) !== false || strpos( $href, 'layers=on' ) !== false ) {
				$shouldFallback = true;
			}
		}

		// Allow file pages (including action=editlayers) to always receive overlays
		$contextIsFile = self::isFilePageContext();
		$contextIsEdit = self::isEditLayersAction();
		if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
			$logger->info( 'Layers: context check - isFilePage=' . ( $contextIsFile ? 'yes' : 'no' ) . ', isEditLayers=' . ( $contextIsEdit ? 'yes' : 'no' ) );
		}
		if ( !$shouldFallback && $contextIsFile ) {
			$shouldFallback = true;
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: enabling fallback because current page is File namespace' );
			}
		}
		if ( !$shouldFallback && $contextIsEdit ) {
			$shouldFallback = true;
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->info( 'Layers: enabling fallback because action=editlayers' );
			}
		}

		// Strict gating: do not auto-enable overlays in debug mode without explicit layers intent.

		if ( $shouldFallback ) {
			$file = $thumbnail->getFile();
			if ( $file ) {
				try {
					$db = self::getLayersDatabaseService();
					if ( !$db ) {
						throw new Exception( 'LayersDatabase service unavailable' );
					}
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
							$logger->info(
								sprintf(
									'Layers: DB fallback provided %d layers for thumbnail',
									count( $layerData )
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
			} elseif ( self::$pageHasLayers ) {
				// If pageHasLayers=true (detected layers=all in wikitext), enable layers
				$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-thumbnail' );
				$attribs['data-layers-intent'] = 'on';
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
	 * Reset the page layers flag (useful for testing)
	 */
	public static function resetPageLayersFlag(): void {
		self::$pageHasLayers = false;
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

			// Multiple patterns to catch different variations
			// Fixed patterns to properly handle layers= appearing directly after first pipe
			$patterns = [
				'/\[\[File:[^|\]]*\|layers\s*=\s*(all|on|true|id:\d+|name:[^|\]]+|[0-9a-fA-F,\s]+)/',
				'/\[\[File:[^|\]]*\|layer\s*=\s*(all|on|true|id:\d+|name:[^|\]]+|[0-9a-fA-F,\s]+)/',
				'/\[\[File:[^|\]]*\|[^|\]]*layers\s*=\s*(all|on|true|id:\d+|name:[^|\]]+|[0-9a-fA-F,\s]+)/',
				'/\[\[File:[^|\]]*\|[^|\]]*layer\s*=\s*(all|on|true|id:\d+|name:[^|\]]+|[0-9a-fA-F,\s]+)/',
				'/\[\[File:[^|\]]*\|.*layers\s*=\s*(all|on|true|id:\d+|name:[^|\]]+)/',
				'/\[\[File:[^|\]]*\|.*layer\s*=\s*(all|on|true|id:\d+|name:[^|\]]+)/'
			];

			foreach ( $patterns as $pattern ) {
				if ( preg_match( $pattern, $text, $matches ) ) {
					self::$pageHasLayers = true;

					if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func(
						[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
						'Layers'
					);
						$logger->info(
							'Layers: ParserBeforeInternalParse detected layers parameter: ' . $matches[0]
							. ', setting pageHasLayers=true'
						);
					}
					break;
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
}
