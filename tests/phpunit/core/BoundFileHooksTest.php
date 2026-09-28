<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutputFlags;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * `[[File:X|layersbinding=…]]` marks core's image with the binding; drawings arrive per reader.
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundFileHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class BoundFileHooksTest extends \MediaWikiIntegrationTestCase {
	/** @var string Per-test upload; the file backend outlives the database rollback */
	private $file;

	/** @return array [ title, page ID, revision ID, page text, actor ] */
	private function boundImagePage( string $key ): array {
		$this->file = str_replace( '_owner', '', $key ) . '.png';
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ $key ] ] );
		$registered = TestingAdmissionRegistration::install( $this );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$fileTitle = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:' . $this->file );
		$file = $this->getServiceContainer()->getRepoGroup()->getLocalRepo()->newFile( $fileTitle );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-image.png', 'Fixture', '',
			0, false, '20260906120000', $this->getTestSysop()->getUser() ) );
		$page = $this->getExistingTestPage( $key );
		$title = $page->getTitle();
		$pageId = $title->getArticleID( IDBAccessObject::READ_LATEST );
		$document = [ 'schemaVersion' => 1, 'surfaces' => [ [
			'id' => 'photo', 'kind' => 'image', 'label' => 'Photo',
			'canvas' => [ 'width' => 1, 'height' => 1, 'backgroundColor' => '#ffffff', 'backgroundVisible' => true,
				'backgroundOpacity' => 1 ],
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 0, 'y' => 0, 'text' => 'Bound note' ] ],
			'readingOrder' => [ 'note' ],
			'source' => [ 'repository' => 'local', 'fileTitle' => 'File:' . $this->file,
				'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => 1 ]
		] ] ];
		$text = "Intro\n\n[[File:{$this->file}|120px|layersbinding=v1:$pageId:photo|A caption]]";
		$revisionId = $registered['publisher']->publish( $title, $actor, $page->getLatest(), json_encode( $document ),
			'Bind image', new WikitextContent( $text ), $pageId );
		return [ $title, $pageId, $revisionId, $text, $actor ];
	}

	public function testBoundImageIsMarkedAndItsDrawingIsServedWithTheExactRendition(): void {
		[ $title, $pageId, $revisionId, $text, $actor ] = $this->boundImagePage( 'Bound_file_embed_owner' );
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $title,
			ParserOptions::newFromAnon(), true, true, $revisionId );
		$html = $parsed->getRawText();
		$binding = "v1:$pageId:photo";
		$this->assertMatchesRegularExpression( '/<img [^>]*class="[^"]*layers-bound-file[^"]*"/', $html );
		$this->assertStringContainsString( 'data-layers-binding="' . $binding . '"', $html );
		$this->assertStringContainsString( 'data-layers-revision="' . $revisionId . '"', $html );
		$this->assertStringNotContainsString( 'layersbinding', $html );
		$this->assertStringNotContainsString( 'Bound note', $html );
		$this->assertStringNotContainsString( 'data-layer-data', $html );
		$this->assertStringContainsString( 'A caption', $html );
		$this->assertTrue( $parsed->getOutputFlag( ParserOutputFlags::VARY_REVISION ) );
		$this->assertSame( $revisionId,
			$parsed->getExtensionData( BoundSlideHooks::DATA_KEY )[$binding]['revisionId'] );
		$this->assertContains( 'ext.layers.history', $parsed->getModules() );

		$pilot = new PageOwnedPilot( $this->getServiceContainer(), true, [ $title->getPrefixedDBkey() ] );
		$bundle = $pilot->prepareBoundViewers( $title, $revisionId, [ $binding ], $actor )[$binding];
		$this->assertSame( 'image', $bundle['surface']['kind'] );
		$this->assertSame( 'Bound note', $bundle['surface']['layers'][0]['text'] );
		$this->assertStringContainsString( $this->file, $bundle['source']['url'] );
	}

	public function testFileEmbedOpensItsImageSurfaceInImageModeOnly(): void {
		[ $title, $pageId, $revisionId, $text, $actor ] = $this->boundImagePage( 'Bound_file_editor_owner' );
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), true, [ $title->getPrefixedDBkey() ] );
		$entries = $pilot->listBoundEditorSelections( $pageId, $revisionId, $actor );
		$this->assertCount( 1, $entries );
		$this->assertSame( $this->file, $entries[0]['label'] );
		$params = $entries[0]['params'];
		$this->assertSame( strpos( $text, '[[File:' ), $params['start'] );
		$init = $pilot->prepareBoundEditor( $pageId, $revisionId, $params['start'], $params['expected'], $actor );
		$this->assertFalse( $init['isSlide'] );
		$this->assertSame( [ 1, 1 ], [ $init['baseWidth'], $init['baseHeight'] ] );
		$this->assertStringContainsString( $this->file, $init['imageUrl'] );
		$this->assertSame( 'photo', $init['pageOwned']['surfaceId'] );
		$this->assertArrayNotHasKey( 'canvasWidth', $init );
		// A slide embed bound to the same image surface is not an entry to it.
		$slideText = "{{#Slide:Photo|layersbinding=v1:$pageId:photo}}";
		$slideRevision = $this->editPage( $title, $slideText )->getNewRevision()->getId();
		$this->assertSame( [], $pilot->listBoundEditorSelections( $pageId, $slideRevision, $actor ) );
		try {
			$pilot->prepareBoundEditor( $pageId, $slideRevision, 0, $slideText, $actor );
			$this->fail( 'A slide embed must not open an image surface' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}
	}

	public function testNamedEmbedShowsThePageDrawingOfThatNameOnly(): void {
		[ $title, $pageId, , , $actor ] = $this->boundImagePage( 'Bound_file_named_owner' );
		$text = "Intro\n\n[[File:{$this->file}|120px|layerset=$pageId:photo|A caption]]";
		$revisionId = $this->editPage( $title, $text )->getNewRevision()->getId();
		$parse = function ( string $wikitext ) use ( $title, $revisionId ) {
			return $this->getServiceContainer()->getParserFactory()->create()->parse( $wikitext, $title,
				ParserOptions::newFromAnon(), true, true, $revisionId );
		};
		$parsed = $parse( $text );
		$html = $parsed->getRawText();
		$this->assertStringContainsString( 'data-layers-binding="v1:' . $pageId . ':photo"', $html );
		$this->assertStringContainsString( 'data-layers-revision="' . $revisionId . '"', $html );
		$this->assertStringContainsString( 'A caption', $html );
		$this->assertStringNotContainsString( 'layerset', $html );
		$this->assertTrue( $parsed->getOutputFlag( ParserOutputFlags::VARY_REVISION ) );

		$pilot = new PageOwnedPilot( $this->getServiceContainer(), true, [ $title->getPrefixedDBkey() ] );
		$entries = $pilot->listBoundEditorSelections( $pageId, $revisionId, $actor );
		$this->assertCount( 1, $entries );
		$init = $pilot->prepareBoundEditor( $pageId, $revisionId, $entries[0]['params']['start'],
			$entries[0]['params']['expected'], $actor );
		$this->assertSame( 'photo', $init['pageOwned']['surfaceId'] );
		$this->assertSame( [], $pilot->listAdoptionCandidates( $pageId, $revisionId, $actor ) );

		$other = $pageId + 1000;
		foreach ( [
			"[[File:{$this->file}|120px|layerset=$other:Photo]]",
			"[[File:{$this->file}|120px|layerset=$pageId:Missing]]",
			"[[File:{$this->file}|120px|layerset=0:Photo]]",
			"[[File:{$this->file}|120px|layerset=$pageId:Photo|layersbinding=v1:$pageId:photo]]"
		] as $wikitext ) {
			$html = $parse( $wikitext )->getRawText();
			$this->assertStringContainsString( '<img ', $html, $wikitext );
			$this->assertStringNotContainsString( 'layers-bound-file', $html, $wikitext );
			$this->assertStringNotContainsString( 'data-layer', $html, $wikitext );
			$this->assertStringNotContainsString( 'layerset', $html, $wikitext );
		}
	}

	public function testRefusedBindingShowsThePlainImageWithoutAnyDrawing(): void {
		[ $title, $pageId, $revisionId ] = $this->boundImagePage( 'Bound_file_refused_owner' );
		$other = $pageId + 1000;
		foreach ( [
			"[[File:{$this->file}|120px|layersbinding=v1:$other:photo]]",
			"[[File:{$this->file}|120px|layersbinding=not-a-binding]]",
			"[[File:{$this->file}|120px|layersbinding=]]"
		] as $text ) {
			$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $title,
				ParserOptions::newFromAnon(), true, true, $revisionId );
			$html = $parsed->getRawText();
			$this->assertStringContainsString( '<img ', $html, $text );
			$this->assertStringNotContainsString( 'layers-bound-file', $html, $text );
			$this->assertStringNotContainsString( 'data-layers-binding', $html, $text );
			$this->assertStringNotContainsString( 'data-layer', $html, $text );
			$this->assertStringNotContainsString( 'layersbinding', $html, $text );
		}
		// Outside the pilot scope the binding is refused the same way.
		$this->overrideConfigValue( 'LayersPageOwnedPilotOwners', [] );
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse(
			"[[File:{$this->file}|120px|layersbinding=v1:$pageId:photo]]", $title,
			ParserOptions::newFromAnon(), true, true, $revisionId );
		$this->assertStringNotContainsString( 'layers-bound-file', $parsed->getRawText() );
	}
}
