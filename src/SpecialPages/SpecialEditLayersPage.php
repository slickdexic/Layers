<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\SpecialPages;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\SpecialPage\SpecialPage;

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
					!self::isDecimal( $pageId, false ) || !self::isDecimal( $revision, false ) ||
					!self::isDecimal( $start, true ) || !is_string( $expected ) || $expected === '' ) {
					throw new \DomainException( 'layers-editor-unavailable' );
				}
				$init = $this->pilot->prepareBoundEditor( (int)$pageId, (int)$revision, (int)$start,
					$expected, $this->getAuthority() );
			} else {
				// A deliberate current-editor link is distinct from an exact numeric link.
				$owner = $request->getVal( 'owner' );
				$surface = $request->getVal( 'surface' );
				if ( ( $revision !== 'current' && !self::isDecimal( $revision, false ) ) ||
					!is_string( $owner ) || !is_string( $surface ) ) {
					throw new \DomainException( 'layers-editor-unavailable' );
				}
				$init = $revision === 'current' ?
					$this->pilot->prepareCurrentEditor( $owner, $surface, $this->getAuthority() ) :
					$this->pilot->prepareEditor( $owner, (int)$revision, $surface, $this->getAuthority() );
			}
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
		$out->addJsConfigVars( 'wgLayersEditorInit', $init );
		$out->addModules( 'ext.layers.editor' );
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

}
