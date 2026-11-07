<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Deferred\DeferredUpdates;
use MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * @covers \MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission
 * @group Database
 */
class LegacyArchivedSourceSuppressionTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	public function testNativeArchivedFileSuppressionAndRestoration(): void {
		$file = $this->upload( 'Legacy-archive-' . wfRandomString( 8 ) . '.png' );
		$oldHash = $file->getSha1();
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-image-replacement.png',
			'Synthetic replacement', '', 0, false, '20260907120000', $this->actor ) );
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		$admission = new LegacySearchSourceAdmission( $repo );
		$this->assertTrue( $admission->allows( $file->getTitle(), $oldHash, 1, $this->actor ) );
		$archive = $this->getDb()->newSelectQueryBuilder()->select( 'oi_archive_name' )->from( 'oldimage' )
			->where( [ 'oi_name' => $file->getName(), 'oi_sha1' => $oldHash ] )
			->caller( __METHOD__ )->fetchField();
		$this->assertIsString( $archive );
		$archiveId = explode( '!', $archive, 2 )[0];
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'deleterevision', 'suppressrevision' ] );
		$context = new RequestContext();
		$context->setUser( $this->actor );
		$context->setTitle( $file->getTitle() );
		$context->setRequest( new FauxRequest() );
		// Exclude upload/reupload work from the visibility-change observations.
		DeferredUpdates::doUpdates();
		$logs = [];
		$purges = [];
		$this->setTemporaryHook( 'LocalFilePurgeThumbnails',
			static function ( $target, $archiveName ) use ( &$purges ) {
				$purges[] = [ $target->getName(), $archiveName ];
			} );
		$this->setTemporaryHook( 'ManualLogEntryBeforePublish', static function ( $entry ) use ( &$logs ) {
			$logs[] = [ $entry->getType(), $entry->getSubtype(), $entry->getParameters() ];
		} );
		$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(), [ $archiveId ] );
		$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => 1,
			File::DELETED_RESTRICTED => 1 ], 'comment' => 'Synthetic fixture' ] ) );
		$this->assertFalse( $admission->allows( $file->getTitle(), $oldHash, 1, $this->actor ) );
		$this->assertSame( [], $logs, 'Restricted suppression does not publish through the generic log hook.' );
		DeferredUpdates::doUpdates();
		$this->assertContains( [ $file->getName(), $archiveId . '!' . $file->getName() ], $purges,
			'Restricted suppression must notify the thumbnail-purge hook for the archived version.' );
		$purges = [];
		$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(), [ $archiveId ] );
		$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => 0,
			File::DELETED_RESTRICTED => 0 ], 'comment' => 'Synthetic fixture restore' ] ) );
		$this->assertTrue( $admission->allows( $file->getTitle(), $oldHash, 1, $this->actor ) );
		DeferredUpdates::doUpdates();
		$this->assertContains( [ $file->getName(), $archiveId . '!' . $file->getName() ], $purges,
			'Restoration must notify the thumbnail-purge hook for the archived version.' );
		$logs = [];
		$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(), [ $archiveId ] );
		$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => 1 ],
			'comment' => 'Synthetic unrestricted hide' ] ) );
		$this->assertFalse( $admission->allows( $file->getTitle(), $oldHash, 1, $this->actor ) );
		$this->assertNotEmpty( $logs );
		$this->assertSame( 'revision', $logs[0][1] );
		$this->assertSame( 'oldimage', $logs[0][2]['4::type'] );
	}
}
