<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Copy another page's drawing into this page when this page's embed names it (D1 (b), HIST-5).
 * The copy is a new drawing with its own ID; nothing links it to the original afterwards.
 * Internal composition: HTTP callers must enforce POST, CSRF, rate limits and confirmation.
 */
class PageDrawingCopy {
	private PageOwnedIdentityResolver $identities;
	private RevisionLookup $revisions;
	private TitleFactory $titles;
	private PageHistoryAccess $access;
	private PagePublicationService $publisher;
	private DirectEmbeddingRewriter $rewriter;
	/** @var callable */
	private $fileTargets;
	/** @var callable|null */
	private $sourcePages;

	/**
	 * @param PageOwnedIdentityResolver $identities
	 * @param RevisionLookup $revisions
	 * @param TitleFactory $titles
	 * @param PagePublicationService $publisher
	 * @param DirectEmbeddingRewriter $rewriter Scanner configured with the wiki's extension tags
	 * @param callable $fileTargets Canonical `File:` target of a link head, or null
	 * @param callable|null $sourcePages Native effective file page for a scanned embed
	 */
	public function __construct( PageOwnedIdentityResolver $identities, RevisionLookup $revisions,
		TitleFactory $titles, PagePublicationService $publisher, DirectEmbeddingRewriter $rewriter,
		callable $fileTargets, ?callable $sourcePages = null
	) {
		$this->identities = $identities;
		$this->revisions = $revisions;
		$this->titles = $titles;
		$this->access = new PageHistoryAccess( $revisions );
		$this->publisher = $publisher;
		$this->rewriter = $rewriter;
		$this->fileTargets = $fileTargets;
		$this->sourcePages = $sourcePages;
	}

	/**
	 * Embeds of the current revision that name a drawing of another page this editor can read and copy.
	 * @param int $pageId
	 * @param int $revisionId Displayed revision; must still be current
	 * @param Authority $authority
	 * @return array[] label, source page Title and confirmation route parameters
	 */
	public function listCandidates( int $pageId, int $revisionId, Authority $authority ): array {
		try {
			[ $owner, $main, $taken ] = $this->target( $pageId, $revisionId, $authority );
		} catch ( \DomainException $e ) {
			return [];
		}
		$entries = [];
		foreach ( $this->rewriter->scan( $main, $this->fileTargets ) as $candidate ) {
			try {
				$source = $this->source( $candidate, $pageId, null, $authority );
				if ( !$source || isset( $taken[LayerSetIdentity::key( $source['surface'] )] ) ) {
					continue;
				}
				$entries[] = [ 'label' => $source['label'], 'source' => $source['title'], 'params' => [
					'pageid' => $pageId, 'revid' => $revisionId, 'start' => $candidate['start'],
					'expected' => $candidate['raw'], 'sourcerev' => $source['revisionId']
				] ];
			} catch ( \DomainException | \InvalidArgumentException $e ) {
				// Drawings this editor cannot read, or embeds the source rules refuse, are not offered.
			}
		}
		return $entries;
	}

	/**
	 * Every check copy() makes, without writing, for the confirmation step.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $sourceRevisionId The source page revision the offer showed
	 * @param Authority $authority
	 * @return array owner and source Titles, label and source revision
	 * @throws PublicationException
	 */
	public function preview( int $pageId, int $revisionId, int $start, string $expected, int $sourceRevisionId,
		Authority $authority
	): array {
		$prepared = $this->prepare( $pageId, $revisionId, $start, $expected, $sourceRevisionId, $authority );
		unset( $prepared['document'], $prepared['main'] );
		return $prepared;
	}

