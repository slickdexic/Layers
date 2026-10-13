<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;

/** Native historical draft association proof only; never applies work or publishes. */
class ApiLayersWorkingCopyImportCreationDraftRebase extends ApiBase {
	private PageOwnedPilot $pilot;

	public function __construct( ApiMain $main, string $name, PageOwnedPilot $pilot ) {
		parent::__construct( $main, $name );
		$this->pilot = $pilot;
		$this->makePrivate();
	}

	public function execute() {
		$this->makePrivate();
		if ( !$this->getRequest()->wasPosted() ) {
			$this->dieWithError( [ 'apierror-mustbeposted', $this->getModuleName() ], 'mustbeposted' );
		}
		$params = $this->extractRequestParams();
		try {
			$data = $this->pilot->prepareCreationDraftRebase( $params['targetpageid'], $params['baserevid'],
				$params['originsurface'], $params['originrevid'], $this->getAuthority() );
		} catch ( \Throwable $error ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-working-copy-import-unavailable' );
		}
		$this->getResult()->addValue( null, $this->getModuleName(), $data );
	}

	private function makePrivate(): void {
		$this->getMain()->setCacheMode( 'private' );
		$this->getMain()->setCacheMaxAge( 0 );
	}

	/** @return array */
	public function getAllowedParams() {
		$integer = [ self::PARAM_TYPE => 'integer', self::PARAM_REQUIRED => true,
			self::PARAM_MIN => 1, self::PARAM_MAX => 2147483647, self::PARAM_RANGE_ENFORCE => true ];
		return [
			'targetpageid' => $integer, 'baserevid' => $integer, 'originrevid' => $integer,
			'originsurface' => [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => 128 ]
		];
	}

	/** @return bool */
	public function mustBePosted() {
		return true;
	}
}
