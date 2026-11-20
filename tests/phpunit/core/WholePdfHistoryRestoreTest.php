<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageSurfaceRestore;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageSurfaceRestore
 * @group Database
 */
class WholePdfHistoryRestoreTest extends RealAssetTestCase {

	private function fixture( string $mode = 'removed-member' ): array {
		$title = $this->getNonexistingTestPage()->getTitle();
		$actor = $this->actor();
		$name = 'File:History-restore-' . wfRandomString( 8 ) . '.pdf';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $name );
		$first = $this->makePdfSurface( 'first', 'ABC', $name, $file->getTimestamp(), $file->getSha1(), 1 );
		$second = $this->makePdfSurface( 'second', 'ABC', $name, $file->getTimestamp(), $file->getSha1(), 2 );
		foreach ( [ &$first, &$second ] as &$surface ) {
			$surface['layers'] = [ [ 'id' => 'note', 'type' => 'text', 'x' => 20, 'y' => 30,
				'text' => 'Saved ' . $surface['id'], 'fontSize' => 24 ] ];
			$surface['readingOrder'] = [ 'note' ];
		}
		unset( $surface );
		$slide = $this->makeSlideSurface( 'unrelated', 'ABC' );
		$other = $first;
		$other['id'] = 'other-set';
		$other['label'] = 'Other';
		$otherName = 'File:Independent-history-' . wfRandomString( 8 ) . '.pdf';
		$otherFile = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $otherName );
		$independent = $this->makePdfSurface( 'other-file', 'ABC', $otherName,
			$otherFile->getTimestamp(), $otherFile->getSha1(), 1 );
		$group = $mode === 'current-only-member' ? [ $first ] : [ $second, $first ];
		$historical = array_merge( $group, [ $slide, $other, $independent ] );
		$saved = $this->publisher->publish( $title, $actor, 0, $this->buildDocument( $historical ), 'Saved PDF',
			new WikitextContent( 'Earlier owner text' ) );
		$slide['layers'][0]['text'] = 'Keep later unrelated edits';
		$other['layers'][0]['text'] = 'Keep later independent PDF set';
		$currentGroup = [ $first ];
		$selected = 'second';
		if ( $mode === 'removed-set' ) {
			$currentGroup = [];
		} elseif ( $mode === 'unchanged-selected-member' ) {
			$second['layers'][0]['text'] = 'Changed page two only';
			$currentGroup[] = $second;
			$selected = 'first';
		} elseif ( $mode === 'current-only-member' ) {
			$currentGroup[] = $second;
			$selected = 'first';
		} elseif ( $mode === 'regenerated-ids' ) {
			$currentGroup[0]['id'] = 'replacement-first';
		}
		$currentSurfaces = array_merge( [ $slide ], $currentGroup, [ $other, $independent ] );
		$current = $this->publisher->publish( $title, $actor, $saved, $this->buildDocument( $currentSurfaces ),
			'Rollback PDF work', new WikitextContent( 'Keep current owner text' ) );
		$s = $this->getServiceContainer();
		$restore = new PageSurfaceRestore( PageOwnedScope::newFromServices( $s, [ $title->getPrefixedDBkey() ] ),
			$s->getTitleFactory(), $s->getRevisionLookup(), $this->publisher );
		return [ 'title' => $title, 'actor' => $actor, 'restore' => $restore, 'saved' => $saved,
			'current' => $current, 'selected' => $selected, 'group' => $group,
			'unrelated' => [ $slide, $other, $independent ] ];
	}

	private function revisionCount( $title ): int {
		return (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->where( [ 'rev_page' => $title->getArticleID() ] )->caller( __METHOD__ )->fetchField();
	}

	private function snapshot( int $revision ): array {
		$record = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
		$surfaces = [];
		foreach ( json_decode( $record->getContent( 'layers' )->getText() )->surfaces as $surface ) {
			$surfaces[$surface->id] = $surface;
		}
		return [ $record->getContent( 'main' )->getText(), JsonSnapshotCodec::encode( $surfaces ) ];
	}

	/** @dataProvider provideRestoreCases */
	public function testCompleteSetRestoresInOneRevisionAndKeepsCurrentUnrelatedContent( string $mode ): void {
		$f = $this->fixture( $mode );
		$owner = $f['title']->getPrefixedText();
		$before = $this->revisionCount( $f['title'] );
		$historyBefore = $this->snapshot( $f['saved'] );
		$offer = $f['restore']->prepare( $owner, $f['saved'], $f['selected'], $f['actor'] );
		$this->assertNotNull( $offer, 'A missing or unchanged selected member must not hide a differing PDF set' );
		$this->assertSame( [ 'ABC', $f['current'] ], [ $offer['label'], $offer['baseRevisionId'] ] );
		$this->assertSame( $before, $this->revisionCount( $f['title'] ) );
		$restored = $f['restore']->restore( $owner, $f['saved'], $f['selected'], $f['current'], $f['actor'],
			'Restore whole PDF' );
		$this->assertSame( $before + 1, $this->revisionCount( $f['title'] ) );
		$expected = [];
		foreach ( array_merge( $f['group'], $f['unrelated'] ) as $surface ) {
			$expected[$surface['id']] = $surface;
		}
		$this->assertSame( [ 'Keep current owner text', JsonSnapshotCodec::encode( $expected ) ],
			$this->snapshot( $restored ) );
		$this->assertSame( $f['current'], $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $restored )->getParentId() );
		$this->assertSame( $historyBefore, $this->snapshot( $f['saved'] ) );
		$this->assertNull( $f['restore']->prepare( $owner, $f['saved'], $f['selected'], $f['actor'] ) );
		try {
			$f['restore']->restore( $owner, $f['saved'], $f['selected'], $restored, $f['actor'], 'Repeat' );
			$this->fail( 'An identical PDF set must not produce a redundant revision' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-restore-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before + 1, $this->revisionCount( $f['title'] ) );
	}

	public static function provideRestoreCases(): array {
		return array_map( static fn ( $mode ) => [ $mode ], [ 'removed-member', 'removed-set',
			'unchanged-selected-member', 'current-only-member', 'regenerated-ids' ] );
	}

	public function testEquivalentPdfMemberOrderDoesNotOfferRedundantRestoreWithNumericIds(): void {
		$f = $this->fixture();
		$group = array_reverse( $f['group'] );
		$group[0]['id'] = '0';
		$group[1]['id'] = '1';
		$saved = $this->publisher->publish( $f['title'], $f['actor'], $f['current'],
			$this->buildDocument( array_merge( $group, $f['unrelated'] ) ), 'Numeric PDF IDs' );
		$current = $this->publisher->publish( $f['title'], $f['actor'], $saved,
			$this->buildDocument( array_merge( array_reverse( $group ), $f['unrelated'] ) ), 'Reordered PDF members' );
		$count = $this->revisionCount( $f['title'] );
		$this->assertNull( $f['restore']->prepare( $f['title']->getPrefixedText(), $saved, '0', $f['actor'] ) );
		$this->assertSame( $count, $this->revisionCount( $f['title'] ) );
		$this->assertSame( $current, $f['title']->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	public function testStaleFormCannotPublishOrDiscardLaterWork(): void {
		$f = $this->fixture();
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $f['current'] );
		$newer = $this->publisher->publish( $f['title'], $f['actor'], $f['current'],
			$current->getContent( 'layers' )->getText(), 'Later text edit', new WikitextContent( 'Newer owner text' ) );
		$before = $this->snapshot( $newer );
		$count = $this->revisionCount( $f['title'] );
		try {
			$f['restore']->restore( $f['title']->getPrefixedText(), $f['saved'], 'second', $f['current'],
				$f['actor'], 'Stale restore' );
			$this->fail( 'A stale form must not publish' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-edit-conflict', $error->getMessage() );
		}
		$this->assertSame( $count, $this->revisionCount( $f['title'] ) );
		$this->assertSame( $before, $this->snapshot( $newer ) );
		$this->assertSame( $newer, $f['title']->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	public function testRenamedMemberIdentityCannotOverwriteAnotherSet(): void {
		$f = $this->fixture();
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $f['current'] );
		$doc = json_decode( $current->getContent( 'layers' )->getText() );
		foreach ( $doc->surfaces as $surface ) {
			if ( $surface->id === 'first' ) {
				$surface->label = 'Renamed';
			}
		}
		$renamed = $this->publisher->publish( $f['title'], $f['actor'], $f['current'], json_encode( $doc ), 'Rename' );
		$count = $this->revisionCount( $f['title'] );
		$owner = $f['title']->getPrefixedText();
		$this->assertNull( $f['restore']->prepare( $owner, $f['saved'], 'second', $f['actor'] ) );
		try {
			$f['restore']->restore( $owner, $f['saved'], 'second', $renamed, $f['actor'], 'Restore' );
			$this->fail( 'Conflicting retained IDs must not rename or replace unrelated content' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-restore-unavailable', $error->getMessage() );
		}
		$this->assertSame( $count, $this->revisionCount( $f['title'] ) );
		$this->assertSame( $renamed, $f['title']->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	public function testHiddenHistoryAndDeniedReadersHaveNoRestoreOffer(): void {
		$f = $this->fixture();
		$owner = $f['title']->getPrefixedText();
		$reader = $this->createMock( Authority::class );
		$reader->method( 'getUser' )->willReturn( $f['actor']->getUser() );
		$reader->method( 'definitelyCan' )->willReturn( false );
		$this->assertNull( $f['restore']->prepare( $owner, $f['saved'], 'second', $reader ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )->where( [ 'rev_id' => $f['saved'] ] )
			->caller( __METHOD__ )->execute();
		$this->assertNull( $f['restore']->prepare( $owner, $f['saved'], 'second', $f['actor'] ) );
		$this->assertSame( $f['current'], $f['title']->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	public function testSourceReadRefusalPreservesTheCompleteCurrentSnapshot(): void {
		$f = $this->fixture();
		$restricted = $this->createMock( Authority::class );
		$restricted->method( 'getUser' )->willReturn( $f['actor']->getUser() );
		$restricted->method( 'definitelyCan' )->willReturn( true );
		$restricted->method( 'authorizeRead' )->willReturnCallback(
			static fn ( $right, $title ): bool => $title->getNamespace() !== NS_FILE );
		$before = $this->snapshot( $f['current'] );
		$count = $this->revisionCount( $f['title'] );
		try {
			$f['restore']->restore( $f['title']->getPrefixedText(), $f['saved'], 'second', $f['current'],
				$restricted, 'Source refused' );
			$this->fail( 'A restored page must pass exact-source admission' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-source-unavailable', $error->getMessage() );
		}
		$this->assertSame( $count, $this->revisionCount( $f['title'] ) );
		$this->assertSame( $before, $this->snapshot( $f['current'] ) );
	}
}
