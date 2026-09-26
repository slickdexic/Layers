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
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;

/**
 * Confirm and perform an explicit copy of a shared slide into its page's revision history.
 * GET shows what will be copied; only a POST with the user's edit token writes.
 */
class SpecialAdoptLayersDrawing extends SpecialPage {
	private const FIELDS = [ 'pageid', 'revid', 'start', 'expected', 'legacyrev' ];

	/** Failure codes with their own explanation; everything else gets one generic message. */
	private const MESSAGES = [
		'layers-adoption-rendering-unavailable' => 'layers-adopt-not-renderable',
		'layers-edit-conflict' => 'layers-adopt-conflict',
		'layers-edit-filtered' => 'layers-edit-filtered'
	];

	private PageOwnedPilot $pilot;
	private TitleFactory $titles;

	/**
	 * @param PageOwnedPilot $pilot Shared native pilot composition
	 * @param TitleFactory $titles
	 */
	public function __construct( PageOwnedPilot $pilot, TitleFactory $titles ) {
		parent::__construct( 'AdoptLayersDrawing', '', false );
		$this->pilot = $pilot;
		$this->titles = $titles;
	}

	/** @inheritDoc */
	public function doesWrites() {
		return true;
	}

	/** @inheritDoc */
	public function getDescription() {
		return $this->msg( 'layers-adopt-title' );
	}

	/** @inheritDoc */
	public function execute( $subPage ) {
		$this->setHeaders();
		$this->checkReadOnly();
		$this->requireNamedUser();
		$out = $this->getOutput();
		$out->setRobotPolicy( 'noindex,nofollow' );
		$out->addModuleStyles( 'mediawiki.codex.messagebox.styles' );
		$selection = $this->readSelection( $subPage );
		if ( !$selection ) {
			$out->addHTML( Html::errorBox( $this->msg( 'layers-adopt-unavailable-generic' )->parse() ) );
			return;
		}
		try {
			$preview = $this->pilot->previewDirectAdoption( $selection['pageid'], $selection['revid'],
				$selection['start'], $selection['expected'], $selection['legacyrev'], $this->getAuthority() );
		} catch ( PublicationException $e ) {
			$this->showFailure( $e->getMessage(), $selection['pageid'] );
			return;
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Adoption preview failed.', [ 'exception' => $e ] );
			$this->showFailure( '', $selection['pageid'] );
			return;
		}
		/** @var Title $owner */
		$owner = $preview['owner'];
		$form = HTMLForm::factory( 'codex', [
			'summary' => [
				'type' => 'text',
				'label-message' => 'layers-adopt-summary-label',
				'default' => $this->msg( 'layers-adopt-default-summary' )
					->plaintextParams( $preview['label'] )->inContentLanguage()->text(),
				'maxlength' => 500
			]
		], $this->getContext() );
		$form->setMethod( 'post' )
			->setAction( $this->getPageTitle()->getLocalURL() )
			->addHiddenFields( $selection )
			->setSubmitTextMsg( 'layers-adopt-submit' )
			->showCancel()
			->setCancelTarget( $owner )
			->setPreHtml( $this->msg( 'layers-adopt-intro' )
				->plaintextParams( $preview['label'], $preview['setName'] )
				->numParams( $preview['revision'] )
				->params( $owner->getPrefixedText() )
				->parseAsBlock() )
			->setSubmitCallback( function ( array $data ) use ( $selection, $owner ) {
				return $this->adopt( $selection, $owner, (string)$data['summary'] );
			} );
		if ( $form->show() === true ) {
			$out->redirect( $owner->getFullURL() );
		}
	}

	/**
	 * @param array $selection
	 * @param Title $owner
	 * @param string $summary
	 * @return Status|true
	 */
	private function adopt( array $selection, Title $owner, string $summary ) {
		if ( $this->getUser()->pingLimiter( 'editlayers-save' ) ) {
			return Status::newFatal( 'actionthrottledtext' );
		}
		try {
			// No automatic retry: a repeated or stale submission fails the base-revision check.
			$this->pilot->adoptDirectEmbedding( $selection['pageid'], $selection['revid'], $selection['start'],
				$selection['expected'], $selection['legacyrev'], null, $this->getAuthority(), $summary );
		} catch ( PublicationException $e ) {
			return Status::newFatal( self::MESSAGES[$e->getMessage()] ?? 'layers-adopt-unavailable',
				$owner->getPrefixedText() );
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Adoption failed.', [ 'exception' => $e ] );
			return Status::newFatal( 'layers-adopt-unavailable', $owner->getPrefixedText() );
		}
		return true;
	}

	/**
	 * @param string $code
	 * @param int $pageId
	 */
	private function showFailure( string $code, int $pageId ): void {
		$owner = $this->titles->newFromID( $pageId );
		$key = self::MESSAGES[$code] ?? 'layers-adopt-unavailable';
		$out = $this->getOutput();
		if ( $owner && $this->getAuthority()->definitelyCan( 'read', $owner ) ) {
			$out->addHTML( Html::errorBox( $this->msg( $key, $owner->getPrefixedText() )->parse() ) );
			$out->addReturnTo( $owner );
		} else {
			$out->addHTML( Html::errorBox( $this->msg( 'layers-adopt-unavailable-generic' )->parse() ) );
		}
	}

	/**
	 * Canonical, bounded selection; malformed requests are never reinterpreted.
	 * @param string|null $subPage
	 * @return array|null
	 */
	private function readSelection( ?string $subPage ): ?array {
		if ( $subPage !== null && $subPage !== '' ) {
			return null;
		}
		$request = $this->getRequest();
		$selection = [];
		foreach ( self::FIELDS as $field ) {
			$value = $request->getVal( $field );
			if ( !is_string( $value ) ) {
				return null;
			}
			if ( $field === 'expected' ) {
				if ( $value === '' || strlen( $value ) > 4096 ) {
					return null;
				}
				$selection[$field] = $value;
				continue;
			}
			if ( !( ( $field === 'start' && $value === '0' ) || preg_match( '/^[1-9][0-9]{0,9}$/D', $value ) ) ||
				(float)$value > 2147483647 ) {
				return null;
			}
			$selection[$field] = (int)$value;
		}
		return $selection;
	}
}
