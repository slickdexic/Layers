<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiQueryTokens;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\SourceVersionResolver
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPublish
 * @group Database
 * @group API
 */
class NativePdfEditorRefusalTest extends RealAssetTestCase {
	/** @var array<string, LocalFile> */
	private array $files = [];
	private array $lookups = [];
	private int|string|bool $nativeCount = 2;

	private function fixture(): array {
		$this->repo = $this->getMockBuilder( LocalRepo::class )->setConstructorArgs( [ [
			'name' => 'layers-fixture', 'backend' => $this->repo->getBackend(), 'url' => '/test-files'
		] ] )->onlyMethods( [ 'findFile' ] )->getMock();
		$this->repo->method( 'findFile' )->willReturnCallback( function ( $title, $options ) {
			$this->lookups[] = [ 'title' => $title->getPrefixedDBkey(), 'options' => $options ];
			return $this->files[$title->getDBkey()] ?? false;
		} );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$this->setService( 'RepoGroup', $repos );
		$this->resolver = new SourceVersionResolver( $this->repo,
			$this->getServiceContainer()->getTitleFactory() );
		$this->publisher = TestingAdmissionRegistration::install( $this, $this->context, $this->resolver )['publisher'];
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Refusal-' . wfRandomString( 8 ) . '.pdf' );
		$this->assertSame( 2, $file->pageCount() );
		$dimensions = $file->getHandlerState( 'pdfDimensionInfo' );
		$controlled = $this->getMockBuilder( LocalFile::class )
			->setConstructorArgs( [ $file->getTitle(), $this->repo ] )
			->onlyMethods( [ 'getHandlerState' ] )->getMock();
		$controlled->method( 'getHandlerState' )->willReturnCallback( function ( $key ) use ( $file, $dimensions ) {
			if ( $key === 'pdfDimensionInfo' ) {
				return array_replace( $dimensions, [ 'pageCount' => $this->nativeCount ] );
			}
			return $file->getHandlerState( $key );
		} );
		$this->files[$file->getName()] = $controlled;
		$image = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Refusal-image-' . wfRandomString( 8 ) . '.png' );
		$this->files[$image->getName()] = $image;
		$surfaces = [];
		foreach ( [ 1, 2 ] as $page ) {
			$surface = $this->makePdfSurface( $page === 2 ? 'anchor' : 'first', 'ABC',
				$file->getTitle()->getPrefixedDBkey(), $file->getTimestamp(), $file->getSha1(), $page );
			$surface['canvas']['width'] = 333;
			$surface['canvas']['height'] = 111;
			$surface['layers'] = [ [ 'id' => 'text-' . $page, 'type' => 'text',
				'text' => 'Original page ' . $page, 'x' => -17, 'y' => 29 ] ];
			$surface['readingOrder'] = [ 'text-' . $page ];
			$surfaces[] = $surface;
		}
		$otherName = $surfaces[0];
		$otherName['id'] = 'other-name';
		$otherName['label'] = 'XYZ';
		$surfaces[] = $otherName;
		$surfaces[] = $this->makeImageSurface( 'image', 'ABC', $image->getTitle()->getPrefixedDBkey(),
			$image->getTimestamp(), $image->getSha1() );
		$surfaces[] = $this->makeSlideSurface( 'slide', 'ABC' );
		$owner = $this->getExistingTestPage()->getTitle();
		$actor = $this->actor();
		$base = $this->publisher->publish( $owner, $actor, $owner->getLatestRevID(),
			$this->buildDocument( $surfaces ), 'Disposable native refusal fixture' );
		return [ $owner, $base, $actor, $controlled, $file, new PageOwnedPilot( $this->getServiceContainer() ) ];
	}

