<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Detached native PDF Import preparation. Unregistered; never applies layers or publishes. */
class PageWorkingCopyPdfImportReadService {

	public function __construct(
		private PageOwnedIdentityResolver $identities,
		private TitleFactory $titles,
		private PageOwnedScope $scope,
		private PageHistoryAccess $access,
		private SourceVersionResolver $sources,
		private SourceRenditions $renditions,
		private NewPageDrawing $newSurface
	) {
	}

	/**
	 * Prepare complete groups for the detached whole-PDF planner, not against live editor layers.
	 * Snapshots retain JSON objects, arrays and unknown readable metadata. Internal page numbers
	 * identify members of one owner/file/name group. The result conveys no durable authorization.
	 *
	 * @param int $targetPageId
	 * @param int $targetBaseRevisionId Current editable target revision
	 * @param string $targetSurfaceId Stored target group anchor
	 * @param int $sourcePageId Different readable owner
	 * @param int $sourceRevisionId Exact readable source revision, including history
	 * @param string $sourceSurfaceId Stored source group anchor
	 * @param Authority $authority Original requesting authority
	 * @return array Detached descriptors, complete bundles, groups and empty target admissions
	 */
	public function read( int $targetPageId, int $targetBaseRevisionId, string $targetSurfaceId,
		int $sourcePageId, int $sourceRevisionId, string $sourceSurfaceId, Authority $authority
	): array {
		try {
			foreach ( [ $targetPageId, $targetBaseRevisionId, $sourcePageId, $sourceRevisionId ] as $id ) {
				if ( $id < 1 || $id > 2147483647 ) {
					throw new \DomainException();
				}
			}
			if ( $targetPageId === $sourcePageId || $targetSurfaceId === '' || $sourceSurfaceId === '' ) {
				throw new \DomainException();
			}
			$target = $this->identities->resolveForEdit( $targetPageId, $targetBaseRevisionId, $authority );
			$this->assertOwner( $target, $targetPageId );
			$source = $this->sourceOwner( $sourcePageId );
			$targetGroup = $this->group( $target, $targetPageId, $targetBaseRevisionId,
				$targetSurfaceId, $authority, true );
			$sourceGroup = $this->group( $source, $sourcePageId, $sourceRevisionId,
				$sourceSurfaceId, $authority, true );
			if ( $targetGroup['key'] !== $sourceGroup['key'] ) {
				throw new \DomainException();
			}
			// Refuse the complete request before preparing any member outside the target version.
			foreach ( array_keys( $sourceGroup['members'] ) as $page ) {
				if ( $page > $targetGroup['pageCount'] ) {
					throw new \DomainException();
				}
			}
			$admissions = [];
			$admittedGeometry = [];
			$admittedRenditions = [];
			$usedIds = array_column( $targetGroup['snapshot']->surfaces, 'id' );
			foreach ( $sourceGroup['members'] as $page => $sourceId ) {
				if ( isset( $targetGroup['members'][$page] ) ) {
					continue;
				}
				$pin = $targetGroup['pin'];
				$prepared = $this->newSurface->prepare( $targetPageId, $targetBaseRevisionId,
					[ 'kind' => 'file', 'target' => $pin['fileTitle'], 'options' => [] ],
					$targetGroup['label'], $authority, $page, $pin );
				$surface = $prepared['surface'];
				$expected = $pin + [ 'page' => $page ];
				if ( !is_string( $surface['id'] ?? null ) || $surface['id'] === '' ||
					in_array( $surface['id'], $usedIds, true ) || ( $surface['kind'] ?? null ) !== 'pdf' ||
					( $surface['label'] ?? null ) !== $targetGroup['label'] ||
					JsonSnapshotCodec::encode( $surface['source'] ?? null ) !==
						JsonSnapshotCodec::encode( $expected ) || ( $surface['layers'] ?? null ) !== [] ) {
					throw new \DomainException();
				}
				$geometry = $this->admissionGeometry( $surface, $targetGroup['pageCount'], $authority );
				if ( !is_array( $prepared['rendition'] ?? null ) ) {
					throw new \DomainException();
				}
				$usedIds[] = $surface['id'];
				$admissions[] = $surface;
				$admittedGeometry[$surface['id']] = $geometry;
				$admittedRenditions[$surface['id']] = $prepared['rendition'];
			}
			// Native rendition preparation may call hooks. Recheck both complete groups afterward.
			$freshTarget = $this->identities->resolveForEdit( $targetPageId, $targetBaseRevisionId, $authority );
			$this->assertSameOwner( $freshTarget, $target, $targetPageId );
			$freshSource = $this->sourceOwner( $sourcePageId );
			$this->assertSameOwner( $freshSource, $source, $sourcePageId );
			foreach ( [
				[ $freshTarget, $targetPageId, $targetBaseRevisionId, $targetSurfaceId, $targetGroup ],
				[ $freshSource, $sourcePageId, $sourceRevisionId, $sourceSurfaceId, $sourceGroup ]
			] as [ $owner, $pageId, $revisionId, $anchor, $earlier ] ) {
				$fresh = $this->group( $owner, $pageId, $revisionId, $anchor, $authority, false );
				foreach ( [ 'text', 'members', 'pin', 'pageCount', 'geometry', 'addresses' ] as $key ) {
					if ( $fresh[$key] !== $earlier[$key] ) {
						throw new \DomainException();
					}
				}
			}
			foreach ( $admissions as $surface ) {
				if ( $this->admissionGeometry( $surface, $targetGroup['pageCount'], $authority ) !==
					$admittedGeometry[$surface['id']] ) {
					throw new \DomainException();
				}
			}
			$lastTarget = $this->identities->resolveForEdit( $targetPageId, $targetBaseRevisionId, $authority );
			$this->assertSameOwner( $lastTarget, $target, $targetPageId );
			$lastSource = $this->sourceOwner( $sourcePageId );
			$this->assertSameOwner( $lastSource, $source, $sourcePageId );
			if ( $this->access->read( $lastTarget, $targetBaseRevisionId, $authority, $targetPageId )->getText() !==
				$targetGroup['text'] ||
				$this->access->read( $lastSource, $sourceRevisionId, $authority, $sourcePageId )->getText() !==
				$sourceGroup['text'] ) {
				throw new \DomainException();
			}
			return [
				'target' => $this->descriptor( $lastTarget, $targetPageId, $targetBaseRevisionId, $targetSurfaceId ),
				'source' => $this->descriptor( $lastSource, $sourcePageId, $sourceRevisionId, $sourceSurfaceId ),
				'targetBundle' => $this->bundle( $targetGroup, $targetBaseRevisionId ),
				'sourceBundle' => $this->bundle( $sourceGroup, $sourceRevisionId ),
				'targetGroup' => $this->inventory( $targetGroup ),
				'sourceGroup' => $this->inventory( $sourceGroup ),
				'admittedTargetSurfaces' => $admissions,
				'admittedTargetGeometry' => $admittedGeometry,
				'admittedTargetRenditions' => $admittedRenditions
			];
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-working-copy-import-unavailable' );
		}
	}

