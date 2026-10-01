<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPublish
 * @group Database
 * @group API
 */
class ApiLayersPublishTest extends \MediaWiki\Tests\Api\ApiTestCase {
	private bool $posted = true;
	private array $ownerKeys = [];
	private ?PagePublicationService $publisher = null;
	private ?PublicationAdmissionContext $context = null;

	protected function setUp(): void {
		parent::setUp();
		$this->context = new PublicationAdmissionContext();
		$s = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace( $s->getMainConfig()->get( 'APIModules' ), [
			'layerspublish' => [ 'class' => ApiLayersPublish::class, 'factory' => function ( $main, $name ) {
				$s = $this->getServiceContainer();
				$registered = TestingAdmissionRegistration::install( $this, $this->context );
				$publisher = $this->publisher ?? $registered['publisher'];
				return new ApiLayersPublish( $main, $name, $publisher, $s->getTitleFactory(),
					PageOwnedScope::newFromServices( $s, $this->ownerKeys ) );
			} ]
		] ) );
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
		$this->ownerKeys = [ $page->getTitle()->getPrefixedDBkey() ];
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

	public function testExpectedPageIdentityPublishesAndRejectsWrongOwnerWithoutMutation(): void {
		$params = $this->request();
		$actor = $this->actor();
		$s = $this->getServiceContainer();
		$owner = $s->getTitleFactory()->newFromText( $params['owner'] );
		$params['pageid'] = $owner->getArticleID();
		$first = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $params['baserevid'], $first );
		$params['baserevid'] = $first;
		$this->assertSame( $first,
			$this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'] );
		$params['pageid'] = $this->getExistingTestPage( 'OtherPublicationIdentity' )->getId();
		$params['maintext'] = 'Must not replace page';
		try {
			$this->doApiRequestWithToken( $params, null, $actor );
			$this->fail( 'Expected foreign PageID rejection' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-invalid-publication-request' ) );
		}
		$this->assertSame( $first, $s->getRevisionLookup()->getRevisionByTitle( $owner )->getId() );
	}

	public function testExpectedPageIdentityCannotCreatePage(): void {
		$page = $this->getNonexistingTestPage();
		$this->ownerKeys = [ $page->getTitle()->getPrefixedDBkey() ];
		try {
			$this->doApiRequestWithToken( [ 'action' => 'layerspublish',
				'owner' => $page->getTitle()->getPrefixedText(), 'pageid' => 123, 'baserevid' => 0,
				'data' => '{"schemaVersion":1,"surfaces":[]}', 'maintext' => 'Must not create'
			], null, $this->actor() );
			$this->fail( 'Expected bound creation rejection' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-invalid-publication-request' ) );
		}
		$this->assertSame( 0, $page->getTitle()->getArticleID( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST ) );
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
			case 'empty-scope':
				$this->ownerKeys = [];
				break;
			case 'other-owner':
				$this->ownerKeys = [ $this->getNonexistingTestPage()->getTitle()->getPrefixedDBkey() ];
				break;
			case 'prefix-only':
				$this->ownerKeys = [ substr( $this->ownerKeys[0], 0, -1 ) ];
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
			case 'pageid-zero':
				$params['pageid'] = 0;
				break;
			case 'pageid-overflow':
				$params['pageid'] = 2147483648;
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
			[ 'get', 'mustbeposted' ],
			[ 'empty-scope', 'layers-publication-disabled' ],
			[ 'other-owner', 'layers-publication-disabled' ],
			[ 'prefix-only', 'layers-publication-disabled' ],
			[ 'token', 'missingparam' ], [ 'badtoken', 'badtoken' ],
			[ 'owner', 'missingparam' ], [ 'base', 'missingparam' ], [ 'negative', 'outofrange' ],
			[ 'pageid-zero', 'outofrange' ], [ 'pageid-overflow', 'outofrange' ],
			[ 'fragment', 'layers-invalid-publication-request' ],
			[ 'special', 'layers-invalid-publication-request' ],
			[ 'large', 'maxbytes' ], [ 'summary', 'maxchars' ],
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
		$this->ownerKeys = [ $page->getTitle()->getPrefixedDBkey() ];
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

	public function testRefusedLayerIsNamedInTheError(): void {
		$params = $this->request();
		$params['data'] = json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ [
			'id' => 'slide', 'kind' => 'slide', 'label' => 'Slide',
			'canvas' => [ 'width' => 100, 'height' => 100, 'backgroundColor' => '#ffffff',
				'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'layers' => [ [ 'id' => 'box', 'type' => 'rectangle', 'name' => 'Warning box', 'x' => 1, 'y' => 1,
				'width' => 10, 'height' => 10, 'strokeWidth' => 150 ] ]
		] ] ] );
		try {
			$this->doApiRequestWithToken( $params, null, $this->actor() );
			$this->fail( 'Expected the out-of-range stroke width to be refused' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-invalid-snapshot' ) );
			$message = $e->getStatusValue()->getMessages()[0];
			$this->assertSame( 'layers-invalid-snapshot-property', $message->getKey() );
			$this->assertSame( [ 'Warning box', 'strokeWidth' ], $message->getParams() );
		}
	}

