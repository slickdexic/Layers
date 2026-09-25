<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Hook\MovePageIsValidMoveHook;
use MediaWiki\Page\Hook\PageUndeleteHook;
use MediaWiki\Page\ProperPageIdentity;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\TitleFactory;
use StatusValue;

/** Unregistered pilot guards. Restore and rename await full lifecycle integration. */
class PageOwnedPilotLifecycleHooks implements PageUndeleteHook, MovePageIsValidMoveHook {
	private TitleFactory $titles;
	private array $ownerKeys;

	/**
	 * @param TitleFactory $titles
	 * @param string[] $ownerKeys Exact pilot owner prefixed DB keys, shared with the API scope
	 */
	public function __construct( TitleFactory $titles, array $ownerKeys ) {
		$this->titles = $titles;
		$this->ownerKeys = $ownerKeys;
	}

	/** @inheritDoc */
	public function onMovePageIsValidMove( $oldTitle, $newTitle, $status ) {
		if ( in_array( $oldTitle->getPrefixedDBkey(), $this->ownerKeys, true ) ||
			in_array( $newTitle->getPrefixedDBkey(), $this->ownerKeys, true )
		) {
			$status->fatal( 'layers-admission-unauthorized' );
			return false;
		}
		return true;
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
		$key = $this->titles->newFromPageIdentity( $page )->getPrefixedDBkey();
		if ( !in_array( $key, $this->ownerKeys, true ) ) {
			return true;
		}
		// Core restore bypasses MultiContentSave. Veto before any archived revision/file is restored.
		// Do not tie this protection to the write-enable switch: disabling writes must not open restore.
		$status->fatal( 'layers-admission-unauthorized' );
		return false;
	}
}
