<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Prepares matched source text and drawing together; no public endpoint or publication. */
class DirectAdoptionPreparationService {
	private PageOwnedIdentityResolver $identities;
	private RevisionLookup $revisions;
	private TitleFactory $titles;
	private LegacyAdoptionPreparationService $legacy;
	private DirectEmbeddingRewriter $rewriter;
	/** @var callable|null (string $slideName): ?string */
	private $displayedSet;

	/**
	 * @param PageOwnedIdentityResolver $identities
	 * @param RevisionLookup $revisions
	 * @param TitleFactory $titles
	 * @param LegacyAdoptionPreparationService $legacy
	 * @param DirectEmbeddingRewriter|null $rewriter Scanner configured with the wiki's extension tags
	 * @param callable|null $displayedSet Set a slide without `layerset=` shows; null requires a selector
	 */
	public function __construct( PageOwnedIdentityResolver $identities, RevisionLookup $revisions,
		TitleFactory $titles, LegacyAdoptionPreparationService $legacy, ?DirectEmbeddingRewriter $rewriter = null,
		?callable $displayedSet = null
	) {
		$this->identities = $identities;
		$this->revisions = $revisions;
		$this->titles = $titles;
		$this->legacy = $legacy;
		$this->rewriter = $rewriter ?? new DirectEmbeddingRewriter();
		$this->displayedSet = $displayedSet;
	}

