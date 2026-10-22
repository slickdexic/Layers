<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Read-only confirmation of an exact Import request, never a publication retry. */
class PageMissingPdfImportOutcomeReadService {

	public function __construct(
		private PageOwnedPilot $pilot,
		private PageOwnedIdentityResolver $identities,
		private TitleFactory $titles,
		private RevisionLookup $revisions,
		private PageHistoryAccess $access,
		private PageWorkingCopyPdfImportReadService $reader,
		private SourceVersionResolver $sources
	) {
	}

	/**
	 * Confirm only the current direct successor of the exact attempted native base.
	 * All request strings and ordered descriptors are the parsed publication values.
	 * Returning an ID is point-in-time evidence: clients must retain newer live work
	 * and use the saved-session admission before replacing their editor ownership.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param string $ownerText Original owning title's prefixed DB key
	 * @param int $start Saved embedding byte offset
	 * @param string $expected Complete saved embedding bytes
	 * @param string $json Original submitted snapshot string
	 * @param array[] $sources Ordered native source descriptors
	 * @param Authority $authority
	 * @param string $note Native parsed note, before trimming
	 * @return int Confirmed current native revision
	 */
	public function confirm( int $pageId, int $baseRevisionId, string $ownerText, int $start,
		string $expected, string $json, array $sources, Authority $authority, string $note = ''
	): int {
		try {
			if ( $baseRevisionId < 1 || $baseRevisionId > 2147483647 || $start < 0 || $expected === '' ||
				strlen( $expected ) > DocumentSchema::MAX_BYTES || strlen( $json ) > DocumentSchema::MAX_BYTES ||
				!$sources || !array_is_list( $sources ) || count( $sources ) > 32 ||
				!mb_check_encoding( $note, 'UTF-8' ) || !$authority->getUser()->isRegistered() ) {
				throw new \DomainException();
			}
			json_decode( $json, false, 64, JSON_THROW_ON_ERROR );
			JsonSnapshotCodec::rejectDuplicateKeys( $json );
			$content = new LayersDocumentContent( $json );
			if ( !$content->isValid() ) {
				throw new \DomainException();
			}
			$receipt = MissingPdfImportReceipt::newCommentData( $pageId, $baseRevisionId,
				$start, $expected, $json, $sources, $note );
			$descriptors = [];
			foreach ( $sources as $source ) {
				$this->descriptor( $source, $pageId );
				$descriptors[JsonSnapshotCodec::encode( $source )] = $source;
			}
			$canonical = $content->getCanonicalText();
			$capture = fn () => $this->capture( $pageId, $baseRevisionId, $ownerText, $start, $expected,
				$canonical, $receipt, array_values( $descriptors ), $authority, $note );
			$first = $capture();
			if ( JsonSnapshotCodec::encode( $first ) !== JsonSnapshotCodec::encode( $capture() ) ) {
				throw new \DomainException();
			}
			return $first['revisionId'];
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-working-copy-import-unavailable' );
		}
	}

