<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Action\EditLayersAction;
use MediaWiki\Extension\Layers\Hooks\UIHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\SpecialPages\SpecialEditSlide;
use MediaWiki\Extension\Layers\SpecialPages\SpecialSlides;
use MediaWiki\Page\Article;
use MediaWiki\Page\ImagePage;
use MediaWiki\Request\FauxRequest;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;
use MediaWiki\User\User;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * After the migration the legacy entry points lead to page-owned drawings, never to a shared-set editor.
 * @covers \MediaWiki\Extension\Layers\Migration\FilePageDrawings
 * @covers \MediaWiki\Extension\Layers\Action\EditLayersAction
 * @covers \MediaWiki\Extension\Layers\Hooks\UIHooks
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialEditSlide
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialSlides
 * @group Database
 */
class LegacyEntryPointsAfterMigrationTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	/**
	 * @param Title $title
	 * @param User $user
	 * @param array $params
	 * @return RequestContext
	 */
	private function context( Title $title, User $user, array $params = [] ): RequestContext {
		$context = new RequestContext();
		$context->setTitle( $title );
		$context->setUser( $user );
		$request = new FauxRequest( $params );
		$request->setRequestURL( '/index.php' );
		$context->setRequest( $request );
		$context->setLanguage( 'en' );
		return $context;
	}

	/**
	 * @param Title $title
	 * @param array $params
	 * @return \MediaWiki\Output\OutputPage
	 */
	private function editLayers( Title $title, array $params = [] ) {
		$context = $this->context( $title, $this->actor, [ 'action' => 'editlayers' ] + $params );
		( new EditLayersAction( Article::newFromTitle( $title, $context ), $context ) )->show();
		return $context->getOutput();
	}

	/**
	 * @param Title $title
	 * @param User $user
	 * @return string The File page's Layers section
	 */
	private function section( Title $title, User $user ): string {
		$page = new ImagePage( $title );
		$page->setContext( $this->context( $title, $user ) );
		$html = '';
		UIHooks::onImagePageAfterImageLinks( $page, $html );
		return $html;
	}

	/**
	 * @param Title $title
	 * @return bool Whether the File page has the Edit layers tab
	 */
	private function hasTab( Title $title ): bool {
		$links = [ 'views' => [ 'view' => [], 'edit' => [] ], 'actions' => [] ];
		UIHooks::onSkinTemplateNavigation( $this->context( $title, $this->actor )->getSkin(), $links );
		return isset( $links['views']['editlayers'] );
	}

	public function testTheFilePageLeadsToItsOwnDrawings(): void {
		$image = $this->upload( 'Entry_photo.png' );
		$this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$this->saveSet( $image, 'labels', 1, 'Labels' );
		$plain = $this->upload( 'Plain_photo.png' );
		$title = $image->getTitle();

		$this->assertStringContainsString( 'setname=anatomy', $this->section( $title, $this->actor ) );
		$this->assertTrue( $this->hasTab( $plain->getTitle() ) );
		$this->assertSame( '', $this->editLayers( $title, [ 'setname' => 'anatomy' ] )->getRedirect() );

		$files = $this->pilot->newFilePageMigration();
		$files->commit( $files->plan( $image->getName(), $this->actor ), $this->actor );
		MigrationState::markComplete( $this->getDb() );
		// A new request: titles do not remember the revision before the migration.
		$title = Title::makeTitle( NS_FILE, $image->getName() );
		$ids = array_column( $this->surfaces( $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $title ) ), 'id', 'label' );
		$editor = static fn ( string $id ) => SpecialPage::getTitleFor( 'EditLayersPage' )->getLocalURL( [
			'owner' => $title->getPrefixedDBkey(), 'revid' => 'current', 'surface' => $id ] );

		// The legacy editor opens the File page's drawing of that name, or lists them when it cannot tell.
		$this->assertSame( $editor( $ids['anatomy'] ), $this->editLayers( $title, [ 'setname' => 'anatomy' ] )
			->getRedirect() );
		$listed = $this->editLayers( $title );
		$this->assertSame( '', $listed->getRedirect() );
		$this->assertStringContainsString( htmlspecialchars( $editor( $ids['labels'] ) ), $listed->getHTML() );
		$this->assertStringContainsString( 'moved into page history', $listed->getHTML() );
		$none = $this->editLayers( $plain->getTitle() );
		$this->assertSame( '', $none->getRedirect() );
		$this->assertStringContainsString( 'has no layer sets', $none->getHTML() );

		// The section lists the page's drawings with viewer links, and edit links for editors only.
		$section = $this->section( $title, $this->actor );
		$this->assertStringNotContainsString( 'setname=', $section );
		$this->assertStringContainsString( '>anatomy</a>', $section );
		$this->assertStringContainsString( 'ViewLayersPage', $section );
		$this->assertStringContainsString( htmlspecialchars( $editor( $ids['anatomy'] ) ), $section );
		$this->assertStringContainsString( 'layerset=' . $title->getArticleID() . ':name', $section );
		$this->assertStringNotContainsString( 'EditLayersPage',
			$this->section( $title, $this->getServiceContainer()->getUserFactory()->newAnonymous() ) );
		$this->assertSame( '', $this->section( $plain->getTitle(), $this->actor ) );

		// The tab stays where there are drawings to open.
		$this->assertTrue( $this->hasTab( $title ) );
		$this->assertFalse( $this->hasTab( $plain->getTitle() ) );
	}

	public function testSharedSlidePagesLeadToTheSlidesPage(): void {
		$this->saveSlide( 'Entry_deck', 'default', 'Deck' );
		$slides = $this->pilot->newSlidePageMigration();
		$slides->commit( $slides->plan( 'Entry_deck' ), $this->actor );
		MigrationState::markComplete( $this->getDb() );

		$run = function ( SpecialPage $special, string $subPage ) {
			$context = $this->context( SpecialPage::getTitleFor( $special->getName(), $subPage ), $this->actor );
			$special->setContext( $context );
			$special->execute( $subPage );
			return $context->getOutput();
		};
		$this->assertSame( Title::newFromText( 'Slide:Entry_deck' )->getLocalURL(),
			$run( new SpecialEditSlide(), 'Entry_deck' )->getRedirect() );
		$missing = $run( new SpecialEditSlide(), 'Never_shown' );
		$this->assertSame( '', $missing->getRedirect() );
		$this->assertStringContainsString( 'To make a new slide', $missing->getHTML() );
		$this->assertSame( SpecialPage::getTitleFor( 'EditSlide', 'Never_shown' )->getLocalURL(),
			$run( new SpecialSlides(), 'Never_shown' )->getRedirect() );
		$list = $run( new SpecialSlides(), '' );
		$this->assertStringContainsString( 'To make a new slide', $list->getHTML() );
		$this->assertStringNotContainsString( 'layers-slides-create-btn', $list->getHTML() );
		$this->assertFalse( $list->getJsConfigVars()['wgLayersSlidesConfig']['canCreate'] );
	}
}
