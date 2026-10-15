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

/** Inactive requested-page admission for a still-missing PDF layer set. Never authorizes Save. */
class PageMissingPdfEditorReadService {

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
	 * Read one requested empty page; never render or materialize all document pages.
	 * Original stored bytes remain separate from both the anchor and requested page.
	 *
	 * @param int $pageId Native owner identity
	 * @param int $revisionId Explicit current owner revision
	 * @param int $start Saved direct embedding's UTF-8 byte offset
	 * @param string $expected Complete saved embedding bytes
	 * @param int $targetPage Requested internal PDF page
	 * @param Authority $authority Original requesting authority
	 * @return array Native target, original base and requested-page context
	 */
	public function read( int $pageId, int $revisionId, int $start, string $expected,
		int $targetPage, Authority $authority
	): array {
		try {
			if ( $start < 0 || $expected === '' || !mb_check_encoding( $expected, 'UTF-8' ) ||
				$targetPage < 1 || $targetPage > DocumentSchema::MAX_SURFACES ) {
				throw new \DomainException();
			}
			$captured = $this->capture( $pageId, $revisionId, $start, $expected, $targetPage, $authority );
			$fresh = $this->capture( $pageId, $revisionId, $start, $expected, $targetPage, $authority );
			if ( $captured !== $fresh ||
				$this->owner( $pageId, $revisionId, $authority )->getPrefixedDBkey() !==
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
		int $targetPage, Authority $authority
	): array {
		$owner = $this->owner( $pageId, $revisionId, $authority );
		$revision = $this->revisions->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
		if ( !$revision || $revision->getPageId() !== $pageId ||
			!RevisionRecord::userCanBitfield( $revision->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $revision->getPage() ) ) {
			throw new \DomainException();
		}
		$main = $revision->getContent( 'main', RevisionRecord::RAW )->serialize();
		$hasSlot = $revision->hasSlot( PageRevisionWriter::SLOT );
		$baseText = $hasSlot ?
			$revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW )->serialize() : null;
		$base = $hasSlot ? $this->reader->read( $owner, $revisionId, $authority, $pageId, [] ) : null;
		$admitted = $this->pilot->prepareBoundEditor( $pageId, $revisionId, $start, $expected,
			$authority )['pageOwned'] ?? [];
		$anchor = $admitted['newSurface'] ?? null;
		if ( ( $admitted['pageId'] ?? null ) !== $pageId ||
			( $admitted['revisionId'] ?? null ) !== $revisionId ||
			( $admitted['owner'] ?? null ) !== $owner->getPrefixedDBkey() ||
			( $admitted['readOnly'] ?? null ) !== false || ( $admitted['emptyBase'] ?? null ) !== !$hasSlot ||
			!is_array( $anchor ) || ( $anchor['id'] ?? null ) !== ( $admitted['surfaceId'] ?? null ) ||
			( $anchor['kind'] ?? null ) !== 'pdf' || ( $anchor['layers'] ?? null ) !== [] ) {
			throw new \DomainException();
		}
		$pin = $anchor['source'];
		$stored = $base['snapshot']['surfaces'] ?? [];
		$key = LayerSetIdentity::key( json_decode( JsonSnapshotCodec::encode( $anchor ) ) );
		foreach ( $stored as $member ) {
			if ( $member['id'] === $anchor['id'] ||
				LayerSetIdentity::key( json_decode( JsonSnapshotCodec::encode( $member ) ) ) === $key ) {
				throw new \DomainException();
			}
		}
		$file = $this->sources->resolve( $this->document( $anchor ), $authority )[$anchor['id']];
		$count = $this->pageCount( $file );
		if ( $pin['page'] > $count || $targetPage > $count ||
			count( $stored ) + $count > DocumentSchema::MAX_SURFACES ) {
			throw new \DomainException();
		}
		$surface = $targetPage === $pin['page'] ? $anchor : $this->newSurface->prepare(
			$pageId, $revisionId, [ 'kind' => 'file', 'target' => $pin['fileTitle'], 'options' => [] ],
			$anchor['label'], $authority, $targetPage, $pin )['surface'];
		$source = array_replace( $pin, [ 'page' => $targetPage ] );
		if ( $surface['id'] !== NewPageDrawing::surfaceId( $pageId, $revisionId, $anchor['label'],
			$pin['fileTitle'], $targetPage ) || in_array( $surface['id'], array_column( $stored, 'id' ), true ) ||
			$surface['kind'] !== 'pdf' || $surface['label'] !== $anchor['label'] ||
			$surface['source'] !== $source || $surface['layers'] !== [] ) {
			throw new \DomainException();
		}
		$file = $this->sources->resolve( $this->document( $surface ), $authority )[$surface['id']];
		$geometry = $this->geometry( $file, $targetPage );
		$scale = min( 1, DocumentSchema::MAX_DIMENSION / max( $geometry['width'], $geometry['height'] ) );
		if ( $this->pageCount( $file ) !== $count ||
			$surface['canvas']['width'] !== max( 1, (int)round( $geometry['width'] * $scale ) ) ||
			$surface['canvas']['height'] !== max( 1, (int)round( $geometry['height'] * $scale ) ) ) {
			throw new \DomainException();
		}
		$rendition = $this->renditions->forSurface( $file, $surface );
		$fresh = $this->pilot->prepareBoundEditor( $pageId, $revisionId, $start, $expected, $authority );
		if ( ( $fresh['pageOwned'] ?? null ) !== $admitted ) {
			throw new \DomainException();
		}
		foreach ( [ $anchor, $surface ] as $member ) {
			$resolved = $this->sources->resolve( $this->document( $member ), $authority )[$member['id']];
			if ( $this->pageCount( $resolved ) !== $count ||
				( $member['id'] === $surface['id'] && $this->geometry( $resolved, $targetPage ) !== $geometry ) ) {
				throw new \DomainException();
			}
		}
		$this->owner( $pageId, $revisionId, $authority );
		return [ 'target' => [ 'pageId' => $pageId, 'owner' => $owner->getPrefixedDBkey(),
			'revisionId' => $revisionId, 'surfaceId' => $anchor['id'] ],
			'selection' => [ 'start' => $start, 'expected' => $expected ],
			'hasLayersSlot' => $hasSlot, 'mainText' => $main, 'baseText' => $baseText, 'baseBundle' => $base,
			'anchorSurface' => $anchor, 'context' => [ 'owner' => $owner->getPrefixedDBkey(), 'pageId' => $pageId,
				'revisionId' => $revisionId, 'binding' => 'v1:' . $pageId . ':' . $anchor['id'],
				'kind' => 'pdf', 'label' => $anchor['label'], 'initialPage' => $pin['page'], 'pageCount' => $count,
				'page' => $targetPage, 'members' => [], 'surface' => $surface, 'stored' => false,
				'sourceGeometry' => $geometry, 'rendition' => $rendition ] ];
	}

	private function document( array $surface ): LayersDocumentContent {
		return new LayersDocumentContent(
			JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ) );
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
