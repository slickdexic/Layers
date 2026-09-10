<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Request\FauxRequest;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPublish
 * @group Database
 * @group API
 */
class ApiLayersPublishTest extends \MediaWiki\Tests\Api\ApiTestCase {
	private bool $enabled = true;
	private bool $posted = true;
	private ?PagePublicationService $publisher = null;

	protected function setUp(): void {
		parent::setUp();
		$s = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', $s->getMainConfig()->get( 'APIModules' ) + [
			'layerspublish' => [ 'class' => ApiLayersPublish::class, 'factory' => function ( $main, $name ) {
				$s = $this->getServiceContainer();
				$s->getContentHandlerFactory()->defineContentHandler(
					LayersDocumentContent::MODEL, LayersDocumentContentHandler::class );
				if ( !$s->getSlotRoleRegistry()->isDefinedRole( PageRevisionWriter::SLOT ) ) {
					$s->getSlotRoleRegistry()->defineRoleWithModel(
						PageRevisionWriter::SLOT, LayersDocumentContent::MODEL, [ 'display' => 'none' ], false );
				}

				$publisher = $this->publisher ?? new PagePublicationService( $s->getWikiPageFactory(),
					new PageHistoryAccess( $s->getRevisionLookup() ),
					new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ),
					new PageRevisionWriter() );
				return new ApiLayersPublish( $main, $name, $publisher, $s->getTitleFactory(), $this->enabled );
			} ]
		] );
	}

	/** @inheritDoc */
	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, $this->posted, $session );
	}

	private function actor() {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
		return $user;
	}

	private function request(): array {
		$page = $this->getExistingTestPage();
		return [ 'action' => 'layerspublish', 'owner' => $page->getTitle()->getPrefixedText(),
			'baserevid' => $page->getLatest(), 'data' => '{"schemaVersion":1,"surfaces":[]}' ];
	}

	public function testSuccessAndNoOp(): void {
		$params = $this->request();
		$actor = $this->actor();
		$response = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish'];
		$this->assertSame( 'Success', $response['result'] );
		$this->assertGreaterThan( $params['baserevid'], $response['revid'] );
		$this->assertSame( [ 'result', 'revid' ], array_keys( $response ) );
		$params['baserevid'] = $response['revid'];
		$this->assertSame( $response, $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish'] );
	}

	/**
	 * @dataProvider provideBoundaryFailures
	 * @param string $reason
	 * @param string $code
	 */
	public function testRejectedRequestDoesNotInvokePublisher( string $reason, string $code ): void {
		$params = $this->request();
		$actor = $this->actor();
		$this->publisher = $this->createMock( PagePublicationService::class );
		$this->publisher->expects( $this->never() )->method( 'publish' );
		$token = 'csrf';
		switch ( $reason ) {
			case 'disabled':
				$this->enabled = false;
				break;
			case 'get':
				$this->posted = false;
				break;
			case 'token':
				$token = null;
				break;
			case 'badtoken':
				$params['token'] = 'invalid';
				$token = null;
				break;
			case 'owner':
				unset( $params['owner'] );
				break;
			case 'base':
				unset( $params['baserevid'] );
				break;
			case 'negative':
				$params['baserevid'] = -1;
				break;
			case 'fragment':
				$params['owner'] .= '#Section';
				break;
			case 'special':
				$params['owner'] = 'Special:Version';
				break;
			case 'large':
				$params['data'] = str_repeat( ' ', 2097153 );
				break;
			case 'summary':
				$params['summary'] = str_repeat( 'x', 501 );
				break;
			case 'main':
				$params['maintext'] = str_repeat( 'x', 2097153 );
				break;
			case 'right':
				$this->overrideUserPermissions( $actor, [ 'read', 'edit' ] );
				break;
		}
		$this->expectApiErrorCode( $code );
		$this->doApiRequest( $params, null, false, $actor, $token );
	}

	/** @return array */
	public static function provideBoundaryFailures(): array {
		return [
			[ 'disabled', 'layers-publication-disabled' ], [ 'get', 'mustbeposted' ],
			[ 'token', 'missingparam' ], [ 'badtoken', 'badtoken' ],
			[ 'owner', 'missingparam' ], [ 'base', 'missingparam' ], [ 'negative', 'outofrange' ],
			[ 'fragment', 'layers-invalid-publication-request' ],
			[ 'special', 'layers-invalid-publication-request' ],
			[ 'large', 'maxbytes' ], [ 'summary', 'maxbytes' ],
			[ 'main', 'maxbytes' ], [ 'right', 'permissiondenied' ]
		];
	}

	public function testStaleRequestKeepsWinningRevision(): void {
		$params = $this->request();
		$actor = $this->actor();
		$winner = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		try {
			$this->doApiRequestWithToken( $params, null, $actor );
			$this->fail( 'Expected conflict' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-edit-conflict' ) );
		}
		$this->assertSame( $winner, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle(
				$this->getServiceContainer()->getTitleFactory()->newFromText( $params['owner'] ) )->getId() );
	}

	public function testUnexpectedExceptionDetailsAreNotReturned(): void {
		$this->publisher = $this->createMock( PagePublicationService::class );
		$this->publisher->method( 'publish' )->willThrowException( new \RuntimeException( 'secret diagnostic' ) );
		try {
			$this->doApiRequestWithToken( $this->request(), null, $this->actor() );
			$this->fail( 'Expected operational failure' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-publication-failed' ) );
			$this->assertStringNotContainsString( 'secret diagnostic', $e->getMessage() );
		}
	}

	public function testConfiguredSaveRateLimitIsEnforced(): void {
		$this->overrideConfigValue( 'RateLimits', [ 'editlayers-save' => [ 'user' => [ 1, 60 ] ] ] );
		$params = $this->request();
		$actor = $this->actor();
		$params['baserevid'] = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->expectApiErrorCode( 'ratelimited' );
		$this->doApiRequestWithToken( $params, null, $actor );
	}

	public function testCreateOwnerWithMainText(): void {
		$page = $this->getNonexistingTestPage();
		$response = $this->doApiRequestWithToken( [
			'action' => 'layerspublish', 'owner' => $page->getTitle()->getPrefixedText(),
			'baserevid' => 0, 'data' => '{"schemaVersion":1,"surfaces":[]}', 'maintext' => 'New visual page'
		], null, $this->actor() )[0]['layerspublish'];
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $response['revid'] );
		$this->assertSame( 'New visual page', $revision->getContent( 'main' )->getText() );
		$this->assertInstanceOf( LayersDocumentContent::class, $revision->getContent( PageRevisionWriter::SLOT ) );
	}

	public function testInvalidSnapshotDoesNotChangeRevision(): void {
		$params = $this->request();
		$params['data'] = '{}';
		try {
			$this->doApiRequestWithToken( $params, null, $this->actor() );
			$this->fail( 'Expected invalid snapshot to fail' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-invalid-snapshot' ) );
		}
		$this->assertSame( $params['baserevid'], $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle(
				$this->getServiceContainer()->getTitleFactory()->newFromText( $params['owner'] ) )->getId() );
	}

	public function testExperimentalApiIsNotRegisteredForNormalRequests(): void {
		$manifest = json_decode( file_get_contents( __DIR__ . '/../../../extension.json' ), true );
		$this->assertArrayNotHasKey( 'layerspublish', $manifest['APIModules'] );
		$this->assertArrayNotHasKey( LayersDocumentContent::MODEL, $manifest['ContentHandlers'] ?? [] );
	}
}
