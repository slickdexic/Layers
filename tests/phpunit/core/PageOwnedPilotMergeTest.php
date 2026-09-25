<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Exception\ErrorPageError;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWikiIntegrationTestCase;

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
			$source->getTitle()->getPrefixedDBkey() . ( $scope === 'ordinary' ? '_other' : '' );
		// Write-disable must not disable merge protection for retained pilot owners.
		$pilot = new PageOwnedPilot( $s, false, [ $key ] );
		$factory = $pilot->wrapMergeFactory( $s->getMergeHistoryFactory() );
		if ( $scope === 'ordinary' ) {
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
		$this->assertSame( $scope === 'ordinary' ? $destinationId : $sourceId, (int)$ownerId );
	}

	/** @return array */
	public static function provideScopes(): array {
		return [ [ 'source' ], [ 'destination' ], [ 'ordinary' ] ];
	}
}
