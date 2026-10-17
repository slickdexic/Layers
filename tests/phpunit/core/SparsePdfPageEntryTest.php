<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundFileHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageViewerReadService
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage
 * @group Database
 */
class SparsePdfPageEntryTest extends RealAssetTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		MigrationState::markComplete( $this->getDb() );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repos->method( 'findFile' )->willReturnCallback( fn ( $title ) => $this->repo->findFile( $title ) );
		$this->setService( 'RepoGroup', $repos );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	private function fixture( bool $gallery = false, int $storedPage = 2, bool $linkedCaption = true ): array {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Sparse-entry-' . wfRandomString( 8 ) . '.pdf' );
		$target = $storedPage === 2 ? 1 : 2;
		$head = $file->getTitle()->getPrefixedDBkey() . '|page=' . $target . '|300px|layerset=ABC';
		$lines = [ $head . ( $linkedCaption ? '|[[Main Page|noedit]]' : '|Plain caption' ),
			$head . '|noedit|View only' ];
		$main = $gallery ? "<gallery>\n" . implode( "\n", $lines ) . "\n</gallery>" :
			"Préface π\n[[" . implode( "]]\n[[", $lines ) . ']]';
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $main )->getNewRevision()->getId();
		$surface = $this->makePdfSurface( 'stored-anchor', 'ABC', $file->getTitle()->getPrefixedDBkey(),
			$file->getTimestamp(), $file->getSha1(), $storedPage );
		$surface['canvas']['width'] = $file->getWidth( $storedPage );
		$surface['canvas']['height'] = $file->getHeight( $storedPage );
		$surface['layers'] = [ [ 'id' => 'saved-note', 'type' => 'text', 'text' => 'Stored sibling exact' ] ];
		$slide = $this->makeSlideSurface( 'independent-slide', 'ABC' );
		$actor = $this->actor();
		$revision = $this->publisher->publish( $page->getTitle(), $actor, $revision,
			$this->buildDocument( [ $surface, $slide ] ), 'Sparse PDF entry fixture' );
		return [ 'file' => $file, 'page' => $page, 'revision' => $revision, 'actor' => $actor,
			'surface' => $surface, 'slide' => $slide, 'main' => $main, 'target' => $target,
			'expected' => '[[' . $lines[0] . ']]', 'start' => strlen( "Préface π\n" ) ];
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	private function pilot(): PageOwnedPilot {
		return new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] );
	}

	public static function provideOccurrences(): array {
		return [ [ false, 1 ], [ false, 2 ], [ true, 1 ], [ true, 2 ] ];
	}

	/** @dataProvider provideOccurrences */
	public function testUntouchedOccurrenceKeepsSeparateAnchorAndExactNoedit( bool $gallery, int $stored ): void {
		$f = $this->fixture( $gallery, $stored );
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			$f['file']->getTitle()->getPrefixedDBkey(), '20260906130000' );
		$before = $this->witness();
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $f['main'],
			$f['page']->getTitle(), ParserOptions::newFromAnon(), true, true, $f['revision'] );
		$html = $parsed->getRawText();
		$document = new \DOMDocument();
		$document->loadHTML( $html, LIBXML_NOERROR | LIBXML_NOWARNING );
		$images = ( new \DOMXPath( $document ) )->query( '//*[@data-layers-pdf-anchor]' );
		$this->assertCount( 2, $images );
		foreach ( $images as $image ) {
			$this->assertSame( 'v1:' . $f['page']->getId() . ':stored-anchor',
				$image->getAttribute( 'data-layers-pdf-anchor' ) );
			$this->assertSame( (string)$f['target'], $image->getAttribute( 'data-layers-pdf-page' ) );
			$this->assertSame( (string)$f['revision'], $image->getAttribute( 'data-layers-pdf-revision' ) );
			$this->assertSame( '', $image->getAttribute( 'data-layers-binding' ) );
		}
		$this->assertSame( '', $images[0]->getAttribute( 'data-layers-noedit' ) );
		$this->assertSame( '1', $images[1]->getAttribute( 'data-layers-noedit' ) );
		$this->assertStringNotContainsString( 'Stored sibling exact', $html );
		$this->assertSame( $before, $this->witness() );
	}

	public function testViewerUsesArchivedTargetPresentationWithoutInventingStoredMember(): void {
		$f = $this->fixture();
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			$f['file']->getTitle()->getPrefixedDBkey(), '20260906130000' );
		$before = $this->witness();
		$binding = 'v1:' . $f['page']->getId() . ':stored-anchor';
		$viewer = $this->pilot()->prepareFullSizeViewer( $f['page']->getTitle(), $f['revision'], $binding,
			$this->actor( [ 'read' ] ), 1 );
		$this->assertSame( 2, $viewer['initialPage'] );
		$this->assertSame( 1, $viewer['targetPage'] );
		$this->assertSame( 2, $viewer['pageCount'] );
		$this->assertEquals( [ [ 'page' => 2, 'surface' => $f['surface'] ] ], $viewer['pages'] );
		$this->assertSame( JsonSnapshotCodec::encode( array_replace( $f['surface']['source'], [ 'page' => 1 ] ) ),
			JsonSnapshotCodec::encode( $viewer['display']['source'] ) );
		$this->assertSame( [ 'width' => 416, 'height' => 208 ], $viewer['display']['canvas'] );
		$this->assertArrayNotHasKey( 'layers', $viewer['display'] );
		$this->assertStringContainsString( 'page1-', $viewer['display']['rendition']['url'] );
		$this->assertTrue( $viewer['source']['exactVersion'] );
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideEntryModes(): array {
		return [ [ false ], [ true ] ];
	}

	/** @dataProvider provideEntryModes */
	public function testSpecialEntryUsesSavedSessionAndExactRequestedPage( bool $bound ): void {
		$f = $this->fixture( false, 2, false );
		$before = $this->witness();
		$params = $bound ? [ 'pageid' => (string)$f['page']->getId(), 'revid' => (string)$f['revision'],
			'start' => (string)$f['start'], 'expected' => $f['expected'] ] :
			[ 'owner' => $f['page']->getTitle()->getPrefixedDBkey(), 'surface' => 'stored-anchor',
				'revid' => (string)$f['revision'], 'pdfpage' => '1' ];
		$context = new RequestContext();
		$context->setAuthority( $f['actor'] );
		$context->setTitle( $this->getServiceContainer()->getTitleFactory()->newFromText( 'Special:EditLayersPage' ) );
		$context->setRequest( new FauxRequest( $params ) );
		$special = new SpecialEditLayersPage( $this->pilot() );
		$special->setContext( $context );
		$special->execute( null );
		$config = $context->getOutput()->getJsConfigVars();
		$this->assertArrayHasKey( 'wgLayersEditorInit', $config );
		$owned = $config['wgLayersEditorInit']['pageOwned'];
		$this->assertSame( 'stored-anchor', $owned['surfaceId'] );
		$this->assertSame( 1, $owned['pdfEntryPage'] );
		$this->assertSame( 2, $owned['pdfContext']['page'] );
		$this->assertTrue( $owned['pdfContext']['stored'] );
		$this->assertArrayNotHasKey( 'newSurface', $owned );
		$this->assertArrayNotHasKey( 'pdfCreation', $owned );
		$this->assertSame( $f['page']->getTitle()->getLocalURL(), $config['wgLayersReturnToUrl'] );
		$this->assertSame( $before, $this->witness() );
	}
}
