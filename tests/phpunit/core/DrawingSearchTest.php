<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Search\DrawingSearchHooks;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;
use SearchEngine;
use SearchResult;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Text inside a page's own drawings, and in a file's layer sets, is found by the wiki's search.
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchIngress
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchHooks
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchText
 * @covers \MediaWiki\Extension\Layers\Search\ShownLayerSets
 * @covers \MediaWiki\Extension\Layers\Revision\PageDrawingSearchText
 * @group Database
 */
class DrawingSearchTest extends \MediaWiki\Tests\Api\ApiTestCase {
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
		$engine = $this->getServiceContainer()->getSearchEngineFactory()->create();
		$engine->setNamespaces( [ NS_MAIN, NS_FILE ] );
		$matches = $engine->searchText( $term );
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
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null ] );
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
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null ] );
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
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null ] );
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		TestingAdmissionRegistration::install( $this )['publisher']->publish( $title, $editor, 0,
			$this->document( 'zebracirrus' ), 'Drawing', new WikitextContent( 'Page' ) );
		$fields = $this->documentFields( $title );
		$this->assertSame( [ 'Existing', "Welcome Slide\nChecklist zebracirrus" ], $fields['auxiliary_text'] );
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

	private function hooks(): DrawingSearchHooks {
		$services = $this->getServiceContainer();
		return new DrawingSearchHooks( $services->getService( 'LayersDrawingSearchText' ),
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
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null ] );
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

	/** @return string Name of a newly uploaded file whose page text is $pageText */
	private function uploadFile( string $pageText ): string {
		$name = 'LayersSearch' . mt_rand() . '.png';
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:' . $name );
		$file = $this->getServiceContainer()->getRepoGroup()->getLocalRepo()->newFile( $title );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-image.png', 'Fixture',
			$pageText, 0, false, '20260906120000', $this->getTestSysop()->getUser() ) );
		return $name;
	}

	private function saveSet( string $file, string $set, array $texts ): void {
		$layers = [];
		foreach ( $texts as $i => $text ) {
			$layers[] = [ 'id' => "t$i", 'type' => 'text', 'x' => 1, 'y' => 1, 'text' => $text ];
		}
		$layers[] = [ 'id' => 'hidden', 'type' => 'text', 'x' => 1, 'y' => 1, 'text' => 'zebrahidden',
			'visible' => false ];
		$this->doApiRequestWithToken( [ 'action' => 'layerssave', 'filename' => $file, 'setname' => $set,
			'data' => json_encode( $layers ) ], null, $this->getTestSysop()->getUser() );
	}

	public function testFileLayerSetTextIsIndexedWithTheFilePage(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$file = $this->uploadFile( 'Plain filedescword' );
		$key = 'File:' . $file;
		$this->saveSet( $file, 'labels', [ 'Valve zebralegacy' ] );
		$this->saveSet( $file, 'second', [ 'Pump zebrasecondset' ] );
		$this->runDeferredUpdates();
		$this->assertContains( $key, $this->search( 'zebralegacy' ) );
		$this->assertContains( $key, $this->search( 'zebrasecondset' ) );
		$this->assertContains( $key, $this->search( 'filedescword' ) );
		$this->assertNotContains( $key, $this->search( 'zebrahidden' ) );

		// A new revision of a set replaces its words; a later edit of the file page keeps them.
		$this->saveSet( $file, 'labels', [ 'Valve zebrarevised' ] );
		$this->runDeferredUpdates();
		$this->editPage( $key, 'Replaced filedescother' );
		$this->runDeferredUpdates();
		$this->assertContains( $key, $this->search( 'zebrarevised' ) );
		$this->assertNotContains( $key, $this->search( 'zebralegacy' ) );
		$this->assertContains( $key, $this->search( 'filedescother' ) );

		// Renaming keeps the words; deleting a set removes them.
		$this->doApiRequestWithToken( [ 'action' => 'layersrename', 'filename' => $file, 'oldname' => 'second',
			'newname' => 'renamed' ], null, $this->getTestSysop()->getUser() );
		$this->doApiRequestWithToken( [ 'action' => 'layersdelete', 'filename' => $file, 'setname' => 'labels' ],
			null, $this->getTestSysop()->getUser() );
		$this->runDeferredUpdates();
		$this->assertContains( $key, $this->search( 'zebrasecondset' ) );
		$this->assertNotContains( $key, $this->search( 'zebrarevised' ) );
		$this->assertContains( $key, $this->search( 'filedescother' ) );
	}

	public function testMaintenanceScriptIndexesExistingFileSets(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => true, 'SearchType' => null ] );
		$file = $this->uploadFile( 'Existing file' );
		$this->saveSet( $file, 'labels', [ 'Gauge zebrafileexisting' ] );
		$this->runDeferredUpdates();
		$this->overrideConfigValue( 'DisableSearchUpdate', false );
		$this->assertNotContains( 'File:' . $file, $this->search( 'zebrafileexisting' ) );
		require_once __DIR__ . '/../../../maintenance/reindexPageDrawings.php';
		$this->expectOutputRegex( '/Indexed drawing text for [1-9][0-9]* page/' );
		( new \ReindexPageDrawings() )->execute();
		$this->assertContains( 'File:' . $file, $this->search( 'zebrafileexisting' ) );
	}

	public function testFileSearchDocumentsCarrySetText(): void {
		$file = $this->uploadFile( 'Ordinary file words' );
		$this->saveSet( $file, 'labels', [ 'Valve zebrafiledocument' ] );
		$title = Title::makeTitle( NS_FILE, $file );
		$this->assertSame( [ 'Existing', 'Valve zebrafiledocument' ],
			$this->documentFields( $title )['auxiliary_text'] );
		// Pages outside the File namespace have no file sets.
		$this->assertSame( [ 'Existing' ],
			$this->documentFields( $this->getExistingTestPage()->getTitle() )['auxiliary_text'] );
	}

	public function testPagesAreFoundByTheSharedSetsTheyShow(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$file = $this->uploadFile( 'Plain description' );
		$this->saveSet( $file, 'labels', [ 'Valve zebraembedded' ] );
		$this->saveSet( $file, 'other', [ 'Gauge zebralatestset' ] );
		$article = $this->getNonexistingTestPage()->getTitle();
		$key = $article->getPrefixedDBkey();
		$this->editPage( $article, "Article prose [[File:$file|thumb|layerset=labels]]" );
		$this->runDeferredUpdates();
		$this->assertContains( $key, $this->search( 'zebraembedded' ) );
		$this->assertContains( $key, $this->search( 'prose' ) );
		$this->assertNotContains( $key, $this->search( 'zebralatestset' ) );
		$this->assertNotContains( $key, $this->search( 'zebrahidden' ) );

		// A new revision of the shown set reindexes the page, which was not edited.
		$this->saveSet( $file, 'labels', [ 'Valve zebraembedrevised' ] );
		$this->runDeferredUpdates();
		$this->assertContains( $key, $this->search( 'zebraembedrevised' ) );
		$this->assertNotContains( $key, $this->search( 'zebraembedded' ) );

		// layerset=on shows, and indexes, whichever set was saved most recently.
		$this->editPage( $article, "Article prose [[File:$file|thumb|layerset=on]]" );
		$this->saveSet( $file, 'other', [ 'Gauge zebranowlatest' ] );
		$this->runDeferredUpdates();
		$this->assertContains( $key, $this->search( 'zebranowlatest' ) );
		$this->assertNotContains( $key, $this->search( 'zebraembedrevised' ) );

		// A template change reaches the page through its links update; the page itself is not edited.
		$template = 'Template:ShownSetProbe' . mt_rand();
		$this->editPage( $template, "[[File:$file|thumb|layerset=labels]]" );
		$this->editPage( $article, "Article prose {{" . $template . "}}" );
		$this->runDeferredUpdates();
		$this->assertContains( $key, $this->search( 'zebraembedrevised' ) );
		$this->editPage( $template, "[[File:$file|thumb|layerset=other]]" );
		$this->runJobs();
		$this->runDeferredUpdates();
		$this->assertContains( $key, $this->search( 'zebranowlatest' ) );
		$this->assertNotContains( $key, $this->search( 'zebraembedrevised' ) );

		// Removing the embed removes the words.
		$this->editPage( $article, 'Article prose only' );
		$this->runDeferredUpdates();
		$this->assertNotContains( $key, $this->search( 'zebranowlatest' ) );
		$this->assertContains( $key, $this->search( 'prose' ) );
	}

	public function testPagesAreFoundByTheSlidesTheyShow(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$slide = 'SearchSlide' . mt_rand();
		$save = function ( string $text ) use ( $slide ): void {
			$this->doApiRequestWithToken( [ 'action' => 'layerssave', 'slidename' => $slide, 'data' => json_encode( [
				'canvasWidth' => 800, 'canvasHeight' => 600,
				'layers' => [ [ 'id' => 't', 'type' => 'text', 'x' => 10, 'y' => 10, 'text' => $text ] ]
			] ) ], null, $this->getTestSysop()->getUser() );
		};
		$save( 'Slide zebraslideword' );
		$article = $this->getNonexistingTestPage()->getTitle();
		$this->editPage( $article, "Intro {{#Slide:$slide}}" );
		$this->runDeferredUpdates();
		$this->assertContains( $article->getPrefixedDBkey(), $this->search( 'zebraslideword' ) );
		$save( 'Slide zebraslidenew' );
		$this->runDeferredUpdates();
		$this->assertContains( $article->getPrefixedDBkey(), $this->search( 'zebraslidenew' ) );
		$this->assertNotContains( $article->getPrefixedDBkey(), $this->search( 'zebraslideword' ) );
	}

	public function testMaintenanceScriptIndexesPagesShowingSets(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => true, 'SearchType' => null ] );
		$file = $this->uploadFile( 'Existing' );
		$this->saveSet( $file, 'labels', [ 'Gauge zebrashownexisting' ] );
		$article = $this->getNonexistingTestPage()->getTitle();
		$this->editPage( $article, "[[File:$file|layerset=labels]]" );
		$this->runDeferredUpdates();
		$this->overrideConfigValue( 'DisableSearchUpdate', false );
		$this->assertNotContains( $article->getPrefixedDBkey(), $this->search( 'zebrashownexisting' ) );
		require_once __DIR__ . '/../../../maintenance/reindexPageDrawings.php';
		$this->expectOutputRegex( '/Indexed drawing text for [1-9][0-9]* page/' );
		( new \ReindexPageDrawings() )->execute();
		$this->assertContains( $article->getPrefixedDBkey(), $this->search( 'zebrashownexisting' ) );
	}

	public function testShownSetsAreRecordedInParseOrderIndependentForm(): void {
		$first = $this->getServiceContainer()->getParserFactory()->create()->parse(
			"[[File:B.png|layerset=x]] [[File:A.png|layerset=on]] {{#Slide:S1|layerset=y}} [[File:B.png|layerset=x]]" .
			" [[File:C.png|layerset=off]]", Title::makeTitle( NS_MAIN, 'ShownProbe' ), ParserOptions::newFromAnon() );
		$this->assertSame( '[["file","A.png",""],["file","B.png","x"],["slide","S1","y"]]',
			$first->getPageProperty( ShownLayerSets::PROPERTY ) );
		$this->assertSame( '["file","B.png",', ShownLayerSets::fragment( ShownLayerSets::FILE, 'B.png' ) );
	}
}
