<?php
/**
 * Test layer display functionality
 */
require_once __DIR__ . '/../../maintenance/Maintenance.php';

class TestLayerDisplay extends Maintenance {
	public function execute() {
		$this->output( "Testing layer display functionality...\n" );

		// Check if ImageMagick is available
		$config = \MediaWiki\MediaWikiServices::getInstance()->getMainConfig();
		$useImageMagick = $config->get( 'UseImageMagick' );
		$convertCommand = $config->get( 'ImageMagickConvertCommand' );

		$this->output( "ImageMagick enabled: " . ( $useImageMagick ? 'YES' : 'NO' ) . "\n" );
		$this->output( "Convert command: " . ( $convertCommand ?: 'NOT SET' ) . "\n" );

		if ( $useImageMagick && $convertCommand ) {
			// Test if convert command works
			$result = \MediaWiki\Shell\Shell::command( $convertCommand, '-version' )->execute();
			if ( $result->getExitCode() === 0 ) {
				$this->output( "ImageMagick version check: OK\n" );
				$this->output( "Version: " . trim( explode( "\n", $result->getStdout() )[0] ) . "\n" );
			} else {
				$this->output( "ImageMagick version check: FAILED\n" );
			}
		}

		// Test file and layer data
		$repoGroup = \MediaWiki\MediaWikiServices::getInstance()->getRepoGroup();
		$file = $repoGroup->findFile( 'ImageTest01.png' );

		if ( $file ) {
			$this->output( "\nFile: " . $file->getName() . "\n" );

			// Check for layer data
			$db = new \MediaWiki\Extension\Layers\Database\LayersDatabase();
			$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );

			$this->output( "Layer sets found: " . count( $layerSets ) . "\n" );

			if ( !empty( $layerSets ) ) {
				foreach ( $layerSets as $i => $layerSet ) {
					$this->output( "Layer set $i: ID={$layerSet['ls_id']}, Name={$layerSet['ls_name']}\n" );

					$data = json_decode( $layerSet['ls_json_blob'], true );
					if ( $data && isset( $data['layers'] ) ) {
						$this->output( "  Layers: " . count( $data['layers'] ) . "\n" );
						foreach ( $data['layers'] as $j => $layer ) {
							$this->output( "    Layer $j: {$layer['type']} - {$layer['id']}\n" );
						}
					}
				}

				// Test if WikitextHooks can find the right layer set
				$layersParam = 'Star'; // Test the parameter you used
				$selectedLayerSet = null;

				foreach ( $layerSets as $layerSet ) {
					if ( $layerSet['ls_name'] === $layersParam ) {
						$selectedLayerSet = $layerSet;
						break;
					}
				}

				if ( $selectedLayerSet ) {
					$this->output( "\nFound layer set with name 'Star': ID={$selectedLayerSet['ls_id']}\n" );
				} else {
					$this->output( "\nNo layer set found with name 'Star'\n" );
					$this->output( "Available names:\n" );
					foreach ( $layerSets as $layerSet ) {
						$this->output( "  - '{$layerSet['ls_name']}'\n" );
					}
				}

			} else {
				$this->output( "No layer sets found for this image\n" );
			}
		} else {
			$this->output( "Test file not found\n" );
		}
	}
}

$maintClass = TestLayerDisplay::class;
require_once RUN_MAINTENANCE_IF_MAIN;
