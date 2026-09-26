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
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\MediaWikiServices;

return [
	// Shared composition; native registration keeps the pilot disabled by default.
	'LayersPageOwnedPilot' => static function ( MediaWikiServices $services ): PageOwnedPilot {
		$config = $services->getMainConfig();
		return new PageOwnedPilot( $services,
			$config->has( 'LayersPageOwnedPilotEnabled' ) ? $config->get( 'LayersPageOwnedPilotEnabled' ) : false,
			$config->has( 'LayersPageOwnedPilotOwners' ) ? $config->get( 'LayersPageOwnedPilotOwners' ) : [],
			$config->has( 'LayersPageOwnedPilotNamespaces' ) ? $config->get( 'LayersPageOwnedPilotNamespaces' ) : [] );
	},
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
			$services->getConnectionProvider(),
			$services->getMainConfig(),
			$services->get( 'LayersLogger' ),
			$services->get( 'LayersSchemaManager' )
		);
	},
];
