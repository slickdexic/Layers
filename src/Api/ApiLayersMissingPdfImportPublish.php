<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPublicationService;
use MediaWiki\Extension\Layers\Revision\PublicationException;

/** Native first-Save transport for Import into an absent PDF layer set. */
class ApiLayersMissingPdfImportPublish extends ApiBase {

	private const PUBLIC_ERRORS = [
		'layers-owner-edit-denied', 'layers-invalid-publication-request', 'layers-invalid-snapshot',
		'layers-source-unavailable', 'layers-edit-conflict', 'layers-revision-save-failed',
		'layers-admission-unauthorized', 'layers-slot-removal-denied', 'layers-content-not-renderable',
		'layers-edit-filtered', 'layers-working-copy-import-unavailable'
	];

	public function __construct( ApiMain $main, string $name,
		private PageMissingPdfImportPublicationService $publisher
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
		if ( $this->getUser()->pingLimiter( 'editlayers-save' ) ) {
			$this->dieWithError( 'apierror-ratelimited', 'ratelimited' );
		}
		if ( $this->getRequest()->getVal( 'maintext' ) !== null ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-working-copy-import-unavailable' );
		}
		try {
			$sources = $this->records( $params['importsources'], 1, 32 );
		} catch ( \Throwable $error ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-working-copy-import-unavailable' );
		}
		try {
			$id = $this->publisher->publish( $params['targetpageid'], $params['baserevid'],
				$params['embedstart'], $params['embedtext'], $params['data'],
				$sources, $this->getAuthority(), $params['summary'] );
		} catch ( PublicationException $error ) {
			$code = in_array( $error->getMessage(), self::PUBLIC_ERRORS, true ) ?
				$error->getMessage() : 'layers-publication-failed';
			$this->dieWithError( $error->getUserMessage() ?? $code, $code );
		} catch ( \Throwable $error ) {
			$this->dieWithError( 'layers-publication-failed', 'layers-publication-failed' );
		}
		if ( $id <= $params['baserevid'] || $id > 2147483647 ) {
			$this->dieWithError( 'layers-publication-failed', 'layers-publication-outcome-unknown' );
		}
		// Publication has committed. A failed response cannot safely be reported as a refused write.
		if ( !$this->getResult()->addValue( null, $this->getModuleName(),
			[ 'version' => 1, 'result' => 'Success', 'revid' => $id ] ) ) {
			$this->dieWithError( 'layers-publication-failed', 'layers-publication-outcome-unknown' );
		}
	}

	/** Decode literal records without losing duplicate JSON member evidence. */
	private function records( string $json, int $minimum, int $maximum ): array {
		JsonSnapshotCodec::rejectDuplicateKeys( $json );
		$values = json_decode( $json, false, 16, JSON_THROW_ON_ERROR );
		if ( !is_array( $values ) || count( $values ) < $minimum || count( $values ) > $maximum ) {
			throw new \DomainException();
		}
		return array_map( static function ( $value ): array {
			if ( !$value instanceof \stdClass ) {
				throw new \DomainException();
			}
			return get_object_vars( $value );
		}, $values );
	}

	private function makePrivate(): void {
		$this->getMain()->setCacheMode( 'private' );
		$this->getMain()->setCacheMaxAge( 0 );
	}

	/** @return array */
	public function getAllowedParams() {
		$integer = [ self::PARAM_TYPE => 'integer', self::PARAM_REQUIRED => true,
			self::PARAM_MIN => 1, self::PARAM_MAX => 2147483647, self::PARAM_RANGE_ENFORCE => true ];
		// Raw strings preserve exact embed/JSON bytes instead of native NFC normalization.
		return [
			'targetpageid' => $integer, 'baserevid' => $integer,
			'embedstart' => array_replace( $integer, [ self::PARAM_MIN => 0 ] ),
			'embedtext' => [ self::PARAM_TYPE => 'raw', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ],
			'data' => [ self::PARAM_TYPE => 'raw', self::PARAM_REQUIRED => true,
				self::PARAM_MAX_BYTES => DocumentSchema::MAX_BYTES ],
			'importsources' => [ self::PARAM_TYPE => 'raw', self::PARAM_REQUIRED => true,
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
