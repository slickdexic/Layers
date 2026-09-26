<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Revision\RevisionRecord;
use MediaWikiIntegrationTestCase;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Native rollback restores a page's own earlier drawings; nothing else can change them outside publication.
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageDrawingRevert
 * @group Database
 */
class PageOwnedRollbackTest extends MediaWikiIntegrationTestCase {
	private const EMPTY = '{"schemaVersion":1,"surfaces":[]}';

	/**
	 * @dataProvider provideRollbackCases
	 * @param string $kind
	 */
	public function testNativeRollback( string $kind ): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$page = $this->getNonexistingTestPage();
		$title = $page->getTitle();
		$first = $this->getTestUser()->getUser();
		$second = $this->getTestUser( [ 'sysop' ] )->getUser();
		$this->overrideUserPermissions( $first, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk',
			'rollback' ] );
		if ( $kind === 'remove' ) {
			$updater = $page->newPageUpdater( $first );
			$updater->setContent( 'main', new WikitextContent( 'Original text' ) );
			$base = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Before adoption' ) )->getId();
		} else {
			$base = $registered['publisher']->publish( $title, $first, 0, self::EMPTY,
				'Original snapshot', new WikitextContent( 'Original text' ) );
		}
		$snapshot = $kind === 'main-only' ? self::EMPTY :
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$this->overrideUserPermissions( $second, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
		$current = $registered['publisher']->publish( $title, $second, $base, $snapshot,
			'Newer edit', new WikitextContent( 'Changed text' ) );
		if ( $kind === 'without-editlayers' ) {
			$this->overrideUserPermissions( $first, [ 'read', 'edit', 'createpage', 'createtalk', 'rollback' ] );
		}
		$count = $this->revisionCount();
		$page = $s->getWikiPageFactory()->newFromTitle( $title );
		$status = $s->getRollbackPageFactory()->newRollbackPage( $page, $first, $second )
			->rollbackIfAllowed();
		$restored = in_array( $kind, [ 'main-only', 'replace' ], true );
		$this->assertSame( $restored, $status->isOK(), json_encode( $status->getErrors() ) );
		$latest = $s->getRevisionLookup()->getRevisionByTitle( $title );
		$this->assertTrue( $latest->hasSlot( 'layers' ) );
		if ( $restored ) {
			$this->assertGreaterThan( $current, $latest->getId() );
			$this->assertSame( 'Original text', $latest->getContent( 'main' )->serialize() );
			$this->assertSame( self::EMPTY, $latest->getContent( 'layers' )->serialize() );
		} else {
			$this->assertTrue( $status->hasMessage( $kind === 'remove' ?
				'layers-slot-removal-denied' : 'layers-admission-unauthorized' ) );
			$this->assertSame( $current, $latest->getId() );
			$this->assertSame( 'Changed text', $latest->getContent( 'main' )->serialize() );
			$this->assertSame( $count, $this->revisionCount() );
		}
	}

	/** @return array */
	public static function provideRollbackCases(): array {
		return [ [ 'remove' ], [ 'replace' ], [ 'main-only' ], [ 'without-editlayers' ] ];
	}

	public function testAnotherPagesDrawingsCannotBeInherited(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$other = $this->getNonexistingTestPage()->getTitle();
		$foreign = $registered['publisher']->publish( $other, $actor, 0,
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), 'Other drawing',
			new WikitextContent( 'Other page' ) );
		$title = $this->getNonexistingTestPage()->getTitle();
		$base = $registered['publisher']->publish( $title, $actor, 0, self::EMPTY, 'Own drawing',
			new WikitextContent( 'Own page' ) );
		$updater = $s->getWikiPageFactory()->newFromTitle( $title )->newPageUpdater( $actor );
		$updater->inheritSlot( $s->getRevisionLookup()->getRevisionById( $foreign )->getSlot( 'layers' ) );
		$this->assertNull( $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Borrow' ) ) );
		$this->assertTrue( $updater->getStatus()->hasMessage( 'layers-admission-unauthorized' ) );
		$this->assertSame( $base, $title->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	public function testHiddenDrawingsCannotBeRestored(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$title = $this->getNonexistingTestPage()->getTitle();
		$hidden = $registered['publisher']->publish( $title, $actor, 0,
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), 'Later hidden',
			new WikitextContent( 'Text' ) );
		$current = $registered['publisher']->publish( $title, $actor, $hidden, self::EMPTY, 'Replaced' );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )->where( [ 'rev_id' => $hidden ] )
			->caller( __METHOD__ )->execute();
		$updater = $s->getWikiPageFactory()->newFromTitle( $title )->newPageUpdater( $actor );
		$updater->inheritSlot( $s->getRevisionLookup()->getRevisionById( $hidden )->getSlot( 'layers',
			RevisionRecord::RAW ) );
		$this->assertNull( $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Unhide' ) ) );
		$this->assertTrue( $updater->getStatus()->hasMessage( 'layers-admission-unauthorized' ) );
		$this->assertSame( $current, $title->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	private function revisionCount(): int {
		return (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();
	}
}
