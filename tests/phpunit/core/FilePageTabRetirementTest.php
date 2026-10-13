<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\UIHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * File-page navigation retires only at the native page-history cutover.
 * @covers \MediaWiki\Extension\Layers\Hooks\UIHooks
 * @group Database
 */
class FilePageTabRetirementTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;
	use IsolatedLocalRepoFixture;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	public static function provideFileKinds(): array {
		return [ 'image' => [ 'test-image.png', 1 ], 'PDF' => [ 'test-multipage.pdf', 2 ] ];
	}

	/** @dataProvider provideFileKinds */
	public function testMigratedOwnersKeepTheirEditorRouteWithoutFileTabs( string $asset, int $page ): void {
		$extension = pathinfo( $asset, PATHINFO_EXTENSION );
		$file = $this->upload( 'NavigationRetirement-' . wfRandomString( 8 ) . '.' . $extension, $asset );
		$this->saveSet( $file, 'ABC', 1, 'Owner navigation layer', $page );
		$migration = $this->pilot->newFilePageMigration();
		$migration->commit( $migration->plan( $file->getName(), $this->actor ), $this->actor );
		MigrationState::markComplete( $this->getDb() );
		$title = Title::makeTitle( NS_FILE, $file->getName() );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $title );
		$this->assertTrue( $revision->hasSlot( 'layers' ) );
		$original = $revision->getContent( 'layers' )->getText();
		$surface = json_decode( $original, true )['surfaces'][0];
		$viewer = $this->pilot->prepareBoundViewers( $title, $revision->getId(),
			[ 'v1:' . $title->getArticleID() . ':' . $surface['id'] ], $this->actor, true );
		$this->assertNotEmpty( reset( $viewer )['editUrl'] );
		$links = $this->navigationLinks();
		foreach ( [ false, true ] as $debug ) {
			$this->overrideConfigValue( 'LayersDebug', $debug );
			foreach ( [ false, true ] as $universal ) {
				$after = $links;
				$this->navigation( $title, $after, $universal );
				$this->assertSame( $links, $after, 'Completed migration preserves all other navigation links' );
			}
		}
		$this->assertSame( $original, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $revision->getId() )->getContent( 'layers' )->getText() );
	}

	public function testMissingMigratedSetNeverAddsNormalOrDebugTabs(): void {
		$file = $this->upload( 'NavigationEmpty-' . wfRandomString( 8 ) . '.png' );
		MigrationState::markComplete( $this->getDb() );
		foreach ( [ false, true ] as $debug ) {
			$this->overrideConfigValue( 'LayersDebug', $debug );
			$before = $this->navigationLinks();
			$after = $before;
			$this->navigation( $file->getTitle(), $after, true );
			$this->assertSame( $before, $after );
		}
	}

	public function testBeforeMigrationTheExistingTabAndOtherLinksRemainAvailable(): void {
		$this->overrideConfigValue( 'LayersDebug', false );
		$file = $this->upload( 'NavigationLegacy-' . wfRandomString( 8 ) . '.png' );
		$before = $this->navigationLinks();
		$after = $before;
		$this->navigation( $file->getTitle(), $after, true );
		$this->assertArrayHasKey( 'editlayers', $after['views'] );
		$this->assertStringContainsString( 'action=editlayers', $after['views']['editlayers']['href'] );
		unset( $after['views']['editlayers'] );
		$this->assertSame( $before, $after );
	}

	/** @return array Existing MediaWiki/other-extension links must stay byte-exact */
	private function navigationLinks(): array {
		return [ 'views' => [ 'view' => [ 'text' => 'Read' ], 'edit' => [ 'text' => 'Edit' ],
			'history' => [ 'text' => 'History' ] ], 'actions' => [ 'custom' => [ 'text' => 'Custom action' ] ] ];
	}

	/** @param Title $title @param array &$links @param bool $universal */
	private function navigation( Title $title, array &$links, bool $universal ): void {
		$context = new RequestContext();
		$context->setTitle( $title );
		$context->setUser( $this->actor );
		$context->setRequest( new FauxRequest( [ 'action' => 'editlayers', 'layersdebug' => '1' ] ) );
		if ( $universal ) {
			UIHooks::onSkinTemplateNavigation__Universal( $context->getSkin(), $links );
		} else {
			UIHooks::onSkinTemplateNavigation( $context->getSkin(), $links );
		}
	}
}
