<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\ParserOptions;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class BoundSlideHooksTest extends \MediaWikiIntegrationTestCase {
	public function testParserCachesOnlyIdentityAndOutputReadsExactAuthorizedRevision(): void {
		$this->overrideConfigValues( [ 'LayersSlidesEnable' => true, 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ 'BoundSlideAcceptance' ] ] );
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
		$pilot = new PageOwnedPilot( $s, true, [ $title->getPrefixedDBkey() ] );
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
		$bundle = $out->getJsConfigVars()['wgLayersBoundSlides'][$binding];
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
		$this->assertSame( $second, $readerOutput->getJsConfigVars()['wgLayersBoundSlides'][$binding]['revisionId'] );

		$out->sendCacheControl();
		$this->assertStringContainsString( 'no-store',
			$context->getRequest()->response()->getHeaders()['CACHE-CONTROL'] );
		$before = json_encode( $parsed->toJsonArray() );
		// A stale parser object cannot inject an old drawing into a different displayed revision.
		$mismatch = new OutputPage( $context );
		$mismatch->setRevisionId( $second );
		BoundSlideHooks::output( $mismatch, $parsed, $pilot );
		$this->assertSame( [], $mismatch->getJsConfigVars()['wgLayersBoundSlides'] );
		$this->assertNotContains( 'ext.layers.history', $mismatch->getModules() );
		$disabled = new OutputPage( $context );
		$disabled->setRevisionId( $first );
		BoundSlideHooks::output( $disabled, $parsed, new PageOwnedPilot( $s, false, [ $title->getPrefixedDBkey() ] ) );
		$this->assertSame( [], $disabled->getJsConfigVars()['wgLayersBoundSlides'] );
		$this->assertSame( $before, json_encode( $parsed->toJsonArray() ) );
		$deniedAuthority = $this->createMock( \MediaWiki\Permissions\Authority::class );
		$deniedAuthority->method( 'authorizeRead' )->willReturn( false );
		$deniedContext = new RequestContext();
		$deniedContext->setTitle( $title );
		$deniedContext->setAuthority( $deniedAuthority );
		$denied = new OutputPage( $deniedContext );
		$denied->setRevisionId( $first );
		BoundSlideHooks::output( $denied, $parsed, $pilot );
		$this->assertSame( [], $denied->getJsConfigVars()['wgLayersBoundSlides'] );
		$this->assertStringNotContainsString( 'PRIVATE_', json_encode( $denied->getJsConfigVars() ) );
	}
}
