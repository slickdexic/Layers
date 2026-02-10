<?php

declare( strict_types=1 );

/**
 * Service wiring for the Layers extension
 *
 * @file
 * @ingroup Extensions
 */

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Database\LayersSchemaManager;
use MediaWiki\Extension\Layers\Logging\LayersLogger;
use MediaWiki\MediaWikiServices;

return [
	'LayersLogger' => static function ( MediaWikiServices $services ): LayersLogger {
		return new LayersLogger();
	},
	'LayersSchemaManager' => static function ( MediaWikiServices $services ): LayersSchemaManager {
		return new LayersSchemaManager(
			$services->get( 'LayersLogger' ),
			$services->getConnectionProvider()
		);
	},
	'LayersDatabase' => static function ( MediaWikiServices $services ): LayersDatabase {
		return new LayersDatabase(
			$services->getDBLoadBalancer(),
			$services->getMainConfig(),
			$services->get( 'LayersLogger' ),
			$services->get( 'LayersSchemaManager' )
		);
	},
];
