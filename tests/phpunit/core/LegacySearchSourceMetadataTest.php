<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
 * @group Database
 */
class LegacySearchSourceMetadataTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	public function testStoredHashesAndPdfPagesFollowTheExistingSelectedSets(): void {
		$file = $this->upload( 'SearchSource-' . wfRandomString( 8 ) . '.pdf', 'test-multipage.pdf' );
		$other = $this->upload( 'SearchOther-' . wfRandomString( 8 ) . '.pdf', 'test-multipage.pdf' );
		$oldHash = str_repeat( 'a', 31 );
		$this->saveSet( $file, 'ABC', 1, 'Superseded', 1 );
		$this->saveSet( $file, 'ABC', 2, 'First page', 1, $oldHash );
		$this->saveSet( $file, 'ABC', 1, 'Second page', 2 );
		$this->saveSet( $other, 'ABC', 1, 'Other file', 1 );
		$db = $this->getServiceContainer()->getService( 'LayersDatabase' );
		$named = $db->getSetForSearchWithSources( $file->getName(), 'ABC', false, true );
		$this->assertCount( 2, $named );
		$this->assertSame( [ $oldHash, $file->getSha1() ], array_column( $named, 'sha1' ) );
		$this->assertSame( [ 1, 2 ], array_column( $named, 'page' ) );
		$this->assertSame( $db->getSetForSearch( $file->getName(), 'ABC', false, true ),
			array_column( $named, 'data' ) );
		$this->assertSame( $named, $db->getFileSetsForSearchWithSources( $file->getName(), true ) );
		$this->assertSame( $db->getFileSetsForSearch( $file->getName(), true ), array_column( $named, 'data' ) );
		$this->assertSame( $named, $db->getSetForSearchWithSources( $file->getName(), '', false, true ) );
		$this->assertSame( [], $db->getSetForSearchWithSources( $file->getName(), 'Missing', false, true ) );
	}
}
