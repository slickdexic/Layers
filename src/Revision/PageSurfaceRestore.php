<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Restore one layer set, including every stored PDF page, while preserving the rest of its owner. */
final class PageSurfaceRestore {
	private PageOwnedScope $scope;
	private TitleFactory $titles;
	private RevisionLookup $revisions;
	private PagePublicationService $publisher;

	/**
	 * @param PageOwnedScope $scope
	 * @param TitleFactory $titles
	 * @param RevisionLookup $revisions
	 * @param PagePublicationService $publisher
	 */
	public function __construct( PageOwnedScope $scope, TitleFactory $titles,
		RevisionLookup $revisions, PagePublicationService $publisher
	) {
		$this->scope = $scope;
		$this->titles = $titles;
		$this->revisions = $revisions;
		$this->publisher = $publisher;
	}

	/**
	 * For an editor viewing an earlier version: what restoring it would replace.
	 * @param string $ownerText
	 * @param int $revisionId Earlier revision being viewed
	 * @param string $surfaceId
	 * @param Authority $authority
	 * @return array|null owner Title, drawing label and the current revision it would replace; null when
	 *  restoring is not allowed or would change nothing
	 */
	public function prepare( string $ownerText, int $revisionId, string $surfaceId, Authority $authority ): ?array {
		try {
			$owner = $this->owner( $ownerText );
			$current = $this->revisions->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
			if ( !$current ) {
				return null;
			}
			$plan = $this->plan( $owner, $revisionId, $surfaceId, $current->getId(), $authority );
			return [ 'owner' => $owner, 'label' => $plan['label'], 'baseRevisionId' => $current->getId() ];
		} catch ( \DomainException | \JsonException $e ) {
			return null;
		}
	}

	/**
	 * Publish the current snapshot with one layer set restored. No automatic retry.
	 * @param string $ownerText
	 * @param int $revisionId Earlier revision to copy the drawing from
	 * @param string $surfaceId
	 * @param int $baseRevisionId Current revision the editor saw
	 * @param Authority $authority
	 * @param string $summary
	 * @return int New revision ID
	 * @throws PublicationException
	 */
	public function restore( string $ownerText, int $revisionId, string $surfaceId, int $baseRevisionId,
		Authority $authority, string $summary
	): int {
		try {
			$owner = $this->owner( $ownerText );
			$plan = $this->plan( $owner, $revisionId, $surfaceId, $baseRevisionId, $authority );
		} catch ( \DomainException | \JsonException $e ) {
			throw new PublicationException( $e->getMessage() === 'layers-edit-conflict' ?
				'layers-edit-conflict' : 'layers-restore-unavailable' );
		}
		return $this->publisher->publish( $owner, $authority, $baseRevisionId, $plan['json'], $summary, null,
			$plan['pageId'] );
	}

	/**
	 * @param string $ownerText
	 * @return Title
	 */
	private function owner( string $ownerText ): Title {
		$owner = $this->titles->newFromText( $ownerText );
		if ( !$owner || !$owner->canExist() || $owner->hasFragment() ||
			!$this->scope->includes( $owner )
		) {
			throw new \DomainException( 'layers-restore-unavailable' );
		}
		return $owner;
	}

