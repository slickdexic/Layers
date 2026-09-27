<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Api\ApiLayersMergeHistory;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Hook\MediaWikiServicesHook;
use MediaWiki\MediaWikiServices;

/** Native bootstrap for the default-off page-owned revision pilot. */
class PageOwnedPilotRegistration implements MediaWikiServicesHook {
	/**
	 * Extension registration callback. Runs before service initialization.
	 *
	 * @param array $credits Extension metadata
	 */
	public static function onRegistration( array $credits ): void {
		global $wgAPIModules, $wgLayersPageOwnedPilotOwners, $wgLayersPageOwnedPilotNamespaces;
		$owners = $wgLayersPageOwnedPilotOwners ?? [];
		$namespaces = $wgLayersPageOwnedPilotNamespaces ?? [];
		if ( !is_array( $owners ) || !is_array( $namespaces ) ) {
			throw new \InvalidArgumentException( 'Invalid Layers pilot owner scope' );
		}
		$modules = self::apiModules();
		// Ordinary installations retain core's merge module unchanged.
		if ( !$owners && !$namespaces ) {
			unset( $modules['mergehistory'] );
		}
		foreach ( $modules as $name => $definition ) {
			if ( isset( $wgAPIModules[$name] ) ) {
				throw new \LogicException( 'Conflicting Layers pilot API registration' );
			}
		}
		$wgAPIModules = array_replace( $wgAPIModules ?? [], $modules );
	}

	/** @inheritDoc */
	public function onMediaWikiServices( $services ) {
		$config = $services->getMainConfig();
		$owners = $config->has( 'LayersPageOwnedPilotOwners' ) ? $config->get( 'LayersPageOwnedPilotOwners' ) : [];
		$namespaces = $config->has( 'LayersPageOwnedPilotNamespaces' ) ?
			$config->get( 'LayersPageOwnedPilotNamespaces' ) : [];
		if ( !is_array( $owners ) || !is_array( $namespaces ) ) {
			throw new \InvalidArgumentException( 'Invalid Layers pilot owner scope' );
		}
		if ( !$owners && !$namespaces ) {
			return;
		}
		// Install protection for retained owners even when the API switch is disabled.
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
			'mergehistory' => [ 'class' => ApiLayersMergeHistory::class, 'factory' => static function ( $main, $name ) {
				return new ApiLayersMergeHistory( $main, $name,
					MediaWikiServices::getInstance()->getMergeHistoryFactory() );
			} ]
		];
	}
}
