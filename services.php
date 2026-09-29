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
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Search\DrawingSearchText;
use MediaWiki\MediaWikiServices;

return [
	// Drawings are kept in page history on every page of the configured namespaces (D2).
	'LayersPageOwnedPilot' => static function ( MediaWikiServices $services ): PageOwnedPilot {
		return new PageOwnedPilot( $services, [], PageOwnedScope::configuredNamespaces( $services->getMainConfig() ) );
	},
	'LayersDrawingSearchText' => static function ( MediaWikiServices $services ): DrawingSearchText {
		return new DrawingSearchText( $services->getService( 'LayersPageOwnedPilot' ),
			$services->getService( 'LayersDatabase' ), $services->getRevisionLookup(), $services->getPageStore(),
			$services->getConnectionProvider() );
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
