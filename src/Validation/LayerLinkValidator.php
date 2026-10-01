<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Validation;

use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

/**
 * Validates the optional layer link property according to FEAT-8 and SEC-3/SEC-5.
 *
 * Rejects invalid, dangerous, or malformed link values without attempting
 * in-flight repairs: links are stored byte-for-byte or refused completely.
 */
class LayerLinkValidator {

	/** @var string Regex partial pattern for allowed external URL protocols */
	private string $protocols;

	/** @var callable Callable validating wiki title strings */
	private $titleValidator;

	/**
	 * Maximum byte length conforming to MediaWiki's external link URL ceiling.
	 */
	public const MAX_LINK_BYTES = 2048;

	/**
	 * @param string|null $protocols Injected protocols partial pattern, or null for wiki UrlUtils
	 * @param callable|null $titleValidator Injected title validator callable, or null for Title::newFromText
	 */
	public function __construct( ?string $protocols = null, ?callable $titleValidator = null ) {
		if ( $protocols === null ) {
			try {
				if ( class_exists( MediaWikiServices::class ) ) {
					$protocols = MediaWikiServices::getInstance()->getUrlUtils()->validProtocols();
				} else {
					$protocols = 'https?:\/\/|ftp:\/\/|mailto:|\/\/';
				}
			} catch ( \Throwable $e ) {
				$protocols = 'https?:\/\/|ftp:\/\/|mailto:|\/\/';
			}
		}
		$this->protocols = $protocols;

		if ( $titleValidator === null ) {
			$this->titleValidator = static function ( string $text ) {
				try {
					$ns = defined( 'NS_MAIN' ) ? constant( 'NS_MAIN' ) : 0;
					if ( class_exists( Title::class ) ) {
						return Title::newFromText( $text, $ns );
					}
				} catch ( \Throwable $e ) {
					return self::fallbackTitleCheck( $text );
				}
				return self::fallbackTitleCheck( $text );
			};
		} else {
			$this->titleValidator = $titleValidator;
		}
	}

	/**
	 * Basic title validation fallback when MediaWiki Title parser services are disabled.
	 *
	 * @param string $text Title candidate string
	 * @return bool|null Non-null if valid, null if invalid
	 */
	public static function fallbackTitleCheck( string $text ) {
		if ( $text === '' || strlen( $text ) > 255 ) {
			return null;
		}
		if ( preg_match( '/[#<>[\]|{}\x00-\x1f\x7f]/', $text ) ) {
			return null;
		}
		if ( str_starts_with( $text, ':' ) || str_contains( $text, '::' ) ) {
			return null;
		}
		if ( $text === '.' || $text === '..' || str_contains( $text, '/./' ) || str_contains( $text, '/../' ) ) {
			return null;
		}
		return true;
	}

	/**
	 * Validate a layer's link property value.
	 *
	 * @param mixed $value Property value to validate
	 * @return array{valid: bool, value?: string, error?: string}
	 */
	public function validate( $value ): array {
		if ( !is_string( $value ) ) {
			return [ 'valid' => false, 'error' => 'Link must be a string' ];
		}

		if ( $value === '' ) {
			return [ 'valid' => false, 'error' => 'Link cannot be empty' ];
		}

		if ( strlen( $value ) > self::MAX_LINK_BYTES ) {
			return [ 'valid' => false, 'error' => 'Link cannot exceed 2048 bytes' ];
		}

		if ( preg_match( '/^\s|\s$/u', $value ) || $value !== trim( $value ) ) {
			return [ 'valid' => false, 'error' => 'Link cannot have leading or trailing whitespace' ];
		}

		if ( preg_match( '/[\x00-\x1f\x7f]/', $value ) ) {
			return [ 'valid' => false, 'error' => 'Link cannot contain control characters' ];
		}

		// Script-bearing pseudo-protocols are refused by name even if a wiki lists them in
		// $wgUrlProtocols. "File:" and "Data:" are also namespaces, so they are refused only when
		// what follows is a URL ("file:/", "data:image/png", "data:,").
		if ( preg_match(
			'/^(?:(?:javascript|vbscript|blob):|file:\/|data:(?:[;,]|(?:text|image|application|audio|video'
			. '|font|model|multipart|message)\/))/i',
			$value
		) ) {
			return [ 'valid' => false, 'error' => 'Link protocol is forbidden' ];
		}

		// Check if the value starts with an allowed external URL protocol
		$protocolPattern = '/^(?:' . $this->protocols . ')/i';
		if ( preg_match( $protocolPattern, $value ) ) {
			return $this->validateExternalUrl( $value );
		}

		return $this->validateInternalLink( $value );
	}

	/**
	 * Validate an external URL value.
	 *
	 * @param string $value External URL candidate
	 * @return array{valid: bool, value?: string, error?: string}
	 */
	private function validateExternalUrl( string $value ): array {
		if ( preg_match( '/[\s<>"]/u', $value ) ) {
			return [ 'valid' => false, 'error' => 'Invalid external link URL' ];
		}
		$parsed = parse_url( $value );
		if ( $parsed === false ) {
			return [ 'valid' => false, 'error' => 'Invalid external link URL' ];
		}

		$isMailto = (bool)preg_match( '/^mailto:/i', $value );
		if ( $isMailto ) {
			$address = substr( $value, 7 );
			if ( $address === '' ) {
				return [ 'valid' => false, 'error' => 'Invalid external link URL' ];
			}
			return [ 'valid' => true, 'value' => $value ];
		}

		if ( empty( $parsed['host'] ) ) {
			return [ 'valid' => false, 'error' => 'Invalid external link URL' ];
		}

		return [ 'valid' => true, 'value' => $value ];
	}

	/**
	 * Validate an internal wiki link value.
	 *
	 * @param string $value Internal wiki link candidate
	 * @return array{valid: bool, value?: string, error?: string}
	 */
	private function validateInternalLink( string $value ): array {
		$hashPos = strpos( $value, '#' );
		if ( $hashPos !== false ) {
			$titlePart = substr( $value, 0, $hashPos );
			$fragmentPart = substr( $value, $hashPos + 1 );
		} else {
			$titlePart = $value;
			$fragmentPart = null;
		}

		if ( $titlePart === '' ) {
			if ( $fragmentPart === null || $fragmentPart === '' ) {
				return [ 'valid' => false, 'error' => 'Link section anchor cannot be empty' ];
			}
			return [ 'valid' => true, 'value' => $value ];
		}

		$title = ( $this->titleValidator )( $titlePart );
		if ( !$title ) {
			return [ 'valid' => false, 'error' => 'Invalid wiki page title in link' ];
		}

		return [ 'valid' => true, 'value' => $value ];
	}
}