	private function witness( Title $owner, string $journey ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$owner, 0, IDBAccessObject::READ_LATEST );
		$sources = [];
		foreach ( $this->files as $name => $file ) {
			$path = $file->getLocalRefPath();
			$sources[$name] = [ 'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(),
				'path' => $file->getPath(), 'bytes' => filesize( $path ), 'sha256' => hash_file( 'sha256', $path ) ];
		}
		$value = [ 'revision' => $revision->getId(),
			'ownerRevisions' => (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
				->from( 'revision' )->where( [ 'rev_page' => $owner->getArticleID() ] )
				->caller( __METHOD__ )->fetchField(),
			'main' => $revision->getContent( 'main', RevisionRecord::RAW )->serialize(),
			'layers' => $revision->getContent( 'layers', RevisionRecord::RAW )->serialize(), 'sources' => $sources ];
		$loaded = [];
		foreach ( [ PageOwnedPilot::class, SourceVersionResolver::class, ApiLayersPublish::class,
			File::class, LocalFile::class, 'MediaWiki\\Extension\\PdfHandler\\PdfHandler',
			'MediaWiki\\Extension\\Layers\\Revision\\PagePdfEditorReadService' ] as $class ) {
			if ( class_exists( $class, false ) ) {
				$file = ( new \ReflectionClass( $class ) )->getFileName();
				$loaded[$class] = [ 'file' => $file, 'sha256' => hash_file( 'sha256', $file ) ];
			}
		}
		if ( getenv( 'LAYERS_T3_WITNESSES' ) ) {
			file_put_contents( getenv( 'LAYERS_T3_WITNESSES' ), json_encode( [ 'test' => $this->getName(),
				'journey' => $journey, 'witness' => $value, 'loaded' => $loaded,
				'controlledNativeCount' => $this->nativeCount, 'lookups' => $this->lookups ] ) . "\n",
				FILE_APPEND | LOCK_EX );
		}
		return $value;
	}

	private function request( array $fixture, array $params, bool $posted = false ): ApiMain {
		[ $owner, $base, $actor ] = $fixture;
		$request = new FauxRequest( $params + [ 'formatversion' => 2,
			'owner' => $owner->getPrefixedDBkey(), 'revid' => $base ], $posted );
		if ( $posted ) {
			$request->getSession()->setUser( $actor->getUser() );
			$request->setVal( 'token', ApiQueryTokens::getToken( $actor->getUser(), $request->getSession(),
				ApiQueryTokens::getTokenTypeSalts()['csrf'] )->toString() );
		}
		$context = new RequestContext();
		$context->setRequest( $request );
		$context->setAuthority( $actor );
		$api = new ApiMain( $context, true );
		$api->execute();
		return $api;
	}

	/** @dataProvider provideUnavailableCounts */
	public function testUnavailableNativeCountIsRefusedBySourceResolver( int|string|bool $count ): void {
		$fixture = $this->fixture();
		[ $owner, $base, $actor, $controlled, $original ] = $fixture;
		$before = $this->witness( $owner, 'count-before' );
		$this->nativeCount = $count;
		TestingAccessWrapper::newFromObject( $controlled )->pageCount = null;
		$this->assertSame( $count, $controlled->pageCount() );
		$this->assertSame( $original->getTimestamp(), $controlled->getTimestamp() );
		$this->assertSame( $original->getSha1(), $controlled->getSha1() );
		$this->assertSame( $original->getPath(), $controlled->getPath() );
		$error = null;
		try {
			$this->resolver->resolve( new LayersDocumentContent( $before['layers'] ), $actor, [ 'anchor' ] );
		} catch ( \DomainException $failure ) {
			$error = $failure->getMessage();
		}
		$this->assertSame( 'layers-source-unavailable', $error );
		$this->assertSame( $before, $this->witness( $owner, 'count-after' ) );
		$this->nativeCount = 2;
		TestingAccessWrapper::newFromObject( $controlled )->pageCount = null;
		$this->assertSame( 2, $controlled->pageCount() );
		$this->assertSame( $before, $this->witness( $owner, 'restored-before' ) );
		foreach ( [ 1, 2 ] as $page ) {
			$normal = $this->request( $fixture, [ 'action' => 'layersread',
				'binding' => 'v1:' . $owner->getArticleID() . ':anchor', 'editorpage' => $page ] )
				->getResult()->getResultData( null, [ 'Strip' => 'all' ] )['layersread']['editor'];
			$this->assertSame( $base, $normal['revisionId'] );
			$this->assertSame( $page, $normal['page'] );
			$this->assertSame( 2, $normal['pageCount'] );
			$this->assertSame( $original->getSha1(), $normal['surface']['source']['sha1'] );
			$this->assertSame( $original->getTimestamp(), $normal['surface']['source']['timestamp'] );
		}
		$this->assertSame( $before, $this->witness( $owner, 'restored-after' ) );
	}

	public static function provideUnavailableCounts(): array {
		return [ 'false native metadata count' => [ false ], 'non-integer native metadata count' => [ '2' ] ];
	}

