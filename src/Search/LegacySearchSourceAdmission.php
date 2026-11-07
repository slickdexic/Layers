<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;

/** Source admission for legacy search rows that have a hash but no saved upload timestamp. */
final class LegacySearchSourceAdmission {
	public function __construct( private LocalRepo $repo ) {
	}

	/**
	 * Admit a visible, unambiguous exact-hash local source; never substitute another upload.
	 * Legacy rows lack an upload timestamp, so repeated versions with the same hash fail closed.
	 * @param Title $title Canonical file title
	 * @param string $sha1 Stored source hash
	 * @param int $page Stored PDF page, or 1 for an image
	 * @param Authority $authority Intended reader or index authority
	 * @return bool
	 */
	public function allows( Title $title, string $sha1, int $page, Authority $authority ): bool {
		if ( $title->getNamespace() !== NS_FILE || !$title->canExist() || $title->hasFragment() ||
			$sha1 === '' || $page < 1 || !$authority->authorizeRead( 'read', $title ) ) {
			return false;
		}
		$current = $this->repo->findFile( $title, [ 'ignoreRedirect' => true, 'latest' => true ] );
		$db = $this->repo->getPrimaryDB();
		$oldTimes = $db->newSelectQueryBuilder()->select( 'oi_timestamp' )->from( 'oldimage' )
			->where( [ 'oi_name' => $title->getDBkey(), 'oi_sha1' => $sha1 ] )
			->limit( 2 )->caller( __METHOD__ )->fetchFieldValues();
		$currentMatches = $current && $current->getSha1() === $sha1;
		if ( count( $oldTimes ) + ( $currentMatches ? 1 : 0 ) !== 1 ) {
			return false;
		}
		$file = $currentMatches ? $current : $this->repo->findFile( $title, [
			'time' => $oldTimes[0], 'ignoreRedirect' => true, 'latest' => true
		] );
		if ( !$file || $file->getRepo() !== $this->repo || !$file->isVisible() ||
			$file->isDeleted( File::DELETED_FILE ) || $file->getName() !== $title->getDBkey() ||
			$file->getSha1() !== $sha1 || ( !$currentMatches && $file->getTimestamp() !== $oldTimes[0] ) ) {
			return false;
		}
		$path = $file->getPath();
		if ( !$path || !$this->repo->fileExists( $path ) ) {
			return false;
		}
		if ( $file->getMimeType() === 'application/pdf' ) {
			$pages = $file->pageCount();
			return is_int( $pages ) && $page <= $pages;
		}
		return $page === 1 && in_array( $file->getMediaType(), [ 'BITMAP', 'DRAWING' ], true );
	}
}
