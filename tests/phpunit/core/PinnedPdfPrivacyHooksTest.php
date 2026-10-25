<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use GuzzleHttp\Psr7\Uri;
use MediaWiki\Extension\Layers\Hooks\PinnedPdfPrivacyHooks;
use MediaWiki\Extension\Layers\Rest\PinnedPdfResponseHeaders;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Rest\Handler;
use MediaWiki\Rest\RequestData;
use MediaWiki\Tests\Rest\RestTestTrait;

require_once getenv( 'MW_INSTALL_PATH' ) . '/tests/phpunit/unit/includes/Rest/RestTestTrait.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\PinnedPdfPrivacyHooks
 * @covers \MediaWiki\Extension\Layers\Rest\PinnedPdfResponseHeaders
 * @group Database
 */
class PinnedPdfPrivacyHooksTest extends \MediaWikiIntegrationTestCase {
	use RestTestTrait;

	private function tableWitness(): array {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = $values;
			}
			usort( $rows, static fn ( $left, $right ) => strcmp( serialize( $left ), serialize( $right ) ) );
			$tables[$table] = $rows;
		}
		return $tables;
	}

	/** @return array */
	public static function provideNativeScopeBoundaries(): array {
		return [
			'custom literal' => [ '/api/rest/layers/v0/pdf', '/api/rest', '/w', true, true ],
			'root deployment' => [ '/rest.php/layers/v0/pdf', '/rest.php', '', true, true ],
			'script fallback' => [ '/w/rest.php/layers/v0/pdf', '/api/rest', '/w', true, true ],
			'encoded literal' => [ '/rest/layers/v0/%70df', '/rest', '/w', false, false ],
			'encoded separator' => [ '/rest/layers/v0/pdf%2Fmissing', '/rest', '/w', false, false ],
			'encoded descendant' => [ '/rest/layers/v0/pdf/%2Fmissing', '/rest', '/w', false, true ],
			'sibling' => [ '/rest/layers/v0/pdf-other', '/rest', '/w', false, false ],
			'query decoy' => [ '/rest/unmatched?next=/rest/layers/v0/pdf', '/rest', '/w', false, false ]
		];
	}

	/** @dataProvider provideNativeScopeBoundaries */
	public function testNativeRouterScopeMatchesLiteralPrivacyBoundary(
		string $url, string $restPath, string $scriptPath, bool $matched, bool $protected
	): void {
		$tables = $this->tableWitness();
		$config = $this->getServiceContainer()->getMainConfig();
		$before = [ 'RestPath' => $config->get( 'RestPath' ), 'ScriptPath' => $config->get( 'ScriptPath' ) ];
		$request = new RequestData( [ 'uri' => new Uri( $url ) ] );
		$handler = new class extends Handler {
			public function execute() {
				$response = $this->getResponseFactory()->create();
				$response->setHeader( 'X-Test-Matched', 'literal-pdf-route' );
				return $response;
			}
		};
		$router = $this->newRouter( [ 'routeFiles' => [], 'request' => $request,
			'config' => [ 'RestPath' => $restPath, 'ScriptPath' => $scriptPath ], 'extraRoutes' => [
				[ 'path' => '/layers/v0/pdf', 'method' => 'GET', 'factory' => static fn () => $handler ] ] ] );
		$webRequest = new FauxRequest();
		$webRequest->setRequestURL( $url );
		$webResponse = $webRequest->response();
		$webResponse->header( 'Cache-Control: public, max-age=73' );
		$webResponse->header( 'X-Unrelated: untouched' );
		$response = null;
		try {
			$response = $router->execute( $request );
			$this->assertSame( $matched, $response->getHeaderLine( 'X-Test-Matched' ) === 'literal-pdf-route' );
			$this->assertSame( $matched ? 200 : 404, $response->getStatusCode() );
			PinnedPdfPrivacyHooks::protectRequest( $webRequest, $restPath, $scriptPath );
			$this->assertSame( 'untouched', $webResponse->getHeader( 'X-Unrelated' ) );
			$this->assertSame( $protected ? PinnedPdfResponseHeaders::HEADERS['Cache-Control'] :
				'public, max-age=73', $webResponse->getHeader( 'Cache-Control' ) );
			$this->assertSame( $protected ? 'nosniff' : null, $webResponse->getHeader( 'X-Content-Type-Options' ) );
		} finally {
			if ( $response ) {
				$response->getBody()->close();
			}
			$this->assertSame( $tables, $this->tableWitness() );
			$after = [ 'RestPath' => $config->get( 'RestPath' ), 'ScriptPath' => $config->get( 'ScriptPath' ) ];
			$this->assertSame( $before, $after );
			$directory = getenv( 'LAYERS_PDF_RESPONSE_EVIDENCE_DIR' );
			if ( is_string( $directory ) && $directory !== '' ) {
				$name = 'scope-' . substr( hash( 'sha256', $this->getName() ), 0, 12 ) . '.json';
				$this->assertFileDoesNotExist( $directory . '/' . $name );
				$json = json_encode( [ 'url' => $url, 'matched' => $matched, 'protected' => $protected,
					'tablesBefore' => $tables, 'tablesAfter' => $this->tableWitness(),
					'configBefore' => $before, 'configAfter' => $after, 'noConfigurationMutation' => true,
					'webHeaders' => [ 'Cache-Control' => $webResponse->getHeader( 'Cache-Control' ),
						'X-Unrelated' => $webResponse->getHeader( 'X-Unrelated' ),
						'X-Content-Type-Options' => $webResponse->getHeader( 'X-Content-Type-Options' ) ],
					'kind' => 'Native Router with marker handler; explicit policy on FauxResponse, not wire HTTP'
				], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR ) . "\n";
				$this->assertSame( strlen( $json ), file_put_contents( $directory . '/' . $name, $json ) );
			}
		}
	}

	public function testSupportedHookDoesNotChangeNonRestEntryPoint(): void {
		$this->assertNotSame( 'rest', MW_ENTRY_POINT );
		$hook = new PinnedPdfPrivacyHooks();
		$this->assertInstanceOf( \MediaWiki\Hook\SetupAfterCacheHook::class, $hook );
		$request = \MediaWiki\Context\RequestContext::getMain()->getRequest();
		$response = $request->response();
		$before = [];
		foreach ( array_keys( PinnedPdfResponseHeaders::HEADERS ) as $header ) {
			$before[$header] = $response->getHeader( $header );
		}
		$hook->onSetupAfterCache();
		foreach ( $before as $header => $value ) {
			$this->assertSame( $value, $response->getHeader( $header ) );
		}
	}

	/** @return array */
	public static function provideRequestPaths(): array {
		return [
			'exact route' => [ '/rest/layers/v0/pdf', '/rest', '/w', true ],
			'query fields' => [ '/rest/layers/v0/pdf?owner=Example&revid=1', '/rest', '/w', true ],
			'descendant error' => [ '/rest/layers/v0/pdf/missing', '/rest', '/w', true ],
			'custom prefix' => [ '/api/rest/layers/v0/pdf', '/api/rest', '/w', true ],
			'custom trailing slash' => [ '/api/rest/layers/v0/pdf', '/api/rest/', '/w', true ],
			'native script fallback' => [ '/w/rest.php/layers/v0/pdf', '/api/rest', '/w', true ],
			'root script fallback' => [ '/rest.php/layers/v0/pdf', '/rest', '', true ],
			'unrelated REST error' => [ '/rest/unmatched', '/rest', '/w', false ],
			'sibling route' => [ '/rest/layers/v0/pdf-other', '/rest', '/w', false ],
			'sibling prefix' => [ '/rest-other/layers/v0/pdf', '/rest', '/w', false ],
			'other Layers route' => [ '/rest/layers/v0/other', '/rest', '/w', false ],
			'query-only appearance' => [ '/rest/unmatched?next=/rest/layers/v0/pdf', '/rest', '/w', false ],
			'wiki page path' => [ '/wiki/rest/layers/v0/pdf', '/rest', '/w', false ],
			'case-sensitive route' => [ '/rest/layers/v0/PDF', '/rest', '/w', false ],
			'encoded nonmatching route' => [ '/rest/layers/v0/%70df', '/rest', '/w', false ]
		];
	}

	/** @dataProvider provideRequestPaths */
	public function testPrivacyIsConfinedToNativePdfEndpoint(
		string $url, string $restPath, string $scriptPath, bool $protected
	): void {
		$request = new FauxRequest();
		$request->setRequestURL( $url );
		$response = $request->response();
		$response->header( 'Cache-Control: public, max-age=60' );
		$response->header( 'X-Unrelated: preserved' );
		PinnedPdfPrivacyHooks::protectRequest( $request, $restPath, $scriptPath );
		$this->assertSame( 'preserved', $response->getHeader( 'X-Unrelated' ) );
		if ( $protected ) {
			foreach ( PinnedPdfResponseHeaders::HEADERS as $name => $value ) {
				$this->assertSame( $value, $response->getHeader( $name ) );
			}
		} else {
			$this->assertSame( 'public, max-age=60', $response->getHeader( 'Cache-Control' ) );
			$this->assertNull( $response->getHeader( 'X-Content-Type-Options' ) );
			$this->assertNull( $response->getHeader( 'Pragma' ) );
			$this->assertNull( $response->getHeader( 'Expires' ) );
		}
	}
}
