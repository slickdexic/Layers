<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Accepted snapshots must not change Unicode spelling at the native request boundary.
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPublish
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportPublish
 * @group Database
 * @group API
 */
class PageOwnedSaveUnicodeTest extends \MediaWiki\Tests\Api\ApiTestCase {

	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private array $pin = [];
	private array $pair = [];
	private array $source = [];

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->overrideConfigValue( 'APIModules', array_replace(
			$this->getServiceContainer()->getMainConfig()->get( 'APIModules' ),
			PageOwnedPilotRegistration::apiModules() ) );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, true, $session );
	}

	private function text(): string {
		return "NFD e\u{0301} / NFC \u{00E9} / \u{65E5}\u{672C} / \u{1F642}";
	}

	private function slide(): array {
		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true, 16, JSON_THROW_ON_ERROR );
		$document['surfaces'][0]['layers'][0]['text'] = $this->text();
		return $document['surfaces'][0];
	}

	private function document( array $surfaces ): array {
		return [ 'schemaVersion' => 1, 'surfaces' => $surfaces ];
	}

	private function ordinary( $page, int $base, string $json, ?string $main = null ): int {
		$params = [ 'action' => 'layerspublish', 'owner' => $page->getTitle()->getPrefixedText(),
			'baserevid' => $base, 'data' => $json ];
		if ( $main !== null ) {
			$params['maintext'] = $main;
		}
		return $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layerspublish']['revid'];
	}

	private function revision( int $id ) {
		return $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$id, IDBAccessObject::READ_LATEST );
	}

	/** @dataProvider provideJsonEncoding @param bool $escaped */
	public function testOrdinarySavePreservesExactTextAndNoOp( bool $escaped ): void {
		$page = $this->getExistingTestPage();
		$base = $page->getLatest();
		$main = $this->revision( $base )->getContent( 'main' )->serialize();
		$document = $this->document( [ $this->slide() ] );
		$json = json_encode( $document, JSON_THROW_ON_ERROR | ( $escaped ? 0 : JSON_UNESCAPED_UNICODE ) );
		$id = $this->ordinary( $page, $base, $json );
		$this->assertGreaterThan( $base, $id );
		$revision = $this->revision( $id );
		$this->assertSame( $page->getId(), $revision->getPageId() );
		$this->assertSame( JsonSnapshotCodec::encode( $document ),
			$revision->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( $main, $revision->getContent( 'main' )->serialize() );
		$this->assertSame( $main, $this->revision( $base )->getContent( 'main' )->serialize() );
		$this->assertSame( $id, $this->ordinary( $page, $id, $json ) );
	}

	public function testOrdinaryCreationPreservesLiteralMainText(): void {
		$page = $this->getNonexistingTestPage();
		$main = 'Exact saved caption: ' . $this->text() . "\n[[Category:Unicode preservation]]";
		$id = $this->ordinary( $page, 0, '{"schemaVersion":1,"surfaces":[]}', $main );
		$this->assertSame( $main, $this->revision( $id )->getContent( 'main' )->serialize() );
	}

	/** @return array */
	public static function provideJsonEncoding(): array {
		return [ 'literal Unicode' => [ false ], 'ASCII escaped equivalent' => [ true ] ];
	}

	private function pdfSurface( string $id, int $page ): array {
		return [ 'id' => $id, 'kind' => 'pdf', 'label' => 'ABC',
			'canvas' => [ 'width' => 416, 'height' => 208, 'backgroundColor' => '#ffffff',
				'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'source' => $this->pin + [ 'page' => $page ],
			'layers' => [ [ 'id' => 'text-' . $id, 'type' => 'text', 'x' => 24, 'y' => 31,
				'text' => $this->text() ] ], 'readingOrder' => [ 'text-' . $id ] ];
	}

	private function pdfFixture(): array {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			'File:Unicode-preservation-' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $title );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Isolated Unicode fixture', 'Fixture', 0, false, '20260906120000',
			$this->getTestSysop()->getUser() ) );
		$this->pin = [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1() ];
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'Unicode ' . $role . ' ' . wfRandomString( 8 ) );
			$members = $role === 'target' ? [ $this->pdfSurface( 'target-two', 2 ), $this->slide() ] :
				[ $this->pdfSurface( 'source-two', 2 ), $this->pdfSurface( 'source-one', 1 ) ];
			// Seed intended NFD fixture bytes independently of the boundary under test.
			$id = $this->ordinary( $page, $page->getLatest(),
				json_encode( $this->document( $members ), JSON_THROW_ON_ERROR ) );
			$this->pair[$role] = [ 'page' => $page, 'revisionId' => $id ];
		}
		$this->source = [ 'sourcePageId' => $this->pair['source']['page']->getId(),
			'sourceRevisionId' => $this->pair['source']['revisionId'], 'sourceSurfaceId' => 'source-two',
			'targetSurfaceId' => 'target-two' ];
		$target = $this->pair['target'];
		$one = $this->pdfSurface( NewPageDrawing::surfaceId( $target['page']->getId(),
			$target['revisionId'], 'ABC', $this->pin['fileTitle'], 1 ), 1 );
		$two = $this->pdfSurface( 'target-two', 2 );
		$two['layers'][0]['text'] .= ' imported';
		return $this->document( [ $two, $this->slide(), $one ] );
	}

	private function pdfParams( string $json ): array {
		return [ 'action' => 'layersworkingcopypdfimportpublish',
			'targetpageid' => $this->pair['target']['page']->getId(),
			'baserevid' => $this->pair['target']['revisionId'], 'data' => $json,
			'importsources' => json_encode( [ $this->source ], JSON_THROW_ON_ERROR ) ];
	}

	/** @dataProvider provideJsonEncoding @param bool $escaped */
	public function testPdfImportSavePreservesCompleteGroupAndSource( bool $escaped ): void {
		$document = $this->pdfFixture();
		$target = $this->pair['target'];
		$base = $this->revision( $target['revisionId'] );
		$source = $this->revision( $this->pair['source']['revisionId'] );
		$sourceBytes = $source->getContent( PageRevisionWriter::SLOT )->serialize();
		$params = $this->pdfParams( json_encode( $document,
			JSON_THROW_ON_ERROR | ( $escaped ? 0 : JSON_UNESCAPED_UNICODE ) ) );
		$result = $this->doApiRequestWithToken( $params, null, $this->actor )[0]
			['layersworkingcopypdfimportpublish'];
		$this->assertSame( 'Success', $result['result'] );
		$this->assertGreaterThan( $base->getId(), $result['revid'] );
		$revision = $this->revision( $result['revid'] );
		$this->assertSame( $target['page']->getId(), $revision->getPageId() );
		$this->assertSame( JsonSnapshotCodec::encode( $document ),
			$revision->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( $base->getContent( 'main' )->serialize(),
			$revision->getContent( 'main' )->serialize() );
		$this->assertSame( $sourceBytes, $this->revision( $source->getId() )
			->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( $source->getId(), $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $this->pair['source']['page']->getTitle(), 0,
				IDBAccessObject::READ_LATEST )->getId() );
		$this->assertStringContainsString( $this->text(), $revision->getContent( PageRevisionWriter::SLOT )
			->serialize() );
	}

	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'comment', 'change_tag', 'change_tag_def' ]
			as $table ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$state[$table] = $rows;
		}
		return $state;
	}

	public function testRawPayloadsKeepByteLimitsAndInvalidSnapshotRefusals(): void {
		$document = $this->pdfFixture();
		$target = $this->pair['target'];
		$ordinary = [ 'action' => 'layerspublish', 'owner' => $target['page']->getTitle()->getPrefixedText(),
			'pageid' => $target['page']->getId(), 'baserevid' => $target['revisionId'],
			'data' => JsonSnapshotCodec::encode( $document ) ];
		$pdf = $this->pdfParams( $ordinary['data'] );
		foreach ( [
			[ array_replace( $ordinary, [ 'data' => str_repeat( ' ', 2097153 ) ] ), 'maxbytes' ],
			[ $ordinary + [ 'maintext' => str_repeat( ' ', 2097153 ) ], 'maxbytes' ],
			[ array_replace( $pdf, [ 'data' => str_repeat( ' ', 2097153 ) ] ), 'maxbytes' ],
			[ array_replace( $ordinary, [ 'data' => '{}' ] ), 'layers-invalid-snapshot' ],
			[ array_replace( $pdf, [ 'data' => '{}' ] ), 'layers-working-copy-import-unavailable' ]
		] as [ $params, $code ] ) {
			$before = $this->state();
			try {
				$this->doApiRequestWithToken( $params, null, $this->actor );
				$this->fail( 'Invalid request must refuse without a revision' );
			} catch ( ApiUsageException $error ) {
				$this->assertTrue( self::apiExceptionHasCode( $error, $code ), $error->getMessage() );
			}
			$this->assertSame( $before, $this->state() );
		}
	}
}
