<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission;
use MediaWiki\Permissions\Authority;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission
 * @group Database
 */
class LegacySearchSourceAdmissionTest extends RealAssetTestCase {
	public function testCurrentExactSourceAndPageMustRemainAvailable(): void {
		$pdf = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Legacy-source-' . wfRandomString( 8 ) . '.pdf' );
		$image = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Legacy-image-' . wfRandomString( 8 ) . '.png' );
		$admission = new LegacySearchSourceAdmission( $this->repo );
		$actor = $this->actor();
		$this->assertTrue( $admission->allows( $pdf->getTitle(), $pdf->getSha1(), 1, $actor ) );
		$this->assertTrue( $admission->allows( $pdf->getTitle(), $pdf->getSha1(), 2, $actor ) );
		$this->assertFalse( $admission->allows( $pdf->getTitle(), $pdf->getSha1(), 3, $actor ) );
		$this->assertFalse( $admission->allows( $pdf->getTitle(), str_repeat( 'a', 31 ), 1, $actor ) );
		$this->assertTrue( $admission->allows( $image->getTitle(), $image->getSha1(), 1, $actor ) );
		$this->assertFalse( $admission->allows( $image->getTitle(), $image->getSha1(), 2, $actor ) );
		$denied = $this->createMock( Authority::class );
		$denied->method( 'authorizeRead' )->willReturn( false );
		$this->assertFalse( $admission->allows( $pdf->getTitle(), $pdf->getSha1(), 1, $denied ) );
		$sha1 = $pdf->getSha1();
		$this->assertStatusGood( $pdf->deleteFile( 'Synthetic fixture', $this->getTestSysop()->getUser(), true ) );
		$this->assertFalse( $admission->allows( $pdf->getTitle(), $sha1, 1, $actor ) );
		$this->assertTrue( $admission->allows( $image->getTitle(), $image->getSha1(), 1, $actor ) );
		$this->assertStatusGood( $pdf->restore( [], true ) );
		$this->assertTrue( $admission->allows( $pdf->getTitle(), $sha1, 1, $actor ) );
		$this->assertTrue( $admission->allows( $pdf->getTitle(), $sha1, 2, $actor ) );
		$oldImageHash = $image->getSha1();
		$this->assertStatusGood( $image->upload( __DIR__ . '/../../fixtures/assets/test-image-replacement.png',
			'Synthetic replacement', '', 0, false, '20260907120000', $this->getTestSysop()->getUser() ) );
		$current = $this->repo->findFile( $image->getTitle(), [ 'latest' => true ] );
		$this->assertNotSame( $oldImageHash, $current->getSha1() );
		$this->assertTrue( $admission->allows( $image->getTitle(), $oldImageHash, 1, $actor ) );
		$this->assertTrue( $admission->allows( $image->getTitle(), $current->getSha1(), 1, $actor ) );
		$replacementHash = $current->getSha1();
		$oldRow = (array)$this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'oldimage' )
			->where( [ 'oi_name' => $image->getName(), 'oi_sha1' => $oldImageHash ] )
			->caller( __METHOD__ )->fetchRow();
		$oldRow['oi_archive_name'] = '20260908120000!' . $image->getName();
		$oldRow['oi_timestamp'] = '20260908120000';
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'oldimage' )->row( $oldRow )
			->caller( __METHOD__ )->execute();
		$this->assertFalse( $admission->allows( $image->getTitle(), $oldImageHash, 1, $actor ),
			'Legacy rows lack a timestamp, so duplicate-hash versions are ambiguous.' );
		$this->assertTrue( $admission->allows( $image->getTitle(), $replacementHash, 1, $actor ) );
	}
}