	private function group( Title $owner, int $pageId, int $revisionId, string $anchorId,
		Authority $authority, bool $render
	): array {
		$content = $this->access->read( $owner, $revisionId, $authority, $pageId );
		$snapshot = json_decode( $content->getText(), false, 64, JSON_THROW_ON_ERROR );
		$anchors = array_values( array_filter( $snapshot->surfaces,
			static fn ( $surface ): bool => $surface->id === $anchorId ) );
		if ( count( $anchors ) !== 1 || $anchors[0]->kind !== 'pdf' ) {
			throw new \DomainException();
		}
		$anchor = $anchors[0];
		$key = LayerSetIdentity::key( $anchor );
		$pin = (array)$anchor->source;
		unset( $pin['page'] );
		$members = [];
		$selected = [];
		foreach ( $snapshot->surfaces as $surface ) {
			if ( LayerSetIdentity::key( $surface ) !== $key ) {
				continue;
			}
			$candidatePin = (array)$surface->source;
			unset( $candidatePin['page'] );
			if ( $surface->kind !== 'pdf' || $surface->label !== $anchor->label ||
				isset( $members[$surface->source->page] ) ||
				JsonSnapshotCodec::encode( $candidatePin ) !== JsonSnapshotCodec::encode( $pin ) ) {
				throw new \DomainException();
			}
			$members[$surface->source->page] = $surface->id;
			$selected[$surface->id] = $surface;
		}
		ksort( $members, SORT_NUMERIC );
		$files = $this->sources->resolve( $content, $authority, array_values( $members ) );
		$count = $this->count( $files[$anchorId] );
		$geometry = [];
		$renditions = [];
		$addresses = [];
		foreach ( $members as $page => $id ) {
			if ( $this->count( $files[$id] ) !== $count || $page > $count ) {
				throw new \DomainException();
			}
			$geometry[$id] = $this->geometry( $files[$id], $page );
			$addresses[$id] = $files[$id]->getUrl();
			if ( !is_string( $addresses[$id] ) || $addresses[$id] === '' ) {
				throw new \DomainException();
			}
		}
		if ( $render ) {
			foreach ( $members as $id ) {
				$renderSurface = json_decode( json_encode( $selected[$id], JSON_THROW_ON_ERROR ),
					true, 64, JSON_THROW_ON_ERROR );
				$renditions[$id] = $this->renditions->forSurface( $files[$id], $renderSurface );
			}
		}
		return [ 'text' => $content->getText(), 'snapshot' => $snapshot, 'key' => $key,
			'label' => $anchor->label, 'pin' => $pin, 'members' => $members, 'pageCount' => $count,
			'geometry' => $geometry, 'renditions' => $renditions, 'addresses' => $addresses ];
	}

