<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Search\LegacySearchRefreshJob;
use MediaWiki\Extension\Layers\Search\LegacySourceScan;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;

/**
 * @covers \MediaWiki\Extension\Layers\Search\LegacySourceScan
 * @group Database
 */
class LegacySourceScanTest extends \MediaWikiIntegrationTestCase {
	public function testRefreshJobContinuesAfterTheFirstHundredReferences(): void {
		$services = $this->getServiceContainer();
		$this->assertSame( 'unittest_', $this->getDb()->tablePrefix() );
		$file = $services->getTitleFactory()->newFromText( 'File:Refresh_' . wfRandomString( 8 ) . '.png' );
		$value = json_encode( [ [ ShownLayerSets::FILE, $file->getDBkey(), 'ABC' ] ],
			JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		$base = 20000000;
		$rows = [];
		for ( $i = 1; $i <= 101; $i++ ) {
			$rows[] = [ 'pp_page' => $base + $i, 'pp_propname' => ShownLayerSets::PROPERTY, 'pp_value' => $value ];
		}
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->rows( $rows )
			->caller( __METHOD__ )->execute();
		$queue = $services->getJobQueueGroup()->get( 'layersLegacySearchRefresh' );
		$this->assertTrue( ( new LegacySearchRefreshJob( $file, [ 'after' => $base ] ) )->run() );
		$next = $queue->pop();
		$this->assertInstanceOf( LegacySearchRefreshJob::class, $next );
		$this->assertSame( $base + 100, $next->getParams()['after'] );
		$this->assertTrue( $next->run() );
		$this->assertFalse( $queue->pop() );
	}

	public function testMoreThanFiveHundredMatchingRowsContinueWithoutStarvation(): void {
		$services = $this->getServiceContainer();
		$file = $services->getTitleFactory()->newFromText( 'File:Many_' . wfRandomString( 8 ) . '.png' );
		$value = json_encode( [ [ ShownLayerSets::FILE, $file->getDBkey(), 'ABC' ] ],
			JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		$base = 10000000;
		$rows = [];
		for ( $i = 1; $i <= 501; $i++ ) {
			$rows[] = [ 'pp_page' => $base + $i, 'pp_propname' => ShownLayerSets::PROPERTY, 'pp_value' => $value ];
		}
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->rows( $rows )
			->caller( __METHOD__ )->execute();
		$scanner = new LegacySourceScan( $services->getConnectionProvider() );
		$first = $scanner->scan( $file, $base, 500 );
		$this->assertSame( range( $base + 1, $base + 500 ), $first['pageIds'] );
		$this->assertSame( $base + 500, $first['next'] );
		$second = $scanner->scan( $file, $first['next'], 500 );
		$this->assertSame( [ $base + 501 ], $second['pageIds'] );
		$this->assertNull( $second['next'] );
	}

	public function testScansMatchingPropertiesInBoundedWindowsWithoutConfusingOtherSources(): void {
		$services = $this->getServiceContainer();
		$file = $services->getTitleFactory()->newFromText( 'File:Scan_' . wfRandomString( 8 ) . '.pdf' );
		$other = $services->getTitleFactory()->newFromText( 'File:Other_' . wfRandomString( 8 ) . '.pdf' );
		$pages = [];
		foreach ( [
			[ [ ShownLayerSets::FILE, $file->getDBkey(), 'ABC' ] ],
			[ [ ShownLayerSets::FILE, $other->getDBkey(), 'ABC' ] ],
			[ [ ShownLayerSets::FILE, $file->getDBkey(), 'ABC', 2 ] ],
			[ [ ShownLayerSets::SLIDE, $file->getDBkey(), 'ABC' ] ]
		] as $index => $entries ) {
			$page = $this->getExistingTestPage( 'LegacySourceScan' . $index );
			$pages[] = $page->getId();
			$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
				'pp_page' => $page->getId(), 'pp_propname' => ShownLayerSets::PROPERTY,
				'pp_value' => json_encode( $entries, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES )
			] )->caller( __METHOD__ )->execute();
		}
		$scanner = new LegacySourceScan( $services->getConnectionProvider() );
		$cursor = 0;
		$found = [];
		$windows = 0;
		do {
			$result = $scanner->scan( $file, $cursor, 1 );
			$found = array_merge( $found, $result['pageIds'] );
			$windows++;
			if ( $result['next'] !== null ) {
				$this->assertGreaterThan( $cursor, $result['next'] );
				$cursor = $result['next'];
			}
		} while ( $result['next'] !== null );
		$this->assertGreaterThanOrEqual( 2, $windows );
		$this->assertContains( $pages[0], $found );
		$this->assertNotContains( $pages[1], $found );
		$this->assertContains( $pages[2], $found );
		$this->assertNotContains( $pages[3], $found );
	}
}
