<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

class PagePdfEditorReadService {
	private PageHistoryAccess $access;
	private SourceVersionResolver $sources;
	private SourceRenditions $renditions;
	private NewPageDrawing $newSurface;
	private RevisionLookup $revisions;

	public function __construct( PageHistoryAccess $access, SourceVersionResolver $sources,
		SourceRenditions $renditions, NewPageDrawing $newSurface, RevisionLookup $revisions
	) {
		$this->access = $access;
		$this->sources = $sources;
		$this->renditions = $renditions;
		$this->newSurface = $newSurface;
		$this->revisions = $revisions;
	}

	/**
	 * @param Title $owner
	 * @param int $revisionId
	 * @param string $binding
	 * @param int $targetPage
	 * @param Authority $authority
	 * @return array
	 */
	public function read( Title $owner, int $revisionId, string $binding, int $targetPage,
		Authority $authority
	): array {
		try {
			if ( $revisionId < 1 || $revisionId > 2147483647 || $targetPage < 1 ||
				$targetPage > 2147483647 || $owner->isExternal() || $owner->hasFragment() ) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			$identity = PageOwnedBinding::parse( $binding );
			$this->assertCurrent( $owner, $revisionId, $identity['pageId'], $authority );
			$content = $this->access->read( $owner, $revisionId, $authority, $identity['pageId'] );
			$objects = json_decode( $content->getText(), false, 64, JSON_THROW_ON_ERROR )->surfaces;
			$surfaces = json_decode( $content->getText(), true, 64, JSON_THROW_ON_ERROR )['surfaces'];
			$anchors = array_values( array_filter( $objects,
				static fn ( \stdClass $surface ): bool => $surface->id === $identity['surfaceId'] ) );
			if ( count( $anchors ) !== 1 || $anchors[0]->kind !== 'pdf' ) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			$anchor = $anchors[0];
			$key = LayerSetIdentity::key( $anchor );
			$members = [];
			foreach ( $objects as $surface ) {
				if ( LayerSetIdentity::key( $surface ) !== $key ) {
					continue;
				}
				if ( $surface->kind !== 'pdf' || isset( $members[$surface->source->page] ) ||
					$surface->source->timestamp !== $anchor->source->timestamp ||
					$surface->source->sha1 !== $anchor->source->sha1 ) {
					throw new \DomainException( 'layers-editor-unavailable' );
				}
				$members[$surface->source->page] = $surface->id;
			}
			$ids = array_values( $members );
			$files = $this->sources->resolve( $content, $authority, $ids );
			$count = $this->pageCount( $files[$anchor->id] );
			if ( $targetPage > $count ) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			$stored = isset( $members[$targetPage] );
			$temporary = null;
			if ( $stored ) {
				$surface = array_values( array_filter( $surfaces,
					static fn ( array $candidate ): bool => $candidate['id'] === $members[$targetPage] ) )[0];
				$file = $files[$surface['id']];
				$geometry = $this->geometry( $file, $targetPage );
				$rendition = $this->renditions->forSurface( $file, $surface );
			} else {
				$pin = (array)$anchor->source;
				$prepared = $this->newSurface->prepare( $identity['pageId'], $revisionId,
					[ 'kind' => 'file', 'target' => $pin['fileTitle'], 'options' => [] ],
					$anchor->label, $authority, $targetPage, $pin );
				$surface = $prepared['surface'];
				$pin['page'] = $targetPage;
				if ( in_array( $surface['id'], array_column( $surfaces, 'id' ), true ) ||
					$surface['kind'] !== 'pdf' || $surface['label'] !== $anchor->label ||
					$surface['source'] != $pin || $surface['layers'] !== [] ) {
					throw new \DomainException( 'layers-editor-unavailable' );
				}
				$temporary = new LayersDocumentContent( json_encode( [ 'schemaVersion' => 1,
					'surfaces' => [ $surface ] ], JSON_THROW_ON_ERROR ) );
				if ( !$temporary->isValid() ) {
					throw new \DomainException( 'layers-editor-unavailable' );
				}
				$file = $this->sources->resolve( $temporary, $authority )[$surface['id']];
				$geometry = $this->geometry( $file, $targetPage );
				$rendition = $prepared['rendition'];
			}
			$this->assertCurrent( $owner, $revisionId, $identity['pageId'], $authority );
			$fresh = $this->access->read( $owner, $revisionId, $authority, $identity['pageId'] );
			if ( $fresh->getText() !== $content->getText() ) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			$freshFiles = $this->sources->resolve( $fresh, $authority, $ids );
			$targetFile = $stored ? $freshFiles[$surface['id']] :
				$this->sources->resolve( $temporary, $authority )[$surface['id']];
			if ( $this->pageCount( $freshFiles[$anchor->id] ) !== $count ||
				$this->pageCount( $targetFile ) !== $count ||
				$this->geometry( $targetFile, $targetPage ) !== $geometry
			) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			$this->assertCurrent( $owner, $revisionId, $identity['pageId'], $authority );
			if ( $this->access->read( $owner, $revisionId, $authority, $identity['pageId'] )->getText() !==
				$content->getText()
			) {
				throw new \DomainException( 'layers-editor-unavailable' );
			}
			ksort( $members, SORT_NUMERIC );
			$inventory = [];
			foreach ( $members as $page => $id ) {
				$inventory[] = [ 'page' => $page, 'surfaceId' => $id ];
			}
			return [ 'owner' => $owner->getPrefixedDBkey(), 'pageId' => $identity['pageId'],
				'revisionId' => $revisionId, 'binding' => $binding, 'kind' => 'pdf', 'label' => $anchor->label,
				'initialPage' => $anchor->source->page, 'pageCount' => $count, 'page' => $targetPage,
				'members' => $inventory, 'surface' => $surface, 'stored' => $stored,
				'sourceGeometry' => $geometry, 'rendition' => $rendition ];
		} catch ( \DomainException | \InvalidArgumentException | \JsonException $error ) {
			throw new \DomainException( 'layers-editor-unavailable', 0, $error );
		}
	}

	private function assertCurrent( Title $owner, int $revisionId, int $pageId, Authority $authority ): void {
		if ( !$authority->getUser()->isRegistered() ) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		$this->access->assertCanPrepareEdit( $owner, $authority );
		$current = $this->revisions->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
		if ( !$current || $current->getId() !== $revisionId || $current->getPageId() !== $pageId ||
			$owner->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
	}

	private function pageCount( File $file ): int {
		$count = $file->pageCount();
		if ( !is_int( $count ) || $count < 1 || $count > 2147483647 ) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		return $count;
	}

	private function geometry( File $file, int $page ): array {
		$width = $file->getWidth( $page );
		$height = $file->getHeight( $page );
		if ( !is_int( $width ) || !is_int( $height ) || $width < 1 || $height < 1 ) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		return [ 'page' => $page, 'width' => $width, 'height' => $height, 'units' => 'file-handler-pixels' ];
	}
}
