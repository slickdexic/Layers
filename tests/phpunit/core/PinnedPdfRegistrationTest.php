<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use GuzzleHttp\Psr7\Uri;
use MediaWiki\Config\ServiceOptions;
use MediaWiki\Extension\Layers\Rest\PinnedPdfResponseBody;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Rest\CorsUtils;
use MediaWiki\Rest\EntryPoint;
use MediaWiki\Rest\RequestData;
use MediaWiki\Rest\ResponseFactory;
use MediaWiki\Tests\MockEnvironment;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * Uses the installed extension registry and native ObjectFactory, never a handler factory override.
 * @covers \MediaWiki\Extension\Layers\Rest\PinnedPdfHandler
 * @covers \MediaWiki\Extension\Layers\Revision\PinnedPdfSource
 * @covers \MediaWiki\Extension\Layers\Rest\PinnedPdfResponseBody
 * @group Database
 */
class PinnedPdfRegistrationTest extends RealAssetTestCase {
	/** @return array */
	public static function provideRegisteredDelivery(): array {
		return [ 'GET current' => [ 'GET', false ], 'HEAD current' => [ 'HEAD', false ],
			'GET archived' => [ 'GET', true ], 'HEAD archived' => [ 'HEAD', true ] ];
	}

	/** @dataProvider provideRegisteredDelivery */
	public function testRegisteredRouteUsesNativeServicesAndExactPinnedBytes( string $method, bool $archive ): void {
		$services = $this->getServiceContainer();
		// Native registered composition, attached to the real isolated fixture repository.
		$group = $this->createMock( RepoGroup::class );
		$group->method( 'getLocalRepo' )->willReturn( $this->repo );
		$this->setService( 'RepoGroup', $group );
		// Keep this composition test independent of a live rate budget; wire HTTP covers that budget.
		$this->overrideConfigValue( 'RateLimits', [] );
		$actor = $this->actor();
		$title = 'File:RegisteredPdf-' . wfRandomString() . '.pdf';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $title );
		$page = $this->getExistingTestPage();
		$surface = $this->makePdfSurface( 'registered-pdf', 'Plan001', $title,
			$file->getTimestamp(), $file->getSha1() );
		$revision = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			$this->buildDocument( [ $surface ] ), 'Isolated registered PDF endpoint' );
		if ( $archive ) {
			$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$title, '20261006120000' );
		}
		$query = [ 'owner' => $page->getTitle()->getPrefixedText(), 'revid' => (string)$revision,
			'binding' => 'v1:' . $page->getId() . ':registered-pdf' ];
		$config = $services->getMainConfig();
		$path = ( $config->get( 'RestPath' ) ?: $config->get( 'ScriptPath' ) . '/rest.php' ) . '/layers/v0/pdf';
		$request = new RequestData( [ 'uri' => new Uri( $path ), 'method' => $method, 'queryParams' => $query ] );
		$environment = new MockEnvironment();
		$environment->setRequestInfo( $path, $query, $method );
		$context = $environment->makeFauxContext();
		$context->setAuthority( $actor );
		$factory = new ResponseFactory( [ 'en' => $services->getMessageFormatterFactory()->getTextFormatter( 'en' ) ] );
		$cors = new CorsUtils( new ServiceOptions( CorsUtils::CONSTRUCTOR_OPTIONS, $config ), $factory, $actor );
		$router = EntryPoint::createRouter( $services, $context, $request, $factory, $cors );
		$response = $router->execute( $request );
		try {
			$this->assertSame( 200, $response->getStatusCode(), (string)$response->getBody() );
			$this->assertSame( 'private, no-store, no-cache, max-age=0, s-maxage=0, must-revalidate',
				$response->getHeaderLine( 'Cache-Control' ) );
			$this->assertSame( 'application/pdf', $response->getHeaderLine( 'Content-Type' ) );
			$this->assertSame( '840', $response->getHeaderLine( 'Content-Length' ) );
			if ( $method === 'GET' ) {
				$this->assertInstanceOf( PinnedPdfResponseBody::class, $response->getBody() );
				$copy = $response->getBody()->getMetadata( 'uri' );
				$this->assertFileExists( $copy );
				$sink = fopen( 'php://temp', 'w+b' );
				try {
					$response->getBody()->copyToStream( $sink );
					rewind( $sink );
					$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
						stream_get_contents( $sink ) );
				} finally {
					fclose( $sink );
				}
				$this->assertFileDoesNotExist( $copy );
			} else {
				$this->assertSame( '', (string)$response->getBody() );
			}
		} finally {
			$response->getBody()->close();
		}
	}
}
