<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Page\MergeHistory;
use MediaWiki\Page\MergeHistoryFactory;
use MediaWiki\Page\PageIdentity;
use Wikimedia\Rdbms\IDBAccessObject;

/** Native factory decorator; merging history into or out of a page that owns drawings is unsupported. */
class PageOwnedPilotMergeFactory implements MergeHistoryFactory {
	private MergeHistoryFactory $inner;
	private PageOwnedScope $scope;

	/**
	 * @param MergeHistoryFactory $inner
	 * @param PageOwnedScope $scope
	 */
	public function __construct( MergeHistoryFactory $inner, PageOwnedScope $scope ) {
		$this->inner = $inner;
		$this->scope = $scope;
	}

	/** @inheritDoc */
	public function newMergeHistory( PageIdentity $source, PageIdentity $destination,
		?string $timestamp = null, ?string $timestampOld = null
	): MergeHistory {
		// Moved revisions would carry drawings bound to another PageID.
		foreach ( [ $source, $destination ] as $page ) {
			if ( $this->scope->ownsDrawings( $page, IDBAccessObject::READ_LATEST ) ) {
				throw new PageOwnedMergeDenied();
			}
		}
		return $this->inner->newMergeHistory( $source, $destination, $timestamp, $timestampOld );
	}
}
