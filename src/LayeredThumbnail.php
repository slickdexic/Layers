<?php

/**
 * Custom thumbnail class for layered images
 *
 * @file
 * @ingroup Extensions
 */
namespace MediaWiki\Extension\Layers;

class LayeredThumbnail extends \MediaTransformOutput {

	/** @var mixed File */
	private $file;
	/** @var string */
	private $layeredPath;
	/** @var string */
	private $url;
	/** @var string */
	private $path;
	/** @var int|null */
	private $width;
	/** @var int|null */
	private $height;

	/**
	 * @param mixed $file MediaWiki File object
	 * @param string $layeredPath Path to the composite thumbnail
	 * @param array $params Transform parameters
	 */
	public function __construct( $file, string $layeredPath, array $params ) {
		$this->file = $file;
		$this->layeredPath = $layeredPath;
		$this->url = $this->getLayeredUrl( $layeredPath );
		$this->path = $layeredPath;

		// Set dimensions from params or calculate from image
		if ( isset( $params['width'] ) ) {
			$this->width = $params['width'];
		}
		if ( isset( $params['height'] ) ) {
			$this->height = $params['height'];
		}

		// If dimensions not set, try to get from image
		if ( !$this->width || !$this->height ) {
			$imageSize = getimagesize( $layeredPath );
			if ( $imageSize ) {
				$this->width = $this->width ?: $imageSize[0];
				$this->height = $this->height ?: $imageSize[1];
			}
		}
	}

	/**
	 * Convert file path to web-accessible URL
	 * @param string $path
	 * @return string
	 */
	private function getLayeredUrl( string $path ): string {
		// Prefer MediaWikiServices when available; otherwise fallback to globals
		$uploadDir = null;
		$uploadPath = null;
		if ( \class_exists( '\\MediaWiki\\MediaWikiServices' ) ) {
			$config = \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )->getMainConfig();
			$uploadDir = $config->get( 'UploadDirectory' );
			$uploadPath = $config->get( 'UploadPath' );
		} else {
			$uploadDir = $GLOBALS['wgUploadDirectory'] ?? sys_get_temp_dir();
			$uploadPath = $GLOBALS['wgUploadPath'] ?? '/images';
		}

		// Convert absolute path to relative URL
		// Normalize slashes for Windows paths
		$normPath = str_replace( '\\', '/', $path );
		$normUploadDir = str_replace( '\\', '/', $uploadDir );
		$normUploadDir = rtrim( $normUploadDir, '/' );
		if ( strpos( $normPath, $normUploadDir ) === 0 ) {
			$relativePath = substr( $normPath, strlen( $normUploadDir ) );
			$relativePath = str_replace( '\\', '/', $relativePath );
			return rtrim( $uploadPath, '/' ) . $relativePath;
		}

		// Fallback - this shouldn't happen in normal operation
		return rtrim( $uploadPath, '/' ) . '/thumb/layers/' . basename( $path );
	}

	/**
	 * @param array $options HTML generation options
	 * @return string HTML for the thumbnail
	 */
	public function toHtml( $options = [] ) {
		$alt = $options['alt'] ?? '';
		$title = $options['title'] ?? '';

		$attribs = [
			'src' => $this->getUrl(),
			'width' => $this->getWidth(),
			'height' => $this->getHeight(),
			'alt' => $alt,
			'class' => 'layers-thumbnail'
		];

		if ( $title ) {
			$attribs['title'] = $title;
		}

		// Build minimal IMG tag without relying on Html helper
		$attrs = [];
		foreach ( $attribs as $k => $v ) {
			$attrs[] = htmlspecialchars( $k, ENT_QUOTES ) . '="' . htmlspecialchars( (string)$v, ENT_QUOTES ) . '"';
		}
		$html = '<img ' . implode( ' ', $attrs ) . ' />';

		// Add layer data attributes for viewer
		if ( !empty( $options['layers'] ) ) {
			$dataLayers = htmlspecialchars( json_encode( $options['layers'] ) );
			$html = '<div class="layers-image-container" data-layers="' . $dataLayers . '">' . $html . '</div>';
		}

		return $html;
	}

	/**
	 * @return bool Always true for layered thumbnails
	 */
	public function hasFile() {
		return file_exists( $this->path );
	}

	/**
	 * @return string Local file path
	 */
	public function getLocalCopyPath() {
		return $this->path;
	}

	/**
	 * Expose URL for callers that need it
	 * @return string
	 */
	public function getUrl() {
		return $this->url;
	}

	/**
	 * @return int|null
	 */
	public function getWidth() {
		return $this->width;
	}

	/**
	 * @return int|null
	 */
	public function getHeight() {
		return $this->height;
	}
}
