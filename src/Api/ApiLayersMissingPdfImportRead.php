<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPreparation;
use MediaWiki\Extension\Layers\Security\RateLimiter;

/** Native read-only preparation for Import into an absent PDF layer set. */
class ApiLayersMissingPdfImportRead extends ApiBase {

	public function __construct( ApiMain $main, string $name,
		private PageMissingPdfImportPreparation $reader,
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
		try {
			if ( $params['sourcesurface'] === '' ) {
				throw new \DomainException();
			}
			if ( !$this->rateLimiter->checkRateLimit( $this->getUser(), 'render' ) ) {
				throw new \DomainException();
			}
			$data = $this->reader->prepare( $params['targetpageid'], $params['baserevid'],
				$params['embedstart'], $params['embedtext'], $params['sourcepageid'], $params['sourcerevid'],
				$params['sourcesurface'], $this->getAuthority() );
			// ASCII JSON avoids API metadata-key filtering and Unicode normalization of stored values.
			$payload = json_encode( $data, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION );
			if ( !$this->getResult()->addValue( null, $this->getModuleName(),
				[ 'version' => 1, 'data' => $payload ] ) ) {
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
		$member = [ self::PARAM_TYPE => 'raw', self::PARAM_REQUIRED => true, self::PARAM_MAX_BYTES => 128 ];
		// Raw strings preserve exact embed/JSON bytes instead of native NFC normalization.
		return [
			'targetpageid' => $integer, 'baserevid' => $integer,
			'embedstart' => array_replace( $integer, [ self::PARAM_MIN => 0 ] ),
			'embedtext' => [ self::PARAM_TYPE => 'raw', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ],
			'sourcepageid' => $integer, 'sourcerevid' => $integer, 'sourcesurface' => $member
		];
	}

	/** @return bool */
	public function mustBePosted() {
		return true;
	}
}
