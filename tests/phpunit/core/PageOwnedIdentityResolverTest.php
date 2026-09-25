<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver
 * @group Database
 */
class PageOwnedIdentityResolverTest extends \MediaWikiIntegrationTestCase {
	private function resolver(): PageOwnedIdentityResolver {
		$s = $this->getServiceContainer();
		return new PageOwnedIdentityResolver( $s->getTitleFactory(), $s->getRevisionLookup(),
			new PageHistoryAccess( $s->getRevisionLookup() ) );
	}

	public function testFollowsNativeMoveWithoutFollowingOldTitleRedirect(): void {
		$s = $this->getServiceContainer();
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$old = $page->getTitle();
		$new = $this->getNonexistingTestPage()->getTitle();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'move', 'createpage' ] );
		$this->assertSame( $id, $this->resolver()->resolveForEdit( $id, $page->getLatest(), $actor )->getArticleID() );
		$status = $s->getMovePageFactory()->newMovePage( $old, $new )->moveIfAllowed( $actor, 'Identity test' );
		$this->assertTrue( $status->isOK(), json_encode( $status->getErrors() ) );
		$revision = $s->getRevisionLookup()->getRevisionByTitle( $new );
		$resolved = $this->resolver()->resolveForEdit( $id, $revision->getId(), $actor );
		$this->assertSame( $new->getPrefixedDBkey(), $resolved->getPrefixedDBkey() );
		$this->assertSame( $id, $resolved->getArticleID() );
		$redirect = $s->getRevisionLookup()->getRevisionByTitle( $old );
		$this->assertNotSame( $id, $redirect->getPageId() );
		$this->expectExceptionMessage( 'layers-owner-unavailable' );
		$this->resolver()->resolveForEdit( $redirect->getPageId(), $revision->getId(), $actor );
	}

	public function testRejectsAnotherPagesRevision(): void {
		$page = $this->getExistingTestPage();
		$other = $this->getExistingTestPage( 'Other binding owner' );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$this->expectExceptionMessage( 'layers-owner-unavailable' );
		$this->resolver()->resolveForEdit( $page->getId(), $other->getLatest(), $actor );
	}

	public function testRejectsStaleBaseAfterOrdinaryTextEdit(): void {
		$page = $this->getExistingTestPage();
		$base = $page->getLatest();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$this->editPage( $page, 'A later main-text edit' );
		$this->expectExceptionMessage( 'layers-edit-conflict' );
		$this->resolver()->resolveForEdit( $page->getId(), $base, $actor );
	}

	public function testRequiresLayersPermissionEvenBeforeAdoption(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit' ] );
		$this->expectExceptionMessage( 'layers-owner-unavailable' );
		$this->resolver()->resolveForEdit( $page->getId(), $page->getLatest(), $actor );
	}
}