	private function capture( int $pageId, int $baseRevisionId, string $ownerText, int $start,
		string $expected, string $canonical, array $receipt, array $descriptors,
		Authority $authority, string $note
	): array {
		$owner = $this->owner( $pageId, $ownerText );
		$current = $this->revisions->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
		if ( !$current || $current->getId() <= $baseRevisionId || $current->getParentId() !== $baseRevisionId ) {
			throw new \DomainException();
		}
		$id = $current->getId();
		$this->current( $pageId, $id, $ownerText, $authority );
		$main = $this->main( $pageId, $baseRevisionId, $authority );
		if ( $main !== $this->main( $pageId, $id, $authority ) ||
			substr( $main, $start, strlen( $expected ) ) !== $expected ) {
			throw new \DomainException();
		}
		$comment = $this->comment( $pageId, $id, $authority );
		if ( JsonSnapshotCodec::encode( $comment->data ) !== JsonSnapshotCodec::encode( $receipt ) ) {
			throw new \DomainException();
		}
		$stored = $this->access->read( $owner, $id, $authority, $pageId );
		if ( $stored->getCanonicalText() !== $canonical ) {
			throw new \DomainException();
		}
		$base = $this->base( $owner, $pageId, $baseRevisionId, $authority );
		// Current native admission parses the entire saved occurrence and validates its selectors.
		$init = $this->pilot->prepareBoundEditor( $pageId, $id, $start, $expected, $authority );
		$admitted = $init['pageOwned'] ?? [];
		$context = $admitted['pdfContext'] ?? null;
		if ( ( $admitted['pageId'] ?? null ) !== $pageId || ( $admitted['revisionId'] ?? null ) !== $id ||
			( $admitted['owner'] ?? null ) !== $ownerText || ( $admitted['readOnly'] ?? null ) !== false ||
			isset( $admitted['newSurface'] ) || !is_array( $context ) ||
			( $context['stored'] ?? null ) !== true || !is_int( $context['pageCount'] ?? null ) ||
			$context['pageCount'] < 1 || $context['pageCount'] > DocumentSchema::MAX_SURFACES ) {
			throw new \DomainException();
		}
		$anchor = $context['surface'];
		$key = LayerSetIdentity::key( json_decode( JsonSnapshotCodec::encode( $anchor ) ) );
		$document = json_decode( $canonical );
		$before = json_decode( $base ?? '{"schemaVersion":1,"surfaces":[]}' );
		foreach ( $before->surfaces as $member ) {
			if ( LayerSetIdentity::key( $member ) === $key ) {
				throw new \DomainException();
			}
		}
		$without = clone $document;
		$without->surfaces = [];
		$members = [];
		foreach ( $document->surfaces as $member ) {
			if ( LayerSetIdentity::key( $member ) !== $key ) {
				$without->surfaces[] = $member;
				continue;
			}
			$page = $member->source->page;
			if ( $member->kind !== 'pdf' || $member->label !== $anchor['label'] || isset( $members[$page] ) ||
				$page < 1 || $page > $context['pageCount'] || $member->id !== NewPageDrawing::surfaceId(
					$pageId, $baseRevisionId, $anchor['label'], $anchor['source']['fileTitle'], $page ) ||
				JsonSnapshotCodec::encode( array_diff_key( (array)$member->source, [ 'page' => true ] ) ) !==
					JsonSnapshotCodec::encode( array_diff_key( $anchor['source'], [ 'page' => true ] ) ) ) {
				throw new \DomainException();
			}
			$members[$page] = $member->id;
		}
		if ( count( $members ) !== $context['pageCount'] ||
			JsonSnapshotCodec::encode( $without ) !== JsonSnapshotCodec::encode( $before ) ) {
			throw new \DomainException();
		}
		$files = $this->files( $stored, array_values( $members ), $context['pageCount'], $authority );
		$captures = $items = [];
		foreach ( $descriptors as $descriptor ) {
			$read = $this->reader->readSource( $descriptor['sourcePageId'], $descriptor['sourceRevisionId'],
				$descriptor['sourceSurfaceId'], $authority, false );
			$sourceAnchor = array_values( array_filter( $read['bundle']['snapshot']->surfaces,
				static fn ( $surface ): bool => $surface->id === $descriptor['sourceSurfaceId'] ) )[0];
			if ( LayerSetIdentity::key( $sourceAnchor ) !== $key ) {
				throw new \DomainException();
			}
			foreach ( $read['group']['members'] as $member ) {
				if ( !isset( $members[$member['page']] ) ) {
					throw new \DomainException();
				}
			}
			$group = JsonSnapshotCodec::encode( [ $descriptor['sourcePageId'], $descriptor['sourceRevisionId'],
				$read['group']['source']['fileTitle'], DrawingName::key( $read['group']['label'] ) ] );
			if ( !isset( $items[$group] ) ) {
				$title = $this->owner( $descriptor['sourcePageId'], $read['source']['owner'] );
				$items[$group] = wfMessage( 'layers-copy-summary' )->plaintextParams( $read['group']['label'] )
					->params( $title->getPrefixedText(), (string)$descriptor['sourceRevisionId'] )
					->inContentLanguage()->text();
			}
			$captures[] = $read;
		}
		$summary = implode( '; ', $items );
		if ( trim( $note ) !== '' ) {
			$summary .= wfMessage( 'colon-separator' )->inContentLanguage()->text() . trim( $note );
		}
		if ( $comment->text !== $summary ||
			$this->files( $stored, array_values( $members ), $context['pageCount'], $authority ) !== $files ) {
			throw new \DomainException();
		}
		foreach ( $captures as $read ) {
			$d = $read['source'];
			$fresh = $this->reader->readSource( $d['pageId'], $d['revisionId'], $d['surfaceId'], $authority, false );
			if ( JsonSnapshotCodec::encode( $fresh['witness'] ) !== JsonSnapshotCodec::encode( $read['witness'] ) ||
				$fresh['source'] !== $read['source'] ) {
				throw new \DomainException();
			}
		}
		// All handler callbacks have finished. Recheck visibility without another transform.
		foreach ( $captures as $read ) {
			$d = $read['source'];
			$title = $this->owner( $d['pageId'], $d['owner'] );
			if ( $this->access->read( $title, $d['revisionId'], $authority, $d['pageId'] )->getText() !==
				$read['witness']['text'] ) {
				throw new \DomainException();
			}
		}
		if ( $this->main( $pageId, $baseRevisionId, $authority ) !== $main ||
			$this->main( $pageId, $id, $authority ) !== $main ||
			$this->base( $owner, $pageId, $baseRevisionId, $authority ) !== $base ||
			$this->access->read( $owner, $id, $authority, $pageId )->getCanonicalText() !== $canonical ||
			$this->comment( $pageId, $id, $authority ) != $comment ) {
			throw new \DomainException();
		}
		$this->current( $pageId, $id, $ownerText, $authority );
		return [ 'revisionId' => $id, 'base' => $base, 'main' => $main,
			'files' => $files, 'sources' => $captures, 'surfaceId' => $admitted['surfaceId'] ];
	}

