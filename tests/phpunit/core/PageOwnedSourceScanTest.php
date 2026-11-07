<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Search\PageOwnedSourceScan;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Search\PageOwnedSourceScan
 * @group Database
 */
class PageOwnedSourceScanTest extends RealAssetTestCase {
	public function testScanFindsUnembeddedOwnersAcrossBoundedWindows(): void {
		$services = $this->getServiceContainer();
		$target = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:ScanTarget-' . wfRandomString( 8 ) . '.png' );
		$other = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:ScanOther-' . wfRandomString( 8 ) . '.png' );
		$actor = $this->actor();
		$owners = [];
		foreach ( [ $target, $other, $target ] as $index => $file ) {
			$title = $services->getTitleFactory()->newFromText( 'Scan fixture ' . wfRandomString( 12 ) );
			$surface = $this->makeImageSurface( 'image', 'Image', $file->getTitle()->getPrefixedDBkey(),
				$file->getTimestamp(), $file->getSha1() );
			$id = $this->publisher->publish( $title, $actor, 0, $this->buildDocument( [ $surface ] ),
				'Scan fixture', new WikitextContent( 'No file is embedded in this page.' ) );
			$owners[$index] = $services->getRevisionLookup()->getRevisionById( $id )->getPageId();
		}
		$scanner = new PageOwnedSourceScan( $services->getConnectionProvider(), $services->getSlotRoleStore(),
			$services->getPageStore(), $services->getRevisionLookup() );
		$cursor = 0;
		$found = [];
		$windows = 0;
		do {
			$result = $scanner->scan( $target->getTitle(), $cursor, 1 );
			$found = array_merge( $found, $result['pageIds'] );
			$windows++;
			if ( $result['next'] !== null ) {
				$this->assertGreaterThan( $cursor, $result['next'] );
				$cursor = $result['next'];
			}
		} while ( $result['next'] !== null );
		$this->assertGreaterThanOrEqual( 3, $windows );
		$this->assertContains( $owners[0], $found );
		$this->assertNotContains( $owners[1], $found );
		$this->assertContains( $owners[2], $found );
		$this->assertStatusGood( $target->deleteFile( 'Synthetic suppression fixture',
			$this->getTestSysop()->getUser(), true ) );
		$afterSuppression = $scanner->scan( $target->getTitle(), 0, 500 );
		$this->assertContains( $owners[0], $afterSuppression['pageIds'] );
		$this->assertNotContains( $owners[1], $afterSuppression['pageIds'] );
		$this->assertContains( $owners[2], $afterSuppression['pageIds'] );
		$unreadable = $this->createMock( RevisionRecord::class );
		$unreadable->method( 'hasSlot' )->willReturn( true );
		$unreadable->method( 'getContent' )->willReturn( new LayersDocumentContent( 'invalid json' ) );
		$lookup = $this->createMock( RevisionLookup::class );
		$lookup->method( 'getRevisionByPageId' )->willReturn( $unreadable );
		$conservativeScan = new PageOwnedSourceScan( $services->getConnectionProvider(),
			$services->getSlotRoleStore(), $services->getPageStore(), $lookup );
		$this->assertContains( $owners[0], $conservativeScan->scan( $target->getTitle(), $owners[0] - 1, 1 )['pageIds'],
			'An unreadable snapshot must not be silently excluded from reindex consideration.' );

		$surface = $this->makeImageSurface( 'image', 'Image', $target->getTitle()->getPrefixedDBkey(),
			$target->getTimestamp(), $target->getSha1() );
		$surface['source']['fileTitle'] = str_replace( '_', ' ', $surface['source']['fileTitle'] );
		// Ensure the fixture exercises a spelling that normalizes to the same title.
		$surface['source']['fileTitle'] = str_replace( 'File:', 'File: ', $surface['source']['fileTitle'] );
		$content = new LayersDocumentContent( $this->buildDocument( [ $surface ] ) );
		$this->assertTrue( $content->isReadable() );
		$noncanonical = $this->createMock( RevisionRecord::class );
		$noncanonical->method( 'hasSlot' )->willReturn( true );
		$noncanonical->method( 'getContent' )->willReturn( $content );
		$lookup = $this->createMock( RevisionLookup::class );
		$lookup->method( 'getRevisionByPageId' )->willReturn( $noncanonical );
		$scanner = new PageOwnedSourceScan( $services->getConnectionProvider(), $services->getSlotRoleStore(),
			$services->getPageStore(), $lookup );
		$this->assertContains( $owners[0], $scanner->scan( $target->getTitle(), $owners[0] - 1, 1 )['pageIds'],
			'Noncanonical source spelling must not hide a possible stale search entry.' );

		$surface['source']['fileTitle'] = 'File: ';
		$content = new LayersDocumentContent( $this->buildDocument( [ $surface ] ) );
		$this->assertTrue( $content->isReadable() );
		$unknown = $this->createMock( RevisionRecord::class );
		$unknown->method( 'hasSlot' )->willReturn( true );
		$unknown->method( 'getContent' )->willReturn( $content );
		$lookup = $this->createMock( RevisionLookup::class );
		$lookup->method( 'getRevisionByPageId' )->willReturn( $unknown );
		$scanner = new PageOwnedSourceScan( $services->getConnectionProvider(), $services->getSlotRoleStore(),
			$services->getPageStore(), $lookup );
		$this->assertContains( $owners[0], $scanner->scan( $target->getTitle(), $owners[0] - 1, 1 )['pageIds'],
			'Unresolvable source identities require conservative repair.' );
	}
}
