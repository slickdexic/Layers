<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportOutcomeReadService;
use MediaWiki\Extension\Layers\Security\RateLimiter;

/** Private, read-only confirmation after a missing-PDF Import response is lost. */
class ApiLayersMissingPdfImportOutcome extends ApiBase {

	public function __construct( ApiMain $main, string $name,
		private PageMissingPdfImportOutcomeReadService $reader,
		private RateLimiter $rateLimiter
	) {
		parent::__construct( $main, $name );
		$this->makePrivate();
	}

	public function execute() {
		$this->makePrivate();
		if ( !$this->getRequest()->wasPosted() ) {
			$this->dieWithError( [ 'apierror-mustbeposted', $this->getModuleName() ], 'mustbeposted' );
		}
		$params = $this->extractRequestParams();
		$this->checkUserRightsAny( 'editlayers' );
		try {
			if ( !$this->rateLimiter->checkRateLimit( $this->getUser(), 'render' ) ||
				$this->getRequest()->getVal( 'maintext' ) !== null ) {
				throw new \DomainException();
			}
			JsonSnapshotCodec::rejectDuplicateKeys( $params['importsources'] );
			$records = json_decode( $params['importsources'], false, 16, JSON_THROW_ON_ERROR );
			if ( !is_array( $records ) || !$records || count( $records ) > 32 ) {
				throw new \DomainException();
			}
			$sources = array_map( static function ( $value ): array {
				if ( !$value instanceof \stdClass ) {
					throw new \DomainException();
				}
				return get_object_vars( $value );
			}, $records );
			$id = $this->reader->confirm( $params['targetpageid'], $params['baserevid'], $params['owner'],
				$params['embedstart'], $params['embedtext'], $params['data'], $sources,
				$this->getAuthority(), $params['summary'] );
			if ( !$this->getResult()->addValue( null, $this->getModuleName(),
				[ 'version' => 1, 'result' => 'Confirmed', 'revid' => $id ] ) ) {
				throw new \DomainException();
			}
		} catch ( \Throwable $error ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-working-copy-import-unavailable' );
		}
	}

	private function makePrivate(): void {
		$this->getMain()->setCacheMode( 'private' );
		$this->getMain()->setCacheMaxAge( 0 );
	}

	/** @return array */
	public function getAllowedParams() {
		$integer = [ self::PARAM_TYPE => 'integer', self::PARAM_REQUIRED => true,
			self::PARAM_MIN => 1, self::PARAM_MAX => 2147483647, self::PARAM_RANGE_ENFORCE => true ];
		$raw = [ self::PARAM_TYPE => 'raw', self::PARAM_REQUIRED => true,
			self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ];
		return [
			'targetpageid' => $integer, 'baserevid' => $integer,
			'owner' => array_replace( $raw, [ self::PARAM_MAX_BYTES => 1024 ] ),
			'embedstart' => array_replace( $integer, [ self::PARAM_MIN => 0 ] ),
			'embedtext' => $raw, 'data' => $raw,
			'importsources' => array_replace( $raw, [ self::PARAM_MAX_BYTES => 16384 ] ),
			'summary' => [ self::PARAM_TYPE => 'string', self::PARAM_DFLT => '', self::PARAM_MAX_CHARS => 500 ]
		];
	}

	/** @return bool */
	public function mustBePosted() {
		return true;
	}

	/** @return string */
	public function needsToken() {
		return 'csrf';
	}
}
