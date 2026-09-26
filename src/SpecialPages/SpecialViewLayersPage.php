<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\SpecialPages;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Html\Html;
use MediaWiki\HTMLForm\HTMLForm;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Status\Status;

/** Exact-revision read-only viewer entry, with a restore action for editors; the pilot is disabled by default. */
class SpecialViewLayersPage extends SpecialPage {
	private const RESTORE_ERRORS = [
		'layers-edit-conflict' => 'layers-page-restore-conflict',
		'layers-edit-filtered' => 'layers-edit-filtered'
	];

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
		$this->showRestore( $owner, (int)$revision, $surface );
	}

	/**
	 * Offer editors to make this earlier version the drawing's current version.
	 * @param string $owner
	 * @param int $revisionId
	 * @param string $surfaceId
	 */
	private function showRestore( string $owner, int $revisionId, string $surfaceId ): void {
		$out = $this->getOutput();
		$restore = $this->pilot->newSurfaceRestore();
		$offer = $restore->prepare( $owner, $revisionId, $surfaceId, $this->getAuthority() );
		if ( !$offer ) {
			if ( $this->getRequest()->wasPosted() ) {
				$out->addModuleStyles( 'mediawiki.codex.messagebox.styles' );
				$out->addHTML( Html::errorBox( $this->msg( 'layers-page-restore-unavailable' )->parse() ) );
			}
			return;
		}
		$ownerTitle = $offer['owner'];
		$form = HTMLForm::factory( 'codex', [
			'base' => [ 'type' => 'hidden', 'default' => (string)$offer['baseRevisionId'] ]
		], $this->getContext() );
		$form->setMethod( 'post' )
			->setAction( $this->getPageTitle()->getLocalURL( [ 'owner' => $owner, 'revid' => $revisionId,
				'surface' => $surfaceId ] ) )
			->setPreHtml( $this->msg( 'layers-page-restore-intro' )->plaintextParams( $offer['label'] )
				->params( $ownerTitle->getPrefixedText() )->parseAsBlock() )
			->setSubmitTextMsg( 'layers-page-restore-submit' )
			->setSubmitCallback( function ( array $data ) use ( $restore, $offer, $owner, $revisionId, $surfaceId ) {
				if ( $this->getUser()->pingLimiter( 'editlayers-save' ) ) {
					return Status::newFatal( 'actionthrottledtext' );
				}
				try {
					// No automatic retry: a stale form fails the base-revision check.
					$restore->restore( $owner, $revisionId, $surfaceId, (int)$data['base'], $this->getAuthority(),
						$this->msg( 'layers-page-restore-summary' )->plaintextParams( $offer['label'] )
							->numParams( $revisionId )->inContentLanguage()->text() );
				} catch ( PublicationException $e ) {
					return Status::newFatal(
						self::RESTORE_ERRORS[$e->getMessage()] ?? 'layers-page-restore-unavailable',
						$offer['owner']->getPrefixedText() );
				} catch ( \Throwable $e ) {
					LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned drawing restore failed.',
						[ 'exception' => $e ] );
					return Status::newFatal( 'layers-page-restore-unavailable' );
				}
				return true;
			} );
		if ( $form->show() === true ) {
			$out->redirect( $ownerTitle->getFullURL() );
		}
	}
}
