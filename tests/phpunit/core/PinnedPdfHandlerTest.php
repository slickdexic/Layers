<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use GuzzleHttp\Psr7\Uri;
use MediaWiki\Config\ServiceOptions;
use MediaWiki\Extension\Layers\Hooks\PinnedPdfPrivacyHooks;
use MediaWiki\Extension\Layers\Rest\PinnedPdfHandler;
use MediaWiki\Extension\Layers\Rest\PinnedPdfResponseBody;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PinnedPdfSource;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Rest\BasicAccess\MWBasicAuthorizer;
use MediaWiki\Rest\CorsUtils;
use MediaWiki\Rest\EntryPoint;
use MediaWiki\Rest\Module\Module;
use MediaWiki\Rest\RequestData;
use MediaWiki\Rest\ResponseFactory;
use MediaWiki\Rest\ResponseInterface;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Session\Session;
use MediaWiki\Tests\MockEnvironment;
use MediaWiki\Tests\Rest\RestTestTrait;
use Wikimedia\FileBackend\FSFile\TempFSFile;

require_once __DIR__ . '/RealAssetTestCase.php';
require_once getenv( 'MW_INSTALL_PATH' ) . '/tests/phpunit/unit/includes/Rest/RestTestTrait.php';

/**
 * Native handler/object evidence; this is not a live HTTP or browser acceptance test.
 * @covers \MediaWiki\Extension\Layers\Rest\PinnedPdfHandler
 * @covers \MediaWiki\Extension\Layers\Rest\PinnedPdfResponseBody
 * @covers \MediaWiki\Extension\Layers\Revision\PinnedPdfStream
 * @covers \MediaWiki\Extension\Layers\Revision\PinnedPdfSource
 * @group Database
 */
class PinnedPdfHandlerTest extends RealAssetTestCase {
	use RestTestTrait;

	private array $copyPaths = [];
	private array $limitCalls = [];

