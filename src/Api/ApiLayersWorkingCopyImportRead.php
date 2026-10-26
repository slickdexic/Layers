<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService;
use MediaWiki\Extension\Layers\Security\RateLimiter;

/** Registered native working-copy Import read endpoint. */
class ApiLayersWorkingCopyImportRead extends ApiBase {
	private PageWorkingCopyImportReadService $reader;

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @param PageWorkingCopyImportReadService $reader
	 */
	public function __construct( ApiMain $main, string $name, PageWorkingCopyImportReadService $reader ) {
		parent::__construct( $main, $name );
		$this->reader = $reader;
		$this->makePrivate();
	}

	public function execute() {
		$this->makePrivate();
		$params = $this->extractRequestParams();
		if ( !( new RateLimiter() )->checkRateLimit( $this->getUser(), 'info' ) ) {
			$this->dieWithError( 'apierror-ratelimited', 'ratelimited' );
		}
		if ( $params['targetsurface'] === '' || $params['sourcesurface'] === '' ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-working-copy-import-unavailable' );
		}
		try {
			$data = $this->reader->read( $params['targetpageid'], $params['baserevid'],
				$params['targetsurface'], $params['sourcepageid'], $params['sourcerevid'],
				$params['sourcesurface'], $this->getAuthority() );
			if ( $params['exacttext'] ) {
				// ASCII JSON preserves stored values through native API normalization and metadata handling.
				$payload = json_encode( $data, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION );
				if ( !$this->getResult()->addValue( null, $this->getModuleName(),
					[ 'version' => 1, 'data' => $payload ] ) ) {
					throw new \DomainException();
				}
				return;
			}
		} catch ( \Throwable $exception ) {
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
			'exacttext' => [ self::PARAM_TYPE => 'boolean', self::PARAM_DFLT => false ],
			'targetpageid' => $integer,
			'baserevid' => $integer,
			'targetsurface' => $member,
			'sourcepageid' => $integer,
			'sourcerevid' => $integer,
			'sourcesurface' => $member
		];
	}
}
