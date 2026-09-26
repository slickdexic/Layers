<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Permissions\Authority;
use MediaWiki\WikiMap\WikiMap;
use Wikimedia\FileBackend\FSFileBackend;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Shared base test case for core real-asset and multi-page acceptance suites.
 *
 * Configures an isolated FSFileBackend, LocalRepo, PublicationAdmissionContext,
 * and test-only admission registration with pinned PdfHandlerDpi.
 */
abstract class RealAssetTestCase extends \MediaWikiIntegrationTestCase {
	protected LocalRepo $repo;
	protected SourceVersionResolver $resolver;
	protected PublicationAdmissionContext $context;
	protected PagePublicationService $publisher;
	/** @var array<string, string> */
	protected array $backendPaths = [];

	protected function setUp(): void {
		parent::setUp();
		// Geometry assertions must not inherit the operator's rendering configuration.
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$directory = $this->getNewTempDirectory();
		$paths = [];
		foreach ( [ 'public', 'thumb', 'transcoded', 'temp', 'deleted' ] as $zone ) {
			$zoneDir = $directory . '/' . $zone;
			if ( !is_dir( $zoneDir ) ) {
				mkdir( $zoneDir, 0777, true );
			}
			$paths['layers-fixture-' . $zone] = $zoneDir;
		}
		$this->backendPaths = $paths;
		$backend = new FSFileBackend( [
			'name' => 'layers-fixture-backend-' . wfRandomString( 8 ),
			'wikiId' => WikiMap::getCurrentWikiId(),
			'containerPaths' => $paths
		] );
		$this->repo = new LocalRepo( [
			'name' => 'layers-fixture',
			'backend' => $backend,
			'url' => '/test-files'
		] );
		$this->context = new PublicationAdmissionContext();
		$this->resolver = new SourceVersionResolver(
			$this->repo,
			$this->getServiceContainer()->getTitleFactory()
		);
		$registered = TestingAdmissionRegistration::install( $this, $this->context, $this->resolver );
		$this->publisher = $registered['publisher'];
	}

	protected function actor(
		array $permissions = [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ]
	): Authority {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, $permissions );
		return $user;
	}

	protected function getLocalRepo(): LocalRepo {
		return $this->repo;
	}

	protected function uploadFixtureFile(
		string $fixturePath,
		string $fileTitle,
		string $timestamp = '20260906120000',
		string $comment = 'Test fixture upload'
	): LocalFile {
		$repo = $this->getLocalRepo();
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( $fileTitle );
		$this->assertNotNull( $title, "Title for {$fileTitle} must be valid" );
		$sysop = $this->getTestSysop()->getUser();
		$file = $repo->newFile( $title );
		$status = $file->upload( $fixturePath, $comment, 'Fixture file content', 0, false, $timestamp, $sysop );
		$this->assertStatusGood( $status, "Upload of {$fileTitle} must succeed" );
		return $file;
	}

	protected function buildDocument( array $surfaces ): string {
		return json_encode( [
			'schemaVersion' => 1,
			'surfaces' => $surfaces
		] );
	}

	/** Change the first image/PDF surface so publication must revalidate its source. */
	protected static function withChangedAssetSurface( string $json ): string {
		$document = json_decode( $json );
		foreach ( $document->surfaces as $surface ) {
			if ( $surface->kind !== 'slide' ) {
				$surface->label .= ' (changed)';
				break;
			}
		}
		return json_encode( $document );
	}

	protected function makeSlideSurface( string $id = 'presentation', string $label = 'Welcome Slide' ): array {
		return [
			'id' => $id,
			'kind' => 'slide',
			'label' => $label,
			'canvas' => [
				'width' => 800,
				'height' => 600,
				'backgroundColor' => '#ffffff',
				'backgroundVisible' => true,
				'backgroundOpacity' => 1
			],
			'layers' => [
				[
					'id' => 'title',
					'type' => 'text',
					'x' => 40,
					'y' => 60,
					'text' => 'Visual ideas — 世界',
					'fontSize' => 24,
					'color' => '#000000'
				]
			],
			'readingOrder' => [ 'title' ]
		];
	}

	protected function makeImageSurface(
		string $id,
		string $label,
		string $fileTitle,
		string $timestamp,
		string $sha1
	): array {
		return [
			'id' => $id,
			'kind' => 'image',
			'label' => $label,
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
				'fileTitle' => $fileTitle,
				'timestamp' => $timestamp,
				'sha1' => $sha1,
				'page' => 1
			]
		];
	}

	protected function makePdfSurface(
		string $id,
		string $label,
		string $fileTitle,
		string $timestamp,
		string $sha1,
		int $page = 1
	): array {
		return [
			'id' => $id,
			'kind' => 'pdf',
			'label' => $label,
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
				'fileTitle' => $fileTitle,
				'timestamp' => $timestamp,
				'sha1' => $sha1,
				'page' => $page
			]
		];
	}
}