	/**
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $sourceRevisionId
	 * @param Authority $authority
	 * @param string $note Optional words of the copier, after the recorded source
	 * @return int New revision of this page
	 * @throws PublicationException No automatic retry
	 */
	public function copy( int $pageId, int $revisionId, int $start, string $expected, int $sourceRevisionId,
		Authority $authority, string $note
	): int {
		$prepared = $this->prepare( $pageId, $revisionId, $start, $expected, $sourceRevisionId, $authority );
		$summary = wfMessage( 'layers-copy-summary' )->plaintextParams( $prepared['label'] )
			->params( $prepared['source']->getPrefixedText(), (string)$sourceRevisionId )
			->inContentLanguage()->text();
		if ( trim( $note ) !== '' ) {
			$summary .= wfMessage( 'colon-separator' )->inContentLanguage()->text() . trim( $note );
		}
		return $this->publisher->publish( $prepared['owner'], $authority, $revisionId, $prepared['document'],
			$summary, new WikitextContent( $prepared['main'] ), $pageId );
	}

	/**
	 * Every check copyFromList() makes, without writing, for the confirmation step.
	 * @param int $pageId This page
	 * @param int $revisionId This page's revision the copy is based on; must still be current
	 * @param int $sourcePageId
	 * @param string $sourceSurfaceId
	 * @param int $sourceRevisionId The source revision the list showed
	 * @param Authority $authority
	 * @return array owner and source Titles, label and source revision
	 * @throws PublicationException
	 */
	public function previewFromList( int $pageId, int $revisionId, int $sourcePageId, string $sourceSurfaceId,
		int $sourceRevisionId, Authority $authority
	): array {
		$prepared = $this->prepareFromList( $pageId, $revisionId, $sourcePageId, $sourceSurfaceId,
			$sourceRevisionId, $authority );
		unset( $prepared['document'] );
		return $prepared;
	}

	/**
	 * A drawing picked from the editor's list of other pages' drawings becomes a new drawing of this page.
	 * The page's text is untouched: the author embeds the copy where it should appear.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $sourcePageId
	 * @param string $sourceSurfaceId
	 * @param int $sourceRevisionId
	 * @param Authority $authority
	 * @param string $note Optional words of the copier, after the recorded source
	 * @return int New revision of this page
	 * @throws PublicationException No automatic retry
	 */
	public function copyFromList( int $pageId, int $revisionId, int $sourcePageId, string $sourceSurfaceId,
		int $sourceRevisionId, Authority $authority, string $note
	): int {
		$prepared = $this->prepareFromList( $pageId, $revisionId, $sourcePageId, $sourceSurfaceId,
			$sourceRevisionId, $authority );
		$summary = wfMessage( 'layers-copy-summary' )->plaintextParams( $prepared['label'] )
			->params( $prepared['source']->getPrefixedText(), (string)$sourceRevisionId )
			->inContentLanguage()->text();
		if ( trim( $note ) !== '' ) {
			$summary .= wfMessage( 'colon-separator' )->inContentLanguage()->text() . trim( $note );
		}
		return $this->publisher->publish( $prepared['owner'], $authority, $revisionId, $prepared['document'],
			$summary, null, $pageId );
	}

