<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfViewerReadService;
use MediaWiki\Extension\Layers\Security\RateLimiter;

/** Fresh read-only viewer admission; edit rights and a stored Layers slot are not prerequisites. */
class ApiLayersPdfCreationView extends ApiBase {

	public function __construct( ApiMain $main, string $name, private PageMissingPdfViewerReadService $reader ) {
		parent::__construct( $main, $name );
		$this->makePrivate();
	}

	public function execute() {
		$this->makePrivate();
		if ( !$this->getRequest()->wasPosted() ) {
			$this->dieWithError( [ 'apierror-mustbeposted', $this->getModuleName() ], 'mustbeposted' );
		}
		$params = $this->extractRequestParams();
		if ( !( new RateLimiter() )->checkRateLimit( $this->getUser(), 'info' ) ) {
			$this->dieWithError( 'apierror-ratelimited', 'ratelimited' );
		}
		try {
			$viewer = $this->reader->read( $params['pageid'], $params['baserevid'], $params['embedstart'],
				$params['embedtext'], $this->getAuthority() );
		} catch ( \Throwable $error ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-revision-unavailable' );
		}
		$this->getResult()->addValue( null, $this->getModuleName(), $viewer );
	}

	private function makePrivate(): void {
		$this->getMain()->setCacheMode( 'private' );
		$this->getMain()->setCacheMaxAge( 0 );
	}

	/** @return array */
	public function getAllowedParams() {
		$integer = [ self::PARAM_TYPE => 'integer', self::PARAM_REQUIRED => true,
			self::PARAM_MIN => 1, self::PARAM_MAX => 2147483647, self::PARAM_RANGE_ENFORCE => true ];
		return [ 'pageid' => $integer, 'baserevid' => $integer,
			'embedstart' => array_replace( $integer, [ self::PARAM_MIN => 0 ] ),
			'embedtext' => [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ] ];
	}

	/** @return bool */
	public function mustBePosted() {
		return true;
	}
}
