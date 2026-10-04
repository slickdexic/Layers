<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Migration\FileMigrationAudit;
use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';
require_once __DIR__ . '/../../../maintenance/auditLayerSetMigration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Migration\FileMigrationAudit
 * @covers \AuditLayerSetMigration
 * @group Database
 */
class FileMigrationAuditTest extends \MediaWikiIntegrationTestCase {

	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	private function audit( ?PageHistoryAccess $access = null, ?LayersDatabase $legacy = null ): FileMigrationAudit {
		$services = $this->getServiceContainer();
		return new FileMigrationAudit( $legacy ?? $services->getService( 'LayersDatabase' ),
			$access ?? new PageHistoryAccess( $services->getRevisionLookup() ), $services->getTitleFactory() );
	}

	/** @param string $name @return array Two-page PDF, retained row IDs and the migration plan */
	private function pdf( string $name = 'Notes' ): array {
		$file = $this->upload( 'Audit_pdf_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$ids = [ $this->saveSet( $file, $name, 1, 'Private layer payload one' ),
			$this->saveSet( $file, $name, 1, 'Private layer payload two', 2 ) ];
		$plan = $this->pilot->newFilePageMigration()->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		return [ $file, $ids, $plan ];
	}

	/** @return array Row counts and migration-state bytes, without triggering deferred writes */
	private function state(): array {
		$state = [];
		foreach ( [ 'revision', 'slots', 'layer_sets', 'user', 'recentchanges' ] as $table ) {
			$state[$table] = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
				->from( $table )->caller( __METHOD__ )->fetchField();
		}
		foreach ( [ 'layer_sets' => 'ls_id', 'user' => 'user_id' ] as $table => $key ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->orderBy( $key )->caller( __METHOD__ )->fetchResultSet() as $row
			) {
				$rows[] = (array)$row;
			}
			$state[$table . '-bytes'] = hash( 'sha256', serialize( $rows ) );
		}
		$state['migration'] = $this->getDb()->newSelectQueryBuilder()->select( 'ul_value' )->from( 'updatelog' )
			->where( [ 'ul_key' => 'layers-page-history-migration' ] )->caller( __METHOD__ )->fetchField();
		return $state;
	}

	private function ownerContent( int $revisionId ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId );
		return [ 'main' => $revision->getContent( 'main' )->getText(),
			'layers' => $revision->getContent( 'layers' )->getText() ];
	}

	public function testExactOldRevisionFindsRetainedRowsAndCommandWritesNothing(): void {
		[ $file, $ids, $plan ] = $this->pdf();
		$migration = $this->pilot->newFilePageMigration();
		$first = $migration->commit( $plan, $this->actor );
		$this->saveSet( $file, 'Notes', 2, 'Newer legacy payload', 1 );
		$this->saveSet( $file, 'Notes', 2, 'Newer legacy second page', 2 );
		$changed = json_decode( $plan['document'] );
		$changed->surfaces[0]->label = 'Deliberate rename';
		foreach ( $changed->surfaces as $surface ) {
			$surface->layers[0]->text = 'Edited after migration';
		}
		$changedPlan = array_replace( $plan, [ 'baseRevisionId' => $first,
			'document' => json_encode( $changed ) ] );
		$latest = $migration->commit( $changedPlan, $this->actor );
		$this->runDeferredUpdates();
		$before = $this->state();
		$oldContent = $this->ownerContent( $first );
		$currentContent = $this->ownerContent( $latest );

		$report = $this->audit()->inspect( $file->getTitle(), $first, $this->actor );
		$this->assertSame( $first, $report['revisionId'] );
		$this->assertSame( [ 'retained-row-match', 'retained-row-match' ],
			array_column( $report['entries'], 'status' ) );
		$this->assertSame( $ids, array_column( array_column( $report['entries'], 'legacy' ), 'id' ) );
		$this->assertSame( [ 'Notes', 'Notes (page 2)' ], $report['groups'][0]['currentNames'] );
		$this->assertSame( [ 'split-current-names' ], $report['groups'][0]['issues'] );
		$this->assertSame( 'Notes', $report['groups'][0]['legacyName'] );
		$this->assertStringNotContainsString( 'Private layer payload', json_encode( $report ) );
		$this->assertFalse( $report['payloadCompared'] );
		$this->assertFalse( $report['sourceAvailabilityChecked'] );

		$current = $this->audit()->inspect( $file->getTitle(), $latest, $this->actor );
		$this->assertSame( [ 'Deliberate rename', 'Notes (page 2)' ], $current['groups'][0]['currentNames'] );
		$this->assertSame( [ 'split-current-names' ], $current['groups'][0]['issues'] );
		$this->assertSame( $ids, array_column( array_column( $current['entries'], 'legacy' ), 'id' ) );
		$this->assertFalse( $current['payloadCompared'], 'A source match does not prove unedited layers' );

		$command = new \AuditLayerSetMigration();
		$command->setOption( 'page', $file->getTitle()->getPrefixedText() );
		$command->setOption( 'revision', (string)$first );
		ob_start();
		try {
			$this->assertTrue( $command->execute() );
			$output = ob_get_contents();
		} finally {
			ob_end_clean();
		}
		$this->assertSame( $report, json_decode( $output, true, 64, JSON_THROW_ON_ERROR ) );
		$this->assertSame( $before, $this->state(), 'Audit must not create users, revisions or migration state' );
		$this->assertSame( $oldContent, $this->ownerContent( $first ), 'Preserve every old owner-slot byte' );
		$this->assertSame( $currentContent, $this->ownerContent( $latest ), 'Preserve every current owner-slot byte' );
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $latest );
		$this->assertSame( 'Edited after migration', $this->surfaces( $stored )[0]['layers'][0]['text'] );
	}

	/**
	 * @dataProvider provideSourceMismatch
	 * @param string $column
	 * @param mixed $value
	 * @param string $difference
	 */
	public function testIdAloneCannotEstablishMatchingSource( string $column, $value, string $difference ): void {
		[ $file, $ids, $plan ] = $this->pdf();
		$revision = $this->pilot->newFilePageMigration()->commit( $plan, $this->actor );
		$this->getDb()->newUpdateQueryBuilder()->update( 'layer_sets' )->set( [ $column => $value ] )
			->where( [ 'ls_id' => $ids[0] ] )->caller( __METHOD__ )->execute();
		$report = $this->audit()->inspect( $file->getTitle(), $revision, $this->actor );
		$this->assertSame( 'source-mismatch', $report['entries'][0]['status'] );
		$this->assertSame( [ $difference ], $report['entries'][0]['differences'] );
		$this->assertSame( [ $report['entries'][1]['id'] ], $report['groups'][0]['members'] );
		$this->assertContains( 'other-entry-for-legacy-name', $report['groups'][0]['issues'] );
	}

	public static function provideSourceMismatch(): array {
		return [ 'page' => [ 'ls_page', 3, 'page' ], 'sha' => [ 'ls_img_sha1', str_repeat( 'a', 31 ), 'sha1' ],
			'kind' => [ 'ls_img_major_mime', 'image', 'kind' ] ];
	}

	public function testLiteralNamesAndUnrelatedIdsAreNeverInferredFromSuffixes(): void {
		[ $file, $ids, $plan ] = $this->pdf();
		$literal = $this->saveSet( $file, 'Notes (page 2)', 1, 'A literal name' );
		$plan = $this->pilot->newFilePageMigration()->plan( $file->getName(), $this->actor );
		$document = json_decode( $plan['document'] );
		$manual = clone $document->surfaces[0];
		$manual->id = 'm-not-a-derived-id';
		$manual->label = 'Notes 2';
		$document->surfaces[] = $manual;
		$plan['document'] = json_encode( $document );
		$revision = $this->pilot->newFilePageMigration()->commit( $plan, $this->actor );
		$report = $this->audit()->inspect( $file->getTitle(), $revision, $this->actor );
		$this->assertCount( 2, $report['groups'] );
		$this->assertSame( [ 'Notes', 'Notes (page 2)' ], array_column( $report['groups'], 'legacyName' ) );
		$this->assertSame( [ FilePageMigration::surfaceId( $literal, $file->getTitle()->getArticleID() ) ],
			$report['groups'][1]['members'] );
		$this->assertSame( 'no-retained-row-match', $report['entries'][3]['status'] );
		$this->assertArrayNotHasKey( 'legacy', $report['entries'][3] );
	}

	public function testOrdinaryPageCopiesUseTheirOwnerInTheMatch(): void {
		[ $file, $ids, $plan ] = $this->pdf();
		$this->pilot->newFilePageMigration()->commit( $plan, $this->actor );
		$owner = $this->getExistingTestPage()->getTitle();
		$this->assertStatusGood( $this->editPage( $owner, '[[File:' . $file->getName() .
			'|page=2|layerset=Notes]]', '', NS_MAIN, $this->actor ) );
		$copy = $this->pilot->newPageCopyMigration();
		$copied = $copy->plan( $owner->getArticleID(), $this->actor );
		$revision = $copy->commit( $copied, $this->actor );
		$report = $this->audit()->inspect( $owner, $revision, $this->actor );
		$this->assertSame( 'retained-row-match', $report['entries'][0]['status'] );
		$this->assertSame( $ids[1], $report['entries'][0]['legacy']['id'] );
		$this->assertSame( FilePageMigration::surfaceId( $ids[1], $owner->getArticleID() ),
			$report['entries'][0]['id'] );
		$this->assertNotSame( FilePageMigration::surfaceId( $ids[1], $file->getTitle()->getArticleID() ),
			$report['entries'][0]['id'] );
	}

	/**
	 * Historical snapshots can contain combinations that current publication would refuse.
	 * Use the real structural reader validation, but substitute only the exact revision access.
	 * @param Title $owner
	 * @param \stdClass[] $surfaces
	 * @param LayersDatabase|null $legacy
	 * @return array
	 */
	private function inspectHistoricalSurfaces( Title $owner, array $surfaces,
		?LayersDatabase $legacy = null
	): array {
		$content = new LayersDocumentContent( json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) );
		$this->assertTrue( $content->isReadable() );
		$access = $this->createMock( PageHistoryAccess::class );
		$access->expects( $this->once() )->method( 'read' )->with( $owner, 123, $this->actor,
			$owner->getArticleID() )->willReturn( $content );
		return $this->audit( $access, $legacy )->inspect( $owner, 123, $this->actor );
	}

	public function testOneNameForPdfPagesAndSameNameOnAnotherFileAreIndependent(): void {
		[ $file, , $plan ] = $this->pdf();
		$surfaces = json_decode( $plan['document'] )->surfaces;
		$owner = $file->getTitle();
		foreach ( $surfaces as $surface ) {
			$surface->label = 'Unified';
		}
		$other = $this->upload( 'Audit_image_' . wfRandomString() . '.png' );
		$otherRow = $this->saveSet( $other, 'Notes', 1, 'Other file' );
		$otherPlan = $this->pilot->newFilePageMigration()->plan( $other->getName(), $this->actor );
		$otherSurface = json_decode( $otherPlan['document'] )->surfaces[0];
		$otherSurface->id = FilePageMigration::surfaceId( $otherRow, $owner->getArticleID() );
		$otherSurface->label = 'Unified';
		$surfaces[] = $otherSurface;
		$slide = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) )
			->surfaces[0];
		$slide->label = 'Unified';
		$surfaces[] = $slide;
		$report = $this->inspectHistoricalSurfaces( $owner, $surfaces );
		$this->assertCount( 2, $report['groups'] );
		$this->assertSame( [ 2, 1 ], array_map( static fn ( $group ) => count( $group['members'] ),
			$report['groups'] ) );
		$this->assertSame( [ [], [] ], array_column( $report['groups'], 'issues' ) );
		$this->assertSame( [ [ 'Unified' ], [ 'Unified' ] ], array_column( $report['groups'], 'currentNames' ) );
		$this->assertSame( 'outside-file-scope', $report['entries'][3]['status'] );
	}

	public function testHistoricalMixedPinsRepeatedPageAndUnprovenNameCollisionAreReported(): void {
		[ $file, , $plan ] = $this->pdf();
		$surfaces = json_decode( $plan['document'] )->surfaces;
		foreach ( $surfaces as $surface ) {
			$surface->label = 'Unified';
		}
		$oldSha = str_repeat( 'a', 31 );
		$oldId = $this->saveSet( $file, 'Notes', 1, 'Other source version', 1, $oldSha );
		$old = unserialize( serialize( $surfaces[0] ) );
		$old->id = FilePageMigration::surfaceId( $oldId, $file->getTitle()->getArticleID() );
		$old->source->sha1 = $oldSha;
		$old->source->timestamp = '20260901120000';
		$surfaces[] = $old;
		$manual = clone $surfaces[0];
		$manual->id = 'unproven';
		$surfaces[] = $manual;
		$report = $this->inspectHistoricalSurfaces( $file->getTitle(), $surfaces );
		$this->assertSame( [ 'multiple-source-pins', 'repeated-source-page', 'current-name-used-outside-group' ],
			$report['groups'][0]['issues'] );
		$this->assertSame( 'retained-row-match', $report['entries'][2]['status'] );
		$this->assertSame( 'no-retained-row-match', $report['entries'][3]['status'] );
		$this->assertFalse( $report['sourceAvailabilityChecked'], 'Retained metadata is not a media check' );
	}

	/**
	 * @dataProvider provideEquivalentNames
	 * @param string $name
	 * @param string $otherName
	 */
	public function testEquivalentRetainedNamesAreReportedWithoutMerging( string $name, string $otherName ): void {
		[ $file, , $plan ] = $this->pdf( $name );
		$surfaces = json_decode( $plan['document'] )->surfaces;
		$id = $this->saveSet( $file, $otherName, 1, 'Equivalent literal name retained separately' );
		$variant = clone $surfaces[0];
		$variant->id = FilePageMigration::surfaceId( $id, $file->getTitle()->getArticleID() );
		$variant->label = 'Different';
		$surfaces[] = $variant;
		$report = $this->inspectHistoricalSurfaces( $file->getTitle(), $surfaces );
		$this->assertSame( [ $name, $otherName ], array_column( $report['groups'], 'legacyName' ) );
		foreach ( $report['groups'] as $group ) {
			$this->assertContains( 'other-entry-for-legacy-name', $group['issues'] );
		}
	}

	public static function provideEquivalentNames(): array {
		return [ 'Case' => [ 'Notes', 'NOTES' ], 'Case and underscore' => [ 'Page Notes', 'page_notes' ] ];
	}

	public function testChangedSourceFilenameCannotReuseAnIdEvenWithIdenticalMedia(): void {
		[ $file, , $plan ] = $this->pdf();
		[ $other, $otherIds, $otherPlan ] = $this->pdf();
		$this->assertSame( $file->getSha1(), $other->getSha1() );
		$this->assertSame( $file->getTimestamp(), $other->getTimestamp() );
		$surfaces = json_decode( $plan['document'] )->surfaces;
		$surfaces[0]->source->fileTitle = 'File:' . $other->getName();
		$otherSurface = json_decode( $otherPlan['document'] )->surfaces[0];
		$otherSurface->id = FilePageMigration::surfaceId( $otherIds[0], $file->getTitle()->getArticleID() );
		$surfaces[] = $otherSurface;
		$report = $this->inspectHistoricalSurfaces( $file->getTitle(), $surfaces );
		$this->assertSame( [ 'no-retained-row-match', 'retained-row-match', 'retained-row-match' ],
			array_column( $report['entries'], 'status' ) );
		$this->assertArrayNotHasKey( 'legacy', $report['entries'][0] );
		$this->assertSame( [ 'File:' . $file->getName(), 'File:' . $other->getName() ],
			array_column( $report['groups'], 'fileTitle' ) );
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( $report['groups'], 'legacyName' ) );
		$this->assertSame( [ [], [ 'current-name-used-outside-group' ] ],
			array_column( $report['groups'], 'issues' ) );
		$this->assertSame( [ [ $surfaces[1]->id ], [ $otherSurface->id ] ],
			array_column( $report['groups'], 'members' ) );
	}

	public function testNoncanonicalSourceTitleStopsBeforeAnyLegacyQuery(): void {
		[ $file, , $plan ] = $this->pdf();
		$surfaces = json_decode( $plan['document'] )->surfaces;
		foreach ( $surfaces as $surface ) {
			$surface->source->fileTitle = str_replace( '_', ' ', $surface->source->fileTitle );
		}
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->never() )->method( 'listRetainedFileSetRows' );
		$report = $this->inspectHistoricalSurfaces( $file->getTitle(), $surfaces, $legacy );
		$this->assertSame( [ 'source-unavailable', 'source-unavailable' ],
			array_column( $report['entries'], 'status' ) );
		$this->assertSame( [], $report['groups'] );
		foreach ( $report['entries'] as $entry ) {
			$this->assertArrayNotHasKey( 'legacy', $entry );
		}
	}

	public function testDerivedIdFromAnotherOwnerDoesNotMatch(): void {
		[ $file, , $plan ] = $this->pdf();
		$owner = $this->getExistingTestPage()->getTitle();
		$report = $this->inspectHistoricalSurfaces( $owner, json_decode( $plan['document'] )->surfaces );
		$this->assertSame( [ 'no-retained-row-match', 'no-retained-row-match' ],
			array_column( $report['entries'], 'status' ) );
		$this->assertSame( [], $report['groups'] );
	}

	/** @param string $reason @dataProvider provideUnavailable */
	public function testUnavailableRevisionStopsBeforeAnyLegacyQuery( string $reason ): void {
		[ $file, , $plan ] = $this->pdf();
		$revision = $this->pilot->newFilePageMigration()->commit( $plan, $this->actor );
		$owner = $file->getTitle();
		$authority = $this->getTestUser()->getUser();
		if ( $reason === 'foreign' ) {
			$owner = $this->getExistingTestPage()->getTitle();
		} elseif ( $reason === 'absent-slot' ) {
			$revision = $plan['baseRevisionId'];
		} elseif ( $reason === 'zero' ) {
			$revision = 0;
		} elseif ( $reason === 'missing' ) {
			$revision = 2147483647;
		} elseif ( $reason === 'hidden' ) {
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
				->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
				->where( [ 'rev_id' => $revision ] )->caller( __METHOD__ )->execute();
		} else {
			$authority = $this->createMock( Authority::class );
			$authority->method( 'authorizeRead' )->willReturn( false );
		}
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->never() )->method( 'listRetainedFileSetRows' );
		$this->expectException( \DomainException::class );
		$this->expectExceptionMessage( 'layers-revision-unavailable' );
		$this->audit( null, $legacy )->inspect( $owner, $revision, $authority );
	}

	public static function provideUnavailable(): array {
		return [ [ 'foreign' ], [ 'absent-slot' ], [ 'zero' ], [ 'missing' ], [ 'hidden' ], [ 'denied' ] ];
	}

	public function testDeniedFileNeverQueriesRetainedNames(): void {
		[ $file, , $plan ] = $this->pdf();
		$owner = $this->getExistingTestPage()->getTitle();
		$access = $this->createMock( PageHistoryAccess::class );
		$access->expects( $this->once() )->method( 'read' )->with( $owner, 123, $this->anything(),
			$owner->getArticleID() )->willReturn( new LayersDocumentContent( $plan['document'] ) );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'authorizeRead' )->willReturn( false );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->never() )->method( 'listRetainedFileSetRows' );
		$report = $this->audit( $access, $legacy )->inspect( $owner, 123, $authority );
		$this->assertSame( [ 'source-unavailable', 'source-unavailable' ],
			array_column( $report['entries'], 'status' ) );
		$this->assertSame( [], $report['groups'] );
		$this->assertArrayNotHasKey( 'legacy', $report['entries'][0] );
	}

	public function testReadableOwnerWithDeniedSourceUsesTheRealExactRevisionReader(): void {
		[ $file, , $plan ] = $this->pdf();
		$this->pilot->newFilePageMigration()->commit( $plan, $this->actor );
		$owner = $this->getExistingTestPage()->getTitle();
		$text = '[[File:' . $file->getName() . '|page=1|layerset=Notes]]' . "\n" .
			'[[File:' . $file->getName() . '|page=2|layerset=Notes]]';
		$this->assertStatusGood( $this->editPage( $owner, $text, '', NS_MAIN, $this->actor ) );
		$copy = $this->pilot->newPageCopyMigration();
		$revision = $copy->commit( $copy->plan( $owner->getArticleID(), $this->actor ), $this->actor );
		$this->runDeferredUpdates();
		$before = $this->state();
		$content = $this->ownerContent( $revision );
		$reads = [];
		$authority = $this->createMock( Authority::class );
		$authority->expects( $this->exactly( 3 ) )->method( 'authorizeRead' )
			->willReturnCallback( static function ( string $action, Title $title ) use ( $owner, &$reads ): bool {
				$reads[] = [ $action, $title->getPrefixedDBkey() ];
				return $title->getPrefixedDBkey() === $owner->getPrefixedDBkey();
			} );
		$legacy = $this->createMock( LayersDatabase::class );
		$legacy->expects( $this->never() )->method( 'listRetainedFileSetRows' );
		$report = $this->audit( null, $legacy )->inspect( $owner, $revision, $authority );
		$this->assertSame( [ [ 'read', $owner->getPrefixedDBkey() ],
			[ 'read', $file->getTitle()->getPrefixedDBkey() ], [ 'read', $file->getTitle()->getPrefixedDBkey() ] ],
			$reads );
		$this->assertSame( $revision, $report['revisionId'] );
		$this->assertSame( [ 'source-unavailable', 'source-unavailable' ],
			array_column( $report['entries'], 'status' ) );
		$this->assertSame( [], $report['groups'] );
		foreach ( $report['entries'] as $entry ) {
			$this->assertArrayNotHasKey( 'legacy', $entry );
		}
		$this->assertSame( $content, $this->ownerContent( $revision ) );
		$this->assertSame( $before, $this->state() );
	}
}
