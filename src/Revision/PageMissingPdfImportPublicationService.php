<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\CommentStore\CommentStore;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;

/** Unregistered first Save for one completely absent PDF Import target. */
class PageMissingPdfImportPublicationService {

	public function __construct(
		private PageMissingPdfImportPreparation $preparation,
		private PagePublicationService $publisher,
		private PageOwnedIdentityResolver $identities,
		private TitleFactory $titles,
		private PageOwnedScope $scope,
		private RevisionLookup $revisions,
		private PageHistoryAccess $access,
		private SourceVersionResolver $sources,
		private IConnectionProvider $db
	) {
	}

	/**
	 * Publish all admitted pages against the genuine original base, without retry.
	 * This inactive boundary retains the saved embedding name and current-base IDs.
	 * Pending renames, historical temporary IDs and request/UI integration are separate.
	 *
	 * @param int $pageId Existing target owner
	 * @param int $baseRevisionId Explicit current revision, never zero
	 * @param int $start Saved embedding byte offset
	 * @param string $expected Complete saved embedding bytes
	 * @param string $json Complete proposed document
	 * @param array[] $sources Exact sourcePageId/sourceRevisionId/sourceSurfaceId records
	 * @param Authority $authority Original requester
	 * @param string $note Optional owner words, never truncating provenance
	 * @return int New owning-page revision
	 */
	public function publish( int $pageId, int $baseRevisionId, int $start, string $expected,
		string $json, array $sources, Authority $authority, string $note = ''
	): int {
		try {
			if ( !$sources || !array_is_list( $sources ) || count( $sources ) > 32 ||
				strlen( $json ) > DocumentSchema::MAX_BYTES || !mb_check_encoding( $note, 'UTF-8' ) ) {
				throw new \DomainException();
			}
			json_decode( $json, false, 64, JSON_THROW_ON_ERROR );
			JsonSnapshotCodec::rejectDuplicateKeys( $json );
			$receipt = MissingPdfImportReceipt::newCommentData( $pageId, $baseRevisionId,
				$start, $expected, $json, $sources, $note );
			$content = new LayersDocumentContent( $json );
			$canonical = $content->getCanonicalText();
			$content = new LayersDocumentContent( $canonical );
			$document = json_decode( $canonical, false, 64, JSON_THROW_ON_ERROR );
			$captures = $descriptors = $items = [];
			$target = null;
			foreach ( $sources as $descriptor ) {
				$this->descriptor( $descriptor );
				$descriptorKey = JsonSnapshotCodec::encode( $descriptor );
				if ( isset( $descriptors[$descriptorKey] ) ) {
					continue;
				}
				$descriptors[$descriptorKey] = true;
				$read = $this->preparation->prepare( $pageId, $baseRevisionId, $start, $expected,
					$descriptor['sourcePageId'], $descriptor['sourceRevisionId'],
					$descriptor['sourceSurfaceId'], $authority );
				if ( $target !== null &&
					JsonSnapshotCodec::encode( $target ) !== JsonSnapshotCodec::encode( $read['targetAdmission'] ) ) {
					throw new \DomainException();
				}
				$target = $read['targetAdmission'];
				$this->proposed( $document, $target );
				$key = JsonSnapshotCodec::encode( [ $descriptor['sourcePageId'], $descriptor['sourceRevisionId'],
					$read['sourceGroup']['source']['fileTitle'], DrawingName::key( $read['sourceGroup']['label'] ) ] );
				if ( isset( $captures[$key] ) ) {
					continue;
				}
				$title = $this->title( $descriptor['sourcePageId'], $read['source']['owner'] );
				$source = $this->access->read( $title, $descriptor['sourceRevisionId'],
					$authority, $descriptor['sourcePageId'] );
				if ( JsonSnapshotCodec::encode( json_decode( $source->getText() ) ) !==
					JsonSnapshotCodec::encode( $read['sourceBundle']['snapshot'] ) ) {
					throw new \DomainException();
				}
				$ids = array_column( $read['sourceGroup']['members'], 'surfaceId' );
				$captures[$key] = [ 'descriptor' => $descriptor, 'owner' => $title->getPrefixedDBkey(),
					'text' => $source->getText(), 'ids' => $ids,
					'files' => $this->files( $source, $ids, $authority ) ];
				$items[] = wfMessage( 'layers-copy-summary' )->plaintextParams( $read['sourceGroup']['label'] )
					->params( $title->getPrefixedText(), (string)$descriptor['sourceRevisionId'] )
					->inContentLanguage()->text();
			}
			$owner = $this->title( $pageId, $target['target']['owner'] );
			$ids = array_column( array_column( $target['pages'], 'surface' ), 'id' );
			$targetFiles = $this->files( $content, $ids, $authority );
			$summary = implode( '; ', $items );
			if ( trim( $note ) !== '' ) {
				$summary .= wfMessage( 'colon-separator' )->inContentLanguage()->text() . trim( $note );
			}
			if ( mb_strlen( $summary ) > CommentStore::COMMENT_CHARACTER_LIMIT ) {
				throw new \DomainException();
			}
		} catch ( \Throwable $error ) {
			throw new PublicationException( 'layers-working-copy-import-unavailable' );
		}

		$verify = function ( int $revisionId, bool $saved ) use ( $pageId, $owner, $authority,
			$captures, $target, $targetFiles, $content, $ids, $canonical
		): void {
			try {
				$this->current( $pageId, $revisionId, $owner, $authority );
				$this->base( $owner, $target, $authority );
				foreach ( $captures as $capture ) {
					$d = $capture['descriptor'];
					$title = $this->title( $d['sourcePageId'], $capture['owner'] );
					$fresh = $this->access->read( $title, $d['sourceRevisionId'], $authority, $d['sourcePageId'] );
					if ( $fresh->getText() !== $capture['text'] ||
						$this->files( $fresh, $capture['ids'], $authority ) !== $capture['files'] ||
						$this->access->read( $title, $d['sourceRevisionId'], $authority, $d['sourcePageId'] )
							->getText() !== $capture['text'] ) {
						throw new \DomainException();
					}
					$this->title( $d['sourcePageId'], $capture['owner'] );
				}
				if ( $this->files( $content, $ids, $authority ) !== $targetFiles ) {
					throw new \DomainException();
				}
				// File checks may invoke native callbacks. Repeat source visibility afterward.
				foreach ( $captures as $capture ) {
					$d = $capture['descriptor'];
					$title = $this->title( $d['sourcePageId'], $capture['owner'] );
					if ( $this->access->read( $title, $d['sourceRevisionId'], $authority, $d['sourcePageId'] )
						->getText() !== $capture['text'] ) {
						throw new \DomainException();
					}
				}
				$this->base( $owner, $target, $authority );
				$this->current( $pageId, $revisionId, $owner, $authority );
				if ( $saved && ( $this->access->getStoredMainText( $owner, $revisionId, $authority ) !==
					$target['mainText'] || $this->access->read( $owner, $revisionId, $authority, $pageId )
						->getCanonicalText() !== $canonical ) ) {
					throw new \DomainException();
				}
			} catch ( \Throwable $error ) {
				throw new PublicationException( 'layers-working-copy-import-unavailable' );
			}
		};
		$dbw = $this->db->getPrimaryDatabase();
		return $dbw->doAtomicSection( __METHOD__, function () use ( $owner, $authority, $pageId,
			$baseRevisionId, $canonical, $summary, $verify, $receipt
		): int {
			$revision = $this->publisher->publish( $owner, $authority, $baseRevisionId, $canonical,
				$summary, null, $pageId, null, static fn () => $verify( $baseRevisionId, false ), $receipt );
			$verify( $revision, true );
			return $revision;
		}, $dbw::ATOMIC_CANCELABLE );
	}

