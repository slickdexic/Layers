<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\FileRepo\File\File;
use MediaWiki\MediaWikiServices;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\AtEase\AtEase;
use Wikimedia\FileBackend\FSFile\TempFSFile;
use Wikimedia\Rdbms\IDBAccessObject;

/** Read-only viewing of a still-missing PDF set, admitted from the current saved embed. */
class PageMissingPdfViewerReadService {

	public function __construct( private MediaWikiServices $services, private PageOwnedScope $scope ) {
	}

	/**
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $start UTF-8 byte offset in native saved main content
	 * @param string $expected Complete direct embed, never authority by itself
	 * @param Authority $authority Original reader; edit permission is not required
	 * @return array Private viewer input, never a stored surface or publication capability
	 */
	public function read( int $pageId, int $revisionId, int $start, string $expected,
		Authority $authority
	): array {
		try {
			$first = $this->select( $pageId, $revisionId, $start, $expected, $authority );
			$again = $this->select( $pageId, $revisionId, $start, $expected, $authority );
			if ( $first['viewer'] !== $again['viewer'] || $first['base'] !== $again['base'] ) {
				throw new \DomainException();
			}
			return $first['viewer'];
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
	}

	/**
	 * The digest compares the server-derived current pin; it cannot select a file/version.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $start
	 * @param string $expected
	 * @param string $sourceKey
	 * @param Authority $authority
	 * @return PinnedPdfStream Private verified bytes; caller closes after delivery
	 */
	public function capture( int $pageId, int $revisionId, int $start, string $expected,
		string $sourceKey, Authority $authority
	): PinnedPdfStream {
		$copy = null;
		$handle = null;
		$capture = null;
		try {
			$selected = $this->select( $pageId, $revisionId, $start, $expected, $authority );
			if ( !hash_equals( $selected['viewer']['sourceKey'], $sourceKey ) ) {
				throw new \DomainException();
			}
			$admit = function () use ( $pageId, $revisionId, $start, $expected, $authority, $selected ) {
				$fresh = $this->select( $pageId, $revisionId, $start, $expected, $authority );
				if ( $fresh['viewer'] !== $selected['viewer'] || $fresh['base'] !== $selected['base'] ) {
					throw new \DomainException();
				}
			};
			$copy = $this->copyFile( $selected['file'] );
			$handle = AtEase::quietCall( static fn () => fopen( $copy->getPath(), 'rb' ) );
			$sha1 = $selected['viewer']['pages'][0]['surface']['source']['sha1'];
			$capture = PinnedPdfStream::capture( $handle, \Wikimedia\base_convert( $sha1, 36, 16, 40 ),
				static fn () => $copy->purge(), $admit );
			$admit();
			return $capture;
		} catch ( \Throwable $error ) {
			if ( $capture ) {
				$capture->close();
			} else {
				if ( gettype( $handle ) === 'resource' ) {
					fclose( $handle );
				}
				if ( $copy ) {
					$copy->purge();
				}
			}
			throw new \DomainException( 'layers-revision-unavailable' );
		}
	}

	/**
	 * Resolve the saved occurrence internally so even long captions keep delivery URLs bounded.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param int $start
	 * @param string $sourceKey Compared against the freshly derived native selection
	 * @param Authority $authority
	 * @return PinnedPdfStream
	 */
	public function captureOccurrence( int $pageId, int $revisionId, int $start, string $sourceKey,
		Authority $authority
	): PinnedPdfStream {
		try {
			$selected = $this->select( $pageId, $revisionId, $start, null, $authority );
			return $this->capture( $pageId, $revisionId, $start, $selected['expected'], $sourceKey, $authority );
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
	}

	/**
	 * @param File $file Authorized native source only
	 * @return TempFSFile
	 */
	protected function copyFile( File $file ): TempFSFile {
		$copy = $file->getRepo()->getBackend()->getLocalCopy( [ 'src' => $file->getPath(), 'latest' => true ] );
		if ( !$copy instanceof TempFSFile ) {
			throw new \DomainException();
		}
		return $copy;
	}

	/** @return array Private native selection; File/base bytes never leave this service */
	private function select( int $pageId, int $revisionId, int $start, ?string $expected,
		Authority $authority
	): array {
		if ( $pageId < 1 || $pageId > 2147483647 || $revisionId < 1 || $revisionId > 2147483647 ||
			$start < 0 || ( $expected !== null && ( $expected === '' ||
				strlen( $expected ) > DocumentSchema::MAX_BYTES || !mb_check_encoding( $expected, 'UTF-8' ) ) ) ||
			!MigrationState::isCompleteNow() ) {
			throw new \DomainException();
		}
		$titles = $this->services->getTitleFactory();
		$lookup = $this->services->getRevisionLookup();
		$owner = $titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$owner || !$owner->canExist() || $owner->hasFragment() || $owner->isExternal() ||
			$owner->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ||
			!$this->scope->includes( $owner, IDBAccessObject::READ_LATEST ) ||
			!$authority->authorizeRead( 'read', $owner ) ) {
			throw new \DomainException();
		}
		$revision = $lookup->getRevisionById( $revisionId, IDBAccessObject::READ_LATEST );
		$current = $lookup->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
		if ( !$revision || !$current || $revision->getPageId() !== $pageId ||
			$current->getId() !== $revisionId ||
			!RevisionRecord::userCanBitfield( $revision->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $revision->getPage() ) ) {
			throw new \DomainException();
		}
		$main = $revision->getContent( 'main', RevisionRecord::FOR_THIS_USER, $authority );
		if ( !$main instanceof WikitextContent ) {
			throw new \DomainException();
		}
		$base = null;
		$surfaces = [];
		if ( $revision->hasSlot( PageRevisionWriter::SLOT ) ) {
			$content = ( new PageHistoryAccess( $lookup ) )->read( $owner, $revisionId, $authority, $pageId );
			$base = $content->getText();
			$surfaces = json_decode( $base, true, 64, JSON_THROW_ON_ERROR )['surfaces'];
		}
		$rewriter = new DirectEmbeddingRewriter( $this->services->getParserFactory()->create()->getTags() );
		$candidates = $rewriter->scan( $main->getText(), static function ( string $target ) use ( $titles ) {
			$title = $titles->newFromText( $target );
			return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() ?
				'File:' . $title->getDBkey() : null;
		} );
		$selected = array_values( array_filter( $candidates, static fn ( array $row ): bool =>
			$row['kind'] === 'file' && $row['start'] === $start &&
				( $expected === null || $row['raw'] === $expected ) ) );
		if ( count( $selected ) !== 1 || PageOwnedBindingOptions::extract( $selected[0]['options'] ) !== null ) {
			throw new \DomainException();
		}
		$candidate = $selected[0];
		$expected = $candidate['raw'];
		$named = PageOwnedBindingOptions::named( $candidate['options'], 'file', $candidate['target'], $pageId );
		if ( $named === null || $named['pageId'] !== $pageId ) {
			throw new \DomainException();
		}
		foreach ( $surfaces as $surface ) {
			if ( $surface['kind'] !== 'slide' && $surface['source']['fileTitle'] === $candidate['target'] &&
				DrawingName::key( $surface['label'] ) === DrawingName::key( $named['name'] ) ) {
				throw new \DomainException();
			}
		}
		$title = $titles->newFromText( $candidate['target'] );
		$repo = $this->services->getRepoGroup()->getLocalRepo();
		if ( !$authority->authorizeRead( 'read', $title ) ) {
			throw new \DomainException();
		}
		$file = $repo->findFile( $title, [ 'latest' => true, 'ignoreRedirect' => true ] );
		$count = $file && $file->getMimeType() === 'application/pdf' ? $file->pageCount() : null;
		if ( !is_int( $count ) || $count < 1 || $count > DocumentSchema::MAX_SURFACES ) {
			throw new \DomainException();
		}
		$words = $this->services->getMagicWordFactory()->newArray( [ 'img_page' ] );
		$page = min( $count, PageOwnedBindingOptions::sourcePage( $candidate['options'],
			static function ( string $option ) use ( $words ): ?string {
				[ $word, $value ] = $words->matchVariableStartToEnd( $option );
				return $word === 'img_page' ? $value : null;
			} ) );
		$width = $file->getWidth( $page );
		$height = $file->getHeight( $page );
		if ( !is_int( $width ) || !is_int( $height ) || $width < 1 || $height < 1 ) {
			throw new \DomainException();
		}
		$scale = min( 1, DocumentSchema::MAX_DIMENSION / max( $width, $height ) );
		$surface = [ 'id' => NewPageDrawing::surfaceId( $pageId, $revisionId, $named['name'],
			$candidate['target'], $page ), 'kind' => 'pdf', 'label' => $named['name'],
			'canvas' => [ 'width' => max( 1, (int)round( $width * $scale ) ),
				'height' => max( 1, (int)round( $height * $scale ) ), 'backgroundColor' => '#ffffff',
				'backgroundVisible' => true, 'backgroundOpacity' => 1 ], 'layers' => [],
			'source' => [ 'repository' => 'local', 'fileTitle' => $candidate['target'],
				'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => $page ] ];
		$document = new LayersDocumentContent( JsonSnapshotCodec::encode(
			[ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ) );
		$files = ( new SourceVersionResolver( $repo, $titles ) )->resolve( $document, $authority );
		$key = hash( 'sha256', JsonSnapshotCodec::encode( [ $pageId, $revisionId, $start, $expected, $surface ] ) );
		$restPath = $this->services->getMainConfig()->get( 'RestPath' ) ?: wfScript( 'rest' );
		$path = rtrim( $restPath, '/' ) . '/layers/v0/pdf/creation';
		if ( !preg_match( '~^/(?!/)[^?#]*$~D', $path ) ) {
			throw new \DomainException();
		}
		return [ 'base' => $base, 'expected' => $expected, 'file' => $files[$surface['id']], 'viewer' => [
			'owner' => $owner->getPrefixedDBkey(), 'pageId' => $pageId, 'revisionId' => $revisionId,
			'binding' => 'v1:' . $pageId . ':' . $surface['id'], 'kind' => 'pdf', 'label' => $surface['label'],
			'initialPage' => $page, 'pageCount' => $count, 'pages' => [ [ 'page' => $page, 'surface' => $surface ] ],
			'sourceKey' => $key, 'source' => [ 'exactVersion' => true, 'url' => $path . '?' . wfArrayToCgi( [
				'pageid' => $pageId, 'revid' => $revisionId, 'start' => $start,
				'sourcekey' => $key ] ) ] ] ];
	}
}
