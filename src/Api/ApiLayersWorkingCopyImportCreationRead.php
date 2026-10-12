<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationService;

/** Native read-only missing-target Import route; editor callers are separate. */
class ApiLayersWorkingCopyImportCreationRead extends ApiBase {
	private PageWorkingCopyImportCreationService $reader;

	public function __construct( ApiMain $main, string $name, PageWorkingCopyImportCreationService $reader ) {
		parent::__construct( $main, $name );
		$this->reader = $reader;
		$this->makePrivate();
	}

	public function execute() {
		$this->makePrivate();
		if ( !$this->getRequest()->wasPosted() ) {
			$this->dieWithError( [ 'apierror-mustbeposted', $this->getModuleName() ], 'mustbeposted' );
		}
		$params = $this->extractRequestParams();
		try {
			$data = $this->reader->read( $params['targetpageid'], $params['baserevid'],
				$params['targetsurface'], $params['embedstart'], $params['embedtext'], [
					'sourcePageId' => $params['sourcepageid'], 'sourceRevisionId' => $params['sourcerevid'],
					'sourceSurfaceId' => $params['sourcesurface'] ], $this->getAuthority() );
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
		$member = [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true, self::PARAM_MAX_BYTES => 128 ];
		return [
			'targetpageid' => $integer, 'baserevid' => $integer, 'targetsurface' => $member,
			'embedstart' => array_replace( $integer, [ self::PARAM_MIN => 0 ] ),
			'embedtext' => [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ],
			'sourcepageid' => $integer, 'sourcerevid' => $integer, 'sourcesurface' => $member
		];
	}

	/** @return bool */
	public function mustBePosted() {
		return true;
	}
}
