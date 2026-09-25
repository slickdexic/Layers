<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Permissions\Authority;

/** Internal preparation only; source-span and rendering gates precede publication. */
class LegacyAdoptionPreparationService {
	private PageOwnedIdentityResolver $identities;
	private LayersDatabase $legacy;
	private LegacyMediaResolver $media;
	private LegacySurfaceConverter $converter;

	/**
	 * @param PageOwnedIdentityResolver $identities
	 * @param LayersDatabase $legacy
	 * @param LegacyMediaResolver $media
	 * @param LegacySurfaceConverter $converter
	 */
	public function __construct( PageOwnedIdentityResolver $identities, LayersDatabase $legacy,
		LegacyMediaResolver $media, LegacySurfaceConverter $converter
	) {
		$this->identities = $identities;
		$this->legacy = $legacy;
		$this->media = $media;
		$this->converter = $converter;
	}

	/**
	 * Capture one authorized exact drawing, never latest and never a client snapshot.
	 * No publication, binding rewrite or authority token is produced by this method.
	 * Repeated calls allocate independent proposals; callers must not auto-retry adoption.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param int $legacyRevisionId Exact ls_id, not the per-set revision counter
	 * @param string|null $fileTimestamp Exact selected upload timestamp; null for slides
	 * @param Authority $authority Original requesting actor
	 * @return array Server-prepared proposal, not trusted if round-tripped through a client
	 * @throws PublicationException Fixed errors
	 */
	public function prepare( int $pageId, int $baseRevisionId, int $legacyRevisionId,
		?string $fileTimestamp, Authority $authority
	): array {
		try {
			$this->identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() );
		}
		if ( $legacyRevisionId < 1 ) {
			throw new PublicationException( 'layers-legacy-revision-unavailable' );
		}
		$record = $this->legacy->getLayerSetForAdoption( $legacyRevisionId );
		if ( !$record || ( $record['id'] ?? null ) !== $legacyRevisionId ) {
			throw new PublicationException( 'layers-legacy-revision-unavailable' );
		}
		$geometry = null;
		if ( ( $record['mime'] ?? null ) === 'application/x-layers-slide' ) {
			if ( $fileTimestamp !== null ) {
				throw new PublicationException( 'layers-source-unavailable' );
			}
		} else {
			if ( $fileTimestamp === null ) {
				throw new PublicationException( 'layers-source-unavailable' );
			}
			try {
				$geometry = $this->media->resolve( $record, $fileTimestamp, $authority );
			} catch ( \DomainException $e ) {
				throw new PublicationException( 'layers-source-unavailable' );
			}
		}
		$surfaceId = 'surface_' . bin2hex( random_bytes( 16 ) );
		try {
			$document = $this->converter->convert( $record, $surfaceId, $geometry );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-legacy-conversion-unavailable' );
		}
		// Recheck after storage/media callbacks and potentially slow file access.
		try {
			$this->identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() );
		}
		return [
			'pageId' => $pageId, 'baseRevisionId' => $baseRevisionId, 'legacyRevisionId' => $legacyRevisionId,
			'legacySelection' => [
				'imgName' => $record['imgName'], 'name' => $record['name'], 'page' => $record['page']
			],
			'surfaceId' => $surfaceId, 'binding' => 'v1:' . $pageId . ':' . $surfaceId,
			'document' => $document
		];
	}
}
