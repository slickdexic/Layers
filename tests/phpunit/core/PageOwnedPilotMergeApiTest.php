<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\ApiLayersMergeHistory;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\MainConfigNames;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Tests\Api\ApiTestCase;
use MediaWiki\User\User;
use RequestContext;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilotMergeFactory
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersMergeHistory
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedMergeDenied
 * @group Database
 * @group API
 */
class PageOwnedPilotMergeApiTest extends ApiTestCase {
	public function testUnrelatedFailureIsNotConvertedToPilotDenial(): void {
		$fixture = $this->setUpPages();
		$failure = new \RuntimeException( 'Unexpected merge failure' );
		$factory = $this->createMock( \MediaWiki\Page\MergeHistoryFactory::class );
		$factory->expects( $this->once() )->method( 'newMergeHistory' )->willThrowException( $failure );
		$this->setService( 'MergeHistoryFactory', $factory );
		try {
			$this->doApiRequestWithToken( [ 'action' => 'mergehistory',
				'from' => $fixture['source']->getTitle()->getPrefixedText(),
				'to' => $fixture['destination']->getTitle()->getPrefixedText()
			], null, $this->getMergeActor() );
			$this->fail( 'Expected original failure' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( $failure, $e );
		}
	}

	protected function setUp(): void {
		parent::setUp();
		$s = $this->getServiceContainer();
		$modules = $s->getMainConfig()->get( 'APIModules' );
		$modules['mergehistory'] = [ 'class' => ApiLayersMergeHistory::class,
			'factory' => function ( $main, $name ) {
				return new ApiLayersMergeHistory( $main, $name,
					$this->getServiceContainer()->getMergeHistoryFactory() );
			} ];
		$this->overrideConfigValue( 'APIModules', $modules );
	}

	private function setUpPages(): array {
		$source = $this->getExistingTestPage();
		$destination = $this->getExistingTestPage();
		$sourceId = $source->getId();
		$destinationId = $destination->getId();
		$revisionId = $source->getLatest();

		// Ensure the source history predates the destination without sleeping.
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_timestamp' => $this->getDb()->timestamp( '20200101000000' ) ] )
			->where( [ 'rev_page' => $sourceId ] )->caller( __METHOD__ )->execute();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_timestamp' => $this->getDb()->timestamp( '20210101000000' ) ] )
			->where( [ 'rev_page' => $destinationId ] )->caller( __METHOD__ )->execute();

		return [
			'source' => $source,
			'destination' => $destination,
			'sourceId' => $sourceId,
			'destinationId' => $destinationId,
			'revisionId' => $revisionId,
		];
	}

	private function captureDbState( int $sourceId, int $destinationId, int $sourceRevId ): array {
		$db = $this->getDb();
		$sourceRow = $db->newSelectQueryBuilder()
			->select( [ 'page_id', 'page_latest', 'page_is_redirect' ] )
			->from( 'page' )
			->where( [ 'page_id' => $sourceId ] )
			->caller( __METHOD__ )->fetchRow();
		$destRow = $db->newSelectQueryBuilder()
			->select( [ 'page_id', 'page_latest', 'page_is_redirect' ] )
			->from( 'page' )
			->where( [ 'page_id' => $destinationId ] )
			->caller( __METHOD__ )->fetchRow();
		$revOwner = (int)$db->newSelectQueryBuilder()
			->select( 'rev_page' )
			->from( 'revision' )
			->where( [ 'rev_id' => $sourceRevId ] )
			->caller( __METHOD__ )->fetchField();
		$mergeLogs = (int)$db->newSelectQueryBuilder()
			->select( 'COUNT(*)' )
			->from( 'logging' )
			->where( [ 'log_type' => 'merge' ] )
			->caller( __METHOD__ )->fetchField();

		return [
			'sourceRow' => $sourceRow ? (array)$sourceRow : null,
			'destRow' => $destRow ? (array)$destRow : null,
			'revOwner' => $revOwner,
			'mergeLogs' => $mergeLogs,
		];
	}

	/**
	 * Merges are refused only for pages that own drawings.
	 * @param \WikiPage $page
	 */
	private function ownDrawings( \WikiPage $page ): void {
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		TestingAdmissionRegistration::install( $this )['publisher']->publish( $page->getTitle(), $actor,
			$page->getLatest(), '{"schemaVersion":1,"surfaces":[]}', 'Owns drawings' );
	}

	private function getMergeActor(): User {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'mergehistory' ] );
		return $user;
	}

	public function testPilotSourceMergeRejected(): void {
		$fixture = $this->setUpPages();
		$source = $fixture['source'];
		$destination = $fixture['destination'];
		$s = $this->getServiceContainer();

		$key = $source->getTitle()->getPrefixedDBkey();
		$this->ownDrawings( $source );
		$pilot = new PageOwnedPilot( $s, [ $key ] );
		$this->setService( 'MergeHistoryFactory', $pilot->wrapMergeFactory( $s->getMergeHistoryFactory() ) );

		$before = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );

		$actor = $this->getMergeActor();
		$params = [
			'action' => 'mergehistory',
			'from' => $source->getTitle()->getPrefixedText(),
			'to' => $destination->getTitle()->getPrefixedText(),
			'reason' => 'Pilot source merge test',
		];

		// The adapter converts only the typed pilot denial into a controlled API error.
		try {
			$this->doApiRequestWithToken( $params, null, $actor );
			$this->fail( 'Expected pilot source merge rejection' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-admission-unauthorized' ) );
		}

		$after = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );
		$this->assertSame( $before, $after );
	}

	public function testPilotDestinationMergeRejected(): void {
		$fixture = $this->setUpPages();
		$source = $fixture['source'];
		$destination = $fixture['destination'];
		$s = $this->getServiceContainer();

		$key = $destination->getTitle()->getPrefixedDBkey();
		$this->ownDrawings( $destination );
		$pilot = new PageOwnedPilot( $s, [ $key ] );
		$this->setService( 'MergeHistoryFactory', $pilot->wrapMergeFactory( $s->getMergeHistoryFactory() ) );

		$before = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );

		$actor = $this->getMergeActor();
		$params = [
			'action' => 'mergehistory',
			'from' => $source->getTitle()->getPrefixedText(),
			'to' => $destination->getTitle()->getPrefixedText(),
			'reason' => 'Pilot destination merge test',
		];

		// The adapter converts only the typed pilot denial into a controlled API error.
		try {
			$this->doApiRequestWithToken( $params, null, $actor );
			$this->fail( 'Expected pilot destination merge rejection' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-admission-unauthorized' ) );
		}

		$after = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );
		$this->assertSame( $before, $after );
	}

	public function testOrdinaryMergeSucceeds(): void {
		$fixture = $this->setUpPages();
		$source = $fixture['source'];
		$destination = $fixture['destination'];
		$s = $this->getServiceContainer();

		// Scope is an unrelated pilot key; write-disabled composition must permit ordinary merges.
		$key = $source->getTitle()->getPrefixedDBkey() . '_unrelated';
		$pilot = new PageOwnedPilot( $s, [ $key ] );
		$this->setService( 'MergeHistoryFactory', $pilot->wrapMergeFactory( $s->getMergeHistoryFactory() ) );

		$before = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );

		$actor = $this->getMergeActor();
		$params = [
			'action' => 'mergehistory',
			'from' => $source->getTitle()->getPrefixedText(),
			'to' => $destination->getTitle()->getPrefixedText(),
			'reason' => 'Ordinary merge test',
		];

		$response = $this->doApiRequestWithToken( $params, null, $actor )[0];

		$this->assertArrayNotHasKey( 'error', $response );
		$this->assertArrayHasKey( 'mergehistory', $response );
		$this->assertSame( $source->getTitle()->getPrefixedText(), $response['mergehistory']['from'] );
		$this->assertSame( $destination->getTitle()->getPrefixedText(), $response['mergehistory']['to'] );

		$after = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );

		// Revision moved to destination.
		$this->assertSame( $fixture['destinationId'], $after['revOwner'] );
		// Core MergeHistory inserts two log entries (source 'merge' and destination 'merge-into').
		$this->assertSame( $before['mergeLogs'] + 2, $after['mergeLogs'] );
	}

	public function testBadTokenRejected(): void {
		$fixture = $this->setUpPages();
		$source = $fixture['source'];
		$destination = $fixture['destination'];
		$s = $this->getServiceContainer();

		$key = $source->getTitle()->getPrefixedDBkey();
		$this->ownDrawings( $source );
		$pilot = new PageOwnedPilot( $s, [ $key ] );
		$this->setService( 'MergeHistoryFactory', $pilot->wrapMergeFactory( $s->getMergeHistoryFactory() ) );

		$before = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );

		$actor = $this->getMergeActor();
		$params = [
			'action' => 'mergehistory',
			'from' => $source->getTitle()->getPrefixedText(),
			'to' => $destination->getTitle()->getPrefixedText(),
			'reason' => 'Bad token merge test',
			'token' => 'invalid_csrf_token',
		];

		$this->expectApiErrorCode( 'badtoken' );
		try {
			// Pass tokenType = null so doApiRequest will not overwrite our invalid token.
			$this->doApiRequest( $params, null, false, $actor, null );
		} finally {
			$after = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );
			$this->assertSame( $before, $after );
		}
	}

	public function testPermissionDeniedWithoutMergeHistoryRight(): void {
		$fixture = $this->setUpPages();
		$source = $fixture['source'];
		$destination = $fixture['destination'];
		$s = $this->getServiceContainer();

		// Use unrelated pilot key so pilot guard does not preempt the core permission check.
		$key = $source->getTitle()->getPrefixedDBkey() . '_unrelated';
		$pilot = new PageOwnedPilot( $s, [ $key ] );
		$this->setService( 'MergeHistoryFactory', $pilot->wrapMergeFactory( $s->getMergeHistoryFactory() ) );

		$before = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );

		// User without 'mergehistory' right.
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit' ] );

		$params = [
			'action' => 'mergehistory',
			'from' => $source->getTitle()->getPrefixedText(),
			'to' => $destination->getTitle()->getPrefixedText(),
			'reason' => 'Permission denied merge test',
		];

		$this->expectApiErrorCode( 'mergehistory-fail-permission' );
		try {
			$this->doApiRequestWithToken( $params, null, $actor );
		} finally {
			$after = $this->captureDbState( $fixture['sourceId'], $fixture['destinationId'], $fixture['revisionId'] );
			$this->assertSame( $before, $after );
		}
	}

	public function testErrorPresentationInvestigation(): void {
		$fixture = $this->setUpPages();
		$source = $fixture['source'];
		$destination = $fixture['destination'];
		$s = $this->getServiceContainer();

		$key = $source->getTitle()->getPrefixedDBkey();
		$this->ownDrawings( $source );
		$pilot = new PageOwnedPilot( $s, [ $key ] );
		$this->setService( 'MergeHistoryFactory', $pilot->wrapMergeFactory( $s->getMergeHistoryFactory() ) );

		$actor = $this->getMergeActor();
		$params = [
			'action' => 'mergehistory',
			'from' => $source->getTitle()->getPrefixedText(),
			'to' => $destination->getTitle()->getPrefixedText(),
			'reason' => 'Investigation merge test',
		];

		// Internal dispatch is not an HTTP response; verify the actual formatter separately.
		$caughtException = null;
		try {
			$this->doApiRequestWithToken( $params, null, $actor );
		} catch ( ApiUsageException $e ) {
			$caughtException = $e;
		}
		$this->assertInstanceOf( ApiUsageException::class, $caughtException );
		$this->assertTrue( self::apiExceptionHasCode( $caughtException, 'layers-admission-unauthorized' ) );
		$this->assertNull( $caughtException->getPrevious() );
		foreach ( [ false, true ] as $debug ) {
			$this->overrideConfigValue( MainConfigNames::ShowExceptionDetails, $debug );
			$context = new RequestContext();
			$context->setRequest( new FauxRequest( [ 'action' => 'mergehistory' ] ) );
			$main = new ApiMain( $context );
			$wrapper = TestingAccessWrapper::newFromObject( $main );
			$errorCodes = $wrapper->substituteResultWithError( $caughtException );
			$result = $main->getResult()->getResultData( null, [ 'Strip' => 'all' ] );
			$this->assertSame( [ 'layers-admission-unauthorized' ], $errorCodes );
			$this->assertSame( 'layers-admission-unauthorized', $result['error']['code'] );
			$this->assertArrayNotHasKey( 'trace', $result['error'] );
			$this->assertStringNotContainsString( '/var/www', json_encode( $result ) );
			$this->assertStringNotContainsString( 'internal_api_error', json_encode( $result ) );
		}
	}
}
