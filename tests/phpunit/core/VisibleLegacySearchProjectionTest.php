<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission;
use MediaWiki\Extension\Layers\Search\VisibleLegacySearchProjection;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * @covers \MediaWiki\Extension\Layers\Search\VisibleLegacySearchProjection
 * @group Database
 */
class VisibleLegacySearchProjectionTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	public function testSuppressionAndRestorationKeepOtherFilesAndSlidesIndependent(): void {
		$first = $this->upload( 'Legacy-filter-' . wfRandomString( 8 ) . '.pdf', 'test-multipage.pdf' );
		$other = $this->upload( 'Legacy-other-' . wfRandomString( 8 ) . '.png' );
		$this->saveSet( $first, 'ABC', 1, 'First PDF page', 1 );
		$this->saveSet( $first, 'ABC', 1, 'Second PDF page', 2 );
		$this->saveSet( $other, 'ABC', 1, 'Other file text' );
		$slide = 'LegacySlideFixed' . wfRandomString( 8 );
		$this->saveSlide( $slide, 'ABC', 'Slide text' );
		$services = $this->getServiceContainer();
		$filter = new VisibleLegacySearchProjection( $services->getService( 'LayersDatabase' ),
			new LegacySearchSourceAdmission( $services->getRepoGroup()->getLocalRepo() ),
			$services->getTitleFactory() );
		$this->assertSame( "First PDF page\nSecond PDF page", $filter->shown( $first->getName(), 'ABC', false,
			$this->actor, true ) );
		$this->assertSame( "First PDF page\nSecond PDF page", $filter->file( $first->getName(), $this->actor, true ) );
		$this->assertSame( 'Other file text', $filter->shown( $other->getName(), 'ABC', false, $this->actor, true ) );
		$this->assertSame( 'Slide text', $filter->shown( $slide, 'ABC', true, $this->actor, true ) );
		$this->assertStatusGood( $first->deleteFile( 'Synthetic fixture', $this->actor, true ) );
		$this->assertSame( '', $filter->shown( $first->getName(), 'ABC', false, $this->actor, true ) );
		$this->assertSame( 'Other file text', $filter->shown( $other->getName(), 'ABC', false, $this->actor, true ) );
		$this->assertSame( 'Slide text', $filter->shown( $slide, 'ABC', true, $this->actor, true ) );
		$this->assertStatusGood( $first->restore( [], true ) );
		$this->assertSame( "First PDF page\nSecond PDF page", $filter->shown( $first->getName(), 'ABC', false,
			$this->actor, true ) );
	}
}
