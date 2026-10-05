<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\DerivativeContext;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\HookContainer\HookContainer;
use MediaWiki\Page\WikiPage;
use MediaWiki\Page\WikiPageFactory;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Status\Status;
use MediaWiki\Storage\PreparedUpdate;
use MediaWiki\Title\Title;
use MediaWiki\User\UserFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Internal publication orchestration; exposed only through guarded request boundaries. */
class PagePublicationService {
	/** Software change tag on every page-owned Layers revision; defined in Hooks::onListDefinedTags(). */
	public const CHANGE_TAG = 'layers-page-drawing';
	/** Added to the bot edits of the D3 migration, which `--undo` looks for. */
	public const MIGRATION_TAG = 'layers-migration';
	/** Added to the bot edits that undo the migration. */
	public const MIGRATION_UNDO_TAG = 'layers-migration-undo';

	private WikiPageFactory $pages;
	private PageHistoryAccess $access;
	private SourceVersionResolver $sources;
	private PageRevisionWriter $writer;
	private PublicationAdmissionContext $context;
	private ?HookContainer $hooks;
	private ?UserFactory $users;

	/**
	 * @param WikiPageFactory $pages
	 * @param PageHistoryAccess $access
	 * @param SourceVersionResolver $sources
	 * @param PageRevisionWriter $writer
	 * @param ?PublicationAdmissionContext $context
	 * @param ?HookContainer $hooks Runs EditFilterMergedContent on main-text changes; null skips filters
	 * @param ?UserFactory $users Required with $hooks
	 */
	public function __construct( WikiPageFactory $pages, PageHistoryAccess $access,
		SourceVersionResolver $sources, PageRevisionWriter $writer,
		?PublicationAdmissionContext $context = null, ?HookContainer $hooks = null, ?UserFactory $users = null
	) {
		$this->pages = $pages;
		$this->access = $access;
		$this->sources = $sources;
		$this->writer = $writer;
		$this->context = $context ?? new PublicationAdmissionContext();
		$this->hooks = $users ? $hooks : null;
		$this->users = $users;
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
	 * @param string|null $botTag Makes this a bot edit of the migration script, with this tag as well
	 * @param callable():void|null $verifySources Internal source-snapshot guard, run after core preparation
	 *  and immediately before admission. The caller retains any required source transaction boundary.
	 * @return int Committed revision ID, or unchanged ID for a successful no-op
	 * @throws PublicationException With a stable internal error code
	 */
	public function publish( Title $owner, Authority $authority, int $baseRevisionId,
		string $json, string $summary, ?WikitextContent $main = null, ?int $expectedPageId = null,
		?string $botTag = null, ?callable $verifySources = null
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
		} catch ( LossyLayerException $e ) {
			throw PublicationException::refusedLayer( $e );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-invalid-snapshot', 0, $e );
		}
		$document = json_decode( $content->getText() );
		$stored = $this->access->getStoredSurfaces( $owner, $baseRevisionId, $authority );
		$rename = LayerSetRename::prepare( $stored, $document->surfaces );
		$document->surfaces = $rename['surfaces'];
		// Admission and source validation must see every expanded sibling change, in canonical bytes.
		$expanded = JsonSnapshotCodec::encode( $document );
		if ( $expanded !== $content->getText() ) {
			try {
				$content = new LayersDocumentContent( $expanded );
				$content = new LayersDocumentContent( $content->getCanonicalText() );
			} catch ( LossyLayerException $e ) {
				throw PublicationException::refusedLayer( $e );
			} catch ( \InvalidArgumentException $e ) {
				throw new PublicationException( 'layers-invalid-snapshot', 0, $e );
			}
		}
		$document = json_decode( $content->getText() );
		$changed = self::changedSurfaceIds( $stored, $document );
		DrawingName::assertPublishable( $document->surfaces, $changed );
		if ( trim( $summary ) === '' ) {
			$summary = DrawingAutoSummary::text( $stored, $document );
		}
		$main = $this->withRenamedEmbeds( $owner, $authority, $baseRevisionId, $rename['renames'], $main );
		foreach ( $document->surfaces as $surface ) {
			if ( in_array( $surface->id, $changed, true ) && !PageOwnedRenderCapability::isRenderable( $surface ) ) {
				throw new PublicationException( 'layers-content-not-renderable' );
			}
		}
		try {
			$this->sources->resolve( $content, $authority, $changed );
		} catch ( \DomainException $e ) {
			throw new PublicationException( 'layers-source-unavailable', 0, $e );
		}

		$action = ( $baseRevisionId === 0 || !$this->access->hasLayersSlot( $baseRevisionId ) ) ?
			PublicationAdmissionIntent::ACTION_ADD :
			PublicationAdmissionIntent::ACTION_REPLACE;

		$page = $this->pages->newFromTitle( $owner );
		if ( $main !== null ) {
			$this->assertPassesEditFilters( $page, $main, $summary, $authority );
		}
		if ( $expectedPageId !== null ) {
			// Source preparation can run callbacks or take long enough for a move.
			$this->assertOwnerIdentity( $owner, $expectedPageId );
		}
		$updater = $page->newPageUpdater( $authority );
		$updater->addTag( self::CHANGE_TAG );
		if ( $botTag !== null ) {
			$updater->addTag( $botTag );
			$updater->setFlags( EDIT_FORCE_BOT );
		}
		try {
			$revision = $this->writer->save( $updater, $baseRevisionId,
				$content, CommentStoreComment::newUnsavedComment( $summary ), $main,
				function ( PreparedUpdate $prepared, callable $commit ) use (
					$owner, $authority, $baseRevisionId, $action, $content, $main, $expectedPageId, $verifySources
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
					if ( $verifySources !== null ) {
						$verifySources();
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
	 * Apply the same filters EditPage runs (AbuseFilter, SpamBlacklist, ConfirmEdit, ...) to a main-text change.
	 * @param WikiPage $page
	 * @param WikitextContent $main
	 * @param string $summary
	 * @param Authority $authority
	 */
	private function assertPassesEditFilters( WikiPage $page, WikitextContent $main, string $summary,
		Authority $authority
	): void {
		if ( !$this->hooks || !$this->users ) {
			return;
		}
		$context = new DerivativeContext( RequestContext::getMain() );
		$context->setTitle( $page->getTitle() );
		$context->setWikiPage( $page );
		$context->setAuthority( $authority );
		$status = Status::newGood();
		$continue = $this->hooks->run( 'EditFilterMergedContent',
			[ $context, $main, $status, $summary, $this->users->newFromAuthority( $authority ), false ] );
		if ( !$continue || !$status->isOK() ) {
			throw new PublicationException( 'layers-edit-filtered' );
		}
	}

	/**
	 * Surfaces absent from, or different to, the base revision's stored snapshot.
	 * Unchanged surfaces were admitted when first published; rechecking them would lock
	 * a page whose older source file was later deleted.
	 * @param \stdClass[] $stored The base revision's drawings
	 * @param \stdClass $document Canonical proposed document
	 * @return string[]
	 */
	private static function changedSurfaceIds( array $stored, \stdClass $document ): array {
		$encoded = [];
		foreach ( $stored as $surface ) {
			$encoded[$surface->id] = JsonSnapshotCodec::encode( $surface );
		}
		$changed = [];
		foreach ( $document->surfaces as $surface ) {
			if ( ( $encoded[$surface->id] ?? null ) !== JsonSnapshotCodec::encode( $surface ) ) {
				$changed[] = $surface->id;
			}
		}
		return $changed;
	}

	/**
	 * A renamed layer set keeps its embeds on this page: they are rewritten in the same revision.
	 * @param Title $owner
	 * @param Authority $authority
	 * @param int $baseRevisionId
	 * @param array[] $renames Scoped instructions derived from the exact base
	 * @param WikitextContent|null $main Main text sent with the drawings, if any
	 * @return WikitextContent|null Main text to publish
	 */
	private function withRenamedEmbeds( Title $owner, Authority $authority, int $baseRevisionId, array $renames,
		?WikitextContent $main
	): ?WikitextContent {
		if ( !$renames ) {
			return $main;
		}
		// Non-wikitext owners cannot contain named embeds; retain their supported slot-only edits.
		if ( $main === null && $owner->getContentModel( IDBAccessObject::READ_LATEST ) !== CONTENT_MODEL_WIKITEXT ) {
			return null;
		}
		$text = $main ? $main->getText() : $this->access->getStoredMainText( $owner, $baseRevisionId, $authority );
		if ( $text === null ) {
			throw new PublicationException( 'layers-embedding-source-unavailable' );
		}
		try {
			$rewritten = ( new DirectEmbeddingRewriter() )->renameScopedReferences( $text,
				$owner->getArticleID( IDBAccessObject::READ_LATEST ), $renames,
				static function ( string $name ): ?string {
					$title = Title::newFromText( $name );
					return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() &&
						!$title->isExternal() ? 'File:' . $title->getDBkey() : null;
				}, MigrationState::isCompleteNow() );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-embedding-source-unavailable', 0, $e );
		}
		return $rewritten === $text ? $main : new WikitextContent( $rewritten );
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
