<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Page\WikiPageFactory;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Storage\PreparedUpdate;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/** Internal publication orchestration; exposed only through guarded request boundaries. */
class PagePublicationService {
	private WikiPageFactory $pages;
	private PageHistoryAccess $access;
	private SourceVersionResolver $sources;
	private PageRevisionWriter $writer;
	private PublicationAdmissionContext $context;

	/**
	 * @param WikiPageFactory $pages
	 * @param PageHistoryAccess $access
	 * @param SourceVersionResolver $sources
	 * @param PageRevisionWriter $writer
	 * @param ?PublicationAdmissionContext $context
	 */
	public function __construct( WikiPageFactory $pages, PageHistoryAccess $access,
		SourceVersionResolver $sources, PageRevisionWriter $writer,
		?PublicationAdmissionContext $context = null
	) {
		$this->pages = $pages;
		$this->access = $access;
		$this->sources = $sources;
		$this->writer = $writer;
		$this->context = $context ?? new PublicationAdmissionContext();
	}

	/**
	 * @return PublicationAdmissionContext
	 */
	public function getAdmissionContext(): PublicationAdmissionContext {
		return $this->context;
	}

	/**
	 * Publish a complete snapshot with one actor/owner, returning only its revision ID.
	 * Main text may be supplied only for wikitext owners; model changes are forbidden.
	 * Callers must implement request controls before exposing this through an API.
	 *
	 * @param Title $owner
	 * @param Authority $authority
	 * @param int $baseRevisionId Zero for creation, positive for updates
	 * @param string $json Complete snapshot
	 * @param string $summary
	 * @param WikitextContent|null $main Optional simultaneous main-slot edit
	 * @param int|null $expectedPageId Bound existing owner; required for future binding-based callers
	 * @return int Committed revision ID, or unchanged ID for a successful no-op
	 * @throws PublicationException With a stable internal error code
	 */
	public function publish( Title $owner, Authority $authority, int $baseRevisionId,
		string $json, string $summary, ?WikitextContent $main = null, ?int $expectedPageId = null
	): int {
		try {
			$this->access->assertCanPrepareEdit( $owner, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( 'layers-owner-edit-denied', 0, $e );
		}
		if ( $baseRevisionId < 0 || ( $baseRevisionId === 0 && $main === null ) ) {
			throw new PublicationException( 'layers-invalid-publication-request' );
		}
		if ( $expectedPageId !== null ) {
			if ( $expectedPageId < 1 || $expectedPageId > 2147483647 || $baseRevisionId === 0 ) {
				throw new PublicationException( 'layers-invalid-publication-request' );
			}
			$this->assertOwnerIdentity( $owner, $expectedPageId );
		}
		if ( $main !== null && $owner->getContentModel( IDBAccessObject::READ_LATEST ) !== CONTENT_MODEL_WIKITEXT ) {
			throw new PublicationException( 'layers-main-model-change-denied' );
		}
		try {
			$content = new LayersDocumentContent( $json );
			$content = new LayersDocumentContent( $content->getCanonicalText() );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-invalid-snapshot', 0, $e );
		}
		try {
			$this->sources->resolve( $content, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( 'layers-source-unavailable', 0, $e );
		}

		$action = ( $baseRevisionId === 0 || !$this->access->hasLayersSlot( $baseRevisionId ) ) ?
			PublicationAdmissionIntent::ACTION_ADD :
			PublicationAdmissionIntent::ACTION_REPLACE;

		$page = $this->pages->newFromTitle( $owner );
		if ( $expectedPageId !== null ) {
			// Source preparation can run callbacks or take long enough for a move.
			$this->assertOwnerIdentity( $owner, $expectedPageId );
		}
		try {
			$revision = $this->writer->save( $page->newPageUpdater( $authority ), $baseRevisionId,
				$content, CommentStoreComment::newUnsavedComment( $summary ), $main,
				function ( PreparedUpdate $prepared, callable $commit ) use (
					$owner, $authority, $baseRevisionId, $action, $content, $main, $expectedPageId
				) {
					if ( $expectedPageId !== null ) {
						$this->assertOwnerIdentity( $owner, $expectedPageId );
						if ( $prepared->getPage()->getId() !== $expectedPageId ||
							$prepared->getPage()->getNamespace() !== $owner->getNamespace() ||
							$prepared->getPage()->getDBkey() !== $owner->getDBkey() ) {
							throw new PublicationException( 'layers-owner-unavailable' );
						}
					}
					// Core preparation may run extension callbacks. Finalize authorization
					// once before granting a scope, retaining the restricted caller.
					try {
						$this->access->assertCanEdit( $owner, $authority );
					} catch ( \DomainException $e ) {
						throw new PublicationException( 'layers-owner-edit-denied', 0, $e );
					}
					$preparedLayers = $prepared->getRawContent( PageRevisionWriter::SLOT );
					if ( $preparedLayers->getModel() !== LayersDocumentContent::MODEL ||
						$preparedLayers->serialize() !== $content->getCanonicalText()
					) {
						throw new PublicationException( 'layers-admission-unauthorized' );
					}
					$intent = new PublicationAdmissionIntent(
						$authority, $authority->getUser(), $prepared->getPage()->getId(),
						$owner->getNamespace(), $owner->getDBkey(), $baseRevisionId, $action,
						PageRevisionWriter::SLOT, LayersDocumentContent::MODEL, $content->getCanonicalText(),
						$main !== null,
						$main !== null ? $prepared->getRawContent( SlotRecord::MAIN )->serialize() : null
					);
					return $this->context->executeInScope( $intent, $commit );
				}
			);
		} catch ( PublicationException $e ) {
			throw $e;
		} catch ( \DomainException $e ) {
			throw new PublicationException( 'layers-edit-conflict', 0, $e );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-invalid-publication-request', 0, $e );
		} catch ( \RuntimeException $e ) {
			$msg = $e->getMessage();
			if ( in_array( $msg, [ 'layers-admission-unauthorized', 'layers-slot-removal-denied' ], true ) ) {
				throw new PublicationException( $msg, 0, $e );
			}
			throw new PublicationException( 'layers-revision-save-failed', 0, $e );
		}
		return $revision->getId();
	}

	/**
	 * Recheck the original title against the expected ID without following redirects.
	 * @param Title $owner
	 * @param int $expectedPageId
	 */
	private function assertOwnerIdentity( Title $owner, int $expectedPageId ): void {
		if ( $owner->getArticleID( IDBAccessObject::READ_LATEST ) !== $expectedPageId ) {
			throw new PublicationException( 'layers-owner-unavailable' );
		}
	}
}
