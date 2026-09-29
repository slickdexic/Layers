<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageOwnedBinding;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Html\Html;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Parser\ParserOutputFlags;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\SpecialPage\SpecialPage;

/** Page output carries only binding identities; each reader's browser fetches authorized drawings. */
class BoundSlideHooks {
	public const DATA_KEY = 'layers-bound-slides-v1';
	public const ADOPTABLE_KEY = 'layers-shared-slides-v1';
	public const CREATABLE_KEY = 'layers-missing-drawings-v1';
	public const COPYABLE_KEY = 'layers-foreign-drawings-v1';

	/**
	 * @param Parser $parser
	 * @param array $binding Validated canonical identity
	 * @return array Parser-function output
	 */
	public static function placeholder( Parser $parser, array $binding ): array {
		[ $value, $revisionId ] = self::register( $parser, $binding );
		$html = Html::element( 'div', [ 'class' => 'layers-bound-slide', 'data-layers-binding' => $value,
			'data-layers-revision' => $revisionId ], $parser->msg( 'layers-revision-unavailable' )->text() );
		return [ $html, 'noparse' => true, 'isHTML' => true ];
	}

	/**
	 * Admit a binding for the page being parsed and record it in cacheable parser output.
	 * Shared by slide placeholders and bound file embeds.
	 * @param Parser $parser
	 * @param array $binding Validated canonical identity
	 * @return array [ canonical binding value, exact revision ID ]
	 * @throws \DomainException layers-page-binding-unavailable
	 */
	public static function register( Parser $parser, array $binding ): array {
		// Save-time and edit-stash renders lack the new revision ID; core must re-render after insertion.
		$parser->getOutput()->setOutputFlag( ParserOutputFlags::VARY_REVISION );
		$config = MediaWikiServices::getInstance()->getMainConfig();
		if ( !$config->get( 'LayersPageOwnedPilotEnabled' ) || $parser->getRevisionId() === null ) {
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		// Native parsing may supply revisionId=0 with an exact revision callback. Never query latest here.
		$revision = $parser->getRevisionRecordObject();
		if ( !$revision || $revision->getId() <= 0 || $revision->getPageId() !== $binding['pageId'] ||
			!self::scope()->includesRevision( $parser->getTitle(), $revision )
		) {
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		$value = 'v1:' . $binding['pageId'] . ':' . $binding['surfaceId'];
		$output = $parser->getOutput();
		$data = $output->getExtensionData( self::DATA_KEY ) ?? [];
		$data[$value] = [ 'revisionId' => $revision->getId(), 'pageId' => $binding['pageId'] ];
		$output->setExtensionData( self::DATA_KEY, $data );
		return [ $value, $revision->getId() ];
	}

	/**
	 * Find the one drawing of the page being parsed that an embed names.
	 * @param Parser $parser
	 * @param array $named From PageOwnedBinding::parseNamed()
	 * @param string|null $kind 'file' or 'slide'; null for any drawing
	 * @param string|null $fileTitle For a file embed, 'File:<DB key>'
	 * @return array Canonical identity for register()
	 * @throws \DomainException layers-page-binding-unavailable
	 */
	public static function named( Parser $parser, array $named, ?string $kind, ?string $fileTitle ): array {
		// As in register(): renders without the revision must not be cached as the answer.
		$parser->getOutput()->setOutputFlag( ParserOutputFlags::VARY_REVISION );
		$revision = $parser->getRevisionRecordObject();
		if ( !$revision || $revision->getId() <= 0 ) {
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		if ( $revision->getPageId() !== $named['pageId'] ) {
			// Another page's drawing never shows here; output() offers editors to copy it.
			$parser->getOutput()->setExtensionData( self::COPYABLE_KEY, true );
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		$surfaces = [];
		if ( $revision->hasSlot( PageRevisionWriter::SLOT ) ) {
			$content = $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW );
			if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ) {
				throw new \DomainException( 'layers-page-binding-unavailable' );
			}
			$surfaces = json_decode( $content->getText(), true )['surfaces'] ?? [];
		}
		$surfaceId = PageOwnedBinding::resolveNamed( $named, $surfaces, $kind, $fileTitle );
		if ( $surfaceId === null ) {
			// The page names a drawing it does not have yet; output() offers editors to create it.
			$parser->getOutput()->setExtensionData( self::CREATABLE_KEY, true );
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		return [ 'pageId' => $named['pageId'], 'surfaceId' => $surfaceId ];
	}

	/**
	 * Record, in cacheable parser output, that a shared (legacy) slide or file drawing was rendered on a
	 * pilot page. Which drawings are adoptable, and by whom, is decided per request in output().
	 * @param Parser $parser
	 */
	public static function noteSharedSlide( Parser $parser ): void {
		if ( !MediaWikiServices::getInstance()->getMainConfig()->get( 'LayersPageOwnedPilotEnabled' ) ) {
			return;
		}
		$scope = self::scope();
		$revision = $parser->getRevisionRecordObject();
		if ( $revision ? $scope->includesRevision( $parser->getTitle(), $revision ) :
			$scope->isEnrolled( $parser->getTitle() )
		) {
			$parser->getOutput()->setExtensionData( self::ADOPTABLE_KEY, true );
		}
	}

	/** @return PageOwnedScope */
	private static function scope(): PageOwnedScope {
		return MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )->getScope();
	}

	/**
	 * Load the viewer and, for editors of the current revision, per-request edit and adoption links.
	 * Drawing data never enters this response: the viewer requests it through layersread with the
	 * reader's own session, so the page HTML stays cacheable like any other page.
	 * @param OutputPage $out
	 * @param ParserOutput $parsed Shared cache object: never add private data to it
	 * @param PageOwnedPilot $pilot Scoped native read composition
	 */
	public static function output( OutputPage $out, ParserOutput $parsed, PageOwnedPilot $pilot ): void {
		$data = $parsed->getExtensionData( self::DATA_KEY );
		$displayed = false;
		foreach ( is_array( $data ) ? $data : [] as $context ) {
			$displayed = $displayed ||
				( is_array( $context ) && ( $context['revisionId'] ?? null ) === $out->getRevisionId() );
		}
		$adoptable = $parsed->getExtensionData( self::ADOPTABLE_KEY ) === true;
		$creatable = $parsed->getExtensionData( self::CREATABLE_KEY ) === true;
		$copyable = $parsed->getExtensionData( self::COPYABLE_KEY ) === true;
		if ( $displayed ) {
			$out->addModules( 'ext.layers.history' );
		}
		$request = $out->getRequest();
		if ( ( !$displayed && !$adoptable && !$creatable && !$copyable ) ||
			$request->getVal( 'action', 'view' ) !== 'view' ||
			$request->getCheck( 'oldid' ) || $request->getCheck( 'diff' ) || !$out->getUser()->isRegistered()
		) {
			return;
		}
		try {
			$pageId = $out->getTitle()->getArticleID();
			$items = '';
			foreach ( $displayed || $creatable ? $pilot->listBoundEditorSelections( $pageId, $out->getRevisionId(),
				$out->getAuthority() ) : [] as $entry
			) {
				$items .= self::controlItem( 'layers-page-edit-link', 'EditLayersPage', $entry['params'],
					$out->msg( empty( $entry['create'] ) ? 'layers-page-edit-drawing' : 'layers-page-create-drawing',
						$entry['label'] )->text() );
			}
			$adoptItems = '';
			foreach ( $adoptable ? $pilot->listAdoptionCandidates( $pageId, $out->getRevisionId(),
				$out->getAuthority() ) : [] as $entry
			) {
				$adoptItems .= self::controlItem( 'layers-page-adopt-link', 'AdoptLayersDrawing', $entry['params'],
					$out->msg( 'layers-page-adopt-drawing', $entry['label'] )->text() );
			}
			$copyItems = '';
			foreach ( $copyable ? $pilot->listCopyCandidates( $pageId, $out->getRevisionId(),
				$out->getAuthority() ) : [] as $entry
			) {
				$copyItems .= self::controlItem( 'layers-page-copy-link', 'CopyLayersDrawing', $entry['params'],
					$out->msg( 'layers-page-copy-drawing', $entry['label'], $entry['source']->getPrefixedText() )
						->text() );
			}
			$html = '';
			if ( $items !== '' ) {
				$html .= self::controlGroup( $out, 'layers-page-edit-history-notice', $items );
			}
			if ( $adoptItems !== '' ) {
				$html .= self::controlGroup( $out, 'layers-page-adopt-notice', $adoptItems );
			}
			if ( $copyItems !== '' ) {
				$html .= self::controlGroup( $out, 'layers-page-copy-notice', $copyItems );
			}
			if ( $html !== '' ) {
				$out->addModuleStyles( 'ext.layers.pageControls.styles' );
				$out->addHTML( Html::rawElement( 'section', [ 'class' => 'layers-page-edit-controls',
					'aria-labelledby' => 'layers-page-edit-controls-heading' ],
					Html::element( 'p', [ 'id' => 'layers-page-edit-controls-heading',
						'class' => 'layers-page-edit-controls__heading', 'role' => 'heading', 'aria-level' => '2' ],
						$out->msg( 'layers-page-drawings-heading' )->text() ) . $html ) );
			}
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned drawing controls failed.',
				[ 'exception' => $e ] );
		}
	}

	/**
	 * @param OutputPage $out
	 * @param string $notice Message key explaining what the links do
	 * @param string $items Rendered list items
	 * @return string
	 */
	private static function controlGroup( OutputPage $out, string $notice, string $items ): string {
		return Html::rawElement( 'div', [ 'class' => 'layers-page-edit-controls__group' ],
			Html::element( 'p', [ 'class' => 'layers-page-edit-controls__notice' ], $out->msg( $notice )->text() ) .
			Html::rawElement( 'ul', [ 'class' => 'layers-page-edit-controls__list' ], $items ) );
	}

	/**
	 * @param string $class
	 * @param string $special
	 * @param array $params
	 * @param string $text
	 * @return string
	 */
	private static function controlItem( string $class, string $special, array $params, string $text ): string {
		return Html::rawElement( 'li', [], Html::element( 'a', [ 'class' => $class,
			'href' => SpecialPage::getTitleFor( $special )->getLocalURL( $params ) ], $text ) );
	}
}
