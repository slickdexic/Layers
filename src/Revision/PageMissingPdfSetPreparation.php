<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/** Inactive, read-only preparation of one missing PDF layer set. Never a publication token. */
class PageMissingPdfSetPreparation {

	public function __construct(
		private PageOwnedPilot $pilot,
		private PageOwnedIdentityResolver $identities,
		private RevisionLookup $revisions,
		private PageReadService $reader,
		private SourceVersionResolver $sources,
		private NewPageDrawing $newSurface,
		private SourceRenditions $renditions
	) {
	}

	/**
	 * Prepare all empty internal pages without adding them to the stored base.
	 * Existing sets, including sparse sets, use the existing PDF reader instead.
	 * A future caller must repeat admission before editor application and Save.
	 *
	 * @param int $pageId Existing native owner
	 * @param int $revisionId Explicit current base
	 * @param int $start UTF-8 byte offset of the saved direct embedding
	 * @param string $expected Complete saved embedding bytes
	 * @param Authority $authority Original requesting authority
	 * @return array Native target, unchanged base, source pin and ordered empty pages
	 * @throws \DomainException Fixed unavailable result without privileged diagnostics
	 */
	public function prepare( int $pageId, int $revisionId, int $start, string $expected,
		Authority $authority
	): array {
		try {
			if ( $start < 0 || $expected === '' || !mb_check_encoding( $expected, 'UTF-8' ) ) {
				throw new \DomainException();
			}
			$captured = $this->capture( $pageId, $revisionId, $start, $expected, $authority );
			$fresh = $this->capture( $pageId, $revisionId, $start, $expected, $authority );
			if ( $captured !== $fresh ) {
				throw new \DomainException();
			}
			if ( $this->owner( $pageId, $revisionId, $authority )->getPrefixedDBkey() !==
				$captured['target']['owner'] ) {
				throw new \DomainException();
			}
			return $captured;
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
	}

	private function owner( int $pageId, int $revisionId, Authority $authority ): Title {
		$owner = $this->identities->resolveForEdit( $pageId, $revisionId, $authority );
		if ( !$this->pilot->getScope()->includes( $owner, IDBAccessObject::READ_LATEST ) ) {
			throw new \DomainException();
		}
		return $owner;
	}

	private function capture( int $pageId, int $revisionId, int $start, string $expected,
		Authority $authority
	): array {
		$owner = $this->owner( $pageId, $revisionId, $authority );
		$revision = $this->revisions->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
		if ( !$revision || $revision->getPageId() !== $pageId ||
			!RevisionRecord::userCanBitfield( $revision->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $revision->getPage() ) ) {
			throw new \DomainException();
		}
		$mainText = $revision->getContent( 'main', RevisionRecord::RAW )->serialize();
		$hasSlot = $revision->hasSlot( PageRevisionWriter::SLOT );
		$baseText = $hasSlot ?
			$revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW )->serialize() : null;
		$base = $hasSlot ? $this->reader->read( $owner, $revisionId, $authority, $pageId, [] ) : null;
		$init = $this->pilot->prepareBoundEditor( $pageId, $revisionId, $start, $expected, $authority );
		$admitted = $init['pageOwned'] ?? [];
		$selected = $admitted['newSurface'] ?? null;
		if ( ( $admitted['pageId'] ?? null ) !== $pageId ||
			( $admitted['revisionId'] ?? null ) !== $revisionId ||
			( $admitted['owner'] ?? null ) !== $owner->getPrefixedDBkey() ||
			( $admitted['readOnly'] ?? null ) !== false ||
			( $admitted['emptyBase'] ?? null ) !== !$hasSlot || !is_array( $selected ) ||
			( $selected['id'] ?? null ) !== ( $admitted['surfaceId'] ?? null ) ||
			( $selected['kind'] ?? null ) !== 'pdf' || ( $selected['layers'] ?? null ) !== [] ) {
			throw new \DomainException();
		}
		$pin = $selected['source'];
		$initialPage = $pin['page'];
		$key = LayerSetIdentity::key( json_decode( JsonSnapshotCodec::encode( $selected ) ) );
		$stored = $base['snapshot']['surfaces'] ?? [];
		foreach ( $stored as $member ) {
			if ( $member['id'] === $selected['id'] ||
				LayerSetIdentity::key( json_decode( JsonSnapshotCodec::encode( $member ) ) ) === $key ) {
				throw new \DomainException();
			}
		}
		$content = $this->document( [ $selected ] );
		$file = $this->sources->resolve( $content, $authority )[$selected['id']];
		$count = $this->pageCount( $file );
		if ( $initialPage > $count || count( $stored ) + $count > DocumentSchema::MAX_SURFACES ) {
			throw new \DomainException();
		}
		$pages = [];
		$ids = array_column( $stored, 'id' );
		for ( $page = 1; $page <= $count; $page++ ) {
			$prepared = $page === $initialPage ? [ 'surface' => $selected ] : $this->newSurface->prepare(
				$pageId, $revisionId, [ 'kind' => 'file', 'target' => $pin['fileTitle'], 'options' => [] ],
				$selected['label'], $authority, $page, $pin );
			$surface = $prepared['surface'];
			$source = array_replace( $pin, [ 'page' => $page ] );
			if ( $surface['id'] !== NewPageDrawing::surfaceId( $pageId, $revisionId, $selected['label'],
				$pin['fileTitle'], $page ) || in_array( $surface['id'], $ids, true ) ||
				$surface['kind'] !== 'pdf' || $surface['label'] !== $selected['label'] ||
				$surface['source'] !== $source || $surface['layers'] !== [] ) {
				throw new \DomainException();
			}
			$ids[] = $surface['id'];
			$resolved = $this->sources->resolve( $this->document( [ $surface ] ), $authority )[$surface['id']];
			if ( $this->pageCount( $resolved ) !== $count ) {
				throw new \DomainException();
			}
			$geometry = $this->geometry( $resolved, $page );
			$scale = min( 1, DocumentSchema::MAX_DIMENSION / max( $geometry['width'], $geometry['height'] ) );
			if ( $surface['canvas']['width'] !== max( 1, (int)round( $geometry['width'] * $scale ) ) ||
				$surface['canvas']['height'] !== max( 1, (int)round( $geometry['height'] * $scale ) ) ) {
				throw new \DomainException();
			}
			$pages[] = [ 'page' => $page, 'surface' => $surface, 'sourceGeometry' => $geometry,
				'rendition' => $this->renditions->forSurface( $resolved, $surface ) ];
		}
		// No fallback to a partial result, another stored page or a newer source.
		$fresh = $this->pilot->prepareBoundEditor( $pageId, $revisionId, $start, $expected, $authority );
		if ( ( $fresh['pageOwned'] ?? null ) !== $admitted ) {
			throw new \DomainException();
		}
		$files = $this->sources->resolve( $this->document( array_column( $pages, 'surface' ) ), $authority );
		foreach ( $pages as $entry ) {
			$resolved = $files[$entry['surface']['id']];
			if ( $this->pageCount( $resolved ) !== $count ||
				$this->geometry( $resolved, $entry['page'] ) !== $entry['sourceGeometry'] ) {
				throw new \DomainException();
			}
		}
		$this->owner( $pageId, $revisionId, $authority );
		return [ 'target' => [ 'pageId' => $pageId, 'owner' => $owner->getPrefixedDBkey(),
			'revisionId' => $revisionId, 'surfaceId' => $selected['id'] ],
			'selection' => [ 'start' => $start, 'expected' => $expected ],
			'hasLayersSlot' => $hasSlot, 'mainText' => $mainText, 'baseText' => $baseText, 'baseBundle' => $base,
			'label' => $selected['label'], 'initialPage' => $initialPage, 'pageCount' => $count,
			'source' => array_diff_key( $pin, [ 'page' => true ] ), 'pages' => $pages ];
	}

	private function document( array $surfaces ): LayersDocumentContent {
		return new LayersDocumentContent(
			JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) );
	}

	private function pageCount( File $file ): int {
		$count = $file->pageCount();
		if ( !is_int( $count ) || $count < 1 || $count > DocumentSchema::MAX_SURFACES ) {
			throw new \DomainException();
		}
		return $count;
	}

	private function geometry( File $file, int $page ): array {
		$width = $file->getWidth( $page );
		$height = $file->getHeight( $page );
		if ( !is_int( $width ) || !is_int( $height ) || $width < 1 || $height < 1 ) {
			throw new \DomainException();
		}
		return [ 'page' => $page, 'width' => $width, 'height' => $height, 'units' => 'file-handler-pixels' ];
	}
}