	private function admissionGeometry( array $surface, int $count, Authority $authority ): array {
		$content = new LayersDocumentContent( json_encode( [ 'schemaVersion' => 1,
			'surfaces' => [ $surface ] ], JSON_THROW_ON_ERROR ) );
		if ( !$content->isValid() ) {
			throw new \DomainException();
		}
		$file = $this->sources->resolve( $content, $authority )[$surface['id']];
		if ( $this->count( $file ) !== $count ) {
			throw new \DomainException();
		}
		return $this->geometry( $file, $surface['source']['page'] );
	}

	private function count( File $file ): int {
		$count = $file->pageCount();
		if ( $file->getMimeType() !== 'application/pdf' || !is_int( $count ) ||
			$count < 1 || $count > 2147483647 ) {
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

	private function assertOwner( Title $owner, int $pageId ): void {
		if ( !$owner->canExist() || $owner->isExternal() || $owner->hasFragment() ||
			$owner->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ||
			!$this->scope->includes( $owner, IDBAccessObject::READ_LATEST ) ) {
			throw new \DomainException();
		}
	}

	private function assertSameOwner( Title $fresh, Title $original, int $pageId ): void {
		$this->assertOwner( $fresh, $pageId );
		if ( $fresh->getPrefixedDBkey() !== $original->getPrefixedDBkey() ) {
			throw new \DomainException();
		}
	}

	private function sourceOwner( int $pageId ): Title {
		$owner = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$owner ) {
			throw new \DomainException();
		}
		$this->assertOwner( $owner, $pageId );
		return $owner;
	}

	private function descriptor( Title $owner, int $pageId, int $revisionId, string $surfaceId ): array {
		return [ 'pageId' => $pageId, 'owner' => $owner->getPrefixedDBkey(),
			'revisionId' => $revisionId, 'surfaceId' => $surfaceId ];
	}

	private function bundle( array $group, int $revisionId ): array {
		return [ 'revisionId' => $revisionId, 'snapshot' => $group['snapshot'],
			'sourceGeometry' => $group['geometry'], 'sourceRenditions' => $group['renditions'] ];
	}

	private function inventory( array $group ): array {
		$members = [];
		foreach ( $group['members'] as $page => $id ) {
			$members[] = [ 'page' => $page, 'surfaceId' => $id ];
		}
		return [ 'label' => $group['label'], 'source' => $group['pin'],
			'pageCount' => $group['pageCount'], 'members' => $members ];
	}
}