	/**
	 * Prepare against original authorized base bytes, never caller-provided full wikitext.
	 * Caller must explicitly select/confirm the immutable legacy row, not assume latest.
	 * Rendering admission and final native publication checks remain mandatory.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param int $start Byte offset of the selected direct embed
	 * @param string $expected Complete expected original embed bytes
	 * @param int $legacyRevisionId Exact selected legacy row ID
	 * @param string|null $fileTimestamp
	 * @param Authority $authority
	 * @return array Server-only proposal including prepared WikitextContent in main
	 * @throws PublicationException Fixed failure
	 */
	public function prepare( int $pageId, int $baseRevisionId, int $start, string $expected,
		int $legacyRevisionId, ?string $fileTimestamp, Authority $authority
	): array {
		try {
			$this->identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() );
		}
		$revision = $this->revisions->getRevisionById( $baseRevisionId, IDBAccessObject::READ_LATEST );
		if ( !$revision || $revision->getPageId() !== $pageId ||
			!RevisionRecord::userCanBitfield( $revision->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $revision->getPage() ) ) {
			throw new PublicationException( 'layers-owner-unavailable' );
		}
		$main = $revision->getContent( SlotRecord::MAIN, RevisionRecord::FOR_THIS_USER, $authority );
		if ( !$main instanceof WikitextContent ) {
			throw new PublicationException( 'layers-main-model-change-denied' );
		}
		$resolveFile = function ( string $name ): ?string {
			$title = $this->titles->newFromText( $name );
			return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() &&
				!$title->isExternal() ? 'File:' . $title->getDBkey() : null;
		};
		$rewriter = $this->rewriter;
		try {
			$selected = null;
			foreach ( $rewriter->scan( $main->getText(), $resolveFile ) as $candidate ) {
				if ( $candidate['start'] === $start && $candidate['raw'] === $expected ) {
					$selected = $candidate;
					break;
				}
			}
			if ( $selected === null ) {
				throw new \InvalidArgumentException();
			}
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-embedding-source-unavailable' );
		}
		$proposal = $this->legacy->prepare( $pageId, $baseRevisionId, $legacyRevisionId, $fileTimestamp, $authority );
		try {
			$displayed = null;
			if ( $selected['kind'] === 'slide' && $this->displayedSet &&
				!self::hasSetSelector( $selected['options'] )
			) {
				$displayed = ( $this->displayedSet )( $selected['target'] );
			}
			DirectEmbeddingSelection::assertMatches( $selected, $proposal['legacySelection'], $displayed );
			$proposal['document'] = $this->nameDrawing( $proposal['document'], $selected, $revision, $authority );
			$name = json_decode( $proposal['document'] )->surfaces[0]->label;
			$boundMain = $rewriter->rewrite( $main->getText(), $start, $expected, $pageId, $name, $resolveFile );
		} catch ( \InvalidArgumentException $e ) {
			throw new PublicationException( 'layers-embedding-selection-unavailable' );
		}
		$this->assertViewerCapabilities( $proposal['document'] );
		$proposal['main'] = new WikitextContent( $boundMain );
		return $proposal;
	}

	/**
	 * Name the adopted drawing so the rewritten embed can refer to it: a slide after the slide, an image
	 * or PDF drawing after its set, with a number if the base revision already has that name.
	 * @param string $document Single-surface document
	 * @param array $selected Scanned embed
	 * @param RevisionRecord $base
	 * @param Authority $authority
	 * @return string The document with its final name
	 */
	private function nameDrawing( string $document, array $selected, RevisionRecord $base,
		Authority $authority
	): string {
		$existing = [];
		if ( $base->hasSlot( PageRevisionWriter::SLOT ) ) {
			$stored = $base->getContent( PageRevisionWriter::SLOT, RevisionRecord::FOR_THIS_USER, $authority );
			if ( !$stored instanceof LayersDocumentContent ) {
				throw new \InvalidArgumentException();
			}
			$existing = json_decode( $stored->getText() )->surfaces;
		}
		$doc = json_decode( $document );
		$surface = $doc->surfaces[0];
		$wanted = $selected['kind'] === 'slide' ? $selected['target'] : (string)$surface->label;
		$surface->label = DrawingName::normalize( $wanted ) ?? $surface->id;
		$taken = LayerSetIdentity::namesInScope( $existing, $surface );
		$group = array_values( array_filter( $existing, static fn ( $item ) =>
			LayerSetIdentity::key( $item ) === LayerSetIdentity::key( $surface ) ) );
		$hasPage = array_filter( $group, static fn ( $item ) =>
			LayerSetIdentity::surfaceKey( $item ) === LayerSetIdentity::surfaceKey( $surface ) );
		if ( $surface->kind === 'pdf' && $group && !$hasPage ) {
			// An additional PDF page belongs to the same layer set and keeps its name and source pin.
			$label = (string)$group[0]->label;
			foreach ( $group as $item ) {
				if ( $item->kind !== 'pdf' || $item->label !== $label ||
					$item->source->timestamp !== $surface->source->timestamp ||
					$item->source->sha1 !== $surface->source->sha1 ) {
					throw new \InvalidArgumentException();
				}
			}
			$surface->label = $label;
		} else {
			$surface->label = DrawingName::unused( $surface->label, $taken );
		}
		return JsonSnapshotCodec::encode( $doc );
	}

	/**
	 * @param string[] $options Raw embed options
	 * @return bool
	 */
	private static function hasSetSelector( array $options ): bool {
		foreach ( $options as $option ) {
			$key = strtolower( trim( explode( '=', $option, 2 )[0], " \t\r\n\f" ) );
			if ( in_array( $key, [ 'layerset', 'layers', 'layer' ], true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Refuse content the historical viewer cannot draw before returning an adoptable proposal.
	 * This is a capability boundary, not proof of visual parity for every effect/font.
	 * Structural conversion remains reusable for image/PDF preparation without public exposure.
	 * @param string $document Already validated server-produced single-surface document
	 */
	private function assertViewerCapabilities( string $document ): void {
		$surface = json_decode( $document )->surfaces[0];
		// Hidden unsupported content must survive future editing too; never silently discard it.
		if ( !in_array( $surface->kind, [ 'slide', 'image', 'pdf' ], true ) ||
			!PageOwnedRenderCapability::isRenderable( $surface )
		) {
			throw new PublicationException( 'layers-adoption-rendering-unavailable' );
		}
	}
}
