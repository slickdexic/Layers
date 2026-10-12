<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/** Inactive missing-target preparation. Neither a snapshot nor an admission grants write authority. */
class PageWorkingCopyImportCreationTarget {

	private PageOwnedPilot $pilot;
	private PageOwnedIdentityResolver $identities;
	private RevisionLookup $revisions;
	private PageReadService $reader;

	public function __construct( PageOwnedPilot $pilot, PageOwnedIdentityResolver $identities,
		RevisionLookup $revisions, PageReadService $reader
	) {
		$this->pilot = $pilot;
		$this->identities = $identities;
		$this->revisions = $revisions;
		$this->reader = $reader;
	}

	/**
	 * Prepare a still-missing image/slide member from the exact saved direct embedding.
	 * Existing targets use the existing read service. A new wiki page (base zero) is not supported.
	 * The unchanged stored base bundle, or explicit absent-slot null, stays separate from newSurface.
	 * Callers must freshly repeat admission before application/recovery/publication.
	 *
	 * @param int $pageId Existing native owning page
	 * @param int $baseRevisionId Explicit current native base
	 * @param string $surfaceId Expected internal ID, checked against native admission
	 * @param int $start UTF-8 byte offset of the saved embed
	 * @param string $expected Complete saved embed bytes
	 * @param Authority $authority Original requesting authority
	 * @return array target, selection, hasLayersSlot, baseBundle, newSurface
	 * @throws \DomainException Fixed unavailable refusal, without privileged diagnostics
	 */
	public function prepare( int $pageId, int $baseRevisionId, string $surfaceId, int $start,
		string $expected, Authority $authority
	): array {
		try {
			if ( !preg_match( '/^[A-Za-z0-9_.:-]{1,80}$/D', $surfaceId ) || $start < 0 ||
				$expected === '' || !mb_check_encoding( $expected, 'UTF-8' ) ) {
				throw new \DomainException();
			}
			$captured = $this->capture( $pageId, $baseRevisionId, $surfaceId, $start, $expected, $authority );
			$fresh = $this->capture( $pageId, $baseRevisionId, $surfaceId, $start, $expected, $authority );
			if ( $captured !== $fresh ) {
				throw new \DomainException();
			}
			$owner = $this->owner( $pageId, $baseRevisionId, $authority );
			if ( $owner->getPrefixedDBkey() !== $captured['target']['owner'] ) {
				throw new \DomainException();
			}
			return $captured;
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-working-copy-import-unavailable' );
		}
	}

	private function owner( int $pageId, int $baseRevisionId, Authority $authority ): Title {
		$owner = $this->identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		if ( !$this->pilot->getScope()->includes( $owner, IDBAccessObject::READ_LATEST ) ) {
			throw new \DomainException();
		}
		return $owner;
	}

	private function capture( int $pageId, int $baseRevisionId, string $surfaceId, int $start,
		string $expected, Authority $authority
	): array {
		$owner = $this->owner( $pageId, $baseRevisionId, $authority );
		$revision = $this->revisions->getRevisionById( $baseRevisionId, IDBAccessObject::READ_LATEST );
		if ( !$revision || $revision->getPageId() !== $pageId ||
			!RevisionRecord::userCanBitfield( $revision->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $revision->getPage() ) ) {
			throw new \DomainException();
		}
		$hasSlot = $revision->hasSlot( PageRevisionWriter::SLOT );
		$base = $hasSlot ? $this->reader->read( $owner, $baseRevisionId, $authority, $pageId, [] ) : null;
		$init = $this->pilot->prepareBoundEditor( $pageId, $baseRevisionId, $start, $expected, $authority );
		$admitted = $init['pageOwned'] ?? [];
		$surface = $admitted['newSurface'] ?? null;
		if ( ( $admitted['pageId'] ?? null ) !== $pageId ||
			( $admitted['revisionId'] ?? null ) !== $baseRevisionId ||
			( $admitted['owner'] ?? null ) !== $owner->getPrefixedDBkey() ||
			( $admitted['surfaceId'] ?? null ) !== $surfaceId ||
			( $admitted['readOnly'] ?? null ) !== false ||
			( $admitted['emptyBase'] ?? null ) !== !$hasSlot || !is_array( $surface ) ||
			( $surface['id'] ?? null ) !== $surfaceId ||
			!in_array( $surface['kind'] ?? null, [ 'image', 'slide' ], true ) ||
			( $surface['layers'] ?? null ) !== [] ||
			( $base !== null && ( ( $base['revisionId'] ?? null ) !== $baseRevisionId ||
				!is_array( $base['snapshot']['surfaces'] ?? null ) || array_filter( $base['snapshot']['surfaces'],
					static fn ( $member ) => ( $member['id'] ?? null ) === $surfaceId ) ) ) ) {
			throw new \DomainException();
		}
		return json_decode( json_encode( [
			'target' => [ 'pageId' => $pageId, 'owner' => $owner->getPrefixedDBkey(),
				'revisionId' => $baseRevisionId, 'surfaceId' => $surfaceId ],
			'selection' => [ 'start' => $start, 'expected' => $expected ],
			'hasLayersSlot' => $hasSlot,
			'baseBundle' => $base,
			'newSurface' => $surface
		], JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION ), true, 64, JSON_THROW_ON_ERROR );
	}
}
