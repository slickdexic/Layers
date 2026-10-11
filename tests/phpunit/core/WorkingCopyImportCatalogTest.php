<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Context\RequestContext;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersDrawings
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Revision\DrawingCatalog
 * @group Database
 * @group API
 */
class WorkingCopyImportCatalogTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private array $pair;
	private ApiMain $main;
	private string $prefix;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->prefix = 'Import catalog ' . wfRandomString( 8 );
		foreach ( [ 'source', 'target' ] as $role ) {
			$page = $this->getExistingTestPage( $this->prefix . ' ' . $role );
			$this->pair[$role] = [ 'title' => $page->getTitle(), 'pageId' => $page->getId(),
				'revisionId' => $this->publish( $page->getTitle()->getPrefixedText(),
					$page->getLatest(), $this->document() ) ];
		}
	}

	private function document(): array {
		return json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
	}

	private function publish( string $owner, int $base, array $document ): int {
		return $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $owner,
			'baserevid' => $base, 'data' => json_encode( $document ), 'summary' => 'Isolated catalog fixture'
		], null, $this->actor )[0]['layerspublish']['revid'];
	}

	private function state(): array {
		$result = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$result[$table] = array_map( static fn ( $row ) => (array)$row,
				iterator_to_array( $this->getDb()->newSelectQueryBuilder()->select( '*' )
					->from( $table )->caller( __METHOD__ )->fetchResultSet() ) );
		}
		return $result;
	}

	private function request( array $options = [], ?Authority $actor = null ): array {
		$before = $this->state();
		$context = new RequestContext();
		$context->setAuthority( $actor ?? $this->actor );
		$context->setRequest( new FauxRequest( array_replace( [ 'action' => 'layersdrawings',
			'purpose' => 'import', 'search' => $this->prefix . ' source',
			'exclude' => $this->pair['target']['pageId'], 'formatversion' => 2,
			'maxage' => 3600, 'smaxage' => 3600 ], $options ) ) );
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
			return json_decode( $formatter->output, true, 64, JSON_THROW_ON_ERROR );
		} finally {
			$this->assertEquals( $before, $this->state(), 'Catalog reads must not write any fixture table' );
		}
	}

	public function testImportCarriesCanonicalIdentityAndCanvasWithoutLayerPayload(): void {
		$pages = $this->request()['layersdrawings']['pages'];
		$this->assertCount( 1, $pages );
		$source = $this->pair['source'];
		$this->assertSame( $source['title']->getPrefixedDBkey(), $pages[0]['owner'] );
		$this->assertSame( $source['title']->getPrefixedText(), $pages[0]['title'] );
		$this->assertNotSame( $pages[0]['owner'], $pages[0]['title'] );
		$this->assertSame( $source['pageId'], $pages[0]['pageid'] );
		$this->assertSame( $source['revisionId'], $pages[0]['revid'] );
		$this->assertSame( [ [ 'id' => 'presentation', 'label' => 'Welcome Slide', 'kind' => 'slide',
			'canvas' => [ 'width' => 800, 'height' => 600 ], 'fileTitle' => null ] ], $pages[0]['drawings'] );
		$this->assertSame( 'private', $this->main->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->main )->mCacheControl );
	}

	public function testDefaultAndExplicitCopyRetainExactOldResponseShape(): void {
		$copy = $this->request( [ 'purpose' => 'copy' ] )['layersdrawings']['pages'];
		$this->assertSame( [ [ 'title' => $this->pair['source']['title']->getPrefixedText(),
			'pageid' => $this->pair['source']['pageId'], 'revid' => $this->pair['source']['revisionId'],
			'drawings' => [ [ 'id' => 'presentation', 'label' => 'Welcome Slide', 'kind' => 'slide' ] ] ] ], $copy );
		$result = $this->doApiRequest( [ 'action' => 'layersdrawings', 'search' => $this->prefix . ' source',
			'exclude' => $this->pair['target']['pageId'] ], null, false, $this->actor )[0]['layersdrawings'];
		$this->assertArrayNotHasKey( 'owner', $result['pages'][0] );
		$this->assertArrayNotHasKey( 'canvas', $result['pages'][0]['drawings'][0] );
	}

	public function testCurrentSourceRevisionAndCanvasReplaceEarlierListingMetadata(): void {
		$first = $this->request()['layersdrawings']['pages'][0];
		$document = $this->document();
		$document['surfaces'][0]['canvas']['width'] = 900;
		$source = $this->pair['source'];
		$revision = $this->publish( $source['title']->getPrefixedText(), $source['revisionId'], $document );
		$second = $this->request()['layersdrawings']['pages'][0];
		$this->assertNotSame( $first['revid'], $revision );
		$this->assertSame( $revision, $second['revid'] );
		$this->assertSame( 900, $second['drawings'][0]['canvas']['width'] );
	}

	public function testOwnPageAndHiddenSourceAreNotListed(): void {
		$pages = $this->request( [ 'search' => $this->prefix ] )['layersdrawings']['pages'];
		$this->assertSame( [ $this->pair['source']['pageId'] ], array_column( $pages, 'pageid' ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 1 ] )
			->where( [ 'rev_id' => $this->pair['source']['revisionId'] ] )->caller( __METHOD__ )->execute();
		$this->assertSame( [], $this->request()['layersdrawings']['pages'] );
	}

	public function testReaderAndUnknownPurposeAreRefused(): void {
		$reader = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		foreach ( [ [ [], $reader, 'permissiondenied' ], [ [ 'purpose' => 'other' ], null, 'badvalue' ] ]
			as [ $params, $actor, $code ] ) {
			try {
				$this->request( $params, $actor );
				$this->fail( 'Expected refused catalog request' );
			} catch ( ApiUsageException $error ) {
				$this->assertTrue( self::apiExceptionHasCode( $error, $code ) );
			}
		}
	}

	public function testListingDoesNotAuthorizeAnImportAfterTargetBaseChanges(): void {
		$source = $this->request()['layersdrawings']['pages'][0];
		$target = $this->pair['target'];
		$document = $this->document();
		$document['surfaces'][0]['layers'][0]['text'] = 'Newer target work after listing';
		$this->assertNotSame( $target['revisionId'],
			$this->publish( $target['title']->getPrefixedText(), $target['revisionId'], $document ) );
		try {
			$this->request( [ 'action' => 'layersworkingcopyimportread', 'targetpageid' => $target['pageId'],
				'baserevid' => $target['revisionId'], 'targetsurface' => 'presentation',
				'sourcepageid' => $source['pageid'], 'sourcerevid' => $source['revid'],
				'sourcesurface' => $source['drawings'][0]['id'] ] );
			$this->fail( 'Catalog choice must not bypass fresh native target admission' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'layers-working-copy-import-unavailable' ) );
		}
	}

	public function testImageMetadataNamesExactFileWithoutLayersOrSourcePin(): void {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->makeTitle( NS_FILE,
			'Catalog' . wfRandomString( 8 ) . '.png' );
		$file = $repo->newFile( $title );
		$path = $this->getNewTempFile();
		file_put_contents( $path, base64_decode(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XkAAAAASUVORK5CYII=' ) );
		$this->assertStatusGood( $file->upload( $path, 'Isolated catalog asset', 'Fixture', 0, false,
			'20261011010101', $this->getTestSysop()->getUser() ) );
		$document = $this->document();
		$surface = &$document['surfaces'][0];
		$surface['kind'] = 'image';
		$surface['canvas']['width'] = $surface['canvas']['height'] = 1;
		$surface['source'] = [ 'repository' => 'local', 'fileTitle' => $title->getPrefixedText(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => 1 ];
		$source = $this->pair['source'];
		$this->publish( $source['title']->getPrefixedText(), $source['revisionId'], $document );
		$this->assertSame( [ 'id' => 'presentation', 'label' => 'Welcome Slide', 'kind' => 'image',
			'canvas' => [ 'width' => 1, 'height' => 1 ], 'fileTitle' => $title->getPrefixedText() ],
			$this->request()['layersdrawings']['pages'][0]['drawings'][0] );
	}
}
