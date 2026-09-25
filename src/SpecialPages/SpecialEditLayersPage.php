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
			// A deliberate current-editor link is distinct from an exact numeric link.
			$revision = $request->getVal( 'revid' );
			$owner = $request->getVal( 'owner' );
			$surface = $request->getVal( 'surface' );
			if ( !is_string( $revision ) || ( $revision !== 'current' &&
				( !preg_match( '/^[1-9][0-9]{0,9}$/D', $revision ) || (float)$revision > 2147483647 ) ) ||
				!is_string( $owner ) || !is_string( $surface ) ||
				( $subPage !== null && $subPage !== '' )
			) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			$init = $revision === 'current' ?
				$this->pilot->prepareCurrentEditor( $owner, $surface, $this->getAuthority() ) :
				$this->pilot->prepareEditor( $owner, (int)$revision, $surface, $this->getAuthority() );
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
}
