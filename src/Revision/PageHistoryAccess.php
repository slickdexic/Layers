<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/** Internal owner/revision access boundary. Not registered as a public service. */
class PageHistoryAccess {

	/** @var RevisionLookup */
	private $revisionLookup;

	/** @param RevisionLookup $revisionLookup */
	public function __construct( RevisionLookup $revisionLookup ) {
		$this->revisionLookup = $revisionLookup;
	}

	/**
	 * Call immediately before publication, using the same authority and owner.
	 * Source access, request validation and conflict checks are separate gates.
	 *
	 * @param Title $owner
	 * @param Authority $authority
	 * @throws \DomainException On denied access
	 */
	public function assertCanEdit( Title $owner, Authority $authority ): void {
		$this->checkEdit( $owner, $authority, true );
	}

	/**
	 * Non-committing preflight; must be followed by assertCanEdit before writing.
	 * @param Title $owner
	 * @param Authority $authority
	 */
	public function assertCanPrepareEdit( Title $owner, Authority $authority ): void {
		$this->checkEdit( $owner, $authority, false );
	}

	/**
	 * @param Title $owner
	 * @param Authority $authority
	 * @param bool $authorize Use secure write authorization and count rate-limit hits
	 */
	private function checkEdit( Title $owner, Authority $authority, bool $authorize ): void {
		$read = $authorize ? 'authorizeRead' : 'definitelyCan';
		$write = $authorize ? 'authorizeWrite' : 'definitelyCan';
		if ( !$owner->canExist() || !$authority->$read( 'read', $owner ) ||
			!$authority->$write( 'editlayers', $owner ) || !$authority->$write( 'edit', $owner ) ) {
			throw new \DomainException( 'layers-owner-edit-denied' );
		}
		if ( !$owner->getArticleID( IDBAccessObject::READ_LATEST ) &&
			!$authority->$write( $owner->isTalkPage() ? 'createtalk' : 'createpage', $owner ) ) {
			throw new \DomainException( 'layers-owner-edit-denied' );
		}
	}

	/**
	 * Read only the requested owner's exact, visible snapshot. Never use latest.
	 * Return content rather than a raw record whose metadata may be hidden.
	 * Missing, foreign, hidden and unsupported snapshots share one failure code.
	 *
	 * @param Title $owner
	 * @param int $revisionId Explicit positive revision ID
	 * @param Authority $authority
	 * @param int|null $expectedPageId Binding identity, checked against the same owner used for revision access
	 * @return LayersDocumentContent
	 * @throws \DomainException If the snapshot is unavailable to this authority
	 */
	public function read( Title $owner, int $revisionId, Authority $authority,
		?int $expectedPageId = null
	): LayersDocumentContent {
		if ( $revisionId < 1 || !$owner->canExist() || !$authority->authorizeRead( 'read', $owner ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$ownerId = $owner->getArticleID( IDBAccessObject::READ_LATEST );
		if ( !$ownerId || ( $expectedPageId !== null && $ownerId !== $expectedPageId ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$revision = $this->revisionLookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
		if ( !$revision || $revision->getPageId() !== $ownerId || !$revision->hasSlot( PageRevisionWriter::SLOT ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		// Honor the stored bitfield even for inconsistent imported/current records.
		// Core's RevisionStoreRecord normally skips text visibility on current revisions.
		if ( !RevisionRecord::userCanBitfield( $revision->getVisibility(), RevisionRecord::DELETED_TEXT,
			$authority, $revision->getPage() ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$content = $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::FOR_THIS_USER, $authority );
		if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		return $content;
	}

	/**
	 * Stored surfaces of an owner's revision, for change detection only. Never returned to a client.
	 * Anything unavailable yields no surfaces, so every proposed surface is treated as changed.
	 *
	 * @param Title $owner
	 * @param int $revisionId
	 * @param Authority $authority
	 * @return \stdClass[]
	 */
	public function getStoredSurfaces( Title $owner, int $revisionId, Authority $authority ): array {
		if ( $revisionId <= 0 ) {
			return [];
		}
		$revision = $this->revisionLookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
		if ( !$revision || $revision->getPageId() !== $owner->getArticleID( IDBAccessObject::READ_LATEST ) ||
			!$revision->hasSlot( PageRevisionWriter::SLOT ) ) {
			return [];
		}
		$content = $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::FOR_THIS_USER, $authority );
		if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ) {
			return [];
		}
		return json_decode( $content->getText(), false, 64, JSON_THROW_ON_ERROR )->surfaces;
	}

	/**
	 * @param Title $owner
	 * @param int $revisionId
	 * @param Authority $authority
	 * @return string|null The revision's wikitext, if the owner's and visible
	 */
	public function getStoredMainText( Title $owner, int $revisionId, Authority $authority ): ?string {
		$revision = $revisionId > 0 ?
			$this->revisionLookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST ) : null;
		if ( !$revision || $revision->getPageId() !== $owner->getArticleID( IDBAccessObject::READ_LATEST ) ) {
			return null;
		}
		$content = $revision->getContent( SlotRecord::MAIN, RevisionRecord::FOR_THIS_USER, $authority );
		return $content instanceof WikitextContent ? $content->getText() : null;
	}

	/**
	 * Check whether a specific revision already has a Layers slot.
	 *
	 * @param int $revisionId
	 * @return bool
	 */
	public function hasLayersSlot( int $revisionId ): bool {
		if ( $revisionId <= 0 ) {
			return false;
		}
		$revision = $this->revisionLookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
		return $revision !== null && $revision->hasSlot( PageRevisionWriter::SLOT );
	}
}
