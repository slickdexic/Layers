<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiResult;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Security\RateLimiter;

/**
 * Other pages' drawings the editor may copy into this page (D1). Read-only; every page is read with the
 * caller's own rights, so nothing they cannot see is listed.
 */
class ApiLayersDrawings extends ApiBase {
	private PageOwnedPilot $pilot;

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @param PageOwnedPilot $pilot
	 */
	public function __construct( ApiMain $main, string $name, PageOwnedPilot $pilot ) {
		parent::__construct( $main, $name );
		$this->pilot = $pilot;
	}

	/** @inheritDoc */
	public function execute() {
		// The answer depends on the reader's rights, so it is never shared.
		$this->getMain()->setCacheMode( 'private' );
		$this->getMain()->setCacheMaxAge( 0 );
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
		foreach ( $this->pilot->searchDrawings( $params['search'], $params['exclude'], $params['limit'],
			$this->getAuthority() ) as $page ) {
			$drawings = [];
			foreach ( $page['drawings'] as $drawing ) {
				$drawings[] = [ 'id' => (string)$drawing['id'], 'label' => (string)$drawing['label'],
					'kind' => (string)$drawing['kind'] ];
			}
			ApiResult::setIndexedTagName( $drawings, 'drawing' );
			$pages[] = [ 'title' => $page['title']->getPrefixedText(), 'pageid' => $page['pageId'],
				'revid' => $page['revisionId'], 'drawings' => $drawings ];
		}
		ApiResult::setIndexedTagName( $pages, 'page' );
		$this->getResult()->addValue( null, $this->getModuleName(), [ 'pages' => $pages ] );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'search' => [ self::PARAM_TYPE => 'string', self::PARAM_DFLT => '', self::PARAM_MAX_BYTES => 255 ],
			'exclude' => [ self::PARAM_TYPE => 'integer', self::PARAM_DFLT => 0, self::PARAM_MIN => 0,
				self::PARAM_MAX => 2147483647 ],
			'limit' => [ self::PARAM_TYPE => 'limit', self::PARAM_DFLT => 10, self::PARAM_MIN => 1,
				self::PARAM_MAX => 20, self::PARAM_MAX2 => 20 ]
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=layersdrawings&search=Layers&exclude=228' => 'apihelp-layersdrawings-example'
		];
	}
}
