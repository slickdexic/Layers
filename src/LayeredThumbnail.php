<?php
/**
 * Custom thumbnail class for layered images
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers;

use File;
use MediaTransformOutput;
use MediaWiki\MediaWikiServices;

class LayeredThumbnail extends MediaTransformOutput {

	private $layeredPath;

	/**
	 * @param File $file
	 * @param string $layeredPath Path to the composite thumbnail
	 * @param array $params Transform parameters
	 */
	public function __construct( File $file, string $layeredPath, array $params ) {
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
		$config = MediaWikiServices::getInstance()->getMainConfig();
		$uploadDir = $config->get( 'UploadDirectory' );
		$uploadPath = $config->get( 'UploadPath' );

		// Convert absolute path to relative URL
		if ( strpos( $path, $uploadDir ) === 0 ) {
			$relativePath = substr( $path, strlen( $uploadDir ) );
			return $uploadPath . $relativePath;
		}

		// Fallback - this shouldn't happen in normal operation
		return $uploadPath . '/thumb/layers/' . basename( $path );
	}

	/**
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

		$html = \Html::element( 'img', $attribs );

		// Add layer data attributes for viewer
		if ( !empty( $options['layers'] ) ) {
			$html = \Html::rawElement( 'div', [
				'class' => 'layers-image-container',
				'data-layers' => htmlspecialchars( json_encode( $options['layers'] ) )
			], $html );
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
}
