<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\PageOwnedDiffHooks;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use MediaWikiIntegrationTestCase;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Diff pages show each changed drawing before and after, as identity-only hosts.
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedDiffHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageDrawingDiff
 * @group Database
 */
class PageOwnedDiffHooksTest extends MediaWikiIntegrationTestCase {
	/**
	 * @param array $texts Surface ID => text of its first layer
	 * @return string
	 */
	private function document( array $texts ): string {
		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$surfaces = [];
		foreach ( $texts as $id => $text ) {
			$surface = json_decode( json_encode( $fixture->surfaces[0] ) );
			$surface->id = $id;
			$surface->label = ucfirst( $id );
			$surface->layers[0]->text = $text;
			$surfaces[] = $surface;
		}
		return json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] );
	}

	/** @return array [ title, revisions, editor ] */
	private function history(): array {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null ] );
		$publisher = TestingAdmissionRegistration::install( $this )['publisher'];
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$revisions = [];
		$base = 0;
		foreach ( [
			[ [ 'map' => 'one', 'notes' => 'one' ], 'Text' ],
			[ [ 'map' => 'two', 'notes' => 'one' ], 'Text' ],
			[ [ 'map' => 'two', 'notes' => 'one' ], 'Text changed' ],
			[ [ 'map' => 'two', 'extra' => 'new' ], 'Text changed' ]
		] as [ $texts, $main ] ) {
			$base = $publisher->publish( $title, $editor, $base, $this->document( $texts ), 'Step',
				new WikitextContent( $main ) );
			$revisions[] = $base;
		}
		return [ $title, $revisions, $editor ];
	}

	private function diff( Title $title, int $old, int $new, User $viewer ): string {
		$context = new RequestContext();
		$context->setTitle( $title );
		$context->setUser( $viewer );
		$context->setLanguage( 'qqx' );
		$engine = new \DifferenceEngine( $context, $old, $new );
		$engine->loadRevisionData();
		( new PageOwnedDiffHooks( $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' ) ) )
			->onDifferenceEngineShowDiff( $engine );
		return $context->getOutput()->getHTML();
	}

	public function testChangedDrawingsAreShownBeforeAndAfter(): void {
		[ $title, [ $first, $second, $third, $fourth ], $editor ] = $this->history();
		$pageId = $title->getArticleID();

		$html = $this->diff( $title, $first, $second, $editor );
		$this->assertStringContainsString( '(layers-page-diff-heading)', $html );
		$this->assertSame( 2, substr_count( $html, 'data-layers-binding="v1:' . $pageId . ':map"' ) );
		$this->assertStringContainsString( 'data-layers-revision="' . $first . '"', $html );
		$this->assertStringContainsString( 'data-layers-revision="' . $second . '"', $html );
		$this->assertStringNotContainsString( ':notes"', $html );
		$this->assertStringNotContainsString( 'Visual ideas', $html );

		// A text-only edit changes no drawing.
		$this->assertStringNotContainsString( 'layers-drawing-diff', $this->diff( $title, $second, $third, $editor ) );

		$html = $this->diff( $title, $third, $fourth, $editor );
		$this->assertStringContainsString( '(layers-page-diff-removed: Notes)', $html );
		$this->assertStringContainsString( '(layers-page-diff-added: Extra)', $html );
		$this->assertStringContainsString( 'data-layers-binding="v1:' . $pageId . ':notes" data-layers-revision="' .
			$third . '"', $html );
		$this->assertStringContainsString( 'data-layers-binding="v1:' . $pageId . ':extra" data-layers-revision="' .
			$fourth . '"', $html );
		$this->assertStringNotContainsString( ':map"', $html );
	}

	public function testHiddenDrawingsAreNotCompared(): void {
		[ $title, [ $first, $second ] ] = $this->history();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )->where( [ 'rev_id' => $first ] )
			->caller( __METHOD__ )->execute();
		$reader = $this->getTestUser( [ 'reader' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$this->assertStringNotContainsString( 'layers-drawing-diff', $this->diff( $title, $first, $second, $reader ) );
	}
}
