<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\CommentStore\CommentStore;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;

/** Inactive native first-Save provenance boundary; descriptors grant no publication authority. */
class PageWorkingCopyImportPublicationService {

	private PageWorkingCopyImportReadService $reader;
	private PagePublicationService $publisher;
	private TitleFactory $titles;
	private IConnectionProvider $db;

	public function __construct( PageWorkingCopyImportReadService $reader, PagePublicationService $publisher,
		TitleFactory $titles, IConnectionProvider $db
	) {
		$this->reader = $reader;
		$this->publisher = $publisher;
		$this->titles = $titles;
		$this->db = $db;
	}

	/**
	 * Publish edited image/slide work with native source citations in its owning page's revision.
	 * No endpoint, caller, creation, PDF, migration or editor integration is activated here.
	 *
	 * @param int $pageId Existing target owner
	 * @param int $baseRevisionId Explicit current target base
	 * @param string $json Complete proposed snapshot; existing publisher validates publication
	 * @param array[] $sources Exact targetSurfaceId/sourcePageId/sourceRevisionId/sourceSurfaceId records
	 * @param Authority $authority Original requesting authority
	 * @param string $note Editor's optional words, following native provenance
	 * @return int Committed target revision; no automatic retry
	 * @throws PublicationException Fixed unavailable refusal or existing publisher refusal
	 */
	public function publish( int $pageId, int $baseRevisionId, string $json, array $sources,
		Authority $authority, string $note = ''
	): int {
		try {
			if ( !$sources || count( $sources ) > 32 || !array_is_list( $sources ) ||
				strlen( $json ) > DocumentSchema::MAX_BYTES ||
				!mb_check_encoding( $note, 'UTF-8' ) ) {
				throw new \DomainException();
			}
			$document = json_decode( $json, true, 64, JSON_THROW_ON_ERROR );
			JsonSnapshotCodec::rejectDuplicateKeys( $json );
			$captures = [];
			$items = [];
			$owner = null;
			foreach ( $sources as $descriptor ) {
				$this->assertDescriptor( $descriptor );
				$key = JsonSnapshotCodec::encode( $descriptor );
				if ( isset( $captures[$key] ) ) {
					continue;
				}
				$read = $this->read( $pageId, $baseRevisionId, $descriptor, $authority );
				$target = $this->member( $read['targetBundle']['snapshot'], $descriptor['targetSurfaceId'] );
				$source = $this->member( $read['sourceBundle']['snapshot'], $descriptor['sourceSurfaceId'] );
				$proposed = $this->member( $document, $descriptor['targetSurfaceId'] );
				$this->assertCompatible( $target, $source, $proposed );
				$currentOwner = $this->title( $pageId, $read['target']['owner'] );
				if ( $owner !== null && !$owner->equals( $currentOwner ) ) {
					throw new \DomainException();
				}
				$owner = $currentOwner;
				$title = $this->title( $descriptor['sourcePageId'], $read['source']['owner'] );
				$items[] = wfMessage( 'layers-copy-summary' )->plaintextParams( $source['label'] )
					->params( $title->getPrefixedText(), (string)$descriptor['sourceRevisionId'] )
					->inContentLanguage()->text();
				$captures[$key] = [ 'descriptor' => $descriptor, 'read' => $read ];
			}
			$summary = implode( '; ', $items );
			if ( trim( $note ) !== '' ) {
				$summary .= wfMessage( 'colon-separator' )->inContentLanguage()->text() . trim( $note );
			}
			if ( mb_strlen( $summary ) > CommentStore::COMMENT_CHARACTER_LIMIT ) {
				// Never let native truncation discard a cited source/revision or the editor's note.
				throw new \DomainException();
			}
		} catch ( \Throwable $error ) {
			throw new PublicationException( 'layers-working-copy-import-unavailable' );
		}

		$verify = function ( int $revisionId ) use ( $pageId, $captures, $authority ): void {
			try {
				foreach ( $captures as $capture ) {
					$fresh = $this->read( $pageId, $revisionId, $capture['descriptor'], $authority );
					if ( $fresh['source'] !== $capture['read']['source'] ||
						$fresh['sourceBundle'] !== $capture['read']['sourceBundle'] ||
						$fresh['target']['owner'] !== $capture['read']['target']['owner'] ) {
						throw new \DomainException();
					}
				}
			} catch ( \Throwable $error ) {
				throw new PublicationException( 'layers-working-copy-import-unavailable' );
			}
		};
		// Native callbacks may suppress a source even after preparation. Retain one transaction
		// through the post-save source check, as the accepted migration publication boundary does.
		$dbw = $this->db->getPrimaryDatabase();
		return $dbw->doAtomicSection( __METHOD__, function () use (
			$owner, $authority, $baseRevisionId, $json, $summary, $pageId, $verify
		): int {
			$revision = $this->publisher->publish( $owner, $authority, $baseRevisionId, $json,
				$summary, null, $pageId, null, static fn () => $verify( $baseRevisionId ) );
			$verify( $revision );
			return $revision;
		}, $dbw::ATOMIC_CANCELABLE );
	}

