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
use MediaWiki\Parser\ParserOutputFlags;
use MediaWiki\SpecialPage\SpecialPage;

/** Page output carries only binding identities; each reader's browser fetches authorized drawings. */
class BoundSlideHooks {
	public const DATA_KEY = 'layers-bound-slides-v1';

	/**
	 * @param Parser $parser
	 * @param array $binding Validated canonical identity
	 * @return array Parser-function output
	 */
	public static function placeholder( Parser $parser, array $binding ): array {
		// Save-time and edit-stash renders lack the new revision ID; core must re-render after insertion.
		$parser->getOutput()->setOutputFlag( ParserOutputFlags::VARY_REVISION );
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
			'data-layers-revision' => $revision->getId() ], $parser->msg( 'layers-revision-unavailable' )->text() );
		return [ $html, 'noparse' => true, 'isHTML' => true ];
	}

	/**
	 * Load the viewer and, for editors of the current revision, per-request edit links.
	 * Drawing data never enters this response: the viewer requests it through layersread with the
	 * reader's own session, so the page HTML stays cacheable like any other page.
	 * @param OutputPage $out
	 * @param ParserOutput $parsed Shared cache object: never add private data to it
	 * @param PageOwnedPilot $pilot Scoped native read composition
	 */
	public static function output( OutputPage $out, ParserOutput $parsed, PageOwnedPilot $pilot ): void {
		$data = $parsed->getExtensionData( self::DATA_KEY );
		if ( !is_array( $data ) || !$data ) {
			return;
		}
		$displayed = false;
		foreach ( $data as $context ) {
			$displayed = $displayed ||
				( is_array( $context ) && ( $context['revisionId'] ?? null ) === $out->getRevisionId() );
		}
		if ( !$displayed ) {
			return;
		}
		$out->addModules( 'ext.layers.history' );
		$request = $out->getRequest();
		if ( $request->getVal( 'action', 'view' ) !== 'view' || $request->getCheck( 'oldid' ) ||
			$request->getCheck( 'diff' ) || !$out->getUser()->isRegistered() ) {
			return;
		}
		try {
			$entries = $pilot->listBoundEditorSelections( $out->getTitle()->getArticleID(),
				$out->getRevisionId(), $out->getAuthority() );
			$items = '';
			foreach ( $entries as $entry ) {
				$link = Html::element( 'a', [ 'class' => 'layers-page-edit-link',
					'href' => SpecialPage::getTitleFor( 'EditLayersPage' )->getLocalURL( $entry['params'] )
				], $out->msg( 'layers-page-edit-drawing', $entry['label'] )->text() );
				$items .= Html::rawElement( 'li', [], $link );
			}
			if ( $items !== '' ) {
				$out->addHTML( Html::rawElement( 'nav', [ 'class' => 'layers-page-edit-controls',
					'aria-label' => $out->msg( 'layers-edit-link-text' )->text()
				], Html::element( 'p', [], $out->msg( 'layers-page-edit-history-notice' )->text() ) .
					Html::rawElement( 'ul', [], $items ) ) );
			}
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Bound editor controls failed.',
				[ 'exception' => $e ] );
		}
	}
}
