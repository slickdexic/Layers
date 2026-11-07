<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\FileRepo\File\File;
use MediaWiki\Hook\FileDeleteCompleteHook;
use MediaWiki\Hook\LocalFilePurgeThumbnailsHook;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;

/** Schedule a bounded refresh when a retained legacy source is purged. */
class LegacySearchRefreshHooks implements LocalFilePurgeThumbnailsHook, FileDeleteCompleteHook {
	/** @inheritDoc */
	public function onFileDeleteComplete( $file, $oldimage, $article, $user, $reason ) {
		if ( $file ) {
			$this->schedule( $file, false );
		}
	}

	/** @inheritDoc */
	public function onLocalFilePurgeThumbnails( $file, $archiveName, $urls ) {
		$this->schedule( $file, true );
	}

	/**
	 * @param File $file
	 * @param bool $requireRows Skip routine thumbnail purges when no legacy rows exist
	 */
	private function schedule( File $file, bool $requireRows ): void {
		try {
			$services = MediaWikiServices::getInstance();
			$title = $file->getTitle();
			if ( $title && ( !$requireRows ||
				$services->getService( 'LayersDatabase' )->hasFileSetsForSearch( $file->getName() ) ) ) {
				$services->getJobQueueGroup()->lazyPush( new LegacySearchRefreshJob( $title, [] ) );
			}
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->warning( 'Legacy search refresh scheduling failed',
				[ 'exception' => $e ] );
		}
	}
}
