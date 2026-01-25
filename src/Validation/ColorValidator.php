<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Validation;

/**
 * Color validation and sanitization service
 *
 * This class handles validation and sanitization of color values
 * to ensure they are safe and properly formatted.
 */
class ColorValidator {

	/**
	 * Maximum length for color strings to prevent ReDoS attacks.
	 * Longest valid color would be something like "rgba(255, 255, 255, 0.999)"
	 * which is ~30 chars. 50 chars provides margin for whitespace.
	 */
	private const MAX_COLOR_LENGTH = 50;

	/**
	 * Valid CSS named colors
	 * @var array
	 */
	private const NAMED_COLORS = [
		// SVG standard: no fill/stroke
		'none',
		'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
		'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
		'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue',
		'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
		'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon',
		'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise',
		'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
		'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite',
		'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink',
		'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen',
		'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
		'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen',
		'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow',
		'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue',
		'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
		'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose',
		'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
		'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
		'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'red',
		'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen',
		'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey',
		'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise',
		'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen', 'transparent'
	];

	/** @var string Default safe color */
	private const DEFAULT_COLOR = '#000000';

	/**
	 * Validate and sanitize a color value
	 *
	 * @param mixed $color Color value to validate
	 * @return string Sanitized color value
	 */
	public function sanitizeColor( $color ): string {
		if ( !is_string( $color ) ) {
			return self::DEFAULT_COLOR;
		}

		// ReDoS protection: reject excessively long inputs before regex processing
		if ( strlen( $color ) > self::MAX_COLOR_LENGTH ) {
			return self::DEFAULT_COLOR;
		}

		$color = trim( strtolower( $color ) );

		// Check for named colors
		if ( $this->isNamedColor( $color ) ) {
			return $color;
		}

		// Check for hex colors
		if ( $this->isValidHexColor( $color ) ) {
			return $this->normalizeHexColor( $color );
		}

		// Check for RGB/RGBA colors
		if ( $this->isValidRgbColor( $color ) ) {
			return $this->sanitizeRgbColor( $color );
		}

		// Check for HSL/HSLA colors
		if ( $this->isValidHslColor( $color ) ) {
			return $this->sanitizeHslColor( $color );
		}

		// Invalid color, return default
		return self::DEFAULT_COLOR;
	}

	/**
	 * Check if a color is a valid named color
	 *
	 * @param string $color Color name
	 * @return bool True if valid named color
	 */
	public function isNamedColor( string $color ): bool {
		return in_array( strtolower( $color ), self::NAMED_COLORS, true );
	}

