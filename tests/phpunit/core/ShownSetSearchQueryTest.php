<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Search\ShownLayerSets;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Internal PDF member selectors do not repeat a whole shared-set search query.
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchText
 * @covers \MediaWiki\Extension\Layers\Search\ShownLayerSets
 * @group Database
 */
class ShownSetSearchQueryTest extends \MediaWikiIntegrationTestCase {

	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	/** @return array File and its independently expected current search text */
	private function pdf(): array {
		$file = $this->upload( 'Search_members_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$this->saveSet( $file, 'Notes', 1, 'Superseded first member' );
		$this->saveSet( $file, 'Notes', 2, 'Current first member' );
		$this->saveSet( $file, 'Notes', 1, 'Current second member', 2 );
		return [ $file, "Current first member\nCurrent second member" ];
	}

	public function testOneSelectedMemberKeepsTheExistingWholeSetSearchScope(): void {
		[ $file, $expected ] = $this->pdf();
		$text = $this->getServiceContainer()->getService( 'LayersDrawingSearchText' );
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->assertSame( $expected, $text->get( $title, null, true,
			[ [ ShownLayerSets::FILE, $file->getName(), 'Notes', 2 ] ] ) );
		$this->assertSame( $expected, $text->get( $title, null, true,
			[ [ ShownLayerSets::FILE, $file->getName(), 'Notes' ] ] ) );
	}

	public function testStoredTriplesAndMultipleMemberTuplesQueryTheSetOnce(): void {
		[ $file, $expected ] = $this->pdf();
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->editPage( $title, 'Search metadata fixture' );
		$this->runDeferredUpdates();
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
			'pp_page' => $title->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY,
			'pp_value' => json_encode( [
				[ ShownLayerSets::FILE, $file->getName(), 'Notes', 2 ],
				[ ShownLayerSets::FILE, $file->getName(), 'Notes' ],
				[ ShownLayerSets::FILE, $file->getName(), 'Notes', 2 ],
				[ ShownLayerSets::FILE, $file->getName(), 'Notes', 1 ]
			] )
		] )->caller( __METHOD__ )->execute();
		$this->assertSame( $expected,
			$this->getServiceContainer()->getService( 'LayersDrawingSearchText' )->get( $title, null, true ) );
	}

	public function testDifferentFilesKindsAndLiteralSelectorsKeepTheirOrderAndText(): void {
		[ $file, $pdfText ] = $this->pdf();
		$other = $this->upload( 'Search_other_' . wfRandomString() . '.png' );
		$this->saveSet( $other, 'Notes', 1, 'Other file member' );
		$this->saveSlide( $file->getName(), 'Notes', 'Slide member' );
		$this->saveSet( $file, 'Notes:latest', 1, 'Literal colon selector' );
		// Make Notes the latest selector again; '' must stay distinct even when its result is the same.
		$this->saveSet( $file, 'Notes', 3, 'Current second member', 2 );
		$shown = [
			[ ShownLayerSets::FILE, $other->getName(), 'Notes' ],
			[ ShownLayerSets::FILE, $file->getName(), 'Notes', 2 ],
			[ ShownLayerSets::FILE, $file->getName(), '' ],
			[ ShownLayerSets::SLIDE, $file->getName(), 'Notes' ],
			[ ShownLayerSets::FILE, $file->getName(), 'Notes:latest' ],
			[ ShownLayerSets::FILE, $file->getName(), 'Notes' ],
			[ ShownLayerSets::FILE, $other->getName(), 'Notes', 2 ]
		];
		$this->assertSame( "Other file member\n$pdfText\n$pdfText\nSlide member\nLiteral colon selector",
			$this->getServiceContainer()->getService( 'LayersDrawingSearchText' )->get(
				$this->getNonexistingTestPage()->getTitle(), null, true, $shown ) );
	}
}
