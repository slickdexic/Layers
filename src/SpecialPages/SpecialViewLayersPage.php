<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\SpecialPages;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\SpecialPage\SpecialPage;

/** Exact-revision read-only viewer entry; the shared pilot is disabled by default. */
class SpecialViewLayersPage extends SpecialPage {
	private PageOwnedPilot $pilot;

	/** @param PageOwnedPilot $pilot Shared native pilot composition */
	public function __construct( PageOwnedPilot $pilot ) {
		parent::__construct( 'ViewLayersPage', '', false );
		$this->pilot = $pilot;
	}

	/** @inheritDoc */
	public function getDescription() {
		return $this->msg( 'layers-page-history-title' );
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
			// Reject coercion/truncation: an explicit positive revision is required.
			$revision = $request->getVal( 'revid' );
			$owner = $request->getVal( 'owner' );
			$surface = $request->getVal( 'surface' );
			if ( !is_string( $revision ) || !preg_match( '/^[1-9][0-9]{0,9}$/D', $revision ) ||
				(float)$revision > 2147483647 || !is_string( $owner ) || !is_string( $surface ) ||
				( $subPage !== null && $subPage !== '' )
			) {
				throw new \DomainException( 'layers-revision-unavailable' );
			}
			$init = $this->pilot->prepareViewer( $owner, (int)$revision, $surface, $this->getAuthority() );
		} catch ( \DomainException $e ) {
			$out->addWikiMsg( 'layers-revision-unavailable' );
			return;
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned historical view initialization failed.',
				[ 'exception' => $e ] );
			$out->addWikiMsg( 'layers-revision-unavailable' );
			return;
		}
		$out->setPageTitle( $this->msg( 'layers-page-history-title' )->text() );
		$out->addJsConfigVars( 'wgLayersRevisionView', $init );
		$out->addModules( 'ext.layers.history' );
		$out->addHTML( '<div id="layers-history-container"></div>' );
	}
}
