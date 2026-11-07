<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Search\DrawingSearchHooks;
use MediaWiki\Extension\Layers\Search\DrawingSearchText;
use MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Extension\Layers\Search\VisibleLegacySearchProjection;
use MediaWiki\Parser\ParserOutput;
use SearchEngine;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Internal PDF member selectors do not repeat a whole shared-set search query.
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchText
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchHooks
 * @covers \MediaWiki\Extension\Layers\Search\ShownLayerSets
 * @group Database
 */
class ShownSetSearchQueryTest extends \MediaWikiIntegrationTestCase {

	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'GroupPermissions', array_replace_recursive(
			$this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' ), [ '*' => [ 'read' => true ] ] ) );
		$this->setUpMigration();
	}

	/** @return array File and its independently expected current search text */
	private function pdf(): array {
		$file = $this->upload( 'Search_members_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$this->saveSet( $file, 'Notes', 1, 'Superseded first member' );
		$this->insertRow( $file->getName(), $file->getSha1(), 'application', 'pdf', 'Notes', 2, 1, [
			'layers' => [
				[ 'id' => 'note', 'type' => 'text', 'text' => 'Current first member' ],
				[ 'id' => 'rich', 'type' => 'textbox', 'text' => 'Ignored rich fallback', 'richText' => [
					[ 'text' => 'Rich member ' ], [ 'text' => 'words', 'style' => [ 'fontWeight' => 'bold' ] ]
				] ],
				[ 'id' => 'hidden', 'type' => 'text', 'text' => 'Hidden member words', 'visible' => false ]
			]
		] );
		$this->saveSet( $file, 'Notes', 1, 'Current second member', 2 );
		return [ $file, "Current first member\nRich member words\nCurrent second member" ];
	}

	/**
	 * @param array &$queries Actual reader calls, retaining the real database results
	 * @return DrawingSearchText
	 */
	private function countingText( array &$queries ): DrawingSearchText {
		$services = $this->getServiceContainer();
		$db = $services->getService( 'LayersDatabase' );
		$reader = $this->getMockBuilder( LayersDatabase::class )->disableOriginalConstructor()
			->onlyMethods( [ 'getSetForSearch', 'getSetForSearchWithSources' ] )->getMock();
		$reader->method( 'getSetForSearch' )->willReturnCallback(
			static function ( string $name, string $set, bool $slide, bool $fromPrimary = false )
				use ( $db, &$queries ): array {
				$queries[] = [ $name, $set, $slide, $fromPrimary ];
				return $db->getSetForSearch( $name, $set, $slide, $fromPrimary );
			}
		);
		$reader->method( 'getSetForSearchWithSources' )->willReturnCallback(
			static function ( string $name, string $set, bool $slide, bool $fromPrimary = false )
				use ( $db, &$queries ): array {
				$queries[] = [ $name, $set, $slide, $fromPrimary ];
				return $db->getSetForSearchWithSources( $name, $set, $slide, $fromPrimary );
			}
		);
		$visibleLegacy = new VisibleLegacySearchProjection( $reader,
			new LegacySearchSourceAdmission( $services->getRepoGroup()->getLocalRepo() ),
			$services->getTitleFactory() );
		return new DrawingSearchText( $this->pilot, $reader, $services->getRevisionLookup(),
			$services->getPageStore(), $services->getConnectionProvider(), $visibleLegacy,
			$services->getUserFactory()->newAnonymous(), $services->getJobQueueGroup(),
			$services->getService( 'LayersLogger' ) );
	}

	public function testSearchHookKeepsAuxiliaryFieldsAndWholeMemberTextOnce(): void {
		[ $file, $expected ] = $this->pdf();
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->editPage( $title, 'Search hook fixture' );
		$this->runDeferredUpdates();
		$services = $this->getServiceContainer();
		$page = $services->getWikiPageFactory()->newFromTitle( $title );
		$output = new ParserOutput();
		$output->setPageProperty( ShownLayerSets::PROPERTY, json_encode( [
			[ ShownLayerSets::FILE, $file->getName(), 'Notes', 2 ],
			[ ShownLayerSets::FILE, $file->getName(), 'Notes' ],
			[ ShownLayerSets::FILE, $file->getName(), 'Notes', 1 ],
			[ ShownLayerSets::FILE, $file->getName(), 'Notes', 2 ]
		] ) );
		$fields = [ 'auxiliary_text' => [ 'Existing first', 'Existing second' ], 'unrelated' => 'Keep me' ];
		$hooks = new DrawingSearchHooks( $services->getService( 'LayersDrawingSearchText' ),
			$services->getRevisionLookup() );
		$hooks->onSearchDataForIndex2( $fields, $page->getContentHandler(), $page, $output,
			$this->createMock( SearchEngine::class ), $services->getRevisionLookup()->getRevisionByTitle( $title ) );
		$this->assertSame( [
			'auxiliary_text' => [ 'Existing first', 'Existing second', $expected ], 'unrelated' => 'Keep me'
		], $fields );
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
		$queries = [];
		$text = $this->countingText( $queries );
		$this->assertSame( $expected, $text->get( $title, null, true ) );
		$this->assertSame( [ [ $file->getName(), 'Notes', false, true ] ], $queries );
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
		$queries = [];
		$text = $this->countingText( $queries );
		$title = $this->getNonexistingTestPage()->getTitle();
		$expected = "Other file member\n$pdfText\n$pdfText\nSlide member\nLiteral colon selector";
		$expectedQueries = [
			[ $other->getName(), 'Notes', false, true ],
			[ $file->getName(), 'Notes', false, true ],
			[ $file->getName(), '', false, true ],
			[ 'Slide:' . $file->getName(), 'Notes', true, true ],
			[ $file->getName(), 'Notes:latest', false, true ]
		];
		$this->assertSame( $expected, $text->get( $title, null, true, $shown ) );
		$this->assertSame( $expectedQueries, $queries );
		$this->assertSame( $expected, $text->get( $title, null, true, $shown ) );
		$this->assertSame( array_merge( $expectedQueries, $expectedQueries ), $queries );
	}

	public function testReverseReindexFindsStoredQuadrupleWithTheUnchangedFragment(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		[ $file, $expected ] = $this->pdf();
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->editPage( $title, 'Reverse lookup fixture' );
		$this->runDeferredUpdates();
		$stored = json_encode( [ [ ShownLayerSets::FILE, $file->getName(), 'Notes', 2 ] ] );
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
			'pp_page' => $title->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY, 'pp_value' => $stored
		] )->caller( __METHOD__ )->execute();
		$this->assertSame( '[["file","' . $file->getName() . '","Notes",2]]', $stored );
		$this->assertSame( '["file","' . $file->getName() . '",',
			ShownLayerSets::fragment( ShownLayerSets::FILE, $file->getName() ) );
		$services = $this->getServiceContainer();
		$engine = $services->getSearchEngineFactory()->create();
		$engine->setNamespaces( [ NS_MAIN ] );
		$this->assertSame( 0, $engine->searchText( 'zebramemberreverse' )->numRows() );
		$revision = $services->getRevisionLookup()->getRevisionByTitle( $title )->getId();
		$this->saveSet( $file, 'Notes', 3, 'zebramemberreverse', 2 );
		$text = $services->getService( 'LayersDrawingSearchText' );
		$text->updatePagesShowing( ShownLayerSets::FILE, $file->getName() );
		$found = [];
		foreach ( $engine->searchText( 'zebramemberreverse' ) as $result ) {
			$found[] = $result->getTitle()->getPrefixedDBkey();
		}
		$this->assertSame( [ $title->getPrefixedDBkey() ], $found );
		$this->assertSame( "Current first member\nRich member words\nzebramemberreverse",
			$text->get( $title, null, true ) );
		$this->assertSame( $revision, $services->getRevisionLookup()->getRevisionByTitle( $title )->getId() );
		$this->assertSame( $stored, $this->getDb()->newSelectQueryBuilder()->select( 'pp_value' )
			->from( 'page_props' )->where( [
				'pp_page' => $title->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY
			] )->caller( __METHOD__ )->fetchField() );
	}
}
