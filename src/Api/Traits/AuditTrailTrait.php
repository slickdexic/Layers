<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api\Traits;

use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;
use MediaWiki\User\UserIdentity;

/**
 * Trait for creating audit trail entries when layer data changes.
 *
 * When $wgLayersTrackChangesInRecentChanges is enabled, layer save/delete/rename
 * operations create a null edit on the associated File: page. This makes the
 * change visible in:
 * - Recent Changes (Special:RecentChanges)
 * - Page history (action=history)
 * - Watchlists (Special:Watchlist)
 *
 * Each null edit is tagged with 'layers-data-change' for filtering.
 *
 * Used by: ApiLayersSave, ApiLayersDelete, ApiLayersRename
 */
trait AuditTrailTrait {

	/**
	 * Create a null-edit audit trail entry on the file page.
	 *
	 * This performs a null edit (re-saves current content unchanged) with a
	 * descriptive edit summary and the 'layers-data-change' change tag.
	 *
	 * @param \Title|\MediaWiki\Title\Title $title The file page title
	 * @param UserIdentity $user The user performing the action
	 * @param string $action One of 'save', 'delete', 'rename'
	 * @param string $setName The layer set name
	 * @param array $extra Extra context (e.g. 'oldname' for rename)
	 */
	protected function createAuditTrailEntry(
		$title,
		UserIdentity $user,
		string $action,
		string $setName,
		array $extra = []
	): void {
		if ( !$title || !$title->exists() ) {
			return;
		}

		try {
			$services = MediaWikiServices::getInstance();
			$config = $services->getMainConfig();

			if ( !$config->get( 'LayersTrackChangesInRecentChanges' ) ) {
				return;
			}

			$summary = $this->buildAuditSummary( $action, $setName, $extra );

			$wikiPageFactory = $services->getWikiPageFactory();
			$wikiPage = $wikiPageFactory->newFromTitle( $title );
			$content = $wikiPage->getContent();

			if ( $content === null ) {
				return;
			}

			// Perform a null edit — re-saves the same content with a new edit summary.
			// EDIT_INTERNAL suppresses patrol requirements; EDIT_MINOR marks as minor.
			$updater = $wikiPage->newPageUpdater( $user );
			$updater->setContent(
				\MediaWiki\Revision\SlotRecord::MAIN,
				$content
			);
			$updater->addTag( 'layers-data-change' );

			$commentStore = \MediaWiki\CommentStore\CommentStoreComment::newUnsavedComment(
				$summary
			);
			$flags = EDIT_MINOR | EDIT_INTERNAL;
			$updater->saveRevision( $commentStore, $flags );

			$status = $updater->getStatus();
			if ( !$status->isOK() ) {
				LoggerFactory::getInstance( 'Layers' )->warning(
					'Audit trail null edit failed for {title}: {error}',
					[
						'title' => $title->getPrefixedText(),
						'error' => $status->getMessage()->text(),
						'action' => $action,
						'setName' => $setName,
					]
				);
			}
		} catch ( \Throwable $e ) {
			// Audit trail is best-effort; never fail the actual operation
			try {
				LoggerFactory::getInstance( 'Layers' )->warning(
					'Audit trail entry failed for {title}',
					[
						'title' => $title->getPrefixedText(),
						'exception' => $e,
						'action' => $action,
						'setName' => $setName,
					]
				);
			} catch ( \Throwable $logError ) {
				// LoggerFactory unavailable; silently discard
			}
		}
	}

	/**
	 * Build the edit summary for the audit trail entry.
	 *
	 * @param string $action One of 'save', 'delete', 'rename'
	 * @param string $setName The layer set name
	 * @param array $extra Extra context
	 * @return string The edit summary text
	 */
	private function buildAuditSummary( string $action, string $setName, array $extra ): string {
		switch ( $action ) {
			case 'save':
				return wfMessage( 'layers-audit-save', $setName )->inContentLanguage()->text();
			case 'delete':
				return wfMessage( 'layers-audit-delete', $setName )->inContentLanguage()->text();
			case 'rename':
				$oldName = $extra['oldname'] ?? $setName;
				$newName = $extra['newname'] ?? $setName;
				return wfMessage( 'layers-audit-rename', $oldName, $newName )->inContentLanguage()->text();
			default:
				return wfMessage( 'layers-audit-change', $setName )->inContentLanguage()->text();
		}
	}
}
