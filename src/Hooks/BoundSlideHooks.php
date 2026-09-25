<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Html\Html;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOutput;

/** Cache only binding identities; authorize drawing data for each actual page response. */
class BoundSlideHooks {
	public const DATA_KEY = 'layers-bound-slides-v1';

	/**
	 * @param Parser $parser
	 * @param array $binding Validated canonical identity
	 * @return array Parser-function output
	 */
	public static function placeholder( Parser $parser, array $binding ): array {
		$config = MediaWikiServices::getInstance()->getMainConfig();
		if ( !$config->get( 'LayersPageOwnedPilotEnabled' ) ||
			!in_array( $parser->getTitle()->getPrefixedDBkey(), $config->get( 'LayersPageOwnedPilotOwners' ), true ) ||
			$parser->getRevisionId() === null ) {
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		// Native parsing may supply revisionId=0 with an exact revision callback. Never query latest here.
		$revision = $parser->getRevisionRecordObject();
		if ( !$revision || $revision->getId() <= 0 || $revision->getPageId() !== $binding['pageId'] ) {
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		$value = 'v1:' . $binding['pageId'] . ':' . $binding['surfaceId'];
		$output = $parser->getOutput();
		$data = $output->getExtensionData( self::DATA_KEY ) ?? [];
		$data[$value] = [ 'revisionId' => $revision->getId(), 'pageId' => $binding['pageId'] ];
		$output->setExtensionData( self::DATA_KEY, $data );
		$html = Html::element( 'div', [ 'class' => 'layers-bound-slide', 'data-layers-binding' => $value,
			'data-layers-revision' => $revision->getId() ], wfMessage( 'layers-revision-unavailable' )->text() );
		return [ $html, 'noparse' => true, 'isHTML' => true ];
	}

	/**
	 * @param OutputPage $out
	 * @param ParserOutput $parsed Shared cache object: never add private data to it
	 * @param PageOwnedPilot $pilot Scoped native read composition
	 */
	public static function output( OutputPage $out, ParserOutput $parsed, PageOwnedPilot $pilot ): void {
		$data = $parsed->getExtensionData( self::DATA_KEY );
		if ( !is_array( $data ) || !$data ) {
			return;
		}
		$out->disableClientCache();
		$out->setCdnMaxage( 0 );
		$bundles = [];
		foreach ( $data as $binding => $context ) {
			try {
				if ( !is_array( $context ) || ( $context['revisionId'] ?? null ) !== $out->getRevisionId() ) {
					continue;
				}
				$bundles[$binding] = $pilot->prepareBoundViewer( $out->getTitle(), $context['revisionId'],
					$binding, $out->getAuthority() );
			} catch ( \DomainException $e ) {
				// Leave the fixed unavailable placeholder; never fall back to a shared drawing.
			} catch ( \Throwable $e ) {
				LoggerFactory::getInstance( 'Layers' )->error( 'Bound slide read failed.', [ 'exception' => $e ] );
			}
		}
		$out->addJsConfigVars( 'wgLayersBoundSlides', $bundles );
		if ( $bundles ) {
			$out->addModules( 'ext.layers.history' );
		}
	}
}
