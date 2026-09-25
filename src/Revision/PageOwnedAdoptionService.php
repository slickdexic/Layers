<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject;

/** Internal atomic append of a server-prepared adoption. Not a request boundary. */
class PageOwnedAdoptionService {
	private PageOwnedIdentityResolver $identities;
	private RevisionLookup $revisions;
	private PagePublicationService $publisher;

	/**
	 * @param PageOwnedIdentityResolver $identities
	 * @param RevisionLookup $revisions
	 * @param PagePublicationService $publisher
	 */
	public function __construct( PageOwnedIdentityResolver $identities, RevisionLookup $revisions,
		PagePublicationService $publisher
	) {
		$this->identities = $identities;
		$this->revisions = $revisions;
		$this->publisher = $publisher;
	}

	/**
	 * Append exactly one prepared surface without accepting the other surfaces from a caller.
	 * The trusted caller MUST resolve the immutable legacy selection, check renderability,
	 * generate its ID and prepare an exact syntax-aware binding edit against this base.
	 * Never pass raw client-provided main text here as proof of a valid binding.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param Authority $authority Original actor
	 * @param string $singleSurfaceDocument Version-one document with exactly one surface
	 * @param WikitextContent $boundMain Trusted prepared main-slot binding edit
	 * @param string $summary
	 * @return int New native owner revision ID
	 * @throws PublicationException Fixed failure, with no automatic retry
	 */
	public function publishPreparedSurface( int $pageId, int $baseRevisionId, Authority $authority,
		string $singleSurfaceDocument, WikitextContent $boundMain, string $summary
	): int {
		try {
			$owner = $this->identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() );
		}
		$base = $this->revisions->getRevisionById( $baseRevisionId, IDBAccessObject::READ_LATEST );
		if ( !$base || $base->getPageId() !== $pageId ||
			!RevisionRecord::userCanBitfield( $base->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $base->getPage() ) ) {
			throw new PublicationException( 'layers-owner-unavailable' );
		}
		$main = $base->getContent( SlotRecord::MAIN, RevisionRecord::FOR_THIS_USER, $authority );
		if ( !$main instanceof WikitextContent ) {
			throw new PublicationException( 'layers-main-model-change-denied' );
		}
		$schema = new DocumentSchema();
		try {
			$addition = json_decode( $schema->canonicalize( $singleSurfaceDocument ) );
			if ( count( $addition->surfaces ) !== 1 ) {
				throw new \InvalidArgumentException();
			}
			$snapshot = (object)[ 'schemaVersion' => 1, 'surfaces' => [] ];
			if ( $base->hasSlot( PageRevisionWriter::SLOT ) ) {
				$stored = $base->getContent( PageRevisionWriter::SLOT, RevisionRecord::FOR_THIS_USER, $authority );
				if ( !$stored instanceof LayersDocumentContent ) {
					throw new PublicationException( 'layers-revision-unavailable' );
				}
				$snapshot = json_decode( $stored->getCanonicalText() );
			}
			$surface = $addition->surfaces[0];
			foreach ( $snapshot->surfaces as $existing ) {
				if ( $existing->id === $surface->id ) {
					throw new PublicationException( 'layers-surface-already-bound' );
				}
			}
			$snapshot->surfaces[] = $surface;
			$json = $schema->canonicalize( JsonSnapshotCodec::encode( $snapshot ) );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-invalid-snapshot' );
		}
		return $this->publisher->publish( $owner, $authority, $baseRevisionId, $json,
			$summary, $boundMain, $pageId );
	}
}