	/**
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $sourcePageId
	 * @param string $sourceSurfaceId
	 * @param int $sourceRevisionId
	 * @param Authority $authority
	 * @return array
	 * @throws PublicationException
	 */
	private function prepareFromList( int $pageId, int $revisionId, int $sourcePageId, string $sourceSurfaceId,
		int $sourceRevisionId, Authority $authority
	): array {
		if ( $sourcePageId < 1 || $sourcePageId === $pageId || $sourceRevisionId < 1 ||
			$sourceRevisionId > 2147483647 || !preg_match( '/^[A-Za-z0-9_.:-]{1,80}$/D', $sourceSurfaceId )
		) {
			throw new PublicationException( 'layers-copy-source-unavailable' );
		}
		try {
			[ $owner, , , $document ] = $this->target( $pageId, $revisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() === 'layers-edit-conflict' ?
				'layers-edit-conflict' : 'layers-owner-unavailable' );
		}
		try {
			$title = $this->titles->newFromID( $sourcePageId, IDBAccessObject::READ_LATEST );
			if ( !$title ) {
				throw new \InvalidArgumentException();
			}
			// Objects, not arrays: an empty JSON object in a layer must stay an object in the copy.
			$source = json_decode( $this->access->read( $title, $sourceRevisionId, $authority, $sourcePageId )
				->getText(), false, 64, JSON_THROW_ON_ERROR );
		} catch ( \DomainException | \InvalidArgumentException | \JsonException $e ) {
			throw new PublicationException( 'layers-copy-source-unavailable' );
		}
		$copy = null;
		foreach ( $source->surfaces as $surface ) {
			if ( $surface->id === $sourceSurfaceId ) {
				$copy = clone $surface;
			}
		}
		if ( !$copy ) {
			throw new PublicationException( 'layers-copy-source-unavailable' );
		}
		$taken = LayerSetIdentity::namesInScope( $document->surfaces, $copy );
		$label = DrawingName::unused( DrawingName::normalize( (string)$copy->label ) ?? 'Copy', $taken );
		$document->surfaces = array_merge( $document->surfaces,
			self::copySet( $source->surfaces, $copy, $pageId, $revisionId, $label ) );
		return [ 'owner' => $owner, 'source' => $title, 'label' => $label, 'sourceRevision' => $sourceRevisionId,
			'document' => JsonSnapshotCodec::encode( $document ) ];
	}

	/**
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $sourceRevisionId
	 * @param Authority $authority
	 * @return array
	 * @throws PublicationException
	 */
	private function prepare( int $pageId, int $revisionId, int $start, string $expected, int $sourceRevisionId,
		Authority $authority
	): array {
		if ( $start < 0 || $expected === '' || $sourceRevisionId < 1 || $sourceRevisionId > 2147483647 ) {
			throw new PublicationException( 'layers-invalid-publication-request' );
		}
		try {
			[ $owner, $main, $taken, $document ] = $this->target( $pageId, $revisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() === 'layers-edit-conflict' ?
				'layers-edit-conflict' : 'layers-owner-unavailable' );
		}
		try {
			$selected = null;
			foreach ( $this->rewriter->scan( $main, $this->fileTargets ) as $candidate ) {
				if ( $candidate['start'] === $start && $candidate['raw'] === $expected ) {
					$selected = $candidate;
				}
			}
			$source = $selected ? $this->source( $selected, $pageId, $sourceRevisionId, $authority ) : null;
			if ( !$source ) {
				throw new \InvalidArgumentException();
			}
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-copy-source-unavailable' );
		}
		if ( isset( $taken[LayerSetIdentity::key( $source['surface'] )] ) ) {
			throw PublicationException::refusedName( $source['label'], true );
		}
		$document->surfaces = array_merge( $document->surfaces,
			self::copySet( $source['surfaces'], $source['surface'], $pageId, $revisionId, $source['label'] ) );
		try {
			$main = $this->rewriter->rewrite( $main, $start, $expected, $pageId, $source['label'], $this->fileTargets );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-embedding-selection-unavailable' );
		}
		return [ 'owner' => $owner, 'source' => $source['title'], 'label' => $source['label'],
			'sourceRevision' => $sourceRevisionId, 'main' => $main,
			'document' => JsonSnapshotCodec::encode( $document ) ];
	}

	/**
	 * This page at its current revision, as its editor sees it.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param Authority $authority
	 * @return array [ owner Title, main text, taken name keys, document ]
	 * @throws \DomainException
	 */
	private function target( int $pageId, int $revisionId, Authority $authority ): array {
		$owner = $this->identities->resolveForEdit( $pageId, $revisionId, $authority );
		$revision = $this->revisions->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
		$main = $revision ? $revision->getContent( SlotRecord::MAIN, RevisionRecord::FOR_THIS_USER, $authority ) : null;
		if ( !$main instanceof WikitextContent ) {
			throw new \DomainException( 'layers-owner-unavailable' );
		}
		$document = $revision->hasSlot( PageRevisionWriter::SLOT ) ?
			json_decode( $this->access->read( $owner, $revisionId, $authority, $pageId )->getText(), false, 64,
				JSON_THROW_ON_ERROR ) :
			(object)[ 'schemaVersion' => DocumentSchema::VERSION, 'surfaces' => [] ];
		$taken = [];
		foreach ( $document->surfaces as $surface ) {
			$taken[LayerSetIdentity::key( $surface )] = true;
		}
		return [ $owner, $main->getText(), $taken, $document ];
	}

