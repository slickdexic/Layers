<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\Title\TitleFactory;

/** Experimental exact-revision read API; registered but disabled by default. */
class ApiLayersRead extends ApiBase {
	private PageReadService $reader;
	private TitleFactory $titles;
	private bool $enabled;
	private array $ownerKeys;

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @param PageReadService $reader
	 * @param TitleFactory $titles
	 * @param bool $enabled Default-off experimental gate
	 * @param string[] $ownerKeys Exact prefixed DB keys; empty permits no pilot pages
	 */
	public function __construct( ApiMain $main, string $name, PageReadService $reader,
		TitleFactory $titles, bool $enabled = false, array $ownerKeys = []
	) {
		parent::__construct( $main, $name );
		$this->reader = $reader;
		$this->titles = $titles;
		$this->enabled = $enabled;
		$this->ownerKeys = $ownerKeys;
	}

	public function execute() {
		// Apply to failures too; request-selected maxage must never make this user-dependent read public.
		$this->getMain()->setCacheMode( 'private' );
		$this->getMain()->setCacheMaxAge( 0 );
		if ( !$this->enabled ) {
			$this->dieWithError( 'layers-reading-disabled', 'layers-reading-disabled' );
		}
		$params = $this->extractRequestParams();
		$owner = $this->titles->newFromText( $params['owner'] );
		if ( !$owner || !$owner->canExist() || $owner->hasFragment() ||
			!in_array( $owner->getPrefixedDBkey(), $this->ownerKeys, true )
		) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-revision-unavailable' );
		}
		try {
			$bundle = $this->reader->read( $owner, $params['revid'], $this->getAuthority() );
		} catch ( \DomainException $e ) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-revision-unavailable' );
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned read failed.', [ 'exception' => $e ] );
			$this->dieWithError( 'layers-reading-failed', 'layers-reading-failed' );
		}
		$this->getResult()->addValue( null, $this->getModuleName(), $bundle );
	}

	/** @return array */
	public function getAllowedParams() {
		return [
			'owner' => [ self::PARAM_TYPE => 'string', self::PARAM_REQUIRED => true, self::PARAM_MAX_BYTES => 512 ],
			'revid' => [ self::PARAM_TYPE => 'integer', self::PARAM_REQUIRED => true,
				self::PARAM_MIN => 1, self::PARAM_MAX => 2147483647, self::PARAM_RANGE_ENFORCE => true ]
		];
	}
}