	/** @dataProvider provideUnavailableCounts */
	public function testUnavailableNativeCountRefusesBootstrapAndExplicitReads( int|string|bool $count ): void {
		$fixture = $this->fixture();
		[ $owner, $base, $actor, $controlled, $original, $pilot ] = $fixture;
		$before = $this->witness( $owner, 'public-count-before' );
		$this->nativeCount = $count;
		TestingAccessWrapper::newFromObject( $controlled )->pageCount = null;
		$this->assertSame( $count, $controlled->pageCount() );
		try {
			$pilot->prepareEditor( $owner->getPrefixedDBkey(), $base, 'anchor', $actor );
			$this->fail( 'Unavailable count returned editor or individual fallback' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-editor-unavailable', $error->getMessage() );
		}
		foreach ( [ 1, 2 ] as $page ) {
			try {
				$this->request( $fixture, [ 'action' => 'layersread',
					'binding' => 'v1:' . $owner->getArticleID() . ':anchor', 'editorpage' => $page ] );
				$this->fail( 'Unavailable count returned an editor payload' );
			} catch ( ApiUsageException $error ) {
				$this->assertTrue( \MediaWiki\Tests\Api\ApiTestCase::apiExceptionHasCode(
					$error, 'layers-revision-unavailable' ) );
			}
		}
		$this->assertSame( $before, $this->witness( $owner, 'public-count-after' ) );
		$this->nativeCount = 2;
		TestingAccessWrapper::newFromObject( $controlled )->pageCount = null;
		$normal = $pilot->prepareEditor( $owner->getPrefixedDBkey(), $base, 'anchor', $actor );
		$this->assertSame( 2, $normal['pageOwned']['pdfContext']['pageCount'] );
		$this->assertSame( $original->getSha1(), $normal['pageOwned']['pdfContext']['surface']['source']['sha1'] );
		$this->assertSame( $before, $this->witness( $owner, 'public-restored-after' ) );
	}

	/** @dataProvider provideUnsupportedLocations */
	public function testUnsupportedPublicationRefusesCompletelyBeforeExplicitCorrection( string $location ): void {
		$this->overrideConfigValue( 'APIModules', array_replace(
			$this->getServiceContainer()->getMainConfig()->get( 'APIModules' ), [
				'layerspublish' => [ 'class' => ApiLayersPublish::class, 'factory' => function ( $main, $name ) {
					$services = $this->getServiceContainer();
					return new ApiLayersPublish( $main, $name, $this->publisher, $services->getTitleFactory(),
						PageOwnedScope::newFromServices( $services, [] ) );
				} ]
			] ) );
		$fixture = $this->fixture();
		[ $owner, $base ] = $fixture;
		$before = $this->witness( $owner, 'unsupported-before' );
		$supported = json_decode( $before['layers'], true );
		foreach ( $supported['surfaces'] as &$surface ) {
			if ( in_array( $surface['id'], [ 'first', 'anchor' ], true ) ) {
				$surface['layers'][0]['text'] = 'Unsaved page ' . $surface['source']['page'];
			}
		}
		unset( $surface );
		$unsupported = $supported;
		if ( $location === 'root' ) {
			$unsupported['metadata'] = [ 'unknown' => [ null, false, 17 ] ];
		} else {
			$unsupported['surfaces'][0]['metadata'] = [ 'unknown' => [ null, false, 17 ] ];
		}
		$payload = json_encode( $unsupported );
		$params = [ 'action' => 'layerspublish', 'pageid' => $owner->getArticleID(),
			'baserevid' => $base, 'data' => $payload, 'summary' => 'Refuse unsupported isolated work' ];
		try {
			$this->request( $fixture, $params, true );
			$this->fail( 'Unsupported fields were stripped or published' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( \MediaWiki\Tests\Api\ApiTestCase::apiExceptionHasCode(
				$error, 'layers-invalid-snapshot' ) );
		}
		$this->assertSame( $payload, $params['data'] );
		$this->assertSame( $unsupported, json_decode( $payload, true ) );
		$this->assertSame( $before, $this->witness( $owner, 'unsupported-after' ) );
		$params['data'] = json_encode( $supported );
		$result = $this->request( $fixture, $params, true )->getResult()
			->getResultData( null, [ 'Strip' => 'all' ] )['layerspublish'];
		$this->assertSame( 'Success', $result['result'] );
		$after = $this->witness( $owner, 'corrected-after' );
		$this->assertSame( $before['ownerRevisions'] + 1, $after['ownerRevisions'] );
		$this->assertSame( (int)$result['revid'], $after['revision'] );
		$this->assertSame( $before['main'], $after['main'] );
		$this->assertSame( JsonSnapshotCodec::encode( $supported ), $after['layers'] );
	}

	public static function provideUnsupportedLocations(): array {
		return [ 'root unsupported fields' => [ 'root' ], 'surface unsupported fields' => [ 'surface' ] ];
	}
}
