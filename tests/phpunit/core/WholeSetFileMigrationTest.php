<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\LegacyMediaResolver;
use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * New imports allocate once; existing imported groups are never extended or repaired.
 * @covers \MediaWiki\Extension\Layers\Migration\FilePageMigration
 * @covers \MediaWiki\Extension\Layers\Migration\MigrationNameAllocator
 * @group Database
 */
class WholeSetFileMigrationTest extends \MediaWikiIntegrationTestCase {

	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	/** @return array File, migration and retained row IDs */
	private function pdf(): array {
		$file = $this->upload( 'Whole_import_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$ids = [ $this->saveSet( $file, 'Notes', 1, 'First page' ),
			$this->saveSet( $file, 'Notes', 1, 'Second page', 2 ) ];
		return [ $file, $this->pilot->newFilePageMigration(), $ids ];
	}

	/** @param array $plan @return array */
	private function decoded( array $plan ): array {
		return json_decode( $plan['document'], true, 64, JSON_THROW_ON_ERROR )['surfaces'];
	}

	/** @return array Ordered complete rows and exact stored content bytes */
	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page' => 'page_id', 'revision' => 'rev_id',
			'slots' => [ 'slot_revision_id', 'slot_role_id' ], 'content' => 'content_id',
			'text' => 'old_id', 'layer_sets' => 'ls_id', 'updatelog' => 'ul_key' ] as $table => $order ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )->orderBy( $order )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$rows[] = (array)$row;
			}
			$state[$table] = $rows;
		}
		return $state;
	}

	public function testAllPdfMembersReceiveOneNameAndRerunWritesNothing(): void {
		[ $file, $migration, $ids ] = $this->pdf();
		$expected = [];
		foreach ( $ids as $index => $legacyId ) {
			$raw = $this->getDb()->newSelectQueryBuilder()->select( 'ls_json_blob' )->from( 'layer_sets' )
				->where( [ 'ls_id' => $legacyId ] )->caller( __METHOD__ )->fetchField();
			$data = json_decode( $raw, true, 64, JSON_THROW_ON_ERROR );
			$data['backgroundVisible'] = $index !== 0;
			$data['backgroundOpacity'] = $index === 0 ? 0.35 : 0.85;
			$data['layers'][0] += [ 'fontSize' => 21 + $index, 'color' => '#234567',
				'fontWeight' => 'bold', 'opacity' => 0.65, 'rotation' => 17,
				'visible' => false, 'locked' => true ];
			$this->getDb()->newUpdateQueryBuilder()->update( 'layer_sets' )
				->set( [ 'ls_json_blob' => json_encode( $data ) ] )->where( [ 'ls_id' => $legacyId ] )
				->caller( __METHOD__ )->execute();
			$expected[] = [
				'id' => FilePageMigration::surfaceId( $legacyId, $file->getTitle()->getArticleID() ),
				'kind' => 'pdf', 'label' => 'Notes',
				'canvas' => [ 'width' => $file->getWidth( $index + 1 ),
					'height' => $file->getHeight( $index + 1 ), 'backgroundColor' => '#ffffff',
					'backgroundVisible' => $data['backgroundVisible'],
					'backgroundOpacity' => $data['backgroundOpacity'] ],
				'source' => [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
					'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => $index + 1 ],
				'layers' => $data['layers']
			];
		}
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( $plan['add'], 'name' ) );
		$this->assertSame( $before, $this->state() );
		$surfaces = $this->decoded( $plan );
		$this->assertSame( JsonSnapshotCodec::encode( $expected ), JsonSnapshotCodec::encode( $surfaces ) );
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( $surfaces, 'label' ) );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $surfaces, 'source' ), 'page' ) );
		$this->assertSame( [ 'First page', 'Second page' ],
			array_map( static fn ( $surface ) => $surface['layers'][0]['text'], $surfaces ) );
		$this->assertSame( array_map( static fn ( $id ) =>
			FilePageMigration::surfaceId( $id, $file->getTitle()->getArticleID() ), $ids ),
			array_column( $surfaces, 'id' ) );
		$id = $migration->commit( $plan, $this->actor );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$this->assertSame( $surfaces, $this->surfaces( $revision ) );
		$this->assertSame( $before['layer_sets'], $this->state()['layer_sets'] );
		$this->assertSame( 'Moved a shared layer set into page history: "Notes"', $revision->getComment()->text );
		$before = $this->state();
		$again = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [], $again['add'] );
		$this->assertCount( 2, $again['done'] );
		$this->assertNull( $migration->commit( $again, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testOneCollisionNameAppliesToEveryIncomingPdfPage(): void {
		[ $file, $migration ] = $this->pdf();
		$existing = $migration->plan( $file->getName(), $this->actor );
		$document = json_decode( $existing['document'] );
		$document->surfaces = [ $document->surfaces[0] ];
		$document->surfaces[0]->id = 'independent-existing';
		$existing['document'] = json_encode( $document );
		$existing['add'] = array_slice( $existing['add'], 0, 1 );
		$migration->commit( $existing, $this->actor );
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [ 'Notes 2', 'Notes 2' ], array_column( $plan['add'], 'name' ) );
		$this->assertSame( [ 'Notes', 'Notes 2', 'Notes 2' ], array_column( $this->decoded( $plan ), 'label' ) );
		$this->assertSame( $before, $this->state() );
		$migration->commit( $plan, $this->actor );
	}

	public function testPartialImportedGroupIsPreservedWithoutAddingItsMissingPage(): void {
		[ $file, $migration ] = $this->pdf();
		$partial = $migration->plan( $file->getName(), $this->actor );
		$document = json_decode( $partial['document'] );
		$document->surfaces = [ $document->surfaces[0] ];
		$partial['document'] = json_encode( $document );
		$partial['add'] = array_slice( $partial['add'], 0, 1 );
		$migration->commit( $partial, $this->actor );
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [], $plan['add'] );
		$this->assertSame( [ [ 'set' => 'Notes', 'page' => 1 ] ], $plan['done'] );
		$this->assertSame( [ [ 'set' => 'Notes', 'page' => 2, 'reason' => 'existing-migration-group' ] ],
			$plan['notMoved'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testOtherFileAndSlideNamesDoNotReserveTheIncomingPdfName(): void {
		[ $file, $migration ] = $this->pdf();
		$other = $this->upload( 'Other_whole_import_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$seed = $migration->plan( $file->getName(), $this->actor );
		$foreign = $this->decoded( $seed )[0];
		$foreign['id'] = 'independent-other-file';
		$foreign['source']['fileTitle'] = 'File:' . $other->getName();
		$foreign['source']['sha1'] = $other->getSha1();
		$foreign['source']['timestamp'] = $other->getTimestamp();
		$slide = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ),
			true, 64, JSON_THROW_ON_ERROR )['surfaces'][0];
		$slide['id'] = 'independent-slide';
		$slide['label'] = 'Notes';
		$seed['document'] = JsonSnapshotCodec::encode( [ 'schemaVersion' => 1,
			'surfaces' => [ $foreign, $slide ] ] );
		$revisionId = $migration->commit( $seed, $this->actor );
		$existing = $this->surfaces( $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $revisionId ) );
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( $plan['add'], 'name' ) );
		$this->assertSame( $existing, array_slice( $this->decoded( $plan ), 0, 2 ) );
		$this->assertSame( $before, $this->state() );
		$revisionId = $migration->commit( $plan, $this->actor );
		$stored = $this->surfaces( $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId ) );
		$this->assertSame( $existing, array_slice( $stored, 0, 2 ) );
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( array_slice( $stored, 2 ), 'label' ) );
		$this->assertSame( $before['layer_sets'], $this->state()['layer_sets'] );
	}

	public function testInvalidLiteralNameRefusesEveryMemberWithoutIdFallback(): void {
		[ $file, $migration, $ids ] = $this->pdf();
		$this->getDb()->newUpdateQueryBuilder()->update( 'layer_sets' )->set( [ 'ls_name' => '   ' ] )
			->where( [ 'ls_id' => $ids ] )->caller( __METHOD__ )->execute();
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [], $plan['add'] );
		$this->assertNull( $plan['document'] );
		$this->assertSame( [ [ 'set' => '   ', 'page' => 1, 'reason' => 'invalid-layer-set-name' ],
			[ 'set' => '   ', 'page' => 2, 'reason' => 'invalid-layer-set-name' ] ], $plan['notMoved'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testNewLegacySavesDoNotCreateAnotherBranchOfAnAlreadyImportedGroup(): void {
		[ $file, $migration ] = $this->pdf();
		$initial = $migration->plan( $file->getName(), $this->actor );
		$document = json_decode( $initial['document'] );
		foreach ( $document->surfaces as $surface ) {
			$surface->label = 'Owner renamed';
			$surface->layers[0]->text = 'Owner edited ' . $surface->source->page;
		}
		$initial['document'] = json_encode( $document );
		$migration->commit( $initial, $this->actor );
		$this->saveSet( $file, 'Notes', 2, 'New first page' );
		$this->saveSet( $file, 'Notes', 2, 'New second page', 2 );
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [], $plan['add'] );
		$this->assertSame( [ 'existing-migration-group', 'existing-migration-group' ],
			array_column( $plan['notMoved'], 'reason' ) );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testCurrentImportedIdBlocksExtensionWithoutRetainedMetadata(): void {
		[ $file, $migration ] = $this->pdf();
		$partial = $migration->plan( $file->getName(), $this->actor );
		$document = json_decode( $partial['document'] );
		$document->surfaces = [ $document->surfaces[0] ];
		$partial['document'] = json_encode( $document );
		$partial['add'] = array_slice( $partial['add'], 0, 1 );
		$migration->commit( $partial, $this->actor );
		$services = $this->getServiceContainer();
		$real = $services->getService( 'LayersDatabase' );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->method( 'listRetainedFileSetRows' )->willReturn( [] );
		$legacy->method( 'listLatestSetRows' )->willReturn(
			$real->listLatestSetRows( $file->getName(), $file->getSha1() ) );
		$legacy->method( 'getLayerSetForAdoption' )->willReturnCallback(
			static fn ( $id ) => $real->getLayerSetForAdoption( $id ) );
		$lookup = $services->getRevisionLookup();
		$publisher = $this->createMock( PagePublicationService::class );
		$publisher->expects( $this->never() )->method( 'publish' );
		$migration = new FilePageMigration( $legacy, $this->pilot->getScope(), $services->getRepoGroup(),
			$services->getTitleFactory(), $lookup, new PageHistoryAccess( $lookup ),
			new LegacyMediaResolver( new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
				$services->getTitleFactory() ) ), new LegacySurfaceConverter(), $publisher );
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [], $plan['add'] );
		$this->assertSame( [ [ 'set' => 'Notes', 'page' => 1 ] ], $plan['done'] );
		$this->assertSame( [ [ 'set' => 'Notes', 'page' => 2, 'reason' => 'existing-migration-group' ] ],
			$plan['notMoved'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testUnconvertibleMemberPreventsPartialImportOfItsGroup(): void {
		[ $file, $migration, $ids ] = $this->pdf();
		$this->getDb()->newUpdateQueryBuilder()->update( 'layer_sets' )
			->set( [ 'ls_json_blob' => '{"revision":1}' ] )->where( [ 'ls_id' => $ids[1] ] )
			->caller( __METHOD__ )->execute();
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [], $plan['add'] );
		$this->assertSame( [ [ 'set' => 'Notes', 'page' => 1, 'reason' => 'incomplete-layer-set' ],
			[ 'set' => 'Notes', 'page' => 2, 'reason' => 'unconvertible' ] ], $plan['notMoved'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testCompleteHistoricSplitNamesRemainUnchangedOnRerun(): void {
		[ $file, $migration ] = $this->pdf();
		$old = $migration->plan( $file->getName(), $this->actor );
		$document = json_decode( $old['document'] );
		$document->surfaces[1]->label = 'Notes (page 2)';
		$old['document'] = json_encode( $document );
		$old['add'][1]['name'] = 'Notes (page 2)';
		$migration->commit( $old, $this->actor );
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [], $plan['add'] );
		$this->assertCount( 2, $plan['done'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testPriorSourceVersionImportBlocksAnAutomaticNewVersionBranch(): void {
		[ $file, $migration ] = $this->pdf();
		$migration->commit( $migration->plan( $file->getName(), $this->actor ), $this->actor );
		$sha1 = $file->getSha1();
		$file = $this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20260907120000' );
		$this->assertNotSame( $sha1, $file->getSha1() );
		$this->saveSet( $file, 'Notes', 1, 'New version first' );
		$this->saveSet( $file, 'Notes', 1, 'New version second', 2 );
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [], $plan['add'] );
		$this->assertSame( [ 'existing-migration-group', 'existing-migration-group' ],
			array_column( $plan['notMoved'], 'reason' ) );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testEquivalentLiteralNamesRemainTwoDistinctPdfGroups(): void {
		$file = $this->upload( 'Literal_groups_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		foreach ( [ 'Pump labels', 'pump_labels' ] as $name ) {
			$this->saveSet( $file, $name, 1, $name . ' one' );
			$this->saveSet( $file, $name, 1, $name . ' two', 2 );
		}
		$migration = $this->pilot->newFilePageMigration();
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertCount( 4, $plan['add'] );
		$groups = [];
		foreach ( $plan['add'] as $entry ) {
			$groups[$entry['set']][] = $entry['name'];
		}
		$this->assertCount( 2, $groups );
		foreach ( $groups as $names ) {
			$this->assertCount( 2, $names );
			$this->assertCount( 1, array_unique( $names ) );
		}
		$this->assertCount( 2, array_unique( array_map( [ DrawingName::class, 'key' ],
			array_column( $plan['add'], 'name' ) ) ) );
		$this->assertSame( $before, $this->state() );
		$migration->commit( $plan, $this->actor );
	}

	public function testRefusedGroupDoesNotPreventAnIndependentCompleteGroup(): void {
		[ $file, $migration, $ids ] = $this->pdf();
		$other = $this->saveSet( $file, 'Other', 1, 'Independent' );
		$this->getDb()->newUpdateQueryBuilder()->update( 'layer_sets' )
			->set( [ 'ls_json_blob' => '{"revision":1}' ] )->where( [ 'ls_id' => $ids[1] ] )
			->caller( __METHOD__ )->execute();
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [ $other ], array_column( $plan['add'], 'legacyId' ) );
		$this->assertSame( [ 'Other' ], array_column( $this->decoded( $plan ), 'label' ) );
		$this->assertSame( [ 'incomplete-layer-set', 'unconvertible' ],
			array_column( $plan['notMoved'], 'reason' ) );
		$this->assertSame( $before, $this->state() );
		$migration->commit( $plan, $this->actor );
		$this->assertSame( $before['layer_sets'], $this->state()['layer_sets'] );
	}

	/** @param string $mismatch @dataProvider provideChangedGroup */
	public function testChangedGroupDuringConversionRefusesThePlan( string $mismatch ): void {
		[ $file ] = $this->pdf();
		$this->saveSet( $file, 'Independent', 1, 'Complete independent payload' );
		$services = $this->getServiceContainer();
		$real = $services->getService( 'LayersDatabase' );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->method( 'listLatestSetRows' )->willReturn(
			$real->listLatestSetRows( $file->getName(), $file->getSha1() ) );
		$legacy->method( 'listRetainedFileSetRows' )->willReturn( $real->listRetainedFileSetRows( $file->getName() ) );
		$legacy->method( 'getLayerSetForAdoption' )->willReturnCallback(
			static fn ( $id ) => $real->getLayerSetForAdoption( $id ) );
		$realConverter = new LegacySurfaceConverter();
		$converter = $this->createMock( LegacySurfaceConverter::class );
		$converter->method( 'convert' )->willReturnCallback(
			static function ( $record, $id, $media ) use ( $realConverter, $mismatch ) {
				// A changed primary name or mixed topology after a stale row-list read.
				if ( $mismatch === 'renamed' && $record['name'] === 'Notes' ) {
					$record['name'] = 'Renamed after row selection';
				}
				$document = json_decode( $realConverter->convert( $record, $id, $media ) );
				if ( $mismatch === 'mixed-kind' && $record['name'] === 'Notes' && $record['page'] === 1 ) {
					$document->surfaces[0]->kind = 'image';
				}
				return json_encode( $document );
			} );
		$lookup = $services->getRevisionLookup();
		$publisher = $this->createMock( PagePublicationService::class );
		$publisher->expects( $this->never() )->method( 'publish' );
		$migration = new FilePageMigration( $legacy, $this->pilot->getScope(), $services->getRepoGroup(),
			$services->getTitleFactory(), $lookup, new PageHistoryAccess( $lookup ),
			new LegacyMediaResolver( new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
				$services->getTitleFactory() ) ), $converter, $publisher );
		$before = $this->state();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( 'changed-legacy-group', $plan['problem'] );
		$this->assertSame( [], $plan['add'] );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideChangedGroup(): array {
		return [ [ 'renamed' ], [ 'mixed-kind' ] ];
	}
}
