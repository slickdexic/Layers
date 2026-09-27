<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiResult;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Experimental exact-revision read API; registered but disabled by default. */
class ApiLayersRead extends ApiBase {
	private PageReadService $reader;
	private TitleFactory $titles;
	private bool $enabled;
	private ?PageOwnedScope $scope;
	/** @var callable|null (Title, int, string[], Authority): array Authorized bound surfaces keyed by binding */
	private $boundReader;
	private int $bindingMaxAge;

	/**
	 * @param ApiMain $main
	 * @param string $name
	 * @param PageReadService $reader
	 * @param TitleFactory $titles
	 * @param bool $enabled Default-off experimental gate
	 * @param PageOwnedScope|null $scope Pages taking part; null permits none
	 * @param callable|null $boundReader Pilot binding reader; binding requests fail without it
	 * @param int $bindingMaxAge Seconds anonymous binding reads of a current revision may be cached; 0 never
	 */
	public function __construct( ApiMain $main, string $name, PageReadService $reader,
		TitleFactory $titles, bool $enabled = false, ?PageOwnedScope $scope = null, ?callable $boundReader = null,
		int $bindingMaxAge = 0
	) {
		parent::__construct( $main, $name );
		$this->reader = $reader;
		$this->titles = $titles;
		$this->enabled = $enabled;
		$this->scope = $scope;
		$this->boundReader = $boundReader;
		$this->bindingMaxAge = max( 0, $bindingMaxAge );
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
			!$this->scope || !$this->scope->includes( $owner )
		) {
			$this->dieWithError( 'layers-revision-unavailable', 'layers-revision-unavailable' );
		}
		try {
			if ( $params['binding'] !== null ) {
				if ( !$this->boundReader ) {
					throw new \DomainException( 'layers-revision-unavailable' );
				}
				// Unavailable, foreign and malformed bindings are omitted rather than distinguished.
				$bindings = ( $this->boundReader )( $owner, $params['revid'], $params['binding'],
					$this->getAuthority() );
				$bindings[ApiResult::META_TYPE] = 'assoc';
				$this->getResult()->addValue( null, $this->getModuleName(), [ 'bindings' => $bindings ] );
				// Page views read the current revision, which cannot be hidden while it is current, and every
				// anonymous reader has the same rights. Older revisions can be hidden later, so they stay private.
				if ( $this->bindingMaxAge > 0 &&
					$params['revid'] === $owner->getLatestRevID( IDBAccessObject::READ_LATEST )
				) {
					$this->getMain()->setCacheMode( 'anon-public-user-private' );
					$this->getMain()->setCacheMaxAge( $this->bindingMaxAge );
				}
				return;
			}
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
				self::PARAM_MIN => 1, self::PARAM_MAX => 2147483647, self::PARAM_RANGE_ENFORCE => true ],
			'binding' => [ self::PARAM_TYPE => 'string', self::PARAM_ISMULTI => true,
				self::PARAM_ISMULTI_LIMIT1 => 50, self::PARAM_ISMULTI_LIMIT2 => 50, self::PARAM_MAX_BYTES => 128 ]
		];
	}
}
