<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Title\TitleFactory;

/** PDF page bounds for cached identities; read authorization remains with layersread. */
final class PinnedPdfRenderPage {
	/**
	 * @param array[] $surfaces Exact owning revision's readable snapshot
	 * @param string $fileTitle Canonical file title for this occurrence
	 * @param string $name Layer-set name, scoped to that owner and file
	 * @param int $requestedPage Native ordered option result before current-upload clamping
	 * @param LocalRepo $repo Local repository; never request private versions
	 * @param TitleFactory $titles
	 * @return int|null Saved PDF page, or null when this is not a stored PDF set
	 * @throws \DomainException An inconsistent or unavailable saved PDF must not select another page
	 */
	public static function effective( array $surfaces, string $fileTitle, string $name,
		int $requestedPage, LocalRepo $repo, TitleFactory $titles
	): ?int {
		$members = array_values( array_filter( $surfaces, static fn ( array $surface ): bool =>
			( $surface['source']['fileTitle'] ?? null ) === $fileTitle &&
			DrawingName::key( $surface['label'] ) === DrawingName::key( $name ) ) );
		if ( !$members || !in_array( 'pdf', array_column( $members, 'kind' ), true ) ) {
			return null;
		}
		$anchor = $members[0];
		$pin = $anchor['source'];
		$pages = [];
		foreach ( $members as $member ) {
			$source = $member['source'];
			$page = $source['page'];
			if ( $member['kind'] !== 'pdf' || $member['label'] !== $anchor['label'] ||
				!is_int( $page ) || $page < 1 || isset( $pages[$page] ) ||
				$source['repository'] !== 'local' || $source['timestamp'] !== $pin['timestamp'] ||
				$source['sha1'] !== $pin['sha1']
			) {
				throw new \DomainException( 'layers-page-binding-unavailable' );
			}
			$pages[$page] = true;
		}
		$title = $titles->newFromText( $fileTitle );
		if ( !$title || $title->getNamespace() !== NS_FILE || !$title->canExist() ||
			$fileTitle !== 'File:' . $title->getDBkey()
		) {
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		$file = $repo->findFile( $title, [ 'time' => $pin['timestamp'],
			'ignoreRedirect' => true, 'latest' => true ] );
		if ( !$file || $file->getRepo() !== $repo || !$file->isVisible() ||
			$file->isDeleted( File::DELETED_FILE ) || $file->getName() !== $title->getDBkey() ||
			$file->getTimestamp() !== $pin['timestamp'] || $file->getSha1() !== $pin['sha1'] ||
			$file->getMimeType() !== 'application/pdf' || !$file->getPath() ||
			!$repo->fileExists( $file->getPath() )
		) {
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		$count = $file->pageCount();
		if ( !is_int( $count ) || $count < max( array_keys( $pages ) ) || $requestedPage < 1 ) {
			throw new \DomainException( 'layers-page-binding-unavailable' );
		}
		return min( $requestedPage, $count );
	}
}