	private function assertDescriptor( array $descriptor ): void {
		$keys = array_keys( $descriptor );
		sort( $keys );
		if ( $keys !== [ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId', 'targetSurfaceId' ] ) {
			throw new \DomainException();
		}
		foreach ( [ 'sourcePageId', 'sourceRevisionId' ] as $key ) {
			if ( !is_int( $descriptor[$key] ) || $descriptor[$key] < 1 || $descriptor[$key] > 2147483647 ) {
				throw new \DomainException();
			}
		}
		foreach ( [ 'sourceSurfaceId', 'targetSurfaceId' ] as $key ) {
			if ( !is_string( $descriptor[$key] ) || !preg_match( '/^[A-Za-z0-9_.:-]{1,80}$/D', $descriptor[$key] ) ) {
				throw new \DomainException();
			}
		}
	}

	private function read( int $pageId, int $revisionId, array $source, Authority $authority ): array {
		return $this->reader->read( $pageId, $revisionId, $source['targetSurfaceId'],
			$source['sourcePageId'], $source['sourceRevisionId'], $source['sourceSurfaceId'], $authority );
	}

	private function title( int $pageId, string $expected ): Title {
		$title = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$title || $title->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ||
			$title->getPrefixedDBkey() !== $expected ) {
			throw new \DomainException();
		}
		return $title;
	}

	private function member( array $document, string $id ): array {
		if ( !is_array( $document['surfaces'] ?? null ) ) {
			throw new \DomainException();
		}
		$members = array_values( array_filter( $document['surfaces'],
			static fn ( $member ) => is_array( $member ) && ( $member['id'] ?? null ) === $id ) );
		if ( count( $members ) !== 1 ) {
			throw new \DomainException();
		}
		return $members[0];
	}

	private function assertCompatible( array $target, array $source, array $proposed ): void {
		$fields = array_flip( [ 'canvas', 'layers', 'readingOrder' ] );
		$unchanged = JsonSnapshotCodec::encode( array_intersect_key( $proposed, $fields ) ) ===
			JsonSnapshotCodec::encode( array_intersect_key( $target, $fields ) );
		if ( !in_array( $target['kind'], [ 'image', 'slide' ], true ) ||
			$source['kind'] !== $target['kind'] || $proposed['kind'] !== $target['kind'] ||
			!is_string( $target['label'] ) || !is_string( $source['label'] ) ||
			DrawingName::normalize( $source['label'] ) === null ||
			DrawingName::key( $source['label'] ) !== DrawingName::key( $target['label'] ) ||
			( $target['kind'] === 'image' && ( $source['source']['fileTitle'] !== $target['source']['fileTitle'] ||
				JsonSnapshotCodec::encode( $proposed['source'] ) !==
					JsonSnapshotCodec::encode( $target['source'] ) ) ) ||
			$unchanged ) {
			throw new \DomainException();
		}
	}
}
