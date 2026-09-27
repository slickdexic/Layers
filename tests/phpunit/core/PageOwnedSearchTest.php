<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Search\PageOwnedSearchHooks;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;
use SearchEngine;
use SearchResult;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Text inside a page's own drawings is found by the wiki's search.
 * @covers \MediaWiki\Extension\Layers\Search\PageOwnedSearchIngress
 * @covers \MediaWiki\Extension\Layers\Search\PageOwnedSearchHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageDrawingSearchText
 * @group Database
 */
class PageOwnedSearchTest extends MediaWikiIntegrationTestCase {
	private function document( string $word, array $extra = [] ): string {
		$document = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$document->surfaces[0]->layers[0]->text = "Checklist $word";
		foreach ( $extra as $layer ) {
			$document->surfaces[0]->layers[] = (object)$layer;
		}
		return json_encode( $document );
	}

	/** @return string[] Titles found for $term */
	private function search( string $term ): array {
		$matches = $this->getServiceContainer()->getSearchEngineFactory()->create()->searchText( $term );
		$titles = [];
		foreach ( $matches ?: [] as $result ) {
			$titles[] = $result->getTitle()->getPrefixedDBkey();
		}
		return $titles;
	}

	public function testDrawingTextIsIndexedWithThePageText(): void {
		// The test environment uses a dummy engine; use the database's own search.
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ $title->getPrefixedDBkey() ] ] );
		$publisher = TestingAdmissionRegistration::install( $this )['publisher'];
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$first = $publisher->publish( $title, $editor, 0, $this->document( 'zebrafirst' ), 'Drawing',
			new WikitextContent( 'Ordinary pagetextword' ) );
		$this->runDeferredUpdates();
		$this->assertContains( $title->getPrefixedDBkey(), $this->search( 'zebrafirst' ) );
		$this->assertContains( $title->getPrefixedDBkey(), $this->search( 'pagetextword' ) );

		// A drawing-only change reindexes; the old words go.
		$second = $publisher->publish( $title, $editor, $first, $this->document( 'zebrasecond' ), 'Drawing' );
		$this->runDeferredUpdates();
		$this->assertContains( $title->getPrefixedDBkey(), $this->search( 'zebrasecond' ) );
		$this->assertNotContains( $title->getPrefixedDBkey(), $this->search( 'zebrafirst' ) );

		// A text-only edit keeps the drawing words indexed.
		$this->editPage( $title, 'Replaced pagetextother' );
		$this->runDeferredUpdates();
		$this->assertContains( $title->getPrefixedDBkey(), $this->search( 'zebrasecond' ) );
		$this->assertContains( $title->getPrefixedDBkey(), $this->search( 'pagetextother' ) );
		$this->assertNotContains( $title->getPrefixedDBkey(), $this->search( 'pagetextword' ) );
		$this->assertGreaterThan( $second, Title::newFromText( $title->getPrefixedText() )->getLatestRevID() );
	}

	public function testMaintenanceScriptIndexesExistingDrawings(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => true, 'SearchType' => null ] );
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ $title->getPrefixedDBkey() ] ] );
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		TestingAdmissionRegistration::install( $this )['publisher']->publish( $title, $editor, 0,
			$this->document( 'zebraexisting' ), 'Drawing', new WikitextContent( 'Existing page' ) );
		$this->runDeferredUpdates();
		$this->assertNotContains( $title->getPrefixedDBkey(), $this->search( 'zebraexisting' ) );
		$this->overrideConfigValue( 'DisableSearchUpdate', false );
		require_once __DIR__ . '/../../../maintenance/reindexPageDrawings.php';
		$this->expectOutputRegex( '/Indexed drawing text for [1-9][0-9]* page/' );
		( new \ReindexPageDrawings() )->execute();
		$this->assertContains( $title->getPrefixedDBkey(), $this->search( 'zebraexisting' ) );
	}

	public function testSearchEngineDocumentsCarryDrawingText(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ $title->getPrefixedDBkey() ] ] );
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		TestingAdmissionRegistration::install( $this )['publisher']->publish( $title, $editor, 0,
			$this->document( 'zebracirrus' ), 'Drawing', new WikitextContent( 'Page' ) );
		$fields = $this->documentFields( $title );
		$this->assertSame( [ 'Existing', "Welcome Slide\nChecklist zebracirrus" ], $fields['auxiliary_text'] );
		$this->overrideConfigValue( 'LayersPageOwnedPilotOwners', [] );
		$this->assertSame( [ 'Existing' ], $this->documentFields( $title )['auxiliary_text'] );
	}

	private function documentFields( Title $title ): array {
		$services = $this->getServiceContainer();
		$page = $services->getWikiPageFactory()->newFromTitle( $title );
		$fields = [ 'auxiliary_text' => [ 'Existing' ] ];
		$this->hooks()->onSearchDataForIndex2(
			$fields, $page->getContentHandler(), $page, new ParserOutput(), $this->createMock( SearchEngine::class ),
			$services->getRevisionLookup()->getRevisionByTitle( $title ) );
		return $fields;
	}

	private function hooks(): PageOwnedSearchHooks {
		$services = $this->getServiceContainer();
		return new PageOwnedSearchHooks( $services->getService( 'LayersPageOwnedPilot' ),
			$services->getRevisionLookup() );
	}

	/** @return string The extract Special:Search would show after the hook */
	private function extract( Title $title, array $terms, string $extract = '' ): string {
		$searchPage = $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'Search' );
		$searchPage->setContext( RequestContext::getMain() );
		$link = $redirect = $section = $score = $size = $date = $related = $html = '';
		$this->hooks()->onShowSearchHit( $searchPage, SearchResult::newFromTitle( $title ), $terms, $link, $redirect,
			$section, $extract, $score, $size, $date, $related, $html );
		return $extract;
	}

	public function testResultFoundOnlyInADrawingShowsTheDrawingText(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ $title->getPrefixedDBkey() ] ] );
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		TestingAdmissionRegistration::install( $this )['publisher']->publish( $title, $editor, 0,
			$this->document( 'zebrasnippet & "more"' ), 'Drawing', new WikitextContent( 'Ordinary page words' ) );
		$this->assertSame( '<div class="searchresult">Checklist <span class="searchmatch">zebrasnippet</span>' .
			' &amp; &quot;more&quot;' . "\n" . wfMessage( 'ellipsis' )->escaped() . '</div>',
			$this->extract( $title, [ 'zebrasnippet' ] ) );
		// A page-text match, no terms or a term found nowhere keep core's extract.
		$core = '<div class="searchresult"><span class="searchmatch">Ordinary</span> page words</div>';
		$this->assertSame( $core, $this->extract( $title, [ 'zebrasnippet' ], $core ) );
		$this->assertSame( 'kept', $this->extract( $title, [], 'kept' ) );
		$this->assertSame( 'kept', $this->extract( $title, [ 'absentword' ], 'kept' ) );
		$this->overrideConfigValue( 'LayersPageOwnedPilotOwners', [] );
		$this->assertSame( '', $this->extract( $title, [ 'zebrasnippet' ] ) );
	}

	public function testExtractedTextIsWhatReadersSee(): void {
		$text = PageDrawingSearchText::extract( new LayersDocumentContent( $this->document( 'visible', [
			[ 'id' => 'rich', 'type' => 'textbox', 'text' => 'ignored plain', 'richText' => [
				[ 'text' => 'Rich ' ], [ 'text' => 'words', 'style' => [ 'fontWeight' => 'bold' ] ] ] ],
			[ 'id' => 'hidden', 'type' => 'text', 'text' => 'hiddenword', 'visible' => false ],
			[ 'id' => 'box', 'type' => 'rectangle' ]
		] ) ) );
		$this->assertSame( "Welcome Slide\nChecklist visible\nRich words", $text );
		$this->assertSame( '', PageDrawingSearchText::extract( new LayersDocumentContent( 'not json' ) ) );
	}
}
