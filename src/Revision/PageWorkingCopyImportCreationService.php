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

/** Inactive native Import read/first-Save boundary for a separately admitted missing member. */
class PageWorkingCopyImportCreationService {

	private PageWorkingCopyImportCreationTarget $creation;
	private PageReadService $reader;
	private PageWorkingCopyImportReadService $storedReader;
	private PagePublicationService $publisher;
	private TitleFactory $titles;
	private PageOwnedScope $scope;
	private IConnectionProvider $db;

	public function __construct( PageWorkingCopyImportCreationTarget $creation, PageReadService $reader,
		PageWorkingCopyImportReadService $storedReader, PagePublicationService $publisher,
		TitleFactory $titles, PageOwnedScope $scope, IConnectionProvider $db
	) {
		$this->creation = $creation;
		$this->reader = $reader;
		$this->storedReader = $storedReader;
		$this->publisher = $publisher;
		$this->titles = $titles;
		$this->scope = $scope;
		$this->db = $db;
	}

	/**
	 * Read an exact other-owner source while freshly admitting a still-missing literal target.
	 * Stored history is never supplemented with the virtual new member. No result grants authority.
	 *
	 * @param int $pageId Existing target owner
	 * @param int $baseRevisionId Explicit current base
	 * @param string $surfaceId Native admitted target ID
	 * @param int $start Saved embed UTF-8 byte offset
	 * @param string $expected Complete saved embed bytes
	 * @param array $source Exact sourcePageId/sourceRevisionId/sourceSurfaceId record
	 * @param Authority $authority Original requester
	 * @return array creation (unchanged admission), source descriptor and complete sourceBundle
	 * @throws \DomainException Fixed unavailable refusal
	 */
	public function read( int $pageId, int $baseRevisionId, string $surfaceId, int $start,
		string $expected, array $source, Authority $authority
	): array {
		try {
			$this->assertSource( $source );
			$captured = null;
			for ( $i = 0; $i < 3; $i++ ) {
				$creation = $this->creation->prepare( $pageId, $baseRevisionId, $surfaceId, $start,
					$expected, $authority );
				$sourceRead = $this->readSource( $pageId, $source, $authority );
				$this->assertCompatible( $creation['newSurface'],
					$this->member( $sourceRead['sourceBundle']['snapshot'], $source['sourceSurfaceId'] ) );
				$fresh = [ 'creation' => $creation ] + $sourceRead;
				if ( $captured !== null && $fresh !== $captured ) {
					throw new \DomainException();
				}
				$captured = $fresh;
			}
			// Source reads can run native callbacks: repeat current target authorization last.
			if ( $this->creation->prepare( $pageId, $baseRevisionId, $surfaceId, $start,
				$expected, $authority ) !== $captured['creation'] ) {
				throw new \DomainException();
			}
			return $captured;
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-working-copy-import-unavailable' );
		}
	}

