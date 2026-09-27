<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use MediaWiki\Html\Html;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\Sanitizer;
use MediaWiki\Title\Title;

/**
 * {{#layers_fields:drawing|name=value|…}} supplies values that a drawing the page shows (its own, a file's
 * shared set or a slide) shows in place of
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
	 * @param string $drawing Page-owned drawing ID (the last part of its layersbinding), File:name or Slide:name
	 * @param string ...$args name=value pairs, already expanded
	 * @return string|array Nothing, or an error shown in place
	 */
	public static function parserFunction( Parser $parser, string $drawing = '', string ...$args ) {
		$drawing = self::drawingKey( trim( $drawing ) );
		if ( $drawing === null ) {
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
	 * @param string $drawing A page-owned drawing ID, a File: name for the shared sets shown of that file, or a
	 *  Slide: name
	 * @return string|null The key the viewers look up: the ID, File:<DB key> or Slide:<name>
	 */
	private static function drawingKey( string $drawing ): ?string {
		if ( preg_match( '/^[A-Za-z0-9_-]{1,64}$/D', $drawing ) ) {
			return $drawing;
		}
		if ( str_starts_with( $drawing, LayersConstants::SLIDE_PREFIX ) ) {
			$slide = trim( substr( $drawing, strlen( LayersConstants::SLIDE_PREFIX ) ) );
			return ( new SlideNameValidator() )->isValid( $slide ) ?
				LayersConstants::SLIDE_PREFIX . $slide : null;
		}
		$title = Title::newFromText( $drawing );
		return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() ?
			'File:' . $title->getDBkey() : null;
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
