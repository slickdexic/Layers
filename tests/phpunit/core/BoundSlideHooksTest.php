<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutputFlags;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class BoundSlideHooksTest extends \MediaWikiIntegrationTestCase {
	public function testNamedSlideShowsThePageDrawingOfThatNameOnly(): void {
		$this->overrideConfigValues( [ 'LayersSlidesEnable' => true, 'LayersPageDrawingNamespaces' => null ] );
		$registered = TestingAdmissionRegistration::install( $this );
		$page = $this->getExistingTestPage( 'BoundSlideNamed' );
		$title = $page->getTitle();
		$pageId = $page->getId();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$text = "{{#Slide: $pageId:welcome_slide }}";
		$revisionId = $registered['publisher']->publish( $title, $actor, $page->getLatest(),
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), 'Name a slide',
			new WikitextContent( $text ), $pageId );
		$parse = function ( string $wikitext ) use ( $title, $revisionId ) {
			return $this->getServiceContainer()->getParserFactory()->create()->parse( $wikitext, $title,
				ParserOptions::newFromAnon(), true, true, $revisionId );
		};
		$binding = "v1:$pageId:presentation";
		$parsed = $parse( $text );
		$this->assertStringContainsString( 'data-layers-binding="' . $binding . '"', $parsed->getRawText() );
		$this->assertSame( $revisionId,
			$parsed->getExtensionData( BoundSlideHooks::DATA_KEY )[$binding]['revisionId'] );
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), [ $title->getPrefixedDBkey() ] );
		$entries = $pilot->listBoundEditorSelections( $pageId, $revisionId, $actor );
		$this->assertCount( 1, $entries );
		// The link names the drawing, not the `<pageId>:<name>` reference written in the page.
		$this->assertSame( 'Welcome Slide', $entries[0]['label'] );
		$init = $pilot->prepareBoundEditor( $pageId, $revisionId, $entries[0]['params']['start'],
			$entries[0]['params']['expected'], $actor );
		$this->assertSame( 'presentation', $init['pageOwned']['surfaceId'] );
		$other = $pageId + 1000;
		foreach ( [
			"{{#Slide:$other:Welcome Slide}}" => true, "{{#Slide:$pageId:Missing}}" => true,
			// Malformed whatever the revision holds.
			"{{#Slide:0:Welcome Slide}}" => false
		] as $wikitext => $varies ) {
			$parsed = $parse( $wikitext );
			$this->assertStringNotContainsString( 'layers-bound-slide', $parsed->getRawText(), $wikitext );
			$this->assertStringNotContainsString( 'layers-slide-container', $parsed->getRawText(), $wikitext );
			$this->assertSame( $varies, $parsed->getOutputFlag( ParserOutputFlags::VARY_REVISION ), $wikitext );
		}
		// Before the revision exists, nothing is resolved and the output must vary by revision.
		$unsaved = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $title,
			ParserOptions::newFromAnon() );
		$this->assertStringNotContainsString( 'layers-bound-slide', $unsaved->getRawText() );
		$this->assertTrue( $unsaved->getOutputFlag( ParserOutputFlags::VARY_REVISION ) );
	}

	public function testParserCachesOnlyIdentityAndOutputReadsExactAuthorizedRevision(): void {
		$this->overrideConfigValues( [ 'LayersSlidesEnable' => true, 'LayersPageDrawingNamespaces' => null ] );
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$page = $this->getExistingTestPage( 'BoundSlideAcceptance' );
		$title = $page->getTitle();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$binding = 'v1:' . $page->getId() . ':presentation';
		$text = '{{#Slide:Demo|layersbinding=' . $binding . '}}';
		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$document->surfaces[0]->layers[0]->text = 'PRIVATE_OLD_DRAWING';
		$first = $registered['publisher']->publish( $title, $actor, $page->getLatest(), json_encode( $document ),
			'First', new WikitextContent( $text ), $page->getId() );
		$document->surfaces[0]->layers[0]->text = 'PRIVATE_NEW_DRAWING';
		$second = $registered['publisher']->publish( $title, $actor, $first, json_encode( $document ), 'Second' );
		$parser = $s->getParserFactory()->create();
		$parsed = $parser->parse( $text, $title, ParserOptions::newFromAnon(), true, true, $first );
		$this->assertStringContainsString( 'layers-bound-slide', $parsed->getRawText() );
		$this->assertStringNotContainsString( 'layers-slide-container', $parsed->getRawText() );
		$this->assertStringNotContainsString( 'PRIVATE_', json_encode( $parsed->toJsonArray() ) );
		$this->assertSame( $first, $parsed->getExtensionData( BoundSlideHooks::DATA_KEY )[$binding]['revisionId'] );
		$this->assertTrue( $parsed->getOutputFlag( ParserOutputFlags::VARY_REVISION ) );
		// A pre-save/edit-stash render has no revision ID and must not become canonical output.
		$unsaved = $s->getParserFactory()->create()->parse( $text, $title, ParserOptions::newFromAnon() );
		$this->assertStringNotContainsString( 'layers-bound-slide', $unsaved->getRawText() );
		$this->assertTrue( $unsaved->getOutputFlag( ParserOutputFlags::VARY_REVISION ) );
		$pilot = new PageOwnedPilot( $s, [ $title->getPrefixedDBkey() ] );
		$context = new RequestContext();
		$context->setTitle( $title );
		$context->setUser( $actor );
		$context->setRequest( new \MediaWiki\Request\FauxRequest() );
		$out = new OutputPage( $context );
		$out->setRevisionId( $first );
		$this->setTemporaryHook( 'OutputPageParserOutput', static function ( $output, $cached ) use ( $pilot ) {
			BoundSlideHooks::output( $output, $cached, $pilot );
		}, true );
		$out->addParserOutput( $parsed, ParserOptions::newFromAnon() );
		// The response carries identities only; each reader's browser fetches drawings via layersread.
		$this->assertArrayNotHasKey( 'wgLayersBoundSlides', $out->getJsConfigVars() );
		$this->assertStringNotContainsString( 'PRIVATE_', json_encode( $out->getJsConfigVars() ) . $out->getHTML() );
		$bundle = $pilot->prepareBoundViewers( $title, $first, [ $binding ], $actor )[$binding];
		$this->assertSame( $first, $bundle['revisionId'] );
		$this->assertSame( 'PRIVATE_OLD_DRAWING', $bundle['surface']['layers'][0]['text'] );
		$this->assertStringNotContainsString( 'PRIVATE_', json_encode( $parsed->toJsonArray() ) );
		$this->assertContains( 'ext.layers.history', $out->getModules() );
		$this->assertStringNotContainsString( 'layers-page-edit-link', $out->getHTML() );
		$currentParsed = $parser->parse( $text, $title, ParserOptions::newFromAnon(), true, true, $second );
		$current = new OutputPage( $context );
		$current->setRevisionId( $second );
		BoundSlideHooks::output( $current, $currentParsed, $pilot );
		$this->assertStringContainsString( 'layers-page-edit-link', $current->getHTML() );
		$this->assertStringContainsString( 'pageid=' . $page->getId(), $current->getHTML() );
		$this->assertStringContainsString( 'revid=' . $second, $current->getHTML() );
		$this->assertStringContainsString( 'start=0', $current->getHTML() );
		$this->assertStringContainsString( 'expected=', $current->getHTML() );
		$this->assertStringNotContainsString( 'layers-page-edit-link', json_encode( $currentParsed->toJsonArray() ) );
		// Even an explicit oldid pointing at latest remains a view-only history entry.
		$context->setRequest( new \MediaWiki\Request\FauxRequest( [ 'oldid' => (string)$second ] ) );
		$historical = new OutputPage( $context );
		$historical->setRevisionId( $second );
		BoundSlideHooks::output( $historical, $currentParsed, $pilot );
		$this->assertStringNotContainsString( 'layers-page-edit-link', $historical->getHTML() );
		$context->setRequest( new \MediaWiki\Request\FauxRequest() );
		$reader = $this->getTestUser( [ 'read' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$readerContext = new RequestContext();
		$readerContext->setTitle( $title );
		$readerContext->setUser( $reader );
		$readerContext->setRequest( new \MediaWiki\Request\FauxRequest() );
		$readerOutput = new OutputPage( $readerContext );
		$readerOutput->setRevisionId( $second );
		BoundSlideHooks::output( $readerOutput, $currentParsed, $pilot );
		$this->assertStringNotContainsString( 'layers-page-edit-link', $readerOutput->getHTML() );
		$this->assertContains( 'ext.layers.history', $readerOutput->getModules() );
		$this->assertSame( $second,
			$pilot->prepareBoundViewers( $title, $second, [ $binding ], $reader )[$binding]['revisionId'] );

		// Pages with bound slides stay as cacheable as any other page.
		$out->sendCacheControl();
		$this->assertStringNotContainsString( 'no-store',
			$context->getRequest()->response()->getHeaders()['CACHE-CONTROL'] );
		$before = json_encode( $parsed->toJsonArray() );
		// A stale parser object cannot inject an old drawing into a different displayed revision.
		$mismatch = new OutputPage( $context );
		$mismatch->setRevisionId( $second );
		BoundSlideHooks::output( $mismatch, $parsed, $pilot );
		$this->assertNotContains( 'ext.layers.history', $mismatch->getModules() );
		$this->assertSame( $before, json_encode( $parsed->toJsonArray() ) );
		$deniedAuthority = $this->createMock( \MediaWiki\Permissions\Authority::class );
		$deniedAuthority->method( 'authorizeRead' )->willReturn( false );
		$this->assertSame( [], $pilot->prepareBoundViewers( $title, $first, [ $binding ], $deniedAuthority ) );
	}

	/**
	 * Ordinary page markup must not remove page-owned editing, several bindings share one read,
	 * and a save cannot introduce content the historical viewer would refuse to draw.
	 */
	public function testRealisticPageKeepsEditEntriesAndSavesEveryLayerType(): void {
		$this->overrideConfigValues( [ 'LayersSlidesEnable' => true, 'LayersPageDrawingNamespaces' => null ] );
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$page = $this->getExistingTestPage( 'BoundSlideRealistic' );
		$title = $page->getTitle();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$document = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$appendix = json_decode( json_encode( $document->surfaces[0] ) );
		$appendix->id = 'appendix';
		$appendix->label = 'Appendix';
		$document->surfaces[] = $appendix;
		$first = 'v1:' . $page->getId() . ':' . $document->surfaces[0]->id;
		$second = 'v1:' . $page->getId() . ':appendix';
		$text = "Intro<br>See [https://example.test docs] and item[0].\n{{#Slide:Demo|layersbinding=$first}}\n" .
			"<div class=\"box\">{{#Slide:Appendix|layersbinding=$second}}</div>\n== Notes ==\n<references />";
		$revision = $registered['publisher']->publish( $title, $actor, $page->getLatest(), json_encode( $document ),
			'Bind two slides', new WikitextContent( $text ), $page->getId() );
		$pilot = new PageOwnedPilot( $s, [ $title->getPrefixedDBkey() ] );

		$entries = $pilot->listBoundEditorSelections( $page->getId(), $revision, $actor );
		$this->assertSame( [ 'Demo', 'Appendix' ], array_column( $entries, 'label' ) );
		$bundles = $pilot->prepareBoundViewers( $title, $revision,
			[ $first, $second, 'v1:2147483647:appendix', 'not-a-binding' ], $actor );
		$this->assertSame( [ $first, $second ], array_keys( $bundles ) );
		$this->assertSame( 'appendix', $bundles[$second]['surface']['id'] );

		// Page history draws markers, shapes, images and groups, so they save like any other layer.
		$document->surfaces[1]->layers[] = (object)[ 'id' => 'pin', 'type' => 'marker', 'x' => 10, 'y' => 10 ];
		$next = $registered['publisher']->publish( $title, $actor, $revision, json_encode( $document ), 'Add marker' );
		$this->assertGreaterThan( $revision, $next );
		$layers = $pilot->prepareBoundViewers( $title, $next, [ $second ], $actor )[$second]['surface']['layers'];
		$this->assertSame( [ 'pin', 'marker' ], [ end( $layers )['id'], end( $layers )['type'] ] );
	}
}
