<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Page\MergeHistory;
use MediaWiki\Page\MergeHistoryFactory;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Title\TitleFactory;

/** Native factory decorator; pilot history merges are deliberately unsupported. */
class PageOwnedPilotMergeFactory implements MergeHistoryFactory {
	private MergeHistoryFactory $inner;
	private TitleFactory $titles;
	private array $ownerKeys;

	/**
	 * @param MergeHistoryFactory $inner
	 * @param TitleFactory $titles
	 * @param string[] $ownerKeys Retained exact pilot owner keys
	 */
	public function __construct( MergeHistoryFactory $inner, TitleFactory $titles, array $ownerKeys ) {
		$this->inner = $inner;
		$this->titles = $titles;
		$this->ownerKeys = $ownerKeys;
	}

	/** @inheritDoc */
	public function newMergeHistory( PageIdentity $source, PageIdentity $destination,
		?string $timestamp = null, ?string $timestampOld = null
	): MergeHistory {
		foreach ( [ $source, $destination ] as $page ) {
			$key = $this->titles->newFromPageIdentity( $page )->getPrefixedDBkey();
			if ( in_array( $key, $this->ownerKeys, true ) ) {
				throw new PageOwnedMergeDenied();
			}
		}
		return $this->inner->newMergeHistory( $source, $destination, $timestamp, $timestampOld );
	}
}
