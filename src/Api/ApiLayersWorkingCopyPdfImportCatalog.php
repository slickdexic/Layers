<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Security\RateLimiter;

/** Read-only discovery of complete PDF layer sets; a choice never grants Import authority. */
class ApiLayersWorkingCopyPdfImportCatalog extends ApiBase {

	public function __construct( ApiMain $main, string $name, private PageOwnedPilot $pilot ) {
		parent::__construct( $main, $name );
		$this->makePrivate();
	}

	/** @inheritDoc */
	public function execute() {
		$this->makePrivate();
		$this->checkUserRightsAny( 'editlayers' );
		$user = $this->getUser();
		if ( !$user->isNamed() ) {
			$this->dieWithError( 'apierror-mustbeloggedin-generic', 'notloggedin' );
		}
		if ( !( new RateLimiter() )->checkRateLimit( $user, 'list' ) ) {
			$this->dieWithError( 'layers-rate-limited', 'layers-rate-limited' );
		}
		$params = $this->extractRequestParams();
		$pages = [];
		foreach ( $this->pilot->searchPdfImportSources( $params['search'], $params['exclude'],
			$params['limit'], $this->getAuthority() ) as $page ) {
			$sets = $page['drawings'];
			$pages[] = [ 'title' => $page['title']->getPrefixedText(),
				'owner' => $page['title']->getPrefixedDBkey(), 'pageid' => $page['pageId'],
				'revid' => $page['revisionId'], 'layerSets' => $sets ];
		}
		// Native string formatting normalizes Unicode; ASCII JSON preserves exact stored names.
		$data = json_encode( [ 'pages' => $pages ], JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION );
		if ( !$this->getResult()->addValue( null, $this->getModuleName(), [ 'version' => 1, 'data' => $data ] ) ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-working-copy-import-unavailable' );
		}
	}

	private function makePrivate(): void {
		$this->getMain()->setCacheMode( 'private' );
		$this->getMain()->setCacheMaxAge( 0 );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'search' => [ self::PARAM_TYPE => 'string', self::PARAM_DFLT => '', self::PARAM_MAX_BYTES => 255 ],
			'exclude' => [ self::PARAM_TYPE => 'integer', self::PARAM_REQUIRED => true,
				self::PARAM_MIN => 1, self::PARAM_MAX => 2147483647, self::PARAM_RANGE_ENFORCE => true ],
			'limit' => [ self::PARAM_TYPE => 'limit', self::PARAM_DFLT => 10,
				self::PARAM_MIN => 1, self::PARAM_MAX => 20, self::PARAM_MAX2 => 20 ]
		];
	}
}
