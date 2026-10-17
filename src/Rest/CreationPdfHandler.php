<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Rest;

use MediaWiki\Extension\Layers\Revision\PageMissingPdfViewerReadService;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Rest\Handler;
use MediaWiki\Rest\ResponseInterface;
use MediaWiki\Rest\StringStream;
use MediaWiki\User\UserFactory;
use Wikimedia\Message\MessageValue;

/** Exact empty-PDF delivery authorized by a current saved embedding and a compared source digest. */
class CreationPdfHandler extends Handler {
	private PageMissingPdfViewerReadService $source;
	private UserFactory $users;
	private RateLimiter $limiter;

	public function __construct( PageMissingPdfViewerReadService $source,
		UserFactory $users, RateLimiter $limiter
	) {
		$this->source = $source;
		$this->users = $users;
		$this->limiter = $limiter;
	}

	/** The selected owner and source are authorized explicitly, including on private wikis. */
	public function needsReadAccess(): bool {
		return false;
	}

	/** @inheritDoc */
	public function needsWriteAccess() {
		return false;
	}

	/** Conditional handling occurs inside execute after fresh source authorization. */
	public function checkPreconditions(): ?ResponseInterface {
		return null;
	}

	/** Validate inside execute so every endpoint refusal receives the same private response policy. */
	public function getParamSettings(): array {
		return [];
	}

	/** @inheritDoc */
	public function execute() {
		$capture = null;
		try {
			$method = $this->getRequest()->getMethod();
			if ( $method !== 'GET' && $method !== 'HEAD' ) {
				$response = $this->unavailable( 405 );
				$response->setHeader( 'Allow', 'GET, HEAD' );
				return $response;
			}
			$query = $this->getRequest()->getQueryParams();
			foreach ( $query as $name => $value ) {
				$allowed = [ 'pageid', 'revid', 'start', 'sourcekey', 'maxage', 'smaxage' ];
				if ( !in_array( $name, $allowed, true ) ||
					!is_string( $value )
				) {
					return $this->unavailable();
				}
			}
			foreach ( [ 'pageid', 'revid', 'start', 'sourcekey' ] as $key ) {
				if ( !isset( $query[$key] ) ) {
					return $this->unavailable();
				}
			}
			foreach ( [ 'pageid', 'revid' ] as $key ) {
				if ( !preg_match( '/^[1-9][0-9]{0,9}$/D', $query[$key] ) || (int)$query[$key] > 2147483647 ) {
					return $this->unavailable();
				}
			}
			if ( !preg_match( '/^(?:0|[1-9][0-9]{0,9})$/D', $query['start'] ) ||
				(int)$query['start'] > 2147483647 ||
				!preg_match( '/^[a-f0-9]{64}$/D', $query['sourcekey'] ) ) {
				return $this->unavailable();
			}
			$user = $this->users->newFromUserIdentity( $this->getAuthority()->getUser() );
			if ( !$this->limiter->checkRateLimit( $user, 'render' ) ) {
				return $this->unavailable( 429, 'layers-rate-limited' );
			}
			$capture = $this->source->captureOccurrence( (int)$query['pageid'], (int)$query['revid'],
				(int)$query['start'], $query['sourcekey'], $this->getAuthority() );
			foreach ( [ 'If-Match', 'If-None-Match', 'If-Modified-Since', 'If-Unmodified-Since' ] as $header ) {
				if ( $this->getRequest()->getHeaderLine( $header ) !== '' ) {
					$capture->close();
					return $this->unavailable( 400 );
				}
			}
			$response = $this->getResponseFactory()->create();
			$response->setHeader( 'Content-Type', 'application/pdf' );
			$response->setHeader( 'Content-Disposition', 'inline' );
			$response->setHeader( 'Content-Length', (string)$capture->getLength() );
			$response->setHeader( 'Accept-Ranges', 'none' );
			$response->setBody( $capture->toResponseBody() );
			// Range/If-Range are intentionally ignored: verified full-body 200 only.
			$this->privacy( $response );
			return $response;
		} catch ( \Throwable $exception ) {
			if ( $capture ) {
				$capture->close();
			}
			return $this->unavailable();
		}
	}

	/** Recheck at final native response admission and override session cache-header replacement. */
	public function applyCacheControl( ResponseInterface $response ) {
		$body = $response->getBody();
		if ( $body instanceof PinnedPdfResponseBody ) {
			try {
				$body->assertCanDeliver();
			} catch ( \Throwable $exception ) {
				$body->close();
				$failure = $this->unavailable();
				$response->setStatus( $failure->getStatusCode() );
				$response->setBody( $failure->getBody() );
				$response->setHeader( 'Content-Type', $failure->getHeaderLine( 'Content-Type' ) );
				foreach ( [ 'Content-Length', 'Content-Disposition', 'Accept-Ranges' ] as $header ) {
					$response->removeHeader( $header );
				}
			}
		}
		parent::applyCacheControl( $response );
		$this->privacy( $response );
		if ( $this->getRequest()->getMethod() === 'HEAD' ) {
			$response->getBody()->close();
			$response->setBody( new StringStream( '' ) );
		}
	}

	private function unavailable( int $status = 404,
		string $message = 'layers-revision-unavailable'
	): ResponseInterface {
		$response = $this->getResponseFactory()->createLocalizedHttpError( $status, new MessageValue( $message ) );
		$this->privacy( $response );
		return $response;
	}

	private function privacy( ResponseInterface $response ): void {
		PinnedPdfResponseHeaders::apply( $response );
	}
}
