<?php
/**
 * Layers HTML Injector
 *
 * Centralized class for injecting layer data attributes into HTML.
 * Eliminates code duplication across WikitextHooks methods.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks\Processors;

use Psr\Log\LoggerInterface;

/**
 * Handles injection of layer data into HTML elements.
 *
 * This class provides a single source of truth for:
 * - Adding data-layer-data attributes to images
 * - Adding the layers-thumbnail class
 * - Encoding layer payloads as JSON
 * - Logging layer injection events
 */
class LayersHtmlInjector {

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger = null;

	/**
	 * Get logger instance (lazy initialization)
	 *
	 * @return LoggerInterface|null
	 */
	private function getLogger(): ?LoggerInterface {
		if ( $this->logger === null && class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$this->logger = call_user_func(
				[ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ],
				'Layers'
			);
		}
		return $this->logger;
	}

	/**
	 * Build the payload array for layer data injection
	 *
	 * @param array $layers Array of layer objects
	 * @param int|null $baseWidth Original image width
	 * @param int|null $baseHeight Original image height
	 * @return array Payload ready for JSON encoding
	 */
	public function buildPayload( array $layers, ?int $baseWidth = null, ?int $baseHeight = null ): array {
		$payload = [ 'layers' => $layers ];

		if ( $baseWidth !== null && $baseHeight !== null && $baseWidth > 0 && $baseHeight > 0 ) {
			$payload['baseWidth'] = $baseWidth;
			$payload['baseHeight'] = $baseHeight;
		}

		return $payload;
	}

	/**
	 * Encode payload as JSON for safe HTML attribute usage
	 *
	 * @param array $payload The payload to encode
	 * @return string HTML-safe JSON string
	 */
	public function encodePayload( array $payload ): string {
		return htmlspecialchars(
			json_encode( $payload, JSON_UNESCAPED_UNICODE ),
			ENT_QUOTES
		);
	}

	/**
	 * Inject layer data into an HTML string containing an <img> tag
	 *
	 * @param string $html The HTML string to modify
	 * @param array $layers The layers to inject
	 * @param int|null $baseWidth Original image width
	 * @param int|null $baseHeight Original image height
	 * @param string $context Logging context (e.g., 'MakeImageLink2')
	 * @return string Modified HTML with layer data injected
	 */
	public function injectIntoHtml(
		string $html,
		array $layers,
		?int $baseWidth = null,
		?int $baseHeight = null,
		string $context = 'unknown'
	): string {
		$payload = $this->buildPayload( $layers, $baseWidth, $baseHeight );
		$json = $this->encodePayload( $payload );

		$result = preg_replace_callback(
			'/<img\b([^>]*)>/i',
			function ( $matches ) use ( $json ) {
				return $this->processImgTag( $matches[1], $json );
			},
			$html,
			// Only replace first <img> tag
			1
		);

		$logger = $this->getLogger();
		if ( $logger !== null ) {
			$logger->info(
				'Layers: Injected attributes in ' . $context . ' (' . count( $layers ) . ' layers)'
			);
		}

		return $result ?? $html;
	}

	/**
	 * Inject intent marker (for client-side API fallback) into HTML
	 *
	 * @param string $html The HTML string to modify
	 * @param string $intent The intent value (e.g., 'on', set name)
	 * @return string Modified HTML with intent marker
	 */
	public function injectIntentMarker( string $html, string $intent = 'on' ): string {
		return preg_replace_callback(
			'/<img\b([^>]*)>/i',
			function ( $matches ) use ( $intent ) {
				return $this->processImgTagForIntent( $matches[1], $intent );
			},
			$html,
			1
		) ?? $html;
	}

	/**
	 * Process an <img> tag's attributes to add layer data
	 *
	 * @param string $attrs The existing attributes string
	 * @param string $json The JSON-encoded layer data
	 * @return string Complete <img> tag with modified attributes
	 */
	private function processImgTag( string $attrs, string $json ): string {
		$attrs = $this->addOrUpdateClass( $attrs, 'layers-thumbnail' );
		$attrs = $this->addOrUpdateAttribute( $attrs, 'data-layer-data', $json );
		return '<img' . $attrs . '>';
	}

