<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPreparation;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPublicationService;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfSetPreparation;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Cross-version whole-PDF Import into a missing target set, with unchanged geometry.
 * @covers \MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPublicationService
 * @group Database
 */
class MissingPdfImportVersionPreservationTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->setContentLang( 'en' );
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		MigrationState::markComplete( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	private function upload( ?string $title = null ): \MediaWiki\FileRepo\File\LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			$title ?? 'File:VersionImport-' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Isolated PDF version fixture', 'Fixture only', 0, false, '20260906120000',
			$this->getTestSysop()->getUser() )->isOK() );
		return $file;
	}

	private function uploadChangedVersion( \MediaWiki\FileRepo\File\LocalFile $file ): string {
		self::guardIsolatedFixtureRepository( $this->getServiceContainer()->getRepoGroup()->getLocalRepo() );
		$original = file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' );
		$this->assertIsString( $original );
		$changed = str_replace( [ 'Page one', 'Page two' ], [ 'Fresh 01', 'Fresh 02' ], $original, $count );
		$this->assertSame( 2, $count );
		$this->assertSame( strlen( $original ), strlen( $changed ) );
		$this->assertNotSame( sha1( $original ), sha1( $changed ) );
		$path = tempnam( sys_get_temp_dir(), 'layers-version-import-' );
		$this->assertNotFalse( $path );
		try {
			$this->assertSame( strlen( $changed ), file_put_contents( $path, $changed ) );
			$status = $file->upload( $path, 'Cross-version PDF Import fixture', 'Fixture only', 0, false,
				'20260907120000', $this->getTestSysop()->getUser() );
			$this->assertTrue( $status->isOK() );
		} finally {
			if ( file_exists( $path ) ) {
				unlink( $path );
			}
		}
		$file->purgeCache();
		return $file->getSha1();
	}

	private function fixture( bool $slot ): array {
		$file = $this->upload();
		$embed = '[[' . $file->getTitle()->getPrefixedDBkey() . '|page=2|layerset=ABC|Caption]]';
		$prefix = "Préface π\n";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		if ( $slot ) {
			$document = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$revision, $document, 'Preserved native sibling' );
		}
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
		return [ 'file' => $file, 'page' => $page, 'revision' => $revision, 'start' => strlen( $prefix ),
			'expected' => $embed, 'main' => $stored->getContent( 'main' )->serialize(),
			'base' => $slot ? $stored->getContent( 'layers' )->serialize() : null,
			'pilot' => new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] ) ];
	}

	private function setPreparation( array $f ): PageMissingPdfSetPreparation {
		$services = $this->getServiceContainer();
		$lookup = $services->getRevisionLookup();
		$access = new PageHistoryAccess( $lookup );
		$sources = new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
			$services->getTitleFactory() );
		$renditions = new SourceRenditions( $services->getUrlUtils() );
		return new PageMissingPdfSetPreparation( $f['pilot'],
			new PageOwnedIdentityResolver( $services->getTitleFactory(), $lookup, $access ), $lookup,
			new PageReadService( $access, $sources ), $sources,
			new NewPageDrawing( $sources, $renditions, $services->getRepoGroup()->getLocalRepo(),
				$services->getTitleFactory(), [] ), $renditions );
	}

	private function sourceFixture( array $target ): array {
		$page = $this->getExistingTestPage();
		$surfaces = [];
		foreach ( [ 2, 1 ] as $number ) {
			$surface = $target['pilot']->prepareBoundEditor( $target['page']->getId(), $target['revision'],
				$target['start'], $target['expected'], $this->actor )['pageOwned']['newSurface'];
			$surface['id'] = 'version-source-' . $number;
			$surface['source']['page'] = $number;
			$surface['layers'] = [ [ 'id' => 'version-text-' . $number, 'type' => 'text',
				'text' => 'Old source page ' . $number, 'x' => 17, 'y' => 23 ] ];
			$surfaces[] = $surface;
		}
		$text = JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] );
		$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
			$page->getLatest(), $text, 'Isolated old-version Import source' );
		return [ 'page' => $page, 'revision' => $revision, 'anchor' => $surfaces[0]['id'],
			'text' => $text, 'surfaces' => $surfaces, 'pin' => $surfaces[0]['source'] ];
	}

	private function reader(): PageWorkingCopyPdfImportReadService {
		$services = $this->getServiceContainer();
		$access = new PageHistoryAccess( $services->getRevisionLookup() );
		$repo = $services->getRepoGroup()->getLocalRepo();
		$sources = new SourceVersionResolver( $repo, $services->getTitleFactory() );
		$renditions = new SourceRenditions( $services->getUrlUtils() );
		return new PageWorkingCopyPdfImportReadService( new PageOwnedIdentityResolver(
			$services->getTitleFactory(), $services->getRevisionLookup(), $access ),
			$services->getTitleFactory(), PageOwnedScope::newFromServices( $services, [], [ NS_MAIN ] ),
			$access, $sources, $renditions,
			new NewPageDrawing( $sources, $renditions, $repo, $services->getTitleFactory(), [] ) );
	}

	private function publication( array $f ): PageMissingPdfImportPublicationService {
		$s = $this->getServiceContainer();
		$access = new PageHistoryAccess( $s->getRevisionLookup() );
		return new PageMissingPdfImportPublicationService(
			new PageMissingPdfImportPreparation( $this->setPreparation( $f ), $this->reader() ),
			$this->registration['publisher'],
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $s->getRevisionLookup(), $access ),
			$s->getTitleFactory(), PageOwnedScope::newFromServices( $s, [], [ NS_MAIN ] ),
			$s->getRevisionLookup(), $access,
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ),
			$s->getConnectionProvider() );
	}

	private function freshProposal( array $f, array $source ): array {
		$admission = $this->setPreparation( $f )->prepare( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor );
		$document = $f['base'] === null ? [ 'schemaVersion' => 1, 'surfaces' => [] ] :
			json_decode( $f['base'], true, 64, JSON_THROW_ON_ERROR );
		$sourcePages = [];
		foreach ( $source['surfaces'] as $surface ) {
			$sourcePages[$surface['source']['page']] = $surface;
		}
		foreach ( $admission['pages'] as $entry ) {
			$surface = $entry['surface'];
			$number = $entry['page'];
			if ( isset( $sourcePages[$number] ) ) {
				$surface['layers'] = $sourcePages[$number]['layers'];
				$surface['readingOrder'] = array_column( $surface['layers'], 'id' );
			}
			$document['surfaces'][] = $surface;
		}
		return [ 'document' => $document, 'admission' => $admission ];
	}

	/** @dataProvider provideExistingSlots */
	public function testImportPreservesOldSourceAcrossSameFileVersionUpdate( bool $slot ): void {
		$f = $this->fixture( $slot );
		$source = $this->sourceFixture( $f );
		$oldSourceBytes = $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $source['revision'] )->getContent( PageRevisionWriter::SLOT )->serialize();
		$oldPin = $source['pin'];
		$newSha1 = $this->uploadChangedVersion( $f['file'] );
		$proposal = $this->freshProposal( $f, $source );
		$admission = $proposal['admission'];
		$this->assertSame( $f['file']->getTitle()->getPrefixedDBkey(), $admission['source']['fileTitle'] );
		$this->assertSame( $newSha1, $admission['source']['sha1'] );
		$this->assertNotSame( $oldPin['sha1'], $admission['source']['sha1'] );
		$this->assertNotSame( $oldPin['timestamp'], $admission['source']['timestamp'] );
		$this->assertCount( 2, $admission['pages'] );
		foreach ( $admission['pages'] as $entry ) {
			$this->assertSame( $admission['source']['sha1'], $entry['surface']['source']['sha1'] );
			$this->assertSame( 'ABC', $entry['surface']['label'] );
			$this->assertSame( $entry['surface']['id'], NewPageDrawing::surfaceId( $f['page']->getId(),
				$f['revision'], 'ABC', $admission['source']['fileTitle'], $entry['page'] ) );
			$geometry = $entry['sourceGeometry'];
			$scale = min( 1, \MediaWiki\Extension\Layers\Revision\DocumentSchema::MAX_DIMENSION /
				max( $geometry['width'], $geometry['height'] ) );
			$this->assertSame( max( 1, (int)round( $geometry['width'] * $scale ) ),
				$entry['surface']['canvas']['width'] );
			$this->assertSame( max( 1, (int)round( $geometry['height'] * $scale ) ),
				$entry['surface']['canvas']['height'] );
		}

		try {
			$id = $this->publication( $f )->publish( $f['page']->getId(), $f['revision'], $f['start'],
				$f['expected'], JsonSnapshotCodec::encode( $proposal['document'] ),
				[ [ 'sourcePageId' => $source['page']->getId(), 'sourceRevisionId' => $source['revision'],
					'sourceSurfaceId' => $source['anchor'] ] ], $this->actor );
		} catch ( PublicationException $error ) {
			$this->fail( 'Version-compatible Import must save: ' . $error->getMessage() );
		}

		$this->runDeferredUpdates();
		$record = $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $id, IDBAccessObject::READ_LATEST );
		$this->assertSame( $f['page']->getId(), $record->getPageId() );
		$this->assertSame( $f['revision'], $record->getParentId() );
		$this->assertSame( $f['main'], $record->getContent( SlotRecord::MAIN )->serialize() );
		$storedBytes = $record->getContent( PageRevisionWriter::SLOT )->serialize();
		$this->assertSame( JsonSnapshotCodec::encode( $proposal['document'] ), $storedBytes );
		$stored = json_decode( $storedBytes, true, 64, JSON_THROW_ON_ERROR );
		$imported = array_slice( $stored['surfaces'], -2 );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $imported, 'label' ) );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $imported, 'source' ), 'page' ) );
		$this->assertSame( [ $admission['source']['sha1'], $admission['source']['sha1'] ],
			array_column( array_column( $imported, 'source' ), 'sha1' ) );
		foreach ( $admission['pages'] as $index => $entry ) {
			$this->assertSame( JsonSnapshotCodec::encode( $entry['surface']['canvas'] ),
				JsonSnapshotCodec::encode( $imported[$index]['canvas'] ) );
		}
		$this->assertSame( [ 'Old source page 1', 'Old source page 2' ], array_column(
			array_column( array_column( $imported, 'layers' ), 0 ), 'text' ) );
		$this->assertSame( [ 17, 17 ], array_column( array_column( array_column( $imported, 'layers' ), 0 ), 'x' ) );
		$this->assertSame( [ 23, 23 ], array_column( array_column( array_column( $imported, 'layers' ), 0 ), 'y' ) );
		if ( $slot ) {
			$originalSiblings = json_decode( $f['base'], true, 64, JSON_THROW_ON_ERROR )['surfaces'];
			$storedSiblings = array_slice( $stored['surfaces'], 0, -2 );
			$this->assertSame( $originalSiblings, $storedSiblings );
			foreach ( $originalSiblings as $index => $sibling ) {
				$this->assertSame( JsonSnapshotCodec::encode( $sibling ),
					JsonSnapshotCodec::encode( $storedSiblings[$index] ) );
			}
		}
		$this->assertSame( $oldSourceBytes, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $source['revision'] )->getContent( PageRevisionWriter::SLOT )->serialize() );
		$oldSourceDocument = json_decode( $oldSourceBytes, true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( [ $oldPin['sha1'], $oldPin['sha1'] ],
			array_column( array_column( $oldSourceDocument['surfaces'], 'source' ), 'sha1' ) );
		$this->assertStringContainsString( (string)$source['revision'], $record->getComment()->text );
		$this->assertStringContainsString( $source['page']->getTitle()->getPrefixedText(),
			$record->getComment()->text );
		$this->assertContains( PagePublicationService::CHANGE_TAG,
			$this->getServiceContainer()->getChangeTagsStore()->getTags( $this->getDb(), null, $id ) );
	}

	public static function provideExistingSlots(): array {
		return [ 'without layers slot' => [ false ], 'with preserved layers slot' => [ true ] ];
	}
}
