<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\SpecialPages;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;

/** Protected page-owned editor entry; the shared pilot is disabled by default. */
class SpecialEditLayersPage extends SpecialPage {
	private PageOwnedPilot $pilot;

	/** @param PageOwnedPilot $pilot Shared native pilot composition */
	public function __construct( PageOwnedPilot $pilot ) {
		parent::__construct( 'EditLayersPage', '', false );
		$this->pilot = $pilot;
	}

	/** @inheritDoc */
	public function getDescription() {
		return $this->msg( 'layers-editor-title' );
	}

	/** @inheritDoc */
	public function execute( $subPage ) {
		$this->setHeaders();
		$out = $this->getOutput();
		$out->disableClientCache();
		$out->setCdnMaxage( 0 );
		$out->setRobotPolicy( 'noindex,nofollow' );
		$request = $this->getRequest();
		try {
			$revision = $request->getVal( 'revid' );
			if ( $subPage !== null && $subPage !== '' ) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			$values = $request->getValues();
			$bound = array_key_exists( 'pageid', $values ) || array_key_exists( 'start', $values ) ||
				array_key_exists( 'expected', $values );
			if ( $bound ) {
				// Never reinterpret malformed bound requests as the older owner/surface route.
				$pageId = $request->getVal( 'pageid' );
				$start = $request->getVal( 'start' );
				$expected = $request->getVal( 'expected' );
				if ( array_key_exists( 'owner', $values ) || array_key_exists( 'surface', $values ) ||
					array_key_exists( 'pdfpage', $values ) ||
					!self::isDecimal( $pageId, false ) || !self::isDecimal( $revision, false ) ||
					!self::isDecimal( $start, true ) || !is_string( $expected ) || $expected === '' ) {
					throw new \DomainException( 'layers-editor-unavailable' );
				}
				$init = $this->pilot->prepareBoundEditorEntry( (int)$pageId, (int)$revision, (int)$start,
					$expected, $this->getAuthority() );
				$newSurface = $init['pageOwned']['newSurface'] ?? null;
				if ( is_array( $newSurface ) && ( $newSurface['kind'] ?? null ) === 'pdf' ) {
					$targetPage = $newSurface['source']['page'] ?? null;
					if ( !is_int( $targetPage ) || $targetPage < 1 ) {
						throw new \DomainException( 'layers-editor-unavailable' );
					}
					$pdfCreation = $this->pilot->prepareMissingPdfEditor( (int)$pageId, (int)$revision,
						(int)$start, $expected, $targetPage, $this->getAuthority() );
					$target = $pdfCreation['target'] ?? null;
					$selection = $pdfCreation['selection'] ?? null;
					$anchor = $pdfCreation['anchorSurface'] ?? null;
					$context = $pdfCreation['context'] ?? null;
					$surface = is_array( $context ) ? ( $context['surface'] ?? null ) : null;
					$rendition = is_array( $context ) ? ( $context['rendition'] ?? null ) : null;
					$owner = $init['pageOwned']['owner'] ?? null;
					if ( !is_array( $target ) || !is_array( $selection ) || !is_array( $anchor ) ||
						!is_array( $context ) || !is_array( $surface ) || !is_array( $rendition ) ||
						$target !== [ 'pageId' => (int)$pageId, 'owner' => $owner,
							'revisionId' => (int)$revision, 'surfaceId' => $init['pageOwned']['surfaceId'] ] ||
						$owner === null || $anchor !== $newSurface ||
						$selection !== [ 'start' => (int)$start, 'expected' => $expected ] ||
						( $context['owner'] ?? null ) !== $owner || ( $context['pageId'] ?? null ) !== (int)$pageId ||
						( $context['revisionId'] ?? null ) !== (int)$revision ||
						!is_int( $context['pageCount'] ?? null ) || $context['pageCount'] < 1 ||
						$surface !== $newSurface ||
						( $context['initialPage'] ?? null ) !== $targetPage ||
						( $context['page'] ?? null ) !== $targetPage || ( $context['kind'] ?? null ) !== 'pdf' ||
						( $surface['source']['page'] ?? null ) !== $targetPage ||
						!is_string( $rendition['url'] ?? null ) || $rendition['url'] === '' ||
						!is_int( $surface['canvas']['width'] ?? null ) ||
						!is_int( $surface['canvas']['height'] ?? null ) ) {
						throw new \DomainException( 'layers-editor-unavailable' );
					}
					$init['pageOwned']['pdfCreation'] = $pdfCreation;
					$init['initialSetName'] = $anchor['label'];
					$init['page'] = $targetPage;
					$init['pageCount'] = $context['pageCount'];
					$init['baseWidth'] = $surface['canvas']['width'];
					$init['baseHeight'] = $surface['canvas']['height'];
					$init['imageUrl'] = $rendition['url'];
				}
			} else {
				// A deliberate current-editor link is distinct from an exact numeric link.
				$owner = $request->getVal( 'owner' );
				$surface = $request->getVal( 'surface' );
				if ( ( $revision !== 'current' && !self::isDecimal( $revision, false ) ) ||
					!is_string( $owner ) || !is_string( $surface ) ) {
					throw new \DomainException( 'layers-editor-unavailable' );
				}
				if ( $request->getCheck( 'pdfpage' ) && $revision === 'current' ) {
					throw new \DomainException( 'layers-editor-unavailable' );
				}
				$init = $revision === 'current' ?
					$this->pilot->prepareCurrentEditor( $owner, $surface, $this->getAuthority() ) :
					$this->pilot->prepareEditor( $owner, (int)$revision, $surface, $this->getAuthority(),
						$request->getCheck( 'pdfpage' ) ? self::pdfPage( $request->getVal( 'pdfpage' ) ) : null );
			}
			// The admitted owner is the return page, independent of the edited file.
			$returnTitle = Title::newFromText( $init['pageOwned']['owner'] );
			if ( !$returnTitle || !$returnTitle->canExist() || $returnTitle->isExternal() ||
				$returnTitle->hasFragment() ) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			$returnToUrl = $returnTitle->getLocalURL();
		} catch ( \DomainException $e ) {
			$out->addWikiMsg( 'layers-editor-unavailable' );
			return;
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned editor initialization failed.',
				[ 'exception' => $e ] );
			$out->addWikiMsg( 'layers-editor-unavailable' );
			return;
		}
		$out->setPageTitle( $this->msg( 'layers-editor-title' )->text() );
		$out->addJsConfigVars( [
			'wgLayersEditorInit' => $init,
			'wgLayersReturnToUrl' => $returnToUrl,
		] );
		$out->addModules( [ 'ext.layers.editor', 'ext.layers.editor.pageOwned' ] );
		$out->addHTML( '<div id="layers-editor-container"></div>' );
	}

	/**
	 * @param mixed $value
	 * @param bool $allowZero
	 * @return bool
	 */
	private static function isDecimal( $value, bool $allowZero ): bool {
		return is_string( $value ) &&
			( ( $allowZero && $value === '0' ) || preg_match( '/^[1-9][0-9]{0,9}$/D', $value ) ) &&
			(float)$value <= 2147483647;
	}

	/** @param mixed $value @return int */
	private static function pdfPage( $value ): int {
		if ( !self::isDecimal( $value, false ) ) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		return (int)$value;
	}

}
