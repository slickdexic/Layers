<?php
/**
 * Processor for rendering layered files from parser functions
 *
 * Extracted from WikitextHooks to improve separation of concerns.
 * Handles the {{#layeredfile:...}} parser function logic.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks\Processors;

use Exception;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;

/**
 * Handles rendering of layered files from parser functions
 */
class LayeredFileRenderer {

	/**
	 * @var LoggerInterface|null
	 */
	private ?LoggerInterface $logger;

	/**
	 * @var LayersDatabase|null
	 */
	private ?LayersDatabase $db;

	/**
	 * Constructor
	 *
	 * @param LoggerInterface|null $logger Optional logger instance
	 * @param LayersDatabase|null $db Optional database instance
	 */
	public function __construct( ?LoggerInterface $logger = null, ?LayersDatabase $db = null ) {
		$this->logger = $logger;
		$this->db = $db;
	}

	/**
	 * Render a file with layers from parser function
	 *
	 * @param mixed $parser The parser object
	 * @param mixed $frame The frame object
	 * @param array $args The arguments array
	 * @return string Rendered HTML
	 */
	public function render( $parser, $frame, array $args ): string {
		try {
			// Parse arguments
			if ( empty( $args ) ) {
				return $this->errorSpan( 'No filename specified' );
			}

			$filename = isset( $args[0] ) ? trim( $frame->expand( $args[0] ) ) : '';
			$size = isset( $args[1] ) ? trim( $frame->expand( $args[1] ) ) : '';
			$layersArg = isset( $args[2] ) ? trim( $frame->expand( $args[2] ) ) : '';
			$caption = isset( $args[3] ) ? trim( $frame->expand( $args[3] ) ) : '';

			if ( empty( $filename ) ) {
				return $this->errorSpan( 'No filename specified' );
			}

			// Parse the layers parameter
			$layersParam = $this->parseLayersArg( $layersArg );

			// Get the file
			$file = $this->findFile( $filename );
			if ( !$file ) {
				return $this->errorSpan( 'File not found: ' . htmlspecialchars( $filename ) );
			}

			// If layers are not requested, fall back to normal image display
			if ( $layersParam === 'off' ) {
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}

			// Check for layer data
			$db = $this->getDatabase();
			if ( !$db ) {
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}

			$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );
			if ( empty( $layerSets ) ) {
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}

			// Parse size and generate thumbnail
			$width = $this->parseSize( $size );
			$layeredSrc = $this->generateLayeredThumbnailUrl( $file, $width, $layersParam );

			if ( $layeredSrc ) {
				return $this->buildImageHtml( $filename, $layeredSrc, $width, $caption );
			}

			// Fall back to normal image display
			return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );

		} catch ( Exception $e ) {
			$this->logError( 'renderLayeredFile error', [ 'exception' => $e ] );
			return $this->errorSpan( 'Error rendering layered file' );
		}
	}

	/**
	 * Parse the layers argument from parser function
	 *
	 * @param string $layersArg Raw layers argument
	 * @return string Normalized layers parameter
	 */
	private function parseLayersArg( string $layersArg ): string {
		if ( empty( $layersArg ) ) {
			return 'off';
		}

		if ( strpos( $layersArg, 'layers=' ) === 0 ) {
			return substr( $layersArg, 7 );
		}

		if ( $layersArg === 'layers' || $layersArg === 'on' ) {
			return 'on';
		}

		return 'off';
	}

	/**
	 * Parse size parameter to width
	 *
	 * @param string $size Size parameter
	 * @return int Width in pixels
	 */
	private function parseSize( string $size ): int {
		if ( preg_match( '/(\d+)px/', $size, $match ) ) {
			return (int)$match[1];
		}
		if ( preg_match( '/x(\d+)px/', $size, $match ) ) {
			return (int)$match[1];
		}
		if ( $size === 'thumb' ) {
			return 220; // MediaWiki default thumb size
		}
		return 300; // Default width
	}

	/**
	 * Find a file by name
	 *
	 * @param string $filename Filename to find
	 * @return mixed File object or null
	 */
	private function findFile( string $filename ) {
		try {
			$services = MediaWikiServices::getInstance();
			$repoGroup = $services->getRepoGroup();
			return $repoGroup ? $repoGroup->findFile( $filename ) : null;
		} catch ( \Throwable $e ) {
			$this->logError( 'Error finding file', [ 'filename' => $filename, 'error' => $e->getMessage() ] );
			return null;
		}
	}

	/**
	 * Get database instance
	 *
	 * @return LayersDatabase|null
	 */
	private function getDatabase(): ?LayersDatabase {
		if ( $this->db !== null ) {
			return $this->db;
		}

		try {
			$services = MediaWikiServices::getInstance();
			return $services->get( 'LayersDatabase' );
		} catch ( \Throwable $e ) {
			return null;
		}
	}

	/**
	 * Generate URL for layered thumbnail
	 *
	 * @param mixed $file File object
	 * @param int $width Thumbnail width
	 * @param string $layersParam Layers parameter
	 * @return string|null Thumbnail URL or null
	 */
	private function generateLayeredThumbnailUrl( $file, int $width, string $layersParam ): ?string {
		try {
			$db = $this->getDatabase();
			if ( !$db ) {
				return null;
			}

			// Get layer data based on parameter
			$layerSet = null;
			if ( $layersParam === 'on' || $layersParam === 'all' ) {
				$layerSet = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
			} elseif ( strpos( $layersParam, 'id:' ) === 0 ) {
				$layerSetId = (int)substr( $layersParam, 3 );
				$layerSet = $db->getLayerSet( $layerSetId );
			} elseif ( strpos( $layersParam, 'name:' ) === 0 ) {
				$setName = substr( $layersParam, 5 );
				$layerSet = $db->getLayerSetByName( $file->getName(), $file->getSha1(), $setName );
			} else {
				// Try as named set
				$layerSet = $db->getLayerSetByName( $file->getName(), $file->getSha1(), $layersParam );
			}

			if ( !$layerSet || empty( $layerSet['data']['layers'] ) ) {
				return null;
			}

			// Generate thumbnail with layers
			$services = MediaWikiServices::getInstance();
			$config = $services->getMainConfig();
			$server = $config->get( 'Server' );
			$scriptPath = $config->get( 'ScriptPath' );

			// Build URL for layered thumbnail
			$layerSetId = $layerSet['id'];
			return "{$server}{$scriptPath}/api.php?" . http_build_query( [
				'action' => 'layersthumbnail',
				'filename' => $file->getName(),
				'width' => $width,
				'layersetid' => $layerSetId,
				'format' => 'json'
			] );

		} catch ( \Throwable $e ) {
			$this->logError( 'Error generating layered thumbnail URL', [ 'error' => $e->getMessage() ] );
			return null;
		}
	}

	/**
	 * Build HTML for layered image
	 *
	 * @param string $filename Filename
	 * @param string $src Image source URL
	 * @param int $width Image width
	 * @param string $caption Image caption
	 * @return string HTML
	 */
	private function buildImageHtml( string $filename, string $src, int $width, string $caption ): string {
		$alt = !empty( $caption ) ? htmlspecialchars( $caption ) : htmlspecialchars( $filename );
		$title = !empty( $caption ) ? htmlspecialchars( $caption ) : '';
		$href = '/wiki/File:' . rawurlencode( $filename );

		return '<span class="mw-default-size" typeof="mw:File">' .
			'<a href="' . htmlspecialchars( $href ) . '" class="mw-file-description"' .
			( $title ? ' title="' . $title . '"' : '' ) . '>' .
			'<img alt="' . $alt . '" src="' . htmlspecialchars( $src ) . '" ' .
			'decoding="async" width="' . $width . '" class="mw-file-element" />' .
			'</a></span>';
	}

	/**
	 * Create error span element
	 *
	 * @param string $message Error message
	 * @return string HTML span
	 */
	private function errorSpan( string $message ): string {
		return '<span class="error">' . htmlspecialchars( $message ) . '</span>';
	}

	/**
	 * Log an error if logger is available
	 *
	 * @param string $message Error message
	 * @param array $context Context data
	 */
	private function logError( string $message, array $context = [] ): void {
		if ( $this->logger ) {
			$this->logger->error( "Layers: $message", $context );
		}
	}
}
