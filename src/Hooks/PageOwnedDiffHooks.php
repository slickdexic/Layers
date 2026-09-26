<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Diff\Hook\DifferenceEngineShowDiffHook;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Html\Html;
use MediaWiki\Logger\LoggerFactory;

/** Diff pages show each changed drawing before and after; the reader's browser fetches both. */
class PageOwnedDiffHooks implements DifferenceEngineShowDiffHook {
	private PageOwnedPilot $pilot;

	/**
	 * @param PageOwnedPilot $pilot
	 */
	public function __construct( PageOwnedPilot $pilot ) {
		$this->pilot = $pilot;
	}

	/** @inheritDoc */
	public function onDifferenceEngineShowDiff( $differenceEngine ) {
		$old = $differenceEngine->getOldRevision();
		$new = $differenceEngine->getNewRevision();
		if ( !$old || !$new || $old->getId() <= 0 || $new->getId() <= 0 ||
			$old->getPageId() !== $new->getPageId()
		) {
			return;
		}
		try {
			$changes = $this->pilot->getDrawingChanges( $differenceEngine->getTitle(), $old, $new,
				$differenceEngine->getAuthority() );
		} catch ( \DomainException | \JsonException $e ) {
			// Hidden or unreadable drawings are not compared.
			return;
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned drawing comparison failed.',
				[ 'exception' => $e ] );
			return;
		}
		if ( !$changes ) {
			return;
		}
		$pairs = '';
		foreach ( $changes as $change ) {
			$binding = 'v1:' . $new->getPageId() . ':' . $change['id'];
			$sides = '';
			foreach ( [ 'old' => $old, 'new' => $new ] as $side => $revision ) {
				$sides .= Html::rawElement( 'div', [ 'class' => 'layers-drawing-diff__side' ], $change[$side] ?
					Html::element( 'div', [ 'class' => 'layers-drawing-diff-view', 'data-layers-binding' => $binding,
						'data-layers-revision' => $revision->getId() ],
						$differenceEngine->msg( 'layers-revision-unavailable' )->text() ) :
					Html::element( 'p', [ 'class' => 'layers-drawing-diff__absent' ], $differenceEngine->msg(
						$side === 'old' ? 'layers-page-diff-added' : 'layers-page-diff-removed', $change['label']
					)->text() ) );
			}
			$pairs .= Html::rawElement( 'div', [ 'class' => 'layers-drawing-diff__pair' ], $sides );
		}
		$out = $differenceEngine->getOutput();
		$out->addModuleStyles( 'ext.layers.pageControls.styles' );
		$out->addModules( 'ext.layers.history' );
		$out->addHTML( Html::rawElement( 'section', [ 'class' => 'layers-drawing-diff',
			'aria-labelledby' => 'layers-drawing-diff-heading' ],
			Html::element( 'h2', [ 'id' => 'layers-drawing-diff-heading', 'class' => 'layers-drawing-diff__heading' ],
				$differenceEngine->msg( 'layers-page-diff-heading' )->text() ) . $pairs ) );
	}
}
