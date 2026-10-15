<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersPdfCreationRead;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfEditorReadService;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPdfCreationRead
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration
 * @group Database
 * @group API
 */
class ApiLayersPdfCreationReadTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private PageOwnedPilot $pilot;
	private ?ApiMain $main = null;
	private bool $posted = true;

	protected function setUp(): void {
		parent::setUp();
		$this->setContentLang( 'en' );
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$services = $this->getServiceContainer();
		$this->assertNull( $services->peekService( 'LayersPageOwnedPilot' ) );
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->assertArrayHasKey( 'layerspdfcreationread', $definitions );
		$this->assertNull( $services->peekService( 'LayersPageOwnedPilot' ), 'Registration stays lazy' );
		$this->overrideConfigValue( 'APIModules', array_replace(
			$services->getMainConfig()->get( 'APIModules' ), $definitions ) );
		$this->pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		MigrationState::markComplete( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	private function fixture( bool $slot = false, int $initial = 2, string $selector = 'ABC',
		string $namespace = ''
	): array {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			'File:CreationTransport-' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Isolated native read fixture', 'Fixture only', 0, false, '20261001120000',
			$this->getTestSysop()->getUser() )->isOK() );
		$page = $this->getExistingTestPage( $namespace . 'MissingPdfRead-' . wfRandomString( 8 ) );
		$prefix = "Préface π\n";
		$expected = '[[' . $title->getPrefixedDBkey() . '|page=' . $initial . '|layerset=' .
			$selector . '|Plain caption]]';
		$revision = $this->editPage( $page, $prefix . $expected )->getNewRevision()->getId();
		if ( $slot ) {
			$document = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
			$revision = TestingAccessWrapper::newFromObject( $this->pilot )->publisher->publish(
				$page->getTitle(), $this->actor, $revision, $document, 'Preserve independent slide' );
		}
		return [ 'page' => $page, 'revision' => $revision, 'start' => strlen( $prefix ),
			'expected' => $expected, 'file' => $file ];
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	private function request( array $fixture, array $extra = [], ?Authority $authority = null ): array {
		$params = array_replace( [ 'action' => 'layerspdfcreationread', 'formatversion' => 2,
			'pageid' => $fixture['page']->getId(), 'baserevid' => $fixture['revision'],
			'embedstart' => $fixture['start'], 'embedtext' => $fixture['expected'], 'pdfpage' => 1,
			'maxage' => 3600, 'smaxage' => 3600 ], $extra );
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( $params, $this->posted ) );
		$context->setAuthority( $authority ?? $this->actor );
		$this->main = new ApiMain( $context, true );
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
	}

	private function privatePolicy(): void {
		$this->assertSame( 'private', $this->main->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->main )->mCacheControl );
	}

	private function refused( array $fixture, array $extra = [], ?Authority $authority = null,
		string $code = 'layers-revision-unavailable'
	): void {
		$before = $this->witness();
		try {
			$this->request( $fixture, $extra, $authority );
			$this->fail( 'Unavailable creation request returned data' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ) );
			$this->assertStringNotContainsString( 'Private diagnostic', $error->getMessage() );
			$this->assertArrayNotHasKey( 'layerspdfcreationread', $this->main->getResult()->getResultData() );
			$this->privatePolicy();
		} finally {
			$this->assertSame( $before, $this->witness() );
		}
	}

	/** @dataProvider provideOpenings */
	public function testRegisteredRequestedPagesPreserveActualBaseAndStayPrivate( bool $slot, int $initial ): void {
		$f = $this->fixture( $slot, $initial );
		$before = $this->witness();
		foreach ( [ 1, 2 ] as $page ) {
			$data = $this->request( $f, [ 'pdfpage' => $page ] )['layerspdfcreationread'];
			$this->assertSame( $f['page']->getId(), $data['target']['pageId'] );
			$this->assertSame( $f['page']->getTitle()->getPrefixedDBkey(), $data['target']['owner'] );
			$this->assertSame( $f['revision'], $data['target']['revisionId'] );
			$this->assertSame( [ 'start' => $f['start'], 'expected' => $f['expected'] ], $data['selection'] );
			$this->assertSame( $slot, $data['hasLayersSlot'] );
			$this->assertSame( "Préface π\n" . $f['expected'], $data['mainText'] );
			$this->assertSame( $initial, $data['context']['initialPage'] );
			$this->assertSame( $page, $data['context']['page'] );
			$this->assertSame( $page, $data['context']['surface']['source']['page'] );
			$this->assertSame( 'ABC', $data['context']['label'] );
			$this->assertSame( [], $data['context']['members'] );
			$this->assertFalse( $data['context']['stored'] );
			$this->assertSame( [], $data['context']['surface']['layers'] );
			$this->assertSame( 2, $data['context']['pageCount'] );
			$this->assertSame( $f['file']->getSha1(), $data['context']['surface']['source']['sha1'] );
			$this->assertSame( $page, $data['context']['sourceGeometry']['page'] );
			$this->assertIsString( $data['context']['rendition']['url'] );
			if ( $slot ) {
				$native = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $f['revision'] );
				$this->assertSame( $native->getContent( 'layers' )->serialize(), $data['baseText'] );
				$this->assertSame( json_decode( $data['baseText'], true ), $data['baseBundle']['snapshot'] );
			} else {
				$this->assertNull( $data['baseText'] );
				$this->assertNull( $data['baseBundle'] );
			}
			$this->privatePolicy();
		}
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideOpenings(): array {
		return [ [ false, 1 ], [ false, 2 ], [ true, 1 ], [ true, 2 ] ];
	}

	/** @dataProvider provideBadParameters */
	public function testParameterFailuresRemainPrivateAndDoNotWrite( array $extra, string $code ): void {
		$this->refused( $this->fixture(), $extra, null, $code );
	}

	public static function provideBadParameters(): array {
		return [ [ [ 'pageid' => null ], 'missingparam' ], [ [ 'baserevid' => null ], 'missingparam' ],
			[ [ 'embedstart' => null ], 'missingparam' ], [ [ 'embedtext' => null ], 'missingparam' ],
			[ [ 'pdfpage' => null ], 'missingparam' ], [ [ 'pageid' => 0 ], 'outofrange' ],
			[ [ 'baserevid' => 0 ], 'outofrange' ], [ [ 'embedstart' => -1 ], 'outofrange' ],
			[ [ 'pdfpage' => 0 ], 'outofrange' ], [ [ 'pdfpage' => 101 ], 'outofrange' ],
			[ [ 'pdfpage' => 3 ], 'layers-revision-unavailable' ],
			[ [ 'embedtext' => 'Wrong embedding' ], 'layers-revision-unavailable' ],
			[ [ 'embedstart' => 0 ], 'layers-revision-unavailable' ] ];
	}

	/** @dataProvider provideDeniedRights */
	public function testOriginalAuthorityAndFileVisibilityAreRequired( string $right ): void {
		$f = $this->fixture();
		$this->assertArrayHasKey( 'layerspdfcreationread', $this->request( $f ) );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static fn ( $action ) => $action !== $right );
		$authority->method( 'authorizeRead' )->willReturnCallback( static fn ( $action, $title ) =>
			$action !== $right && ( $right !== 'source' || $title->getNamespace() !== NS_FILE ) );
		$this->refused( $f, [], $authority );
	}

	public static function provideDeniedRights(): array {
		return [ [ 'read' ], [ 'edit' ], [ 'editlayers' ], [ 'source' ] ];
	}

	public function testAnonymousScopeAndGetCannotReturnCreationData(): void {
		$f = $this->fixture();
		$this->refused( $f, [], $this->getServiceContainer()->getUserFactory()->newAnonymous() );
		$this->refused( $this->fixture( false, 2, 'ABC', 'Project:' ) );
		$this->posted = false;
		$this->refused( $f, [], null, 'mustbeposted' );
	}

	public function testForeignAndStaleOwnerRevisionsDoNotSubstituteLatest(): void {
		$f = $this->fixture();
		$other = $this->fixture();
		$this->refused( $f, [ 'pageid' => $other['page']->getId() ] );
		$this->refused( $f, [ 'baserevid' => $other['revision'] ] );
		$this->editPage( $f['page'], 'Newer owner text ' . $f['expected'] );
		$this->refused( $f );
	}

	public function testDefaultAndIndependentSameNameOwnersStaySeparate(): void {
		$default = $this->fixture( false, 2, 'on' );
		$this->assertSame( 'Default', $this->request( $default )['layerspdfcreationread']['context']['label'] );
		$first = $this->fixture( true );
		$second = $this->fixture( true );
		$a = $this->request( $first )['layerspdfcreationread'];
		$b = $this->request( $second )['layerspdfcreationread'];
		$this->assertSame( 'ABC', $a['context']['label'] );
		$this->assertSame( 'ABC', $b['context']['label'] );
		$this->assertNotSame( $a['target']['pageId'], $b['target']['pageId'] );
		$this->assertNotSame( $a['context']['surface']['source']['fileTitle'],
			$b['context']['surface']['source']['fileTitle'] );
		$this->assertSame( 'slide', $a['baseBundle']['snapshot']['surfaces'][0]['kind'] );
	}

	public function testStoredSparseOrEmptyGroupCannotBecomeMissingCreation(): void {
		$f = $this->fixture();
		$data = $this->request( $f )['layerspdfcreationread'];
		foreach ( [ false, true ] as $layers ) {
			$surface = $data['anchorSurface'];
			$surface['id'] = 'stored-pdf';
			$surface['layers'] = $layers ? [ [ 'id' => 'kept', 'type' => 'text', 'text' => 'Stored work' ] ] : [];
			$f['revision'] = TestingAccessWrapper::newFromObject( $this->pilot )->publisher->publish(
				$f['page']->getTitle(), $this->actor, $f['revision'], json_encode(
					[ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ), 'Native stored PDF fixture' );
			$this->refused( $f );
		}
	}

	public function testSourceReplacementCannotYieldThePreviouslyCapturedPage(): void {
		$f = $this->fixture();
		$before = $this->request( $f )['layerspdfcreationread'];
		self::guardIsolatedFixtureRepository( $this->getServiceContainer()->getRepoGroup()->getLocalRepo() );
		$this->assertTrue( $f['file']->upload( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			'Isolated source replacement', 'Fixture only', 0, false, '20261002120000',
			$this->getTestSysop()->getUser() )->isOK() );
		$replacement = $this->getServiceContainer()->getRepoGroup()->getLocalRepo()
			->newFile( $f['file']->getTitle() );
		$this->assertSame( 1, $replacement->pageCount() );
		$this->refused( $f, [ 'pdfpage' => 2 ] );
		$after = $this->request( $f )['layerspdfcreationread'];
		$this->assertSame( 1, $after['context']['pageCount'] );
		$this->assertSame( 1, $after['context']['page'] );
		$this->assertNotSame( $before['context']['surface']['source']['sha1'],
			$after['context']['surface']['source']['sha1'] );
	}

	public function testUnexpectedServiceFailureHasNoDiagnosticOrPayloadLeak(): void {
		$f = $this->fixture();
		$reader = $this->createMock( PageMissingPdfEditorReadService::class );
		$reader->method( 'read' )->willThrowException( new \RuntimeException( 'Private diagnostic path' ) );
		$modules = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		$modules['layerspdfcreationread'] = [ 'class' => ApiLayersPdfCreationRead::class,
			'factory' => static fn ( $main, $name ) => new ApiLayersPdfCreationRead( $main, $name, $reader ) ];
		$this->overrideConfigValue( 'APIModules', $modules );
		$this->refused( $f );
	}

	public function testNestedCaptionIsRefusedByExistingSourceAdmission(): void {
		$f = $this->fixture();
		$f['expected'] = str_replace( 'Plain caption', 'Linked [[Main Page|caption]]', $f['expected'] );
		$f['revision'] = $this->editPage( $f['page'], "Préface π\n" . $f['expected'] )
			->getNewRevision()->getId();
		$this->refused( $f );
	}
}
