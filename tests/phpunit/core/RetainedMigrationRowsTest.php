<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\LayersConstants;

/**
 * Exact retained metadata establishes migration origin without interpreting labels or layer payloads.
 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase::listRetainedFileSetRows
 * @group Database
 */
class RetainedMigrationRowsTest extends \MediaWikiIntegrationTestCase {
	protected function setUp(): void {
		parent::setUp();
		if ( !$this->getDb()->tableExists( 'layer_sets', __METHOD__ ) ) {
			$this->markTestSkipped( 'layer_sets table not available' );
		}
	}

	/**
	 * Insert metadata in isolated test tables with deliberately non-JSON payload bytes.
	 * @param array $row Expected public metadata
	 */
	private function insertRow( array $row ): void {
		[ $major, $minor ] = explode( '/', $row['mime'], 2 );
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'layer_sets' )->row( [
			'ls_id' => $row['id'], 'ls_name' => $row['name'], 'ls_page' => $row['page'],
			'ls_img_sha1' => $row['sha1'], 'ls_img_name' => $row['imgName'],
			'ls_img_major_mime' => $major, 'ls_img_minor_mime' => $minor,
			'ls_revision' => $row['revision'], 'ls_json_blob' => 'Payload must never be decoded or returned',
			'ls_user_id' => 0, 'ls_timestamp' => '20261003120000', 'ls_size' => 44, 'ls_layer_count' => 1
		] )->caller( __METHOD__ )->execute();
	}

	public function testEveryRetainedRevisionAndSourceVersionIsReturnedInIdOrder(): void {
		$old = [ 'id' => 9101, 'name' => 'Notes 2 (page 7)', 'page' => 7, 'sha1' => str_repeat( 'a', 31 ),
			'imgName' => 'Retained_notes.pdf', 'mime' => 'application/pdf', 'revision' => 1 ];
		$new = array_replace( $old, [ 'id' => 9102, 'revision' => 2 ] );
		$oldVersion = array_replace( $old, [ 'id' => 9103, 'sha1' => str_repeat( 'b', 31 ) ] );
		$otherPage = array_replace( $old, [ 'id' => 9104, 'name' => 'Literal_Name (page 99)', 'page' => 99 ] );
		// Insert out of order so the result must use row ID, not fixture insertion or label order.
		foreach ( [ $new, $oldVersion, $old, $otherPage ] as $row ) {
			$this->insertRow( $row );
		}
		$this->insertRow( array_replace( $old, [ 'id' => 9105, 'imgName' => 'Other_file.pdf' ] ) );
		$legacy = $this->getServiceContainer()->getService( 'LayersDatabase' );
		$expected = [ $old, $new, $oldVersion, $otherPage ];
		$this->assertSame( $expected, $legacy->listRetainedFileSetRows( 'Retained_notes.pdf' ),
			'Include old saves and source versions; preserve literal names, pages and exact metadata types' );
		$this->assertSame( $expected, $legacy->listRetainedFileSetRows( ' Retained notes.pdf ' ),
			'Use the established canonical file lookup' );
		$this->assertSame( [], $legacy->listRetainedFileSetRows( 'Missing_file.pdf' ) );
	}

	public function testSlideRowsAreExcludedEvenWhenTheFileLookupMatches(): void {
		$file = [ 'id' => 9201, 'name' => 'Same literal name', 'page' => 1, 'sha1' => str_repeat( 'c', 31 ),
			'imgName' => 'Same_name.png', 'mime' => 'image/png', 'revision' => 3 ];
		$this->insertRow( $file );
		$this->insertRow( array_replace( $file, [ 'id' => 9202, 'sha1' => LayersConstants::TYPE_SLIDE,
			'mime' => 'application/x-layers-slide' ] ) );
		$this->insertRow( array_replace( $file, [ 'id' => 9203, 'imgName' => 'Slide:Standalone',
			'sha1' => LayersConstants::TYPE_SLIDE, 'mime' => 'application/x-layers-slide' ] ) );
		$legacy = $this->getServiceContainer()->getService( 'LayersDatabase' );
		$this->assertSame( [ $file ], $legacy->listRetainedFileSetRows( 'Same_name.png' ) );
		$this->assertSame( [], $legacy->listRetainedFileSetRows( 'Slide:Standalone' ) );
	}

	public function testFileLookupDoesNotWidenCaseOrWildcardCharacters(): void {
		$file = [ 'id' => 9301, 'name' => 'Notes', 'page' => 1, 'sha1' => str_repeat( 'd', 31 ),
			'imgName' => 'Bound_%file.pdf', 'mime' => 'application/pdf', 'revision' => 1 ];
		$this->insertRow( $file );
		$this->insertRow( array_replace( $file, [ 'id' => 9302, 'imgName' => 'Bound_xfile.pdf' ] ) );
		$this->insertRow( array_replace( $file, [ 'id' => 9303, 'imgName' => 'Bound_%File.pdf' ] ) );
		$legacy = $this->getServiceContainer()->getService( 'LayersDatabase' );
		$this->assertSame( [ $file ], $legacy->listRetainedFileSetRows( 'Bound_%file.pdf' ) );
	}
}
