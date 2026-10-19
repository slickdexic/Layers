<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\MutableRevisionRecord;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';
require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportCatalog
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration
 * @covers \MediaWiki\Extension\Layers\Revision\DrawingCatalog
 * @group Database
 * @group API
 */
class WholePdfImportCatalogTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private array $pair;
	private array $pin;
	private array $registration;
	private string $prefix;
	private ApiMain $main;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->overrideConfigValue( 'APIModules', array_replace(
			$this->getServiceContainer()->getMainConfig()->get( 'APIModules' ),
			PageOwnedPilotRegistration::apiModules() ) );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->prefix = 'PDF catalog ' . wfRandomString( 8 );
		$this->pin = $this->upload( 'File:Catalog-' . wfRandomString( 8 ) . '.pdf' );
		foreach ( [ 'source', 'target' ] as $role ) {
			$this->pair[$role] = $this->owner( $this->prefix . ' ' . $role,
				$role === 'source' ? [ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ) ] :
					[ $this->surface( 'target-two', 2 ) ] );
		}
	}

	private function upload( string $title, string $asset = 'test-multipage.pdf',
		string $timestamp = '20260906120000'
	): array {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$file = $repo->newFile( $this->getServiceContainer()->getTitleFactory()->newFromText( $title ) );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/' . $asset,
			'Isolated PDF catalog asset', 'Fixture', 0, false, $timestamp, $this->getTestSysop()->getUser() ) );
		self::guardIsolatedFixtureRepository( $repo );
		return [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1() ];
	}

	private function surface( string $id, int $page, ?array $pin = null, string $label = 'ABC' ): array {
		return [ 'id' => $id, 'kind' => 'pdf', 'label' => $label,
			'canvas' => [ 'width' => $page === 1 ? 416 : 208, 'height' => $page === 1 ? 208 : 416,
				'backgroundColor' => '#ffffff', 'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'source' => ( $pin ?? $this->pin ) + [ 'page' => $page ],
			'layers' => [ [ 'id' => 'text', 'type' => 'text', 'text' => 'Private layer ' . $id,
				'x' => 20, 'y' => 30 ] ] ];
	}

	private function document( array $surfaces ): string {
		return json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ], JSON_THROW_ON_ERROR );
	}

	private function owner( string $name, array $surfaces ): array {
		$page = $this->getExistingTestPage( $name );
		$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
			$page->getLatest(), $this->document( $surfaces ), 'Isolated PDF catalog fixture' );
		return [ 'title' => $page->getTitle(), 'pageId' => $page->getId(), 'revisionId' => $revision ];
	}

	private function replace( array $surfaces ): void {
		$owner = &$this->pair['source'];
		$owner['revisionId'] = $this->registration['publisher']->publish( $owner['title'], $this->actor,
			$owner['revisionId'], $this->document( $surfaces ), 'Isolated source change' );
	}

	/** Install readable but ambiguous historical group data into test tables only. */
	private function rawCurrent( array $surfaces ): void {
		$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( 'revision' ) );
		$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( 'page' ) );
		$owner = &$this->pair['source'];
		$text = $this->document( $surfaces );
		$content = new LayersDocumentContent( $text );
		$this->assertTrue( $content->isReadable() );
		$this->assertTrue( $content->isValid(), 'No insertion validity override is required' );
		$record = new MutableRevisionRecord( $owner['title'] );
		$record->setUser( $this->actor );
		$record->setTimestamp( wfTimestampNow() );
		$record->setComment( CommentStoreComment::newUnsavedComment( 'Isolated historical catalog group' ) );
		$record->setParentId( $owner['revisionId'] );
		$record->setContent( 'main', new WikitextContent( 'Isolated catalog historical fixture' ) );
		$record->setContent( 'layers', $content );
		$id = $this->getServiceContainer()->getRevisionStore()->insertRevisionOn( $record, $this->getDb() )->getId();
		$this->getDb()->newUpdateQueryBuilder()->update( 'page' )->set( [ 'page_latest' => $id ] )
			->where( [ 'page_id' => $owner['pageId'] ] )->caller( __METHOD__ )->execute();
		$owner['revisionId'] = $id;
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id,
			IDBAccessObject::READ_LATEST )->getContent( 'layers', RevisionRecord::RAW );
		$this->assertSame( LayersDocumentContent::class, get_class( $stored ) );
		$this->assertSame( $text, $stored->getText() );
	}

	private function state(): string {
		$result = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$rows = array_map( static fn ( $row ) => serialize( (array)$row ), iterator_to_array(
				$this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
					->caller( __METHOD__ )->fetchResultSet() ) );
			sort( $rows, SORT_STRING );
			$result[$table] = $rows;
		}
		return serialize( $result );
	}

	private function request( array $options = [], ?Authority $actor = null ): array {
		$before = $this->state();
		$context = new RequestContext();
		$context->setAuthority( $actor ?? $this->actor );
		$context->setRequest( new FauxRequest( array_replace( [ 'action' => 'layersworkingcopypdfimportcatalog',
			'search' => $this->prefix . ' source', 'exclude' => $this->pair['target']['pageId'],
			'formatversion' => 2, 'maxage' => 3600, 'smaxage' => 3600 ], $options ) ) );
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
			$result = json_decode( $formatter->output, true, 64, JSON_THROW_ON_ERROR );
			if ( isset( $result['layersworkingcopypdfimportcatalog'] ) ) {
				$envelope = $result['layersworkingcopypdfimportcatalog'];
				$this->assertSame( [ 'version', 'data' ], array_keys( $envelope ) );
				$this->assertSame( 1, $envelope['version'] );
				$this->assertSame( 0, preg_match( '/[^\x00-\x7f]/', $envelope['data'] ) );
				$result['layersworkingcopypdfimportcatalog'] =
					json_decode( $envelope['data'], true, 64, JSON_THROW_ON_ERROR );
			}
			return $result;
		} finally {
			$this->assertSame( $before, $this->state(), 'Discovery must not write fixture tables' );
		}
	}

	public function testWholeGroupHasOneNameAndLowestPageAnchorWithoutPayloadOrPin(): void {
		$pages = $this->request()['layersworkingcopypdfimportcatalog']['pages'];
		$this->assertCount( 1, $pages );
		$this->assertSame( [ 'title' => $this->pair['source']['title']->getPrefixedText(),
			'owner' => $this->pair['source']['title']->getPrefixedDBkey(),
			'pageid' => $this->pair['source']['pageId'], 'revid' => $this->pair['source']['revisionId'],
			'layerSets' => [ [ 'id' => 'source-one', 'label' => 'ABC', 'kind' => 'pdf',
				'canvas' => [ 'width' => 416, 'height' => 208 ],
				'fileTitle' => $this->pin['fileTitle'] ] ] ], $pages[0] );
		$this->assertSame( 'private', $this->main->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->main )->mCacheControl );
	}

	public function testSameNameOnDifferentFilesAndOwnersRemainsIndependent(): void {
		$otherPin = $this->upload( 'File:Other-catalog-' . wfRandomString( 8 ) . '.pdf' );
		$this->replace( [ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ),
			$this->surface( 'other-file', 1, $otherPin ), $this->surface( 'other-name', 1, null, 'XYZ' ) ] );
		$this->owner( $this->prefix . ' source second', [ $this->surface( 'another-owner', 1 ) ] );
		$pages = $this->request()['layersworkingcopypdfimportcatalog']['pages'];
		$this->assertCount( 2, $pages );
		$this->assertSame( [ 'ABC', 'ABC', 'XYZ' ], array_column( $pages[0]['layerSets'], 'label' ) );
		$this->assertSame( [ $this->pin['fileTitle'], $otherPin['fileTitle'], $this->pin['fileTitle'] ],
			array_column( $pages[0]['layerSets'], 'fileTitle' ) );
		$this->assertSame( 'ABC', $pages[1]['layerSets'][0]['label'] );
	}

	public function testMixedSourcePinsRefuseTheWholeGroupWithoutHidingAnotherSet(): void {
		$newPin = $this->upload( $this->pin['fileTitle'], 'test-multipage-replacement.pdf', '20260906130000' );
		$this->replace( [ $this->surface( 'old-two', 2 ), $this->surface( 'new-one', 1, $newPin ),
			$this->surface( 'unrelated', 1, $newPin, 'XYZ' ) ] );
		$sets = $this->request()['layersworkingcopypdfimportcatalog']['pages'][0]['layerSets'];
		$this->assertSame( [ 'XYZ' ], array_column( $sets, 'label' ) );
	}

	/** @dataProvider provideAmbiguousGroup */
	public function testAmbiguousGroupsAreNotSplitIntoSeparateChoices( string $mode ): void {
		$members = [ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ) ];
		if ( $mode === 'duplicate-page' ) {
			$members[1]['source']['page'] = 2;
		} elseif ( $mode === 'mixed-spelling' ) {
			$members[1]['label'] = 'abc';
		} else {
			$image = $this->surface( 'wrong-kind', 1 );
			$image['kind'] = 'image';
			if ( $mode === 'image-first' ) {
				array_unshift( $members, $image );
			} else {
				$members[] = $image;
			}
		}
		$members[] = $this->surface( 'independent', 1, null, 'XYZ' );
		$this->rawCurrent( $members );
		$this->assertSame( [ 'XYZ' ], array_column(
			$this->request()['layersworkingcopypdfimportcatalog']['pages'][0]['layerSets'], 'label' ) );
	}

	public static function provideAmbiguousGroup(): array {
		return [ [ 'duplicate-page' ], [ 'mixed-spelling' ], [ 'image-first' ], [ 'image-last' ] ];
	}

	public function testCurrentRevisionReplacesMetadataAndNumericSurfaceIdsRemainStrings(): void {
		$old = $this->pair['source']['revisionId'];
		$this->replace( [ $this->surface( '1', 1, null, 'Later' ) ] );
		$page = $this->request()['layersworkingcopypdfimportcatalog']['pages'][0];
		$this->assertNotSame( $old, $page['revid'] );
		$this->assertSame( $this->pair['source']['revisionId'], $page['revid'] );
		$this->assertSame( '1', $page['layerSets'][0]['id'] );
		$this->assertSame( 'Later', $page['layerSets'][0]['label'] );
	}

	public function testOwnAndHiddenOwnersAreOmittedWithoutWrites(): void {
		$this->assertSame( [ $this->pair['source']['pageId'] ], array_column(
			$this->request( [ 'search' => $this->prefix ] )['layersworkingcopypdfimportcatalog']['pages'], 'pageid' ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 1 ] )
			->where( [ 'rev_id' => $this->pair['source']['revisionId'] ] )->caller( __METHOD__ )->execute();
		$this->assertSame( [], $this->request()['layersworkingcopypdfimportcatalog']['pages'] );
	}

	public function testMissingOrDeniedFilesDoNotHideIndependentGroups(): void {
		$missing = array_replace( $this->pin, [ 'fileTitle' => 'File:Missing-catalog.pdf' ] );
		$this->rawCurrent( [ $this->surface( 'missing', 1, $missing ), $this->surface( 'available', 1 ) ] );
		$this->assertSame( [ 'available' ], array_column(
			$this->request()['layersworkingcopypdfimportcatalog']['pages'][0]['layerSets'], 'id' ) );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static fn ( $right, $title ): bool => $title->getNamespace() !== NS_FILE );
		$before = $this->state();
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->assertSame( [], $pilot->getPdfImportSourceSelections( $this->pair['source']['title'],
			$this->pair['source']['revisionId'], $authority ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testNonPdfSetsAndUnchangedImageSlideCatalogStaySeparate(): void {
		$document = json_decode(
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$this->replace( [ ...$document['surfaces'], $this->surface( 'source-one', 1 ) ] );
		$sets = $this->request()['layersworkingcopypdfimportcatalog']['pages'][0]['layerSets'];
		$this->assertSame( [ 'source-one' ], array_column( $sets, 'id' ) );
		$legacy = $this->request( [ 'action' => 'layersdrawings', 'purpose' => 'import' ] )['layersdrawings']['pages'];
		$this->assertSame( [ [ 'id' => 'presentation', 'label' => 'Welcome Slide', 'kind' => 'slide',
			'canvas' => [ 'width' => 800, 'height' => 600 ], 'fileTitle' => null ] ], $legacy[0]['drawings'] );
	}

	public function testReaderAndMalformedTargetAreRefusedWithPrivateCachePolicy(): void {
		$reader = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		foreach ( [ [ [], $reader, 'permissiondenied' ], [ [ 'exclude' => 0 ], null, 'outofrange' ] ]
			as [ $params, $actor, $code ] ) {
			try {
				$this->request( $params, $actor );
				$this->fail( 'Expected refused catalog request' );
			} catch ( ApiUsageException $error ) {
				$this->assertTrue( self::apiExceptionHasCode( $error, $code ) );
				$this->assertSame( 'private', $this->main->getCacheMode() );
			}
		}
	}

	public function testSelectedAnchorReadsCompleteGroupAndNeverAuthorizesAStaleTarget(): void {
		$choice = $this->request()['layersworkingcopypdfimportcatalog']['pages'][0];
		$params = [ 'action' => 'layersworkingcopypdfimportread',
			'targetpageid' => $this->pair['target']['pageId'], 'baserevid' => $this->pair['target']['revisionId'],
			'targetsurface' => 'target-two', 'sourcepageid' => $choice['pageid'],
			'sourcerevid' => $choice['revid'], 'sourcesurface' => $choice['layerSets'][0]['id'] ];
		$before = $this->state();
		$result = $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layersworkingcopypdfimportread'];
		$data = json_decode( $result['data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( [ [ 'page' => 1, 'surfaceId' => 'source-one' ],
			[ 'page' => 2, 'surfaceId' => 'source-two' ] ], $data['sourceGroup']['members'] );
		$this->assertSame( $before, $this->state() );
		$target = $this->pair['target'];
		$this->registration['publisher']->publish( $target['title'], $this->actor, $target['revisionId'],
			$this->document( [ $this->surface( 'target-two', 2, null, 'Newer' ) ] ), 'Newer target' );
		$before = $this->state();
		try {
			$this->doApiRequestWithToken( $params, null, $this->actor );
			$this->fail( 'Catalog metadata must not bypass stale native target admission' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'layers-working-copy-import-unavailable' ) );
		}
		$this->assertSame( $before, $this->state() );
	}

	public function testCatalogPreservesExactUnicodeLayerSetSpelling(): void {
		$label = "Re\u{0301}sume\u{0301} Ω";
		$this->replace( [ $this->surface( 'unicode-anchor', 1, null, $label ) ] );
		$entry = $this->request()['layersworkingcopypdfimportcatalog']['pages'][0]['layerSets'][0];
		$this->assertSame( $label, $entry['label'] );
		$this->assertSame( 'unicode-anchor', $entry['id'] );
	}

}
