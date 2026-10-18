<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\CommentStore\CommentStore;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;

/** Unregistered whole-PDF first-Save boundary. Client descriptors grant no authority. */
class PageWorkingCopyPdfImportPublicationService {

	public function __construct(
		private PageWorkingCopyPdfImportReadService $reader,
		private PagePublicationService $publisher,
		private TitleFactory $titles,
		private IConnectionProvider $db,
		private PageHistoryAccess $access,
		private SourceVersionResolver $sources,
		private PageOwnedScope $scope
	) {
	}

	/**
	 * Publish a complete working copy with one native citation per imported source layer set.
	 * Existing image/slide APIs, editor callers and Save behavior are not extended here.
	 *
	 * @param int $pageId Existing target owner
	 * @param int $baseRevisionId Current target revision
	 * @param string $json Complete proposed document; the ordinary publisher validates every field
	 * @param array[] $sources Exact targetSurfaceId/sourcePageId/sourceRevisionId/sourceSurfaceId records
	 * @param Authority $authority Original requesting authority
	 * @param string $note Optional owner note, never truncated to accommodate a citation
	 * @param array[] $admissionRevisions Optional surfaceId/revisionId records for older temporary IDs
	 * @return int Target revision ID; no retry or source-owner write
	 */
	public function publish( int $pageId, int $baseRevisionId, string $json, array $sources,
		Authority $authority, string $note = '', array $admissionRevisions = []
	): int {
		try {
			if ( !$sources || !array_is_list( $sources ) || count( $sources ) > 32 ||
				strlen( $json ) > DocumentSchema::MAX_BYTES || !mb_check_encoding( $note, 'UTF-8' ) ||
				!array_is_list( $admissionRevisions ) || count( $admissionRevisions ) > DocumentSchema::MAX_SURFACES ) {
				throw new \DomainException();
			}
			$content = new LayersDocumentContent( $json );
			$canonical = $content->getCanonicalText();
			$document = json_decode( $canonical, false, 64, JSON_THROW_ON_ERROR );
			$origins = [];
			foreach ( $admissionRevisions as $origin ) {
				$this->exactKeys( $origin, [ 'revisionId', 'surfaceId' ] );
				$this->identifier( $origin['surfaceId'] );
				$this->positiveId( $origin['revisionId'] );
				if ( $origin['revisionId'] >= $baseRevisionId || isset( $origins[$origin['surfaceId']] ) ) {
					throw new \DomainException();
				}
				$origins[$origin['surfaceId']] = $origin['revisionId'];
			}
			$captures = $history = $usedOrigins = $items = [];
			$owner = null;
			foreach ( $sources as $descriptor ) {
				$this->exactKeys( $descriptor,
					[ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId', 'targetSurfaceId' ] );
				$this->positiveId( $descriptor['sourcePageId'] );
				$this->positiveId( $descriptor['sourceRevisionId'] );
				$this->identifier( $descriptor['sourceSurfaceId'] );
				$this->identifier( $descriptor['targetSurfaceId'] );
				$read = $this->reader->read( $pageId, $baseRevisionId, $descriptor['targetSurfaceId'],
					$descriptor['sourcePageId'], $descriptor['sourceRevisionId'], $descriptor['sourceSurfaceId'],
					$authority );
				$currentOwner = $this->title( $pageId, $read['target']['owner'] );
				if ( $owner !== null && !$owner->equals( $currentOwner ) ) {
					throw new \DomainException();
				}
				$owner = $currentOwner;
				$targetIds = $this->validateGroup( $document, $read, $pageId, $baseRevisionId,
					$owner, $authority, $origins, $usedOrigins, $history );
				// Different page anchors of the same source set still describe one citation.
				$key = JsonSnapshotCodec::encode( [ $descriptor['sourcePageId'], $descriptor['sourceRevisionId'],
					$read['sourceGroup']['source']['fileTitle'], DrawingName::key( $read['sourceGroup']['label'] ) ] );
				if ( isset( $captures[$key] ) ) {
					continue;
				}
				$title = $this->title( $descriptor['sourcePageId'], $read['source']['owner'] );
				$sourceIds = array_column( $read['sourceGroup']['members'], 'surfaceId' );
				$sourceContent = $this->access->read( $title, $descriptor['sourceRevisionId'],
					$authority, $descriptor['sourcePageId'] );
				if ( JsonSnapshotCodec::encode( json_decode( $sourceContent->getText() ) ) !==
					JsonSnapshotCodec::encode( $read['sourceBundle']['snapshot'] ) ) {
					throw new \DomainException();
				}
				$captures[$key] = [ 'descriptor' => $descriptor, 'read' => $read, 'targetIds' => $targetIds,
					'sourceText' => $sourceContent->getText(),
					'sourceFiles' => $this->fileWitness( $sourceContent, $sourceIds, $authority ),
					'targetFiles' => $this->fileWitness( $content, $targetIds, $authority ) ];
				$items[] = wfMessage( 'layers-copy-summary' )->plaintextParams( $read['sourceGroup']['label'] )
					->params( $title->getPrefixedText(), (string)$descriptor['sourceRevisionId'] )
					->inContentLanguage()->text();
			}
			if ( array_diff_key( $origins, $usedOrigins ) ) {
				throw new \DomainException();
			}
			$summary = implode( '; ', $items );
			if ( trim( $note ) !== '' ) {
				$summary .= wfMessage( 'colon-separator' )->inContentLanguage()->text() . trim( $note );
			}
			if ( mb_strlen( $summary ) > CommentStore::COMMENT_CHARACTER_LIMIT ) {
				throw new \DomainException();
			}
		} catch ( \Throwable $error ) {
			throw new PublicationException( 'layers-working-copy-import-unavailable', 0, $error );
		}

		$verify = function () use ( $pageId, $owner, $authority, $captures, $history, $content ): void {
			try {
				$this->title( $pageId, $owner->getPrefixedDBkey() );
				// The native publisher performs the secure write authorization once, immediately
				// before this callback. Repeated source checks must not charge more edit actions.
				$this->access->assertCanPrepareEdit( $owner, $authority );
				foreach ( $captures as $capture ) {
					$d = $capture['descriptor'];
					$title = $this->title( $d['sourcePageId'], $capture['read']['source']['owner'] );
					$fresh = $this->access->read( $title, $d['sourceRevisionId'], $authority, $d['sourcePageId'] );
					if ( $fresh->getText() !== $capture['sourceText'] ||
						$this->fileWitness( $fresh,
							array_column( $capture['read']['sourceGroup']['members'], 'surfaceId' ), $authority ) !==
							$capture['sourceFiles'] ||
						$this->fileWitness( $content, $capture['targetIds'], $authority ) !== $capture['targetFiles'] ||
						$this->access->read( $title, $d['sourceRevisionId'], $authority, $d['sourcePageId'] )
							->getText() !== $capture['sourceText'] ) {
						throw new \DomainException();
					}
					$this->title( $d['sourcePageId'], $capture['read']['source']['owner'] );
				}
				foreach ( $history as $revisionId => $text ) {
					if ( $this->access->read( $owner, $revisionId, $authority, $pageId )->getText() !== $text ) {
						throw new \DomainException();
					}
				}
				$this->title( $pageId, $owner->getPrefixedDBkey() );
				$this->access->assertCanPrepareEdit( $owner, $authority );
			} catch ( \Throwable $error ) {
				throw new PublicationException( 'layers-working-copy-import-unavailable', 0, $error );
			}
		};
		$dbw = $this->db->getPrimaryDatabase();
		return $dbw->doAtomicSection( __METHOD__, function () use (
			$owner, $authority, $baseRevisionId, $canonical, $summary, $pageId, $verify
		): int {
			$revision = $this->publisher->publish( $owner, $authority, $baseRevisionId, $canonical,
				$summary, null, $pageId, null, $verify );
			$verify();
			if ( $this->access->read( $owner, $revision, $authority, $pageId )->getCanonicalText() !== $canonical ) {
				throw new PublicationException( 'layers-working-copy-import-unavailable' );
			}
			return $revision;
		}, $dbw::ATOMIC_CANCELABLE );
	}

	private function validateGroup( \stdClass $document, array $read, int $pageId, int $baseRevisionId,
		Title $owner, Authority $authority, array $origins, array &$usedOrigins, array &$history
	): array {
		$stored = $read['targetBundle']['snapshot'];
		$anchor = $this->member( $document, $read['target']['surfaceId'] );
		$original = $this->member( $stored, $anchor->id );
		$key = LayerSetIdentity::key( $anchor );
		$oldIds = array_column( $read['targetGroup']['members'], 'surfaceId' );
		$allStoredIds = array_column( $stored->surfaces, 'id' );
		$pages = $ids = [];
		$changed = false;
		foreach ( $document->surfaces as $surface ) {
			if ( !in_array( $surface->id, $oldIds, true ) && LayerSetIdentity::key( $surface ) !== $key ) {
				continue;
			}
			if ( $surface->kind !== 'pdf' ) {
				throw new \DomainException();
			}
			$pin = (array)$surface->source;
			unset( $pin['page'] );
			$page = $surface->source->page;
			if ( $surface->label !== $anchor->label ||
				LayerSetIdentity::key( $surface ) !== $key || isset( $pages[$page] ) ||
				$page > $read['targetGroup']['pageCount'] ||
				JsonSnapshotCodec::encode( $pin ) !== JsonSnapshotCodec::encode( $read['targetGroup']['source'] ) ) {
				throw new \DomainException();
			}
			$pages[$page] = $surface->id;
			$ids[] = $surface->id;
			if ( in_array( $surface->id, $oldIds, true ) ) {
				$before = $this->member( $stored, $surface->id );
				if ( JsonSnapshotCodec::encode( $surface->source ) !==
					JsonSnapshotCodec::encode( $before->source ) ) {
					throw new \DomainException();
				}
			} else {
				if ( in_array( $surface->id, $allStoredIds, true ) ) {
					throw new \DomainException();
				}
				$issuedAt = $origins[$surface->id] ?? $baseRevisionId;
				if ( $issuedAt !== $baseRevisionId ) {
					$text = $this->access->read( $owner, $issuedAt, $authority, $pageId )->getText();
					$historical = json_decode( $text, false, 64, JSON_THROW_ON_ERROR );
					$oldAnchor = $this->member( $historical, $original->id );
					if ( JsonSnapshotCodec::encode( $oldAnchor->source ) !==
						JsonSnapshotCodec::encode( $original->source ) ||
						$oldAnchor->kind !== 'pdf' || $oldAnchor->label !== $original->label ) {
						throw new \DomainException();
					}
					$oldPages = [];
					foreach ( $historical->surfaces as $oldSurface ) {
						if ( $oldSurface->id === $surface->id ||
							( LayerSetIdentity::key( $oldSurface ) === LayerSetIdentity::key( $oldAnchor ) &&
								$oldSurface->source->page === $page ) ) {
							throw new \DomainException();
						}
						if ( LayerSetIdentity::key( $oldSurface ) === LayerSetIdentity::key( $oldAnchor ) ) {
							$oldPin = (array)$oldSurface->source;
							unset( $oldPin['page'] );
							if ( $oldSurface->kind !== 'pdf' || $oldSurface->label !== $oldAnchor->label ||
								isset( $oldPages[$oldSurface->source->page] ) ||
								JsonSnapshotCodec::encode( $oldPin ) !==
									JsonSnapshotCodec::encode( $read['targetGroup']['source'] ) ) {
								throw new \DomainException();
							}
							$oldPages[$oldSurface->source->page] = true;
						}
					}
					$history[$issuedAt] = $text;
					$usedOrigins[$surface->id] = true;
				}
				if ( $surface->id !== NewPageDrawing::surfaceId( $pageId, $issuedAt,
					$original->label, $original->source->fileTitle, $page ) ) {
					throw new \DomainException();
				}
				$before = (object)[ 'canvas' => null, 'layers' => [], 'readingOrder' => null ];
			}
			foreach ( [ 'canvas', 'layers', 'readingOrder' ] as $field ) {
				$changed = $changed || JsonSnapshotCodec::encode( $surface->$field ?? null ) !==
					JsonSnapshotCodec::encode( $before->$field ?? null );
			}
		}
		if ( !$changed || array_diff( $oldIds, $ids ) ||
			array_diff( array_column( $read['sourceGroup']['members'], 'page' ), array_keys( $pages ) ) ) {
			throw new \DomainException();
		}
		return $ids;
	}

	private function fileWitness( LayersDocumentContent $content, array $ids, Authority $authority ): array {
		$files = $this->sources->resolve( $content, $authority, $ids );
		$document = json_decode( $content->getText(), false, 64, JSON_THROW_ON_ERROR );
		$result = [];
		foreach ( $ids as $id ) {
			$file = $files[$id];
			$page = $this->member( $document, $id )->source->page;
			$count = $file->pageCount();
			$width = $file->getWidth( $page );
			$height = $file->getHeight( $page );
			$url = $file->getUrl();
			if ( $file->getMimeType() !== 'application/pdf' || !is_int( $count ) || $page > $count ||
				!is_int( $width ) || !is_int( $height ) || $width < 1 || $height < 1 ||
				!is_string( $url ) || $url === '' ) {
				throw new \DomainException();
			}
			$result[$id] = [ $count, $width, $height, $url ];
		}
		return $result;
	}

	private function member( \stdClass $document, string $id ): \stdClass {
		$members = array_values( array_filter( $document->surfaces,
			static fn ( $surface ): bool => $surface->id === $id ) );
		if ( count( $members ) !== 1 ) {
			throw new \DomainException();
		}
		return $members[0];
	}

	private function title( int $pageId, string $expected ): Title {
		$title = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$title || $title->isExternal() || $title->hasFragment() ||
			$title->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ||
			$title->getPrefixedDBkey() !== $expected ||
			!$this->scope->includes( $title, IDBAccessObject::READ_LATEST ) ) {
			throw new \DomainException();
		}
		return $title;
	}

	private function exactKeys( array $value, array $expected ): void {
		$keys = array_keys( $value );
		sort( $keys );
		if ( $keys !== $expected ) {
			throw new \DomainException();
		}
	}

	/** @param mixed $value */
	private function positiveId( $value ): void {
		if ( !is_int( $value ) || $value < 1 || $value > 2147483647 ) {
			throw new \DomainException();
		}
	}

	/** @param mixed $value */
	private function identifier( $value ): void {
		if ( !is_string( $value ) || !preg_match( '/^[A-Za-z0-9_.:-]{1,80}$/D', $value ) ) {
			throw new \DomainException();
		}
	}
}