	public function testPublishWithGoodLinksPreservesExactLinkValues(): void {
		$params = $this->request();
		$actor = $this->actor();
		$goodInternal = 'Operations/Intake#Procedure';
		$goodExternal = 'https://example.org/a?b=c#d';
		$params['data'] = json_encode( [
			'schemaVersion' => 1,
			'surfaces' => [ [
				'id' => 'slide1',
				'kind' => 'slide',
				'label' => 'Slide 1',
				'canvas' => [
					'width' => 800,
					'height' => 600,
					'backgroundColor' => '#ffffff',
					'backgroundVisible' => true,
					'backgroundOpacity' => 1
				],
				'layers' => [
					[
						'id' => 'link-internal',
						'type' => 'rectangle',
						'name' => 'Internal Link Box',
						'x' => 10,
						'y' => 10,
						'width' => 100,
						'height' => 50,
						'link' => $goodInternal
					],
					[
						'id' => 'link-external',
						'type' => 'rectangle',
						'name' => 'External Link Box',
						'x' => 120,
						'y' => 10,
						'width' => 100,
						'height' => 50,
						'link' => $goodExternal
					]
				]
			] ]
		] );

		$response = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish'];
		$this->assertSame( 'Success', $response['result'] );
		$this->assertGreaterThan( $params['baserevid'], $response['revid'] );

		// Read the slot back and compare the link value exactly
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $response['revid'] );
		$this->assertNotNull( $revision );
		$slotContent = $revision->getContent( PageRevisionWriter::SLOT );
		$this->assertInstanceOf( LayersDocumentContent::class, $slotContent );

		$doc = json_decode( $slotContent->getText(), true );
		$this->assertSame( $goodInternal, $doc['surfaces'][0]['layers'][0]['link'] );
		$this->assertSame( $goodExternal, $doc['surfaces'][0]['layers'][1]['link'] );
	}

	/**
	 * @dataProvider provideBadLinksForPublication
	 */
	public function testPublishWithBadLinkFailsWithInvalidOrLossyLayerData( string $badLink ): void {
		$params = $this->request();
		$actor = $this->actor();
		$params['data'] = json_encode( [
			'schemaVersion' => 1,
			'surfaces' => [ [
				'id' => 'slide1',
				'kind' => 'slide',
				'label' => 'Slide 1',
				'canvas' => [
					'width' => 800,
					'height' => 600,
					'backgroundColor' => '#ffffff',
					'backgroundVisible' => true,
					'backgroundOpacity' => 1
				],
				'layers' => [
					[
						'id' => 'bad-link-box',
						'type' => 'rectangle',
						'name' => 'Bad link box',
						'x' => 10,
						'y' => 10,
						'width' => 100,
						'height' => 50,
						'link' => $badLink
					]
				]
			] ]
		] );

		try {
			$this->doApiRequestWithToken( $params, null, $actor );
			$this->fail( 'Expected publication with bad link to fail' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-invalid-snapshot' ) );
			$message = $e->getStatusValue()->getMessages()[0];
			$this->assertSame( 'layers-invalid-snapshot-layer', $message->getKey() );
			$this->assertSame( [ 'Bad link box' ], $message->getParams() );
		}
	}

	public static function provideBadLinksForPublication(): array {
		return [
			'forbidden protocol javascript' => [ 'javascript:alert(1)' ],
			'control character' => [ "page\x00title" ],
			'empty link' => [ '' ],
		];
	}

	public function testDrawingsAreKeptInPageHistoryByDefault(): void {
		$manifest = json_decode( file_get_contents( __DIR__ . '/../../../extension.json' ), true );
		// null: the content namespaces and File:, with no pilot switch or owner list (D2).
		$this->assertNull( $manifest['config']['LayersPageDrawingNamespaces']['value'] );
		foreach ( [ 'LayersPageOwnedPilotEnabled', 'LayersPageOwnedPilotOwners',
			'LayersPageOwnedPilotNamespaces' ] as $old
		) {
			$this->assertArrayNotHasKey( $old, $manifest['config'] );
		}
		// Registered so stored revisions always load; it grants no write path by itself.
		$this->assertArrayHasKey( LayersDocumentContent::MODEL, $manifest['ContentHandlers'] ?? [] );
		$this->assertFalse( $this->getServiceContainer()->getContentHandlerFactory()
			->getContentHandler( LayersDocumentContent::MODEL )
			->canBeUsedOn( $this->getServiceContainer()->getTitleFactory()->newFromText( 'Any page' ) ) );
	}
}
