<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\JobQueue\Job;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

/** Retry an individual page's search refresh after verification fails. */
class PageSearchRefreshJob extends Job {
	public function __construct( Title $title, array $params ) {
		parent::__construct( 'layersPageSearchRefresh', $title, $params );
		$this->removeDuplicates = false;
	}

	/** @inheritDoc */
	public function run() {
		$pageId = $this->params['pageId'] ?? null;
		if ( !is_int( $pageId ) || $pageId <= 0 ) {
			return false;
		}
		$services = MediaWikiServices::getInstance();
		$page = $services->getPageStore()->getPageById( $pageId, IDBAccessObject::READ_LATEST );
		if ( $page ) {
			$services->getService( 'LayersDrawingSearchText' )->update( $page );
		}
		return true;
	}
}
