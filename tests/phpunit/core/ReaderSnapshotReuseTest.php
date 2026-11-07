<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageHistoryAccess
 * @covers \MediaWiki\Extension\Layers\Revision\PageReadService
 * @group Database
 */
class ReaderSnapshotReuseTest extends RealAssetTestCase {
	public function testChangedContentBytesAreNotReusedForSameRevision(): void {
		$page = $this->getExistingTestPage();
		$surface = $this->makeSlideSurface();
		$first = new LayersDocumentContent( $this->buildDocument( [ $surface ] ) );
		$surface['layers'][0]['text'] = 'Different content';
		$second = new LayersDocumentContent( $this->buildDocument( [ $surface ] ) );
		$revision = $this->createMock( RevisionRecord::class );
		$revision->method( 'getPageId' )->willReturn( $page->getId() );
		$revision->method( 'hasSlot' )->willReturn( true );
		$revision->method( 'getVisibility' )->willReturn( 0 );
		$revision->method( 'getPage' )->willReturn( $page );
		$revision->method( 'getContent' )->willReturnOnConsecutiveCalls( $first, $second );
		$lookup = $this->createMock( RevisionLookup::class );
		$lookup->method( 'getRevisionById' )->willReturn( $revision );
		$access = new PageHistoryAccess( $lookup, true );
		$actor = $this->actor();
		$this->assertSame( $first, $access->read( $page->getTitle(), 123, $actor ) );
		$this->assertSame( $second, $access->read( $page->getTitle(), 123, $actor ) );
	}

	public function testDefaultAccessDoesNotReuseContent(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$json = $this->buildDocument( [ $this->makeSlideSurface() ] );
		$first = new LayersDocumentContent( $json );
		$second = new LayersDocumentContent( $json );
		$revision = $this->createMock( RevisionRecord::class );
		$revision->method( 'getPageId' )->willReturn( $page->getId() );
		$revision->method( 'hasSlot' )->willReturn( true );
		$revision->method( 'getVisibility' )->willReturn( 0 );
		$revision->method( 'getPage' )->willReturn( $page );
		$revision->method( 'getContent' )->willReturnOnConsecutiveCalls( $first, $second );
		$lookup = $this->createMock( RevisionLookup::class );
		$lookup->method( 'getRevisionById' )->willReturn( $revision );
		$access = new PageHistoryAccess( $lookup );
		$this->assertSame( $first, $access->read( $page->getTitle(), 123, $actor ) );
		$this->assertSame( $second, $access->read( $page->getTitle(), 123, $actor ) );
	}

	public function testCustomContentValidityIsAlwaysRechecked(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$content = new class( $this->buildDocument( [ $this->makeSlideSurface() ] ) ) extends LayersDocumentContent {
			public bool $allowed = true;
			public int $checks = 0;

			public function isReadable(): bool {
				$this->checks++;
				return $this->allowed && parent::isReadable();
			}
		};
		$revision = $this->createMock( RevisionRecord::class );
		$revision->method( 'getPageId' )->willReturn( $page->getId() );
		$revision->method( 'hasSlot' )->willReturn( true );
		$revision->method( 'getVisibility' )->willReturn( 0 );
		$revision->method( 'getPage' )->willReturn( $page );
		$revision->method( 'getContent' )->willReturn( $content );
		$lookup = $this->createMock( RevisionLookup::class );
		$lookup->method( 'getRevisionById' )->willReturn( $revision );
		$access = new PageHistoryAccess( $lookup, true );
		$this->assertSame( $content, $access->read( $page->getTitle(), 123, $actor ) );
		$content->allowed = false;
		try {
			$access->read( $page->getTitle(), 123, $actor );
			$this->fail( 'Custom content validity must not be reused.' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertSame( 2, $content->checks );
	}

	public function testReuseKeepsFreshAuthorizationAndDetachedSnapshots(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$surface = $this->makeSlideSurface();
		$id = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			$this->buildDocument( [ $surface ] ), 'Fixture', new WikitextContent( 'Fixture' ), $page->getId() );
		$state = (object)[ 'allowed' => true, 'checks' => 0 ];
		$authority = $this->createMock( Authority::class );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static function ( $right, $title ) use ( $actor, $state ) {
				$state->checks++;
				return $state->allowed && $actor->authorizeRead( $right, $title );
			} );
		$access = new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup(), true );
		$reader = new PageReadService( $access, $this->resolver );
		$first = $reader->read( $page->getTitle(), $id, $authority, $page->getId(), [ 'presentation' ] );
		$first['snapshot']['surfaces'][0]['layers'][0]['text'] = 'Client-side mutation';
		$second = $reader->read( $page->getTitle(), $id, $authority, $page->getId(), [ 'presentation' ] );
		$this->assertSame( 'Visual ideas — 世界', $second['snapshot']['surfaces'][0]['layers'][0]['text'] );
		$this->assertSame( 2, $state->checks );
		$state->allowed = false;
		try {
			$reader->read( $page->getTitle(), $id, $authority, $page->getId(), [ 'presentation' ] );
			$this->fail( 'A cached snapshot must not bypass a fresh owner permission check.' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertSame( 3, $state->checks );
		$state->allowed = true;
		$surface['layers'][0]['text'] = 'New revision';
		$newId = $this->publisher->publish( $page->getTitle(), $actor, $id,
			$this->buildDocument( [ $surface ] ), 'Updated fixture', null, $page->getId() );
		$new = $reader->read( $page->getTitle(), $newId, $authority, $page->getId(), [ 'presentation' ] );
		$this->assertSame( 'New revision', $new['snapshot']['surfaces'][0]['layers'][0]['text'] );
		$old = $reader->read( $page->getTitle(), $id, $authority, $page->getId(), [ 'presentation' ] );
		$this->assertSame( 'Visual ideas — 世界', $old['snapshot']['surfaces'][0]['layers'][0]['text'] );
	}
}
