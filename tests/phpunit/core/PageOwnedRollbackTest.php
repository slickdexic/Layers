<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWikiIntegrationTestCase;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks
 * @group Database
 */
class PageOwnedRollbackTest extends MediaWikiIntegrationTestCase {
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
		foreach ( [ $first, $second ] as $actor ) {
			$this->overrideUserPermissions( $actor,
				[ 'read', 'edit', 'editlayers', 'createpage', 'createtalk', 'rollback' ] );
		}
		$empty = '{"schemaVersion":1,"surfaces":[]}';
		if ( $kind === 'remove' ) {
			$updater = $page->newPageUpdater( $first );
			$updater->setContent( 'main', new WikitextContent( 'Original text' ) );
			$base = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Before adoption' ) )->getId();
		} else {
			$base = $registered['publisher']->publish( $title, $first, 0, $empty,
				'Original snapshot', new WikitextContent( 'Original text' ) );
		}
		$snapshot = $kind === 'replace' ?
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) : $empty;
		$current = $registered['publisher']->publish( $title, $second, $base, $snapshot,
			'Newer edit', new WikitextContent( 'Changed text' ) );
		$count = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();
		$page = $s->getWikiPageFactory()->newFromTitle( $title );
		$status = $s->getRollbackPageFactory()->newRollbackPage( $page, $first, $second )
			->rollbackIfAllowed();
		$this->assertSame( $kind === 'main-only', $status->isOK(), json_encode( $status->getErrors() ) );
		$latest = $s->getRevisionLookup()->getRevisionByTitle( $title );
		$this->assertTrue( $latest->hasSlot( 'layers' ) );
		if ( $kind === 'main-only' ) {
			$this->assertGreaterThan( $current, $latest->getId() );
			$this->assertSame( 'Original text', $latest->getContent( 'main' )->serialize() );
			$this->assertSame( $empty, $latest->getContent( 'layers' )->serialize() );
		} else {
			$this->assertTrue( $status->hasMessage( $kind === 'remove' ?
				'layers-slot-removal-denied' : 'layers-admission-unauthorized' ) );
			$this->assertSame( $current, $latest->getId() );
			$this->assertSame( 'Changed text', $latest->getContent( 'main' )->serialize() );
			$this->assertSame( $count, $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
				->from( 'revision' )->caller( __METHOD__ )->fetchField() );
		}
	}

	/** @return array */
	public static function provideRollbackCases(): array {
		return [ [ 'remove' ], [ 'replace' ], [ 'main-only' ] ];
	}
}
