<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\JobQueue\Job;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/** Incrementally refresh legacy search entries after a file visibility change. */
class LegacySearchRefreshJob extends Job {
	private const BATCH_SIZE = 100;

	public function __construct( Title $title, array $params ) {
		parent::__construct( 'layersLegacySearchRefresh', $title, $params );
		// A later visibility change must not be coalesced with a running older refresh.
		$this->removeDuplicates = false;
	}

	/** @inheritDoc */
	public function run() {
		$cursor = $this->params['after'] ?? 0;
		if ( !is_int( $cursor ) || $cursor < 0 || $this->title->getNamespace() !== NS_FILE ) {
			return false;
		}
		$services = MediaWikiServices::getInstance();
		$search = $services->getService( 'LayersDrawingSearchText' );
		if ( $cursor === 0 ) {
			$search->updateFilePage( $this->title );
		}
		$scan = new LegacySourceScan( $services->getConnectionProvider() );
		$batch = $scan->scan( $this->title, $cursor, self::BATCH_SIZE );
		foreach ( $batch['pageIds'] as $pageId ) {
			$page = $services->getPageStore()->getPageById( $pageId, IDBAccessObject::READ_LATEST );
			if ( $page ) {
				$search->update( $page );
			}
		}
		if ( $batch['next'] !== null ) {
			$services->getJobQueueGroup()->push( new self( $this->title, [ 'after' => $batch['next'] ] ) );
		}
		return true;
	}
}
