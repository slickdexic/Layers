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
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfViewerReadService;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PinnedPdfSource;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Extension\Layers\Search\DrawingSearchText;
use MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission;
use MediaWiki\Extension\Layers\Search\VisibleLegacySearchProjection;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\MediaWikiServices;

return [
	'LayersMissingPdfViewerRead' => static function ( MediaWikiServices $services ): PageMissingPdfViewerReadService {
		return new PageMissingPdfViewerReadService( $services,
			$services->getService( 'LayersPageOwnedPilot' )->getScope() );
	},
	'LayersPinnedPdfSource' => static function ( MediaWikiServices $services ): PinnedPdfSource {
		return new PinnedPdfSource( new PageHistoryAccess( $services->getRevisionLookup() ),
			new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(), $services->getTitleFactory() ),
			$services->getService( 'LayersPageOwnedPilot' )->getScope() );
	},
	'LayersRateLimiter' => static function ( MediaWikiServices $services ): RateLimiter {
		return new RateLimiter( $services->getMainConfig() );
	},
	// Drawings are kept in page history on every page of the configured namespaces (D2).
	'LayersPageOwnedPilot' => static function ( MediaWikiServices $services ): PageOwnedPilot {
		return new PageOwnedPilot( $services, [], PageOwnedScope::configuredNamespaces( $services->getMainConfig() ) );
	},
	'LayersDrawingSearchText' => static function ( MediaWikiServices $services ): DrawingSearchText {
		$database = $services->getService( 'LayersDatabase' );
		$legacy = new VisibleLegacySearchProjection( $database,
			new LegacySearchSourceAdmission( $services->getRepoGroup()->getLocalRepo() ),
			$services->getTitleFactory() );
		return new DrawingSearchText( $services->getService( 'LayersPageOwnedPilot' ),
			$database, $services->getRevisionLookup(), $services->getPageStore(),
			$services->getConnectionProvider(), $legacy, $services->getUserFactory()->newAnonymous(),
			$services->getJobQueueGroup(), $services->getService( 'LayersLogger' ) );
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
