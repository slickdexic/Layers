<?php
/**
 * LayerInjector - Processor for injecting layer data into image attributes
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Hooks\Processors;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
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
			$this->htmlInjector = new LayersHtmlInjector( $this->logger );
		}
		return $this->htmlInjector;
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

		// Determine which layer set to fetch
		$layerSet = null;
		if ( $setNameFromQueue === null
			|| $setNameFromQueue === 'on'
			|| $setNameFromQueue === 'all'
			|| $setNameFromQueue === 'true' ) {
			// Default behavior - get the default/latest set
			$layerSet = $db->getLatestLayerSet( $filename, $file->getSha1() );
		} elseif ( $setNameFromQueue === 'off' || $setNameFromQueue === 'none' || $setNameFromQueue === 'false' ) {
			// Explicitly disabled - don't fetch any layer set
			return;
		} else {
			// Named set
			$layerSet = $db->getLayerSetByName( $filename, $file->getSha1(), $setNameFromQueue );
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

		if ( strpos( $layersParam, 'id:' ) === 0 ) {
			// Layer set by ID
			$layerSetId = (int)substr( $layersParam, 3 );
			$layerSet = $db->getLayerSet( $layerSetId );
		} elseif ( strpos( $layersParam, 'name:' ) === 0 ) {
			// Layer set by name
			$layerSetName = substr( $layersParam, 5 );
			$layerSet = $db->getLayerSetByName( $file->getName(), $file->getSha1(), $layerSetName );
		} else {
			// Legacy format or other formats
			$layerSet = null;
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
		$latest = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
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
	 * @param string|null $setName Optional named set (defaults to 'default')
	 * @param string $context Description of calling context for logging
	 * @return bool True if layers were injected, false otherwise
	 */
	public function injectIntoAttributes(
		array &$attribs,
		$file,
		?string $setName = null,
		string $context = 'unknown'
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
		$sha1 = $file->getSha1();
		if ( $setName !== null && $setName !== 'default' && $setName !== 'on' && $setName !== 'all' ) {
			$layerSet = $db->getLatestLayerSet( $file->getName(), $sha1, $setName );
		} else {
			$layerSet = $db->getLatestLayerSet( $file->getName(), $sha1 );
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

		// DEBUG: Log what we got from the database
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