	/**
	 * The other page's drawing an embed names, read with the copier's own rights.
	 * @param array $candidate Scanned embed
	 * @param int $pageId This page, whose own drawings are never "copied"
	 * @param int|null $revisionId Exact source revision, or null for the source page's current one
	 * @param Authority $authority
	 * @return array|null title, revisionId, label and surface; null when the embed names this page or nothing
	 * @throws \DomainException|\InvalidArgumentException
	 */
	private function source( array $candidate, int $pageId, ?int $revisionId, Authority $authority ): ?array {
		if ( PageOwnedBindingOptions::extract( $candidate['options'] ) !== null ) {
			return null;
		}
		$named = PageOwnedBindingOptions::named( $candidate['options'], $candidate['kind'], $candidate['target'] );
		if ( $named === null || $named['pageId'] === $pageId ) {
			return null;
		}
		$title = $this->titles->newFromID( $named['pageId'], IDBAccessObject::READ_LATEST );
		if ( !$title ) {
			return null;
		}
		$revisionId ??= $title->getLatestRevID( IDBAccessObject::READ_LATEST );
		// Objects, not arrays: an empty JSON object in a layer must stay an object in the copy.
		$text = $this->access->read( $title, $revisionId, $authority, $named['pageId'] )->getText();
		$surfaceId = PageOwnedBinding::resolveNamed( $named,
			json_decode( $text, true, 64, JSON_THROW_ON_ERROR )['surfaces'],
			$candidate['kind'], $candidate['kind'] === 'file' ? $candidate['target'] : null,
			$candidate['kind'] === 'file' ? $this->sourcePage( $candidate ) : null );
		$surfaces = $surfaceId === null ? [] : json_decode( $text, false, 64, JSON_THROW_ON_ERROR )->surfaces;
		foreach ( $surfaces as $surface ) {
			if ( $surface->id === $surfaceId ) {
				$label = DrawingName::normalize( (string)$surface->label ) ?? $named['name'];
				return [ 'title' => $title, 'revisionId' => $revisionId, 'label' => $label, 'surface' => $surface,
					'surfaces' => $surfaces ];
			}
		}
		return null;
	}

	/**
	 * Copy every internal page of the selected set from the same exact source revision.
	 * @param \stdClass[] $surfaces
	 * @param \stdClass $selected
	 * @param int $pageId
	 * @param int $revisionId
	 * @param string $label One allocated destination name
	 * @return \stdClass[]
	 */
	private static function copySet( array $surfaces, \stdClass $selected, int $pageId, int $revisionId,
		string $label
	): array {
		$key = LayerSetIdentity::key( $selected );
		$copies = [];
		foreach ( $surfaces as $surface ) {
			if ( LayerSetIdentity::key( $surface ) !== $key ) {
				continue;
			}
			$copy = clone $surface;
			$copy->id = NewPageDrawing::surfaceId( $pageId, $revisionId, $label,
				$copy->kind === 'slide' ? null : $copy->source->fileTitle,
				$copy->kind === 'pdf' ? $copy->source->page : 1 );
			$copy->label = $label;
			$copies[] = $copy;
		}
		return $copies;
	}

	/** @param array $candidate Scanned embed @return int Effective file page */
	private function sourcePage( array $candidate ): int {
		if ( $this->sourcePages !== null ) {
			return ( $this->sourcePages )( $candidate );
		}
		return PageOwnedBindingOptions::sourcePage( $candidate['options'], static function ( string $option ): ?string {
			$parts = explode( '=', $option, 2 );
			return trim( $parts[0] ) === 'page' && isset( $parts[1] ) ? $parts[1] : null;
		} );
	}
}
