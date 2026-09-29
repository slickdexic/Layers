<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\User\UserIdentity;
use OldRevisionImporter;
use WikiRevision;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 * @group API
 */
class PageOwnedPilotTest extends \MediaWiki\Tests\Api\ApiTestCase {
	/**
	 * @dataProvider provideBoundaryCases
	 * @param string $mode
	 * @param string $action
	 */
	public function testSharedApiBoundary( string $mode, string $action ): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$keys = $mode === 'empty' ? [] : [ $title->getPrefixedDBkey() . ( $mode === 'outside' ? '_other' : '' ) ];
		$this->configure( $mode !== 'disabled', $keys );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$params = [ 'action' => $action, 'owner' => $title->getPrefixedText() ];
		if ( $action === 'layerspublish' ) {
			$this->expectApiErrorCode( 'layers-publication-disabled' );
			$this->doApiRequestWithToken( $params + [ 'baserevid' => 0,
				'data' => '{"schemaVersion":1,"surfaces":[]}', 'maintext' => 'Denied' ], null, $actor );
		} else {
			$this->expectApiErrorCode(
				$mode === 'disabled' ? 'layers-reading-disabled' : 'layers-revision-unavailable' );
			$this->doApiRequest( $params + [ 'revid' => 1 ], null, false, $actor );
		}
	}

	/** @return array */
	public static function provideBoundaryCases(): array {
		$cases = [];
		foreach ( [ 'disabled', 'empty', 'outside' ] as $mode ) {
			foreach ( [ 'layerspublish', 'layersread' ] as $action ) {
				$cases[] = [ $mode, $action ];
			}
		}
		return $cases;
	}

	private function configure( bool $enabled, array $keys ): PageOwnedPilot {
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => $enabled,
			'LayersPageOwnedPilotOwners' => $keys ] );
		$s = $this->getServiceContainer();
		$pilot = null;
		$this->overrideConfigValue( 'APIModules', $s->getMainConfig()->get( 'APIModules' ) + [
			'layerspublish' => [ 'class' => ApiLayersPublish::class,
				'factory' => static function ( $main, $name ) use ( &$pilot ) {
					return $pilot->newPublishApi( $main, $name );
				} ],
			'layersread' => [ 'class' => ApiLayersRead::class,
				'factory' => static function ( $main, $name ) use ( &$pilot ) {
					return $pilot->newReadApi( $main, $name );
				} ]
		] );
		TestingAdmissionRegistration::install( $this );
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->setTemporaryHook( 'MultiContentSave', $pilot->newAdmissionHooks(), true );
		return $pilot;
	}

	public function testConfirmedAdoptionComposesExactSelectionAndRejectsRepeat(): void {
		$page = $this->getExistingTestPage();
		$embed = '{{#Slide:WelcomePresentation|layerset=default|width=400}}';
		$prefix = "説明 — café\n";
		$this->editPage( $page, $prefix . $embed );
		$pilot = $this->configure( true, [ $page->getTitle()->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();
		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/adoption/slide-falsy-zero.json' ), true );
		$row = $fixture['legacyRecord']['database']['row'];
		$legacy = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$legacy->expects( $this->once() )->method( 'getLayerSetForAdoption' )->with( 202 )->willReturn( [
			'id' => 202, 'imgName' => $row['ls_img_name'], 'sha1' => $row['ls_img_sha1'],
			'mime' => 'application/x-layers-slide', 'name' => $row['ls_name'], 'page' => $row['ls_page'],
			'revision' => $row['ls_revision'], 'timestamp' => $row['ls_timestamp'], 'json' => $row['ls_json_blob']
		] );
		$legacy->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->setService( 'LayersDatabase', $legacy );
		$count = fn () => (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'revision' )->where( [ 'rev_page' => $page->getId() ] )->caller( __METHOD__ )->fetchField();
		$before = $count();
		$result = $pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
			202, null, $actor, 'Adopt confirmed drawing' );
		$this->assertSame( [ 'pageId', 'revisionId', 'surfaceId', 'binding' ], array_keys( $result ) );
		$this->assertSame( $page->getId(), $result['pageId'] );
		$this->assertSame( 'v1:' . $page->getId() . ':' . $result['surfaceId'], $result['binding'] );
		$this->assertSame( $before + 1, $count() );
		$revision = $lookup->getRevisionById( $result['revisionId'] );
		$this->assertSame( $base, $revision->getParentId() );
		$this->assertSame( $prefix . '{{#Slide:' . $page->getId() . ':WelcomePresentation|width=400}}',
			$revision->getContent( 'main' )->getText() );
		$document = json_decode( $revision->getContent( 'layers' )->getText(), true );
		$this->assertSame( $result['surfaceId'], $document['surfaces'][0]['id'] );
		$this->assertFalse( $document['surfaces'][0]['canvas']['backgroundVisible'] );
		$expectedLayers = json_decode( $row['ls_json_blob'], true )['layers'];
		foreach ( $expectedLayers as &$layer ) {
			ksort( $layer );
		}
		unset( $layer );
		$this->assertSame( $expectedLayers, $document['surfaces'][0]['layers'] );
		$this->assertSame( $prefix . $embed, $lookup->getRevisionById( $base )->getContent( 'main' )->getText() );
		$this->assertFalse( $lookup->getRevisionById( $base )->hasSlot( 'layers' ) );
		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $actor, 'Do not retry' );
			$this->fail( 'Expected stale adoption rejection' );
		} catch ( \MediaWiki\Extension\Layers\Revision\PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertSame( $before + 1, $count() );
	}

	public function testAdoptDirectEmbeddingPreflightRejections(): void {
		$page = $this->getExistingTestPage();
		$embed = '{{#Slide:WelcomePresentation|layerset=default|width=400}}';
		$prefix = "Header\n";
		$this->editPage( $page, $prefix . $embed );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();

		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );

		$revCount = fn () => (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'revision' )->where( [ 'rev_page' => $page->getId() ] )->caller( __METHOD__ )->fetchField();
		$pageCount = fn () => (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'page' )->caller( __METHOD__ )->fetchField();
		$initialRevs = $revCount();
		$initialPages = $pageCount();

		$legacy = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$legacy->expects( $this->never() )->method( 'getLayerSetForAdoption' );
		$legacy->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->setService( 'LayersDatabase', $legacy );

		// 1a. Disabled pilot
		$pilotDisabled = $this->configure( false, [ $page->getTitle()->getPrefixedDBkey() ] );
		try {
			$pilotDisabled->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $actor, 'Disabled pilot' );
			$this->fail( 'Expected publication-disabled on disabled pilot' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-publication-disabled', $e->getMessage() );
		}

		// 1b. Empty scope
		$pilotEmpty = $this->configure( true, [] );
		try {
			$pilotEmpty->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $actor, 'Empty scope' );
			$this->fail( 'Expected publication-disabled on empty scope' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-publication-disabled', $e->getMessage() );
		}

		// 1c. Unrelated scope
		$pilotUnrelated = $this->configure( true, [ 'Unrelated_Owner_Page' ] );
		try {
			$pilotUnrelated->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $actor, 'Unrelated scope' );
			$this->fail( 'Expected publication-disabled on unrelated scope' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-publication-disabled', $e->getMessage() );
		}

		// Configure valid pilot for remaining checks
		$pilot = $this->configure( true, [ $page->getTitle()->getPrefixedDBkey() ] );

		// 1d. Anonymous actor
		$anon = $this->getServiceContainer()->getUserFactory()->newAnonymous();
		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $anon, 'Anonymous actor' );
			$this->fail( 'Expected publication-disabled on anonymous actor' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-publication-disabled', $e->getMessage() );
		}

		// 1e. Invalid bounds / IDs / start / empty source
		$invalidOwnerBounds = [
			'pageId zero' => [ 0, $base, strlen( $prefix ), $embed, 202 ],
			'pageId negative' => [ -1, $base, strlen( $prefix ), $embed, 202 ],
			'baseRevisionId zero' => [ $page->getId(), 0, strlen( $prefix ), $embed, 202 ],
			'baseRevisionId negative' => [ $page->getId(), -5, strlen( $prefix ), $embed, 202 ],
		];
		foreach ( $invalidOwnerBounds as $label => [ $pid, $bid, $st, $exp, $lrev ] ) {
			try {
				$pilot->adoptDirectEmbedding( $pid, $bid, $st, $exp, $lrev, null, $actor, 'Invalid bounds' );
				$this->fail( "Expected layers-owner-unavailable for {$label}" );
			} catch ( PublicationException $e ) {
				$this->assertSame( 'layers-owner-unavailable', $e->getMessage(),
					"Mismatch for {$label}" );
			}
		}

		$invalidRequestBounds = [
			'start negative' => [ $page->getId(), $base, -1, $embed, 202 ],
			'empty expected source' => [ $page->getId(), $base, strlen( $prefix ), '', 202 ],
			'legacyRevisionId zero' => [ $page->getId(), $base, strlen( $prefix ), $embed, 0 ],
			'legacyRevisionId negative' => [ $page->getId(), $base, strlen( $prefix ), $embed, -10 ],
			'legacyRevisionId exceeds max' => [ $page->getId(), $base, strlen( $prefix ), $embed, 2147483648 ],
		];
		foreach ( $invalidRequestBounds as $label => [ $pid, $bid, $st, $exp, $lrev ] ) {
			try {
				$pilot->adoptDirectEmbedding( $pid, $bid, $st, $exp, $lrev, null, $actor, 'Invalid bounds' );
				$this->fail( "Expected invalid-publication-request for {$label}" );
			} catch ( PublicationException $e ) {
				$this->assertSame( 'layers-invalid-publication-request', $e->getMessage(),
					"Mismatch for {$label}" );
			}
		}

		// 1f. Stale base
		$this->editPage( $page, $prefix . $embed . "\nUpdated" );
		$currentBase = $lookup->getRevisionByTitle( $page->getTitle() )->getId();
		$this->assertGreaterThan( $base, $currentBase );

		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $actor, 'Stale base' );
			$this->fail( 'Expected layers-edit-conflict on stale base' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}

		// 1g. Denied permissions tested against current valid base
		$noRead = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $noRead, [] );
		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $currentBase, strlen( $prefix ), $embed,
				202, null, $noRead, 'No read' );
			$this->fail( 'Expected layers-owner-unavailable for denied read' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-unavailable', $e->getMessage() );
		}

		$noEdit = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $noEdit, [ 'read' ] );
		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $currentBase, strlen( $prefix ), $embed,
				202, null, $noEdit, 'No edit' );
			$this->fail( 'Expected layers-owner-unavailable for denied edit' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-unavailable', $e->getMessage() );
		}

		$noEditLayers = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $noEditLayers, [ 'read', 'edit' ] );
		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $currentBase, strlen( $prefix ), $embed,
				202, null, $noEditLayers, 'No editlayers' );
			$this->fail( 'Expected layers-owner-unavailable for denied editlayers' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-unavailable', $e->getMessage() );
		}

		$this->assertSame( $initialRevs + 1, $revCount(), 'No extra revisions from preflight denial' );
		$this->assertSame( $initialPages, $pageCount(), 'No page row mutation from preflight denial' );
	}

	public function testAdoptDirectEmbeddingRejectsMismatchedSourceSpanAndInvalidLegacyRows(): void {
		$page = $this->getExistingTestPage();
		$embed = '{{#Slide:WelcomePresentation|layerset=default|width=400}}';
		$prefix = "Intro\n";
		$text = $prefix . $embed;
		$this->editPage( $page, $text );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();

		$pilot = $this->configure( true, [ $page->getTitle()->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );

		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/adoption/slide-falsy-zero.json' ), true );
		$row = $fixture['legacyRecord']['database']['row'];
		$validRow = [
			'id' => 202, 'imgName' => $row['ls_img_name'], 'sha1' => $row['ls_img_sha1'],
			'mime' => 'application/x-layers-slide', 'name' => $row['ls_name'], 'page' => $row['ls_page'],
			'revision' => $row['ls_revision'], 'timestamp' => $row['ls_timestamp'], 'json' => $row['ls_json_blob']
		];

		$revCount = fn () => (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'revision' )->where( [ 'rev_page' => $page->getId() ] )->caller( __METHOD__ )->fetchField();
		$initialRevs = $revCount();

		// 2a. Mismatched exact source span fails BEFORE legacy lookup
		$legacyNever = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$legacyNever->expects( $this->never() )->method( 'getLayerSetForAdoption' );
		$legacyNever->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->setService( 'LayersDatabase', $legacyNever );

		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ) + 2, $embed,
				202, null, $actor, 'Wrong start offset' );
			$this->fail( 'Expected layers-embedding-source-unavailable for wrong start' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-embedding-source-unavailable', $e->getMessage() );
		}

		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ),
				'{{#Slide:WelcomePresentation|layerset=default|width=999}}', 202, null, $actor, 'Altered source' );
			$this->fail( 'Expected layers-embedding-source-unavailable for altered source' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-embedding-source-unavailable', $e->getMessage() );
		}

		// 2b. Missing legacy row
		$legacyMissing = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$legacyMissing->expects( $this->once() )->method( 'getLayerSetForAdoption' )->with( 999 )->willReturn( null );
		$legacyMissing->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->setService( 'LayersDatabase', $legacyMissing );

		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				999, null, $actor, 'Missing legacy row' );
			$this->fail( 'Expected layers-legacy-revision-unavailable for missing row' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-legacy-revision-unavailable', $e->getMessage() );
		}

		// 2c. Matching span with mismatched selected row
		$mismatchedRow = $validRow;
		$mismatchedRow['name'] = 'other_set';
		$legacyMismatched = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$legacyMismatched->expects( $this->once() )->method( 'getLayerSetForAdoption' )
			->with( 202 )->willReturn( $mismatchedRow );
		$legacyMismatched->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->setService( 'LayersDatabase', $legacyMismatched );

		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $actor, 'Mismatched set name' );
			$this->fail( 'Expected layers-embedding-selection-unavailable for mismatched row' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-embedding-selection-unavailable', $e->getMessage() );
		}

		// 2d. A layer type Layers does not know cannot be converted
		$groupBlob = json_decode( $validRow['json'], true );
		$groupBlob['layers'][] = [
			'id' => 'unknown_hidden', 'type' => 'hologram', 'visible' => false
		];
		$groupRow = $validRow;
		$groupRow['json'] = json_encode( $groupBlob );
		$legacyGroup = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$legacyGroup->expects( $this->once() )->method( 'getLayerSetForAdoption' )
			->with( 202 )->willReturn( $groupRow );
		$legacyGroup->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->setService( 'LayersDatabase', $legacyGroup );

		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $actor, 'Unknown layer type' );
			$this->fail( 'Expected layers-legacy-conversion-unavailable for an unknown layer type' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-legacy-conversion-unavailable', $e->getMessage() );
		}

		// 2e. Forbidden source selection: file timestamp given for slide embed
		$legacyValid = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$legacyValid->expects( $this->once() )->method( 'getLayerSetForAdoption' )
			->with( 202 )->willReturn( $validRow );
		$legacyValid->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->setService( 'LayersDatabase', $legacyValid );

		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, '20260924000000', $actor, 'Slide with file timestamp' );
			$this->fail( 'Expected layers-source-unavailable when file timestamp provided for slide' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}

		// Assert zero mutations to revisions, main wikitext, or slots
		$this->assertSame( $initialRevs, $revCount() );
		$this->assertSame( $text, $lookup->getRevisionById( $base )->getContent( 'main' )->getText() );
		$this->assertFalse( $lookup->getRevisionById( $base )->hasSlot( 'layers' ) );
	}

	public function testAdoptDirectEmbeddingInterveningEditDuringLegacyLookupRejectsWithConflict(): void {
		$page = $this->getExistingTestPage();
		$embed = '{{#Slide:WelcomePresentation|layerset=default|width=400}}';
		$prefix = "Initial section\n";
		$initialText = $prefix . $embed;
		$this->editPage( $page, $initialText );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page->getTitle() )->getId();

		$pilot = $this->configure( true, [ $page->getTitle()->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );

		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/adoption/slide-falsy-zero.json' ), true );
		$row = $fixture['legacyRecord']['database']['row'];
		$validRow = [
			'id' => 202, 'imgName' => $row['ls_img_name'], 'sha1' => $row['ls_img_sha1'],
			'mime' => 'application/x-layers-slide', 'name' => $row['ls_name'], 'page' => $row['ls_page'],
			'revision' => $row['ls_revision'], 'timestamp' => $row['ls_timestamp'], 'json' => $row['ls_json_blob']
		];

		$revCount = fn () => (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'revision' )->where( [ 'rev_page' => $page->getId() ] )->caller( __METHOD__ )->fetchField();
		$before = $revCount();

		$interveningText = "Deliberate intervening edit while legacy row is being looked up";
		$legacy = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$legacy->expects( $this->once() )->method( 'getLayerSetForAdoption' )->with( 202 )
			->willReturnCallback( function () use ( $page, $interveningText, $validRow ) {
				$this->editPage( $page, $interveningText );
				return $validRow;
			} );
		$legacy->expects( $this->never() )->method( 'getLatestLayerSet' );
		$this->setService( 'LayersDatabase', $legacy );

		try {
			$pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed,
				202, null, $actor, 'Adoption during concurrent edit' );
			$this->fail( 'Expected layers-edit-conflict when owner revision advances during legacy lookup' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}

		// Count revisions before and after: only the deliberate intervening edit may be new
		$this->assertSame( $before + 1, $revCount(), 'Only the deliberate intervening edit may be new' );

		// The latest revision is the intervening edit, retaining its content and having no layers slot
		$latestRev = $lookup->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $interveningText, $latestRev->getContent( 'main' )->getText() );
		$this->assertFalse( $latestRev->hasSlot( 'layers' ), 'No Layers slot was created on the intervening edit' );
	}

	public function testSharedPublisherAdmissionAndExactReader(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'First composed save' ];
		$first = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$params['baserevid'] = $first;
		$params['data'] = '{"schemaVersion":1,"surfaces":[]}';
		$second = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $first, $second );
		$read = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
			'revid' => $first ], null, false, $actor )[0]['layersread'];
		$this->assertSame( $first, $read['revisionId'] );
		$this->assertNotEmpty( $read['snapshot']['surfaces'] );
		$this->assertSame( $second, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $title )->getId() );
	}

	public function testDisabledApisRetainImportProtection(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( false, [ $title->getPrefixedDBkey() ] );
		$native = $this->createMock( OldRevisionImporter::class );
		$native->expects( $this->never() )->method( 'import' );
		$revision = new WikiRevision();
		$revision->setTitle( $title );
		$revision->setContent( 'layers', new LayersDocumentContent( '{"schemaVersion":1,"surfaces":[]}' ) );
		try {
			$pilot->wrapImporter( $native )->import( $revision );
			$this->fail( 'Expected retained import guard' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}
		$this->expectApiErrorCode( 'layers-reading-disabled' );
		$this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(), 'revid' => 1 ] );
	}

	public function testHistoricalViewerRetainsOldContentForReaderWithoutEditRights(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$json = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => $json, 'maintext' => 'Historical viewer owner' ];
		$first = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$updated = json_decode( $json, true );
		$updated['surfaces'][0]['layers'][0]['text'] = 'New text';
		$params['data'] = json_encode( $updated );
		$params['baserevid'] = $first;
		$second = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->overrideUserPermissions( $actor, [ 'read' ] );
		$old = $pilot->prepareViewer( $title->getPrefixedText(), $first, 'presentation', $actor );
		$new = $pilot->prepareViewer( $title->getPrefixedText(), $second, 'presentation', $actor );
		$this->assertSame( $first, $old['revisionId'] );
		$this->assertSame( $second, $new['revisionId'] );
		$oldCanonical = ( new LayersDocumentContent( $json ) )->getCanonicalText();
		$newCanonical = ( new LayersDocumentContent( json_encode( $updated ) ) )->getCanonicalText();
		$this->assertSame( json_decode( $oldCanonical, true )['surfaces'][0], $old['surface'] );
		$this->assertSame( json_decode( $newCanonical, true )['surfaces'][0], $new['surface'] );
		$this->assertSame( [ 'owner', 'revisionId', 'surface' ], array_keys( $old ) );
		$entry = $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'ViewLayersPage' );
		$this->assertInstanceOf( \MediaWiki\Extension\Layers\SpecialPages\SpecialViewLayersPage::class, $entry );
		$context = new \RequestContext();
		$context->setAuthority( $actor );
		$context->setTitle( $entry->getPageTitle() );
		$context->setRequest( new \MediaWiki\Request\FauxRequest( [
			'owner' => $title->getPrefixedText(), 'revid' => (string)$first, 'surface' => 'presentation'
		] ) );
		$entry->setContext( $context );
		$entry->execute( null );
		$out = $context->getOutput();
		$this->assertSame( $old, $out->getJsConfigVars()['wgLayersRevisionView'] );
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $out->getJsConfigVars() );
		$this->assertContains( 'ext.layers.history', $out->getModules() );
		$this->assertNotContains( 'ext.layers.editor', $out->getModules() );
		$out->sendCacheControl();
		$this->assertStringContainsString( 'no-store',
			$context->getRequest()->response()->getHeader( 'Cache-Control' ) );
		$this->expectExceptionMessage( 'layers-revision-unavailable' );
		$pilot->prepareViewer( $title->getPrefixedText(), $first, 'missing', $actor );
	}

	public function testBoundEditorDerivesSelectionFromExactSavedSource(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Initial owner' ];
		$base = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$pageId = $title->getArticleID();
		$prefix = "Unicode 世界 — café\n";
		$embed = '{{#Slide:Welcome|layersbinding=v1:' . $pageId . ':presentation}}';
		$params['baserevid'] = $base;
		$params['maintext'] = $prefix . $embed;
		$current = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];

		$dbr = $this->getDb();
		$initialPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$initialRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();

		$init = $pilot->prepareBoundEditor( $pageId, $current, strlen( $prefix ), $embed, $actor );
		$this->assertSame( $pageId, $init['pageOwned']['pageId'] );
		$this->assertSame( $current, $init['pageOwned']['revisionId'] );
		$this->assertSame( 'presentation', $init['pageOwned']['surfaceId'] );
		$entry = new SpecialEditLayersPage( $pilot );
		$context = new \RequestContext();
		$context->setUser( $actor );
		$context->setTitle( $entry->getPageTitle() );
		$context->setRequest( new \MediaWiki\Request\FauxRequest( [
			'pageid' => (string)$pageId, 'revid' => (string)$current,
			'start' => (string)strlen( $prefix ), 'expected' => $embed
		] ) );
		$entry->setContext( $context );
		$entry->execute( null );
		$this->assertSame( $init, $context->getOutput()->getJsConfigVars()['wgLayersEditorInit'] );
		$this->assertContains( 'ext.layers.editor', $context->getOutput()->getModules() );

		$this->assertSame( $initialPageCount, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField() );
		$this->assertSame( $initialRevCount, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );

		foreach ( [
			[ $base, strlen( $prefix ), $embed ],
			[ $current, 0, $embed ],
			[ $current, strlen( $prefix ), '{{#Slide:Forged|layersbinding=v1:' . $pageId . ':presentation}}' ]
		] as [ $revision, $start, $expected ] ) {
			try {
				$pilot->prepareBoundEditor( $pageId, $revision, $start, $expected, $actor );
				$this->fail( 'Expected exact-source rejection' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
				$this->assertNull( $e->getPrevious() );
			}
		}

		$this->assertSame( $initialPageCount, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField() );
		$this->assertSame( $initialRevCount, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );

		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$this->assertSame( $current, $lookup->getRevisionByTitle( $title )->getId() );
		$this->assertSame( $prefix . $embed, $lookup->getRevisionById( $current )->getContent( 'main' )->getText() );
	}

	public function testAnEmbedNamingAMissingDrawingOpensANewOneThatTheFirstSaveAdds(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'upload' ] );
		$png = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:J90_New_drawing.png' );
		$this->editPage( $title, 'Intro' );
		$pageId = $title->getArticleID();
		$slide = "{{#Slide:$pageId:New slide}}";
		$file = "[[File:J90_New_drawing.png|layerset=$pageId:Photo notes]]";
		$prefix = "Intro\n";
		$text = $prefix . $slide . "\n" . $file . "\n{{#Slide:" . ( $pageId + 1000 ) . ':Elsewhere}}';
		$this->editPage( $title, $text );
		$base = $title->getLatestRevID( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST );

		// Only this page's own names are offered; another page's embed is not.
		$entries = $pilot->listBoundEditorSelections( $pageId, $base, $actor );
		$this->assertSame( [ [ 'New slide', true ], [ 'Photo notes', true ] ],
			array_map( static fn ( $e ) => [ $e['label'], $e['create'] ?? false ], $entries ) );

		$init = $pilot->prepareBoundEditor( $pageId, $base, strlen( $prefix ), $slide, $actor );
		$new = $init['pageOwned']['newSurface'];
		$this->assertSame( NewPageDrawing::surfaceId( $pageId, $base, 'New slide' ),
			$init['pageOwned']['surfaceId'] );
		$this->assertSame( [ $init['pageOwned']['surfaceId'], 'slide', 'New slide', [] ],
			[ $new['id'], $new['kind'], $new['label'], $new['layers'] ] );
		$this->assertTrue( $init['pageOwned']['emptyBase'] );
		$this->assertTrue( $init['isSlide'] );
		$this->assertSame( $new['canvas']['width'], $init['canvasWidth'] );
		// Opening the editor writes nothing.
		$this->assertSame( $base, $title->getLatestRevID( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST ) );

		$image = $pilot->prepareBoundEditor( $pageId, $base, strlen( $prefix . $slide . "\n" ), $file, $actor );
		$photo = $image['pageOwned']['newSurface'];
		$this->assertSame( [ 'image', 'File:J90_New_drawing.png', $png->getSha1(), $png->getTimestamp() ], [
			$photo['kind'], $photo['source']['fileTitle'], $photo['source']['sha1'], $photo['source']['timestamp']
		] );
		$this->assertSame( [ $png->getWidth(), $png->getHeight() ], [ $image['baseWidth'], $image['baseHeight'] ] );
		$this->assertStringContainsString( 'J90_New_drawing.png', rawurldecode( $image['imageUrl'] ) );

		$result = $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(),
			'baserevid' => $base, 'data' => json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $new ] ] ) ],
			null, $actor )[0]['layerspublish'];
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $result['revid'] );
		$this->assertSame( 'Added drawing “New slide”', $revision->getComment()->text );

		// Saved, the drawing is edited like any other; the photo is still offered for creation.
		$entries = $pilot->listBoundEditorSelections( $pageId, $result['revid'], $actor );
		$this->assertSame( [ [ 'New slide', false ], [ 'Photo notes', true ] ],
			array_map( static fn ( $e ) => [ $e['label'], $e['create'] ?? false ], $entries ) );
		$edit = $pilot->prepareBoundEditor( $pageId, $result['revid'], strlen( $prefix ), $slide, $actor );
		$this->assertSame( $new['id'], $edit['pageOwned']['surfaceId'] );
		$this->assertArrayNotHasKey( 'newSurface', $edit['pageOwned'] );
	}

	public function testAnotherPagesDrawingIsCopiedAsANewDrawingThatRecordsItsSource(): void {
		$this->setContentLang( 'en' );
		$source = $this->getNonexistingTestPage()->getTitle();
		$target = $this->getNonexistingTestPage()->getTitle();
		$denied = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $source->getPrefixedDBkey(), $target->getPrefixedDBkey(),
			$denied->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$fixture = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$sourceRev = $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $source->getPrefixedText(),
			'baserevid' => 0, 'data' => $fixture, 'maintext' => 'Source' ], null, $actor )[0]['layerspublish']['revid'];
		$sourceId = $source->getArticleID();
		$prefix = "Copied text\n";
		$embed = "{{#Slide:$sourceId:Welcome Slide}}";
		$this->editPage( $target, $prefix . $embed );
		$targetId = $target->getArticleID();
		$latest = static fn ( $title ) => $title->getLatestRevID( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST );
		$base = $latest( $target );

		// The copied embed gives no edit rights over the source; the only offer is a copy.
		$this->assertSame( [], $pilot->listBoundEditorSelections( $targetId, $base, $actor ) );
		$offers = $pilot->listCopyCandidates( $targetId, $base, $actor );
		$this->assertCount( 1, $offers );
		$this->assertSame( [ 'Welcome Slide', $source->getPrefixedDBkey() ],
			[ $offers[0]['label'], $offers[0]['source']->getPrefixedDBkey() ] );
		$this->assertSame( [ 'pageid' => $targetId, 'revid' => $base, 'start' => strlen( $prefix ),
			'expected' => $embed, 'sourcerev' => $sourceRev ], $offers[0]['params'] );
		$preview = $pilot->previewCopy( $targetId, $base, strlen( $prefix ), $embed, $sourceRev, $actor );
		$this->assertSame( [ 'Welcome Slide', $sourceRev ], [ $preview['label'], $preview['sourceRevision'] ] );
		$this->assertSame( $base, $latest( $target ) );

		$copied = $pilot->copyDrawing( $targetId, $base, strlen( $prefix ), $embed, $sourceRev, $actor, 'handout' );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $copied );
		$this->assertSame( $prefix . "{{#Slide:$targetId:Welcome Slide}}",
			$revision->getContent( 'main' )->getText() );
		$this->assertSame( 'Copied drawing “Welcome Slide” from [[:' . $source->getPrefixedText() .
			"]] (revision $sourceRev): handout", $revision->getComment()->text );
		$copy = json_decode( $revision->getContent( 'layers' )->getText(), true )['surfaces'];
		$original = json_decode( ( new LayersDocumentContent( $fixture ) )->getCanonicalText(), true )['surfaces'][0];
		$this->assertCount( 1, $copy );
		$this->assertSame( NewPageDrawing::surfaceId( $targetId, $base, 'Welcome Slide' ), $copy[0]['id'] );
		$this->assertSame( [ 'Welcome Slide', $original['layers'] ], [ $copy[0]['label'], $copy[0]['layers'] ] );
		$this->assertSame( $sourceRev, $latest( $source ) );
		$this->assertSame( [], $pilot->listCopyCandidates( $targetId, $copied, $actor ) );
		$this->assertSame( [ [ 'Welcome Slide', false ] ], array_map( static fn ( $e ) =>
			[ $e['label'], $e['create'] ?? false ], $pilot->listBoundEditorSelections( $targetId, $copied, $actor ) ) );

		// A stale confirmation writes nothing.
		try {
			$pilot->copyDrawing( $targetId, $base, strlen( $prefix ), $embed, $sourceRev, $actor, '' );
			$this->fail( 'A stale copy must be refused' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		// A second embed of the same name is not offered: the page already has that name.
		$this->editPage( $target, $prefix . "{{#Slide:$targetId:Welcome Slide}}\n" . $embed );
		$this->assertSame( [], $pilot->listCopyCandidates( $targetId, $latest( $target ), $actor ) );
		try {
			$pilot->previewCopy( $targetId, $latest( $target ),
				strlen( $prefix . "{{#Slide:$targetId:Welcome Slide}}\n" ), $embed, $sourceRev, $actor );
			$this->fail( 'A taken name must be refused' );
		} catch ( PublicationException $e ) {
			$this->assertSame( [ 'layers-invalid-snapshot-name-taken', 'Welcome Slide' ], $e->getUserMessage() );
		}

		// A reader who cannot read the source page is offered nothing.
		$this->editPage( $denied, $embed );
		$this->setTemporaryHook( 'getUserPermissionsErrors',
			static function ( $title, $user, $action, &$result ) use ( $source ) {
				if ( $action === 'read' && $title->equals( $source ) ) {
					$result = false;
					return false;
				}
				return true;
			} );
		$this->assertSame( [], $pilot->listCopyCandidates( $denied->getArticleID(), $latest( $denied ), $actor ) );
	}

	public function testBoundEditorRejectsInvalidConfigAuthorityAndNumericBounds(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Initial text' ];
		$base = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$pageId = $title->getArticleID();
		$prefix = "Unicode 測試 — café\n";
		$embed = '{{#Slide:Welcome|layersbinding=v1:' . $pageId . ':presentation}}';
		$params['baserevid'] = $base;
		$params['maintext'] = $prefix . $embed;
		$current = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$start = strlen( $prefix );

		$dbr = $this->getDb();
		$initialPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$initialRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();

		// 1. Disabled pilot
		$disabledPilot = $this->configure( false, [ $title->getPrefixedDBkey() ] );
		try {
			$disabledPilot->prepareBoundEditor( $pageId, $current, $start, $embed, $actor );
			$this->fail( 'Expected disabled pilot to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
			$this->assertNull( $e->getPrevious() );
		}

		// 2. Empty scope
		$emptyScopePilot = $this->configure( true, [] );
		try {
			$emptyScopePilot->prepareBoundEditor( $pageId, $current, $start, $embed, $actor );
			$this->fail( 'Expected empty scope to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
			$this->assertNull( $e->getPrevious() );
		}

		// 3. A page that owns drawings stays in scope when its title is no longer enrolled.
		$unrelatedScopePilot = $this->configure( true, [ 'Unrelated_Owner_Page' ] );
		$this->assertSame( $pageId, $unrelatedScopePilot->prepareBoundEditor( $pageId, $current, $start, $embed,
			$actor )['pageOwned']['pageId'] );

		// 4. Anonymous actor (getId() <= 0)
		$anonUser = $this->createMock( UserIdentity::class );
		$anonUser->method( 'getId' )->willReturn( 0 );
		$anonAuthority = $this->createMock( Authority::class );
		$anonAuthority->method( 'getUser' )->willReturn( $anonUser );
		try {
			$pilot->prepareBoundEditor( $pageId, $current, $start, $embed, $anonAuthority );
			$this->fail( 'Expected anonymous actor to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
			$this->assertNull( $e->getPrevious() );
		}

		// 5. Denied read permission
		$deniedRead = $this->createMock( Authority::class );
		$deniedRead->method( 'getUser' )->willReturn( $actor );
		$deniedRead->method( 'authorizeRead' )->willReturn( false );
		$deniedRead->method( 'authorizeWrite' )->willReturn( true );
		$deniedRead->method( 'isAllowed' )->willReturn( true );
		try {
			$pilot->prepareBoundEditor( $pageId, $current, $start, $embed, $deniedRead );
			$this->fail( 'Expected denied read to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
			$this->assertNull( $e->getPrevious() );
		}

		// 6. Denied edit permission
		$deniedEdit = $this->createMock( Authority::class );
		$deniedEdit->method( 'getUser' )->willReturn( $actor );
		$deniedEdit->method( 'authorizeRead' )->willReturn( true );
		$deniedEdit->method( 'authorizeWrite' )->willReturn( false );
		$deniedEdit->method( 'isAllowed' )->willReturn( true );
		try {
			$pilot->prepareBoundEditor( $pageId, $current, $start, $embed, $deniedEdit );
			$this->fail( 'Expected denied edit to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
			$this->assertNull( $e->getPrevious() );
		}

		// 7. Denied editlayers permission
		$deniedEditlayers = $this->createMock( Authority::class );
		$deniedEditlayers->method( 'getUser' )->willReturn( $actor );
		$deniedEditlayers->method( 'authorizeRead' )->willReturn( true );
		$deniedEditlayers->method( 'authorizeWrite' )->willReturn( true );
		$deniedEditlayers->method( 'isAllowed' )->with( 'editlayers' )->willReturn( false );
		try {
			$pilot->prepareBoundEditor( $pageId, $current, $start, $embed, $deniedEditlayers );
			$this->fail( 'Expected denied editlayers to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
			$this->assertNull( $e->getPrevious() );
		}

		// 8. Invalid numeric bounds: pageId, revisionId, start, and empty expected
		$invalidNumericBounds = [
			'zero-page-id' => [ 0, $current, $start, $embed ],
			'negative-page-id' => [ -1, $current, $start, $embed ],
			'overflow-page-id' => [ 2147483648, $current, $start, $embed ],
			'overflow-revision-id' => [ $pageId, 2147483648, $start, $embed ],
			'zero-revision-id' => [ $pageId, 0, $start, $embed ],
			'negative-revision-id' => [ $pageId, -1, $start, $embed ],
			'negative-start' => [ $pageId, $current, -1, $embed ],
			'empty-expected' => [ $pageId, $current, $start, '' ],
		];

		foreach ( $invalidNumericBounds as $caseKey => [ $pId, $revId, $st, $exp ] ) {
			try {
				$pilot->prepareBoundEditor( $pId, $revId, $st, $exp, $actor );
				$this->fail( "Expected invalid bounds {$caseKey} to reject" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage(), "Failed on {$caseKey}" );
				$this->assertNull( $e->getPrevious(), "Previous exception must be null on {$caseKey}" );
			}
		}

		// Assert no page or revision mutation occurred
		$this->assertSame( $initialPageCount, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField() );
		$this->assertSame( $initialRevCount, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$this->assertSame( $current, $lookup->getRevisionByTitle( $title )->getId() );
		$this->assertSame( $prefix . $embed, $lookup->getRevisionById( $current )->getContent( 'main' )->getText() );
	}

	public function testBoundEditorRejectsInvalidMainSourceCases(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$fixture = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => $fixture, 'maintext' => 'Base setup' ];
		$base = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$pageId = $title->getArticleID();
		$prefix = "Lead content — 世界\n";
		$start = strlen( $prefix );

		$dbr = $this->getDb();

		$cases = [
			'foreign-owner-binding' => [
				'embed' => '{{#Slide:Welcome|layersbinding=v1:' . ( $pageId + 99999 ) . ':presentation}}',
			],
			'missing-surface' => [
				'embed' => '{{#Slide:Welcome|layersbinding=v1:' . $pageId . ':nonexistent_surface}}',
			],
			'duplicate-binding' => [
				'embed' => '{{#Slide:Welcome|layersbinding=v1:' . $pageId . ':presentation|layersbinding=v1:' .
					$pageId . ':presentation}}',
			],
			'legacy-selector-conflict' => [
				'embed' => '{{#Slide:Welcome|layerset=default|layersbinding=v1:' . $pageId . ':presentation}}',
			],
			'unbound-legacy-slide' => [
				'embed' => '{{#Slide:Welcome|layerset=default}}',
			],
		];

		$lastRev = $base;
		foreach ( $cases as $caseKey => $caseData ) {
			$embed = $caseData['embed'];
			$mainText = $prefix . $embed;
			$publishParams = [
				'action' => 'layerspublish',
				'owner' => $title->getPrefixedText(),
				'baserevid' => $lastRev,
				'data' => $fixture,
				'maintext' => $mainText,
			];
			$revId = $this->doApiRequestWithToken( $publishParams, null, $actor )[0]['layerspublish']['revid'];
			$this->assertGreaterThan( $lastRev, $revId );
			$lastRev = $revId;

			$revCountBefore = (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
			$pageCountBefore = (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();

			try {
				$pilot->prepareBoundEditor( $pageId, $revId, $start, $embed, $actor );
				$this->fail( "Expected {$caseKey} to reject" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage(), "Failed on {$caseKey}" );
				$this->assertNull( $e->getPrevious(), "Previous exception must be null on {$caseKey}" );
			}

			$this->assertSame( $pageCountBefore, (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField() );
			$this->assertSame( $revCountBefore, (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );
			$lookup = $this->getServiceContainer()->getRevisionLookup();
			$this->assertSame( $mainText, $lookup->getRevisionById( $revId )->getContent( 'main' )->getText() );
		}
	}

	public function testBoundEditorRejectsOpaqueContainersAndRequiresExactMultibyteOffset(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$fixture = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => $fixture, 'maintext' => 'Initial base' ];
		$base = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$pageId = $title->getArticleID();
		$dbr = $this->getDb();

		// Part A: Comments, nowiki and template-generated references
		$commentInner = '{{#Slide:CommentedSlide|layersbinding=v1:' . $pageId . ':presentation}}';
		$commentFull = '<!-- ' . $commentInner . ' -->';

		$nowikiInner = '{{#Slide:NowikiSlide|layersbinding=v1:' . $pageId . ':presentation}}';
		$nowikiFull = '<nowiki>' . $nowikiInner . '</nowiki>';

		$templateInner = '{{#Slide:TemplateSlide|layersbinding=v1:' . $pageId . ':presentation}}';
		$templateFull = '{{SomeTemplate|slide=' . $templateInner . '}}';

		$opaqueMain = "Header introductory text\n" .
			$commentFull . "\n" .
			$nowikiFull . "\n" .
			$templateFull;

		$paramsOpaque = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => $base,
			'data' => $fixture, 'maintext' => $opaqueMain ];
		$revOpaque = $this->doApiRequestWithToken( $paramsOpaque, null, $actor )[0]['layerspublish']['revid'];

		$revCountOpaque = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$pageCountOpaque = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();

		$opaqueCases = [
			'comment-inner' => [ strpos( $opaqueMain, $commentInner ), $commentInner ],
			'comment-full' => [ strpos( $opaqueMain, $commentFull ), $commentFull ],
			'nowiki-inner' => [ strpos( $opaqueMain, $nowikiInner ), $nowikiInner ],
			'nowiki-full' => [ strpos( $opaqueMain, $nowikiFull ), $nowikiFull ],
			'template-inner' => [ strpos( $opaqueMain, $templateInner ), $templateInner ],
			'template-full' => [ strpos( $opaqueMain, $templateFull ), $templateFull ],
		];

		foreach ( $opaqueCases as $caseKey => [ $st, $exp ] ) {
			$this->assertIsInt( $st, "Offset must be found for {$caseKey}" );
			try {
				$pilot->prepareBoundEditor( $pageId, $revOpaque, $st, $exp, $actor );
				$this->fail( "Expected opaque case {$caseKey} to reject" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage(), "Failed on {$caseKey}" );
				$this->assertNull( $e->getPrevious(), "Previous exception must be null on {$caseKey}" );
			}
		}

		$this->assertSame( $pageCountOpaque, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField() );
		$this->assertSame( $revCountOpaque, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$this->assertSame( $opaqueMain, $lookup->getRevisionById( $revOpaque )->getContent( 'main' )->getText() );

		$this->assertSame( [], $pilot->listBoundEditorSelections( $pageId, $revOpaque, $actor ) );

		// Part B: Two identical valid direct bindings separated by multibyte text
		$multibyteSep = "\nUnicode 測試 café — 世界 — 日本語\n";
		$slideEmbed = '{{#Slide:WelcomePresentation|layersbinding=v1:' . $pageId . ':presentation|width=400}}';
		$twoEmbedsMain = $slideEmbed . $multibyteSep . $slideEmbed;

		$paramsTwo = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => $revOpaque,
			'data' => $fixture, 'maintext' => $twoEmbedsMain ];
		$revTwo = $this->doApiRequestWithToken( $paramsTwo, null, $actor )[0]['layerspublish']['revid'];

		$revCountTwo = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$pageCountTwo = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();

		$selections = $pilot->listBoundEditorSelections( $pageId, $revTwo, $actor );
		$this->assertCount( 1, $selections );
		$this->assertSame( [ 'pageid' => $pageId, 'revid' => $revTwo, 'start' => 0,
			'expected' => $slideEmbed ], $selections[0]['params'] );
		$this->assertSame( [], $pilot->listBoundEditorSelections( $pageId, $revOpaque, $actor ) );
		$offset1 = 0;
		$offset2 = strlen( $slideEmbed . $multibyteSep );
		$charOffset2 = mb_strlen( $slideEmbed . $multibyteSep, 'UTF-8' );
		$this->assertLessThan( $offset2, $charOffset2,
			'Multibyte character offset must be strictly less than byte offset' );

		// Occurrence 1 at byte offset 0 is admitted
		$init1 = $pilot->prepareBoundEditor( $pageId, $revTwo, $offset1, $slideEmbed, $actor );
		$this->assertSame( $pageId, $init1['pageOwned']['pageId'] );
		$this->assertSame( $revTwo, $init1['pageOwned']['revisionId'] );
		$this->assertSame( 'presentation', $init1['pageOwned']['surfaceId'] );

		// Occurrence 2 at byte offset $offset2 is admitted
		$init2 = $pilot->prepareBoundEditor( $pageId, $revTwo, $offset2, $slideEmbed, $actor );
		$this->assertSame( $pageId, $init2['pageOwned']['pageId'] );
		$this->assertSame( $revTwo, $init2['pageOwned']['revisionId'] );
		$this->assertSame( 'presentation', $init2['pageOwned']['surfaceId'] );

		// Interior and wrong offsets must reject
		$interiorAndWrongOffsets = [
			'interior-occurrence-1' => [ 8, $slideEmbed ],
			'interior-multibyte-sep' => [ strlen( $slideEmbed ) + 5, $slideEmbed ],
			'interior-occurrence-2' => [ $offset2 + 8, $slideEmbed ],
			'char-offset-not-byte-offset' => [ $charOffset2, $slideEmbed ],
			'truncated-expected' => [ $offset1, substr( $slideEmbed, 0, -2 ) ],
			'padded-expected' => [ $offset2, $slideEmbed . ' ' ],
		];

		foreach ( $interiorAndWrongOffsets as $caseKey => [ $st, $exp ] ) {
			try {
				$pilot->prepareBoundEditor( $pageId, $revTwo, $st, $exp, $actor );
				$this->fail( "Expected interior/wrong offset case {$caseKey} to reject" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage(), "Failed on {$caseKey}" );
				$this->assertNull( $e->getPrevious(), "Previous exception must be null on {$caseKey}" );
			}
		}

		$this->assertSame( $pageCountTwo, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField() );
		$this->assertSame( $revCountTwo, (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );
		$this->assertSame( $twoEmbedsMain, $lookup->getRevisionById( $revTwo )->getContent( 'main' )->getText() );
	}

	public function testEditorPreparationUsesAuthorizedCurrentRevisionAndServerIdentity(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Editor owner' ];
		$id = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$init = $pilot->prepareEditor( $title->getPrefixedText(), $id, 'presentation', $actor );
		$this->assertSame( $title->getPrefixedDBkey(), $init['pageOwned']['owner'] );
		$this->assertSame( $id, $init['pageOwned']['revisionId'] );
		$this->assertSame( $title->getArticleID(), $init['pageOwned']['pageId'] );
		$this->assertSame( (string)$actor->getId(), $init['pageOwned']['draftScope']['user'] );
		$this->assertSame( 'presentation', $init['pageOwned']['surfaceId'] );
		$this->assertFalse( $init['autoCreate'] );
		$this->assertFalse( $init['pageOwned']['readOnly'] );
		$this->assertSame( 800, $init['canvasWidth'] );
		$this->assertArrayNotHasKey( 'snapshot', $init );
		$this->assertArrayNotHasKey( 'initialSetName', $init );
		$context = new \RequestContext();
		$context->setUser( $actor );
		$context->setTitle( $this->getServiceContainer()->getTitleFactory()
			->newFromText( 'Special:EditLayersPage' ) );
		$context->setRequest( new \MediaWiki\Request\FauxRequest( [
			'owner' => $title->getPrefixedText(), 'revid' => (string)$id, 'surface' => 'presentation'
		] ) );
		$entry = new SpecialEditLayersPage( $pilot );
		$entry->setContext( $context );
		$entry->execute( null );
		$this->assertSame( $init, $context->getOutput()->getJsConfigVars()['wgLayersEditorInit'] );
		$this->assertContains( 'ext.layers.editor', $context->getOutput()->getModules() );
		$this->assertStringContainsString( 'layers-editor-container', $context->getOutput()->getHTML() );
		$denied = $this->createMock( \MediaWiki\Permissions\Authority::class );
		$denied->method( 'getUser' )->willReturn( $actor );
		$denied->method( 'definitelyCan' )->willReturn( false );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $id, 'presentation', $denied );
			$this->fail( 'Expected denied editor' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}
		foreach ( [ [ $pilot, 'missing' ],
			[ new PageOwnedPilot( $this->getServiceContainer(), false,
				[ $title->getPrefixedDBkey() ] ), 'presentation' ],
			[ new PageOwnedPilot( $this->getServiceContainer(), true, [] ), 'presentation' ]
		] as [ $service, $surface ] ) {
			try {
				$service->prepareEditor( $title->getPrefixedText(), $id, $surface, $actor );
				$this->fail( 'Expected unavailable editor' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
			}
		}
		$params['baserevid'] = $id;
		$params['maintext'] = 'Newer main text';
		$next = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $id, $next );
		$this->expectExceptionMessage( 'layers-editor-unavailable' );
		$pilot->prepareEditor( $title->getPrefixedText(), $id, 'presentation', $actor );
	}

	public function testEditorPreparationRejectsInvalidInputsAndForeignRevisionsWithoutMutatingDatabase(): void {
		$titleA = $this->getNonexistingTestPage()->getTitle();
		$titleB = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $titleA->getPrefixedDBkey(), $titleB->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$fixtureJson = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$paramsA = [
			'action' => 'layerspublish',
			'owner' => $titleA->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Owner A content'
		];
		$revA = $this->doApiRequestWithToken( $paramsA, null, $actor )[0]['layerspublish']['revid'];

		$paramsB = [
			'action' => 'layerspublish',
			'owner' => $titleB->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Owner B content'
		];
		$revB = $this->doApiRequestWithToken( $paramsB, null, $actor )[0]['layerspublish']['revid'];

		$dbr = $this->getDb();
		$initialPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$initialRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$layerSetsTableExists = $dbr->tableExists( 'layer_sets' );
		$initialLayerSetsCount = $layerSetsTableExists ?
			(int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField() : 0;

		$unrelatedTitle = $this->getNonexistingTestPage()->getTitle();

		$rejectionCases = [
			'zero-revision' => [ $titleA->getPrefixedText(), 0, 'presentation' ],
			'negative-revision' => [ $titleA->getPrefixedText(), -1, 'presentation' ],
			'oversized-revision' => [ $titleA->getPrefixedText(), 2147483648, 'presentation' ],
			'empty-surface' => [ $titleA->getPrefixedText(), $revA, '' ],
			'missing-surface' => [ $titleA->getPrefixedText(), $revA, 'nonexistent_surface' ],
			'empty-owner' => [ '', $revA, 'presentation' ],
			'malformed-owner' => [ 'Invalid[]Title', $revA, 'presentation' ],
			'fragment-owner' => [ $titleA->getPrefixedText() . '#fragment', $revA, 'presentation' ],
			'unrelated-owner' => [ $unrelatedTitle->getPrefixedText(), $revA, 'presentation' ],
			'foreign-rev-A-with-B' => [ $titleA->getPrefixedText(), $revB, 'presentation' ],
			'foreign-rev-B-with-A' => [ $titleB->getPrefixedText(), $revA, 'presentation' ],
		];

		foreach ( $rejectionCases as $caseName => [ $ownerText, $revid, $surfaceId ] ) {
			try {
				$pilot->prepareEditor( $ownerText, $revid, $surfaceId, $actor );
				$this->fail( "Expected prepareEditor to throw for {$caseName}" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage(),
					"Failed assertion for {$caseName}" );
			}
		}

		$currentPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$currentRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $initialPageCount, $currentPageCount, 'Page table row count must remain unchanged' );
		$this->assertSame( $initialRevCount, $currentRevCount, 'Revision table row count must remain unchanged' );
		if ( $layerSetsTableExists ) {
			$currentLayerSetsCount = (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField();
			$this->assertSame( $initialLayerSetsCount, $currentLayerSetsCount,
				'Layer sets table row count must remain unchanged' );
		}
	}

	public function testEditorEntryRejectsMalformedRevisionBeforePreparingBootstrap(): void {
		$pilot = $this->createMock( PageOwnedPilot::class );
		$pilot->expects( $this->never() )->method( 'prepareEditor' );
		foreach ( [ null, '0', '01', '-1', '12junk', '1.5', '2147483648' ] as $revision ) {
			$context = new \RequestContext();
			$context->setTitle( $this->getServiceContainer()->getTitleFactory()
			->newFromText( 'Special:EditLayersPage' ) );
			$context->setRequest( new \MediaWiki\Request\FauxRequest( [
				'owner' => 'Owner', 'revid' => $revision, 'surface' => 'presentation'
			] ) );
			$entry = new SpecialEditLayersPage( $pilot );
			$entry->setContext( $context );
			$entry->execute( null );
			$this->assertArrayNotHasKey( 'wgLayersEditorInit', $context->getOutput()->getJsConfigVars() );
			$this->assertNotContains( 'ext.layers.editor', $context->getOutput()->getModules() );
		}
	}

	public function testEditorPreparationEnforcesAuthorityAndPreflightStopsBeforeReading(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$author = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $author, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Preflight authority content'
		];
		$revId = $this->doApiRequestWithToken( $params, null, $author )[0]['layerspublish']['revid'];

		// Case A: Registered reader lacking editlayers
		$readerNoEditlayers = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $readerNoEditlayers, [ 'read', 'edit', 'createpage' ] );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $readerNoEditlayers );
			$this->fail( 'Expected preparation to reject user lacking editlayers' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case B: Registered reader lacking edit
		$readerNoEdit = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $readerNoEdit, [ 'read', 'editlayers', 'createpage' ] );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $readerNoEdit );
			$this->fail( 'Expected preparation to reject user lacking edit' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case C: Anonymous authority (user id <= 0)
		$anonUser = $this->createMock( UserIdentity::class );
		$anonUser->method( 'getId' )->willReturn( 0 );
		$anonAuthority = $this->createMock( Authority::class );
		$anonAuthority->method( 'getUser' )->willReturn( $anonUser );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $anonAuthority );
			$this->fail( 'Expected preparation to reject anonymous authority' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case D: Denied read
		$readerNoRead = $this->getTestUser()->getUser();
		$this->overrideConfigValue( 'GroupPermissions', [ '*' => [ 'read' => false ] ] );
		$this->overrideUserPermissions( $readerNoRead, [ 'edit', 'editlayers', 'createpage' ] );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $readerNoRead );
			$this->fail( 'Expected preparation to reject user lacking read' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case E: Authority spy — original authority is checked,
		// and denied preflight does not proceed to reading snapshot
		$spyAuthority = $this->createMock( Authority::class );
		$spyAuthority->method( 'getUser' )->willReturn( $author );
		$spyAuthority->method( 'definitelyCan' )->willReturnCallback( static function ( string $permission ) {
			return $permission !== 'editlayers';
		} );
		$spyAuthority->expects( $this->never() )->method( 'authorizeRead' );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $spyAuthority );
			$this->fail( 'Expected preparation with spy authority lacking editlayers to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}
	}

	public function testEditorPreparationRejectsHiddenTextMissingSlotAndDeletedPageWithoutFallback(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'delete' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Visibility and deletion test content'
		];
		$revId = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];

		// Case A: Hidden Layers text (rev_deleted has DELETED_TEXT, actor lacks deletedtext)
		$this->assertFalse( $actor->isAllowed( 'deletedtext' ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $revId ] )
			->caller( __METHOD__ )->execute();

		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $actor );
			$this->fail( 'Expected preparation to reject revision with DELETED_TEXT visibility' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Restore visibility for subsequent sub-cases
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $revId ] )
			->caller( __METHOD__ )->execute();

		// Case B: Standard page with no Layers slot
		$plainPage = $this->getExistingTestPage();
		$plainTitle = $plainPage->getTitle();
		$plainRevId = $plainPage->getLatest();
		$pilotWithPlain = $this->configure( true,
			[ $title->getPrefixedDBkey(), $plainTitle->getPrefixedDBkey() ] );

		try {
			$pilotWithPlain->prepareEditor( $plainTitle->getPrefixedText(), $plainRevId, 'presentation', $actor );
			$this->fail( 'Expected preparation to reject page without Layers slot' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case C: Deleted page after revision was published
		$pageToDelete = $this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $title );
		$delStatus = $this->getServiceContainer()->getDeletePageFactory()
			->newDeletePage( $pageToDelete, $actor )
			->deleteUnsafe( 'J53 deletion test' );
		$this->assertTrue( $delStatus->isOK(), 'Page deletion must succeed' );

		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $actor );
			$this->fail( 'Expected preparation to reject deleted page' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}
	}

	public function testEditorPreparationMetadataIntegrityAndAssetBackedImageMode(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor,
			[ 'read', 'edit', 'editlayers', 'createpage', 'createtalk', 'upload' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Metadata integrity test'
		];
		$revId = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];

		$init = $pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $actor );

		// Metadata integrity assertions
		$this->assertSame( $title->getPrefixedDBkey(), $init['pageOwned']['owner'] );
		$this->assertSame( $revId, $init['pageOwned']['revisionId'] );
		$this->assertSame( 'presentation', $init['pageOwned']['surfaceId'] );
		$this->assertFalse( $init['pageOwned']['readOnly'] );
		$this->assertFalse( $init['autoCreate'] );
		$this->assertSame( $title->getPrefixedText(), $init['filename'] );
		$this->assertTrue( $init['isSlide'] );
		$this->assertSame( 800, $init['canvasWidth'] );
		$this->assertSame( 600, $init['canvasHeight'] );

		// Server-derived draftScope
		$config = $this->getServiceContainer()->getMainConfig();
		$expectedWiki = json_encode(
			[ $config->get( 'DBname' ), $config->get( 'DBprefix' ) ], JSON_THROW_ON_ERROR );
		$this->assertSame( $expectedWiki, $init['pageOwned']['draftScope']['wiki'] );
		$this->assertSame( (string)$actor->getId(), $init['pageOwned']['draftScope']['user'] );

		// Omission of snapshot, source URLs, and legacy set selection
		$this->assertArrayNotHasKey( 'snapshot', $init );
		$this->assertArrayNotHasKey( 'sourceUrl', $init );
		$this->assertNull( $init['imageUrl'] );
		$this->assertArrayNotHasKey( 'initialSetName', $init );
		$this->assertArrayNotHasKey( 'initialSetId', $init );

		// Asset-backed rejection
		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$this->assertFileExists( $imageFixture );
		$pngFile = $this->uploadFixtureFile( $imageFixture, 'File:J53_Asset_Rejection.png', '20260906120000' );

		$mixedDoc = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Slide Surface',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [],
					'readingOrder' => []
				],
				[
					'id' => 'diagram',
					'kind' => 'image',
					'label' => 'Image Surface',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [],
					'readingOrder' => [],
					'source' => [
						'repository' => 'local',
						'fileTitle' => 'File:J53_Asset_Rejection.png',
						'timestamp' => $pngFile->getTimestamp(),
						'sha1' => $pngFile->getSha1(),
						'page' => 1
					]
				]
			]
		];

		$mixedTitle = $this->getNonexistingTestPage()->getTitle();
		$mixedPilot = $this->configure( true, [ $mixedTitle->getPrefixedDBkey() ] );
		$mixedParams = [
			'action' => 'layerspublish',
			'owner' => $mixedTitle->getPrefixedText(),
			'baserevid' => 0,
			'data' => json_encode( $mixedDoc ),
			'maintext' => 'Mixed surface owner'
		];
		$mixedRevId = $this->doApiRequestWithToken( $mixedParams, null, $actor )[0]['layerspublish']['revid'];

		// Slide surface in mixed document prepares successfully
		$slideInit = $mixedPilot->prepareEditor( $mixedTitle->getPrefixedText(), $mixedRevId, 'presentation', $actor );
		$this->assertSame( 'presentation', $slideInit['pageOwned']['surfaceId'] );
		$this->assertTrue( $slideInit['isSlide'] );

		// An image surface opens in image mode over its exact rendition, in the surface's coordinate space
		$imageInit = $mixedPilot->prepareEditor( $mixedTitle->getPrefixedText(), $mixedRevId, 'diagram', $actor );
		$this->assertFalse( $imageInit['isSlide'] );
		$this->assertSame( 'diagram', $imageInit['pageOwned']['surfaceId'] );
		$this->assertStringContainsString( 'J53_Asset_Rejection.png', $imageInit['imageUrl'] );
		$canvas = $mixedDoc['surfaces'][1]['canvas'];
		$this->assertSame( [ $canvas['width'], $canvas['height'] ],
			[ $imageInit['baseWidth'], $imageInit['baseHeight'] ] );
		$this->assertArrayNotHasKey( 'canvasWidth', $imageInit );
	}

	public function testHistoricalViewerRejectsInvalidInputsScopesAndUnavailableRevisions(): void {
		$titleA = $this->getNonexistingTestPage()->getTitle();
		$titleB = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $titleA->getPrefixedDBkey(), $titleB->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor,
			[ 'read', 'edit', 'editlayers', 'createpage', 'createtalk', 'delete' ] );

		$fixtureJson = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$paramsA = [
			'action' => 'layerspublish',
			'owner' => $titleA->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Historical viewer Owner A content'
		];
		$revA = $this->doApiRequestWithToken( $paramsA, null, $actor )[0]['layerspublish']['revid'];

		$paramsB = [
			'action' => 'layerspublish',
			'owner' => $titleB->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Historical viewer Owner B content'
		];
		$revB = $this->doApiRequestWithToken( $paramsB, null, $actor )[0]['layerspublish']['revid'];

		$plainPage = $this->getExistingTestPage();
		$plainTitle = $plainPage->getTitle();
		$plainRevId = $plainPage->getLatest();

		$dbr = $this->getDb();
		$initialPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$initialRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$layerSetsTableExists = $dbr->tableExists( 'layer_sets' );
		$initialLayerSetsCount = $layerSetsTableExists ?
			(int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField() : 0;

		$unrelatedTitle = $this->getNonexistingTestPage()->getTitle();

		$rejectionCases = [
			'zero-revision' => [ $titleA->getPrefixedText(), 0, 'presentation' ],
			'negative-revision' => [ $titleA->getPrefixedText(), -1, 'presentation' ],
			'oversized-revision' => [ $titleA->getPrefixedText(), 2147483648, 'presentation' ],
			'empty-surface' => [ $titleA->getPrefixedText(), $revA, '' ],
			'missing-surface' => [ $titleA->getPrefixedText(), $revA, 'nonexistent_surface' ],
			'empty-owner' => [ '', $revA, 'presentation' ],
			'malformed-owner' => [ 'Invalid[]Title', $revA, 'presentation' ],
			'fragment-owner' => [ $titleA->getPrefixedText() . '#fragment', $revA, 'presentation' ],
			'unrelated-owner' => [ $unrelatedTitle->getPrefixedText(), $revA, 'presentation' ],
			'foreign-rev-A-with-B' => [ $titleA->getPrefixedText(), $revB, 'presentation' ],
			'foreign-rev-B-with-A' => [ $titleB->getPrefixedText(), $revA, 'presentation' ],
		];

		foreach ( $rejectionCases as $caseName => [ $ownerText, $revid, $surfaceId ] ) {
			try {
				$pilot->prepareViewer( $ownerText, $revid, $surfaceId, $actor );
				$this->fail( "Expected prepareViewer to throw for {$caseName}" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-revision-unavailable', $e->getMessage(),
					"Failed assertion for {$caseName}" );
			}
		}

		$disabledPilot = new PageOwnedPilot( $this->getServiceContainer(), false, [ $titleA->getPrefixedDBkey() ] );
		try {
			$disabledPilot->prepareViewer( $titleA->getPrefixedText(), $revA, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for disabled pilot' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		$emptyScopePilot = new PageOwnedPilot( $this->getServiceContainer(), true, [] );
		try {
			$emptyScopePilot->prepareViewer( $titleA->getPrefixedText(), $revA, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for empty scope pilot' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// Missing Layers slot
		$pilotWithPlain = $this->configure( true,
			[ $titleA->getPrefixedDBkey(), $plainTitle->getPrefixedDBkey() ] );
		try {
			$pilotWithPlain->prepareViewer( $plainTitle->getPrefixedText(), $plainRevId, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for page without Layers slot' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// Hidden text (DELETED_TEXT without deletedtext permission)
		$this->assertFalse( $actor->isAllowed( 'deletedtext' ) );
		$dbr->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $revA ] )
			->caller( __METHOD__ )->execute();
		try {
			$pilot->prepareViewer( $titleA->getPrefixedText(), $revA, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for DELETED_TEXT revision' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		// Restore visibility
		$dbr->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $revA ] )
			->caller( __METHOD__ )->execute();

		// Database non-mutation assertion for all non-destructive rejections
		$currentPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$currentRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $initialPageCount, $currentPageCount, 'Page table row count must remain unchanged' );
		$this->assertSame( $initialRevCount, $currentRevCount, 'Revision table row count must remain unchanged' );
		if ( $layerSetsTableExists ) {
			$currentLayerSetsCount = (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField();
			$this->assertSame( $initialLayerSetsCount, $currentLayerSetsCount,
				'Layer sets table row count must remain unchanged' );
		}

		// Deleted page after publication
		$pageToDelete = $this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $titleA );
		$delStatus = $this->getServiceContainer()->getDeletePageFactory()
			->newDeletePage( $pageToDelete, $actor )
			->deleteUnsafe( 'J56 deletion test' );
		$this->assertTrue( $delStatus->isOK() );
		try {
			$pilot->prepareViewer( $titleA->getPrefixedText(), $revA, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for deleted page' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
	}

	public function testHistoricalViewerReadOnlyAuthorityAndSpyVerification(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$author = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $author, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$json = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => $json,
			'maintext' => 'Historical viewer read-only authority test'
		];
		$firstId = $this->doApiRequestWithToken( $params, null, $author )[0]['layerspublish']['revid'];

		$updated = json_decode( $json, true );
		$updated['surfaces'][0]['layers'][0]['text'] = 'Second revision text';
		$params['data'] = json_encode( $updated );
		$params['baserevid'] = $firstId;
		$secondId = $this->doApiRequestWithToken( $params, null, $author )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $firstId, $secondId );

		// Case A: Registered reader lacking edit and editlayers
		$readerOnly = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $readerOnly, [ 'read' ] );
		$this->assertFalse( $readerOnly->isAllowed( 'edit' ) );
		$this->assertFalse( $readerOnly->isAllowed( 'editlayers' ) );
		$oldData = $pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $readerOnly );
		$this->assertSame( $firstId, $oldData['revisionId'] );
		$this->assertSame( 'presentation', $oldData['surface']['id'] );

		// Case B: Anonymous reader when page read is allowed
		$anonUser = $this->getServiceContainer()->getUserFactory()->newAnonymous();
		$anonData = $pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $anonUser );
		$this->assertSame( $firstId, $anonData['revisionId'] );
		$this->assertSame( 'presentation', $anonData['surface']['id'] );

		// Case C: Denied reader lacking read permission fails
		$this->overrideConfigValue( 'GroupPermissions', [ '*' => [ 'read' => false ] ] );
		$deniedReader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $deniedReader, [] );
		try {
			$pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $deniedReader );
			$this->fail( 'Expected prepareViewer to reject reader without read permission' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		$deniedAuthority = $this->createMock( Authority::class );
		$deniedAuthority->method( 'authorizeRead' )->willReturn( false );
		try {
			$pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $deniedAuthority );
			$this->fail( 'Expected prepareViewer to reject denied Authority' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// Case D: Authority spy — requires authorizeRead on the same owner and ensures no edit preflight
		$spy = $this->createMock( Authority::class );
		$spy->expects( $this->atLeastOnce() )
			->method( 'authorizeRead' )
			->with( 'read', $this->callback( static function ( $target ) use ( $title ) {
				return $target instanceof \MediaWiki\Title\Title
					&& $target->getPrefixedDBkey() === $title->getPrefixedDBkey();
			} ) )
			->willReturn( true );
		$spy->expects( $this->never() )->method( 'authorizeWrite' );
		$spy->expects( $this->never() )->method( 'definitelyCan' );

		$spyData = $pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $spy );
		$this->assertSame( $firstId, $spyData['revisionId'] );
		$this->assertSame( 'presentation', $spyData['surface']['id'] );
	}

	public function testHistoricalViewerDistinctRevisionsAndExactMetadataShape(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$doc1 = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Slide Surface V1',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [
						[
							'id' => 'text-1',
							'type' => 'text',
							'x' => 100,
							'y' => 100,
							'text' => 'First revision distinct slide text',
							'fontSize' => 24,
							'color' => '#000000'
						]
					],
					'readingOrder' => [ 'text-1' ]
				]
			]
		];
		$rev1Id = $this->doApiRequestWithToken( [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => json_encode( $doc1 ),
			'maintext' => 'Distinct revisions test - Rev 1'
		], null, $actor )[0]['layerspublish']['revid'];

		$doc2 = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Slide Surface V2',
					'canvas' => [
						'width' => 1280,
						'height' => 720,
						'backgroundColor' => '#204060',
						'backgroundVisible' => true,
						'backgroundOpacity' => 0.9
					],
					'layers' => [
						[
							'id' => 'text-1',
							'type' => 'text',
							'x' => 150,
							'y' => 120,
							'text' => 'Second revision changed text and geometry',
							'fontSize' => 32,
							'color' => '#ffffff'
						]
					],
					'readingOrder' => [ 'text-1' ]
				]
			]
		];
		$rev2Id = $this->doApiRequestWithToken( [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => $rev1Id,
			'data' => json_encode( $doc2 ),
			'maintext' => 'Distinct revisions test - Rev 2'
		], null, $actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $rev1Id, $rev2Id );

		$reader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );

		// Request Rev 1 after Rev 2 exists
		$old = $pilot->prepareViewer( $title->getPrefixedText(), $rev1Id, 'presentation', $reader );

		// Verify exact return shape: strictly only owner, revisionId, surface
		$this->assertSame( [ 'owner', 'revisionId', 'surface' ], array_keys( $old ) );
		$this->assertSame( $title->getPrefixedDBkey(), $old['owner'] );
		$this->assertSame( $rev1Id, $old['revisionId'] );

		// Verify absence of editor configuration, draft scope, token, live/source URLs
		$this->assertArrayNotHasKey( 'draftScope', $old );
		$this->assertArrayNotHasKey( 'filename', $old );
		$this->assertArrayNotHasKey( 'imageUrl', $old );
		$this->assertArrayNotHasKey( 'isSlide', $old );
		$this->assertArrayNotHasKey( 'autoCreate', $old );
		$this->assertArrayNotHasKey( 'readOnly', $old );
		$this->assertArrayNotHasKey( 'canvasWidth', $old );
		$this->assertArrayNotHasKey( 'canvasHeight', $old );
		$this->assertArrayNotHasKey( 'sourceUrl', $old );
		$this->assertArrayNotHasKey( 'token', $old );

		// Compare complete selected canonical surface strictly
		$canonicalDoc1 = ( new LayersDocumentContent( json_encode( $doc1 ) ) )->getCanonicalText();
		$canonicalSurface1 = json_decode( $canonicalDoc1, true )['surfaces'][0];
		$this->assertSame( $canonicalSurface1, $old['surface'] );
		$this->assertSame( 800, $old['surface']['canvas']['width'] );
		$this->assertSame( 600, $old['surface']['canvas']['height'] );
		$this->assertSame( 'First revision distinct slide text', $old['surface']['layers'][0]['text'] );
		$this->assertSame( [ 'text-1' ], $old['surface']['readingOrder'] );

		// Request Rev 2 independently
		$new = $pilot->prepareViewer( $title->getPrefixedText(), $rev2Id, 'presentation', $reader );
		$this->assertSame( [ 'owner', 'revisionId', 'surface' ], array_keys( $new ) );
		$this->assertSame( $title->getPrefixedDBkey(), $new['owner'] );
		$this->assertSame( $rev2Id, $new['revisionId'] );

		$canonicalDoc2 = ( new LayersDocumentContent( json_encode( $doc2 ) ) )->getCanonicalText();
		$canonicalSurface2 = json_decode( $canonicalDoc2, true )['surfaces'][0];
		$this->assertSame( $canonicalSurface2, $new['surface'] );
		$this->assertSame( 1280, $new['surface']['canvas']['width'] );
		$this->assertSame( 720, $new['surface']['canvas']['height'] );
		$this->assertSame( 'Second revision changed text and geometry', $new['surface']['layers'][0]['text'] );
		$this->assertSame( [ 'text-1' ], $new['surface']['readingOrder'] );
	}

	public function testHistoricalViewerAssetBackedSurfacesAndPerSurfaceSourceRule(): void {
		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$this->assertFileExists( $imageFixture );
		$pngFile = $this->uploadFixtureFile( $imageFixture, 'File:J56_Asset_Viewer.png', '20260906120000' );

		$mixedDoc = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Slide Surface',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [],
					'readingOrder' => []
				],
				[
					'id' => 'diagram',
					'kind' => 'image',
					'label' => 'Image Surface',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [],
					'readingOrder' => [],
					'source' => [
						'repository' => 'local',
						'fileTitle' => 'File:J56_Asset_Viewer.png',
						'timestamp' => $pngFile->getTimestamp(),
						'sha1' => $pngFile->getSha1(),
						'page' => 1
					]
				]
			]
		];

		$mixedTitle = $this->getNonexistingTestPage()->getTitle();
		$mixedPilot = $this->configure( true, [ $mixedTitle->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor,
			[ 'read', 'edit', 'editlayers', 'createpage', 'createtalk', 'upload' ] );

		$mixedParams = [
			'action' => 'layerspublish',
			'owner' => $mixedTitle->getPrefixedText(),
			'baserevid' => 0,
			'data' => json_encode( $mixedDoc ),
			'maintext' => 'Mixed surface historical viewer owner'
		];
		$mixedRevId = $this->doApiRequestWithToken( $mixedParams, null, $actor )[0]['layerspublish']['revid'];

		$reader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );

		// 4a. The image surface is viewable with a core rendition of its exact pinned version
		$imageData = $mixedPilot->prepareViewer( $mixedTitle->getPrefixedText(), $mixedRevId, 'diagram', $reader );
		$this->assertSame( 'image', $imageData['surface']['kind'] );
		$this->assertStringContainsString( $pngFile->getName(), rawurldecode( $imageData['source']['url'] ) );

		// 4b. Selecting the slide surface in the mixed document succeeds when source is authorized
		$slideData = $mixedPilot->prepareViewer( $mixedTitle->getPrefixedText(), $mixedRevId, 'presentation', $reader );
		$this->assertSame( 'presentation', $slideData['surface']['id'] );
		$this->assertSame( 'slide', $slideData['surface']['kind'] );
		$this->assertSame( $mixedRevId, $slideData['revisionId'] );

		// 4c. Per-surface source rule: a reader who cannot read the image file still sees the
		// unrelated slide, because one unavailable source must not hide other drawings.
		$restrictedReader = $this->createMock( Authority::class );
		$restrictedReader->method( 'getUser' )->willReturn( $reader );
		$fileTitle = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:J56_Asset_Viewer.png' );
		$restrictedReader->method( 'authorizeRead' )->willReturnCallback(
			static function ( string $action, $target ) use ( $mixedTitle, $fileTitle ) {
				if ( $target instanceof \MediaWiki\Title\Title ) {
					if ( $target->getPrefixedDBkey() === $fileTitle->getPrefixedDBkey() ) {
						// Deny access to the image file
						return false;
					}
					if ( $target->getPrefixedDBkey() === $mixedTitle->getPrefixedDBkey() ) {
						return true;
					}
				}
				return true;
			}
		);
		$restrictedSlide = $mixedPilot->prepareViewer(
			$mixedTitle->getPrefixedText(), $mixedRevId, 'presentation', $restrictedReader );
		$this->assertSame( 'presentation', $restrictedSlide['surface']['id'] );
		$this->assertSame( $slideData, $restrictedSlide );
		try {
			$mixedPilot->prepareViewer( $mixedTitle->getPrefixedText(), $mixedRevId, 'diagram', $restrictedReader );
			$this->fail( 'A reader who cannot read the file must not receive its rendition' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
	}

	private function uploadFixtureFile(
		string $fixturePath,
		string $fileTitle,
		string $timestamp = '20260906120000',
		string $comment = 'Test fixture upload'
	): LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( $fileTitle );
		$this->assertNotNull( $title, "Title for {$fileTitle} must be valid" );
		$sysop = $this->getTestSysop()->getUser();
		$file = $repo->newFile( $title );
		$status = $file->upload( $fixturePath, $comment, 'Fixture file content', 0, false, $timestamp, $sysop );
		$this->assertStatusGood( $status, "Upload of {$fileTitle} must succeed" );
		return $file;
	}
}
