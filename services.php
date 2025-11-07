<?php

/**
 * Service wiring for the Layers extension
 *
 * @file
 * @ingroup Extensions
 */

return [
	'LayersLogger' => static function ( \MediaWiki\MediaWikiServices $services ): \MediaWiki\Extension\Layers\Logging\LayersLogger {
		return new \MediaWiki\Extension\Layers\Logging\LayersLogger();
	},
	'LayersSchemaManager' => static function ( \MediaWiki\MediaWikiServices $services ): \MediaWiki\Extension\Layers\Database\LayersSchemaManager {
		return new \MediaWiki\Extension\Layers\Database\LayersSchemaManager();
	},
	'LayersDatabase' => static function ( \MediaWiki\MediaWikiServices $services ): \MediaWiki\Extension\Layers\Database\LayersDatabase {
		return new \MediaWiki\Extension\Layers\Database\LayersDatabase(
			$services->getDBLoadBalancer(),
			$services->getMainConfig(),
			$services->get( 'LayersLogger' ),
			$services->get( 'LayersSchemaManager' )
		);
	},
];
