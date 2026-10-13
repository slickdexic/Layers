<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Revision\CreationOverlayControls;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/RealAssetTestCase.php';
require_once __DIR__ . '/../../../maintenance/migrateLayersToPageHistory.php';

/**
 * Box removal preserves native current/historical viewer and creation entry points.
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Revision\CreationOverlayControls
 * @group Database
 */
class OverlayOnlyPageOutputTest extends RealAssetTestCase {

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$database = $this->getDb();
		$this->assertStringContainsString( 'unittest', $database->getDomainID() );
		$maintenance = new \MigrateLayersToPageHistory();
		$maintenance->setDB( $database );
		$maintenance->setOption( 'user', $this->getTestSysop()->getUser()->getName() );
		$maintenance->setOption( 'commit', true );
		ob_start();
		try {
			$this->assertTrue( $maintenance->execute() );
		} finally {
			ob_end_clean();
		}
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repos->method( 'findFile' )->willReturnCallback( fn ( $title ) => $this->repo->findFile( $title ) );
		$this->setService( 'RepoGroup', $repos );
	}

	public static function provideStoredKinds(): array {
		return [ [ 'slide', 1 ], [ 'image', 1 ], [ 'pdf', 1 ], [ 'pdf', 2 ] ];
	}

	/** @dataProvider provideStoredKinds */
	public function testStoredOverlaysKeepNativeAdmissionWithoutTheLinksBox( string $kind, int $sourcePage ): void {
		$actor = $this->actor();
		$page = $this->getExistingTestPage();
		$fixture = __DIR__ . '/../../fixtures/revisions/slide-document-v1.json';
		$document = json_decode( file_get_contents( $fixture ), true );
		$surface = $document['surfaces'][0];
		$surface['label'] = 'ABC';
		$surface['kind'] = $kind;
		$embed = '{{#Slide:ABC}}';
		if ( $kind !== 'slide' ) {
			$asset = $kind === 'pdf' ? 'test-multipage.pdf' : 'test-image.png';
			$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/' . $asset,
				'File:OverlayOnly-' . wfRandomString( 8 ) . ( $kind === 'pdf' ? '.pdf' : '.png' ) );
			$surface['canvas']['width'] = $file->getWidth( $sourcePage );
			$surface['canvas']['height'] = $file->getHeight( $sourcePage );
			$surface['source'] = [ 'repository' => 'local',
				'fileTitle' => $file->getTitle()->getPrefixedDBkey(), 'timestamp' => $file->getTimestamp(),
				'sha1' => $file->getSha1(), 'page' => $sourcePage ];
			$embed = '[[' . $file->getTitle()->getPrefixedDBkey() . '|120px|layerset=ABC|page=' . $sourcePage . ']]';
		}
		$revision = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ),
			'Overlay-only fixture', new WikitextContent( $embed ), $page->getId() );
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $embed, $page->getTitle(),
			ParserOptions::newFromAnon(), true, true, $revision );
		$shared = json_encode( $parsed->toJsonArray(), JSON_THROW_ON_ERROR );
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] );
		$binding = 'v1:' . $page->getId() . ':' . $surface['id'];
		foreach ( [ [], [ 'oldid' => (string)$revision ] ] as $query ) {
			$context = new RequestContext();
			$context->setTitle( $page->getTitle() );
			$context->setUser( $actor );
			$context->setRequest( new FauxRequest( $query ) );
			$out = new OutputPage( $context );
			$out->setRevisionId( $revision );
			$out->addHTML( '<p id="user-content">Preserve this paragraph.</p>' );
			BoundSlideHooks::output( $out, $parsed, $pilot );
			$this->assertSame( '<p id="user-content">Preserve this paragraph.</p>', $out->getHTML() );
			$this->assertContains( 'ext.layers.history', $out->getModules() );
			$this->assertNotContains( 'ext.layers.pageControls.styles', $out->getModuleStyles() );
		}
		$view = $pilot->prepareBoundViewers( $page->getTitle(), $revision, [ $binding ], $actor, true )[$binding];
		$this->assertSame( JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ),
			JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => [ $view['surface'] ] ] ) );
		$this->assertNotEmpty( $view['editUrl'] );
		$reader = $this->actor( [ 'read' ] );
		$readerViews = $pilot->prepareBoundViewers( $page->getTitle(), $revision, [ $binding ], $reader, true );
		$readerView = $readerViews[$binding];
		$this->assertNull( $readerView['editUrl'] );
		$this->assertSame( $shared, json_encode( $parsed->toJsonArray(), JSON_THROW_ON_ERROR ) );
	}

	public function testMissingImageAndSlideKeepCreationOverlaysWithoutTheLinksBox(): void {
		$actor = $this->actor();
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:OverlayOnlyMissing-' . wfRandomString( 8 ) . '.png' );
		$embed = '[[' . $file->getTitle()->getPrefixedDBkey() . '|layerset=ABC]]' . "\n{{#Slide:ABC}}";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $embed )->getNewRevision()->getId();
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $embed, $page->getTitle(),
			ParserOptions::newFromAnon(), true, true, $revision );
		$shared = json_encode( $parsed->toJsonArray(), JSON_THROW_ON_ERROR );
		$context = new RequestContext();
		$context->setTitle( $page->getTitle() );
		$context->setUser( $actor );
		$context->setRequest( new FauxRequest() );
		$out = new OutputPage( $context );
		$out->setRevisionId( $revision );
		BoundSlideHooks::output( $out, $parsed, new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] ) );
		$this->assertSame( '', $out->getHTML() );
		$this->assertContains( 'ext.layers.history', $out->getModules() );
		$controls = $out->getJsConfigVars()['wgLayersCreationOverlays'];
		$this->assertCount( 2, $controls );
		foreach ( $controls as $entry ) {
			$this->assertSame( 'ABC', $entry['label'] );
			$this->assertNotEmpty( $entry['editUrl'] );
			$this->assertSame( [], $entry['preview']['layers'] );
		}
		$this->assertCount( 2, $parsed->getExtensionData( CreationOverlayControls::DATA_KEY ) );
		$this->assertSame( $shared, json_encode( $parsed->toJsonArray(), JSON_THROW_ON_ERROR ) );
	}
}
