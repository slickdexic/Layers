<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Exception\ErrorPageError;

/** Typed pilot denial, localized for page consumers and mapped explicitly at the API boundary. */
class PageOwnedMergeDenied extends ErrorPageError {
	public function __construct() {
		parent::__construct( 'error', 'layers-admission-unauthorized' );
	}
}
