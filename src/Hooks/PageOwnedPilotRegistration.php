<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Api\ApiLayersDrawings;
use MediaWiki\Extension\Layers\Api\ApiLayersMergeHistory;
use MediaWiki\Extension\Layers\Api\ApiLayersPdfCreationRead;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationDraftRebase;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRead;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRebase;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportCatalog;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportRead;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Hook\MediaWikiServicesHook;
use MediaWiki\MediaWikiServices;

/** Native bootstrap for drawings kept in page history; always installed (D2). */
class PageOwnedPilotRegistration implements MediaWikiServicesHook {
	/**
	 * Extension registration callback. Runs before service initialization.
	 *
	 * @param array $credits Extension metadata
	 */
	public static function onRegistration( array $credits ): void {
		global $wgAPIModules;
		$modules = self::apiModules();
		foreach ( $modules as $name => $definition ) {
			if ( isset( $wgAPIModules[$name] ) ) {
				throw new \LogicException( 'Conflicting Layers pilot API registration' );
			}
		}
		$wgAPIModules = array_replace( $wgAPIModules ?? [], $modules );
	}

	/** @inheritDoc */
	public function onMediaWikiServices( $services ) {
		// The content model itself is registered in extension.json so stored revisions always load.
		// Callbacks are lazy: do not instantiate dependent services during container setup.
		$services->addServiceManipulator( 'SlotRoleRegistry', static function ( $registry ) {
			$registry->defineRoleWithModel( PageRevisionWriter::SLOT, LayersDocumentContent::MODEL,
				[ 'display' => 'none' ], false );
		} );
		foreach ( [ 'OldRevisionImporter', 'WikiRevisionOldRevisionImporterNoUpdates' ] as $name ) {
			$services->addServiceManipulator( $name, static function ( $native, $container ) {
				return $container->getService( 'LayersPageOwnedPilot' )->wrapImporter( $native );
			} );
		}
		$services->addServiceManipulator( 'MergeHistoryFactory', static function ( $native, $container ) {
			return $container->getService( 'LayersPageOwnedPilot' )->wrapMergeFactory( $native );
		} );
		$hooks = $services->getHookContainer();
		$hooks->register( 'OutputPageParserOutput', static function ( $out, $parsed ) use ( $services ) {
			BoundSlideHooks::output( $out, $parsed, $services->getService( 'LayersPageOwnedPilot' ) );
		} );
		$hooks->register( 'PageHistoryLineEnding',
			static function ( $pager, &$row, &$html, &$classes, &$attributes ) use ( $services ) {
				( new PageOwnedHistoryHooks( $services->getService( 'LayersPageOwnedPilot' ),
					$services->getLinkRenderer() ) )->onPageHistoryLineEnding(
						$pager, $row, $html, $classes, $attributes );
			} );
		$hooks->register( 'HistoryTools',
			static function ( $revRecord, &$links, $prevRevRecord, $user ) use ( $services ) {
				return ( new PageOwnedHistoryHooks( $services->getService( 'LayersPageOwnedPilot' ),
					$services->getLinkRenderer() ) )->onHistoryTools( $revRecord, $links, $prevRevRecord, $user );
			} );
		$hooks->register( 'DifferenceEngineShowDiff', static function ( $differenceEngine ) use ( $services ) {
			( new PageOwnedDiffHooks( $services->getService( 'LayersPageOwnedPilot' ) ) )
				->onDifferenceEngineShowDiff( $differenceEngine );
		} );
		$hooks->register( 'MultiContentSave', static function ( ...$args ) use ( $services ) {
			return $services->getService( 'LayersPageOwnedPilot' )->newAdmissionHooks()->onMultiContentSave( ...$args );
		} );
		$hooks->register( 'PageUndelete', static function ( ...$args ) use ( $services ) {
			return $services->getService( 'LayersPageOwnedPilot' )->newLifecycleHooks()->onPageUndelete( ...$args );
		} );
	}

	/**
	 * Module definitions to install alongside the service hook, before container initialization.
	 * Core merge behavior is retained through the adapter; pilot read/write remain default-off.
	 *
	 * @return array
	 */
	public static function apiModules(): array {
		return [
			'layerspublish' => [ 'class' => ApiLayersPublish::class, 'factory' => static function ( $main, $name ) {
				return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
					->newPublishApi( $main, $name );
			} ],
			'layersread' => [ 'class' => ApiLayersRead::class, 'factory' => static function ( $main, $name ) {
				return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
					->newReadApi( $main, $name );
			} ],
			'layerspdfcreationread' => [ 'class' => ApiLayersPdfCreationRead::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newPdfCreationReadApi( $main, $name );
				} ],
			'layersworkingcopyimportread' => [ 'class' => ApiLayersWorkingCopyImportRead::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newWorkingCopyImportReadApi( $main, $name );
				} ],
			'layersworkingcopypdfimportcatalog' => [ 'class' => ApiLayersWorkingCopyPdfImportCatalog::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newWorkingCopyPdfImportCatalogApi( $main, $name );
				} ],
			'layersworkingcopypdfimportread' => [ 'class' => ApiLayersWorkingCopyPdfImportRead::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newWorkingCopyPdfImportReadApi( $main, $name );
				} ],
			'layersworkingcopypdfimportpublish' => [ 'class' => ApiLayersWorkingCopyPdfImportPublish::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newWorkingCopyPdfImportPublishApi( $main, $name );
				} ],
			'layersworkingcopyimportcreationread' => [ 'class' => ApiLayersWorkingCopyImportCreationRead::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newWorkingCopyImportCreationReadApi( $main, $name );
				} ],
			'layersworkingcopyimportcreationpublish' => [ 'class' => ApiLayersWorkingCopyImportCreationPublish::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newWorkingCopyImportCreationPublishApi( $main, $name );
				} ],
			'layersworkingcopyimportcreationrebase' => [ 'class' => ApiLayersWorkingCopyImportCreationRebase::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newWorkingCopyImportCreationRebaseApi( $main, $name );
				} ],
			'layersworkingcopyimportcreationdraftrebase' => [
				'class' => ApiLayersWorkingCopyImportCreationDraftRebase::class,
				'factory' => static function ( $main, $name ) {
					return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
						->newWorkingCopyImportCreationDraftRebaseApi( $main, $name );
				} ],
			'layersdrawings' => [ 'class' => ApiLayersDrawings::class, 'factory' => static function ( $main, $name ) {
				return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
					->newDrawingsApi( $main, $name );
			} ],
			'mergehistory' => [ 'class' => ApiLayersMergeHistory::class, 'factory' => static function ( $main, $name ) {
				return new ApiLayersMergeHistory( $main, $name,
					MediaWikiServices::getInstance()->getMergeHistoryFactory() );
			} ]
		];
	}
}
