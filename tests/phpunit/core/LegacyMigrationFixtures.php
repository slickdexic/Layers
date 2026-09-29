<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\User\User;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Legacy rows and uploads for the D3 migration tests, stored as older saves stored them.
 */
trait LegacyMigrationFixtures {
	private PageOwnedPilot $pilot;
	private User $actor;
	private int $nextId = 9000;

	private function setUpMigration(): void {
		if ( !$this->getDb()->tableExists( 'layer_sets', __METHOD__ ) ) {
			$this->markTestSkipped( 'layer_sets table not available' );
		}
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', null );
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		TestingAdmissionRegistration::install( $this );
		$this->pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->setTemporaryHook( 'MultiContentSave', $this->pilot->newAdmissionHooks(), true );
		$this->actor = $this->getTestSysop()->getUser();
	}

	/**
	 * @param string $name
	 * @param string $fixture
	 * @param string $timestamp
	 * @return LocalFile
	 */
	private function upload( string $name, string $fixture = 'test-image.png',
		string $timestamp = '20260906120000'
	): LocalFile {
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:' . $name );
		$file = $this->getServiceContainer()->getRepoGroup()->getLocalRepo()->newFile( $title );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/' . $fixture, 'Fixture', '',
			0, false, $timestamp, $this->actor ) );
		return $file;
	}

	/**
	 * A file's legacy row with no ownerId and no background settings.
	 * @param LocalFile $file
	 * @param string $set
	 * @param int $revision
	 * @param string $text
	 * @param int $page
	 * @param string|null $sha1
	 * @return int Row ID
	 */
	private function saveSet( LocalFile $file, string $set, int $revision, string $text, int $page = 1,
		?string $sha1 = null
	): int {
		[ $major, $minor ] = explode( '/', $file->getMimeType() );
		return $this->insertRow( $file->getName(), $sha1 ?? $file->getSha1(), $major, $minor, $set, $revision,
			$page, [ 'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 10, 'y' => 20, 'text' => $text ] ] ] );
	}

	/**
	 * A shared slide's legacy row.
	 * @param string $slide
	 * @param string $set
	 * @param string $text
	 * @return int Row ID
	 */
	private function saveSlide( string $slide, string $set, string $text ): int {
		return $this->insertRow( LayersConstants::SLIDE_PREFIX . $slide, LayersConstants::TYPE_SLIDE, 'application',
			'x-layers-slide', $set, 1, 1, [
				'layers' => [ [ 'id' => 'title', 'type' => 'text', 'x' => 40, 'y' => 60, 'text' => $text ] ],
				'isSlide' => true, 'canvasWidth' => 800, 'canvasHeight' => 600, 'backgroundColor' => '#ffffff'
			] );
	}

	/**
	 * @param string $imgName
	 * @param string $sha1
	 * @param string $major
	 * @param string $minor
	 * @param string $set
	 * @param int $revision
	 * @param int $page
	 * @param array $data
	 * @return int
	 */
	private function insertRow( string $imgName, string $sha1, string $major, string $minor, string $set,
		int $revision, int $page, array $data
	): int {
		$id = $this->nextId++;
		// Increasing, so the latest-saved set is the last one inserted.
		$timestamp = '20260910' . sprintf( '%06d', $id );
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'layer_sets' )->row( [
			'ls_id' => $id, 'ls_img_name' => $imgName, 'ls_img_major_mime' => $major, 'ls_img_minor_mime' => $minor,
			'ls_img_sha1' => $sha1, 'ls_json_blob' => json_encode(
				[ 'revision' => $revision, 'schema' => 1, 'created' => $timestamp ] + $data ),
			'ls_user_id' => $this->actor->getId(), 'ls_timestamp' => $timestamp, 'ls_revision' => $revision,
			'ls_name' => $set, 'ls_page' => $page, 'ls_size' => 100, 'ls_layer_count' => 1
		] )->caller( __METHOD__ )->execute();
		return $id;
	}

	/**
	 * @param RevisionRecord $revision
	 * @return array[] Surfaces of the revision
	 */
	private function surfaces( RevisionRecord $revision ): array {
		return json_decode( $revision->getContent( 'layers' )->getText(), true )['surfaces'];
	}
}
