<?php

declare( strict_types=1 );
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
use Title;

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

			$layerSets = $db->getLayerSetsForImage( $file->getName(), $this->getFileSha1( $file ) );
			if ( empty( $layerSets ) ) {
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}

			// Parse size and determine the layer set name
			$width = $this->parseSize( $size );
			$setName = $this->resolveSetName( $file, $layersParam );

			// Generate a standard thumbnail and annotate it for the client-side viewer
			$thumb = $file->transform( [ 'width' => $width ] );
			if ( $thumb ) {
				return $this->buildLayeredImageHtml(
					$filename, $thumb->getUrl(), $width, $caption, $setName
				);
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
			// MediaWiki default thumb size
			return 220;
		}
		// Default width
		return 300;
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
	 * Resolve which named set to display from the layers parameter
	 *
	 * @param mixed $file File object
	 * @param string $layersParam Layers parameter ('on', set name, 'id:N', 'name:NAME')
	 * @return string Named set identifier for the client-side viewer
	 */
	private function resolveSetName( $file, string $layersParam ): string {
		if ( $layersParam === 'on' || $layersParam === 'all' || $layersParam === '' ) {
			return 'default';
		}

		// id:<N> syntax — look up the set name from the database
		if ( strpos( $layersParam, 'id:' ) === 0 ) {
			$db = $this->getDatabase();
			if ( $db ) {
				$id = (int)substr( $layersParam, 3 );
				$layerSet = $db->getLayerSet( $id );
				if ( $layerSet && isset( $layerSet['name'] ) ) {
					return $layerSet['name'];
				}
			}
			return 'default';
		}

		// name:<NAME> syntax
		if ( strpos( $layersParam, 'name:' ) === 0 ) {
			return substr( $layersParam, 5 );
		}

		// Treat as named set directly
		return $layersParam;
	}

	/**
	 * Build HTML for a layered image with client-side viewer attributes
	 *
	 * The rendered img tag includes data attributes that the ext.layers viewer
	 * module picks up to overlay layer annotations via canvas rendering.
	 *
	 * @param string $filename Filename
	 * @param string $src Image source URL (base thumbnail)
	 * @param int $width Image width
	 * @param string $caption Image caption
	 * @param string $setName Named layer set to display
	 * @return string HTML
	 */
	private function buildLayeredImageHtml(
		string $filename, string $src, int $width, string $caption, string $setName
	): string {
		$alt = !empty( $caption ) ? htmlspecialchars( $caption ) : htmlspecialchars( $filename );
		$title = !empty( $caption ) ? htmlspecialchars( $caption ) : '';
		$href = Title::makeTitle( NS_FILE, $filename )->getLocalURL();
		$intentValue = htmlspecialchars( $setName );

		return '<span class="mw-default-size" typeof="mw:File">' .
			'<a href="' . htmlspecialchars( $href ) . '" class="mw-file-description"' .
			( $title ? ' title="' . $title . '"' : '' ) . '>' .
			'<img alt="' . $alt . '" src="' . htmlspecialchars( $src ) . '" ' .
			'decoding="async" width="' . $width . '" class="mw-file-element" ' .
			'data-layers-intent="' . $intentValue . '" ' .
			'data-layer-setname="' . $intentValue . '" />' .
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

	/**
	 * Get a stable SHA1 identifier for a file.
	 *
	 * For foreign files (from InstantCommons, etc.) that don't have a SHA1,
	 * we generate a stable fallback identifier based on the filename.
	 *
	 * @param mixed $file File object
	 * @return string SHA1 hash or fallback identifier
	 */
	private function getFileSha1( $file ): string {
		$sha1 = $file->getSha1();
		if ( !empty( $sha1 ) ) {
			return $sha1;
		}

		// Check if this is a foreign file
		if ( $this->isForeignFile( $file ) ) {
			// Use a hash of the filename as a fallback (prefixed for clarity)
			return 'foreign_' . sha1( $file->getName() );
		}

		return $sha1 ?? '';
	}

	/**
	 * Check if a file is from a foreign repository (like InstantCommons)
	 *
	 * @param mixed $file File object
	 * @return bool True if the file is from a foreign repository
	 */
	private function isForeignFile( $file ): bool {
		// Check if file is a ForeignAPIFile or ForeignDBFile
		$className = get_class( $file );
		if ( strpos( $className, 'Foreign' ) !== false ) {
			return true;
		}

		// Check if the file's repository is not local
		if ( method_exists( $file, 'getRepo' ) ) {
			$repo = $file->getRepo();
			if ( $repo && method_exists( $repo, 'isLocal' ) && !$repo->isLocal() ) {
				return true;
			}
		}

		return false;
	}
}
