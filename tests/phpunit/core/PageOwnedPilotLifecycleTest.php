<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotLifecycleHooks;
use MediaWikiIntegrationTestCase;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotLifecycleHooks
 * @group Database
 */
class PageOwnedPilotLifecycleTest extends MediaWikiIntegrationTestCase {
	/**
	 * @dataProvider provideMoveCases
	 * @param string $scope
	 */
	public function testNativeMoveScope( string $scope ): void {
		$s = $this->getServiceContainer();
		$page = $this->getExistingTestPage();
		$old = $page->getTitle();
		$new = $this->getNonexistingTestPage()->getTitle();
		$id = $page->getId();
		$keys = [ $scope === 'destination' ? $new->getPrefixedDBkey() :
			$old->getPrefixedDBkey() . ( $scope === 'ordinary' ? '_other' : '' ) ];
		$this->setTemporaryHook( 'MovePageIsValidMove', new PageOwnedPilotLifecycleHooks(
			$s->getTitleFactory(), $keys
		), true );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'move', 'createpage', 'createtalk' ] );
		$status = $s->getMovePageFactory()->newMovePage( $old, $new )
			->moveIfAllowed( $actor, 'Pilot scope test' );
		$this->assertSame( $scope === 'ordinary', $status->isOK(), json_encode( $status->getErrors() ) );
		if ( $scope !== 'ordinary' ) {
			$this->assertTrue( $status->hasMessage( 'layers-admission-unauthorized' ) );
		}
		$key = $this->getDb()->newSelectQueryBuilder()->select( 'page_title' )->from( 'page' )
			->where( [ 'page_id' => $id ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $scope === 'ordinary' ? $new->getDBkey() : $old->getDBkey(), $key );
	}

	/** @return array */
	public static function provideMoveCases(): array {
		return [ [ 'source' ], [ 'destination' ], [ 'ordinary' ] ];
	}

	/**
	 * @dataProvider provideRestoreCases
	 * @param bool $scoped
	 * @param bool $partial
	 */
	public function testNativeRestoreScope( bool $scoped, bool $partial ): void {
		$s = $this->getServiceContainer();
		$page = $this->getExistingTestPage();
		$title = $page->getTitle();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor,
			[ 'read', 'edit', 'editlayers', 'delete', 'undelete', 'createpage', 'createtalk' ] );
		if ( $scoped ) {
			$registered = TestingAdmissionRegistration::install( $this );
			$registered['publisher']->publish( $title, $actor, $page->getLatest(),
				'{"schemaVersion":1,"surfaces":[]}', 'Pilot revision' );
		}
		$revision = $s->getRevisionLookup()->getRevisionByTitle( $title );
		$id = $revision->getId();
		$page = $s->getWikiPageFactory()->newFromTitle( $title );
		$deleted = $s->getDeletePageFactory()->newDeletePage( $page, $actor )
			->deleteUnsafe( 'Lifecycle test' );
		$this->assertTrue( $deleted->isOK(), json_encode( $deleted->getErrors() ) );
		$this->runDeferredUpdates();
		$this->setTemporaryHook( 'PageUndelete', new PageOwnedPilotLifecycleHooks(
			$s->getTitleFactory(), [ $title->getPrefixedDBkey() . ( $scoped ? '' : '_other' ) ]
		), true );
		$restore = $s->getUndeletePageFactory()->newUndeletePage( $page, $actor );
		if ( $partial ) {
			$restore->setUndeleteOnlyTimestamps( [ $revision->getTimestamp() ] );
		}
		$status = $restore->undeleteIfAllowed( 'Restore lifecycle test' );
		$this->assertSame( !$scoped, $status->isOK(), json_encode( $status->getErrors() ) );
		$live = $this->getDb()->newSelectQueryBuilder()->select( 'rev_id' )->from( 'revision' )
			->where( [ 'rev_id' => $id ] )->caller( __METHOD__ )->fetchField();
		$archived = $this->getDb()->newSelectQueryBuilder()->select( 'ar_rev_id' )->from( 'archive' )
			->where( [ 'ar_rev_id' => $id ] )->caller( __METHOD__ )->fetchField();
		if ( $scoped ) {
			$this->assertTrue( $status->hasMessage( 'layers-admission-unauthorized' ) );
			$this->assertFalse( $live );
			$this->assertSame( $id, (int)$archived );
		} else {
			$this->assertSame( $id, (int)$live );
			$this->assertFalse( $archived );
		}
	}

	/** @return array */
	public static function provideRestoreCases(): array {
		return [ 'pilot all' => [ true, false ], 'pilot partial' => [ true, true ],
			'ordinary all' => [ false, false ], 'ordinary partial' => [ false, true ] ];
	}
}
