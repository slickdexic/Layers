<?php

declare( strict_types=1 );
/**
 * LayerInjector - Processor for injecting layer data into image attributes
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Hooks\Processors;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Utility\ForeignFileHelper;
use MediaWiki\Extension\Layers\Utility\SetNameResolver;
use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;

/**
 * Handles injection of layer data into image parameters and attributes.
 * Extracts layer sets from the database and applies them to rendering params.
 */
class LayerInjector {

	/** @var LayersDatabase|null */
	private ?LayersDatabase $database = null;

	/** @var LayersHtmlInjector|null */
	private ?LayersHtmlInjector $htmlInjector = null;

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger;

	/**
	 * @param LoggerInterface|null $logger
	 */
	public function __construct( ?LoggerInterface $logger = null ) {
		$this->logger = $logger;
	}

	/**
	 * Get database service
	 *
	 * @return LayersDatabase|null
	 */
	private function getDatabase(): ?LayersDatabase {
		if ( $this->database === null ) {
			try {
				$this->database = MediaWikiServices::getInstance()->getService( 'LayersDatabase' );
			} catch ( \Throwable $e ) {
				if ( $this->logger ) {
					$this->logger->error( 'Layers: Unable to resolve LayersDatabase service', [ 'exception' => $e ] );
				}
				return null;
			}
		}
		return $this->database;
	}

	/**
	 * Get HTML injector
	 *
	 * @return LayersHtmlInjector
	 */
	private function getHtmlInjector(): LayersHtmlInjector {
		if ( $this->htmlInjector === null ) {
			$this->htmlInjector = new LayersHtmlInjector();
			if ( $this->logger ) {
				$this->htmlInjector->setLogger( $this->logger );
			}
		}
		return $this->htmlInjector;
	}

	/**
	 * Extract the 1-based page number from image frame params.
	 *
	 * Multi-page files (PDF) carry a 'page' param in the image handler params.
	 * Images and single-page files default to page 1.
	 *
	 * @param array $params Image frame params
	 * @return int Page number (>= 1)
	 */
	private function extractPageFromParams( array $params ): int {
		if ( isset( $params['page'] ) ) {
			$page = (int)$params['page'];
			if ( $page > 0 ) {
				return $page;
			}
		}
		return 1;
	}

	/**
	 * Add latest layer set to image parameters
	 *
	 * @param mixed $file File object
	 * @param array &$params Parameters array to modify
	 * @param string|null $setNameFromQueue Optional set name from queue
	 * @return void
	 */
	public function addLatestLayersToImage( $file, array &$params, ?string $setNameFromQueue = null ): void {
		$db = $this->getDatabase();
		if ( !$db ) {
			return;
		}

		$filename = $file->getName();

		// Determine which page (multi-page/PDF) this frame targets
		$page = $this->extractPageFromParams( $params );

		// Determine which layer set to fetch
		$sha1 = ForeignFileHelper::getFileSha1( $file );
		$layerSet = null;
		if ( SetNameResolver::isHideIntent( $setNameFromQueue ) ) {
			// Explicitly disabled - don't fetch any layer set
			return;
		}
		if ( SetNameResolver::isSpecificName( $setNameFromQueue ) ) {
			$layerSet = $db->getLayerSetByName( $filename, $sha1, $setNameFromQueue, $page );
		} else {
			$layerSet = $db->getLatestLayerSet( $filename, $sha1, null, $page );
		}

		if ( $layerSet ) {
			$params['layerSetId'] = $layerSet['id'];
			// Pass full layer data object with background settings
			$data = $layerSet['data'];
			$params['layerData'] = [
				'layers' => isset( $data['layers'] ) ? $data['layers'] : $data,
				'backgroundVisible' => $data['backgroundVisible'] ?? true,
				'backgroundOpacity' => $data['backgroundOpacity'] ?? 1.0
			];
		}
	}

	/**
	 * Add specific layer set to image parameters by ID or name prefix
	 *
	 * @param mixed $file File object
	 * @param string $layersParam The layers parameter value (e.g., "id:123" or "name:mySet")
	 * @param array &$params Parameters array to modify
	 * @return void
	 */
	public function addSpecificLayersToImage( $file, string $layersParam, array &$params ): void {
		$db = $this->getDatabase();
		if ( !$db ) {
			return;
		}

		$page = $this->extractPageFromParams( $params );

		if ( strpos( $layersParam, 'id:' ) === 0 ) {
			// Layer set by ID — verify it belongs to this file
			$layerSetId = (int)substr( $layersParam, 3 );
			$layerSet = $db->getLayerSet( $layerSetId );
			if ( $layerSet && $layerSet['imgName'] !== $file->getName() ) {
				$layerSet = null;
			}
		} elseif ( strpos( $layersParam, 'name:' ) === 0 ) {
			// Layer set by name
			$layerSetName = substr( $layersParam, 5 );
			$layerSet = $db->getLayerSetByName(
				$file->getName(),
				ForeignFileHelper::getFileSha1( $file ),
				$layerSetName,
				$page
			);
		} else {
			// Plain named set (e.g. '001', 'anatomy-labels').
			// This is the common case for [[File:...|layerset=001]] and similar.
			$layerSet = $db->getLayerSetByName(
				$file->getName(),
				ForeignFileHelper::getFileSha1( $file ),
				$layersParam,
				$page
			);
		}

		if ( $layerSet ) {
			$params['layerSetId'] = $layerSet['id'];
			// Pass full layer data object with background settings
			$data = $layerSet['data'];
			$params['layerData'] = [
				'layers' => isset( $data['layers'] ) ? $data['layers'] : $data,
				'backgroundVisible' => $data['backgroundVisible'] ?? true,
				'backgroundOpacity' => $data['backgroundOpacity'] ?? 1.0
			];
		}
	}

