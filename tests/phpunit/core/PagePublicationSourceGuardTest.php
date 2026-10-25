<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Permissions\Authority;
use MediaWiki\Storage\PreparedUpdate;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Ordinary publication rechecks changed sources after the real native preparation boundary.
 * Repository availability is controlled; native page preparation/admission/commit are real.
 * @covers \MediaWiki\Extension\Layers\Revision\PagePublicationService
 * @group Database
 */
class PagePublicationSourceGuardTest extends \MediaWikiIntegrationTestCase {

	/** @return array Mutable source state, restricted actor, resolver and snapshot */
	private function fixture( string $kind ): array {
		$state = (object)[ 'read' => true, 'visible' => true, 'bytes' => true,
			'prepared' => false, 'finalReads' => 0 ];
		$actor = $this->getTestSysop()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
		$doc = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ) );
		$doc->surfaces = [ $doc->surfaces[$kind === 'pdf' ? 2 : 1] ];
		$surface = $doc->surfaces[0];
		$sourceTitle = $this->getServiceContainer()->getTitleFactory()->newFromText( $surface->source->fileTitle );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $actor );
		$authority->method( 'definitelyCan' )->willReturn( true );
		$authority->method( 'authorizeWrite' )->willReturn( true );
		$authority->method( 'isAllowed' )->willReturnCallback( static fn ( $right ) => $actor->isAllowed( $right ) );
		$authority->method( 'authorizeRead' )->willReturnCallback( static function ( $right, $title ) use (
			$state, $sourceTitle, $actor
		) {
			if ( $right === 'read' && $title->getNamespace() === NS_FILE &&
				$title->getDBkey() === $sourceTitle->getDBkey() ) {
				if ( $state->prepared ) {
					$state->finalReads++;
				}
				return $state->read;
			}
			return $actor->authorizeRead( $right, $title );
		} );
		$repo = $this->createMock( LocalRepo::class );
		$file = $this->createMock( File::class );
		$file->method( 'getRepo' )->willReturn( $repo );
		$file->method( 'getName' )->willReturn( $sourceTitle->getDBkey() );
		$file->method( 'getTimestamp' )->willReturn( $surface->source->timestamp );
		$file->method( 'getSha1' )->willReturn( $surface->source->sha1 );
		$file->method( 'getPath' )->willReturn( 'mwstore://controlled-publication/source' );
		$file->method( 'isVisible' )->willReturnCallback( static fn () => $state->visible );
		$file->method( 'isDeleted' )->willReturn( false );
		$file->method( 'getMediaType' )->willReturn( 'BITMAP' );
		$file->method( 'getMimeType' )->willReturn( 'application/pdf' );
		$file->method( 'pageCount' )->willReturn( 2 );
		$repo->method( 'findFile' )->willReturn( $file );
		$repo->method( 'fileExists' )->willReturnCallback( static fn () => $state->bytes );
		return [ $state, $authority, new SourceVersionResolver( $repo,
			$this->getServiceContainer()->getTitleFactory() ), $doc ];
	}

	private function publisher( SourceVersionResolver $sources, ?callable $afterPreparation = null
	): PagePublicationService {
		$services = $this->getServiceContainer();
		$context = TestingAdmissionRegistration::install( $this )['context'];
		$real = new PageRevisionWriter();
		$writer = $real;
		if ( $afterPreparation !== null ) {
			$writer = $this->createMock( PageRevisionWriter::class );
			$writer->expects( $this->once() )->method( 'save' )->willReturnCallback( static function (
				$updater, $base, $layers, $summary, $main, $saveInScope
			) use ( $real, $afterPreparation ) {
				return $real->save( $updater, $base, $layers, $summary, $main,
					static function ( PreparedUpdate $prepared, callable $commit ) use (
						$afterPreparation, $saveInScope
					) {
						$afterPreparation( $prepared );
						return $saveInScope( $prepared, $commit );
					} );
			} );
		}
		return new PagePublicationService( $services->getWikiPageFactory(),
			new PageHistoryAccess( $services->getRevisionLookup() ), $sources, $writer, $context );
	}

	/** @return array Complete ordinary-content fixture rows, excluding cache/session tables */
	private function contentState(): array {
		$this->runDeferredUpdates();
		$rows = [];
		foreach ( [ 'page' => 'page_id', 'revision' => 'rev_id', 'slots' => [ 'slot_revision_id', 'slot_role_id' ],
			'content' => 'content_id', 'text' => 'old_id', 'comment' => 'comment_id', 'change_tag' => 'ct_id' ]
			as $table => $order ) {
			$rows[$table] = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )->orderBy( $order )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$rows[$table][] = (array)$row;
			}
		}
		return $rows;
	}

	/** @return array */
	public static function provideRevocations(): array {
		$cases = [];
		foreach ( [ 'image', 'pdf' ] as $kind ) {
			foreach ( [ 'read', 'visible', 'bytes' ] as $condition ) {
				$cases["$kind-$condition"] = [ $kind, $condition ];
			}
		}
		return $cases;
	}

	/**
	 * @dataProvider provideRevocations
	 * @param string $kind
	 * @param string $condition
	 */
	public function testChangedSourceRevokedAfterPreparationCannotPublish( string $kind, string $condition ): void {
		[ $state, $actor, $sources, $doc ] = $this->fixture( $kind );
		$page = $this->getExistingTestPage();
		$before = $this->contentState();
		$publisher = $this->publisher( $sources, function ( PreparedUpdate $prepared ) use (
			$state, $condition, $page
		) {
			$this->assertSame( $page->getId(), $prepared->getPage()->getId() );
			$this->assertSame( 'layers-document', $prepared->getRawContent( 'layers' )->getModel() );
			$state->prepared = true;
			$state->$condition = false;
		} );
		$failure = null;
		try {
			$publisher->publish( $page->getTitle(), $actor, $page->getLatest(), json_encode( $doc ), 'Must refuse',
				null, $page->getId() );
		} catch ( PublicationException $error ) {
			$failure = $error;
		}
		$this->assertTrue( $state->prepared );
		$this->assertInstanceOf( PublicationException::class, $failure, 'A revoked changed source must refuse Save' );
		$this->assertSame( 'layers-source-unavailable', $failure->getMessage() );
		$this->assertGreaterThan( 0, $state->finalReads );
		$this->assertTrue( $actor->authorizeWrite( 'edit', $page->getTitle() ) );
		$this->assertSame( $before, $this->contentState(), 'Refusal preserves complete content/history rows' );
	}

	/** @dataProvider provideKinds */
	public function testAuthorizedChangedSourceIsRecheckedAndSaves( string $kind ): void {
		[ $state, $actor, $sources, $doc ] = $this->fixture( $kind );
		$page = $this->getExistingTestPage();
		$publisher = $this->publisher( $sources, static function () use ( $state ) {
			$state->prepared = true;
		} );
		$id = $publisher->publish( $page->getTitle(), $actor, $page->getLatest(), json_encode( $doc ), 'Save',
			null, $page->getId() );
		$this->assertGreaterThan( 0, $state->finalReads, 'Source admission follows actual native preparation' );
		$this->assertSame( $id, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	/** @return array */
	public static function provideKinds(): array {
		return [ [ 'image' ], [ 'pdf' ] ];
	}

	public function testUnavailableUnchangedInheritedSourceDoesNotBlockAnUnrelatedSlideEdit(): void {
		[ $state, $actor, $sources, $doc ] = $this->fixture( 'image' );
		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ) );
		$doc->surfaces[] = $fixture->surfaces[0];
		$page = $this->getExistingTestPage();
		$base = $this->publisher( $sources )->publish( $page->getTitle(), $actor, $page->getLatest(),
			json_encode( $doc ), 'Original' );
		$state->read = false;
		$doc->surfaces[1]->layers[0]->text = 'Changed slide only';
		$next = $this->publisher( $sources, static function () use ( $state ) {
			$state->prepared = true;
		} )
			->publish( $page->getTitle(), $actor, $base, json_encode( $doc ), 'Unrelated edit' );
		$this->assertSame( 0, $state->finalReads, 'Only changed surfaces require source admission' );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $next );
		$stored = json_decode( $revision->getContent( 'layers' )->getText() );
		$this->assertEquals( $doc->surfaces[0], $stored->surfaces[0] );
		$this->assertSame( 'Changed slide only', $stored->surfaces[1]->layers[0]->text );
	}

	public function testSpecializedCallerSourceRefusalRetainsItsExistingError(): void {
		[ , $actor, $sources, $doc ] = $this->fixture( 'image' );
		$page = $this->getExistingTestPage();
		$before = $this->contentState();
		try {
			$this->publisher( $sources )->publish( $page->getTitle(), $actor, $page->getLatest(),
				json_encode( $doc ), 'Refused', null, $page->getId(), null, static function () {
					throw new PublicationException( 'layers-revision-unavailable' );
				} );
			$this->fail( 'The stricter caller guard must remain effective' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-revision-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->contentState() );
	}
}
