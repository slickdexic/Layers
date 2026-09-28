<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Revision\DirectAdoptionPreparationService;
use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\LegacyAdoptionPreparationService;
use MediaWiki\Extension\Layers\Revision\LegacyMediaResolver;
use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedAdoptionService;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\LegacyAdoptionPreparationService
 * @group Database
 */
class LegacyAdoptionPreparationServiceTest extends \MediaWikiIntegrationTestCase {
	private function directService( LayersDatabase $legacy ): DirectAdoptionPreparationService {
		$s = $this->getServiceContainer();
		return new DirectAdoptionPreparationService(
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $s->getRevisionLookup(),
				new PageHistoryAccess( $s->getRevisionLookup() ) ),
			$s->getRevisionLookup(), $s->getTitleFactory(), $this->service( $legacy ) );
	}

	/** @covers \MediaWiki\Extension\Layers\Revision\DirectAdoptionPreparationService */
	public function testDirectPreparationAndAtomicPublicationPreserveOtherOccurrence(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$page = $this->getExistingTestPage();
		$embed = '{{#Slide:WelcomePresentation|layerset=default|width=400}}';
		$prefix = "Unicode café\n" . $embed . "\nSecond: ";
		$text = $prefix . $embed . "\nUntouched suffix";
		$this->editPage( $page, $text );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->once() )->method( 'getLayerSetForAdoption' )->with( 202 )->willReturn( $this->row() );
		$result = $this->directService( $legacy )->prepare(
			$page->getId(), $base, strlen( $prefix ), $embed, 202, null, $actor );
		$this->assertSame( $prefix . '{{#Slide:' . $page->getId() . ':WelcomePresentation|width=400}}' .
			"\nUntouched suffix", $result['main']->getText() );
		$this->assertSame( 'WelcomePresentation', json_decode( $result['document'] )->surfaces[0]->label );
		$this->assertSame( $base, $lookup->getRevisionByTitle( $page->getTitle() )->getId() );
		$this->assertSame( $text, $lookup->getRevisionById( $base )->getContent( 'main' )->getText() );
		$this->assertFalse( json_decode( $result['document'] )->surfaces[0]->canvas->backgroundVisible );
		$s = $this->getServiceContainer();
		$adoption = new PageOwnedAdoptionService(
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $lookup, new PageHistoryAccess( $lookup ) ),
			$lookup, $registered['publisher'] );
		$id = $adoption->publishPreparedSurface( $page->getId(), $base, $actor,
			$result['document'], $result['main'], 'Adopt selected drawing' );
		$revision = $lookup->getRevisionById( $id );
		$this->assertGreaterThan( $base, $id );
		$this->assertSame( $base, $revision->getParentId() );
		$this->assertSame( $page->getId(), $revision->getPageId() );
		$this->assertSame( $actor->getId(), $revision->getUser()->getId() );
		$this->assertSame( $result['main']->getText(), $revision->getContent( 'main' )->getText() );
		$this->assertEquals( json_decode( $result['document'] ),
			json_decode( $revision->getContent( PageRevisionWriter::SLOT )->getText() ) );
		$this->assertSame( $text, $lookup->getRevisionById( $base )->getContent( 'main' )->getText() );
		$this->assertFalse( $lookup->getRevisionById( $base )->hasSlot( PageRevisionWriter::SLOT ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Revision\DirectAdoptionPreparationService
	 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedAdoptionService
	 */
	public function testCompetingPreparedAdoptionsRejectStaleBaseAndSucceedOnRenewedSelection(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$page = $this->getExistingTestPage();
		$embed = '{{#Slide:WelcomePresentation|layerset=default|width=400}}';
		$prefix = "Unicode café — 世界\n";
		$separator = "\nBetween slides: café ☕ — 宇宙\n";
		$suffix = "\nUntouched suffix: 🌟";
		$text = $prefix . $embed . $separator . $embed . $suffix;
		$this->editPage( $page, $text );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();
		$countRevisions = fn () => (int)$this->getDb()->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->where( [ 'rev_page' => $page->getId() ] )
			->caller( __METHOD__ )->fetchField();
		$initialCount = $countRevisions();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );

		$start1 = strlen( $prefix );
		$start2 = strlen( $prefix . $embed . $separator );
		$this->assertSame( $embed, substr( $text, $start1, strlen( $embed ) ) );
		$this->assertSame( $embed, substr( $text, $start2, strlen( $embed ) ) );

		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->exactly( 3 ) )->method( 'getLayerSetForAdoption' )
			->with( 202 )->willReturn( $this->row() );
		$legacy->expects( $this->never() )->method( 'getLatestLayerSet' );
		$direct = $this->directService( $legacy );

		// 1. Prepare two proposals against same base, one per occurrence, selecting same immutable legacy row
		$proposal1 = $direct->prepare( $page->getId(), $base, $start1, $embed, 202, null, $actor );
		$proposal2 = $direct->prepare( $page->getId(), $base, $start2, $embed, 202, null, $actor );

		$this->assertNotSame( $proposal1['surfaceId'], $proposal2['surfaceId'] );
		$this->assertNotSame( $proposal1['binding'], $proposal2['binding'] );
		$this->assertMatchesRegularExpression( '/^surface_[a-f0-9]{32}$/D', $proposal1['surfaceId'] );
		$this->assertMatchesRegularExpression( '/^surface_[a-f0-9]{32}$/D', $proposal2['surfaceId'] );
		$this->assertSame( $base, $lookup->getRevisionByTitle( $page->getTitle() )->getId() );
		$this->assertSame( $text, $lookup->getRevisionById( $base )->getContent( 'main' )->getText() );
		$this->assertFalse( $lookup->getRevisionById( $base )->hasSlot( PageRevisionWriter::SLOT ) );

		$this->assertSame( $initialCount, $countRevisions() );

		// 2. Publish the first through PageOwnedAdoptionService::publishPreparedSurface
		$s = $this->getServiceContainer();
		$adoption = new PageOwnedAdoptionService(
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $lookup, new PageHistoryAccess( $lookup ) ),
			$lookup, $registered['publisher'] );
		$rev1Id = $adoption->publishPreparedSurface(
			$page->getId(), $base, $actor,
			$proposal1['document'], $proposal1['main'], 'Adopt first slide' );
		$this->assertGreaterThan( $base, $rev1Id );
		$this->assertSame( $initialCount + 1, $countRevisions() );
		$rev1 = $lookup->getRevisionById( $rev1Id );
		$this->assertSame( $base, $rev1->getParentId() );
		$this->assertSame( $page->getId(), $rev1->getPageId() );
		$this->assertSame( $actor->getId(), $rev1->getUser()->getId() );

		$expectedRev1Main = $prefix . '{{#Slide:' . $page->getId() . ':WelcomePresentation|width=400}}' .
			$separator . $embed . $suffix;
		$this->assertSame( $expectedRev1Main, $rev1->getContent( 'main' )->getText() );

		$doc1 = json_decode( $rev1->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertCount( 1, $doc1['surfaces'] );
		$this->assertSame( $proposal1['surfaceId'], $doc1['surfaces'][0]['id'] );
		$this->assertEquals( json_decode( $proposal1['document'], true ), $doc1 );

		$this->assertSame( $text, $lookup->getRevisionById( $base )->getContent( 'main' )->getText() );
		$this->assertFalse( $lookup->getRevisionById( $base )->hasSlot( PageRevisionWriter::SLOT ) );

		// 3. Publish the second prepared proposal against its original base; require conflict
		try {
			$adoption->publishPreparedSurface(
				$page->getId(), $base, $actor,
				$proposal2['document'], $proposal2['main'], 'Adopt second slide stale' );
			$this->fail( 'Expected conflict exception when publishing against stale base' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertSame( $initialCount + 1, $countRevisions() );
		$this->assertSame( $rev1Id, $lookup->getRevisionByTitle( $page->getTitle() )->getId() );
		$this->assertSame( $expectedRev1Main, $lookup->getRevisionById( $rev1Id )->getContent( 'main' )->getText() );
		$docAfterConflict = json_decode(
			$lookup->getRevisionById( $rev1Id )->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertCount( 1, $docAfterConflict['surfaces'] );
		$this->assertSame( $proposal1['surfaceId'], $docAfterConflict['surfaces'][0]['id'] );
		$this->assertSame( $doc1, $docAfterConflict );

		// 4. Simulate deliberate renewed selection: scan rev1 for new byte offset and prepare against rev1
		$rev1MainText = $lookup->getRevisionById( $rev1Id )->getContent( 'main' )->getText();
		$candidates = ( new DirectEmbeddingRewriter() )->scan( $rev1MainText, static fn () => null );
		$unbound = array_values( array_filter( $candidates,
			static fn ( $candidate ) => $candidate['raw'] === $embed ) );
		$this->assertCount( 1, $unbound );
		$newStart = $unbound[0]['start'];
		$this->assertIsInt( $newStart );
		$this->assertNotSame( $start2, $newStart );

		$proposal3 = $direct->prepare( $page->getId(), $rev1Id, $newStart, $embed, 202, null, $actor );
		$this->assertNotSame( $proposal1['surfaceId'], $proposal3['surfaceId'] );
		$this->assertNotSame( $proposal2['surfaceId'], $proposal3['surfaceId'] );
		$this->assertNotSame( $proposal1['binding'], $proposal3['binding'] );

		$rev2Id = $adoption->publishPreparedSurface(
			$page->getId(), $rev1Id, $actor,
			$proposal3['document'], $proposal3['main'], 'Adopt second slide renewed' );
		$this->assertGreaterThan( $rev1Id, $rev2Id );
		$this->assertSame( $initialCount + 2, $countRevisions() );
		$rev2 = $lookup->getRevisionById( $rev2Id );
		$this->assertSame( $rev1Id, $rev2->getParentId() );
		$this->assertSame( $page->getId(), $rev2->getPageId() );
		$this->assertSame( $actor->getId(), $rev2->getUser()->getId() );

		// Both embeds name their own drawing; the second adoption of the slide takes the next free name
		$pageId = $page->getId();
		$expectedRev2Main = $prefix . "{{#Slide:$pageId:WelcomePresentation|width=400}}" . $separator .
			"{{#Slide:$pageId:WelcomePresentation 2|width=400}}" . $suffix;
		$this->assertSame( $expectedRev2Main, $rev2->getContent( 'main' )->getText() );
		$this->assertStringNotContainsString( 'layerset=default', $rev2->getContent( 'main' )->getText() );

		// Assert the first surface remains canonical-byte equivalent, second has distinct identity, drawing intact
		$doc2 = json_decode( $rev2->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertCount( 2, $doc2['surfaces'] );
		$this->assertSame( $doc1['surfaces'][0], $doc2['surfaces'][0] );
		$this->assertSame( $proposal3['surfaceId'], $doc2['surfaces'][1]['id'] );
		$this->assertSame( [ 'WelcomePresentation', 'WelcomePresentation 2' ],
			array_column( $doc2['surfaces'], 'label' ) );
		$this->assertNotSame( $doc2['surfaces'][0]['id'], $doc2['surfaces'][1]['id'] );

		$legacyLayers = json_decode( $this->row()['json'], true )['layers'];
		$this->assertEquals( $legacyLayers, $doc2['surfaces'][0]['layers'] );
		$this->assertEquals( $legacyLayers, $doc2['surfaces'][1]['layers'] );
		$this->assertFalse( $doc2['surfaces'][0]['canvas']['backgroundVisible'] );
		$this->assertFalse( $doc2['surfaces'][1]['canvas']['backgroundVisible'] );

		// Verify both native revisions and the original parent remain unchanged/readable
		$baseFinal = $lookup->getRevisionById( $base );
		$this->assertNotNull( $baseFinal );
		$this->assertSame( $text, $baseFinal->getContent( 'main' )->getText() );
		$this->assertFalse( $baseFinal->hasSlot( PageRevisionWriter::SLOT ) );

		$rev1Final = $lookup->getRevisionById( $rev1Id );
		$this->assertNotNull( $rev1Final );
		$this->assertSame( $expectedRev1Main, $rev1Final->getContent( 'main' )->getText() );
		$doc1Final = json_decode( $rev1Final->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertCount( 1, $doc1Final['surfaces'] );
		$this->assertSame( $doc1['surfaces'][0], $doc1Final['surfaces'][0] );

		$rev2Final = $lookup->getRevisionById( $rev2Id );
		$this->assertNotNull( $rev2Final );
		$this->assertSame( $expectedRev2Main, $rev2Final->getContent( 'main' )->getText() );
		$doc2Final = json_decode( $rev2Final->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertCount( 2, $doc2Final['surfaces'] );
		$this->assertSame( $doc2, $doc2Final );
	}

	/** @covers \MediaWiki\Extension\Layers\Revision\DirectAdoptionPreparationService */
	public function testGroupedDrawingWithMarkerIsAdoptable(): void {
		$page = $this->getExistingTestPage();
		$embed = '{{#Slide:WelcomePresentation|layerset=default}}';
		$this->editPage( $page, $embed );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$row = $this->row();
		$data = json_decode( $row['json'] );
		$data->layers[0]->parentGroup = 'group1';
		$data->layers[] = (object)[ 'id' => 'group1', 'type' => 'group', 'children' => [ $data->layers[0]->id ],
			'visible' => false ];
		$data->layers[] = (object)[ 'id' => 'pin', 'type' => 'marker', 'x' => 5, 'y' => 5, 'text' => '1' ];
		$row['json'] = json_encode( $data );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->method( 'getLayerSetForAdoption' )->willReturn( $row );
		$result = $this->directService( $legacy )->prepare( $page->getId(), $base, 0, $embed, 202, null, $actor );
		$layers = json_decode( $result['document'] )->surfaces[0]->layers;
		$this->assertSame( [ 'rectangle', 'text', 'group', 'marker' ], array_column( $layers, 'type' ) );
		$this->assertSame( 'group1', $layers[0]->parentGroup );
		$this->assertSame( [ $layers[0]->id ], $layers[2]->children );
		$this->assertSame( $base, $lookup->getRevisionByTitle( $page->getTitle() )->getId() );
		$this->assertSame( $embed, $lookup->getRevisionById( $base )->getContent( 'main' )->getText() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Revision\DirectAdoptionPreparationService
	 * @dataProvider provideDirectMismatches
	 * @param string $embed
	 * @param int $start
	 * @param bool $readsLegacy
	 */
	public function testDirectMismatchNeverChangesPage( string $embed, int $start, bool $readsLegacy ): void {
		$page = $this->getExistingTestPage();
		$this->editPage( $page, $embed );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $readsLegacy ? $this->once() : $this->never() )
			->method( 'getLayerSetForAdoption' )->willReturn( $this->row() );
		try {
			$this->directService( $legacy )->prepare( $page->getId(), $base, $start, $embed, 202, null, $actor );
			$this->fail( 'Expected rejection' );
		} catch ( PublicationException $e ) {
			$this->assertSame( $readsLegacy ? 'layers-embedding-selection-unavailable' :
				'layers-embedding-source-unavailable', $e->getMessage() );
		}
		$this->assertSame( $base, $lookup->getRevisionByTitle( $page->getTitle() )->getId() );
		$this->assertSame( $embed, $lookup->getRevisionById( $base )->getContent( 'main' )->getText() );
	}

	/** @return array */
	public static function provideDirectMismatches(): array {
		return [
			[ '{{#Slide:Other|layerset=default}}', 0, true ],
			[ '{{#Slide:WelcomePresentation|layerset=other}}', 0, true ],
			[ '{{#Slide:WelcomePresentation|name=Other|layerset=default}}', 0, true ],
			[ '{{#Slide:WelcomePresentation|NAME|layerset=default}}', 0, true ],
			[ '{{#Slide:WelcomePresentation|layerset=default|page=2}}', 0, true ],
			[ '{{#Slide:WelcomePresentation|layerset=default}}', 1, false ],
			[ '{{Wrapper|{{#Slide:WelcomePresentation|layerset=default}}}}', 0, false ]
		];
	}

	private function service( LayersDatabase $legacy ): LegacyAdoptionPreparationService {
		$s = $this->getServiceContainer();
		$media = $this->createMock( LegacyMediaResolver::class );
		$media->expects( $this->never() )->method( 'resolve' );
		return new LegacyAdoptionPreparationService(
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $s->getRevisionLookup(),
				new PageHistoryAccess( $s->getRevisionLookup() ) ),
			$legacy, $media, new LegacySurfaceConverter() );
	}

	private function row(): array {
		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/adoption/slide-falsy-zero.json' ), true );
		$row = $fixture['legacyRecord']['database']['row'];
		return [
			'id' => $row['ls_id'], 'imgName' => $row['ls_img_name'], 'sha1' => $row['ls_img_sha1'],
			'mime' => 'application/x-layers-slide', 'name' => $row['ls_name'], 'page' => $row['ls_page'],
			'revision' => $row['ls_revision'], 'timestamp' => $row['ls_timestamp'], 'json' => $row['ls_json_blob']
		];
	}

	public function testPreparesExactDrawingWithoutSavingOrInventingAFile(): void {
		$page = $this->getExistingTestPage();
		$base = $page->getLatest();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$row = $this->row();
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->once() )->method( 'getLayerSetForAdoption' )->with( $row['id'] )->willReturn( $row );
		$result = $this->service( $legacy )->prepare( $page->getId(), $base, $row['id'], null, $actor );
		$this->assertSame( $page->getId(), $result['pageId'] );
		$this->assertSame( $base, $result['baseRevisionId'] );
		$this->assertSame( $row['id'], $result['legacyRevisionId'] );
		$this->assertMatchesRegularExpression( '/^surface_[a-f0-9]{32}$/D', $result['surfaceId'] );
		$this->assertSame( 'v1:' . $page->getId() . ':' . $result['surfaceId'], $result['binding'] );
		$surface = json_decode( $result['document'] )->surfaces[0];
		$this->assertSame( $result['surfaceId'], $surface->id );
		$this->assertFalse( $surface->canvas->backgroundVisible );
		$this->assertEquals( json_decode( $row['json'] )->layers, $surface->layers );
		$this->assertSame( $base, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	public function testDeniedOwnerNeverReadsLegacyContent(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read' ] );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->never() )->method( 'getLayerSetForAdoption' );
		$this->expectException( PublicationException::class );
		$this->expectExceptionMessage( 'layers-owner-unavailable' );
		$this->service( $legacy )->prepare( $page->getId(), $page->getLatest(), 202, null, $actor );
	}

	public function testMissingExactRevisionCannotFallBack(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->once() )->method( 'getLayerSetForAdoption' )->with( 202 )->willReturn( null );
		$legacy->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->expectExceptionMessage( 'layers-legacy-revision-unavailable' );
		$this->service( $legacy )->prepare( $page->getId(), $page->getLatest(), 202, null, $actor );
	}

	public function testInterveningPageEditInvalidatesPreparation(): void {
		$page = $this->getExistingTestPage();
		$base = $page->getLatest();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->method( 'getLayerSetForAdoption' )->willReturnCallback( function () use ( $page ) {
			$this->editPage( $page, 'An intervening edit' );
			return $this->row();
		} );
		$this->expectExceptionMessage( 'layers-edit-conflict' );
		$this->service( $legacy )->prepare( $page->getId(), $base, 202, null, $actor );
	}
}
