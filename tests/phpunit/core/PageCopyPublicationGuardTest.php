<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Migration\PageCopyMigration;
use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\LegacySurfaceConverter;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\PreparedUpdate;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Native preparation and synchronous save callbacks cannot publish an unavailable copy source.
 * @covers \MediaWiki\Extension\Layers\Migration\PageCopyMigration
 * @covers \MediaWiki\Extension\Layers\Revision\PagePublicationService
 * @group Database
 */
class PageCopyPublicationGuardTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	/** @return array File, admitted source revision, destination title, migration and plan */
	private function fixture(): array {
		$file = $this->upload( 'Guard_source_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$this->saveSet( $file, 'Notes', 1, 'First guarded member', 1 );
		$this->saveSet( $file, 'Notes', 1, 'Second guarded member', 2 );
		$files = $this->pilot->newFilePageMigration();
		$source = $files->commit( $files->plan( $file->getName(), $this->actor ), $this->actor );
		$title = $this->getExistingTestPage()->getTitle();
		$this->assertStatusGood( $this->editPage( $title,
			'[[File:' . $file->getName() . '|thumb|120px|page=2|layerset=Notes]]', '', NS_MAIN, $this->actor ) );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertCount( 2, $plan['copies'] );
		return [ $file, $source, $title, $migration, $plan ];
	}

	/** @return array Ordered complete rows from eight explicitly captured fixture tables */
	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page' => 'page_id', 'revision' => 'rev_id',
			'slots' => [ 'slot_revision_id', 'slot_role_id' ], 'content' => 'content_id',
			'text' => 'old_id', 'layer_sets' => 'ls_id', 'updatelog' => 'ul_key',
			'page_props' => [ 'pp_page', 'pp_propname' ] ] as $table => $order
		) {
			$state[$table] = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )->orderBy( $order )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$state[$table][] = (array)$row;
			}
		}
		return $state;
	}

	/** @return array[] */
	public static function provideSuppressionHooks(): array {
		return [
			'edit filter before native preparation' => [ 'EditFilterMergedContent' ],
			'late multi-content save' => [ 'MultiContentSave' ],
			'synchronous revision completion' => [ 'RevisionFromEditComplete' ],
		];
	}

	/**
	 * @dataProvider provideSuppressionHooks
	 * @param string $hook
	 */
	public function testSourceSuppressionRefusesAndRecoversWithoutStoredWrites( string $hook ): void {
		[ , $source, $title, $migration, $plan ] = $this->fixture();
		$before = $this->state();
		$entered = false;
		$caller = __METHOD__;
		$this->setTemporaryHook( $hook, function () use ( &$entered, $source, $caller ) {
			if ( !$entered ) {
				$entered = true;
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( [ 'rev_id' => $source ] )->caller( $caller )->execute();
			}
			return true;
		}, false );
		$failure = null;
		try {
			$migration->commit( $plan, $this->actor );
		} catch ( PublicationException $e ) {
			$failure = $e->getMessage();
		}
		$this->assertTrue( $entered, 'The actual native callback must be reached' );
		$this->assertSame( 'layers-revision-unavailable', $failure );
		$this->assertSame( $before, $this->state(),
			'Canceled publication and its same-connection callback restore all eight captured tables' );

		// Rolled-back deferred work and admission state must not poison the next publication.
		$retry = $migration->plan( $title->getArticleID(), $this->actor );
		$newId = $migration->commit( $retry, $this->actor );
		$this->assertGreaterThan( $plan['baseRevisionId'], $newId );
		$this->runDeferredUpdates();
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $newId );
		$surfaces = $this->surfaces( $revision );
		$this->assertSame( [ 'Notes', 'Notes' ], array_column( $surfaces, 'label' ) );
		$this->assertSame( [ 'First guarded member', 'Second guarded member' ],
			array_map( static fn ( $member ) => $member['layers'][0]['text'], $surfaces ) );
	}

	public function testSelfSourceSuppressionStillChecksTheAdmittedBaseAfterItsSave(): void {
		$file = $this->upload( 'Self_guard_' . wfRandomString() . '.png' );
		$this->saveSet( $file, 'Notes', 1, 'Original self-owned payload' );
		$this->assertStatusGood( $this->editPage( $file->getTitle(), '[[File:' . $file->getName() .
			'|layerset=Notes]]', '', NS_FILE, $this->actor ) );
		$files = $this->pilot->newFilePageMigration();
		$source = $files->commit( $files->plan( $file->getName(), $this->actor ), $this->actor );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $file->getTitle()->getArticleID(), $this->actor );
		$this->assertSame( [], $plan['copies'] );
		$this->assertNotNull( $plan['main'] );
		$before = $this->state();
		$entered = false;
		$caller = __METHOD__;
		$this->setTemporaryHook( 'RevisionFromEditComplete', function () use ( &$entered, $source, $caller ) {
			$entered = true;
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
				RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
				->where( [ 'rev_id' => $source ] )->caller( $caller )->execute();
			return true;
		}, false );
		$failure = null;
		try {
			$migration->commit( $plan, $this->actor );
		} catch ( PublicationException $e ) {
			$failure = $e->getMessage();
		}
		$this->assertTrue( $entered );
		$this->assertSame( 'layers-revision-unavailable', $failure,
			'Inspect the admitted base visibility, even though the same owner now has its proposed new revision' );
		$this->assertSame( $before, $this->state() );
	}

	public function testSourceEditDuringPreparationRefusesBothDestinationSlots(): void {
		[ $file, , , $migration, $plan ] = $this->fixture();
		$before = $this->state();
		$entered = false;
		$this->setTemporaryHook( 'EditFilterMergedContent', function () use ( &$entered, $file ) {
			if ( !$entered ) {
				$entered = true;
				$this->assertStatusGood( $this->editPage( $file->getTitle(), 'Changed source main content', '',
					NS_FILE, $this->actor ) );
			}
			return true;
		}, false );
		try {
			$migration->commit( $plan, $this->actor );
			$this->fail( 'A changed admitted source must refuse publication' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertTrue( $entered );
		$this->assertSame( $before, $this->state() );
	}

	public function testEarlierDestinationWinnerRemainsIntact(): void {
		[ , , $title, $migration, $plan ] = $this->fixture();
		$this->assertStatusGood( $this->editPage( $title, 'Independently saved destination winner', '',
			NS_MAIN, $this->actor ) );
		$before = $this->state();
		try {
			$migration->commit( $plan, $this->actor );
			$this->fail( 'A stale destination must refuse publication' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertSame( $before, $this->state(), 'The winner precedes the migration transaction' );
	}

	public function testSourceTitleIdentityChangeDuringEditFilterRestoresCapturedState(): void {
		[ $file, , $title, $migration, $plan ] = $this->fixture();
		$sourceId = $file->getTitle()->getArticleID();
		$before = $this->state();
		$entered = false;
		$caller = __METHOD__;
		$this->setTemporaryHook( 'EditFilterMergedContent', function ( $context ) use (
			&$entered, $sourceId, $title, $caller
		) {
			if ( !$entered && $context->getTitle()->getArticleID() === $title->getArticleID() ) {
				$entered = true;
				// Fixture-only owner identity mutation; no file move, redirect or media operation.
				$this->getDb()->newUpdateQueryBuilder()->update( 'page' )
					->set( [ 'page_title' => 'Guard_identity_change_' . wfRandomString() . '.pdf' ] )
					->where( [ 'page_id' => $sourceId ] )->caller( $caller )->execute();
			}
			return true;
		}, false );
		try {
			$migration->commit( $plan, $this->actor );
			$this->fail( 'Changing the admitted source title identity must refuse publication' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertTrue( $entered );
		$this->assertSame( $before, $this->state(), 'Only the eight captured tables are compared' );
	}

	/**
	 * Spy after the real native writer has returned its prepared update, before publisher admission.
	 * @param callable(PreparedUpdate):void $afterPreparation
	 * @return PageCopyMigration
	 */
	private function migrationWithPreparationSpy( callable $afterPreparation ): PageCopyMigration {
		$services = $this->getServiceContainer();
		$lookup = $services->getRevisionLookup();
		$registered = TestingAdmissionRegistration::install( $this );
		$realWriter = new PageRevisionWriter();
		$writer = $this->createMock( PageRevisionWriter::class );
		$writer->expects( $this->once() )->method( 'save' )->willReturnCallback( function (
			$updater, $base, $layers, $summary, $main, $saveInScope
		) use ( $realWriter, $afterPreparation ) {
			$this->assertNotNull( $saveInScope );
			return $realWriter->save( $updater, $base, $layers, $summary, $main,
				static function ( PreparedUpdate $prepared, callable $commit ) use (
					$afterPreparation, $saveInScope
				) {
					$afterPreparation( $prepared );
					return $saveInScope( $prepared, $commit );
				} );
		} );
		$publisher = new PagePublicationService( $services->getWikiPageFactory(), new PageHistoryAccess( $lookup ),
			new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(), $services->getTitleFactory() ),
			$writer, $registered['context'], $services->getHookContainer(), $services->getUserFactory() );
		$targets = static function ( string $raw ) use ( $services ): ?string {
			$title = $services->getTitleFactory()->newFromText( $raw );
			return $title && $title->getNamespace() === NS_FILE ? $title->getPrefixedDBkey() : null;
		};
		$rewriter = new DirectEmbeddingRewriter( $services->getParserFactory()->create()->getTags() );
		return new PageCopyMigration( $services->getService( 'LayersDatabase' ), $this->pilot->getScope(),
			$services->getRepoGroup(), $services->getTitleFactory(), $lookup, new PageHistoryAccess( $lookup ),
			new LegacySurfaceConverter(), $rewriter, $targets, $services->getConnectionProvider(), $publisher );
	}

	/**
	 * Original mutable authority: only the source owner's read permission changes.
	 * @param string $sourceKey
	 * @param callable():bool $sourceReadable
	 * @return Authority
	 */
	private function sourceRestrictedAuthority( string $sourceKey, callable $sourceReadable ): Authority {
		$authority = $this->createMock( Authority::class );
		$actor = $this->actor;
		$authority->method( 'getUser' )->willReturn( $this->actor );
		$authority->method( 'definitelyCan' )->willReturn( true );
		$authority->method( 'authorizeWrite' )->willReturn( true );
		$authority->method( 'isAllowed' )->willReturnCallback( fn ( $right ) => $this->actor->isAllowed( $right ) );
		$authority->method( 'authorizeRead' )->willReturnCallback( static function ( $right, $page ) use (
			$sourceKey, $sourceReadable, $actor
		) {
			if ( $right === 'read' && $page->getNamespace() === NS_FILE && $page->getDBkey() === $sourceKey ) {
				return $sourceReadable();
			}
			return $actor->authorizeRead( $right, $page );
		} );
		return $authority;
	}

	public function testSourceOnlyReadPermissionNarrowedAfterNativePreparationRefuses(): void {
		[ $file, , $title ] = $this->fixture();
		$readable = true;
		$preparedReached = false;
		$deniedChecks = 0;
		$authority = $this->sourceRestrictedAuthority( $file->getName(), static function () use (
			&$readable, &$deniedChecks
		) {
			if ( !$readable ) {
				$deniedChecks++;
			}
			return $readable;
		} );
		$migration = $this->migrationWithPreparationSpy( function ( PreparedUpdate $prepared ) use (
			&$readable, &$preparedReached, $title
		) {
			$this->assertSame( $title->getArticleID(), $prepared->getPage()->getId() );
			$this->assertSame( 'layers-document', $prepared->getRawContent( PageRevisionWriter::SLOT )->getModel() );
			$preparedReached = true;
			$readable = false;
		} );
		$plan = $migration->plan( $title->getArticleID(), $authority );
		$this->assertCount( 2, $plan['copies'] );
		$before = $this->state();
		try {
			$migration->commit( $plan, $authority );
			$this->fail( 'The original authority lost source read access after preparation' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertTrue( $preparedReached );
		$this->assertGreaterThan( 0, $deniedChecks, 'The final source check retains the original authority' );
		$this->assertTrue( $authority->authorizeRead( 'read', $title ), 'Destination read access remains allowed' );
		$this->assertTrue( $authority->authorizeWrite( 'edit', $title ), 'Destination edit access remains allowed' );
		$this->assertSame( $before, $this->state() );
	}

	public function testFinalSourceGuardRunsAfterActualNativePreparationAndBeforeSaveHooks(): void {
		[ $file, $source, $title ] = $this->fixture();
		$events = [];
		$preparedReached = false;
		$caller = __METHOD__;
		$authority = $this->sourceRestrictedAuthority( $file->getName(), static function () use (
			&$preparedReached, &$events
		) {
			if ( $preparedReached ) {
				$events[] = 'source-rechecked';
			}
			return true;
		} );
		$this->assertFalse( $authority->authorizeRead( 'suppressrevision', $file->getTitle() ) );
		$this->assertFalse( $authority->authorizeRead( 'viewsuppressed', $file->getTitle() ) );
		$migration = $this->migrationWithPreparationSpy( function ( PreparedUpdate $prepared ) use (
			&$preparedReached, &$events, $source, $title, $caller
		) {
			$this->assertSame( $title->getArticleID(), $prepared->getPage()->getId() );
			$this->assertSame( 'layers-document', $prepared->getRawContent( PageRevisionWriter::SLOT )->getModel() );
			$events[] = 'native-prepared';
			$preparedReached = true;
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
				RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
				->where( [ 'rev_id' => $source ] )->caller( $caller )->execute();
			$events[] = 'source-suppressed';
		} );
		$saveHookReached = false;
		$this->setTemporaryHook( 'MultiContentSave', static function () use ( &$saveHookReached ) {
			$saveHookReached = true;
			return true;
		}, false );
		$plan = $migration->plan( $title->getArticleID(), $authority );
		$this->assertCount( 2, $plan['copies'] );
		$before = $this->state();
		try {
			$migration->commit( $plan, $authority );
			$this->fail( 'Suppression after native preparation must stop before admission and save hooks' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertSame( [ 'native-prepared', 'source-suppressed', 'source-rechecked' ], $events );
		$this->assertFalse( $saveHookReached, 'The final guard precedes native save hooks' );
		$this->assertSame( $before, $this->state(), 'Suppression and both destination slots are canceled' );
	}

	/** @return array[] */
	public static function provideLatePinnedMediaHooks(): array {
		return [ 'edit filter after media resolution' => [ 'EditFilterMergedContent' ],
			'late synchronous save after media resolution' => [ 'MultiContentSave' ] ];
	}

	/**
	 * @dataProvider provideLatePinnedMediaHooks
	 * @param string $hook
	 */
	public function testLatePinnedMediaSuppressionRefusesWithoutDestinationWrites( string $hook ): void {
		[ $file, $source, $title ] = $this->fixture();
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$stored = $this->surfaces( $lookup->getRevisionById( $source ) );
		$oldSecond = $stored[1];
		$oldTimestamp = $file->getTimestamp();
		$changed = $this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20260907120000' );
		$currentId = $this->saveSet( $changed, 'Notes', 1, 'New current legacy metadata', 1 );
		$current = $stored[0];
		$current['id'] = FilePageMigration::surfaceId( $currentId, $file->getTitle()->getArticleID() );
		$current['canvas']['width'] = $changed->getWidth( 1 );
		$current['canvas']['height'] = $changed->getHeight( 1 );
		$current['source']['timestamp'] = $changed->getTimestamp();
		$current['source']['sha1'] = $changed->getSha1();
		$current['layers'][0]['text'] = 'New authorized first payload';
		$files = $this->pilot->newFilePageMigration();
		$filePlan = $files->plan( $changed->getName(), $this->actor );
		$filePlan['document'] = JsonSnapshotCodec::encode(
			[ 'schemaVersion' => 1, 'surfaces' => [ $current, $oldSecond ] ] );
		$this->assertNotNull( $files->commit( $filePlan, $this->actor ) );
		$this->assertStatusGood( $this->editPage( $title, '[[File:' . $changed->getName() .
			'|thumb|120px|page=1|layerset=Notes]]', '', NS_MAIN, $this->actor ) );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertCount( 2, $plan['copies'] );
		$copies = json_decode( $plan['document'], true )['surfaces'];
		$this->assertSame( [ 'New authorized first payload', 'Second guarded member' ],
			array_map( static fn ( $member ) => $member['layers'][0]['text'], $copies ) );
		$this->assertSame( $oldSecond['source'], $copies[1]['source'], 'Keep the historical second-member pin' );
		$oldKey = [ 'oi_name' => $file->getName(), 'oi_timestamp' => $oldTimestamp ];
		$beforeVisibility = (int)$this->getDb()->newSelectQueryBuilder()->select( 'oi_deleted' )->from( 'oldimage' )
			->where( $oldKey )->caller( __METHOD__ )->fetchField();
		$this->assertSame( 0, $beforeVisibility, 'The pinned historical version starts accessible' );
		$before = $this->state();
		$entered = false;
		$caller = __METHOD__;
		$this->setTemporaryHook( $hook, function () use ( &$entered, $oldKey, $caller ) {
			if ( !$entered ) {
				$entered = true;
				$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )->set( [ 'oi_deleted' => 9 ] )
					->where( $oldKey )->caller( $caller )->execute();
			}
			return true;
		}, false );
		$failure = null;
		try {
			$migration->commit( $plan, $this->actor );
		} catch ( PublicationException $e ) {
			$failure = $e->getMessage();
		}
		$this->assertTrue( $entered, 'The late native callback must actually suppress the historical pin' );
		$this->assertSame( 'layers-source-unavailable', $failure );
		$this->assertSame( $before, $this->state(),
			'No destination main/Layers or other captured-table write survives' );
		$this->assertSame( $beforeVisibility, (int)$this->getDb()->newSelectQueryBuilder()
			->select( 'oi_deleted' )->from( 'oldimage' )->where( $oldKey )->caller( __METHOD__ )->fetchField(),
			'The same-primary suppression is canceled too; oldimage is outside the eight-table snapshot' );
	}
}
