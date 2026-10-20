<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
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
class PdfCreationExactTextTest extends \MediaWiki\Tests\Api\ApiTestCase {
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
		string $namespace = '', bool $unicodeEmbed = false
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
		$prefix = "Préface e\u{0301} π\n";
		$expected = '[[' . $title->getPrefixedDBkey() . '|page=' . $initial . '|layerset=' .
			$selector . ( $unicodeEmbed ? "|Caption e\u{0301}]]" : '|Plain caption]]' );
		$revision = $this->editPage( $page, $prefix . $expected )->getNewRevision()->getId();
		if ( $slot ) {
			$document = json_decode( file_get_contents(
				__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
			$document['surfaces'][0]['layers'][0]['text'] = "NFD e\u{0301}; NFC \u{00E9}; 日本";
			$document = json_encode( $document, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE );
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

	private function exact( array $fixture, int $page = 1 ): array {
		$result = $this->request( $fixture, [ 'pdfpage' => $page, 'exacttext' => true ] )['layerspdfcreationread'];
		$this->assertSame( [ 'version', 'data' ], array_keys( $result ) );
		$this->assertSame( 1, $result['version'] );
		$this->assertSame( 0, preg_match( '/[^\x00-\x7f]/', $result['data'] ) );
		return json_decode( $result['data'], true, 64, JSON_THROW_ON_ERROR );
	}

	/** @dataProvider provideSlots */
	public function testExactAdmissionPreservesOriginalMainAndSibling( bool $slot ): void {
		$f = $this->fixture( $slot );
		$before = $this->witness();
		$main = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $f['revision'] )
			->getContent( 'main' )->serialize();
		$this->assertStringContainsString( "e\u{0301}", $main, 'The stored fixture must actually contain NFD' );
		foreach ( [ 1, 2 ] as $page ) {
			$data = $this->exact( $f, $page );
			$this->assertSame( $main, $data['mainText'], 'Admission must retain literal saved main bytes' );
			$this->assertSame( $slot, $data['hasLayersSlot'] );
			$this->assertSame( $page, $data['context']['page'] );
			$this->assertSame( 2, $data['context']['pageCount'] );
			$this->assertSame( [], $data['context']['members'] );
			$this->assertFalse( $data['context']['stored'] );
			$this->assertSame( [], $data['context']['surface']['layers'] );
			if ( $slot ) {
				$native = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $f['revision'] )
					->getContent( 'layers' )->serialize();
				$this->assertSame( $native, $data['baseText'] );
				$this->assertSame( json_decode( $native, true ), $data['baseBundle']['snapshot'] );
			} else {
				$this->assertNull( $data['baseText'] );
				$this->assertNull( $data['baseBundle'] );
			}
			$this->privatePolicy();
		}
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideSlots(): array {
		return [ [ false ], [ true ] ];
	}

	public function testExactEmbeddingWithDecomposedCaptionIsAdmitted(): void {
		$f = $this->fixture( true, 2, 'ABC', '', true );
		$this->assertStringContainsString( "e\u{0301}", $f['expected'] );
		$before = $this->witness();
		try {
			$data = $this->exact( $f );
		} catch ( ApiUsageException $error ) {
			$this->fail( 'The literal stored embedding was refused: ' . $error->getMessage() );
		}
		$this->assertSame( [ 'start' => $f['start'], 'expected' => $f['expected'] ], $data['selection'] );
		$this->assertSame( $before, $this->witness() );
	}

	public function testLegacyShapeRemainsDefaultAndExactEnvelopeIsStrict(): void {
		$f = $this->fixture();
		$before = $this->witness();
		$legacy = $this->request( $f )['layerspdfcreationread'];
		$this->assertArrayHasKey( 'target', $legacy );
		$this->assertArrayNotHasKey( 'version', $legacy );
		$exact = $this->request( $f, [ 'exacttext' => true ] )['layerspdfcreationread'];
		$this->assertSame( [ 'version', 'data' ], array_keys( $exact ) );
		$this->assertSame( 1, $exact['version'] );
		$this->assertSame( $before, $this->witness() );
		$this->privatePolicy();
	}

	public function testExactCapacityRefusesWithoutPayloadOrWrites(): void {
		$f = $this->fixture( true );
		$this->overrideConfigValue( 'APIMaxResultSize', 1 );
		$this->refused( $f, [ 'exacttext' => true ] );
	}

	public function testExactRequestLimitsAndPostRefusalRemainPrivate(): void {
		$f = $this->fixture();
		$this->refused( $f, [ 'exacttext' => true, 'embedtext' => str_repeat( 'x', 2097153 ) ], null, 'maxbytes' );
		$this->posted = false;
		$this->refused( $f, [ 'exacttext' => true ], null, 'mustbeposted' );
	}
}
