<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\PageOwnedHistoryHooks;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Core's undo restores only the page text, so an edit that changed drawings gets a link per drawing instead.
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedHistoryHooks::onHistoryTools
 * @group Database
 * @group API
 */
class HistoryUndoToolsTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
		$this->setContentLang( 'en' );
		RequestContext::getMain()->setUser( $this->actor );
		RequestContext::getMain()->setLanguage( 'en' );
	}

	/**
	 * @param Title $title
	 * @param int $base
	 * @param callable $mutate Changes the decoded snapshot
	 * @param string|null $text New page text, or null to keep it
	 * @return int New revision
	 */
	private function publish( Title $title, int $base, callable $mutate, ?string $text = null ): int {
		$fixture = json_decode(
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			true
		);
		$mutate( $fixture );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => $base,
			'data' => json_encode( $fixture ) ];
		if ( $text !== null ) {
			$params['maintext'] = $text;
		}
		return $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layerspublish']['revid'];
	}

	/**
	 * @param int $newId
	 * @param int $oldId
	 * @param array $tools Tools core offers for the revision
	 * @return array Tools after the hook
	 */
	private function tools( int $newId, int $oldId, array $tools ): array {
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$hooks = new PageOwnedHistoryHooks( $this->pilot, $this->getServiceContainer()->getLinkRenderer() );
		$hooks->onHistoryTools( $lookup->getRevisionById( $newId ), $tools, $lookup->getRevisionById( $oldId ),
			$this->actor );
		return $tools;
	}

	public function testAnEditThatChangedADrawingOffersThatDrawingsEarlierVersionInsteadOfCoresUndo(): void {
		$title = Title::newFromText( 'History undo page' );
		$first = $this->publish( $title, 0, static function ( array &$s ) {
		}, 'Text' );
		$second = $this->publish( $title, $first, static function ( array &$s ) {
			$s['surfaces'][0]['layers'][0]['x'] = 222;
		} );

		$tools = $this->tools( $second, $first,
			[ 'mw-undo' => '<span>undo</span>', 'mw-rollback' => '<span>rollback</span>' ] );
		$this->assertArrayNotHasKey( 'mw-undo', $tools );
		$this->assertArrayHasKey( 'mw-rollback', $tools, 'other tools stay' );
		$ids = array_values( array_filter( array_keys( $tools ),
			static fn ( $k ) => str_starts_with( $k, 'layers-undo-' ) ) );
		$this->assertCount( 1, $ids );
		$link = $tools[$ids[0]];
		$this->assertStringContainsString( 'undo drawing: Welcome Slide', $link );
		$this->assertStringContainsString( 'ViewLayersPage', $link );
		$this->assertStringContainsString( 'revid=' . $first, $link, 'the version before the edit' );

		// An edit of the text alone keeps core's undo.
		$this->editPage( $title, 'Different text', '', NS_MAIN, $this->actor );
		$latest = $title->getLatestRevID( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST );
		$kept = $this->tools( $latest, $second, [ 'mw-undo' => '<span>undo</span>' ] );
		$this->assertSame( [ 'mw-undo' ], array_keys( $kept ) );
	}

	public function testAddedDrawingsOfferNoLinkAndReadersWithoutEditRightsNoneEither(): void {
		$title = Title::newFromText( 'History undo added' );
		$first = $this->publish( $title, 0, static function ( array &$s ) {
		}, 'Text' );
		$second = $this->publish( $title, $first, static function ( array &$s ) {
			$copy = $s['surfaces'][0];
			$copy['id'] = 'extra';
			$copy['label'] = 'Extra';
			$s['surfaces'][] = $copy;
		} );
		$tools = $this->tools( $second, $first, [ 'mw-undo' => '<span>undo</span>' ] );
		$this->assertSame( [], $tools, 'nothing of the added drawing existed before the edit' );

		RequestContext::getMain()->setUser( $this->getServiceContainer()->getUserFactory()->newAnonymous() );
		$this->overrideUserPermissions( RequestContext::getMain()->getUser(), [ 'read' ] );
		$this->assertSame( [], $this->tools( $second, $first, [ 'mw-undo' => '<span>undo</span>' ] ) );
	}
}
