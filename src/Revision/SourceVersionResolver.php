<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\TitleFactory;

/** Internal publication gate for exact, visible local source versions. */
class SourceVersionResolver {
	private LocalRepo $repo;
	private TitleFactory $titleFactory;

	/**
	 * @param LocalRepo $repo Local repository only; never a repository group
	 * @param TitleFactory $titleFactory
	 */
	public function __construct( LocalRepo $repo, TitleFactory $titleFactory ) {
		$this->repo = $repo;
		$this->titleFactory = $titleFactory;
	}

	/**
	 * Validate the snapshot structure and resolve image/PDF sources.
	 * Slides have no file and produce no entry. Does not retain assets or save.
	 *
	 * @param LayersDocumentContent $content
	 * @param Authority $authority Request actor; owner authorization is a separate gate
	 * @param string[]|null $surfaceIds Resolve only these surfaces; null resolves all
	 * @return File[] Resolved files keyed by surface ID, for immediate server-side use
	 * @throws \DomainException On an unreadable snapshot or an unavailable or mismatched source
	 */
	public function resolve( LayersDocumentContent $content, Authority $authority, ?array $surfaceIds = null ): array {
		if ( !$content->isReadable() ) {
			throw new \DomainException( 'layers-source-unavailable' );
		}
		$document = json_decode( $content->getText(), false, 64, JSON_THROW_ON_ERROR );
		$files = [];
		foreach ( $document->surfaces as $surface ) {
			if ( $surface->kind === 'slide' ||
				( $surfaceIds !== null && !in_array( $surface->id, $surfaceIds, true ) ) ) {
				continue;
			}
			$source = $surface->source;
			$title = $this->titleFactory->newFromText( $source->fileTitle );
			// Store canonical namespace-independent File: titles with DB-key spelling.
			if ( !$title || !$title->canExist() || $title->getNamespace() !== NS_FILE ||
				$source->fileTitle !== 'File:' . $title->getDBkey() ||
				!$authority->authorizeRead( 'read', $title ) ) {
				throw new \DomainException( 'layers-source-unavailable' );
			}
			$file = $this->repo->findFile( $title, [
				'time' => $source->timestamp,
				'ignoreRedirect' => true,
				'latest' => true
			] );
			// Do not request private versions, even for privileged publishers: ordinary
			// rendering must never create public thumbnails of hidden file content.
			if ( !$file || $file->getRepo() !== $this->repo || !$file->isVisible() ||
				$file->isDeleted( File::DELETED_FILE ) || $file->getName() !== $title->getDBkey() ||
				$file->getTimestamp() !== $source->timestamp || $file->getSha1() !== $source->sha1 ) {
				throw new \DomainException( 'layers-source-unavailable' );
			}
			$path = $file->getPath();
			if ( !$path || !$this->repo->fileExists( $path ) ) {
				throw new \DomainException( 'layers-source-unavailable' );
			}
			if ( $surface->kind === 'pdf' ) {
				$pages = $file->getMimeType() === 'application/pdf' ? $file->pageCount() : false;
				if ( !is_int( $pages ) || $pages < $source->page ) {
					throw new \DomainException( 'layers-source-unavailable' );
				}
			} elseif ( !in_array( $file->getMediaType(), [ 'BITMAP', 'DRAWING' ], true ) ) {
				throw new \DomainException( 'layers-source-unavailable' );
			}
			$files[$surface->id] = $file;
		}
		return $files;
	}
}