	/**
	 * Process an <img> tag's attributes to add intent marker
	 *
	 * @param string $attrs The existing attributes string
	 * @param string $intent The intent value
	 * @return string Complete <img> tag with modified attributes
	 */
	private function processImgTagForIntent( string $attrs, string $intent ): string {
		$attrs = $this->addOrUpdateClass( $attrs, 'layers-thumbnail' );
		$attrs = $this->addOrUpdateAttribute( $attrs, 'data-layers-intent', $intent );
		return '<img' . $attrs . '>';
	}

	/**
	 * Add or update a class on an element's attributes string
	 *
	 * @param string $attrs The attributes string
	 * @param string $className The class to add
	 * @return string Modified attributes string
	 */
	public function addOrUpdateClass( string $attrs, string $className ): string {
		if ( preg_match( '/\bclass\s*=\s*(["\'])(.*?)\1/i', $attrs, $matches ) ) {
			$quote = $matches[1];
			$existingClasses = $matches[2];

			// Check if class already exists
			if ( preg_match( '/(^|\s)' . preg_quote( $className, '/' ) . '(\s|$)/', $existingClasses ) ) {
				// Class already present
			return $attrs;
			}

			// Add class to existing
			$newClasses = trim( $existingClasses . ' ' . $className );
			return preg_replace(
				'/\bclass\s*=\s*(["\'])(.*?)\1/i',
				'class=' . $quote . $newClasses . $quote,
				$attrs
			);
		}

		// No class attribute, add new one
		return ' class="' . $className . '"' . ( $attrs ? ' ' . ltrim( $attrs ) : '' );
	}

	/**
	 * Add or update an attribute on an element's attributes string
	 *
	 * @param string $attrs The attributes string
	 * @param string $name The attribute name
	 * @param string $value The attribute value (already HTML-escaped)
	 * @return string Modified attributes string
	 */
	public function addOrUpdateAttribute( string $attrs, string $name, string $value ): string {
		$pattern = '/\b' . preg_quote( $name, '/' ) . '\s*=\s*(["\'])(.*?)\1/i';

		if ( preg_match( $pattern, $attrs ) ) {
			// Update existing attribute
			return preg_replace( $pattern, $name . '="' . $value . '"', $attrs );
		}

		// Add new attribute
		return $attrs . ' ' . $name . '="' . $value . '"';
	}

	/**
	 * Inject layer data into HTML attributes array (for direct attribute manipulation)
	 *
	 * @param array &$attribs Reference to attributes array
	 * @param array $layers The layers to inject
	 * @param int|null $baseWidth Original image width
	 * @param int|null $baseHeight Original image height
	 */
	public function injectIntoAttributes(
		array &$attribs,
		array $layers,
		?int $baseWidth = null,
		?int $baseHeight = null
	): void {
		$payload = $this->buildPayload( $layers, $baseWidth, $baseHeight );

		// Add or update class
		$existingClass = $attribs['class'] ?? '';
		if ( !preg_match( '/(^|\s)layers-thumbnail(\s|$)/', $existingClass ) ) {
			$attribs['class'] = trim( $existingClass . ' layers-thumbnail' );
		}

		// Add data attribute
		$attribs['data-layer-data'] = json_encode( $payload, JSON_UNESCAPED_UNICODE );
	}

	/**
	 * Get file dimensions safely
	 *
	 * @param mixed $file File object (MediaWiki File or similar)
	 * @return array Associative array with 'width' and 'height' keys (nullable ints)
	 */
	public function getFileDimensions( $file ): array {
		$width = null;
		$height = null;

		if ( $file !== null ) {
			if ( method_exists( $file, 'getWidth' ) ) {
				$width = (int)$file->getWidth();
			}
			if ( method_exists( $file, 'getHeight' ) ) {
				$height = (int)$file->getHeight();
			}
		}

		return [ 'width' => $width, 'height' => $height ];
	}
}
