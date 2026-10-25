<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Request\FauxRequest;
use RequestContext;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage
 * @group Database
 */
class SpecialEditLayersPageImageTest extends RealAssetTestCase {
	public function testRealImageOwnerReturnAndSavePreservation(): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:J114L1_Return.png' );
		$actor = $this->actor();
		$page = $this->getNonexistingTestPage();
		$title = $page->getTitle();
		$surface = $this->makeImageSurface( 'annotation', 'ABC', 'File:J114L1_Return.png',
			$file->getTimestamp(), $file->getSha1() );
		$revisionId = $this->publisher->publish( $title, $actor, 0,
			$this->buildDocument( [ $surface ] ), 'Disposable return fixture', new WikitextContent( 'Image owner' ) );
		$text = '[[File:J114L1_Return.png|layersbinding=v1:' . $title->getArticleID() . ':annotation]]';
		$revisionId = $this->publisher->publish( $title, $actor, $revisionId,
			$this->buildDocument( [ $surface ] ), 'Bind disposable image', new WikitextContent( $text ) );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$this->setService( 'RepoGroup', $repos );
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), [ $title->getPrefixedDBkey() ] );
		$routes = [
			[ 'owner' => $title->getPrefixedText(), 'surface' => 'annotation', 'revid' => 'current' ],
			[ 'owner' => $title->getPrefixedDBkey(), 'surface' => 'annotation', 'revid' => (string)$revisionId ],
			[ 'pageid' => (string)$title->getArticleID(), 'revid' => (string)$revisionId,
				'start' => '0', 'expected' => $text ],
		];
		$execute = function ( array $params ) use ( $pilot, $actor ): array {
			$context = new RequestContext();
			$context->setAuthority( $actor );
			$specialTitle = $this->getServiceContainer()->getTitleFactory()->newFromText( 'Special:EditLayersPage' );
			$context->setTitle( $specialTitle );
			$context->setRequest( new FauxRequest( $params + [ 'returnto' => 'https://external.invalid/' ] ) );
			$entry = new SpecialEditLayersPage( $pilot );
			$entry->setContext( $context );
			$entry->execute( null );
			return $context->getOutput()->getJsConfigVars();
		};
		foreach ( $routes as $route ) {
			$config = $execute( $route );
			$this->assertArrayHasKey( 'wgLayersEditorInit', $config, json_encode( $route ) );
			$this->assertSame( $title->getPrefixedText(), $config['wgLayersEditorInit']['filename'] );
			$this->assertFalse( $config['wgLayersEditorInit']['isSlide'] );
			$this->assertStringContainsString( 'J114L1_Return.png', $config['wgLayersEditorInit']['imageUrl'] );
			$this->assertSame( 'annotation', $config['wgLayersEditorInit']['pageOwned']['surfaceId'] );
			$this->assertSame( $title->getLocalURL(), $config['wgLayersReturnToUrl'] );
			$this->assertSame( $revisionId, $config['wgLayersEditorInit']['pageOwned']['revisionId'] );
		}
		$surface['layers'] = [ [ 'id' => 'saved-layer', 'type' => 'rectangle',
			'x' => 25, 'y' => 30, 'width' => 80, 'height' => 40, 'fill' => '#ff0000' ] ];
		$savedId = $this->publisher->publish( $title, $actor, $revisionId,
			$this->buildDocument( [ $surface ] ), 'Save disposable layer' );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $savedId );
		$expectedLayers = $surface['layers'];
		ksort( $expectedLayers[0] );
		$saved = json_decode( $revision->getContent( 'layers' )->getText(), true );
		$this->assertSame( $expectedLayers, $saved['surfaces'][0]['layers'] );
		$this->assertSame( $text, $revision->getContent( 'main' )->getText() );
		$this->assertSame( $title->getLocalURL(), $execute( $routes[0] )['wgLayersReturnToUrl'] );
		foreach ( [ $routes[1], array_replace( $routes[2], [ 'expected' => 'wrong embed' ] ),
			array_replace( $routes[2], [ 'pageid' => '01' ] ) ] as $route ) {
			$config = $execute( $route );
			$this->assertArrayNotHasKey( 'wgLayersEditorInit', $config );
			$this->assertArrayNotHasKey( 'wgLayersReturnToUrl', $config );
		}
		$this->overrideUserPermissions( $actor->getUser(), [ 'read' ] );
		$config = $execute( $routes[0] );
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $config );
		$this->assertArrayNotHasKey( 'wgLayersReturnToUrl', $config );
	}
}