	/**
	 * Check if a color is a valid hex color
	 *
	 * @param string $color Color value
	 * @return bool True if valid hex color
	 */
	public function isValidHexColor( string $color ): bool {
		return preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $color ) === 1;
	}

	/**
	 * Check if a color is a valid RGB/RGBA color
	 *
	 * @param string $color Color value
	 * @return bool True if valid RGB color
	 */
	public function isValidRgbColor( string $color ): bool {
		// ReDoS protection: reject excessively long inputs before regex processing
		if ( strlen( $color ) > self::MAX_COLOR_LENGTH ) {
			return false;
		}

		// RGB format: rgb(255, 255, 255)
		if ( preg_match( '/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i', $color, $matches ) ) {
			return $this->areRgbValuesValid( (int)$matches[1], (int)$matches[2], (int)$matches[3] );
		}

		// RGBA format: rgba(255, 255, 255, 0.5)
		if ( preg_match( '/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i', $color, $matches ) ) {
			$alpha = (float)$matches[4];
			return $this->areRgbValuesValid( (int)$matches[1], (int)$matches[2], (int)$matches[3] ) &&
				$alpha >= 0 && $alpha <= 1;
		}

		return false;
	}

	/**
	 * Check if a color is a valid HSL/HSLA color
	 *
	 * @param string $color Color value
	 * @return bool True if valid HSL color
	 */
	public function isValidHslColor( string $color ): bool {
		// ReDoS protection: reject excessively long inputs before regex processing
		if ( strlen( $color ) > self::MAX_COLOR_LENGTH ) {
			return false;
		}

		// HSL format: hsl(360, 100%, 50%)
		if ( preg_match( '/^hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/i', $color, $matches ) ) {
			$h = (int)$matches[1];
			$s = (int)$matches[2];
			$l = (int)$matches[3];
			return $h >= 0 && $h <= 360 && $s >= 0 && $s <= 100 && $l >= 0 && $l <= 100;
		}

		// HSLA format: hsla(360, 100%, 50%, 0.5)
		if ( preg_match( '/^hsla\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)$/i', $color, $matches ) ) {
			$h = (int)$matches[1];
			$s = (int)$matches[2];
			$l = (int)$matches[3];
			$a = (float)$matches[4];
			return $h >= 0 && $h <= 360 && $s >= 0 && $s <= 100 && $l >= 0 && $l <= 100 && $a >= 0 && $a <= 1;
		}

		return false;
	}

	/**
	 * Normalize hex color to standard format
	 *
	 * @param string $color Hex color
	 * @return string Normalized hex color
	 */
	private function normalizeHexColor( string $color ): string {
		$color = strtolower( $color );

		// Expand 3-digit hex to 6-digit
		if ( strlen( $color ) === 4 ) {
			$color = '#' . $color[1] . $color[1] . $color[2] . $color[2] . $color[3] . $color[3];
		}

		return $color;
	}

	/**
	 * Sanitize RGB color by clamping values
	 *
	 * @param string $color RGB color string
	 * @return string Sanitized RGB color
	 */
	private function sanitizeRgbColor( string $color ): string {
		if ( preg_match( '/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i', $color, $matches ) ) {
			$r = max( 0, min( 255, (int)$matches[1] ) );
			$g = max( 0, min( 255, (int)$matches[2] ) );
			$b = max( 0, min( 255, (int)$matches[3] ) );
			return "rgb($r, $g, $b)";
		}

		if ( preg_match( '/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i', $color, $matches ) ) {
			$r = max( 0, min( 255, (int)$matches[1] ) );
			$g = max( 0, min( 255, (int)$matches[2] ) );
			$b = max( 0, min( 255, (int)$matches[3] ) );
			$a = max( 0, min( 1, (float)$matches[4] ) );
			return "rgba($r, $g, $b, $a)";
		}

		return self::DEFAULT_COLOR;
	}

	/**
	 * Sanitize HSL color by clamping values
	 *
	 * @param string $color HSL color string
	 * @return string Sanitized HSL color
	 */
	private function sanitizeHslColor( string $color ): string {
		if ( preg_match( '/^hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/i', $color, $matches ) ) {
			$h = max( 0, min( 360, (int)$matches[1] ) );
			$s = max( 0, min( 100, (int)$matches[2] ) );
			$l = max( 0, min( 100, (int)$matches[3] ) );
			return "hsl($h, $s%, $l%)";
		}

		if ( preg_match( '/^hsla\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)$/i', $color, $matches ) ) {
			$h = max( 0, min( 360, (int)$matches[1] ) );
			$s = max( 0, min( 100, (int)$matches[2] ) );
			$l = max( 0, min( 100, (int)$matches[3] ) );
			$a = max( 0, min( 1, (float)$matches[4] ) );
			return "hsla($h, $s%, $l%, $a)";
		}

		return self::DEFAULT_COLOR;
	}

	/**
	 * Check if RGB values are within valid range
	 *
	 * @param int $r Red value
	 * @param int $g Green value
	 * @param int $b Blue value
	 * @return bool True if all values are valid
	 */
	private function areRgbValuesValid( int $r, int $g, int $b ): bool {
		return $r >= 0 && $r <= 255 && $g >= 0 && $g <= 255 && $b >= 0 && $b <= 255;
	}

	/**
	 * Check if a color value is safe (no dangerous content)
	 *
	 * @param string $color Color value
	 * @return bool True if color is safe
	 */
	public function isSafeColor( string $color ): bool {
		// Check for dangerous protocols or JavaScript
		$dangerousPatterns = [
			'/javascript:/i',
			'/expression\s*\(/i',
			'/url\s*\(/i',
			'/<script/i',
			'/eval\s*\(/i'
		];

		foreach ( $dangerousPatterns as $pattern ) {
			if ( preg_match( $pattern, $color ) ) {
				return false;
			}
		}

		return true;
	}
}
