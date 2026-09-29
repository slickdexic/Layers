<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Exception\ErrorPageError;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWikiIntegrationTestCase;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilotMergeFactory
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class PageOwnedPilotMergeTest extends MediaWikiIntegrationTestCase {
	/**
	 * @dataProvider provideScopes
	 * @param string $scope
	 */
	public function testNativeMergeScope( string $scope ): void {
		$s = $this->getServiceContainer();
		$source = $this->getExistingTestPage();
		$destination = $this->getExistingTestPage();
		$revisionId = $source->getLatest();
		$sourceId = $source->getId();
		$destinationId = $destination->getId();
		// Ensure the source history predates the destination without sleeping.
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_timestamp' => $this->getDb()->timestamp( '20200101000000' ) ] )
			->where( [ 'rev_page' => $sourceId ] )->caller( __METHOD__ )->execute();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_timestamp' => $this->getDb()->timestamp( '20210101000000' ) ] )
			->where( [ 'rev_page' => $destinationId ] )->caller( __METHOD__ )->execute();
		$key = $scope === 'destination' ? $destination->getTitle()->getPrefixedDBkey() :
			$source->getTitle()->getPrefixedDBkey();
		// Only a side that owns drawings blocks the merge; an enrolled title alone does not.
		if ( $scope !== 'enrolled' ) {
			$owner = $scope === 'destination' ? $destination : $source;
			$actor = $this->getTestUser()->getUser();
			$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
			TestingAdmissionRegistration::install( $this )['publisher']->publish( $owner->getTitle(), $actor,
				$owner->getLatest(), '{"schemaVersion":1,"surfaces":[]}', 'Owns drawings' );
		}
		// Write-disable must not disable merge protection for retained pilot owners.
		$pilot = new PageOwnedPilot( $s, [ $key ] );
		$factory = $pilot->wrapMergeFactory( $s->getMergeHistoryFactory() );
		if ( $scope === 'enrolled' ) {
			$merge = $factory->newMergeHistory( $source, $destination );
			$status = $merge->merge( $this->getTestSysop()->getUser(), 'Ordinary merge' );
			$this->assertTrue( $status->isOK(), json_encode( $status->getErrors() ) );
		} else {
			try {
				$factory->newMergeHistory( $source, $destination );
				$this->fail( 'Expected pilot merge rejection' );
			} catch ( ErrorPageError $e ) {
				$this->assertSame( 'layers-admission-unauthorized', $e->getMessageObject()->getKey() );
			}
		}
		$ownerId = $this->getDb()->newSelectQueryBuilder()->select( 'rev_page' )->from( 'revision' )
			->where( [ 'rev_id' => $revisionId ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $scope === 'enrolled' ? $destinationId : $sourceId, (int)$ownerId );
	}

	/** @return array */
	public static function provideScopes(): array {
		return [ [ 'source' ], [ 'destination' ], [ 'enrolled' ] ];
	}
}
