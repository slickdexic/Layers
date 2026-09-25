<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageReadService
 * @group Database
 */
class PageReadBindingTest extends \MediaWikiIntegrationTestCase {
	public function testBindingReadsDisplayedRevisionAndNeverFallsBack(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$reader = new PageReadService( new PageHistoryAccess( $s->getRevisionLookup() ),
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ) );
		$page = $this->getExistingTestPage();
		$owner = $page->getTitle();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$binding = 'v1:' . $page->getId() . ':presentation';
		$first = $registered['publisher']->publish( $owner, $actor, $page->getLatest(), json_encode( $document ),
			'First bound drawing', new WikitextContent( '{{#Slide:Demo|layersbinding=' . $binding . '}}' ),
			$page->getId() );
		$document->surfaces[0]->layers[0]->text = 'Later drawing';
		$second = $registered['publisher']->publish(
			$owner, $actor, $first, json_encode( $document ), 'Update drawing' );
		$old = $reader->readBoundSurface( $owner, $first, $binding, $actor );
		$new = $reader->readBoundSurface( $owner, $second, $binding, $actor );
		$this->assertSame( $page->getId(), $old['pageId'] );
		$this->assertSame( $first, $old['revisionId'] );
		$this->assertSame( 'Visual ideas — 世界', $old['surface']['layers'][0]['text'] );
		$this->assertSame( 'Later drawing', $new['surface']['layers'][0]['text'] );
		$other = $this->getExistingTestPage( 'OtherBindingOwner' );
		$denied = $this->createMock( Authority::class );
		$denied->method( 'authorizeRead' )->willReturn( false );
		foreach ( [
			[ $owner, $second, 'v1:' . $page->getId() . ':missing', $actor ],
			[ $owner, $second, 'v1:' . $other->getId() . ':presentation', $actor ],
			[ $other->getTitle(), $first, 'v1:' . $other->getId() . ':presentation', $actor ],
			[ $owner, 0, $binding, $actor ],
			[ $owner, $first, 'invalid-private-value', $actor ],
			[ $owner, $first, $binding, $denied ]
		] as [ $target, $revision, $value, $authority ] ) {
			$this->assertUnavailable( static function () use ( $reader, $target, $revision, $value, $authority ) {
				$reader->readBoundSurface( $target, $revision, $value, $authority );
			} );
		}
		// Deleting the surface later cannot change the old view or resurrect it in the new view.
		$third = $registered['publisher']->publish( $owner, $actor, $second,
			'{"schemaVersion":1,"surfaces":[]}', 'Remove drawing' );
		$this->assertSame( $old, $reader->readBoundSurface( $owner, $first, $binding, $actor ) );
		$this->assertUnavailable( static function () use ( $reader, $owner, $third, $binding, $actor ) {
			$reader->readBoundSurface( $owner, $third, $binding, $actor );
		} );
		$this->assertUnavailable( static function () use ( $s, $owner, $first, $actor, $other ) {
			( new PageHistoryAccess( $s->getRevisionLookup() ) )->read( $owner, $first, $actor, $other->getId() );
		} );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => \MediaWiki\Revision\RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $first ] )->caller( __METHOD__ )->execute();
		$this->assertFalse( $actor->isAllowed( 'deletedtext' ) );
		$this->assertUnavailable( static function () use ( $reader, $owner, $first, $binding, $actor ) {
			$reader->readBoundSurface( $owner, $first, $binding, $actor );
		} );
	}

	/** @param callable $read */
	private function assertUnavailable( callable $read ): void {
		try {
			$read();
			$this->fail( 'Expected unavailable binding' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
			$this->assertNull( $e->getPrevious() );
		}
	}
}
