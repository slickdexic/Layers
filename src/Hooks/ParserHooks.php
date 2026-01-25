<?php

declare( strict_types=1 );

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
		// Intentionally left minimal; normalization is handled in WikitextHooks
		return true;
	}
}