	/**
	 * Publish exactly one new image/slide member, retaining every stored sibling and root field.
	 * Source citations use native titles/revisions; optional words cannot truncate provenance.
	 * Existing APIs/callers are unchanged. Endpoint controls and editor integration remain required.
	 *
	 * @param int $pageId Existing target owner
	 * @param int $baseRevisionId Current base, never zero
	 * @param string $surfaceId Native admitted target ID
	 * @param int $start Saved embed byte offset
	 * @param string $expected Complete saved embed bytes
	 * @param string $json Complete proposed snapshot
	 * @param array[] $sources Exact sourcePageId/sourceRevisionId/sourceSurfaceId records
	 * @param Authority $authority Original requester
	 * @param string $note Optional editor words
	 * @return int New owning-page revision, without retries
	 * @throws PublicationException Fixed unavailable or existing publisher refusal
	 */
	public function publish( int $pageId, int $baseRevisionId, string $surfaceId, int $start,
		string $expected, string $json, array $sources, Authority $authority, string $note = ''
	): int {
		try {
			if ( !$sources || !array_is_list( $sources ) || count( $sources ) > 32 ||
				strlen( $json ) > DocumentSchema::MAX_BYTES || !mb_check_encoding( $note, 'UTF-8' ) ) {
				throw new \DomainException();
			}
			json_decode( $json, true, 64, JSON_THROW_ON_ERROR );
			JsonSnapshotCodec::rejectDuplicateKeys( $json );
			$content = new LayersDocumentContent( $json );
			$json = $content->getCanonicalText();
			$document = json_decode( $json, true, 64, JSON_THROW_ON_ERROR );
			$captures = [];
			$items = [];
			$creation = null;
			foreach ( $sources as $source ) {
				$this->assertSource( $source );
				$key = JsonSnapshotCodec::encode( $source );
				if ( isset( $captures[$key] ) ) {
					continue;
				}
				$read = $this->read( $pageId, $baseRevisionId, $surfaceId, $start, $expected, $source, $authority );
				if ( $creation !== null && $creation !== $read['creation'] ) {
					throw new \DomainException();
				}
				$creation = $read['creation'];
				$this->assertProposed( $creation, $document );
				$member = $this->member( $read['sourceBundle']['snapshot'], $source['sourceSurfaceId'] );
				$title = $this->title( $source['sourcePageId'], $read['source']['owner'] );
				$items[] = wfMessage( 'layers-copy-summary' )->plaintextParams( $member['label'] )
					->params( $title->getPrefixedText(), (string)$source['sourceRevisionId'] )
					->inContentLanguage()->text();
				$captures[$key] = [ 'source' => $source, 'read' => $read ];
			}
			$owner = $this->title( $pageId, $creation['target']['owner'] );
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

		$before = function () use ( $pageId, $baseRevisionId, $surfaceId, $start, $expected,
			$captures, $authority
		): void {
			try {
				foreach ( $captures as $capture ) {
					if ( $this->read( $pageId, $baseRevisionId, $surfaceId, $start, $expected,
						$capture['source'], $authority ) !== $capture['read'] ) {
						throw new \DomainException();
					}
				}
			} catch ( \Throwable $error ) {
				throw new PublicationException( 'layers-working-copy-import-unavailable' );
			}
		};
		$dbw = $this->db->getPrimaryDatabase();
		return $dbw->doAtomicSection( __METHOD__, function () use ( $owner, $authority, $pageId,
			$baseRevisionId, $json, $summary, $before, $captures, $surfaceId, $creation, $document
		): int {
			$revision = $this->publisher->publish( $owner, $authority, $baseRevisionId, $json,
				$summary, null, $pageId, null, $before );
			try {
				foreach ( $captures as $capture ) {
					$source = $capture['source'];
					// Creation admission now correctly refuses: use the existing stored-member boundary.
					$fresh = $this->storedReader->read( $pageId, $revision, $surfaceId,
						$source['sourcePageId'], $source['sourceRevisionId'], $source['sourceSurfaceId'], $authority );
					if ( $fresh['source'] !== $capture['read']['source'] ||
						$fresh['sourceBundle'] !== $capture['read']['sourceBundle'] ||
						$fresh['target']['owner'] !== $creation['target']['owner'] ||
						JsonSnapshotCodec::encode( $fresh['targetBundle']['snapshot'] ) !==
							JsonSnapshotCodec::encode( $document ) ) {
						throw new \DomainException();
					}
				}
			} catch ( \Throwable $error ) {
				throw new PublicationException( 'layers-working-copy-import-unavailable' );
			}
			return $revision;
		}, $dbw::ATOMIC_CANCELABLE );
	}

	private function assertSource( array $source ): void {
		$keys = array_keys( $source );
		sort( $keys );
		if ( $keys !== [ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ] ||
			!is_string( $source['sourceSurfaceId'] ) ||
			!preg_match( '/^[A-Za-z0-9_.:-]{1,80}$/D', $source['sourceSurfaceId'] ) ) {
			throw new \DomainException();
		}
		foreach ( [ 'sourcePageId', 'sourceRevisionId' ] as $key ) {
			if ( !is_int( $source[$key] ) || $source[$key] < 1 || $source[$key] > 2147483647 ) {
				throw new \DomainException();
			}
		}
	}

	private function title( int $pageId, ?string $expected = null ): Title {
		$title = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$title || !$title->canExist() || $title->isExternal() || $title->hasFragment() ||
			$title->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ||
			!$this->scope->includes( $title, IDBAccessObject::READ_LATEST ) ||
			( $expected !== null && $title->getPrefixedDBkey() !== $expected ) ) {
			throw new \DomainException();
		}
		return $title;
	}

	private function readSource( int $targetPageId, array $source, Authority $authority ): array {
		if ( $targetPageId === $source['sourcePageId'] ) {
			throw new \DomainException();
		}
		$owner = $this->title( $source['sourcePageId'] );
		$bundle = $this->reader->read( $owner, $source['sourceRevisionId'], $authority,
			$source['sourcePageId'], [ $source['sourceSurfaceId'] ] );
		$bundle = json_decode( json_encode( $bundle, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION ),
			true, 64, JSON_THROW_ON_ERROR );
		if ( ( $bundle['revisionId'] ?? null ) !== $source['sourceRevisionId'] ||
			!in_array( $this->member( $bundle['snapshot'], $source['sourceSurfaceId'] )['kind'] ?? null,
				[ 'image', 'slide' ], true ) || !$authority->authorizeRead( 'read',
				$this->title( $source['sourcePageId'], $owner->getPrefixedDBkey() ) ) ) {
			throw new \DomainException();
		}
		return [ 'source' => [ 'pageId' => $source['sourcePageId'], 'owner' => $owner->getPrefixedDBkey(),
			'revisionId' => $source['sourceRevisionId'], 'surfaceId' => $source['sourceSurfaceId'] ],
			'sourceBundle' => $bundle ];
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

	private function assertCompatible( array $target, array $source ): void {
		if ( $source['kind'] !== $target['kind'] || !is_string( $source['label'] ?? null ) ||
			DrawingName::normalize( $source['label'] ) === null ||
			DrawingName::key( $source['label'] ) !== DrawingName::key( $target['label'] ) ||
			( $target['kind'] === 'image' &&
				$source['source']['fileTitle'] !== $target['source']['fileTitle'] ) ) {
			throw new \DomainException();
		}
	}

	private function assertProposed( array $creation, array $document ): void {
		$target = $creation['newSurface'];
		$proposed = $this->member( $document, $target['id'] );
		$working = array_flip( [ 'canvas', 'layers', 'readingOrder' ] );
		if ( JsonSnapshotCodec::encode( array_diff_key( $proposed, $working ) ) !==
			JsonSnapshotCodec::encode( array_diff_key( $target, $working ) ) ) {
			throw new \DomainException();
		}
		$withoutNew = $document;
		$withoutNew['surfaces'] = array_values( array_filter( $document['surfaces'],
			static fn ( $member ) => $member['id'] !== $target['id'] ) );
		$base = $creation['baseBundle']['snapshot'] ?? [ 'schemaVersion' => 1, 'surfaces' => [] ];
		if ( JsonSnapshotCodec::encode( $withoutNew ) !== JsonSnapshotCodec::encode( $base ) ) {
			throw new \DomainException();
		}
	}
}
