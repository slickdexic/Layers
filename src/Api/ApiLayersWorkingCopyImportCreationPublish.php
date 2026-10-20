<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationService;
use MediaWiki\Extension\Layers\Revision\PublicationException;

/** Native first-Save request boundary for missing image/slide Import targets. */
class ApiLayersWorkingCopyImportCreationPublish extends ApiBase {
	private PageWorkingCopyImportCreationService $publisher;

	private const PUBLIC_ERRORS = [
		'layers-owner-edit-denied', 'layers-invalid-publication-request', 'layers-invalid-snapshot',
		'layers-source-unavailable', 'layers-edit-conflict', 'layers-revision-save-failed',
		'layers-admission-unauthorized', 'layers-content-not-renderable', 'layers-edit-filtered',
		'layers-working-copy-import-unavailable'
	];

	public function __construct( ApiMain $main, string $name, PageWorkingCopyImportCreationService $publisher ) {
		parent::__construct( $main, $name );
		$this->publisher = $publisher;
		$this->makePrivate();
	}

	public function execute() {
		$this->makePrivate();
		if ( !$this->getRequest()->wasPosted() ) {
			$this->dieWithError( [ 'apierror-mustbeposted', $this->getModuleName() ], 'mustbeposted' );
		}
		$params = $this->extractRequestParams();
		$this->checkUserRightsAny( 'editlayers' );
		if ( $this->getUser()->pingLimiter( 'editlayers-save' ) ) {
			$this->dieWithError( 'apierror-ratelimited', 'ratelimited' );
		}
		if ( $this->getRequest()->getVal( 'maintext' ) !== null ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-working-copy-import-unavailable' );
		}
		try {
			$decoded = json_decode( $params['importsources'], false, 16, JSON_THROW_ON_ERROR );
			JsonSnapshotCodec::rejectDuplicateKeys( $params['importsources'] );
			if ( !is_array( $decoded ) || !$decoded || count( $decoded ) > 32 ) {
				throw new \InvalidArgumentException();
			}
			$sources = array_map( static function ( $source ): array {
				if ( !$source instanceof \stdClass ) {
					throw new \InvalidArgumentException();
				}
				return get_object_vars( $source );
			}, $decoded );
		} catch ( \Throwable $error ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-working-copy-import-unavailable' );
		}
		try {
			$id = $this->publisher->publish( $params['targetpageid'], $params['baserevid'],
				$params['targetsurface'], $params['embedstart'], $params['embedtext'], $params['data'],
				$sources, $this->getAuthority(), $params['summary'] );
		} catch ( PublicationException $error ) {
			$code = in_array( $error->getMessage(), self::PUBLIC_ERRORS, true ) ?
				$error->getMessage() : 'layers-publication-failed';
			$this->dieWithError( $error->getUserMessage() ?? $code, $code );
		} catch ( \Throwable $error ) {
			$this->dieWithError( 'layers-publication-failed', 'layers-publication-failed' );
		}
		$this->getResult()->addValue( null, $this->getModuleName(), [ 'result' => 'Success', 'revid' => $id ] );
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
			'targetpageid' => $integer, 'baserevid' => $integer,
			'targetsurface' => [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => 128 ],
			'embedstart' => array_replace( $integer, [ self::PARAM_MIN => 0 ] ),
			'embedtext' => [ self::PARAM_TYPE => 'raw', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ],
			'data' => [ self::PARAM_TYPE => 'raw', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ],
			'importsources' => [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => 16384 ],
			'summary' => [ self::PARAM_TYPE => 'string', self::PARAM_DFLT => '', self::PARAM_MAX_CHARS => 500 ]
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
