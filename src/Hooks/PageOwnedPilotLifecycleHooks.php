<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Page\Hook\PageUndeleteHook;
use MediaWiki\Page\ProperPageIdentity;
use MediaWiki\Permissions\Authority;
use StatusValue;

/** Native lifecycle guard for pages that own drawings. Moves need none: drawings belong to the PageID. */
class PageOwnedPilotLifecycleHooks implements PageUndeleteHook {
	private PageOwnedScope $scope;

	/**
	 * @param PageOwnedScope $scope
	 */
	public function __construct( PageOwnedScope $scope ) {
		$this->scope = $scope;
	}

	/** @inheritDoc */
	public function onPageUndelete(
		ProperPageIdentity $page,
		Authority $performer,
		string $reason,
		bool $unsuppress,
		array $timestamps,
		array $fileVersions,
		StatusValue $status
	) {
		// Do not tie this protection to the write-enable switch: disabling writes must not open restore.
		if ( $this->scope->canRestore( $page, $timestamps ) ) {
			return true;
		}
		$status->fatal( 'layers-restore-drawings-denied' );
		return false;
	}
}