	private function proposed( \stdClass $document, array $target ): void {
		$admitted = array_column( array_column( $target['pages'], 'surface' ), null, 'id' );
		$seen = [];
		$without = clone $document;
		$without->surfaces = [];
		$working = array_flip( [ 'canvas', 'layers', 'readingOrder' ] );
		foreach ( $document->surfaces as $surface ) {
			if ( !isset( $admitted[$surface->id] ) ) {
				$without->surfaces[] = $surface;
				continue;
			}
			if ( isset( $seen[$surface->id] ) ||
				JsonSnapshotCodec::encode( array_diff_key( (array)$surface, $working ) ) !==
					JsonSnapshotCodec::encode( array_diff_key( $admitted[$surface->id], $working ) ) ) {
				throw new \DomainException();
			}
			$seen[$surface->id] = true;
		}
		$base = $target['baseBundle']['snapshot'] ?? [ 'schemaVersion' => 1, 'surfaces' => [] ];
		if ( count( $seen ) !== count( $admitted ) ||
			JsonSnapshotCodec::encode( $without ) !== JsonSnapshotCodec::encode( $base ) ) {
			throw new \DomainException();
		}
	}

	private function current( int $pageId, int $revisionId, Title $owner, Authority $authority ): void {
		$fresh = $this->identities->resolveForEdit( $pageId, $revisionId, $authority );
		if ( $fresh->getPrefixedDBkey() !== $owner->getPrefixedDBkey() ) {
			throw new \DomainException();
		}
		$this->title( $pageId, $owner->getPrefixedDBkey() );
	}