	private function owner( int $pageId, string $expected ): Title {
		$owner = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$owner || !$owner->canExist() || $owner->isExternal() || $owner->hasFragment() ||
			$owner->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ||
			$owner->getPrefixedDBkey() !== $expected ||
			!$this->pilot->getScope()->includes( $owner, IDBAccessObject::READ_LATEST ) ) {
			throw new \DomainException();
		}
		return $owner;
	}

	private function current( int $pageId, int $id, string $owner, Authority $authority ): void {
		if ( !$authority->isAllowed( 'editlayers' ) ||
			$this->identities->resolveForEdit( $pageId, $id, $authority )->getPrefixedDBkey() !== $owner ) {
			throw new \DomainException();
		}
		$this->owner( $pageId, $owner );
	}

	private function record( int $pageId, int $id, Authority $authority ): RevisionRecord {
		$record = $this->revisions->getRevisionById( $id, IDBAccessObject::READ_LATEST );
		if ( !$record || $record->getPageId() !== $pageId ||
			!RevisionRecord::userCanBitfield( $record->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $record->getPage() ) ) {
			throw new \DomainException();
		}
		return $record;
	}

	private function main( int $pageId, int $id, Authority $authority ): string {
		$content = $this->record( $pageId, $id, $authority )->getContent( 'main',
			RevisionRecord::FOR_THIS_USER, $authority );
		if ( !$content instanceof WikitextContent ) {
			throw new \DomainException();
		}
		return $content->getText();
	}

	private function comment( int $pageId, int $id, Authority $authority ): CommentStoreComment {
		$record = $this->record( $pageId, $id, $authority );
		if ( !RevisionRecord::userCanBitfield( $record->getVisibility(), RevisionRecord::DELETED_COMMENT,
			$authority, $record->getPage() ) ) {
			throw new \DomainException();
		}
		// Explicit native bitfield and owner-read checks precede access to structured metadata.
		return $record->getComment( RevisionRecord::RAW );
	}

	private function base( Title $owner, int $pageId, int $id, Authority $authority ): ?string {
		return $this->record( $pageId, $id, $authority )->hasSlot( PageRevisionWriter::SLOT ) ?
			$this->access->read( $owner, $id, $authority, $pageId )->getCanonicalText() : null;
	}

	private function descriptor( array $value, int $target ): void {
		$keys = array_keys( $value );
		sort( $keys );
		if ( $keys !== [ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ] ||
			!is_string( $value['sourceSurfaceId'] ) ||
			!preg_match( '/^[A-Za-z0-9_.:-]{1,80}$/D', $value['sourceSurfaceId'] ) ||
			$value['sourcePageId'] === $target ) {
			throw new \DomainException();
		}
		foreach ( [ 'sourcePageId', 'sourceRevisionId' ] as $field ) {
			if ( !is_int( $value[$field] ) || $value[$field] < 1 || $value[$field] > 2147483647 ) {
				throw new \DomainException();
			}
		}
	}

	private function files( LayersDocumentContent $content, array $ids, int $count, Authority $authority ): array {
		$files = $this->sources->resolve( $content, $authority, $ids );
		$byId = array_column( json_decode( $content->getText() )->surfaces, null, 'id' );
		$result = [];
		foreach ( $ids as $id ) {
			$file = $files[$id];
			$page = $byId[$id]->source->page;
			$width = $file->getWidth( $page );
			$height = $file->getHeight( $page );
			$url = $file->getUrl();
			if ( $file->getMimeType() !== 'application/pdf' || $file->pageCount() !== $count ||
				!is_int( $width ) || !is_int( $height ) || $width < 1 || $height < 1 ||
				!is_string( $url ) || $url === '' ) {
				throw new \DomainException();
			}
			$result[$id] = [ $count, $width, $height, $url ];
		}
		return $result;
	}
}
