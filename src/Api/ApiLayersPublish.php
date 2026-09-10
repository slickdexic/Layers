<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\Title\TitleFactory;

/** Unregistered experimental API; enabled only in isolated core tests. */
class ApiLayersPublish extends ApiBase {
	private PagePublicationService $publisher;
	private TitleFactory $titles;
	private bool $enabled;

	private const PUBLIC_ERRORS = [
		'layers-owner-edit-denied', 'layers-invalid-publication-request',
		'layers-main-model-change-denied', 'layers-invalid-snapshot',
		'layers-source-unavailable', 'layers-edit-conflict', 'layers-revision-save-failed'
	];

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @param PagePublicationService $publisher
	 * @param TitleFactory $titles
	 * @param bool $enabled Explicit experimental gate; defaults to disabled
	 */
	public function __construct( ApiMain $main, string $name, PagePublicationService $publisher,
		TitleFactory $titles, bool $enabled = false
	) {
		parent::__construct( $main, $name );
		$this->publisher = $publisher;
		$this->titles = $titles;
		$this->enabled = $enabled;
	}

	public function execute() {
		if ( !$this->enabled ) {
			$this->dieWithError( 'layers-publication-disabled', 'layers-publication-disabled' );
		}
		if ( !$this->getRequest()->wasPosted() ) {
			$this->dieWithError( [ 'apierror-mustbeposted', $this->getModuleName() ], 'mustbeposted' );
		}
		$params = $this->extractRequestParams();
		$this->checkUserRightsAny( 'editlayers' );
		if ( $this->getUser()->pingLimiter( 'editlayers-save' ) ) {
			$this->dieWithError( 'apierror-ratelimited', 'ratelimited' );
		}
		$owner = $this->titles->newFromText( $params['owner'] );
		if ( !$owner || !$owner->canExist() || $owner->hasFragment() ) {
			$this->dieWithError( 'layers-invalid-publication-request', 'layers-invalid-publication-request' );
		}
		try {
			$id = $this->publisher->publish( $owner, $this->getAuthority(), $params['baserevid'],
				$params['data'], $params['summary'],
				$params['maintext'] !== null ? new WikitextContent( $params['maintext'] ) : null );
		} catch ( PublicationException $e ) {
			$code = in_array( $e->getMessage(), self::PUBLIC_ERRORS, true ) ?
				$e->getMessage() : 'layers-publication-failed';
			$this->dieWithError( $code, $code );
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned publication failed.', [ 'exception' => $e ] );
			$this->dieWithError( 'layers-publication-failed', 'layers-publication-failed' );
		}
		$this->getResult()->addValue( null, $this->getModuleName(), [ 'result' => 'Success', 'revid' => $id ] );
	}

	/** @return array */
	public function getAllowedParams() {
		return [
			'owner' => [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true, self::PARAM_MAX_BYTES => 512 ],
			'baserevid' => [ self::PARAM_TYPE => 'integer', self::PARAM_REQUIRED => true,
				self::PARAM_MIN => 0, self::PARAM_MAX => 2147483647, self::PARAM_RANGE_ENFORCE => true ],
			'data' => [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ],
			'maintext' => [ self::PARAM_TYPE => 'string', self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ],
			'summary' => [ self::PARAM_TYPE => 'string', self::PARAM_DFLT => '', self::PARAM_MAX_BYTES => 500 ]
		];
	}

	/** @return bool */
	public function isWriteMode() {
		return true;
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
