<?php
/**
 * Wikitext parser hooks for image parameter handling
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks;

class ParserHooks {

	/**
	 * Simple parser hook that just logs what it receives
	 * @param Title $title The title object
	 * @param File $file The file object
	 * @param array &$params The parameters array
	 * @param Parser $parser The parser object
	 * @return bool
	 */
	public static function onParserMakeImageParams( $title, $file, &$params, $parser ) {
		// Just log for debugging - keep it simple
		error_log( 'Layers: ParserMakeImageParams called for file: ' . $file->getName() );
		error_log( 'Layers: Available params: ' . implode( ', ', array_keys( $params ) ) );

		return true;
	}
}
