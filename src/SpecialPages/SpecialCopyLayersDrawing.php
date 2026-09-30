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
 * Confirm and perform a copy of another page's drawing into this page, as a new drawing of this page.
 * GET shows what will be copied; only a POST with the user's edit token writes.
 */
class SpecialCopyLayersDrawing extends SpecialPage {
	private const FIELDS = [ 'pageid', 'revid', 'start', 'expected', 'sourcerev' ];
	/** A drawing picked from the editor's list names its source page and drawing, not an embed. */
	private const LIST_FIELDS = [ 'pageid', 'revid', 'sourcepage', 'sourcesurface', 'sourcerev' ];

	/** Failure codes with their own explanation; everything else gets one generic message. */
	private const MESSAGES = [
		'layers-edit-conflict' => 'layers-copy-conflict',
		'layers-content-not-renderable' => 'layers-copy-not-renderable',
		'layers-source-unavailable' => 'layers-copy-file-unavailable',
		'layers-edit-filtered' => 'layers-edit-filtered'
	];

	private PageOwnedPilot $pilot;
	private TitleFactory $titles;

	/**
	 * @param PageOwnedPilot $pilot Shared native pilot composition
	 * @param TitleFactory $titles
	 */
	public function __construct( PageOwnedPilot $pilot, TitleFactory $titles ) {
		parent::__construct( 'CopyLayersDrawing', '', false );
		$this->pilot = $pilot;
		$this->titles = $titles;
	}

	/** @inheritDoc */
	public function doesWrites() {
		return true;
	}

	/** @inheritDoc */
	public function getDescription() {
		return $this->msg( 'layers-copy-title' );
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
			$out->addHTML( Html::errorBox( $this->msg( 'layers-copy-unavailable-generic' )->parse() ) );
			return;
		}
		try {
			$preview = isset( $selection['sourcepage'] ) ?
				$this->pilot->previewListCopy( $selection['pageid'], $selection['revid'], $selection['sourcepage'],
					$selection['sourcesurface'], $selection['sourcerev'], $this->getAuthority() ) :
				$this->pilot->previewCopy( $selection['pageid'], $selection['revid'], $selection['start'],
					$selection['expected'], $selection['sourcerev'], $this->getAuthority() );
		} catch ( PublicationException $e ) {
			$this->showFailure( $e, $selection['pageid'] );
			return;
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Copy preview failed.', [ 'exception' => $e ] );
			$this->showFailure( null, $selection['pageid'] );
			return;
		}
		/** @var Title $owner */
		$owner = $preview['owner'];
		$form = HTMLForm::factory( 'codex', [
			'note' => [
				'type' => 'text',
				'label-message' => 'layers-copy-note-label',
				'help-message' => 'layers-copy-note-help',
				'maxlength' => 250
			]
		], $this->getContext() );
		$form->setMethod( 'post' )
			->setAction( $this->getPageTitle()->getLocalURL() )
			->addHiddenFields( $selection )
			->setSubmitTextMsg( 'layers-copy-submit' )
			->showCancel()
			->setCancelTarget( $owner )
			->setPreHtml( $this->msg( 'layers-copy-intro' )
				->plaintextParams( $preview['label'] )
				->params( $preview['source']->getPrefixedText() )
				->numParams( $preview['sourceRevision'] )
				->params( $owner->getPrefixedText() )
				->parseAsBlock() )
			->setSubmitCallback( function ( array $data ) use ( $selection, $owner ) {
				return $this->copy( $selection, $owner, (string)$data['note'] );
			} );
		if ( $form->show() === true ) {
			$out->redirect( $owner->getFullURL() );
		}
	}

	/**
	 * @param array $selection
	 * @param Title $owner
	 * @param string $note
	 * @return Status|true
	 */
	private function copy( array $selection, Title $owner, string $note ) {
		if ( $this->getUser()->pingLimiter( 'editlayers-save' ) ) {
			return Status::newFatal( 'actionthrottledtext' );
		}
		try {
			// No automatic retry: a repeated or stale submission fails the base-revision check.
			if ( isset( $selection['sourcepage'] ) ) {
				$this->pilot->copyListDrawing( $selection['pageid'], $selection['revid'], $selection['sourcepage'],
					$selection['sourcesurface'], $selection['sourcerev'], $this->getAuthority(), $note );
			} else {
				$this->pilot->copyDrawing( $selection['pageid'], $selection['revid'], $selection['start'],
					$selection['expected'], $selection['sourcerev'], $this->getAuthority(), $note );
			}
		} catch ( PublicationException $e ) {
			return Status::newFatal( ...self::failureMessage( $e, $owner ) );
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Copy failed.', [ 'exception' => $e ] );
			return Status::newFatal( 'layers-copy-unavailable', $owner->getPrefixedText() );
		}
		return true;
	}

	/**
	 * @param PublicationException $e
	 * @param Title $owner
	 * @return array Message key and parameters
	 */
	private static function failureMessage( PublicationException $e, Title $owner ): array {
		return $e->getUserMessage() ??
			[ self::MESSAGES[$e->getMessage()] ?? 'layers-copy-unavailable', $owner->getPrefixedText() ];
	}

	/**
	 * @param PublicationException|null $e
	 * @param int $pageId
	 */
	private function showFailure( ?PublicationException $e, int $pageId ): void {
		$owner = $this->titles->newFromID( $pageId );
		$out = $this->getOutput();
		if ( $owner && $this->getAuthority()->definitelyCan( 'read', $owner ) ) {
			$message = $e ? self::failureMessage( $e, $owner ) :
				[ 'layers-copy-unavailable', $owner->getPrefixedText() ];
			$out->addHTML( Html::errorBox( $this->msg( ...$message )->parse() ) );
			$out->addReturnTo( $owner );
		} else {
			$out->addHTML( Html::errorBox( $this->msg( 'layers-copy-unavailable-generic' )->parse() ) );
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
		if ( $request->getCheck( 'sourcepage' ) ) {
			return $this->readListSelection( $request );
		}
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

	/**
	 * @param \MediaWiki\Request\WebRequest $request
	 * @return array|null Without a revid, the page's current revision, which the form then carries to the POST
	 */
	private function readListSelection( $request ): ?array {
		$selection = [];
		foreach ( self::LIST_FIELDS as $field ) {
			$value = $request->getVal( $field );
			if ( $field === 'revid' && $value === null ) {
				$owner = $this->titles->newFromID( $request->getInt( 'pageid' ) );
				$value = $owner ? (string)$owner->getLatestRevID() : null;
			}
			if ( !is_string( $value ) ) {
				return null;
			}
			if ( $field === 'sourcesurface' ) {
				if ( !preg_match( '/^[A-Za-z0-9_.:-]{1,80}$/D', $value ) ) {
					return null;
				}
				$selection[$field] = $value;
				continue;
			}
			if ( !preg_match( '/^[1-9][0-9]{0,9}$/D', $value ) || (float)$value > 2147483647 ) {
				return null;
			}
			$selection[$field] = (int)$value;
		}
		return $selection;
	}
}
