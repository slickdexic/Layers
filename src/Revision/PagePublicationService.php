<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Page\WikiPageFactory;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/** Internal orchestration only: no service registration or request endpoint. */
class PagePublicationService {
	private WikiPageFactory $pages;
	private PageHistoryAccess $access;
	private SourceVersionResolver $sources;
	private PageRevisionWriter $writer;

	/**
	 * @param WikiPageFactory $pages
	 * @param PageHistoryAccess $access
	 * @param SourceVersionResolver $sources
	 * @param PageRevisionWriter $writer
	 */
	public function __construct( WikiPageFactory $pages, PageHistoryAccess $access,
		SourceVersionResolver $sources, PageRevisionWriter $writer
	) {
		$this->pages = $pages;
		$this->access = $access;
		$this->sources = $sources;
		$this->writer = $writer;
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
	 * @return int Committed revision ID, or unchanged ID for a successful no-op
	 * @throws PublicationException With a stable internal error code
	 */
	public function publish( Title $owner, Authority $authority, int $baseRevisionId,
		string $json, string $summary, ?WikitextContent $main = null
	): int {
		try {
			$this->access->assertCanPrepareEdit( $owner, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( 'layers-owner-edit-denied', 0, $e );
		}
		if ( $baseRevisionId < 0 || ( $baseRevisionId === 0 && $main === null ) ) {
			throw new PublicationException( 'layers-invalid-publication-request' );
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
		try {
			$this->access->assertCanEdit( $owner, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( 'layers-owner-edit-denied', 0, $e );
		}
		$page = $this->pages->newFromTitle( $owner );
		try {
			$revision = $this->writer->save( $page->newPageUpdater( $authority ), $baseRevisionId,
				$content, CommentStoreComment::newUnsavedComment( $summary ), $main );
		} catch ( \DomainException $e ) {
			throw new PublicationException( 'layers-edit-conflict', 0, $e );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-invalid-publication-request', 0, $e );
		} catch ( \RuntimeException $e ) {
			throw new PublicationException( 'layers-revision-save-failed', 0, $e );
		}
		return $revision->getId();
	}
}
