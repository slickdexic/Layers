<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiMergeHistory;
use MediaWiki\Extension\Layers\Revision\PageOwnedMergeDenied;

/** Scoped pilot adapter; preserves core merge parameters, permissions and token handling. */
class ApiLayersMergeHistory extends ApiMergeHistory {
	/** @inheritDoc */
	public function execute() {
		try {
			parent::execute();
		} catch ( PageOwnedMergeDenied $e ) {
			$this->dieWithError( 'layers-admission-unauthorized', 'layers-admission-unauthorized' );
		}
	}
}
