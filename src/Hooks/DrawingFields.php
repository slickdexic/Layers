<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Html\Html;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\Sanitizer;

/**
 * {{#layers_fields:drawing|name=value|…}} supplies values that a page's own drawing shows in place of
 * {{name}} tokens in its text. Values are ordinary page output: Cargo queries, templates and other parser
 * functions can compute them, and they update whenever the page is rendered again. The drawing itself,
 * its history and its search text keep the tokens.
 */
final class DrawingFields {
	/** mw.config key: a set whose keys are JSON [ drawing, name, value ] entries */
	public const CONFIG_VAR = 'wgLayersDrawingFields';
	private const NAME = '/^[A-Za-z0-9_][A-Za-z0-9_ .-]{0,63}$/D';
	private const MAX_DRAWINGS = 50;
	private const MAX_FIELDS = 100;
	private const MAX_VALUE_LENGTH = 1000;

	/**
	 * @param Parser $parser
	 * @param string $drawing Surface ID, the last part of the drawing's layersbinding
	 * @param string ...$args name=value pairs, already expanded
	 * @return string|array Nothing, or an error shown in place
	 */
	public static function parserFunction( Parser $parser, string $drawing = '', string ...$args ) {
		$drawing = trim( $drawing );
		if ( !preg_match( '/^[A-Za-z0-9_-]{1,64}$/D', $drawing ) ) {
			return self::error( $parser, 'layers-fields-invalid-drawing' );
		}
		$output = $parser->getOutput();
		// Each value is one [ drawing, name, value ] entry in an order-independent set; the viewer builds the map.
		$drawings = [];
		$names = [];
		foreach ( array_keys( $output->getJsConfigVars()[self::CONFIG_VAR] ?? [] ) as $entry ) {
			[ $otherDrawing, $otherName ] = json_decode( (string)$entry, true );
			$drawings[$otherDrawing] = true;
			if ( $otherDrawing === $drawing ) {
				$names[$otherName] = true;
			}
		}
		$entries = [];
		foreach ( $args as $arg ) {
			$pair = explode( '=', $arg, 2 );
			$name = trim( $pair[0] );
			if ( count( $pair ) !== 2 || !preg_match( self::NAME, $name ) ) {
				return self::error( $parser, 'layers-fields-invalid-field' );
			}
			// Drawings show plain text: links keep their text, markup and tags are dropped.
			$text = Sanitizer::stripAllTags( $parser->recursiveTagParseFully( trim( $pair[1] ) ) );
			$entries[] = json_encode( [ $drawing, $name, mb_substr( trim( $text ), 0, self::MAX_VALUE_LENGTH ) ],
				JSON_UNESCAPED_UNICODE );
			$names[$name] = true;
		}
		if ( count( $names ) > self::MAX_FIELDS ||
			( !isset( $drawings[$drawing] ) && count( $drawings ) >= self::MAX_DRAWINGS )
		) {
			return self::error( $parser, 'layers-fields-too-many' );
		}
		foreach ( $entries as $entry ) {
			$output->appendJsConfigVar( self::CONFIG_VAR, $entry );
		}
		return '';
	}

	/**
	 * @param Parser $parser
	 * @param string $key
	 * @return array
	 */
	private static function error( Parser $parser, string $key ): array {
		return [ Html::element( 'strong', [ 'class' => 'error' ], $parser->msg( $key )->text() ),
			'noparse' => true, 'isHTML' => true ];
	}
}