	/**
	 * Add subset of layers (by comma-separated short IDs) into params
	 *
	 * @param mixed $file File object
	 * @param string $shortIdsCsv Comma-separated short IDs (first 4 chars of layer IDs)
	 * @param array &$params Parameters array to modify
	 * @return void
	 */
	public function addSubsetLayersToImage( $file, string $shortIdsCsv, array &$params ): void {
		$db = $this->getDatabase();
		if ( !$db ) {
			return;
		}
		$sha1 = ForeignFileHelper::getFileSha1( $file );
		$latest = $db->getLatestLayerSet( $file->getName(), $sha1, null, $this->extractPageFromParams( $params ) );
		if ( !$latest || !isset( $latest['data']['layers'] ) ) {
			return;
		}
		$wanted = array_map( 'trim', explode( ',', strtolower( $shortIdsCsv ) ) );
		$subset = [];
		foreach ( (array)$latest['data']['layers'] as $layer ) {
			$id = strtolower( (string)( $layer['id'] ?? '' ) );
			$short = substr( $id, 0, 4 );
			if ( in_array( $short, $wanted, true ) ) {
				$subset[] = $layer;
			}
		}
		if ( $subset ) {
			$params['layerSetId'] = $latest['id'];
			// Pass full layer data object with background settings
			$data = $latest['data'];
			$params['layerData'] = [
				'layers' => $subset,
				'backgroundVisible' => $data['backgroundVisible'] ?? true,
				'backgroundOpacity' => $data['backgroundOpacity'] ?? 1.0
			];
		}
	}

	/**
	 * Inject layer data into image attributes
	 *
	 * @param array &$attribs Reference to image attributes array
	 * @param mixed $file The File object
	 * @param string|null $setName Optional named set; when absent or a generic
	 *        wikitext intent, the image's most recent set is used
	 * @param string $context Description of calling context for logging
	 * @param int $page 1-based page for multi-page files (PDF); layer sets are
	 *        stored per page, so omitting this silently rendered page 1's layers
	 * @return bool True if layers were injected, false otherwise
	 */
	public function injectIntoAttributes(
		array &$attribs,
		$file,
		?string $setName = null,
		string $context = 'unknown',
		int $page = 1
	): bool {
		if ( !$file ) {
			return false;
		}

		$db = $this->getDatabase();
		if ( !$db ) {
			return false;
		}

		// Get layer data from database
		// Use getLatestLayerSet with optional setName filter (sha1 required for DB lookup)
		$sha1 = ForeignFileHelper::getFileSha1( $file );
		$page = ForeignFileHelper::clampPage( $file, $page );
		if ( SetNameResolver::isSpecificName( $setName ) ) {
			$layerSet = $db->getLatestLayerSet( $file->getName(), $sha1, $setName, $page );
		} else {
			$layerSet = $db->getLatestLayerSet( $file->getName(), $sha1, null, $page );
		}

		if ( !$layerSet || !isset( $layerSet['data'] ) ) {
			return false;
		}

		$data = $layerSet['data'];
		$layers = (
			isset( $data['layers'] )
			&& is_array( $data['layers'] )
		)
			? $data['layers']
			: [];

		if ( empty( $layers ) ) {
			return false;
		}

		// Extract background settings
		$backgroundVisible = $data['backgroundVisible'] ?? true;
		$backgroundOpacity = $data['backgroundOpacity'] ?? 1.0;

		// Log background settings from database for troubleshooting
		if ( $this->logger ) {
			$bgVisStr = $backgroundVisible ? 'true' : 'false';
			$rawBg = var_export( $data['backgroundVisible'] ?? null, true );
			$msg = 'injectIntoAttributes: backgroundVisible from DB = {bgVisible}, ' .
				'backgroundOpacity = {bgOpacity}';
			$this->logger->debug( $msg, [
				'bgVisible' => $bgVisStr,
				'bgOpacity' => $backgroundOpacity,
				'rawBgVisible' => $rawBg
			] );
		}

		// Use the HTML injector to add attributes with background settings
		$injector = $this->getHtmlInjector();
		$dimensions = $injector->getFileDimensions( $file );

		$injector->injectIntoAttributes(
			$attribs,
			$layers,
			$dimensions['width'],
			$dimensions['height'],
			$backgroundVisible,
			$backgroundOpacity
		);

		return true;
	}

	/**
	 * Set the database service (for testing)
	 *
	 * @param LayersDatabase|null $database
	 * @return void
	 */
	public function setDatabase( ?LayersDatabase $database ): void {
		$this->database = $database;
	}

	/**
	 * Set the HTML injector (for testing)
	 *
	 * @param LayersHtmlInjector|null $injector
	 * @return void
	 */
	public function setHtmlInjector( ?LayersHtmlInjector $injector ): void {
		$this->htmlInjector = $injector;
	}
}
