<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\Parser;
use Wikimedia\StringUtils\StringUtils;

/** Expanded rendering occurrences only; never source-editor admission candidates. */
final class ExpandedFileOptions {
	/**
	 * @param Parser $parser Actual parser receiving InternalParseBeforeLinks
	 * @param string $text Expanded text, with native opaque strip markers intact
	 * @return array Ordered complete file occurrences bound to this invocation
	 */
	public static function collect( Parser $parser, string $text ): array {
		$tokens = iterator_to_array( StringUtils::explode( '[[', $text ), false );
		$starts = [];
		$position = strlen( $tokens[0] );
		for ( $index = 1; $index < count( $tokens ); $index++ ) {
			$starts[$index] = $position;
			$position += 2 + strlen( $tokens[$index] );
		}
		$files = [];
		$invocation = new \stdClass();
		$titles = MediaWikiServices::getInstance()->getTitleFactory();
		$strip = $parser->getStripState();
		for ( $index = 1; $index < count( $tokens ); $index++ ) {
			$token = $tokens[$index];
			$headLength = strcspn( $token, '|]' );
			$head = substr( $token, 0, $headLength );
			$decodedHead = str_replace( [ '<', '>' ], [ '&lt;', '&gt;' ], rawurldecode( $head ) );
			if ( $head === '' || str_starts_with( ltrim( $decodedHead ), ':' ) ||
				$strip->killMarkers( $head ) !== $head ||
				( substr( $token, $headLength, 1 ) !== '|' && substr( $token, $headLength, 2 ) !== ']]' )
			) {
				continue;
			}
			$title = $titles->newFromText( $decodedHead );
			if ( !$title || $title->getNamespace() !== NS_FILE || $title->getInterwiki() !== '' ) {
				continue;
			}
			$close = strpos( $token, ']]' );
			if ( $close === $headLength + 1 && substr( $token, $headLength, 1 ) === '|' ) {
				continue;
			}
			$last = $index;
			if ( $close === false && substr( $token, $headLength, 1 ) === '|' ) {
				for ( $next = $index + 1; $next < count( $tokens ); $next++ ) {
					$first = strpos( $tokens[$next], ']]' );
					if ( $first === false ) {
						break;
					}
					$second = strpos( $tokens[$next], ']]', $first + 2 );
					if ( $second !== false ) {
						$last = $next;
						$close = $second;
						break;
					}
				}
			}
			if ( $close === false ) {
				continue;
			}
			$start = $starts[$index];
			$end = $starts[$last] + 2 + $close + 2;
			if ( $last === $index && substr( $text, $end, 1 ) === ']' &&
				strpos( substr( $text, $start + 2 + $headLength, $end - $start - $headLength - 4 ), '[' ) !== false
			) {
				$end++;
			}
			$raw = substr( $text, $start, $end - $start );
			$body = substr( $raw, 2, -2 );
			$parts = self::parts( $body );
			array_shift( $parts );
			$files[] = [ 'parser' => $parser, 'stripState' => $strip, 'invocation' => $invocation,
				'start' => $start, 'length' => $end - $start, 'raw' => $raw,
				'target' => 'File:' . $title->getDBkey(), 'options' => $parts,
				'head' => $head ];
			$index = $last;
		}
		return $files;
	}

	/**
	 * @param string $body Expanded complete link body
	 * @return string[] Ordered top-level parts retaining every original byte
	 */
	private static function parts( string $body ): array {
		$opaque = "\0layers-expanded-pipe\0";
		while ( str_contains( $body, $opaque ) ) {
			$opaque .= '0';
		}
		$brackets = iterator_to_array( StringUtils::delimiterExplode( '[', ']', '|', $body, true ), false );
		$protected = array_map( static fn ( string $part ): string => str_replace( '|', $opaque, $part ), $brackets );
		$parts = StringUtils::delimiterExplode( '-{', '}-', '|', implode( '|', $protected ), true );
		return array_map( static fn ( string $part ): string => str_replace( $opaque, '|', $part ),
			iterator_to_array( $parts, false ) );
	}
}
