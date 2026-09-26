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
	/** @return array [ title, page ID, revision ID, page text, actor ] */
	private function boundImagePage( string $key ): array {
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ $key ] ] );
		$registered = TestingAdmissionRegistration::install( $this );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$fileTitle = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:Bound_file_embed.png' );
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
			'source' => [ 'repository' => 'local', 'fileTitle' => 'File:Bound_file_embed.png',
				'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => 1 ]
		] ] ];
		$text = "Intro\n\n[[File:Bound_file_embed.png|120px|layersbinding=v1:$pageId:photo|A caption]]";
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
		$this->assertStringContainsString( 'Bound_file_embed.png', $bundle['source']['url'] );
	}

	public function testFileEmbedOpensItsImageSurfaceInImageModeOnly(): void {
		[ $title, $pageId, $revisionId, $text, $actor ] = $this->boundImagePage( 'Bound_file_editor_owner' );
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), true, [ $title->getPrefixedDBkey() ] );
		$entries = $pilot->listBoundEditorSelections( $pageId, $revisionId, $actor );
		$this->assertCount( 1, $entries );
		$this->assertSame( 'Bound_file_embed.png', $entries[0]['label'] );
		$params = $entries[0]['params'];
		$this->assertSame( strpos( $text, '[[File:' ), $params['start'] );
		$init = $pilot->prepareBoundEditor( $pageId, $revisionId, $params['start'], $params['expected'], $actor );
		$this->assertFalse( $init['isSlide'] );
		$this->assertSame( [ 1, 1 ], [ $init['baseWidth'], $init['baseHeight'] ] );
		$this->assertStringContainsString( 'Bound_file_embed.png', $init['imageUrl'] );
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

	public function testRefusedBindingShowsThePlainImageWithoutAnyDrawing(): void {
		[ $title, $pageId, $revisionId ] = $this->boundImagePage( 'Bound_file_refused_owner' );
		$other = $pageId + 1000;
		foreach ( [
			"[[File:Bound_file_embed.png|120px|layersbinding=v1:$other:photo]]",
			'[[File:Bound_file_embed.png|120px|layersbinding=not-a-binding]]',
			'[[File:Bound_file_embed.png|120px|layersbinding=]]'
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
			"[[File:Bound_file_embed.png|120px|layersbinding=v1:$pageId:photo]]", $title,
			ParserOptions::newFromAnon(), true, true, $revisionId );
		$this->assertStringNotContainsString( 'layers-bound-file', $parsed->getRawText() );
	}
}
