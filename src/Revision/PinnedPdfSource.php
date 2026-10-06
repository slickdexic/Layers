<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use Wikimedia\AtEase\AtEase;
use Wikimedia\FileBackend\FSFile\TempFSFile;
use Wikimedia\Rdbms\IDBAccessObject;

/** Internal exact-version capture; no endpoint, cache or production registration. */
class PinnedPdfSource {

	private PageHistoryAccess $access;
	private SourceVersionResolver $sources;
	private PageOwnedScope $scope;

	public function __construct( PageHistoryAccess $access, SourceVersionResolver $sources, PageOwnedScope $scope ) {
		$this->access = $access;
		$this->sources = $sources;
		$this->scope = $scope;
	}

	/**
	 * Capture only the PDF named by the authorized owner's exact revision/binding.
	 * Caller must recheck route admission before headers and close after delivery.
	 * @param Title $owner
	 * @param int $revisionId
	 * @param string $binding
	 * @param Authority $authority Original reader
	 * @return PinnedPdfStream Owned request-local bytes, never cached
	 * @throws \DomainException Generic unavailable result without a diagnostic chain
	 */
	public function capture( Title $owner, int $revisionId, string $binding, Authority $authority ): PinnedPdfStream {
		$copy = null;
		$handle = null;
		$capture = null;
		try {
			[ $surface, $file ] = $this->select( $owner, $revisionId, $binding, $authority );
			$hex = \Wikimedia\base_convert( $surface['source']['sha1'], 36, 16, 40 );
			$copy = $this->copyFile( $file );
			$handle = AtEase::quietCall( static fn () => fopen( $copy->getPath(), 'rb' ) );
			$expectedSource = $surface['source'];
			$admission = function () use ( $owner, $revisionId, $binding, $authority, $expectedSource ) {
				[ $selected ] = $this->select( $owner, $revisionId, $binding, $authority );
				if ( $selected['source'] !== $expectedSource ) {
					throw new \DomainException( 'layers-revision-unavailable' );
				}
			};
			$capture = PinnedPdfStream::capture( $handle, $hex, static fn () => $copy->purge(), $admission );
			[ $again ] = $this->select( $owner, $revisionId, $binding, $authority );
			if ( $again['source'] !== $surface['source'] ) {
				throw new \DomainException( 'layers-revision-unavailable' );
			}
			return $capture;
		} catch ( \Throwable $exception ) {
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
	 * Native operation seam for deterministic during-capture tests.
	 * @param File $file Resolved only from the admitted stored source
	 * @return TempFSFile Private fresh-read copy
	 */
	protected function copyFile( File $file ): TempFSFile {
		$copy = $file->getRepo()->getBackend()->getLocalCopy( [ 'src' => $file->getPath(), 'latest' => true ] );
		if ( !$copy instanceof TempFSFile ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		return $copy;
	}

	/**
	 * @param Title $owner
	 * @param int $revisionId
	 * @param string $binding
	 * @param Authority $authority
	 * @return array Selected stored surface and its exact resolved File
	 */
	private function select( Title $owner, int $revisionId, string $binding, Authority $authority ): array {
		$ownerId = $owner->getArticleID( IDBAccessObject::READ_LATEST );
		if ( $revisionId < 1 || $revisionId > 2147483647 || $ownerId < 1 || !$owner->canExist() ||
			$owner->isExternal() || $owner->hasFragment() ||
			!$this->scope->includes( $owner, IDBAccessObject::READ_LATEST )
		) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$identity = PageOwnedBinding::parse( $binding );
		if ( $identity['pageId'] !== $ownerId ) {
			throw new \DomainException( 'layers-revision-unavailable' );
		}
		$content = $this->access->read( $owner, $revisionId, $authority, $ownerId );
		foreach ( json_decode( $content->getText(), true, 64, JSON_THROW_ON_ERROR )['surfaces'] as $surface ) {
			if ( $surface['id'] === $identity['surfaceId'] && $surface['kind'] === 'pdf' ) {
				$files = $this->sources->resolve( $content, $authority, [ $surface['id'] ] );
				if ( isset( $files[$surface['id']] ) ) {
					return [ $surface, $files[$surface['id']] ];
				}
			}
		}
		throw new \DomainException( 'layers-revision-unavailable' );
	}
}
