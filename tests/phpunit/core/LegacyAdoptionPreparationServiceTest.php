<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Revision\DirectAdoptionPreparationService;
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
		$this->assertSame( $prefix . '{{#Slide:WelcomePresentation|layersbinding=' .
			$result['binding'] . '|width=400}}' . "\nUntouched suffix", $result['main']->getText() );
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

	/** @covers \MediaWiki\Extension\Layers\Revision\DirectAdoptionPreparationService */
	public function testHiddenGroupCannotProduceAdoptableProposal(): void {
		$page = $this->getExistingTestPage();
		$embed = '{{#Slide:WelcomePresentation|layerset=default}}';
		$this->editPage( $page, $embed );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$row = $this->row();
		$data = json_decode( $row['json'] );
		$data->layers[] = (object)[ 'id' => 'group1', 'type' => 'group', 'children' => [], 'visible' => false ];
		$row['json'] = json_encode( $data );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->method( 'getLayerSetForAdoption' )->willReturn( $row );
		try {
			$this->directService( $legacy )->prepare( $page->getId(), $base, 0, $embed, 202, null, $actor );
			$this->fail( 'Expected unsupported rendering rejection' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-adoption-rendering-unavailable', $e->getMessage() );
		}
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
