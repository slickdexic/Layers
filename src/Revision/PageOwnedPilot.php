<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Api\ApiMain;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Api\ApiLayersDrawings;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotLifecycleHooks;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Migration\MigrationUndo;
use MediaWiki\Extension\Layers\Migration\PageCopyMigration;
use MediaWiki\Extension\Layers\Migration\SlidePageMigration;
use MediaWiki\FileRepo\File\File;
use MediaWiki\MediaWikiServices;
use MediaWiki\Page\MergeHistoryFactory;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\SpecialPage\SpecialPage;
use OldRevisionImporter;
use Wikimedia\Rdbms\IDBAccessObject;

/** Shared native pilot composition. Does not register endpoints or hooks by itself. */
class PageOwnedPilot {
	private MediaWikiServices $services;
	private PageOwnedScope $scope;
	private PagePublicationService $publisher;
	private PageReadService $reader;
	private NewPageDrawing $newDrawings;

	/**
	 * @param MediaWikiServices $services Fully initialized native service container
	 * @param string[] $ownerKeys Titles, as exact prefixed DB keys, that may start drawings; see PageOwnedScope
	 * @param int[] $namespaces Namespaces all of whose pages may start drawings
	 */
	public function __construct( MediaWikiServices $services, array $ownerKeys = [], array $namespaces = [] ) {
		$this->scope = PageOwnedScope::newFromServices( $services, $ownerKeys, $namespaces );
		$this->services = $services;
		$access = new PageHistoryAccess( $services->getRevisionLookup() );
		$sources = new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(), $services->getTitleFactory() );
		$this->publisher = new PagePublicationService( $services->getWikiPageFactory(), $access, $sources,
			new PageRevisionWriter(), new PublicationAdmissionContext(), $services->getHookContainer(),
			$services->getUserFactory() );
		$this->reader = new PageReadService( $access, $sources, new SourceRenditions( $services->getUrlUtils() ) );
		$config = $services->getMainConfig();
		$this->newDrawings = new NewPageDrawing( $sources, new SourceRenditions( $services->getUrlUtils() ),
			$services->getRepoGroup()->getLocalRepo(), $services->getTitleFactory(), [
				'width' => $config->get( 'LayersSlideDefaultWidth' ),
				'height' => $config->get( 'LayersSlideDefaultHeight' ),
				'backgroundColor' => $config->get( 'LayersSlideDefaultBackground' )
			] );
	}

	/** @return PageOwnedScope Pages taking part in the pilot */
	public function getScope(): PageOwnedScope {
		return $this->scope;
	}

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @return ApiLayersPublish
	 */
	public function newPublishApi( ApiMain $main, string $name ): ApiLayersPublish {
		return new ApiLayersPublish( $main, $name, $this->publisher, $this->services->getTitleFactory(),
			$this->scope );
	}

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @return ApiLayersRead
	 */
	public function newReadApi( ApiMain $main, string $name ): ApiLayersRead {
		$config = $this->services->getMainConfig();
		return new ApiLayersRead( $main, $name, $this->reader, $this->services->getTitleFactory(),
			$this->scope, [ $this, 'prepareBoundViewers' ],
			$config->has( 'LayersBindingReadMaxAge' ) ? (int)$config->get( 'LayersBindingReadMaxAge' ) : 0,
			[ $this, 'prepareFullSizeViewer' ], [ $this, 'preparePdfEditorPage' ] );
	}

	/**
	 * @param \MediaWiki\Title\Title $owner
	 * @param int $revisionId
	 * @param string $binding
	 * @param int $targetPage
	 * @param Authority $authority
	 * @return array
	 */
	public function preparePdfEditorPage( \MediaWiki\Title\Title $owner, int $revisionId,
		string $binding, int $targetPage, Authority $authority
	): array {
		if ( !$this->scope->includes( $owner ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		require_once __DIR__ . '/PagePdfEditorReadService.php';
		$revisions = $this->services->getRevisionLookup();
		$sources = new SourceVersionResolver( $this->services->getRepoGroup()->getLocalRepo(),
			$this->services->getTitleFactory() );
		return ( new PagePdfEditorReadService( new PageHistoryAccess( $revisions ), $sources,
			new SourceRenditions( $this->services->getUrlUtils() ), $this->newDrawings, $revisions ) )
			->read( $owner, $revisionId, $binding, $targetPage, $authority );
	}

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @return ApiLayersDrawings
	 */
	public function newDrawingsApi( ApiMain $main, string $name ): ApiLayersDrawings {
		return new ApiLayersDrawings( $main, $name, $this );
	}

	/**
	 * Prepare the existing-surface editor bootstrap; does not register or render a route.
	 * Callers must serve this user-specific configuration without public caching.
	 * Historical viewing uses a separate read-only entry point, never this editor.
	 *
	 * @param string $ownerText Owner requested by the route
	 * @param int $revisionId Explicit current revision; no latest fallback
	 * @param string $surfaceId Literal selected surface ID
	 * @param Authority $authority Request authority, never a privileged substitute
	 * @return array Editor initialization without snapshot data; image/PDF surfaces carry their exact rendition URL
	 * @throws \DomainException Fixed unavailable result
	 */
	public function prepareEditor( string $ownerText, int $revisionId, string $surfaceId,
		Authority $authority
	): array {
		$owner = $this->services->getTitleFactory()->newFromText( $ownerText );
		if ( !$owner || !$owner->canExist() || $owner->hasFragment() ||
			!$this->scope->includes( $owner ) ||
			$revisionId < 1 || $revisionId > 2147483647 || $surfaceId === '' ||
			$authority->getUser()->getId() <= 0
		) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		try {
			$lookup = $this->services->getRevisionLookup();
			( new PageHistoryAccess( $lookup ) )->assertCanPrepareEdit( $owner, $authority );
			$bundle = $this->reader->read( $owner, $revisionId, $authority, null, [ $surfaceId ] );
			$current = $lookup->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
			if ( !$current || $current->getId() !== $revisionId || $current->getPageId() < 1 ||
				$current->getPageId() !== $owner->getArticleID()
			) {
				throw new \DomainException();
			}
		} catch ( \DomainException $e ) {
			throw new \DomainException( 'layers-editor-unavailable', 0, $e );
		}
		foreach ( $bundle['snapshot']['surfaces'] as $surface ) {
			if ( $surface['id'] !== $surfaceId ) {
				continue;
			}
			if ( $surface['kind'] !== 'slide' && !isset( $bundle['sourceRenditions'][$surfaceId] ) ) {
				break;
			}
			return $this->editorInit( $owner, $revisionId, $current->getPageId(), $surface,
				$bundle['sourceRenditions'][$surfaceId] ?? null, $authority );
		}
		throw new \DomainException( 'layers-editor-unavailable' );
	}

	/**
	 * @param \MediaWiki\Title\Title $owner
	 * @param int $revisionId
	 * @param int $pageId
	 * @param array $surface The drawing to edit
	 * @param array|null $rendition Pinned file rendition of an image or PDF drawing
	 * @param Authority $authority
	 * @return array Editor bootstrap
	 */
	private function editorInit( \MediaWiki\Title\Title $owner, int $revisionId, int $pageId, array $surface,
		?array $rendition, Authority $authority
	): array {
		if ( $surface['kind'] === 'slide' ) {
			$mode = [ 'imageUrl' => null, 'isSlide' => true, 'autoCreate' => false,
				'canvasWidth' => $surface['canvas']['width'], 'canvasHeight' => $surface['canvas']['height'],
				'backgroundColor' => $surface['canvas']['backgroundColor'] ?? null ];
		} else {
			// Layer coordinates stay in the surface canvas even when the rendition is narrower.
			$mode = [ 'imageUrl' => $rendition['url'], 'isSlide' => false,
				'autoCreate' => false, 'baseWidth' => $surface['canvas']['width'],
				'baseHeight' => $surface['canvas']['height'] ];
		}
		$config = $this->services->getMainConfig();
		return [ 'filename' => $owner->getPrefixedText() ] + $mode + [
			'pageOwned' => [
				'owner' => $owner->getPrefixedDBkey(), 'revisionId' => $revisionId,
				'pageId' => $pageId,
				'surfaceId' => $surface['id'], 'readOnly' => false,
				'draftScope' => [
					'wiki' => json_encode(
						[ $config->get( 'DBname' ), $config->get( 'DBprefix' ) ], JSON_THROW_ON_ERROR ),
					'user' => (string)$authority->getUser()->getId()
				]
			]
		];
	}

	/**
	 * Publish a deliberately confirmed direct adoption from selection identity only.
	 * Internal composition: HTTP callers must enforce POST, CSRF, rate limits and confirmation.
	 * Never accepts a client-prepared snapshot, surface ID or rewritten main content.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param int $start UTF-8 byte offset of the selected direct embedding
	 * @param string $expected Complete original source bytes
	 * @param int $legacyRevisionId Explicit immutable legacy row ID, never latest
	 * @param string|null $fileTimestamp Exact upload version; null for slides
	 * @param Authority $authority Original actor
	 * @param string $summary
	 * @return array Confirmed native page/revision/surface identity
	 * @throws PublicationException No automatic retry, including uncertain publication failures
	 */
	public function adoptDirectEmbedding( int $pageId, int $baseRevisionId, int $start, string $expected,
		int $legacyRevisionId, ?string $fileTimestamp, Authority $authority, string $summary
	): array {
		$identities = $this->assertAdoptionScope( $pageId, $baseRevisionId, $start, $expected,
			$legacyRevisionId, $authority );
		$proposal = $this->newAdoptionPreparer( $identities )->prepare( $pageId, $baseRevisionId, $start, $expected,
			$legacyRevisionId, $fileTimestamp, $authority );
		$this->assertCurrentFileVersion( $proposal, $fileTimestamp );
		$revisionId = ( new PageOwnedAdoptionService( $identities, $this->services->getRevisionLookup(),
			$this->publisher ) )->publishPreparedSurface( $pageId, $baseRevisionId, $authority,
				$proposal['document'], $proposal['main'], $summary );
		return [ 'pageId' => $pageId, 'revisionId' => $revisionId,
			'surfaceId' => $proposal['surfaceId'], 'binding' => $proposal['binding'] ];
	}

	/**
	 * Run every adoption check without writing, for the confirmation step.
	 * The result describes what the reader is asked to confirm; it is not an authorization token.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $legacyRevisionId
	 * @param Authority $authority
	 * @param string|null $fileTimestamp Exact upload version of a file embed; null for slides
	 * @return array owner Title, label, setName, revision, timestamp and userId of the copied drawing,
	 *  and for files the file page Title the drawing stays pinned to
	 * @throws PublicationException Same fixed failures adoption would report
	 */
	public function previewDirectAdoption( int $pageId, int $baseRevisionId, int $start, string $expected,
		int $legacyRevisionId, Authority $authority, ?string $fileTimestamp = null
	): array {
		$identities = $this->assertAdoptionScope( $pageId, $baseRevisionId, $start, $expected,
			$legacyRevisionId, $authority );
		$proposal = $this->newAdoptionPreparer( $identities )->prepare( $pageId, $baseRevisionId, $start, $expected,
			$legacyRevisionId, $fileTimestamp, $authority );
		$this->assertCurrentFileVersion( $proposal, $fileTimestamp );
		$record = $this->services->getService( 'LayersDatabase' )->getLayerSetForAdoption( $legacyRevisionId );
		if ( !$record ) {
			throw new PublicationException( 'layers-legacy-revision-unavailable' );
		}
		try {
			$owner = $identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() );
		}
		$file = $fileTimestamp === null ? null :
			$this->services->getTitleFactory()->makeTitle( NS_FILE, $proposal['legacySelection']['imgName'] );
		return [
			'owner' => $owner, 'file' => $file,
			'label' => $file ? $file->getText() :
				substr( $proposal['legacySelection']['imgName'], strlen( LayersConstants::SLIDE_PREFIX ) ),
			'setName' => $proposal['legacySelection']['name'], 'revision' => (int)$record['revision'],
			'timestamp' => (string)$record['timestamp'], 'userId' => (int)( $record['userId'] ?? 0 )
		];
	}

	/**
	 * Shared slides and file drawings on the current revision that an editor can make owned by the page.
	 * Each entry names the exact legacy row, and for files the exact file version, shown now;
	 * confirmation revalidates everything.
	 * @param int $pageId
	 * @param int $revisionId Displayed revision; must still be current
	 * @param Authority $authority
	 * @return array[] label, setName and confirmation route parameters
	 */
	public function listAdoptionCandidates( int $pageId, int $revisionId, Authority $authority ): array {
		try {
			if ( $authority->getUser()->getId() <= 0 ) {
				return [];
			}
			$lookup = $this->services->getRevisionLookup();
			$owner = $this->newIdentityResolver()->resolveForEdit( $pageId, $revisionId, $authority );
			if ( !$this->scope->includes( $owner ) ) {
				return [];
			}
			$revision = $lookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
			$main = $revision ? $revision->getContent( SlotRecord::MAIN,
				RevisionRecord::FOR_THIS_USER, $authority ) : null;
			if ( !$main instanceof WikitextContent ) {
				return [];
			}
			$db = $this->services->getService( 'LayersDatabase' );
			$entries = [];
			foreach ( $this->newRewriter()->scan( $main->getText(), $this->fileTargets() ) as $candidate ) {
				try {
					$options = $candidate['options'];
					if ( PageOwnedBindingOptions::extract( $options ) !== null ||
						PageOwnedBindingOptions::named( $options, $candidate['kind'], $candidate['target'] ) !== null
					) {
						continue;
					}
					if ( $candidate['kind'] === 'file' ) {
						$entry = $this->fileAdoptionCandidate( $candidate, $db );
						if ( $entry ) {
							$entry['params'] = [ 'pageid' => $pageId, 'revid' => $revisionId ] + $entry['params'];
							$entries[] = $entry;
						}
						continue;
					}
					$imgName = LayersConstants::SLIDE_PREFIX . $candidate['target'];
					$setName = self::explicitSetName( $candidate['options'] );
					$row = $setName === null ?
						$db->getLatestLayerSet( $imgName, LayersConstants::TYPE_SLIDE ) :
						$db->getLayerSetByName( $imgName, LayersConstants::TYPE_SLIDE, $setName );
					if ( !$row ) {
						continue;
					}
					// getLayerSetByName() returns setName; getLatestLayerSet() returns name.
					$rowName = (string)( $row['setName'] ?? $row['name'] ?? '' );
					DirectEmbeddingSelection::assertMatches( $candidate,
						[ 'imgName' => $imgName, 'name' => $rowName, 'page' => 1 ],
						$setName === null ? $rowName : null );
					$entries[] = [ 'label' => $candidate['target'], 'setName' => $rowName, 'params' => [
						'pageid' => $pageId, 'revid' => $revisionId, 'start' => $candidate['start'],
						'expected' => $candidate['raw'], 'legacyrev' => (int)$row['id']
					] ];
				} catch ( \InvalidArgumentException $e ) {
					// Embeds the conservative source rules cannot adopt are simply not offered.
				}
			}
			return $entries;
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			return [];
		}
	}

	/**
	 * A legacy file drawing shown by an explicit named set, pinned to the file version it is shown on now.
	 * @param array $candidate Direct file embed from the source scanner
	 * @param LayersDatabase $db
	 * @return array|null Entry, or null when the embed shows no adoptable drawing
	 * @throws \InvalidArgumentException When the embed does not match the row exactly
	 */
	private function fileAdoptionCandidate( array $candidate, LayersDatabase $db ): ?array {
		$setName = self::explicitSetName( $candidate['options'] );
		$title = $this->services->getTitleFactory()->newFromText( $candidate['target'] );
		$file = $setName !== null && $title ?
			$this->services->getRepoGroup()->getLocalRepo()->findFile( $title ) : false;
		if ( !$file || !$file->exists() || $file->isDeleted( File::DELETED_FILE ) ) {
			return null;
		}
		$page = 1;
		foreach ( $candidate['options'] as $option ) {
			$parts = explode( '=', $option, 2 );
			if ( strtolower( trim( $parts[0], " \t\r\n\f" ) ) === 'page' && isset( $parts[1] ) ) {
				$page = (int)trim( $parts[1], " \t\r\n\f" );
			}
		}
		// Legacy file embeds show the set saved for the current file version.
		$row = $db->getLayerSetByName( $file->getName(), $file->getSha1(), $setName, max( 1, $page ) );
		if ( !$row ) {
			return null;
		}
		$rowName = (string)( $row['setName'] ?? $row['name'] ?? '' );
		DirectEmbeddingSelection::assertMatches( $candidate,
			[ 'imgName' => $file->getName(), 'name' => $rowName, 'page' => (int)( $row['page'] ?? $page ) ] );
		return [ 'label' => $file->getTitle()->getText(), 'setName' => $rowName, 'params' => [
			'start' => $candidate['start'], 'expected' => $candidate['raw'], 'legacyrev' => (int)$row['id'],
			'filets' => $file->getTimestamp()
		] ];
	}

	/**
	 * @param string[] $options
	 * @return string|null Literal selector value, or null when the slide shows its latest set
	 */
	private static function explicitSetName( array $options ): ?string {
		foreach ( $options as $option ) {
			$parts = explode( '=', $option, 2 );
			$key = strtolower( trim( $parts[0], " \t\r\n\f" ) );
			if ( in_array( $key, [ 'layerset', 'layers', 'layer' ], true ) && isset( $parts[1] ) ) {
				return trim( $parts[1], " \t\r\n\f" );
			}
		}
		return null;
	}

	/**
	 * Common adoption preflight: pilot switch, actor, bounds, native owner/base and scope.
	 * @param int $pageId
	 * @param int $baseRevisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $legacyRevisionId
	 * @param Authority $authority
	 * @return PageOwnedIdentityResolver
	 */
	private function assertAdoptionScope( int $pageId, int $baseRevisionId, int $start, string $expected,
		int $legacyRevisionId, Authority $authority
	): PageOwnedIdentityResolver {
		if ( $authority->getUser()->getId() <= 0 ) {
			throw new PublicationException( 'layers-publication-disabled' );
		}
		if ( $start < 0 || $expected === '' || $legacyRevisionId < 1 || $legacyRevisionId > 2147483647 ) {
			throw new PublicationException( 'layers-invalid-publication-request' );
		}
		$identities = $this->newIdentityResolver();
		try {
			$owner = $identities->resolveForEdit( $pageId, $baseRevisionId, $authority );
		} catch ( \DomainException $e ) {
			throw new PublicationException( $e->getMessage() );
		}
		if ( !$this->scope->includes( $owner ) ) {
			throw new PublicationException( 'layers-publication-disabled' );
		}
		return $identities;
	}

	/**
	 * A file drawing is adopted only onto the version the page shows now. An older version would
	 * silently change the page's image, so a confirmation opened before a re-upload is refused.
	 * @param array $proposal Prepared adoption
	 * @param string|null $fileTimestamp
	 */
	private function assertCurrentFileVersion( array $proposal, ?string $fileTimestamp ): void {
		if ( $fileTimestamp === null ) {
			return;
		}
		$title = $this->services->getTitleFactory()->makeTitle( NS_FILE, $proposal['legacySelection']['imgName'] );
		$file = $this->services->getRepoGroup()->getLocalRepo()->findFile( $title, [ 'latest' => true ] );
		if ( !$file || !$file->exists() || $file->getTimestamp() !== $fileTimestamp ) {
			throw new PublicationException( 'layers-source-unavailable' );
		}
	}

	/** @return callable Canonical `File:` target of a link head, or null for anything that is not a file */
	private function fileTargets(): callable {
		$titles = $this->services->getTitleFactory();
		return static function ( string $name ) use ( $titles ): ?string {
			$title = $titles->newFromText( $name );
			return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() &&
				!$title->isExternal() ? 'File:' . $title->getDBkey() : null;
		};
	}

	/**
	 * The page drawing a scanned embed selects, by binding or by `<pageId>:<name>`.
	 * @param array $candidate From DirectEmbeddingRewriter::scan()
	 * @param array[]|callable $surfaces The page's drawings, or a function that reads them
	 * @param int $pageId The page carrying the embed; its bare names are its own drawings after the migration
	 * @return array|null Canonical identity
	 * @throws \InvalidArgumentException For a malformed selector
	 */
	private function embedBinding( array $candidate, $surfaces, int $pageId ): ?array {
		$binding = PageOwnedBindingOptions::extract( $candidate['options'] );
		$named = $binding === null ? PageOwnedBindingOptions::named( $candidate['options'], $candidate['kind'],
			$candidate['target'], self::bareOwner( $pageId ) ) : null;
		if ( $named === null ) {
			return $binding;
		}
		$sourcePage = $candidate['kind'] === 'file' ? $this->effectiveSourcePage( $candidate ) : null;
		$surfaceId = PageOwnedBinding::resolveNamed( $named, is_callable( $surfaces ) ? $surfaces() : $surfaces,
			$candidate['kind'], $candidate['kind'] === 'file' ? $candidate['target'] : null,
			$sourcePage );
		return $surfaceId === null ? null : [ 'pageId' => $named['pageId'], 'surfaceId' => $surfaceId ];
	}

	/** @param array $candidate Scanned embed @return int Native selected file page, or 1 */
	private function effectiveSourcePage( array $candidate ): int {
		if ( $candidate['kind'] !== 'file' ) {
			return 1;
		}
		$pageOptions = $this->services->getMagicWordFactory()->newArray( [ 'img_page' ] );
		$page = PageOwnedBindingOptions::sourcePage( $candidate['options'],
			static function ( string $option ) use ( $pageOptions ): ?string {
				[ $name, $value ] = $pageOptions->matchVariableStartToEnd( $option );
				return $name === 'img_page' ? $value : null;
			} );
		$title = $this->services->getTitleFactory()->newFromText( $candidate['target'] );
		$file = $title ? $this->services->getRepoGroup()->findFile( $title ) : false;
		if ( $file && $file->getMimeType() !== 'application/pdf' ) {
			return 1;
		}
		return $file && $file->isMultipage() && $file->pageCount() > 0 ? min( $page, $file->pageCount() ) : $page;
	}

	/**
	 * @param int $pageId
	 * @return int|null The page, once the migration has made bare names mean its own drawings
	 */
	private static function bareOwner( int $pageId ): ?int {
		return MigrationState::isCompleteNow() ? $pageId : null;
	}

	/**
	 * A name this page's own embed gives a drawing the page does not have yet, so an editor may create it.
	 * @param array $candidate From DirectEmbeddingRewriter::scan()
	 * @param int $pageId The page carrying the embed
	 * @param array[] $surfaces The page's drawings
	 * @return string|null
	 * @throws \InvalidArgumentException For a malformed selector
	 */
	private function missingName( array $candidate, int $pageId, array $surfaces ): ?string {
		if ( PageOwnedBindingOptions::extract( $candidate['options'] ) !== null ) {
			return null;
		}
		$named = PageOwnedBindingOptions::named( $candidate['options'], $candidate['kind'], $candidate['target'],
			self::bareOwner( $pageId ) );
		if ( $named === null || $named['pageId'] !== $pageId ) {
			return null;
		}
		$page = $this->effectiveSourcePage( $candidate );
		$label = $named['name'];
		foreach ( $surfaces as $surface ) {
			if ( DrawingName::key( (string)$surface['label'] ) !== DrawingName::key( $named['name'] ) ||
				( $surface['kind'] === 'slide' ) !== ( $candidate['kind'] === 'slide' ) ||
				( $candidate['kind'] === 'file' && $surface['source']['fileTitle'] !== $candidate['target'] ) ) {
				continue;
			}
			if ( $surface['kind'] !== 'pdf' || $surface['source']['page'] === $page ) {
				// Ambiguous stored matches cannot be treated as a new empty surface.
				return null;
			}
			$label = (string)$surface['label'];
		}
		return $label;
	}

	/**
	 * @param array $candidate Scanned embed
	 * @param string $name Layer-set name
	 * @param array[] $surfaces Authorized exact-base surfaces
	 * @return array|null The consistent source pin of an existing PDF layer set
	 */
	private static function existingPdfSource( array $candidate, string $name, array $surfaces ): ?array {
		$source = null;
		foreach ( $surfaces as $surface ) {
			if ( $candidate['kind'] !== 'file' || $surface['kind'] !== 'pdf' ||
				$surface['source']['fileTitle'] !== $candidate['target'] ||
				DrawingName::key( (string)$surface['label'] ) !== DrawingName::key( $name ) ) {
				continue;
			}
			$pin = $surface['source'];
			unset( $pin['page'] );
			if ( (string)$surface['label'] !== $name || ( $source !== null && $source !== $pin ) ) {
				throw new \DomainException( 'layers-source-unavailable' );
			}
			$source = $pin;
		}
		return $source;
	}

	/**
	 * Old unsaved drafts used page/base/name only. Offer recovery only when that exact base proves
	 * one possible target, with no upload since the base. Ambiguous records stay untouched in storage.
	 * @param array[] $candidates Authorized source scan
	 * @param array[] $surfaces Authorized exact-base snapshot
	 * @param array $surface Newly prepared surface
	 * @param RevisionRecord $base
	 * @return array|null Read-only legacy draft alias
	 */
	private function legacyDraftSurface( array $candidates, array $surfaces, array $surface,
		RevisionRecord $base
	): ?array {
		$isSlide = $surface['kind'] === 'slide';
		if ( !$isSlide && $surface['source']['timestamp'] >= $base->getTimestamp() ) {
			return null;
		}
		$nameKey = DrawingName::key( $surface['label'] );
		$id = NewPageDrawing::legacySurfaceId( $base->getPageId(), $base->getId(), $surface['label'] );
		foreach ( $surfaces as $stored ) {
			// The earlier creation rule refused every already-used page-wide name.
			if ( $stored['id'] === $id || DrawingName::key( (string)$stored['label'] ) === $nameKey ) {
				return null;
			}
		}
		$found = false;
		foreach ( $candidates as $candidate ) {
			try {
				if ( PageOwnedBindingOptions::extract( $candidate['options'] ) !== null ) {
					continue;
				}
				$named = PageOwnedBindingOptions::named( $candidate['options'], $candidate['kind'],
					$candidate['target'], self::bareOwner( $base->getPageId() ) );
			} catch ( \InvalidArgumentException $e ) {
				return null;
			}
			if ( !$named || $named['pageId'] !== $base->getPageId() ||
				DrawingName::key( $named['name'] ) !== $nameKey ) {
				continue;
			}
			if ( $isSlide ) {
				if ( $candidate['kind'] !== 'slide' ) {
					return null;
				}
				$found = true;
				continue;
			}
			if ( $candidate['kind'] !== 'file' || $candidate['target'] !== $surface['source']['fileTitle'] ) {
				return null;
			}
			// Reproduce the former new-draft page interpretation solely to prove a recovery alias.
			$oldPage = 1;
			if ( $surface['kind'] === 'pdf' ) {
				foreach ( $candidate['options'] as $option ) {
					$parts = explode( '=', $option, 2 );
					if ( strtolower( trim( $parts[0], " \t\r\n\f" ) ) === 'page' && isset( $parts[1] ) ) {
						$oldPage = max( 1, (int)trim( $parts[1], " \t\r\n\f" ) );
					}
				}
			}
			if ( $oldPage !== $surface['source']['page'] ||
				$this->effectiveSourcePage( $candidate ) !== $surface['source']['page'] ) {
				return null;
			}
			$found = true;
		}
		return $found ? [ 'surfaceId' => $id, 'baseRevisionId' => $base->getId() ] : null;
	}

	/**
	 * Embeds on the current revision that name another page's drawing, which this editor may copy here.
	 * Decided per request from the reader's own rights; never stored in parser output.
	 * @param int $pageId
	 * @param int $revisionId Displayed revision; must still be current
	 * @param Authority $authority
	 * @return array[] label, source Title and confirmation route parameters
	 */
	public function listCopyCandidates( int $pageId, int $revisionId, Authority $authority ): array {
		try {
			$this->assertCopyScope( $pageId, $authority );
		} catch ( PublicationException $e ) {
			return [];
		}
		return $this->newDrawingCopy()->listCandidates( $pageId, $revisionId, $authority );
	}

	/**
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $sourceRevisionId
	 * @param Authority $authority
	 * @return array owner and source Titles, label and source revision
	 * @throws PublicationException
	 */
	public function previewCopy( int $pageId, int $revisionId, int $start, string $expected, int $sourceRevisionId,
		Authority $authority
	): array {
		$this->assertCopyScope( $pageId, $authority );
		return $this->newDrawingCopy()->preview( $pageId, $revisionId, $start, $expected, $sourceRevisionId,
			$authority );
	}

	/**
	 * Internal composition: HTTP callers must enforce POST, CSRF, rate limits and confirmation.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $start
	 * @param string $expected
	 * @param int $sourceRevisionId
	 * @param Authority $authority
	 * @param string $note
	 * @return int New revision of this page
	 * @throws PublicationException
	 */
	public function copyDrawing( int $pageId, int $revisionId, int $start, string $expected, int $sourceRevisionId,
		Authority $authority, string $note
	): int {
		$this->assertCopyScope( $pageId, $authority );
		return $this->newDrawingCopy()->copy( $pageId, $revisionId, $start, $expected, $sourceRevisionId,
			$authority, $note );
	}

	/**
	 * Other pages' drawings the editor may copy here, for the editor's list. Read with the caller's own rights.
	 * @param string $search Start of a page title; empty lists the pages edited last
	 * @param int $pageId The page being edited
	 * @param int $limit
	 * @param Authority $authority
	 * @return array[] title, pageId, revisionId and drawings of each page
	 */
	public function searchDrawings( string $search, int $pageId, int $limit, Authority $authority ): array {
		try {
			$this->assertCopyScope( $pageId, $authority );
		} catch ( PublicationException $e ) {
			return [];
		}
		return ( new DrawingCatalog( $this->services->getConnectionProvider(), $this->services->getSlotRoleStore(),
			$this->services->getTitleFactory(), [ $this, 'getHistorySurfaces' ] ) )
			->search( $search, $pageId, $limit, $authority );
	}

	/**
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $sourcePageId
	 * @param string $sourceSurfaceId
	 * @param int $sourceRevisionId
	 * @param Authority $authority
	 * @return array owner and source Titles, label and source revision
	 * @throws PublicationException
	 */
	public function previewListCopy( int $pageId, int $revisionId, int $sourcePageId, string $sourceSurfaceId,
		int $sourceRevisionId, Authority $authority
	): array {
		$this->assertCopyScope( $pageId, $authority );
		return $this->newDrawingCopy()->previewFromList( $pageId, $revisionId, $sourcePageId, $sourceSurfaceId,
			$sourceRevisionId, $authority );
	}

	/**
	 * Internal composition: HTTP callers must enforce POST, CSRF, rate limits and confirmation.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $sourcePageId
	 * @param string $sourceSurfaceId
	 * @param int $sourceRevisionId
	 * @param Authority $authority
	 * @param string $note
	 * @return int New revision of this page
	 * @throws PublicationException
	 */
	public function copyListDrawing( int $pageId, int $revisionId, int $sourcePageId, string $sourceSurfaceId,
		int $sourceRevisionId, Authority $authority, string $note
	): int {
		$this->assertCopyScope( $pageId, $authority );
		return $this->newDrawingCopy()->copyFromList( $pageId, $revisionId, $sourcePageId, $sourceSurfaceId,
			$sourceRevisionId, $authority, $note );
	}

	/**
	 * @param int $pageId
	 * @param Authority $authority
	 * @throws PublicationException
	 */
	private function assertCopyScope( int $pageId, Authority $authority ): void {
		$owner = $pageId > 0 ? $this->services->getTitleFactory()->newFromID( $pageId ) : null;
		if ( $authority->getUser()->getId() <= 0 || !$owner || !$this->scope->includes( $owner ) ) {
			throw new PublicationException( 'layers-publication-disabled' );
		}
	}

	/** @return PageDrawingCopy */
	private function newDrawingCopy(): PageDrawingCopy {
		return new PageDrawingCopy( $this->newIdentityResolver(), $this->services->getRevisionLookup(),
			$this->services->getTitleFactory(), $this->publisher, $this->newRewriter(), $this->fileTargets(),
			fn ( array $candidate ): int => $this->effectiveSourcePage( $candidate ) );
	}

	/** @return FilePageMigration Step 1 of the D3 migration, for the maintenance script */
	public function newFilePageMigration(): FilePageMigration {
		$lookup = $this->services->getRevisionLookup();
		$sources = new SourceVersionResolver( $this->services->getRepoGroup()->getLocalRepo(),
			$this->services->getTitleFactory() );
		return new FilePageMigration( $this->services->getService( 'LayersDatabase' ), $this->scope,
			$this->services->getRepoGroup(), $this->services->getTitleFactory(), $lookup,
			new PageHistoryAccess( $lookup ),
			new LegacyMediaResolver( $sources ), new LegacySurfaceConverter(), $this->publisher );
	}

	/** @return PageCopyMigration Step 2 of the D3 migration, for the maintenance script */
	public function newPageCopyMigration(): PageCopyMigration {
		$lookup = $this->services->getRevisionLookup();
		return new PageCopyMigration( $this->services->getService( 'LayersDatabase' ), $this->scope,
			$this->services->getRepoGroup(), $this->services->getTitleFactory(), $lookup,
			new PageHistoryAccess( $lookup ), new LegacySurfaceConverter(), $this->newRewriter(),
			$this->fileTargets(), $this->services->getConnectionProvider(), $this->publisher,
			fn ( array $candidate ): int => $this->effectiveSourcePage( $candidate ) );
	}

	/** @return SlidePageMigration Step 3 of the D3 migration, for the maintenance script */
	public function newSlidePageMigration(): SlidePageMigration {
		return new SlidePageMigration( $this->services->getService( 'LayersDatabase' ), $this->scope,
			$this->services->getTitleFactory(), $this->services->getRevisionLookup(),
			$this->services->getConnectionProvider(), $this->services->getSlotRoleStore(), $this->publisher );
	}

	/** @return MigrationUndo Undoes the D3 migration, for the maintenance script */
	public function newMigrationUndo(): MigrationUndo {
		return new MigrationUndo( $this->services->getConnectionProvider(), $this->services->getRevisionLookup(),
			$this->services->getTitleFactory(), $this->services->getChangeTagsStore(),
			$this->services->getDeletePageFactory(), $this->publisher );
	}

	/** @return PageOwnedIdentityResolver */
	private function newIdentityResolver(): PageOwnedIdentityResolver {
		$lookup = $this->services->getRevisionLookup();
		return new PageOwnedIdentityResolver( $this->services->getTitleFactory(), $lookup,
			new PageHistoryAccess( $lookup ) );
	}

	/**
	 * @param PageOwnedIdentityResolver $identities
	 * @return DirectAdoptionPreparationService
	 */
	private function newAdoptionPreparer( PageOwnedIdentityResolver $identities ): DirectAdoptionPreparationService {
		$db = $this->services->getService( 'LayersDatabase' );
		$sources = new SourceVersionResolver( $this->services->getRepoGroup()->getLocalRepo(),
			$this->services->getTitleFactory() );
		$legacy = new LegacyAdoptionPreparationService( $identities, $db, new LegacyMediaResolver( $sources ),
			new LegacySurfaceConverter() );
		return new DirectAdoptionPreparationService( $identities, $this->services->getRevisionLookup(),
			$this->services->getTitleFactory(), $legacy, $this->newRewriter(),
			static fn ( string $slide ): ?string => $db->getLatestLayerSet(
				LayersConstants::SLIDE_PREFIX . $slide, LayersConstants::TYPE_SLIDE )['name'] ?? null );
	}

	/**
	 * List independently editable saved direct bindings for a page-level control.
	 * Never maps rendered occurrences to source offsets or exposes template-generated candidates.
	 * @param int $pageId
	 * @param int $revisionId Explicit displayed revision; must still be current
	 * @param Authority $authority
	 * @return array Validated route parameters and escaped-at-output labels
	 */
	public function listBoundEditorSelections( int $pageId, int $revisionId, Authority $authority ): array {
		try {
			if ( $authority->getUser()->getId() <= 0 ) {
				return [];
			}
			$lookup = $this->services->getRevisionLookup();
			$owner = ( new PageOwnedIdentityResolver( $this->services->getTitleFactory(), $lookup,
				new PageHistoryAccess( $lookup ) ) )->resolveForEdit( $pageId, $revisionId, $authority );
			if ( !$this->scope->includes( $owner ) ) {
				return [];
			}
			$revision = $lookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
			$main = $revision ? $revision->getContent( SlotRecord::MAIN,
				RevisionRecord::FOR_THIS_USER, $authority ) : null;
			if ( !$main instanceof WikitextContent ) {
				return [];
			}
			// One exact read for every entry; the editor route repeats full admission when opened.
			$kinds = [];
			$labels = [];
			$surfaces = $revision->hasSlot( PageRevisionWriter::SLOT ) ?
				$this->reader->read( $owner, $revisionId, $authority, $pageId, [] )['snapshot']['surfaces'] : [];
			foreach ( $surfaces as $surface ) {
				$kinds[$surface['id']] = $surface['kind'] === 'slide' ? 'slide' : 'file';
				$labels[$surface['id']] = (string)( $surface['label'] ?? $surface['id'] );
			}
			$candidates = $this->newRewriter()->scan( $main->getText(), $this->fileTargets() );
			$selections = [];
			foreach ( $candidates as $candidate ) {
				try {
					$binding = $this->embedBinding( $candidate, $surfaces, $pageId );
					$missing = $binding ? null : $this->missingName( $candidate, $pageId, $surfaces );
					$newKey = $missing === null ? '' : 'new:' . json_encode( [ $candidate['kind'],
						$candidate['kind'] === 'file' ? $candidate['target'] : null,
						DrawingName::key( $missing ), $this->effectiveSourcePage( $candidate ) ] );
					if ( $missing !== null && !isset( $selections[$newKey] ) ) {
						$selections[$newKey] = [ 'label' => $missing, 'create' => true,
							'params' => [ 'pageid' => $pageId, 'revid' => $revisionId, 'start' => $candidate['start'],
								'expected' => $candidate['raw'] ] ];
						continue;
					}
					// A slide embed edits only slides, a file embed only image/PDF surfaces.
					if ( !$binding || $binding['pageId'] !== $pageId ||
						( $kinds[$binding['surfaceId']] ?? null ) !== $candidate['kind'] ||
						isset( $selections[$binding['surfaceId']] ) ) {
						continue;
					}
					$label = $candidate['kind'] === 'file' ? substr( $candidate['target'], 5 ) : $candidate['target'];
					if ( PageOwnedBindingOptions::extract( $candidate['options'] ) === null ) {
						// A named embed's target is `<pageId>:<name>`; readers know the drawing by its name.
						$label = $labels[$binding['surfaceId']];
					}
					$selections[$binding['surfaceId']] = [ 'label' => $label, 'params' => [
						'pageid' => $pageId, 'revid' => $revisionId, 'start' => $candidate['start'],
						'expected' => $candidate['raw']
					] ];
				} catch ( \InvalidArgumentException $e ) {
					// A malformed binding must not redirect another drawing's entry.
				}
			}
			return array_values( $selections );
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			return [];
		}
	}

	/**
	 * Internal ordinary-entry admission from an exact saved direct embedding.
	 * Source bytes are checked against native main content; caller IDs are not binding proof.
	 * No public route is installed here. Slide embeds open slides, file embeds image/PDF surfaces.
	 *
	 * @param int $pageId Native owner identity
	 * @param int $revisionId Explicit current base
	 * @param int $start UTF-8 byte offset of selected direct embedding
	 * @param string $expected Complete selected embedding bytes
	 * @param Authority $authority Original request actor
	 * @return array Authorized editor bootstrap
	 */
	public function prepareBoundEditor( int $pageId, int $revisionId, int $start, string $expected,
		Authority $authority
	): array {
		try {
			if ( $start < 0 || $expected === '' || $authority->getUser()->getId() <= 0 ) {
				throw new \DomainException();
			}
			$lookup = $this->services->getRevisionLookup();
			$owner = ( new PageOwnedIdentityResolver( $this->services->getTitleFactory(), $lookup,
				new PageHistoryAccess( $lookup ) ) )->resolveForEdit( $pageId, $revisionId, $authority );
			if ( !$this->scope->includes( $owner ) ) {
				throw new \DomainException();
			}
			$revision = $lookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
			$main = $revision ? $revision->getContent( SlotRecord::MAIN,
				RevisionRecord::FOR_THIS_USER, $authority ) : null;
			if ( !$main instanceof WikitextContent ) {
				throw new \DomainException();
			}
			$candidates = $this->newRewriter()->scan( $main->getText(), $this->fileTargets() );
			foreach ( $candidates as $candidate ) {
				if ( $candidate['start'] !== $start || $candidate['raw'] !== $expected ) {
					continue;
				}
				$surfaces = $revision->hasSlot( PageRevisionWriter::SLOT ) ?
					$this->reader->read( $owner, $revisionId, $authority, $pageId, [] )['snapshot']['surfaces'] : [];
				$binding = $this->embedBinding( $candidate, $surfaces, $pageId );
				if ( !$binding ) {
					$missing = $this->missingName( $candidate, $pageId, $surfaces );
					if ( $missing === null ) {
						throw new \DomainException();
					}
					// The drawing exists only in the editor until its first save adds it to the page.
					$new = $this->newDrawings->prepare( $pageId, $revisionId, $candidate, $missing, $authority,
						$this->effectiveSourcePage( $candidate ),
						self::existingPdfSource( $candidate, $missing, $surfaces ) );
					$init = $this->editorInit( $owner, $revisionId, $pageId, $new['surface'], $new['rendition'],
						$authority );
					$init['pageOwned'] += [ 'newSurface' => $new['surface'],
						'emptyBase' => !$revision->hasSlot( PageRevisionWriter::SLOT ) ];
					$legacy = $this->legacyDraftSurface( $candidates, $surfaces, $new['surface'], $revision );
					if ( $legacy !== null ) {
						$init['pageOwned']['draftScope']['legacySurface'] = $legacy;
					}
					return $init;
				}
				if ( $binding['pageId'] !== $pageId ) {
					throw new \DomainException();
				}
				$init = $this->prepareEditor( $owner->getPrefixedText(), $revisionId,
					$binding['surfaceId'], $authority );
				if ( $init['pageOwned']['pageId'] !== $pageId ||
					$init['isSlide'] !== ( $candidate['kind'] === 'slide' )
				) {
					throw new \DomainException();
				}
				return $init;
			}
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			// Fixed denial without reflecting source bytes or privileged diagnostics.
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		throw new \DomainException( 'layers-editor-unavailable' );
	}

	/**
	 * Explicit current-editor entry. Resolve once, then use the exact editor admission path.
	 * Does not reinterpret stale numeric revision links or affect historical reads.
	 *
	 * @param string $ownerText
	 * @param string $surfaceId
	 * @param Authority $authority
	 * @return array
	 */
	public function prepareCurrentEditor( string $ownerText, string $surfaceId, Authority $authority ): array {
		$owner = $this->services->getTitleFactory()->newFromText( $ownerText );
		if ( !$owner || !$owner->canExist() || $owner->hasFragment() ||
			!$this->scope->includes( $owner ) ||
			$surfaceId === '' || $authority->getUser()->getId() <= 0
		) {
			throw new \DomainException( 'layers-editor-unavailable' );
		}
		try {
			$lookup = $this->services->getRevisionLookup();
			( new PageHistoryAccess( $lookup ) )->assertCanPrepareEdit( $owner, $authority );
			$current = $lookup->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
			if ( !$current ) {
				throw new \DomainException();
			}
			return $this->prepareEditor( $ownerText, $current->getId(), $surfaceId, $authority );
		} catch ( \DomainException $e ) {
			throw new \DomainException( 'layers-editor-unavailable', 0, $e );
		}
	}

	/**
	 * Return an authorized exact surface for the separate historical viewer.
	 * No editor configuration, local drafts, edit permission requirement or latest fallback.
	 * The caller must use non-cacheable output and a renderer with no mutation controls.
	 *
	 * @param string $ownerText
	 * @param int $revisionId
	 * @param string $surfaceId
	 * @param Authority $authority
	 * @return array Read-only viewer data
	 * @throws \DomainException Fixed unavailable result
	 */
	public function prepareViewer( string $ownerText, int $revisionId, string $surfaceId,
		Authority $authority
	): array {
		$owner = $this->services->getTitleFactory()->newFromText( $ownerText );
		if ( !$owner || !$owner->canExist() || $owner->hasFragment() ||
			!$this->scope->includes( $owner ) ||
			$revisionId < 1 || $revisionId > 2147483647 || $surfaceId === ''
		) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$pageId = $owner->getArticleID( IDBAccessObject::READ_LATEST );
		$bundle = $this->reader->read( $owner, $revisionId, $authority, $pageId, [ $surfaceId ] );
		foreach ( $bundle['snapshot']['surfaces'] as $surface ) {
			if ( $surface['id'] === $surfaceId ) {
				$view = [ 'owner' => $owner->getPrefixedDBkey(), 'pageId' => $pageId,
					'revisionId' => $revisionId, 'surface' => $surface ];
				if ( $surface['kind'] === 'slide' ) {
					return $view;
				}
				if ( isset( $bundle['sourceRenditions'][$surfaceId] ) ) {
					return $view + [ 'source' => $bundle['sourceRenditions'][$surfaceId] ];
				}
				break;
			}
		}
		throw new \DomainException( 'layers-revision-unavailable' );
	}

	/**
	 * List surface identity only after an exact authorized read, for history navigation.
	 * @param \MediaWiki\Title\Title $owner
	 * @param int $revisionId
	 * @param Authority $authority
	 * @return array[]
	 */
	public function getHistorySurfaces( \MediaWiki\Title\Title $owner, int $revisionId, Authority $authority ): array {
		if ( !$this->scope->includes( $owner ) ||
			$owner->hasFragment() || $revisionId < 1 || $revisionId > 2147483647 ) {
			return [];
		}
		// Listing only; the viewer resolves the selected surface's source when a link is opened.
		$bundle = $this->reader->read( $owner, $revisionId, $authority, null, [] );
		$surfaces = [];
		foreach ( $bundle['snapshot']['surfaces'] as $surface ) {
			if ( in_array( $surface['kind'], [ 'slide', 'image', 'pdf' ], true ) ) {
				$surfaces[] = [ 'id' => $surface['id'], 'label' => $surface['label'] ?? $surface['id'],
					'kind' => $surface['kind'] ];
			}
		}
		return $surfaces;
	}

	/**
	 * List stored file/page selectors after an exact authorized read, for internal file selection.
	 * Sources are not resolved here; the selected surface is checked when it is opened.
	 * @param \MediaWiki\Title\Title $owner
	 * @param int $revisionId
	 * @param Authority $authority
	 * @return array[]
	 */
	public function getFileSurfaceSelections( \MediaWiki\Title\Title $owner, int $revisionId,
		Authority $authority
	): array {
		if ( !$this->scope->includes( $owner ) ||
			$owner->hasFragment() || $revisionId < 1 || $revisionId > 2147483647 ) {
			return [];
		}
		$bundle = $this->reader->read( $owner, $revisionId, $authority, null, [] );
		$surfaces = [];
		foreach ( $bundle['snapshot']['surfaces'] as $surface ) {
			if ( !in_array( $surface['kind'], [ 'slide', 'image', 'pdf' ], true ) ) {
				continue;
			}
			$selection = [ 'id' => $surface['id'], 'label' => $surface['label'] ?? $surface['id'],
				'kind' => $surface['kind'] ];
			if ( $surface['kind'] !== 'slide' ) {
				$selection['source'] = [ 'fileTitle' => $surface['source']['fileTitle'],
					'page' => $surface['source']['page'] ];
			}
			$surfaces[] = $selection;
		}
		return $surfaces;
	}

	/**
	 * @param \MediaWiki\Title\Title $owner Native displayed owner
	 * @param int $revisionId Exact displayed revision
	 * @param string $binding Canonical PageID binding
	 * @param Authority $authority Actual reader
	 * @return array Authorized slide bundle for uncached response output
	 */
	public function prepareBoundViewer( \MediaWiki\Title\Title $owner, int $revisionId,
		string $binding, Authority $authority
	): array {
		$bundles = $this->prepareBoundViewers( $owner, $revisionId, [ $binding ], $authority );
		if ( !isset( $bundles[$binding] ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		return $bundles[$binding];
	}

	/**
	 * Authorize every binding of one displayed revision with a single snapshot read.
	 * @param \MediaWiki\Title\Title $owner Native displayed owner
	 * @param int $revisionId Exact displayed revision
	 * @param string[] $bindings Canonical PageID bindings
	 * @param Authority $authority Actual reader
	 * @param bool $includeControls Include reader-specific edit admission; always private/zero-age
	 * @return array[] Authorized slide bundles keyed by binding, for uncached response output only
	 */
	public function prepareBoundViewers( \MediaWiki\Title\Title $owner, int $revisionId,
		array $bindings, Authority $authority, bool $includeControls = false
	): array {
		if ( !$this->scope->includes( $owner ) ) {
			return [];
		}
		$result = [];
		$bundles = $this->reader->readBoundSurfaces( $owner, $revisionId, $bindings, $authority );
		foreach ( $bundles as $binding => $bundle ) {
			// Image/PDF entries need a rendition; the client matches each host to its surface kind.
			if ( $bundle['surface']['kind'] === 'slide' || isset( $bundle['source'] ) ) {
				$result[$binding] = $bundle + [ 'owner' => $owner->getPrefixedDBkey() ];
				if ( $includeControls ) {
					$result[$binding]['editUrl'] = $this->viewerEditUrl( $owner, $revisionId,
						$bundle['surface']['id'], $authority );
				}
			}
		}
		if ( $includeControls && $result ) {
			// Editor preparation can produce renditions and run hooks. Admit read data again afterwards.
			$access = new PageHistoryAccess( $this->services->getRevisionLookup() );
			$sources = new SourceVersionResolver( $this->services->getRepoGroup()->getLocalRepo(),
				$this->services->getTitleFactory() );
			try {
				$content = $access->read( $owner, $revisionId, $authority );
			} catch ( \DomainException $e ) {
				return [];
			}
			$surfaces = array_column( json_decode( $content->getText(), true )['surfaces'], null, 'id' );
			foreach ( $result as $binding => $bundle ) {
				$id = $bundle['surface']['id'];
				try {
					if ( ( $surfaces[$id] ?? null ) !== $bundle['surface'] ) {
						throw new \DomainException( 'layers-revision-unavailable' );
					}
					$sources->resolve( $content, $authority, [ $id ] );
				} catch ( \DomainException $e ) {
					unset( $result[$binding] );
				}
			}
		}
		return $result;
	}

	/**
	 * Private full-size viewer response for one exact displayed owner/revision/binding.
	 * @param \MediaWiki\Title\Title $owner
	 * @param int $revisionId
	 * @param string $binding
	 * @param Authority $authority
	 * @return array
	 */
	public function prepareFullSizeViewer( \MediaWiki\Title\Title $owner, int $revisionId,
		string $binding, Authority $authority
	): array {
		if ( !$this->scope->includes( $owner ) ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		try {
			$id = PageOwnedBinding::parse( $binding )['surfaceId'];
		} catch ( \InvalidArgumentException $e ) {
			throw new \DomainException( 'layers-revision-unavailable', 0, $e );
		}
		$editUrl = $this->viewerEditUrl( $owner, $revisionId, $id, $authority );
		$access = new PageHistoryAccess( $this->services->getRevisionLookup() );
		$sources = new SourceVersionResolver( $this->services->getRepoGroup()->getLocalRepo(),
			$this->services->getTitleFactory() );
		$config = $this->services->getMainConfig();
		$path = rtrim( (string)$config->get( 'RestPath' ), '/' ) . '/layers/v0/pdf';
		$viewer = ( new PageViewerReadService( $access, $sources,
			new SourceRenditions( $this->services->getUrlUtils() ), $path ) )
			->read( $owner, $revisionId, $binding, $authority );
		$viewer['editUrl'] = $editUrl;
		return $viewer;
	}

	/** Exact current editor admission; a denied edit never prevents an authorized view. */
	private function viewerEditUrl( \MediaWiki\Title\Title $owner, int $revisionId, string $surfaceId,
		Authority $authority
	): ?string {
		try {
			$this->prepareEditor( $owner->getPrefixedDBkey(), $revisionId, $surfaceId, $authority );
			return SpecialPage::getTitleFor( 'EditLayersPage' )->getLocalURL( [
				'owner' => $owner->getPrefixedDBkey(), 'revid' => $revisionId, 'surface' => $surfaceId
			] );
		} catch ( \DomainException $e ) {
			return null;
		}
	}

	/**
	 * Scanner honouring this wiki's registered extension tags, whose bodies are opaque to wikitext links.
	 * @return DirectEmbeddingRewriter
	 */
	private function newRewriter(): DirectEmbeddingRewriter {
		return new DirectEmbeddingRewriter( $this->services->getParserFactory()->getMainInstance()->getTags() );
	}

	/** @return PageOwnedAdmissionHooks */
	public function newAdmissionHooks(): PageOwnedAdmissionHooks {
		return new PageOwnedAdmissionHooks( $this->publisher->getAdmissionContext(),
			$this->services->getRevisionLookup(), new PageDrawingRevert( $this->services->getConnectionProvider(),
				$this->services->getSlotRoleStore(), $this->services->getRevisionLookup(),
				$this->services->getPermissionManager() ) );
	}

	/** @return PageOwnedPilotLifecycleHooks */
	public function newLifecycleHooks(): PageOwnedPilotLifecycleHooks {
		return new PageOwnedPilotLifecycleHooks( $this->scope );
	}

	/** @return PageSurfaceRestore */
	public function newSurfaceRestore(): PageSurfaceRestore {
		return new PageSurfaceRestore( $this->scope, $this->services->getTitleFactory(),
			$this->services->getRevisionLookup(), $this->publisher );
	}

	/**
	 * Drawings that differ between two revisions of an owner page, for its diff view.
	 * @param \MediaWiki\Title\Title $owner
	 * @param RevisionRecord $old
	 * @param RevisionRecord $new
	 * @param Authority $authority
	 * @return array[] See PageDrawingDiff::changes(); empty outside the pilot
	 * @throws \DomainException When either side's drawings are hidden from this reader
	 */
	public function getDrawingChanges( \MediaWiki\Title\Title $owner, RevisionRecord $old, RevisionRecord $new,
		Authority $authority
	): array {
		if ( !$this->scope->includes( $owner ) ) {
			return [];
		}
		return ( new PageDrawingDiff( new PageHistoryAccess( $this->services->getRevisionLookup() ) ) )
			->changes( $owner, $old, $new, $authority );
	}

	/**
	 * @param OldRevisionImporter $native
	 * @return PageOwnedPilotImporter
	 */
	public function wrapImporter( OldRevisionImporter $native ): PageOwnedPilotImporter {
		return new PageOwnedPilotImporter( $native, $this->scope );
	}

	/**
	 * @param MergeHistoryFactory $native
	 * @return PageOwnedPilotMergeFactory
	 */
	public function wrapMergeFactory( MergeHistoryFactory $native ): PageOwnedPilotMergeFactory {
		return new PageOwnedPilotMergeFactory( $native, $this->scope );
	}
}
