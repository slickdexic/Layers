<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead
 * @group Database
 * @group API
 */
class WorkingCopyImportRegistrationTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private PageOwnedPilot $pilot;
	private array $pair = [];
	private ?ApiMain $main = null;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$registry = $this->registryClass();
		$services = $this->getServiceContainer();
		$this->assertNull( $services->peekService( 'LayersPageOwnedPilot' ) );
		$definitions = $registry::apiModules();
		$this->assertNull( $services->peekService( 'LayersPageOwnedPilot' ), 'Module definitions must stay lazy' );
		$modules = $services->getMainConfig()->get( 'APIModules' );
		unset( $modules['layersworkingcopyimportread'] );
		$this->overrideConfigValue( 'APIModules', array_replace( $modules, $definitions ) );
		$this->pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->assertInstanceOf( PageOwnedPilot::class, $this->pilot );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'RegisteredImport' . $role . wfRandomString( 8 ) );
			$this->pair[$role] = [ 'pageId' => $page->getId(), 'title' => $page->getTitle(),
				'revisionId' => $this->publish( $page->getTitle()->getPrefixedText(),
					$page->getLatest(), $this->document() ) ];
		}
	}

	private function registryClass(): string {
		return getenv( 'LAYERS_K_REGISTRATION_COPY' ) ?
			'MediaWiki\\Extension\\Layers\\Hooks\\J116KCopiedRegistration' : PageOwnedPilotRegistration::class;
	}

	private function document(): array {
		return json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
	}

	private function publish( string $owner, int $base, array $document ): int {
		return $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $owner,
			'baserevid' => $base, 'data' => json_encode( $document ), 'summary' => 'Isolated registration fixture'
		], null, $this->actor )[0]['layerspublish']['revid'];
	}

	private function params(): array {
		return [ 'action' => 'layersworkingcopyimportread', 'formatversion' => 2,
			'targetpageid' => $this->pair['target']['pageId'], 'baserevid' => $this->pair['target']['revisionId'],
			'targetsurface' => 'presentation', 'sourcepageid' => $this->pair['source']['pageId'],
			'sourcerevid' => $this->pair['source']['revisionId'], 'sourcesurface' => 'presentation',
			'maxage' => 3600, 'smaxage' => 3600 ];
	}

	private function state(): array {
		$state = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$state[$table] = array_map( static fn ( $row ) => (array)$row,
				iterator_to_array( $this->getDb()->newSelectQueryBuilder()->select( '*' )
					->from( $table )->caller( __METHOD__ )->fetchResultSet() ) );
		}
		return $state;
	}

	private function request( array $overrides = [], ?Authority $actor = null ): array {
		$before = $this->state();
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( array_replace( $this->params(), $overrides ) ) );
		$context->setAuthority( $actor ?? $this->actor );
		$this->main = new ApiMain( $context, true );
		try {
			$this->main->execute();
			$formatter = new class( $this->main, 'json' ) extends ApiFormatJson {
				public string $output = '';

				public function printText( $text ) {
					$this->output .= $text;
				}
			};
			$formatter->execute();
			$this->assertStringNotContainsString( '_type', $formatter->output );
			return json_decode( $formatter->output, true, 64, JSON_THROW_ON_ERROR );
		} finally {
			$this->assertEquals( $before, $this->state(), 'Registered reads must not write any fixture table' );
		}
	}

	private function privatePolicy(): void {
		$this->assertSame( 'private', $this->main->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->main )->mCacheControl );
	}

	private function refused( array $overrides = [], ?Authority $actor = null,
		string $code = 'layers-working-copy-import-unavailable'
	): void {
		try {
			$this->request( $overrides, $actor );
			$this->fail( 'Registered unavailable Import returned data' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ) );
			$this->assertArrayNotHasKey( 'layersworkingcopyimportread', $this->main->getResult()->getResultData() );
			if ( $code !== 'badvalue' ) {
				$this->privatePolicy();
			}
		}
	}

	public function testRegisteredNativeSlideAndExactFactoryComposition(): void {
		$registry = $this->registryClass();
		$definitions = $registry::apiModules();
		$this->assertArrayHasKey( 'layersworkingcopyimportread', $definitions );
		$this->assertSame( ApiLayersWorkingCopyImportRead::class,
			$definitions['layersworkingcopyimportread']['class'] );
		$result = $this->request()['layersworkingcopyimportread'];
		foreach ( [ 'target', 'source' ] as $role ) {
			$this->assertSame( [ 'pageId' => $this->pair[$role]['pageId'],
				'owner' => $this->pair[$role]['title']->getPrefixedDBkey(),
				'revisionId' => $this->pair[$role]['revisionId'], 'surfaceId' => 'presentation' ], $result[$role] );
			$this->assertSame( $this->pair[$role]['revisionId'], $result[$role . 'Bundle']['revisionId'] );
			$this->assertEquals( $this->document(), $result[$role . 'Bundle']['snapshot'] );
		}
		$this->privatePolicy();
		$module = $this->main->getModuleManager()->getModule( 'layersworkingcopyimportread' );
		$this->assertInstanceOf( ApiLayersWorkingCopyImportRead::class, $module );
		$this->assertSame( 'layersworkingcopyimportread', $module->getModuleName() );
		$reader = TestingAccessWrapper::newFromObject( $module )->reader;
		$composition = TestingAccessWrapper::newFromObject( $reader );
		$this->assertSame( TestingAccessWrapper::newFromObject( $this->pilot )->reader, $composition->reader );
		$this->assertSame( $this->pilot->getScope(), $composition->scope );
		$this->assertSame( $this->getServiceContainer()->getTitleFactory(), $composition->titles );
		$allowed = $module->getAllowedParams();
		$this->assertSame( [ 'exacttext', 'targetpageid', 'baserevid', 'targetsurface', 'sourcepageid',
			'sourcerevid', 'sourcesurface' ], array_keys( $allowed ) );
		$this->assertSame( 'boolean', $allowed['exacttext'][ApiBase::PARAM_TYPE] );
		$this->assertFalse( $allowed['exacttext'][ApiBase::PARAM_DFLT] );
		foreach ( [ 'targetpageid', 'baserevid', 'sourcepageid', 'sourcerevid' ] as $key ) {
			$this->assertSame( 'integer', $allowed[$key][ApiBase::PARAM_TYPE] );
			$this->assertSame( 1, $allowed[$key][ApiBase::PARAM_MIN] );
			$this->assertSame( 2147483647, $allowed[$key][ApiBase::PARAM_MAX] );
		}
		foreach ( [ 'targetsurface', 'sourcesurface' ] as $key ) {
			$this->assertSame( 'string', $allowed[$key][ApiBase::PARAM_TYPE] );
			$this->assertSame( 128, $allowed[$key][ApiBase::PARAM_MAX_BYTES] );
		}
		$this->witness( 'registered-native-slide', $result );
	}

	public function testExistingLayersReadPositiveCompanion(): void {
		$result = $this->request( [ 'action' => 'layersread',
			'owner' => $this->pair['target']['title']->getPrefixedText(),
			'revid' => $this->pair['target']['revisionId'] ] )['layersread'];
		$this->assertSame( $this->pair['target']['revisionId'], $result['revisionId'] );
		$this->assertEquals( $this->document(), $result['snapshot'] );
	}

	public function testFactoryModuleNameDeterminesNativeResponseKey(): void {
		$registry = $this->registryClass();
		$definition = $registry::apiModules()['layersworkingcopyimportread'];
		$this->overrideConfigValue( 'APIModules', array_replace(
			$this->getServiceContainer()->getMainConfig()->get( 'APIModules' ), [ 'importalias' => $definition ] ) );
		$result = $this->request( [ 'action' => 'importalias' ] );
		$this->assertArrayHasKey( 'importalias', $result );
		$this->assertArrayNotHasKey( 'layersworkingcopyimportread', $result );
		$this->assertSame( 'importalias',
			$this->main->getModuleManager()->getModule( 'importalias' )->getModuleName() );
		$this->privatePolicy();
	}

	public function testCollisionRejectsWholeInstallationAndDefinitionsRemainLazy(): void {
		$registry = $this->registryClass();
		$before = $this->state();
		$definitions = $registry::apiModules();
		$this->assertSame( $before, $this->state() );
		$this->assertInstanceOf( \Closure::class, $definitions['layersworkingcopyimportread']['factory'] );
		$modules = [ 'layersworkingcopyimportread' => 'UnrelatedImport', 'unrelated' => 'UnrelatedModule' ];
		$this->setMwGlobals( [ 'wgAPIModules' => $modules ] );
		try {
			$registry::onRegistration( [] );
			$this->fail( 'Conflicting Import registry entry must refuse the whole installation' );
		} catch ( \LogicException $error ) {
			$this->assertSame( 'Conflicting Layers pilot API registration', $error->getMessage() );
		}
		$this->assertSame( $modules, $GLOBALS['wgAPIModules'] );
		$this->assertArrayNotHasKey( 'layerspublish', $GLOBALS['wgAPIModules'] );
	}

	public function testMissingRegistryEntryCannotDispatch(): void {
		$modules = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		unset( $modules['layersworkingcopyimportread'] );
		$this->overrideConfigValue( 'APIModules', $modules );
		$this->refused( [], null, 'badvalue' );
	}

	public function testFreshNativeTargetPermissionSourceVisibilityAndIdentityRefusals(): void {
		$this->request();
		$reader = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$this->refused( [], $reader );
		$source = $this->pair['source'];
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 1 ] )
			->where( [ 'rev_id' => $source['revisionId'] ] )->caller( __METHOD__ )->execute();
		$this->refused();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $source['revisionId'] ] )->caller( __METHOD__ )->execute();
		$this->refused( [ 'sourcerevid' => $this->pair['target']['revisionId'] ] );
		$this->refused( [ 'sourcepageid' => $this->pair['target']['pageId'],
			'sourcerevid' => $this->pair['target']['revisionId'] ] );
		$target = $this->pair['target'];
		$document = $this->document();
		$document['surfaces'][0]['layers'][0]['text'] = 'Later target registration revision';
		$newRevision = $this->publish( $target['title']->getPrefixedText(), $target['revisionId'], $document );
		$this->assertNotSame( $target['revisionId'], $newRevision );
		$this->refused();
	}

	public function testDisabledAndOutOfScopeTargetAdmissionRefuses(): void {
		foreach ( [ [], [ NS_PROJECT ] ] as $namespaces ) {
			$this->overrideConfigValue( 'LayersPageDrawingNamespaces', $namespaces );
			$page = $this->getExistingTestPage( 'RegisteredOutside' . wfRandomString( 8 ) );
			$this->refused( [ 'targetpageid' => $page->getId(), 'baserevid' => $page->getLatest() ] );
		}
	}

	public function testRegisteredNativeImageReadKeepsPinnedCompleteBundles(): void {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->makeTitle( NS_FILE,
			'RegisteredImport' . wfRandomString( 8 ) . '.png' );
		$file = $repo->newFile( $title );
		$path = $this->getNewTempFile();
		file_put_contents( $path, base64_decode(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XkAAAAASUVORK5CYII=' ) );
		$this->assertStatusGood( $file->upload( $path, 'Isolated registration asset', 'Fixture', 0, false,
			'20261011010101', $this->getTestSysop()->getUser() ) );
		$document = $this->document();
		$surface = &$document['surfaces'][0];
		$surface['kind'] = 'image';
		$surface['canvas']['width'] = 1;
		$surface['canvas']['height'] = 1;
		$surface['source'] = [ 'repository' => 'local', 'fileTitle' => $title->getPrefixedText(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => 1 ];
		foreach ( [ 'target', 'source' ] as $role ) {
			$this->pair[$role]['revisionId'] = $this->publish( $this->pair[$role]['title']->getPrefixedText(),
				$this->pair[$role]['revisionId'], $document );
		}
		$result = $this->request()['layersworkingcopyimportread'];
		foreach ( [ 'targetBundle', 'sourceBundle' ] as $key ) {
			$this->assertEquals( $document, $result[$key]['snapshot'] );
			$this->assertEquals( $surface['source'], $result[$key]['snapshot']['surfaces'][0]['source'] );
			$this->assertSame( 1, $result[$key]['sourceGeometry']['presentation']['width'] );
			$this->assertSame( 1, $result[$key]['sourceRenditions']['presentation']['width'] );
		}
		$this->privatePolicy();
		$this->witness( 'registered-native-image', $result );
	}

	private function witness( string $event, array $data ): void {
		$output = getenv( 'LAYERS_IMPORT_RESPONSE_WITNESS' );
		if ( $output ) {
			$this->assertSame( dirname( dirname( realpath( wfTempDir() ) ) ), dirname( $output ) );
			file_put_contents( $output, json_encode( [ 'test' => $this->getName(), 'event' => $event,
				'data' => $data, 'registryClass' => $this->registryClass(),
				'pilotClass' => get_class( $this->pilot ) ], JSON_THROW_ON_ERROR ) . "\n", FILE_APPEND | LOCK_EX );
		}
	}
}
