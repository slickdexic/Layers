<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Migration\PageCopyMigration;
use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedBinding;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Revision\MutableRevisionRecord;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Whole source groups retain names, payloads, order and provenance during copy migration.
 * @covers \MediaWiki\Extension\Layers\Migration\PageCopyMigration
 * @group Database
 */
class WholeSetPageCopyMigrationTest extends \MediaWikiIntegrationTestCase {

	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	/** @param Title $title @return RevisionRecord */
	private function latest( Title $title ): RevisionRecord {
		return $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $title );
	}

	/** @param string $text @return Title */
	private function owner( string $text ): Title {
		$title = $this->getExistingTestPage()->getTitle();
		$this->assertStatusGood( $this->editPage( $title, $text, '', NS_MAIN, $this->actor ) );
		return $title;
	}

	/** @param LocalFile $file @return int */
	private function stepOne( LocalFile $file ): int {
		$migration = $this->pilot->newFilePageMigration();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$id = $migration->commit( $plan, $this->actor );
		$this->assertNotNull( $id );
		return $id;
	}

	/** @return array Ordered complete rows of the explicitly captured fixture tables */
	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page' => 'page_id', 'revision' => 'rev_id',
			'slots' => [ 'slot_revision_id', 'slot_role_id' ], 'content' => 'content_id',
			'text' => 'old_id', 'layer_sets' => 'ls_id', 'updatelog' => 'ul_key',
			'page_props' => [ 'pp_page', 'pp_propname' ] ] as $table => $order
		) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )->orderBy( $order )
				->caller( __METHOD__ )->fetchResultSet() as $row
			) {
				$rows[] = (array)$row;
			}
			$state[$table] = $rows;
		}
		return $state;
	}

	/** @param LocalFile $file @param int $row @param int $owner @param int $page @param string $text @return array */
	private function expected( LocalFile $file, int $row, int $owner, int $page, string $text ): array {
		return [
			'id' => FilePageMigration::surfaceId( $row, $owner ),
			'kind' => $file->getMimeType() === 'application/pdf' ? 'pdf' : 'image', 'label' => 'Notes',
			'canvas' => [ 'width' => $file->getWidth( $page ), 'height' => $file->getHeight( $page ),
				'backgroundColor' => '#ffffff', 'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'source' => [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
				'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => $page ],
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 10, 'y' => 20, 'text' => $text ] ]
		];
	}

	/** @param string $name @return array File, page-indexed retained row IDs and admitted File-page revision */
	private function pdf( string $name = 'Notes' ): array {
		$file = $this->upload( 'Copy_group_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$rows = [ 1 => $this->saveSet( $file, $name, 1, 'First member payload', 1 ),
			2 => $this->saveSet( $file, $name, 1, 'Second member payload', 2 ) ];
		return [ $file, $rows, $this->stepOne( $file ) ];
	}

	/** @param LocalFile $file @param int $page @return string */
	private function embed( LocalFile $file, int $page ): string {
		return '[[File:' . $file->getName() . '|thumb|120px|page=' . $page . '|layerset=Notes]]';
	}

	public function testSelectedPdfMembersReceiveOneName(): void {
		[ $file, $rows, $sourceRevision ] = $this->pdf();
		$text = $this->embed( $file, 2 ) . "\n" . $this->embed( $file, 1 ) . "\n" . $this->embed( $file, 2 );
		$title = $this->owner( $text );
		$before = $this->state();
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( $before, $this->state(), 'Planning preserves every captured table row' );
		$this->assertNull( $plan['problem'] );
		$surfaces = json_decode( $plan['document'], true, 64, JSON_THROW_ON_ERROR )['surfaces'];
		$this->assertCount( 2, $surfaces, 'Repeated embeds do not add members' );
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( $surfaces, 'label' ),
			'PDF pages retain one layer-set name regardless of embed order' );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $surfaces, 'source' ), 'page' ),
			'Keep admitted source order even when page 2 is embedded first' );
		$this->assertSame( JsonSnapshotCodec::encode( [
			$this->expected( $file, $rows[1], $title->getArticleID(), 1, 'First member payload' ),
			$this->expected( $file, $rows[2], $title->getArticleID(), 2, 'Second member payload' )
		] ), JsonSnapshotCodec::encode( $surfaces ) );
		$this->assertSame( [ $sourceRevision ],
			array_values( array_unique( array_column( $plan['copies'], 'sourceRevision' ) ) ) );
		$expectedMain = str_replace( '|layerset=Notes', '|layerset=' . $title->getArticleID() . ':Notes', $text );
		$this->assertSame( $expectedMain, $plan['main'] );
	}

	public function testOtherFileDoesNotReserveTheName(): void {
		$one = $this->upload( 'Copy_scope_a_' . wfRandomString() . '.png' );
		$two = $this->upload( 'Copy_scope_b_' . wfRandomString() . '.png' );
		$oneId = $this->saveSet( $one, 'Notes', 1, 'File A payload' );
		$twoId = $this->saveSet( $two, 'Notes', 1, 'File B payload' );
		$this->stepOne( $one );
		$this->stepOne( $two );
		$title = $this->owner( $this->embed( $one, 1 ) . "\n" . $this->embed( $two, 1 ) );
		$before = $this->state();
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( $before, $this->state() );
		$this->assertNull( $plan['problem'] );
		$surfaces = json_decode( $plan['document'], true, 64, JSON_THROW_ON_ERROR )['surfaces'];
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( $surfaces, 'label' ),
			'Equal names on different files are distinct valid layer sets' );
		$this->assertSame( JsonSnapshotCodec::encode( [
			$this->expected( $one, $oneId, $title->getArticleID(), 1, 'File A payload' ),
			$this->expected( $two, $twoId, $title->getArticleID(), 1, 'File B payload' )
		] ), JsonSnapshotCodec::encode( $surfaces ) );
	}

	public function testPageTwoEmbedCopiesEveryStoredMemberOfTheSelectedGroup(): void {
		[ $file, $rows ] = $this->pdf();
		$title = $this->owner( $this->embed( $file, 2 ) );
		$before = $this->state();
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( $before, $this->state() );
		$this->assertNull( $plan['problem'] );
		$surfaces = json_decode( $plan['document'], true, 64, JSON_THROW_ON_ERROR )['surfaces'];
		$this->assertCount( 2, $surfaces, 'The approved PDF layer set holds every stored member' );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $surfaces, 'source' ), 'page' ) );
		$this->assertSame( JsonSnapshotCodec::encode( [
			$this->expected( $file, $rows[1], $title->getArticleID(), 1, 'First member payload' ),
			$this->expected( $file, $rows[2], $title->getArticleID(), 2, 'Second member payload' )
		] ), JsonSnapshotCodec::encode( $surfaces ) );
	}

	/** @param Title $title @param array $surfaces @return int */
	private function seed( Title $title, array $surfaces ): int {
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$plan['document'] = JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] );
		$plan['copies'] = [];
		$plan['sources'] = [];
		$plan['main'] = null;
		return $migration->commit( $plan, $this->actor );
	}

	/** @param LocalFile $file @param array $surfaces @return int */
	private function sourceDocument( LocalFile $file, array $surfaces ): int {
		$migration = $this->pilot->newFilePageMigration();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$plan['document'] = JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] );
		return $migration->commit( $plan, $this->actor );
	}

	/** @param LayersDatabase|null $legacy @param PageHistoryAccess|null $access @return PageCopyMigration */
	private function neverPublishing( ?LayersDatabase $legacy = null, ?PageHistoryAccess $access = null
	): PageCopyMigration {
		$services = $this->getServiceContainer();
		$lookup = $services->getRevisionLookup();
		$publisher = $this->createMock( PagePublicationService::class );
		$publisher->expects( $this->never() )->method( 'publish' );
		$targets = static function ( string $raw ) use ( $services ): ?string {
			$title = $services->getTitleFactory()->newFromText( $raw );
			return $title && $title->getNamespace() === NS_FILE ? $title->getPrefixedDBkey() : null;
		};
		return new PageCopyMigration( $legacy ?? $services->getService( 'LayersDatabase' ),
			$this->pilot->getScope(), $services->getRepoGroup(), $services->getTitleFactory(), $lookup,
			$access ?? new PageHistoryAccess( $lookup ), new LegacySurfaceConverter(),
			new DirectEmbeddingRewriter( $services->getParserFactory()->create()->getTags() ), $targets,
			$services->getConnectionProvider(), $publisher );
	}

	public function testCompleteEditedHistoricSplitsKeepTheirBytesAndPageSpecificReferences(): void {
		[ $file, $rows ] = $this->pdf();
		$text = $this->embed( $file, 1 ) . "\n" . $this->embed( $file, 2 );
		$title = $this->owner( $text );
		$one = $this->expected( $file, $rows[1], $title->getArticleID(), 1, 'Owner edited first' );
		$two = $this->expected( $file, $rows[2], $title->getArticleID(), 2, 'Owner edited second' );
		$one['label'] = 'Owner renamed';
		$two['label'] = 'Historic split';
		$this->seed( $title, [ $one, $two ] );
		$before = $this->state();
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [], $plan['copies'] );
		$this->assertSame( [ 'Owner renamed', 'Historic split' ], $plan['done'] );
		$this->assertSame( JsonSnapshotCodec::encode( [ $one, $two ] ),
			JsonSnapshotCodec::encode( json_decode( $plan['document'], true )['surfaces'] ) );
		$this->assertSame( str_replace( '|layerset=Notes', '|layerset=' . $title->getArticleID() .
			':Owner renamed', $this->embed( $file, 1 ) ) . "\n" . str_replace( '|layerset=Notes',
			'|layerset=' . $title->getArticleID() . ':Historic split', $this->embed( $file, 2 ) ), $plan['main'] );
		$this->assertSame( $before, $this->state() );
	}

	public function testPartialCurrentImportDoesNotAppendOrRewriteMissingMembers(): void {
		[ $file, $rows ] = $this->pdf();
		$title = $this->owner( $this->embed( $file, 2 ) );
		$one = $this->expected( $file, $rows[1], $title->getArticleID(), 1, 'Owner edited first' );
		$one['label'] = 'Owner renamed';
		$this->seed( $title, [ $one ] );
		$before = $this->state();
		$migration = $this->neverPublishing();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [], $plan['copies'], 'A partial current-ID family must not grow another member' );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $plan['main'] );
		$this->assertSame( 'existing-migration-group', $plan['notMoved'][0]['reason'] );
		$this->assertSame( [ $rows[2] ], $plan['notMoved'][0]['missing'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	/** @dataProvider providePriorImport @param bool $version */
	public function testPriorSaveOrVersionDoesNotCreateAnotherImport( bool $version ): void {
		[ $file, $rows ] = $this->pdf();
		$title = $this->owner( $this->embed( $file, 2 ) );
		$old = $this->expected( $file, $rows[1], $title->getArticleID(), 1, 'Owner retained earlier import' );
		$old['label'] = 'Owner renamed';
		$this->seed( $title, [ $old ] );
		if ( $version ) {
			$file = $this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20260907120000' );
			$this->assertStatusGood( $this->editPage( $title, $this->embed( $file, 1 ), '', NS_MAIN,
				$this->actor ) );
		}
		$newRows = [ 1 => $this->saveSet( $file, 'Notes', $version ? 1 : 2, 'New first', 1 ) ];
		$source = [ $this->expected( $file, $newRows[1], $file->getTitle()->getArticleID(), 1, 'New first' ) ];
		if ( !$version ) {
			$newRows[2] = $this->saveSet( $file, 'Notes', 2, 'New second', 2 );
			$source[] = $this->expected( $file, $newRows[2], $file->getTitle()->getArticleID(), 2, 'New second' );
		}
		$this->sourceDocument( $file, $source );
		$before = $this->state();
		$migration = $this->neverPublishing();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [], $plan['copies'], 'Retained prior IDs block another import, not just current IDs' );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $plan['main'] );
		$this->assertSame( 'existing-migration-group', $plan['notMoved'][0]['reason'] );
		$this->assertSame( array_values( $newRows ), $plan['notMoved'][0]['missing'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function providePriorImport(): array {
		return [ 'earlier save' => [ false ], 'earlier version' => [ true ] ];
	}

	/** @dataProvider provideWrongIdentity @param string $mismatch */
	public function testExistingIdsDoNotAuthorizeWrongScopeOrPage( string $mismatch ): void {
		[ $file, $rows ] = $this->pdf();
		$title = $this->owner( $this->embed( $file, 2 ) );
		$one = $this->expected( $file, $rows[1], $title->getArticleID(), 1, 'Unrelated payload' );
		if ( $mismatch === 'scope' ) {
			$other = $this->upload( 'Other_scope_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
			$one['source'] = $this->expected( $other, $rows[1], $title->getArticleID(), 1, '' )['source'];
		} else {
			$one['source']['page'] = 2;
		}
		$this->seed( $title, [ $one ] );
		$before = $this->state();
		$migration = $this->neverPublishing();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( 'changed-copy-scope', $plan['problem'] );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $plan['main'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideWrongIdentity(): array {
		return [ 'different file' => [ 'scope' ], 'different page' => [ 'page' ] ];
	}

	public function testUnmappedNativeMemberRefusesTheWholeGroup(): void {
		[ $file ] = $this->pdf();
		$source = $this->surfaces( $this->latest( $file->getTitle() ) );
		$source[1]['id'] = 'native-member-without-provenance';
		$this->sourceDocument( $file, $source );
		$title = $this->owner( $this->embed( $file, 1 ) );
		$before = $this->state();
		$migration = $this->neverPublishing();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [], $plan['copies'] );
		$this->assertSame( 'unmapped-source-member', $plan['notMoved'][0]['reason'] );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testMissingRetainedMetadataNeverInventsProvenance(): void {
		[ $file, $rows ] = $this->pdf();
		$title = $this->owner( $this->embed( $file, 1 ) );
		$this->getDb()->newDeleteQueryBuilder()->deleteFrom( 'layer_sets' )
			->where( [ 'ls_id' => $rows[2] ] )->caller( __METHOD__ )->execute();
		$before = $this->state();
		$migration = $this->neverPublishing();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [], $plan['copies'] );
		$this->assertSame( 'unmapped-source-member', $plan['notMoved'][0]['reason'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testScopedCollisionAllocatesOnceWithoutChangingPayloadOrExistingBytes(): void {
		[ $file, $rows ] = $this->pdf();
		$title = $this->owner( $this->embed( $file, 2 ) );
		$competitor = $this->expected( $file, $rows[1], $title->getArticleID(), 1, 'Existing competitor' );
		$competitor['id'] = 'independent-competitor';
		$this->seed( $title, [ $competitor ] );
		$before = $this->state();
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [ 'Notes 2', 'Notes 2' ], array_column( $plan['copies'], 'name' ) );
		$expected = [ $competitor ];
		foreach ( $rows as $page => $row ) {
			$surface = $this->expected( $file, $row, $title->getArticleID(), $page,
				$page === 1 ? 'First member payload' : 'Second member payload' );
			$surface['label'] = 'Notes 2';
			$expected[] = $surface;
		}
		$this->assertSame( JsonSnapshotCodec::encode( $expected ),
			JsonSnapshotCodec::encode( json_decode( $plan['document'], true )['surfaces'] ) );
		$this->assertStringContainsString( '|layerset=' . $title->getArticleID() . ':Notes 2', $plan['main'] );
		$this->assertSame( $before, $this->state() );
	}

	public function testChangedPinsAndPayloadComeFromTheAdmittedSnapshotNotRetainedRows(): void {
		[ $file, $rows ] = $this->pdf();
		$path = tempnam( sys_get_temp_dir(), 'layers-j113n-' );
		file_put_contents( $path, file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) .
			"\n% J113N distinct source version\n" );
		try {
			$changed = $this->getServiceContainer()->getRepoGroup()->getLocalRepo()->newFile( $file->getTitle() );
			$this->assertStatusGood( $changed->upload( $path, 'Fixture', '', 0, false, '20260907120000',
				$this->actor ) );
		} finally {
			unlink( $path );
		}
		$this->assertNotSame( $file->getTimestamp(), $changed->getTimestamp() );
		$this->assertNotSame( $file->getSha1(), $changed->getSha1() );
		$currentId = $this->saveSet( $changed, 'Notes', 1, 'Current row is not the admitted payload', 1 );
		$source = [ $this->expected( $changed, $currentId, $file->getTitle()->getArticleID(), 1, 'Changed first' ),
			$this->expected( $changed, $rows[2], $file->getTitle()->getArticleID(), 2, 'Changed second' ) ];
		$sourceRevision = $this->sourceDocument( $changed, $source );
		$title = $this->owner( $this->embed( $changed, 1 ) );
		$before = $this->state();
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertCount( 2, $plan['copies'] );
		$source[0]['id'] = FilePageMigration::surfaceId( $currentId, $title->getArticleID() );
		$source[1]['id'] = FilePageMigration::surfaceId( $rows[2], $title->getArticleID() );
		$this->assertSame( JsonSnapshotCodec::encode( $source ),
			JsonSnapshotCodec::encode( json_decode( $plan['document'], true )['surfaces'] ) );
		$this->assertSame( [ $sourceRevision, $sourceRevision ], array_column( $plan['copies'], 'sourceRevision' ) );
		$this->assertSame( $before, $this->state() );
		$this->assertNotNull( $migration->commit( $plan, $this->actor ), 'Normal publication admits the changed pins' );
	}

	public function testOneSnapshotPerFileAndStateResetBetweenPlans(): void {
		[ $file, , $revision ] = $this->pdf();
		$owner = $this->owner( $this->embed( $file, 2 ) . "\n" . $this->embed( $file, 1 ) );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$real = new PageHistoryAccess( $lookup );
		$access = $this->createMock( PageHistoryAccess::class );
		$access->expects( $this->exactly( 2 ) )->method( 'read' )->willReturnCallback(
			static fn ( $title, $id, $authority, $page ) => $real->read( $title, $id, $authority, $page ) );
		$migration = $this->neverPublishing( null, $access );
		$before = $this->state();
		$first = $migration->plan( $owner->getArticleID(), $this->actor );
		$this->assertSame( [ $revision, $revision ], array_column( $first['copies'], 'sourceRevision' ) );
		$this->assertSame( $before, $this->state() );
		$source = $this->surfaces( $this->latest( $file->getTitle() ) );
		$source[1]['layers'][0]['text'] = 'New admitted second member';
		$newRevision = $this->sourceDocument( $file, $source );
		$before = $this->state();
		$second = $migration->plan( $owner->getArticleID(), $this->actor );
		$this->assertSame( [ $newRevision, $newRevision ], array_column( $second['copies'], 'sourceRevision' ) );
		$this->assertSame( 'New admitted second member',
			json_decode( $second['document'], true )['surfaces'][1]['layers'][0]['text'] );
		$this->assertSame( $before, $this->state() );
	}

	public function testPendingInputIsCachedOnceAndIsNotSourcePermissionEvidence(): void {
		$file = $this->upload( 'Pending_group_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$this->saveSet( $file, 'Notes', 1, 'Pending first', 1 );
		$this->saveSet( $file, 'Notes', 1, 'Pending second', 2 );
		$pending = $this->pilot->newFilePageMigration()->plan( $file->getName(), $this->actor );
		$owner = $this->owner( $this->embed( $file, 2 ) . "\n" . $this->embed( $file, 1 ) );
		$count = 0;
		$provider = static function () use ( &$count, $pending ): string {
			$count++;
			return $pending['document'];
		};
		$migration = $this->neverPublishing();
		$before = $this->state();
		$plan = $migration->plan( $owner->getArticleID(), $this->actor, $provider );
		$this->assertSame( 1, $count );
		$this->assertSame( [ null, null ], array_column( $plan['copies'], 'sourceRevision' ) );
		$this->assertSame( $before, $this->state() );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
			->where( [ 'rev_id' => $this->latest( $file->getTitle() )->getId() ] )->caller( __METHOD__ )->execute();
		$before = $this->state();
		$plan = $migration->plan( $owner->getArticleID(), $this->actor, $provider );
		$this->assertSame( [], $plan['copies'] );
		$this->assertSame( 'source-unavailable', $plan['notMoved'][0]['reason'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testSourceChangeAfterPlanningRefusesPublicationWithoutDestinationWrites(): void {
		[ $file ] = $this->pdf();
		$owner = $this->owner( $this->embed( $file, 2 ) );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $owner->getArticleID(), $this->actor );
		$this->assertStatusGood( $this->editPage( $file->getTitle(), 'New source main', '', NS_MAIN, $this->actor ) );
		$before = $this->state();
		try {
			$migration->commit( $plan, $this->actor );
			$this->fail( 'A stale admitted source must not publish' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertSame( $before, $this->state() );
	}

	public function testSuppressionAfterPlanningRefusesPublicationWithoutWrites(): void {
		[ $file, , $revision ] = $this->pdf();
		$owner = $this->owner( $this->embed( $file, 2 ) );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $owner->getArticleID(), $this->actor );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
			->where( [ 'rev_id' => $revision ] )->caller( __METHOD__ )->execute();
		$before = $this->state();
		try {
			$migration->commit( $plan, $this->actor );
			$this->fail( 'A suppressed admitted source must not publish' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertSame( $before, $this->state() );
	}

	/** @dataProvider provideTemplateCollision @param bool $competitor @param bool $numbered */
	public function testDirectAndUnchangedTemplateMustResolveTheSameGroup( bool $competitor,
		bool $numbered = false
	): void {
		[ $file, $rows ] = $this->pdf();
		if ( $numbered ) {
			$source = $this->surfaces( $this->latest( $file->getTitle() ) );
			foreach ( $source as &$member ) {
				$member['label'] = 'Notes 2';
			}
			unset( $member );
			$this->sourceDocument( $file, $source );
		}
		$template = Title::makeTitle( NS_TEMPLATE, 'Copy_template_' . wfRandomString() );
		$this->assertStatusGood( $this->editPage( $template, $this->embed( $file, 2 ), '', NS_MAIN, $this->actor ) );
		$transclusion = '{{' . $template->getText() . '}}';
		$text = $this->embed( $file, 2 ) . "\n" . $transclusion . "\n" . $this->embed( $file, 1 ) .
			"\n" . $transclusion;
		$title = $this->owner( $text );
		if ( $competitor ) {
			$existing = $this->expected( $file, $rows[2], $title->getArticleID(), 2, 'Wrong exact-name competitor' );
			$existing['id'] = 'exact-name-competitor';
			$this->seed( $title, [ $existing ] );
		}
		$this->runDeferredUpdates();
		$before = $this->state();
		$migration = $competitor ? $this->neverPublishing() : $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		if ( $competitor ) {
			$this->assertSame( [], $plan['copies'], 'Direct dedup must not conceal an unchanged template constraint' );
			$this->assertNull( $plan['document'] );
			$this->assertNull( $plan['main'] );
			$this->assertSame( 'template-name-taken', $plan['notMoved'][0]['reason'] );
			$this->assertNull( $migration->commit( $plan, $this->actor ) );
			$this->assertSame( $before, $this->state() );
			return;
		}
		$expectedName = $numbered ? 'Notes 2' : 'Notes';
		$this->assertSame( [ $expectedName, $expectedName ], array_column( $plan['copies'], 'name' ) );
		$this->assertSame( [ true, true ], array_column( $plan['copies'], 'template' ) );
		$this->assertSame( [ 1, 1 ], array_column( $plan['copies'], 'embeds' ) );
		$this->assertSame( 2, substr_count( $plan['main'], $transclusion ) );
		$this->assertSame( $before, $this->state() );
		$migration->commit( $plan, $this->actor );
		$options = ParserOptions::newFromAnon();
		$options->setOption( MigrationState::PARSER_OPTION, true );
		$revision = $this->latest( $title );
		$output = $this->getServiceContainer()->getParserFactory()->create()->parse(
			$revision->getContent( 'main' )->getText(), $title, $options, true, true, $revision->getId() );
		$id = FilePageMigration::surfaceId( $rows[2], $title->getArticleID() );
		$this->assertSame( 3, substr_count( $output->getRawText(),
			'data-layers-binding="v1:' . $title->getArticleID() . ':' . $id . '"' ) );
		$surfaces = $this->surfaces( $revision );
		$resolved = PageOwnedBinding::resolveNamed( [ 'pageId' => $title->getArticleID(), 'name' => $expectedName ],
			$surfaces, 'file', 'File:' . $file->getName(), 2 );
		$this->assertSame( $id, $resolved );
		$payload = array_values( array_filter( $surfaces, static fn ( $surface ) => $surface['id'] === $id ) )[0];
		$expected = $this->expected( $file, $rows[2], $title->getArticleID(), 2, 'Second member payload' );
		$expected['label'] = $expectedName;
		$this->assertSame( JsonSnapshotCodec::encode( $expected ),
			JsonSnapshotCodec::encode( $payload ) );
	}

	public static function provideTemplateCollision(): array {
		return [ 'unchanged template finds copied member' => [ false, false ],
			'exact competitor refuses copy' => [ true, false ],
			'numbered fallback finds the admitted group' => [ false, true ],
			'exact competitor defeats numbered fallback' => [ true, true ] ];
	}

	public function testOtherFileAndSlideLabelsDoNotReserveThePdfName(): void {
		[ $file, $rows ] = $this->pdf();
		$title = $this->owner( $this->embed( $file, 2 ) );
		$other = $this->upload( 'Isolated_scope_' . wfRandomString() . '.png' );
		$foreign = $this->expected( $other, $rows[1], $title->getArticleID(), 1, 'Other file payload' );
		$foreign['id'] = 'other-file';
		$slide = [ 'id' => 'independent-slide', 'kind' => 'slide', 'label' => 'Notes', 'layers' => [],
			'canvas' => [ 'width' => 800, 'height' => 600, 'backgroundColor' => '#ffffff',
				'backgroundVisible' => true, 'backgroundOpacity' => 1 ] ];
		$this->seed( $title, [ $foreign, $slide ] );
		$before = $this->state();
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( $plan['copies'], 'name' ) );
		$surfaces = json_decode( $plan['document'], true )['surfaces'];
		$this->assertSame( JsonSnapshotCodec::encode( [ $foreign, $slide ] ),
			JsonSnapshotCodec::encode( array_slice( $surfaces, 0, 2 ) ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testInvalidStoredTopologyRefusesBeforeAnyProposedDocumentOrPublisher(): void {
		[ $file ] = $this->pdf();
		$extra = $this->saveSet( $file, 'Other retained name', 1, 'Extra page-one member', 1 );
		$surfaces = $this->surfaces( $this->latest( $file->getTitle() ) );
		$surfaces[] = $this->expected( $file, $extra, $file->getTitle()->getArticleID(), 1,
			'Extra page-one member' );
		$pending = JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] );
		$title = $this->owner( $this->embed( $file, 2 ) );
		$before = $this->state();
		$migration = $this->neverPublishing();
		$plan = $migration->plan( $title->getArticleID(), $this->actor, static fn () => $pending );
		$this->assertSame( 'invalid-source-group', $plan['problem'] );
		$this->assertSame( [], $plan['copies'] );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $plan['main'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testNormalPublicationRefusesInaccessiblePinnedMediaWithoutWrites(): void {
		[ $file, $rows ] = $this->pdf();
		$old = $this->expected( $file, $rows[2], $file->getTitle()->getArticleID(), 2, 'Historical second payload' );
		$changed = $this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20260907120000' );
		$current = $this->saveSet( $changed, 'Notes', 1, 'New current metadata', 1 );
		$this->sourceDocument( $changed, [
			$this->expected( $changed, $current, $file->getTitle()->getArticleID(), 1, 'Current first payload' ),
			$old ] );
		$title = $this->owner( $this->embed( $changed, 1 ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
			->set( [ 'oi_deleted' => 9 ] )->where( [ 'oi_name' => $file->getName(),
				'oi_timestamp' => $file->getTimestamp() ] )->caller( __METHOD__ )->execute();
		$before = $this->state();
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertCount( 2, $plan['copies'] );
		try {
			$migration->commit( $plan, $this->actor );
			$this->fail( 'The normal publisher must refuse a suppressed pinned media version' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertSame( $before, $this->state() );
	}

	/** @dataProvider provideConstraintOrder @param bool $latestFirst */
	public function testNamedAndLatestTemplatesRetainEveryConstraint( bool $latestFirst ): void {
		[ $file ] = $this->pdf();
		$source = $this->surfaces( $this->latest( $file->getTitle() ) );
		foreach ( $source as &$member ) {
			$member['label'] = 'Renamed';
		}
		unset( $member );
		$this->sourceDocument( $file, $source );
		$named = $this->embed( $file, 1 );
		$latest = str_replace( 'layerset=Notes', 'layerset=on', $named );
		$template = Title::makeTitle( NS_TEMPLATE, 'Constraint_order_' . wfRandomString() );
		$this->assertStatusGood( $this->editPage( $template,
			$latestFirst ? "$latest\n$named" : "$named\n$latest", '', NS_MAIN, $this->actor ) );
		$title = $this->owner( $this->embed( $file, 2 ) . "\n{{" . $template->getText() . '}}' );
		$before = $this->state();
		$migration = $this->neverPublishing();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [], $plan['copies'], 'Latest must not conceal a failing named template' );
		$this->assertSame( 'template-name-taken', $plan['notMoved'][0]['reason'] );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $plan['main'], 'Refuse the group and retain its direct and template references' );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideConstraintOrder(): array {
		return [ 'named before latest' => [ false ], 'latest before named' => [ true ] ];
	}

	/** @dataProvider provideConstraintOrder @param bool $latestFirst */
	public function testNamedAndLatestTemplatesSelectTheSameCompleteGroup( bool $latestFirst ): void {
		[ $file, $rows ] = $this->pdf( 'Default' );
		// After completion "on" means Default, so the success fixture must retain that identity.
		$named = str_replace( 'layerset=Notes', 'layerset=Default', $this->embed( $file, 2 ) );
		$latest = str_replace( 'layerset=Default', 'layerset=on', $named );
		$template = Title::makeTitle( NS_TEMPLATE, 'Constraint_success_' . wfRandomString() );
		$this->assertStatusGood( $this->editPage( $template,
			$latestFirst ? "$latest\n$named" : "$named\n$latest", '', NS_MAIN, $this->actor ) );
		$title = $this->owner( str_replace( 'layerset=Notes', 'layerset=Default',
			$this->embed( $file, 1 ) ) . "\n{{" . $template->getText() . '}}' );
		$before = $this->state();
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [], $plan['notMoved'] );
		$expected = [ $this->expected( $file, $rows[1], $title->getArticleID(), 1, 'First member payload' ),
			$this->expected( $file, $rows[2], $title->getArticleID(), 2, 'Second member payload' ) ];
		foreach ( $expected as &$member ) {
			$member['label'] = 'Default';
		}
		unset( $member );
		$this->assertSame( JsonSnapshotCodec::encode( $expected ),
			JsonSnapshotCodec::encode( json_decode( $plan['document'], true )['surfaces'] ) );
		$this->assertSame( [ true, true ], array_column( $plan['copies'], 'template' ) );
		$this->assertSame( $before, $this->state() );
		$migration->commit( $plan, $this->actor );
		$revision = $this->latest( $title );
		$options = ParserOptions::newFromAnon();
		$options->setOption( MigrationState::PARSER_OPTION, true );
		$output = $this->getServiceContainer()->getParserFactory()->create()->parse(
			$revision->getContent( 'main' )->getText(), $title, $options, true, true, $revision->getId() );
		$this->assertSame( 2, substr_count( $output->getRawText(), 'data-layers-binding="v1:' .
			$title->getArticleID() . ':' . FilePageMigration::surfaceId( $rows[2], $title->getArticleID() ) . '"' ) );
		$this->assertSame( JsonSnapshotCodec::encode( $expected ),
			JsonSnapshotCodec::encode( $this->surfaces( $revision ) ) );
	}

	public function testRejectedGroupIsAbsentFromTheFinalAcceptedDocument(): void {
		[ $file, $rows ] = $this->pdf();
		$other = [ 1 => $this->saveSet( $file, 'Other', 1, 'Other first payload', 1 ),
			2 => $this->saveSet( $file, 'Other', 1, 'Other second payload', 2 ) ];
		$source = $this->surfaces( $this->latest( $file->getTitle() ) );
		foreach ( $source as &$member ) {
			$member['label'] = 'Renamed';
		}
		unset( $member );
		foreach ( $other as $page => $row ) {
			$member = $this->expected( $file, $row, $file->getTitle()->getArticleID(), $page,
				$page === 1 ? 'Other first payload' : 'Other second payload' );
			$member['label'] = 'Other';
			$source[] = $member;
		}
		$this->sourceDocument( $file, $source );
		$otherEmbed = str_replace( 'layerset=Notes', 'layerset=Other', $this->embed( $file, 1 ) );
		$template = Title::makeTitle( NS_TEMPLATE, 'Final_document_' . wfRandomString() );
		$this->assertStatusGood( $this->editPage( $template, $this->embed( $file, 2 ) . "\n" .
			str_replace( 'layerset=Notes', 'layerset=Other', $this->embed( $file, 2 ) ), '', NS_MAIN, $this->actor ) );
		$text = $this->embed( $file, 2 ) . "\n" . $otherEmbed . "\n{{" . $template->getText() . '}}';
		$title = $this->owner( $text );
		$before = $this->state();
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [ 'Other', 'Other' ], array_column( $plan['copies'], 'name' ) );
		$this->assertSame( [ $other[1], $other[2] ], array_column( $plan['copies'], 'legacyId' ) );
		$this->assertSame( 'template-name-taken', $plan['notMoved'][0]['reason'] );
		$this->assertSame( str_replace( $otherEmbed, str_replace( 'layerset=Other',
			'layerset=' . $title->getArticleID() . ':Other', $otherEmbed ), $text ), $plan['main'] );
		$expected = [];
		foreach ( $other as $page => $row ) {
			$member = $this->expected( $file, $row, $title->getArticleID(), $page,
				$page === 1 ? 'Other first payload' : 'Other second payload' );
			$member['label'] = 'Other';
			$expected[] = $member;
		}
		$this->assertSame( JsonSnapshotCodec::encode( $expected ),
			JsonSnapshotCodec::encode( json_decode( $plan['document'], true )['surfaces'] ) );
		$this->assertSame( $before, $this->state() );
	}

	/** Insert readable historical fixture content in isolated tables, outside current publication validation.
	 * @param Title $title @param array $surfaces @return int
	 */
	private function historicalOwner( Title $title, array $surfaces ): int {
		$parent = $this->latest( $title );
		$content = new LayersDocumentContent( JsonSnapshotCodec::encode(
			[ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) );
		$this->assertTrue( $content->isReadable() );
		$revision = new MutableRevisionRecord( $title );
		$revision->setUser( $this->actor );
		$revision->setTimestamp( wfTimestampNow() );
		$revision->setComment( CommentStoreComment::newUnsavedComment( 'Historical copy identity fixture' ) );
		$revision->setParentId( $parent->getId() );
		$revision->setContent( 'main', new WikitextContent( $parent->getContent( 'main' )->getText() ) );
		$revision->setContent( 'layers', $content );
		$stored = $this->getServiceContainer()->getRevisionStore()->insertRevisionOn( $revision, $this->getDb() );
		$this->getDb()->newUpdateQueryBuilder()->update( 'page' )->set( [ 'page_latest' => $stored->getId() ] )
			->where( [ 'page_id' => $title->getArticleID() ] )->caller( __METHOD__ )->execute();
		return $stored->getId();
	}

	public function testCompleteImportDoesNotRewriteToAnAmbiguousHistoricName(): void {
		[ $file, $rows ] = $this->pdf();
		$title = $this->owner( $this->embed( $file, 1 ) . "\n" . $this->embed( $file, 2 ) );
		$one = $this->expected( $file, $rows[1], $title->getArticleID(), 1, 'Owner first payload' );
		$two = $this->expected( $file, $rows[2], $title->getArticleID(), 2, 'Owner second payload' );
		$competitor = $one;
		$competitor['id'] = 'historic-independent-competitor';
		$competitor['label'] = 'notes';
		$competitor['layers'][0]['text'] = 'Independent historic payload';
		$this->historicalOwner( $title, [ $one, $two, $competitor ] );
		$before = $this->state();
		$migration = $this->neverPublishing();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [], $plan['copies'] );
		$this->assertSame( [], $plan['done'], 'IDs alone do not prove a usable direct name binding' );
		$this->assertSame( 'ambiguous-copy-name', $plan['notMoved'][0]['reason'] );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $plan['main'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testEquivalentLiteralSourceNamesRemainSeparateGroups(): void {
		$file = $this->upload( 'Equivalent_copy_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$one = $this->saveSet( $file, 'Notes', 1, 'Upper literal payload', 1 );
		$two = $this->saveSet( $file, 'notes', 1, 'Lower literal payload', 2 );
		$owner = $this->owner( $this->embed( $file, 1 ) . "\n" .
			str_replace( 'layerset=Notes', 'layerset=notes', $this->embed( $file, 2 ) ) );
		$source = [ $this->expected( $file, $one, $file->getTitle()->getArticleID(), 1, 'Upper literal payload' ),
			$this->expected( $file, $two, $file->getTitle()->getArticleID(), 2, 'Lower literal payload' ) ];
		$source[1]['label'] = 'notes';
		$pending = JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $source ] );
		$before = $this->state();
		$plan = $this->neverPublishing()->plan( $owner->getArticleID(), $this->actor, static fn () => $pending );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [ 'Notes', 'notes 2' ], array_column( $plan['copies'], 'name' ) );
		$this->assertSame( [ $one, $two ], array_column( $plan['copies'], 'legacyId' ) );
		$source[0]['id'] = FilePageMigration::surfaceId( $one, $owner->getArticleID() );
		$source[1]['id'] = FilePageMigration::surfaceId( $two, $owner->getArticleID() );
		$source[1]['label'] = 'notes 2';
		$this->assertSame( JsonSnapshotCodec::encode( $source ),
			JsonSnapshotCodec::encode( json_decode( $plan['document'], true )['surfaces'] ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testSourceMutationDuringPlanningDoesNotMixMembersAndRefusesCommit(): void {
		[ $file, $rows, $revision ] = $this->pdf();
		$owner = $this->owner( $this->embed( $file, 2 ) . "\n" . $this->embed( $file, 1 ) );
		$real = new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() );
		$afterMutation = null;
		$access = $this->createMock( PageHistoryAccess::class );
		$access->expects( $this->once() )->method( 'read' )->willReturnCallback( function (
			$title, $id, $authority, $page
		) use ( $real, $file, &$afterMutation ) {
			$content = $real->read( $title, $id, $authority, $page );
			$changed = json_decode( $content->getText(), true )['surfaces'];
			$changed[0]['layers'][0]['text'] = 'New first after snapshot read';
			$changed[1]['layers'][0]['text'] = 'New second after snapshot read';
			$this->sourceDocument( $file, $changed );
			$afterMutation = $this->state();
			return $content;
		} );
		$migration = $this->neverPublishing( null, $access );
		$plan = $migration->plan( $owner->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [ $revision, $revision ], array_column( $plan['copies'], 'sourceRevision' ) );
		$this->assertSame( JsonSnapshotCodec::encode( [
			$this->expected( $file, $rows[1], $owner->getArticleID(), 1, 'First member payload' ),
			$this->expected( $file, $rows[2], $owner->getArticleID(), 2, 'Second member payload' )
		] ), JsonSnapshotCodec::encode( json_decode( $plan['document'], true )['surfaces'] ) );
		$this->assertSame( $afterMutation, $this->state(), 'Only the intentional fixture source edit changed state' );
		try {
			$migration->commit( $plan, $this->actor );
			$this->fail( 'The snapshot changed during planning and must not publish' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertSame( $afterMutation, $this->state() );
	}
}