	private function base( Title $owner, array $target, Authority $authority ): void {
		$pageId = $target['target']['pageId'];
		$id = $target['target']['revisionId'];
		$record = $this->revisions->getRevisionById( $id, IDBAccessObject::READ_LATEST );
		if ( !$record || $record->getPageId() !== $pageId || !$authority->authorizeRead( 'read', $owner ) ||
			!RevisionRecord::userCanBitfield( $record->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $record->getPage() ) || $record->hasSlot( PageRevisionWriter::SLOT ) !==
				$target['hasLayersSlot'] || $this->access->getStoredMainText( $owner, $id, $authority ) !==
				$target['mainText'] || ( $target['hasLayersSlot'] &&
					$this->access->read( $owner, $id, $authority, $pageId )->getText() !== $target['baseText'] ) ) {
			throw new \DomainException();
		}
	}

	private function files( LayersDocumentContent $content, array $ids, Authority $authority ): array {
		$files = $this->sources->resolve( $content, $authority, $ids );
		$document = json_decode( $content->getText(), false, 64, JSON_THROW_ON_ERROR );
		$byId = array_column( $document->surfaces, null, 'id' );
		$result = [];
		foreach ( $ids as $id ) {
			$file = $files[$id];
			$page = $byId[$id]->source->page;
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

	private function title( int $pageId, string $expected ): Title {
		$title = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$title || !$title->canExist() || $title->isExternal() || $title->hasFragment() ||
			$title->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ||
			$title->getPrefixedDBkey() !== $expected ||
			!$this->scope->includes( $title, IDBAccessObject::READ_LATEST ) ) {
			throw new \DomainException();
		}
		return $title;
	}

	private function descriptor( array $source ): void {
		$keys = array_keys( $source );
		sort( $keys );
		if ( $keys !== [ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ] ||
			!is_string( $source['sourceSurfaceId'] ) ||
			!preg_match( '/^[A-Za-z0-9_.:-]{1,80}$/D', $source['sourceSurfaceId'] ) ) {
			throw new \DomainException();
		}
		foreach ( [ 'sourcePageId', 'sourceRevisionId' ] as $field ) {
			if ( !is_int( $source[$field] ) || $source[$field] < 1 || $source[$field] > 2147483647 ) {
				throw new \DomainException();
			}
		}
	}
}