	private function fixture( bool $extras = false ): array {
		$actor = $this->actor();
		$title = 'File:PdfHandler-' . wfRandomString() . '.pdf';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			$title, '20261005100000' );
		$page = $this->getExistingTestPage();
		$surface = $this->makePdfSurface( 'pdf-anchor', 'Plan001', $title, $file->getTimestamp(), $file->getSha1() );
		$surfaces = [ $surface ];
		$other = null;
		if ( $extras ) {
			$other = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
				'File:ResponseOther-' . wfRandomString() . '.pdf', '20261005100000' );
			$surfaces[] = $this->makePdfSurface( 'other', 'OtherSet', 'File:' . $other->getName(),
				$other->getTimestamp(), $other->getSha1() );
			$surfaces[] = $this->makeSlideSurface( 'non-pdf', 'OtherSlide' );
		}
		$revision = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			$this->buildDocument( $surfaces ), 'Isolated PDF response' );
		$content = ( new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ) )->read(
			$page->getTitle(), $revision, $actor );
		$this->assertSame( $this->canonical( json_decode( $this->buildDocument( $surfaces ), true ) ),
			$this->canonical( json_decode( $content->getText(), true ) ) );
		return [ 'actor' => $actor, 'page' => $page, 'fileTitle' => $title, 'revision' => $revision,
			'file' => $file, 'content' => $content, 'other' => $other, 'surface' => $surface,
			'query' => [ 'owner' => $page->getTitle()->getPrefixedText(), 'revid' => (string)$revision,
				'binding' => 'v1:' . $page->getId() . ':pdf-anchor' ] ];
	}

	private function handler( array $fixture, array $query, string $method = 'GET',
		array $headers = [], bool $limited = false, ?PinnedPdfSource $source = null, bool $initialize = true,
		bool $persistent = true
	): PinnedPdfHandler {
		$services = $this->getServiceContainer();
		$observe = function ( string $path ) {
			$this->copyPaths[] = $path;
		};
		$source ??= new class( new PageHistoryAccess( $services->getRevisionLookup() ),
			$this->resolver, PageOwnedScope::newFromServices( $services, [] ), $observe ) extends PinnedPdfSource {
			private \Closure $observe;

			public function __construct( PageHistoryAccess $access, SourceVersionResolver $sources,
				PageOwnedScope $scope, \Closure $observe
			) {
				parent::__construct( $access, $sources, $scope );
				$this->observe = $observe;
			}

			protected function copyFile( File $file ): TempFSFile {
				$copy = parent::copyFile( $file );
				( $this->observe )( $copy->getPath() );
				return $copy;
			}
		};
		$limiter = $this->createMock( RateLimiter::class );
		$limiter->method( 'checkRateLimit' )->willReturnCallback( function ( $user, $action ) use ( $limited ) {
			$this->limitCalls[] = [ 'userId' => $user->getId(), 'action' => $action,
				'userClass' => get_class( $user ) ];
			return !$limited;
		} );
		$handler = new PinnedPdfHandler( $source, $services->getTitleFactory(),
			$services->getUserFactory(), $limiter );
		if ( !$initialize ) {
			return $handler;
		}
		$handler->initContext( $this->createMock( Module::class ), '/layers/v0/pdf', [] );
		$formatter = $services->getMessageFormatterFactory()->getTextFormatter( 'en' );
		$handler->initServices( $fixture['actor'], new ResponseFactory( [ 'en' => $formatter ] ),
			$services->getHookContainer() );
		$session = $this->createMock( Session::class );
		$session->method( 'isPersistent' )->willReturn( $persistent );
		$handler->initSession( $session );
		$handler->initForExecute( new RequestData( [ 'method' => $method, 'queryParams' => $query,
			'headers' => $headers, 'parsedBody' => $method === 'POST' ? [] : null ] ) );
		return $handler;
	}

	private function assertPrivate( ResponseInterface $response ): void {
		$this->assertSame( 'private, no-store, no-cache, max-age=0, s-maxage=0, must-revalidate',
			$response->getHeaderLine( 'Cache-Control' ) );
		$this->assertSame( 'no-cache', $response->getHeaderLine( 'Pragma' ) );
		$this->assertSame( 'Thu, 01 Jan 1970 00:00:00 GMT', $response->getHeaderLine( 'Expires' ) );
		$this->assertSame( 'nosniff', $response->getHeaderLine( 'X-Content-Type-Options' ) );
		$this->assertFalse( $response->hasHeader( 'ETag' ) );
		$this->assertFalse( $response->hasHeader( 'Last-Modified' ) );
	}

	private function deliveredBytes( ResponseInterface $response ): string {
		$body = $response->getBody();
		$this->assertInstanceOf( PinnedPdfResponseBody::class, $body );
		$sink = fopen( 'php://temp', 'w+b' );
		try {
			$body->rewind();
			$body->copyToStream( $sink );
			rewind( $sink );
			return stream_get_contents( $sink );
		} finally {
			$body->close();
			fclose( $sink );
		}
	}

	private function canonical( array $values ): array {
		foreach ( $values as &$value ) {
			if ( is_array( $value ) ) {
				$value = $this->canonical( $value );
			}
		}
		unset( $value );
		if ( !array_is_list( $values ) ) {
			ksort( $values );
		}
		return $values;
	}

	private function rows(): array {
		$result = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = $values;
			}
			usort( $rows, static fn ( $left, $right ) => strcmp( serialize( $left ), serialize( $right ) ) );
			$result[$table] = $rows;
		}
		return $result;
	}

	private function evidence( string $name, array $values, array $files = [] ): void {
		$directory = getenv( 'LAYERS_PDF_RESPONSE_EVIDENCE_DIR' );
		if ( !is_string( $directory ) || $directory === '' ) {
			return;
		}
		$this->assertDirectoryExists( $directory );
		foreach ( $files as $filename => $bytes ) {
			$this->assertFileDoesNotExist( $directory . '/' . $filename );
			$this->assertSame( strlen( $bytes ), file_put_contents( $directory . '/' . $filename, $bytes ) );
			$values['files'][$filename] = [ 'bytes' => strlen( $bytes ), 'sha256' => hash( 'sha256', $bytes ),
				'sha1Hex' => sha1( $bytes ) ];
		}
		$json = json_encode( $values, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR ) . "\n";
		$this->assertFileDoesNotExist( $directory . '/' . $name . '.json' );
		$this->assertSame( strlen( $json ), file_put_contents( $directory . '/' . $name . '.json', $json ) );
	}

	private function assertReleased(): void {
		foreach ( $this->copyPaths as $path ) {
			$this->assertFileDoesNotExist( $path );
		}
	}

	private function nativeRequest( array $query, string $method, array $headers, array $options ): RequestData {
		$requestData = [ 'uri' => new Uri( $options['uri'] ?? '/rest/layers/v0/pdf' ),
			'queryParams' => $query, 'method' => $method, 'headers' => $headers ];
		if ( $method === 'POST' && !( $options['unparsed'] ?? false ) ) {
			$requestData['parsedBody'] = [];
		}
		return new RequestData( $requestData );
	}

	private function nativeRouter( array $fixture, array $query, string $method, array $headers,
		bool $persistent, bool $limited, array $options
	): \MediaWiki\Rest\Router {
		$request = $this->nativeRequest( $query, $method, $headers, $options );
		$handler = $this->handler( $fixture, $query, $method, $headers, $limited, null, false );
		$services = $this->getServiceContainer();
		$factory = new ResponseFactory( [ 'en' => $services->getMessageFormatterFactory()->getTextFormatter( 'en' ) ] );
		$session = $this->getSession( $persistent );
		if ( $options['session-error'] ?? false ) {
			$handler = $this->getMockBuilder( PinnedPdfHandler::class )->disableOriginalConstructor()
				->onlyMethods( [ 'checkSession' ] )->getMock();
			$handler->method( 'checkSession' )->willThrowException(
				new \MediaWiki\Rest\HttpException( 'Test session refusal', 403 ) );
		}
		$routes = [];
		foreach ( $options['methods'] ?? [ 'GET', 'HEAD', 'POST' ] as $allowed ) {
			$routes[] = [ 'path' => '/layers/v0/pdf', 'method' => $allowed, 'factory' => static fn () => $handler ];
		}
		$router = $this->newRouter( [ 'routeFiles' => [], 'extraRoutes' => $routes, 'request' => $request,
			'authority' => $fixture['actor'], 'responseFactory' => $factory,
			'basicAuth' => new MWBasicAuthorizer( $fixture['actor'] ), 'session' => $session,
			'hookContainer' => $services->getHookContainer() ] );
		if ( $options['cors'] ?? false ) {
			$router->setCors( new CorsUtils( new ServiceOptions( CorsUtils::CONSTRUCTOR_OPTIONS,
				$services->getMainConfig() ), $factory,
				$services->getUserFactory()->newFromUserIdentity( $fixture['actor']->getUser() ) ) );
		}
		return $router;
	}

	private function dispatch( array $fixture, array $query, string $method = 'GET', array $headers = [],
		bool $persistent = true, bool $limited = false, array $options = []
	): ResponseInterface {
		return $this->nativeRouter( $fixture, $query, $method, $headers, $persistent, $limited, $options )
			->execute( $this->nativeRequest( $query, $method, $headers, $options ) );
	}

	public function testNativeCorsPreflightBypassesEndpointPrivacy(): void {
		$fixture = $this->fixture();
		$tables = $this->rows();
		$response = $this->dispatch( $fixture, $fixture['query'], 'OPTIONS',
			[ 'Origin' => 'https://not-allowed.example', 'Access-Control-Request-Method' => 'GET' ],
			false, false, [ 'cors' => true ] );
		try {
			$this->assertSame( 204, $response->getStatusCode() );
			$this->assertSame( '', $response->getHeaderLine( 'Cache-Control' ) );
			$this->assertSame( '', (string)$response->getBody() );
			$this->assertStringContainsString( 'GET', $response->getHeaderLine( 'Access-Control-Allow-Methods' ) );
			$this->assertSame( [], $this->copyPaths );
			$this->assertSame( $tables, $this->rows() );
			$this->evidence( 'native-cors-preflight', [ 'status' => $response->getStatusCode(),
				'headers' => $response->getHeaders(), 'endpointNotExecuted' => true,
				'limitation' => 'Native CORS preflight metadata; not wire HTTP or an origin-authorized PDF' ] );
		} finally {
			$response->getBody()->close();
		}
	}

	public function testNativeAnonymousAllowedDeniedAndPrivateReaderRestoreFullConfiguration(): void {
		$fixture = $this->fixture();
		$originalActor = $fixture['actor'];
		$config = $this->configWitness();
		$tables = $this->rows();
		$observations = [];
		try {
			$this->setGroupPermissions( '*', 'read', true );
			$anonymous = $this->getServiceContainer()->getUserFactory()->newAnonymous();
			$this->assertFalse( $anonymous->isAllowed( 'editlayers' ) );
			$fixture['actor'] = $anonymous;
			$response = $this->dispatch( $fixture, $fixture['query'], 'GET', [], false );
			$this->assertSame( 200, $response->getStatusCode() );
			$this->assertPrivate( $response );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->deliveredBytes( $response ) );
			$this->setGroupPermissions( '*', 'read', false );
			$fixture['actor'] = $this->getServiceContainer()->getUserFactory()->newAnonymous();
			$copies = count( $this->copyPaths );
			foreach ( [ 'GET', 'HEAD' ] as $method ) {
				$response = $this->dispatch( $fixture, $fixture['query'], $method, [ 'If-None-Match' => '*' ], false );
				try {
					$this->assertSame( 404, $response->getStatusCode(),
						'Native private-wiki denial precedes preconditions' );
					$this->assertPrivate( $response );
					$this->assertStringNotContainsString( '%PDF-', (string)$response->getBody() );
					$this->assertCount( $copies, $this->copyPaths );
					$observations[$method] = [ 'headers' => $response->getHeaders(),
						'body' => (string)$response->getBody() ];
				} finally {
					$response->getBody()->close();
				}
			}
			$fixture['actor'] = $originalActor;
			$response = $this->dispatch( $fixture, $fixture['query'], 'GET', [], true );
			$this->assertSame( 200, $response->getStatusCode() );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->deliveredBytes( $response ) );
			$this->assertSame( [ 0, 0, 0, $originalActor->getUser()->getId() ],
				array_column( $this->limitCalls, 'userId' ) );
			$this->assertSame( [ 'render', 'render', 'render', 'render' ],
				array_column( $this->limitCalls, 'action' ) );
		} finally {
			if ( isset( $response ) ) {
				$response->getBody()->close();
			}
			$this->overrideConfigValue( 'GroupPermissions', $config['GroupPermissions'] );
			$fixture['actor'] = $originalActor;
			$this->assertSame( $config, $this->configWitness() );
			$response = $this->dispatch( $fixture, $fixture['query'], 'GET', [], false );
			$this->assertSame( 200, $response->getStatusCode() );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->deliveredBytes( $response ) );
			$this->assertReleased();
			$this->assertSame( $tables, $this->rows() );
			$this->evidence( 'native-anonymous-restoration', [ 'configBefore' => $config,
				'configAfter' => $this->configWitness(),
				'tablesBefore' => $tables, 'tablesAfter' => $this->rows(), 'observations' => $observations,
				'identicalAuthorizedResponseRepeatedInFinally' => true,
				'nativeUserFactoryReceipts' => $this->limitCalls,
				'rateScope' => 'Deterministic injected limiter, not a measured production rate budget' ] );
		}
	}

	public function testNativeSelectionAndRateRefusalsNeverCaptureBytes(): void {
		$fixture = $this->fixture( true );
		$foreign = $this->getExistingTestPage();
		$tables = $this->rows();
		$queries = [ [], $fixture['query'] + [ 'url' => 'https://not-a-source.example/file.pdf' ],
			array_replace( $fixture['query'], [ 'binding' => 'v1:' . $foreign->getId() . ':pdf-anchor' ] ),
			array_replace( $fixture['query'], [ 'revid' => (string)$foreign->getLatest() ] ),
			array_replace( $fixture['query'], [ 'binding' => 'v1:' . $fixture['page']->getId() . ':missing' ] ),
			array_replace( $fixture['query'], [ 'binding' => 'v1:' . $fixture['page']->getId() . ':non-pdf' ] ),
			array_replace( $fixture['query'], [ 'binding' => 'v1:0' . $fixture['page']->getId() . ':pdf-anchor' ] ),
			array_replace( $fixture['query'], [ 'owner' => $fixture['query']['owner'] . '#section' ] ),
			array_replace( $fixture['query'], [ 'revid' => '2147483648' ] ) ];
		foreach ( [ 'owner', 'revid', 'binding', 'maxage', 'smaxage' ] as $field ) {
			$queries[] = array_replace( $fixture['query'], [ $field => [ 'nested' ] ] );
		}
		foreach ( [ 'owner', 'revid', 'binding' ] as $field ) {
			$missing = $fixture['query'];
			unset( $missing[$field] );
			$queries[] = $missing;
		}
		foreach ( $queries as $query ) {
			$response = $this->dispatch( $fixture, $query );
			try {
				$this->assertSame( 404, $response->getStatusCode() );
				$this->assertPrivate( $response );
				$this->assertStringNotContainsString( '%PDF-', (string)$response->getBody() );
			} finally {
				$response->getBody()->close();
			}
		}
		$response = $this->dispatch( $fixture, $fixture['query'], 'GET', [], true, true );
		try {
			$this->assertSame( 429, $response->getStatusCode() );
			$this->assertPrivate( $response );
			$this->assertSame( 'render', $this->limitCalls[count( $this->limitCalls ) - 1]['action'] );
			$this->assertSame( $fixture['actor']->getUser()->getId(),
				$this->limitCalls[count( $this->limitCalls ) - 1]['userId'] );
			$this->assertSame( [], $this->copyPaths );
			$this->assertSame( $tables, $this->rows() );
			$this->evidence( 'native-selection-rate', [ 'queries' => $queries, 'zeroNativeCopies' => true,
				'nativeUserFactoryReceipts' => $this->limitCalls, 'tablesBefore' => $tables,
				'tablesAfter' => $this->rows() ] );
		} finally {
			$response->getBody()->close();
		}
	}

	public function testUnrelatedInaccessibleSourceKeepsNativeSelectedReadIsolated(): void {
		$fixture = $this->fixture( true );
		$actor = $fixture['actor'];
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $actor->getUser() );
		$authority->method( 'authorizeRead' )->willReturnCallback( static fn ( $permission, $title ) =>
			!$title->isSamePageAs( $fixture['other']->getTitle() ) && $actor->authorizeRead( $permission, $title ) );
		$fixture['actor'] = $authority;
		$backend = $this->repo->getBackend();
		$path = $fixture['other']->getPath();
		$original = $backend->getFileContents( [ 'src' => $path ] );
		$tables = $this->rows();
		try {
			$this->assertTrue( $backend->delete( [ 'src' => $path ] )->isOK() );
			$response = $this->dispatch( $fixture, $fixture['query'] );
			$this->assertSame( 200, $response->getStatusCode() );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->deliveredBytes( $response ) );
		} finally {
			if ( isset( $response ) ) {
				$response->getBody()->close();
			}
			$this->assertTrue( $backend->quickCreate( [ 'dst' => $path, 'content' => $original ] )->isOK() );
			$this->assertSame( $original, $backend->getFileContents( [ 'src' => $path ] ) );
			$response = $this->dispatch( $fixture, $fixture['query'] );
			$this->assertSame( 200, $response->getStatusCode() );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->deliveredBytes( $response ) );
			$this->assertReleased();
			$this->assertSame( $tables, $this->rows() );
			$this->evidence( 'unrelated-source-restoration', [ 'tablesBefore' => $tables,
				'tablesAfter' => $this->rows(),
				'physicalSha256Before' => hash( 'sha256', $original ),
				'physicalSha256After' => hash( 'sha256', $backend->getFileContents( [ 'src' => $path ] ) ),
				'identicalAuthorizedResponseRepeatedInFinally' => true ] );
		}
	}

	/** @return array */
	public static function provideNativeRequests(): array {
		return [ 'GET persistent' => [ 'GET', [], true, 200 ], 'GET nonpersistent' => [ 'GET', [], false, 200 ],
			'HEAD' => [ 'HEAD', [], true, 200 ],
			'range first' => [ 'GET', [ 'Range' => 'bytes=0-12', 'If-Range' => '"stale"' ], true, 200 ],
			'range multiple' => [ 'GET', [ 'Range' => 'bytes=0-1,4-5' ], false, 200 ],
			'range invalid' => [ 'GET', [ 'Range' => 'invalid', 'If-Range' => 'yesterday' ], true, 200 ],
			'range suffix' => [ 'GET', [ 'Range' => 'bytes=-12' ], false, 200 ],
			'range impossible' => [ 'GET', [ 'Range' => 'bytes=99999-' ], true, 200 ],
			'If-Match' => [ 'GET', [ 'If-Match' => '*' ], true, 400 ],
			'If-None-Match' => [ 'GET', [ 'If-None-Match' => '*' ], false, 400 ],
			'If-Modified-Since' => [ 'GET', [ 'If-Modified-Since' => 'Mon, 05 Oct 2026 12:00:00 GMT' ], true, 400 ],
			'If-Unmodified-Since' => [ 'HEAD',
				[ 'If-Unmodified-Since' => 'Mon, 05 Oct 2026 12:00:00 GMT' ], false, 400 ],
			'POST declared' => [ 'POST', [], true, 405 ] ];
	}

	/** @dataProvider provideNativeRequests */
	public function testNativeDispatchResponsePolicy(
		string $method, array $headers, bool $persistent, int $status
	): void {
		$fixture = $this->fixture();
		$rows = $this->rows();
		$response = $this->dispatch( $fixture, $fixture['query'] + [ 'maxage' => '99999', 'smaxage' => '99999' ],
			$method, $headers, $persistent );
		try {
			$this->assertSame( $status, $response->getStatusCode() );
			$this->assertPrivate( $response );
			$this->assertFalse( $response->hasHeader( 'Content-Range' ) );
			if ( $status === 405 ) {
				$this->assertSame( 'GET, HEAD', $response->getHeaderLine( 'Allow' ) );
			}
			$bytes = $status === 200 && $method === 'GET' ? $this->deliveredBytes( $response ) :
				(string)$response->getBody();
			if ( $status === 200 ) {
				$this->assertSame( '840', $response->getHeaderLine( 'Content-Length' ) );
				$this->assertSame( 'application/pdf', $response->getHeaderLine( 'Content-Type' ) );
				$this->assertSame( 'none', $response->getHeaderLine( 'Accept-Ranges' ) );
				$this->assertSame( $method === 'GET' ?
					file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) : '', $bytes );
			} else {
				$this->assertStringNotContainsString( '%PDF-', $bytes );
				$this->assertFalse( $response->hasHeader( 'Content-Length' ) );
			}
			$this->assertSame( $rows, $this->rows() );
			$this->evidence( 'dispatch-' . substr( hash( 'sha256', $this->getName() ), 0, 12 ), [
				'method' => $method, 'requestHeaders' => $headers, 'persistent' => $persistent, 'status' => $status,
				'headers' => $response->getHeaders(), 'bodyLength' => strlen( $bytes ), 'tablesBefore' => $rows,
				'tablesAfter' => $this->rows(),
				'evidenceKind' => 'Native Router response/local sink, not wire HTTP' ] );
		} finally {
			$response->getBody()->close();
		}
		$this->assertReleased();
	}

	public function testNativeEarlyFrameworkResponsesCurrentlyMissEndpointPrivacy(): void {
		$fixture = $this->fixture();
		$rows = $this->rows();
		foreach ( [ 'unmatched' => [ 'uri' => '/rest/unmatched' ], 'method' => [ 'methods' => [ 'POST' ] ],
			'session' => [ 'session-error' => true ],
			'request-body' => [ 'unparsed' => true ] ] as $name => $options ) {
			$response = $this->dispatch( $fixture, $fixture['query'], $name === 'request-body' ? 'POST' : 'GET',
				[], true, false, $options );
			try {
				$this->assertGreaterThanOrEqual( 400, $response->getStatusCode() );
				$this->assertSame( '', $response->getHeaderLine( 'Cache-Control' ),
					'Candidate characterization: early framework response bypasses endpoint privacy' );
				$this->assertFalse( $response->hasHeader( 'X-Content-Type-Options' ) );
				$this->assertStringNotContainsString( '%PDF-', (string)$response->getBody() );
				$this->evidence( 'framework-' . $name, [ 'status' => $response->getStatusCode(),
					'headers' => $response->getHeaders(), 'body' => (string)$response->getBody(),
					'limitation' => 'Native framework characterization, not successful privacy acceptance' ] );
			} finally {
				$response->getBody()->close();
			}
		}
		$this->assertSame( [], $this->copyPaths );
		$this->assertSame( $rows, $this->rows() );
	}

	/** @return array */
	public static function provideEarlyEmission(): array {
		return [
			'unmatched PDF descendant' => [ 'GET', [ 'uri' => '/rest/layers/v0/pdf/missing' ], 404 ],
			'router method refusal' => [ 'GET', [ 'methods' => [ 'POST' ] ], 405 ],
			'session refusal' => [ 'GET', [ 'session-error' => true ], 403 ],
			'missing request body' => [ 'POST', [ 'unparsed' => true ], 411 ],
			'CORS preflight' => [ 'OPTIONS', [ 'cors' => true ], 204 ]
		];
	}

	/** @dataProvider provideEarlyEmission */
	public function testEarlyFrameworkEmissionRetainsEndpointPrivacy(
		string $method, array $options, int $status
	): void {
		$fixture = $this->fixture();
		$rows = $this->rows();
		$config = $this->configWitness();
		$headers = $method === 'OPTIONS' ? [ 'Origin' => 'https://not-allowed.example',
			'Access-Control-Request-Method' => 'GET' ] : [];
		$uri = $options['uri'] ?? '/rest/layers/v0/pdf';
		$request = $this->nativeRequest( $fixture['query'], $method, $headers, $options );
		$router = $this->nativeRouter( $fixture, $fixture['query'], $method, $headers, true, false, $options );
		$environment = new MockEnvironment();
		$environment->setRequestInfo( $uri, [], $method );
		// This exercises the bootstrap policy explicitly. Registration and wire HTTP remain separate gates.
		PinnedPdfPrivacyHooks::protectRequest( $environment->getFauxRequest(), '/rest', '/w' );
		$entry = new EntryPoint( $request, $environment->makeFauxContext(), $environment,
			$this->getServiceContainer() );
		$entry->setRouter( $router );
		$entry->enableOutputCapture();
		try {
			$entry->run();
			$environment->assertStatusCode( $status );
			$emitted = $entry->getCapturedOutput();
			$environment->assertHeaderValue( 'private, no-store, no-cache, max-age=0, s-maxage=0, must-revalidate',
				'Cache-Control' );
			$environment->assertHeaderValue( 'no-cache', 'Pragma' );
			$environment->assertHeaderValue( 'Thu, 01 Jan 1970 00:00:00 GMT', 'Expires' );
			$environment->assertHeaderValue( 'nosniff', 'X-Content-Type-Options' );
			$this->assertStringNotContainsString( '%PDF-', $emitted );
			$this->assertSame( [], $this->copyPaths );
			$this->assertSame( $rows, $this->rows() );
		} finally {
			gc_collect_cycles();
			$this->assertSame( $rows, $this->rows() );
			$this->assertSame( $config, $this->configWitness() );
			$webResponse = $environment->getFauxRequest()->response();
			$observed = [];
			foreach ( [ 'Cache-Control', 'Pragma', 'Expires', 'X-Content-Type-Options', 'Allow',
				'Access-Control-Allow-Methods' ] as $header ) {
				$observed[$header] = $webResponse->getHeader( $header );
			}
			$this->evidence( 'early-emission-' . $status, [ 'status' => $status,
				'headers' => $observed, 'body' => $entry->getCapturedOutput(),
				'tablesBefore' => $rows, 'tablesAfter' => $this->rows(),
				'configBefore' => $config, 'configAfter' => $this->configWitness(),
				'kind' => 'Actual Router-to-EntryPoint journey with explicit unregistered bootstrap policy' ] );
		}
	}

	private function configWitness(): array {
		$values = [];
		$config = $this->getServiceContainer()->getMainConfig();
		foreach ( [ 'GroupPermissions', 'WhitelistRead', 'WhitelistReadRegexp', 'RateLimits',
			'LayersEnable', 'LayersPageDrawingNamespaces' ] as $name ) {
			$values[$name] = $config->get( $name );
		}
		return $values;
	}

	/** @return array */
	public static function provideFinalDenials(): array {
		return [ 'owner-GET' => [ 'owner', 'GET' ], 'file-GET' => [ 'file', 'GET' ],
			'revision-GET' => [ 'revision', 'GET' ], 'revision-HEAD' => [ 'revision', 'HEAD' ],
			'archive-GET' => [ 'archive', 'GET' ], 'missing-current-GET' => [ 'missing-current', 'GET' ],
			'missing-archive-GET' => [ 'missing-archive', 'GET' ] ];
	}

	/** @dataProvider provideFinalDenials */
	public function testFinalDenialsRestoreEverythingInFinally( string $kind, string $method ): void {
		$fixture = $this->fixture();
		if ( in_array( $kind, [ 'archive', 'missing-archive' ], true ) ) {
			$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$fixture['fileTitle'], '20261005120000' );
		}
		$file = $this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'];
		$backend = $this->repo->getBackend();
		$path = $file->getPath();
		$original = $backend->getFileContents( [ 'src' => $path ] );
		$tables = $this->rows();
		$config = $this->configWitness();
		$snapshot = $fixture['content']->getText();
		$denied = false;
		$originalAuthority = $fixture['actor'];
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $originalAuthority->getUser() );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static function ( $permission, $title ) use ( &$denied, $kind, $fixture, $originalAuthority ) {
				$blocked = $kind === 'file' ? NS_FILE : $fixture['page']->getTitle()->getNamespace();
				return !( $denied && $title->getNamespace() === $blocked ) &&
					$originalAuthority->authorizeRead( $permission, $title );
			} );
		$fixture['actor'] = $authority;
		$table = $kind === 'archive' ? 'oldimage' : 'revision';
		$column = $kind === 'archive' ? 'oi_deleted' : 'rev_deleted';
		$where = $kind === 'archive' ? [ 'oi_name' => $file->getName(), 'oi_archive_name' => $file->getArchiveName() ] :
			[ 'rev_id' => $fixture['revision'] ];
		$flag = $this->getDb()->newSelectQueryBuilder()->select( $column )->from( $table )
			->where( $where )->caller( __METHOD__ )->fetchField();
		$handler = $this->handler( $fixture, $fixture['query'], $method );
		$response = $handler->execute();
		$body = $response->getBody();
		$this->assertSame( 200, $response->getStatusCode() );
		$this->assertFileExists( $this->copyPaths[0] );
		$escaped = '';
		try {
			if ( $kind === 'owner' || $kind === 'file' ) {
				$denied = true;
			} elseif ( $kind === 'revision' || $kind === 'archive' ) {
				$this->getDb()->newUpdateQueryBuilder()->update( $table )->set( [ $column => $kind === 'archive' ?
					File::DELETED_FILE | File::DELETED_RESTRICTED :
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( $where )->caller( __METHOD__ )->execute();
			} else {
				$this->assertTrue( $backend->delete( [ 'src' => $path ] )->isOK() );
			}
			$handler->applyCacheControl( $response );
			$bytes = $response->getBody() instanceof PinnedPdfResponseBody ?
				$this->deliveredBytes( $response ) : (string)$response->getBody();
			if ( $response->getHeaderLine( 'Content-Type' ) === 'application/pdf' ) {
				$escaped = $bytes;
				$this->evidence( 'unexpected-final-' . $kind . '-' . $method, [ 'status' => $response->getStatusCode(),
					'headers' => $response->getHeaders(), 'admittedSnapshot' => json_decode( $snapshot, true ) ],
					[ 'unexpected-final-' . $kind . '-' . $method . '.pdf' => $escaped ] );
			}
			$this->assertSame( '', $escaped, 'Final denial must deliver zero PDF bytes; actual SHA-256 ' .
				hash( 'sha256', $escaped ) );
			$this->assertSame( 404, $response->getStatusCode() );
			$this->assertPrivate( $response );
			foreach ( [ 'Content-Length', 'Content-Disposition', 'Accept-Ranges' ] as $header ) {
				$this->assertFalse( $response->hasHeader( $header ) );
			}
			foreach ( [ '%PDF-', $path, $fixture['fileTitle'],
				$fixture['surface']['source']['sha1'], 'Stack trace' ] as $secret ) {
				$this->assertStringNotContainsString( $secret, $bytes );
			}
			$this->assertFalse( $body->isReadable() );
			$this->assertReleased();
			$this->evidence( 'final-refusal-' . $kind . '-' . $method, [ 'headers' => $response->getHeaders(),
				'body' => $bytes, 'zeroPdfBytes' => true, 'method' => $method ] );
		} finally {
			$body->close();
			$response->getBody()->close();
			$denied = false;
			$this->getDb()->newUpdateQueryBuilder()->update( $table )->set( [ $column => $flag ] )
				->where( $where )->caller( __METHOD__ )->execute();
			if ( str_starts_with( $kind, 'missing-' ) ) {
				$this->assertTrue( $backend->quickCreate( [ 'dst' => $path, 'content' => $original ] )->isOK() );
			}
			$this->assertSame( $flag, $this->getDb()->newSelectQueryBuilder()->select( $column )->from( $table )
				->where( $where )->caller( __METHOD__ )->fetchField() );
			$this->assertSame( $original, $backend->getFileContents( [ 'src' => $path ] ) );
			$this->assertSame( $config, $this->configWitness() );
			$restored = ( new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ) )->read(
				$fixture['page']->getTitle(), $fixture['revision'], $authority );
			$this->assertSame( $snapshot, $restored->getText() );
			$replay = $this->handler( $fixture, $fixture['query'], $method );
			$positive = $replay->execute();
			$replay->applyCacheControl( $positive );
			$this->assertSame( 200, $positive->getStatusCode() );
			$replayed = $method === 'GET' ? $this->deliveredBytes( $positive ) : (string)$positive->getBody();
			$this->assertSame( $method === 'GET' ? $original : '', $replayed );
			$positive->getBody()->close();
			$this->assertReleased();
			$this->assertSame( $tables, $this->rows() );
			$this->evidence( $kind . '-' . $method . '-restoration', [ 'tablesBefore' => $tables,
				'tablesAfter' => $this->rows(), 'configBefore' => $config, 'configAfter' => $this->configWitness(),
				'flagBefore' => $flag, 'flagAfter' => $flag, 'snapshotBefore' => json_decode( $snapshot, true ),
				'snapshotAfter' => json_decode( $restored->getText(), true ),
				'physicalSha256Before' => hash( 'sha256', $original ),
				'physicalSha256After' => hash( 'sha256', $backend->getFileContents( [ 'src' => $path ] ) ),
				'identicalAuthorizedResponseRepeatedInFinally' => true, 'escapedBytes' => strlen( $escaped ),
				'replaySha256' => hash( 'sha256', $replayed ), 'copiesReleased' => true ] );
		}
	}

	public function testPersistentSessionAndCookiePrivacyControl(): void {
		$fixture = $this->fixture();
		$tables = $this->rows();
		$config = $this->configWitness();
		$backend = $this->repo->getBackend();
		$path = $fixture['file']->getPath();
		$original = $backend->getFileContents( [ 'src' => $path ] );
		$snapshot = $fixture['content']->getText();
		$handler = $this->handler( $fixture, $fixture['query'] + [ 'maxage' => '98765', 'smaxage' => '98765' ] );
		$response = $handler->execute();
		$response->setHeader( 'Set-Cookie', 'layers-test=isolated; HttpOnly; SameSite=Lax' );
		try {
			$handler->applyCacheControl( $response );
			$this->evidence( 'privacy-headers', [ 'status' => $response->getStatusCode(),
				'headers' => $response->getHeaders(),
				'frameworkPersistentSession' => true, 'setCookie' => true, 'explicitAgesRequested' => 98765 ] );
			$this->assertSame( 'private, no-store, no-cache, max-age=0, s-maxage=0, must-revalidate',
				$response->getHeaderLine( 'Cache-Control' ),
				'Final privacy must survive native persistent-session cache handling' );
			$this->assertPrivate( $response );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->deliveredBytes( $response ) );
		} finally {
			$response->getBody()->close();
			$replay = $this->handler( $fixture, $fixture['query'] );
			$positive = $replay->execute();
			$replay->applyCacheControl( $positive );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->deliveredBytes( $positive ) );
			$this->assertSame( $tables, $this->rows() );
			$this->assertReleased();
			$this->assertSame( $config, $this->configWitness() );
			$this->assertSame( $original, $backend->getFileContents( [ 'src' => $path ] ) );
			$restored = ( new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ) )->read(
				$fixture['page']->getTitle(), $fixture['revision'], $fixture['actor'] );
			$this->assertSame( $snapshot, $restored->getText() );
			$this->evidence( 'privacy-restoration', [ 'tablesBefore' => $tables, 'tablesAfter' => $this->rows(),
				'configBefore' => $config, 'configAfter' => $this->configWitness(),
				'snapshotBefore' => json_decode( $snapshot, true ),
				'snapshotAfter' => json_decode( $restored->getText(), true ),
				'physicalSha256Before' => hash( 'sha256', $original ),
				'physicalSha256After' => hash( 'sha256', $backend->getFileContents( [ 'src' => $path ] ) ),
				'identicalAuthorizedResponseRepeatedInFinally' => true, 'noProductionMutation' => true ] );
		}
	}

	/** @return array */
	public static function provideBodyLifetimes(): array {
		return [ 'close' => [ 'close' ], 'detach' => [ 'detach' ], 'abandon' => [ 'abandon' ],
			'copy failure' => [ 'copy failure' ], 'duplicate' => [ 'duplicate' ], 'clone' => [ 'clone' ] ];
	}

	/** @dataProvider provideBodyLifetimes */
	public function testNativeBodyOwnershipLifetimes( string $kind ): void {
		$fixture = $this->fixture();
		$tables = $this->rows();
		$handler = $this->handler( $fixture, $fixture['query'] );
		$response = $handler->execute();
		$body = $response->getBody();
		$this->assertInstanceOf( PinnedPdfResponseBody::class, $body );
		$this->assertFileExists( $this->copyPaths[0] );
		$exception = null;
		try {
			if ( $kind === 'abandon' ) {
				unset( $response, $body );
				gc_collect_cycles();
				$this->assertReleased();
			} elseif ( $kind === 'detach' ) {
				$this->assertNull( $body->detach() );
				$this->assertFalse( $body->isReadable() );
				$this->assertReleased();
			} elseif ( $kind === 'copy failure' ) {
				$sink = fopen( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', 'rb' );
				try {
					$body->copyToStream( $sink );
				} catch ( \Throwable $caught ) {
					$exception = $caught;
				} finally {
					fclose( $sink );
				}
				$this->assertNotNull( $exception, 'Read-only target must fail actual native copy' );
				$this->assertFalse( $body->isReadable() );
				$this->assertReleased();
			} elseif ( $kind === 'clone' || $kind === 'duplicate' ) {
				try {
					if ( $kind === 'clone' ) {
						$clone = clone $body;
						$clone->close();
					} else {
						$capture = ( new \ReflectionProperty( PinnedPdfResponseBody::class, 'capture' ) )
							->getValue( $body );
						$capture->toResponseBody();
					}
				} catch ( \Throwable $caught ) {
					$exception = $caught;
				}
				$this->assertInstanceOf( $kind === 'clone' ? \Error::class : \LogicException::class, $exception );
				$this->assertTrue( $body->isReadable(), 'Original remains the only live body owner' );
			} else {
				$body->close();
				$this->assertReleased();
			}
		} finally {
			if ( isset( $body ) ) {
				$body->close();
				$body->close();
			}
		}
		$this->assertReleased();
		$this->assertSame( $tables, $this->rows() );
		$this->evidence( 'lifetime-' . str_replace( ' ', '-', $kind ), [ 'kind' => $kind, 'copiesReleased' => true,
			'exceptionClass' => $exception ? get_class( $exception ) : null,
			'tablesBefore' => $tables, 'tablesAfter' => $this->rows() ] );
	}

	/** @return array */
	public static function provideNativeEmission(): array {
		return [ 'GET persistent' => [ 'GET', true, false, false ],
			'GET nonpersistent cookie' => [ 'GET', false, true, false ],
			'HEAD success' => [ 'HEAD', true, false, false ], 'HEAD refusal' => [ 'HEAD', false, false, true ] ];
	}

	/** @dataProvider provideNativeEmission */
	public function testNativeRouterAndEntryPointEmitCompleteAuthorizedPdf(
		string $method, bool $persistent, bool $cookie, bool $unavailable
	): void {
		$fixture = $this->fixture();
		$query = $fixture['query'];
		if ( $unavailable ) {
			$query['binding'] = 'v1:' . $fixture['page']->getId() . ':missing';
		}
		$request = new RequestData( [ 'uri' => new Uri( '/rest/layers/v0/pdf' ),
			'queryParams' => $query, 'method' => $method ] );
		$handler = $this->handler( $fixture, $query, $method, [], false, null, false );
		$services = $this->getServiceContainer();
		$formatters = [ 'en' => $services->getMessageFormatterFactory()->getTextFormatter( 'en' ) ];
		$factory = new ResponseFactory( $formatters );
		if ( $cookie ) {
			$nativeFactory = $factory;
			$factory = $this->getMockBuilder( ResponseFactory::class )->setConstructorArgs( [ $formatters ] )
				->onlyMethods( [ 'create' ] )->getMock();
			$factory->method( 'create' )->willReturnCallback( static function ( ...$arguments ) use ( $nativeFactory ) {
				$response = $nativeFactory->create( ...$arguments );
				$response->setHeader( 'Set-Cookie', 'layers-test=isolated; HttpOnly; SameSite=Lax' );
				return $response;
			} );
		}
		$router = $this->newRouter( [ 'routeFiles' => [], 'extraRoutes' => [
			[ 'path' => '/layers/v0/pdf', 'method' => $method, 'factory' => static fn () => $handler ]
		], 'request' => $request, 'authority' => $fixture['actor'], 'responseFactory' => $factory,
			'basicAuth' => new MWBasicAuthorizer( $fixture['actor'] ), 'session' => $this->getSession( $persistent ),
			'hookContainer' => $services->getHookContainer() ] );
		$environment = new MockEnvironment();
		$environment->setRequestInfo( '/rest/layers/v0/pdf' );
		$entry = new EntryPoint( $request, $environment->makeFauxContext(), $environment, $services );
		$entry->setRouter( $router );
		$entry->enableOutputCapture();
		try {
			$entry->run();
			$environment->assertStatusCode( $unavailable ? 404 : 200 );
			$environment->assertHeaderValue( 'private, no-store, no-cache, max-age=0, s-maxage=0, must-revalidate',
				'Cache-Control' );
			$environment->assertHeaderValue( 'nosniff', 'X-Content-Type-Options' );
			if ( !$unavailable ) {
				$environment->assertHeaderValue( 'application/pdf', 'Content-Type' );
				$environment->assertHeaderValue( '840', 'Content-Length' );
			}
			if ( $cookie ) {
				$environment->assertHeaderValue( 'layers-test=isolated; HttpOnly; SameSite=Lax', 'Set-Cookie' );
			}
			$emitted = $entry->getCapturedOutput();
			$this->assertSame( $method === 'GET' ?
				file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) : '', $emitted );
			$this->assertCount( $unavailable ? 0 : 1, $this->copyPaths );
			$this->assertReleased();
			$name = 'emission-' . $method . '-' . (int)$persistent . '-' . (int)$cookie . '-' . (int)$unavailable;
			$this->evidence( $name, [
				'method' => $method, 'persistent' => $persistent, 'cookie' => $cookie, 'unavailable' => $unavailable,
				'bodyBytes' => strlen( $emitted ), 'sha256' => hash( 'sha256', $emitted ), 'nativeEmissionRun' => true,
				'limitation' => 'Actual EntryPoint::run with MockEnvironment output capture, not wire HTTP' ] );
		} finally {
			gc_collect_cycles();
		}
	}

	public function testNativeBodyKeepsOriginalAcrossReuploadAndSessionPrivacy(): void {
		$fixture = $this->fixture();
		$handler = $this->handler( $fixture, $fixture['query'] + [ 'maxage' => '99999', 'smaxage' => '99999' ] );
		$response = $handler->execute();
		try {
			$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$fixture['fileTitle'], '20261005120000' );
			$handler->applyCacheControl( $response );
			$this->assertPrivate( $response );
			$this->assertSame( 200, $response->getStatusCode() );
			$this->assertSame( 'application/pdf', $response->getHeaderLine( 'Content-Type' ) );
			$this->assertSame( '840', $response->getHeaderLine( 'Content-Length' ) );
			$this->assertSame( 'inline', $response->getHeaderLine( 'Content-Disposition' ) );
			$this->assertSame( 'none', $response->getHeaderLine( 'Accept-Ranges' ) );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->deliveredBytes( $response ) );
			$this->assertFalse( $response->getBody()->isReadable() );
		} finally {
			$response->getBody()->close();
		}
	}

	public function testWriteRefusalImmediatelyReleasesPrivateCapture(): void {
		$fixture = $this->fixture();
		$rows = $this->rows();
		$response = $this->handler( $fixture, $fixture['query'] )->execute();
		$body = $response->getBody();
		$this->assertCount( 1, $this->copyPaths );
		$this->assertFileExists( $this->copyPaths[0] );
		try {
			try {
				$body->write( 'must not mutate the capture' );
				$this->fail( 'Response body must refuse writes' );
			} catch ( \RuntimeException $exception ) {
				$this->assertSame( 'PDF response body is read-only', $exception->getMessage() );
			}
			$this->assertFalse( $body->isReadable(), 'Write refusal must close ownership immediately' );
			$this->assertFileDoesNotExist( $this->copyPaths[0] );
		} finally {
			$beforeClose = [ 'readable' => $body->isReadable(), 'copyExists' => is_file( $this->copyPaths[0] ) ];
			$body->close();
			$this->assertSame( $rows, $this->rows() );
			$this->evidence( 'immediate-write-release', [ 'beforeFinallyClose' => $beforeClose,
				'copyExistsAfterFinallyClose' => is_file( $this->copyPaths[0] ),
				'tablesBefore' => $rows, 'tablesAfter' => $this->rows() ] );
		}
		$this->assertFileDoesNotExist( $this->copyPaths[0] );
	}

	/** @return array */
	public static function provideWriteBoundaries(): array {
		return [ 'empty' => [ 'empty' ], 'partially read' => [ 'partial' ],
			'repeated' => [ 'repeated' ], 'already closed' => [ 'closed' ], 'archived' => [ 'archived' ] ];
	}

	/** @dataProvider provideWriteBoundaries */
	public function testWriteBoundariesReleaseNativeOwnership( string $kind ): void {
		$fixture = $this->fixture();
		if ( $kind === 'archived' ) {
			$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$fixture['fileTitle'], '20261005120000' );
		}
		$file = $this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'];
		$backend = $this->repo->getBackend();
		$original = $backend->getFileContents( [ 'src' => $file->getPath() ] );
		$rows = $this->rows();
		$config = $this->configWitness();
		$snapshot = $fixture['content']->getText();
		$response = $this->handler( $fixture, $fixture['query'] )->execute();
		$body = $response->getBody();
		$this->assertInstanceOf( PinnedPdfResponseBody::class, $body );
		$this->assertFileExists( $this->copyPaths[0] );
		$this->assertSame( 840, $body->getSize() );
		$observations = [];
		try {
			if ( $kind === 'partial' ) {
				$this->assertSame( substr( $original, 0, 13 ), $body->read( 13 ) );
			} elseif ( $kind === 'closed' ) {
				$body->close();
			}
			$values = $kind === 'repeated' ? [ 'first', 'second' ] : [ $kind === 'empty' ? '' : 'refused' ];
			foreach ( $values as $value ) {
				try {
					$body->write( $value );
					$this->fail( 'Every native write boundary must refuse mutation' );
				} catch ( \RuntimeException $exception ) {
					$this->assertSame( 'PDF response body is read-only', $exception->getMessage() );
				}
				$observations[] = [ 'readable' => $body->isReadable(), 'copyExists' => is_file( $this->copyPaths[0] ) ];
				$this->assertFalse( $body->isReadable(), 'Write refusal must close native ownership before returning' );
				$this->assertFileDoesNotExist( $this->copyPaths[0] );
			}
		} finally {
			$body->close();
			$body->close();
			$this->assertReleased();
			$this->assertSame( $config, $this->configWitness() );
			$this->assertSame( $original, $backend->getFileContents( [ 'src' => $file->getPath() ] ) );
			$restored = ( new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ) )->read(
				$fixture['page']->getTitle(), $fixture['revision'], $fixture['actor'] );
			$this->assertSame( $snapshot, $restored->getText() );
			$positive = $this->dispatch( $fixture, $fixture['query'] );
			$this->assertSame( 200, $positive->getStatusCode() );
			$this->assertSame( $original, $this->deliveredBytes( $positive ) );
			$this->assertReleased();
			$this->assertSame( $rows, $this->rows() );
			$this->evidence( 'write-boundary-' . $kind, [ 'observations' => $observations,
				'tablesBefore' => $rows, 'tablesAfter' => $this->rows(), 'configBefore' => $config,
				'configAfter' => $this->configWitness(), 'snapshotBefore' => json_decode( $snapshot, true ),
				'snapshotAfter' => json_decode( $restored->getText(), true ),
				'physicalSha256Before' => hash( 'sha256', $original ),
				'physicalSha256After' => hash( 'sha256', $backend->getFileContents( [ 'src' => $file->getPath() ] ) ),
				'identicalAuthorizedResponseRepeatedInFinally' => true, 'noFixtureMutationDuringJourney' => true ] );
		}
	}

	/** @return array */
	public static function provideRangeHeaders(): array {
		return [ 'first' => [ 'bytes=0-12' ], 'suffix' => [ 'bytes=-12' ], 'unsatisfiable' => [ 'bytes=99999-' ],
			'multiple' => [ 'bytes=0-1,4-5' ], 'invalid' => [ 'invalid' ] ];
	}

	/** @dataProvider provideRangeHeaders */
	public function testRangeHeadersDeliverCompleteAuthorizedBody( string $range ): void {
		$fixture = $this->fixture();
		$handler = $this->handler( $fixture, $fixture['query'], 'GET', [ 'Range' => $range,
			'If-Range' => '"different"' ] );
		$this->assertNull( $handler->checkPreconditions() );
		$response = $handler->execute();
		$handler->applyCacheControl( $response );
		$this->assertSame( 200, $response->getStatusCode() );
		$this->assertPrivate( $response );
		$this->assertFalse( $response->hasHeader( 'Content-Range' ) );
		$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
			$this->deliveredBytes( $response ) );
	}

	public function testHeadAuthorizesFullCaptureAndClosesWithoutDeliveringBytes(): void {
		$fixture = $this->fixture();
		$handler = $this->handler( $fixture, $fixture['query'], 'HEAD' );
		$response = $handler->execute();
		$body = $response->getBody();
		try {
			$handler->applyCacheControl( $response );
			$this->assertSame( 200, $response->getStatusCode() );
			$this->assertSame( '840', $response->getHeaderLine( 'Content-Length' ) );
			$this->assertSame( '', (string)$response->getBody() );
			$this->assertFalse( $body->isReadable() );
			$this->assertPrivate( $response );
		} finally {
			$body->close();
		}
	}

	public function testConditionalRequestsRefuseAfterAuthorizationWithoutPdfBytes(): void {
		$fixture = $this->fixture();
		foreach ( [ 'If-Match', 'If-None-Match', 'If-Modified-Since', 'If-Unmodified-Since' ] as $header ) {
			$handler = $this->handler( $fixture, $fixture['query'], 'GET', [ $header => '*' ] );
			$this->assertNull( $handler->checkPreconditions() );
			$response = $handler->execute();
			$handler->applyCacheControl( $response );
			$this->assertSame( 400, $response->getStatusCode() );
			$this->assertPrivate( $response );
			$this->assertStringNotContainsString( '%PDF-', (string)$response->getBody() );
			$this->assertFalse( $response->hasHeader( 'Content-Length' ) );
		}
	}

	public function testMalformedFieldsAndExtraSourceSelectorsRefusePrivately(): void {
		$fixture = $this->fixture();
		$queries = [ [], $fixture['query'] + [ 'file' => $fixture['fileTitle'] ],
			$fixture['query'] + [ 'sha1' => 'chosen' ], $fixture['query'] + [ 'timestamp' => '20261005120000' ],
			$fixture['query'] + [ 'path' => '/etc/passwd' ] ];
		foreach ( [ '0', '-1', '01', '2147483648', '1.0', '1e2', str_repeat( '9', 20 ) ] as $revision ) {
			$queries[] = array_replace( $fixture['query'], [ 'revid' => $revision ] );
		}
		foreach ( [ 'owner', 'revid', 'binding', 'maxage' ] as $field ) {
			$queries[] = array_replace( $fixture['query'], [ $field => [ 'nested' ] ] );
		}
		foreach ( $queries as $query ) {
			$handler = $this->handler( $fixture, $query );
			$response = $handler->execute();
			$handler->applyCacheControl( $response );
			$this->assertSame( 404, $response->getStatusCode() );
			$this->assertPrivate( $response );
			$this->assertStringNotContainsString( '%PDF-', (string)$response->getBody() );
			$this->assertFalse( $response->hasHeader( 'Content-Length' ) );
		}
	}

	public function testRateLimitAndMethodRefuseBeforeCapture(): void {
		$fixture = $this->fixture();
		$source = $this->createMock( PinnedPdfSource::class );
		$source->expects( $this->never() )->method( 'capture' );
		foreach ( [ [ 'GET', true, 429 ], [ 'POST', false, 405 ] ] as [ $method, $limited, $status ] ) {
			$handler = $this->handler( $fixture, $fixture['query'], $method, [], $limited, $source );
			$response = $handler->execute();
			$handler->applyCacheControl( $response );
			$this->assertSame( $status, $response->getStatusCode() );
			$this->assertPrivate( $response );
		}
	}

	public function testSuppressionAtFinalAdmissionReplacesSuccessWithPrivateUnavailable(): void {
		$fixture = $this->fixture();
		$handler = $this->handler( $fixture, $fixture['query'] );
		$response = $handler->execute();
		$body = $response->getBody();
		$rows = $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->where( [ 'rev_id' => $fixture['revision'] ] )->caller( __METHOD__ )->fetchRow();
		try {
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
				->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
				->where( [ 'rev_id' => $fixture['revision'] ] )->caller( __METHOD__ )->execute();
			$handler->applyCacheControl( $response );
			$this->assertSame( 404, $response->getStatusCode() );
			$this->assertPrivate( $response );
			$this->assertStringNotContainsString( '%PDF-', (string)$response->getBody() );
			$this->assertFalse( $response->hasHeader( 'Content-Length' ) );
			$this->assertFalse( $response->hasHeader( 'Content-Disposition' ) );
			$this->assertFalse( $body->isReadable() );
		} finally {
			$body->close();
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
				->set( [ 'rev_deleted' => $rows->rev_deleted ] )
				->where( [ 'rev_id' => $fixture['revision'] ] )->caller( __METHOD__ )->execute();
		}
		$this->assertEquals( $rows, $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->where( [ 'rev_id' => $fixture['revision'] ] )->caller( __METHOD__ )->fetchRow() );
		$replay = $this->handler( $fixture, $fixture['query'] );
		$restored = $replay->execute();
		$replay->applyCacheControl( $restored );
		$this->assertSame( 200, $restored->getStatusCode() );
		$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
			$this->deliveredBytes( $restored ) );
	}
}