	/**
	 * @param Title $owner
	 * @param int $revisionId
	 * @param string $surfaceId
	 * @param int $baseRevisionId
	 * @param Authority $authority
	 * @return array json, label and pageId of the restored document
	 */
	private function plan( Title $owner, int $revisionId, string $surfaceId, int $baseRevisionId,
		Authority $authority
	): array {
		if ( $revisionId < 1 || $revisionId === $baseRevisionId || $surfaceId === '' ||
			$authority->getUser()->getId() <= 0
		) {
			throw new \DomainException( 'layers-restore-unavailable' );
		}
		$access = new PageHistoryAccess( $this->revisions );
		$access->assertCanPrepareEdit( $owner, $authority );
		$current = $this->revisions->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
		if ( !$current || $current->getId() !== $baseRevisionId ) {
			throw new \DomainException( 'layers-edit-conflict' );
		}
		$historical = self::decode( $access->read( $owner, $revisionId, $authority )->getText() );
		$restored = null;
		foreach ( $historical->surfaces as $surface ) {
			if ( $surface->id === $surfaceId ) {
				$restored = $surface;
			}
		}
		$document = self::decode( $access->read( $owner, $baseRevisionId, $authority )->getText() );
		if ( $restored && $restored->kind === 'pdf' ) {
			$document->surfaces = self::restorePdf( $document->surfaces, $historical->surfaces, $restored );
			return [ 'json' => JsonSnapshotCodec::encode( $document ),
				'label' => $restored->label, 'pageId' => $current->getPageId() ];
		}
		foreach ( $document->surfaces as $index => $surface ) {
			// Image and slide restoration retain their existing single-surface behaviour.
			if ( $restored && $surface->id === $surfaceId &&
				JsonSnapshotCodec::encode( $surface ) !== JsonSnapshotCodec::encode( $restored )
			) {
				$document->surfaces[$index] = $restored;
				return [ 'json' => JsonSnapshotCodec::encode( $document ),
					'label' => (string)( $restored->label ?? $surfaceId ), 'pageId' => $current->getPageId() ];
			}
		}
		throw new \DomainException( 'layers-restore-unavailable' );
	}

	/**
	 * Replace the exact historical PDF group; keep unrelated members and their relative order.
	 * @param \stdClass[] $current
	 * @param \stdClass[] $historical
	 * @param \stdClass $selected Historical member, including one now absent from the owner
	 * @return \stdClass[]
	 */
	private static function restorePdf( array $current, array $historical, \stdClass $selected ): array {
		$key = LayerSetIdentity::key( $selected );
		$wanted = self::pdfSet( $historical, $key );
		$existing = self::pdfSet( $current, $key );
		if ( JsonSnapshotCodec::encode( (object)$wanted ) === JsonSnapshotCodec::encode( (object)$existing ) ) {
			throw new \DomainException( 'layers-restore-unavailable' );
		}
		$result = [];
		$pending = $wanted;
		foreach ( $current as $surface ) {
			if ( isset( $existing[$surface->id] ) ) {
				if ( isset( $pending[$surface->id] ) ) {
					$result[] = $pending[$surface->id];
					unset( $pending[$surface->id] );
				}
			} else {
				// A historical ID retained by a renamed/different set must not rename or overwrite it.
				if ( isset( $wanted[$surface->id] ) ) {
					throw new \DomainException( 'layers-restore-unavailable' );
				}
				$result[] = $surface;
			}
		}
		return array_merge( $result, array_values( $pending ) );
	}

	/**
	 * Resolve one existing file/name identity without guessing across ambiguous legacy members.
	 * @param \stdClass[] $surfaces
	 * @param string $key
	 * @return \stdClass[] Members keyed by ID
	 */
	private static function pdfSet( array $surfaces, string $key ): array {
		$members = [];
		$pages = [];
		$label = null;
		foreach ( $surfaces as $surface ) {
			if ( LayerSetIdentity::key( $surface ) !== $key ) {
				continue;
			}
			if ( $surface->kind !== 'pdf' || isset( $pages[$surface->source->page] ) ||
				( $label !== null && $surface->label !== $label ) ) {
				throw new \DomainException( 'layers-restore-unavailable' );
			}
			$label = $surface->label;
			$pages[$surface->source->page] = true;
			$members[$surface->id] = $surface;
		}
		return $members;
	}

	/**
	 * @param string $text
	 * @return \stdClass
	 */
	private static function decode( string $text ): \stdClass {
		$document = json_decode( $text, false, 64, JSON_THROW_ON_ERROR );
		if ( !$document instanceof \stdClass || !isset( $document->surfaces ) || !is_array( $document->surfaces ) ) {
			throw new \DomainException( 'layers-restore-unavailable' );
		}
		return $document;
	}
}
