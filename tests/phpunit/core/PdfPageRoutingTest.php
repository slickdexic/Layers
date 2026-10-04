<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Cargo\CargoLayersGalleryFormat;
use MediaWiki\Extension\Layers\Hooks\WikitextHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundFileHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions
 * @group Database
 */
class PdfPageRoutingTest extends \MediaWikiIntegrationTestCase {
	/** @var \MediaWiki\FileRepo\File\LocalFile */
	private $file;
	/** @var \MediaWiki\Title\Title */
	private $title;
	/** @var int */
	private $pageId;
	/** @var int */
	private $revisionId;
	/** @var \MediaWiki\User\User */
	private $actor;
	/** @var \MediaWiki\Extension\Layers\Revision\PagePublicationService */
	private $publisher;
	/** @var array */
	private $document;
	/** @var PageOwnedPilot */
	private $pilot;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null, 'PdfHandlerDpi' => 150 ] );
		$this->publisher = TestingAdmissionRegistration::install( $this )['publisher'];
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$services = $this->getServiceContainer();
		$fileTitle = $services->getTitleFactory()->newFromText( 'File:Routing_' . wfRandomString() . '.pdf' );
		$this->file = $services->getRepoGroup()->getLocalRepo()->newFile( $fileTitle );
		$this->assertStatusGood( $this->file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Fixture', '', 0, false, '20261001120000', $this->getTestSysop()->getUser() ) );
		$page = $this->getExistingTestPage();
		$this->title = $page->getTitle();
		$this->pageId = $this->title->getArticleID( IDBAccessObject::READ_LATEST );
		$surfaces = [];
		foreach ( [ [ 'alpha', 'Alpha', 1 ], [ 'beta', 'Beta', 2 ] ] as [ $id, $label, $sourcePage ] ) {
			$surfaces[] = [ 'id' => $id, 'kind' => 'pdf', 'label' => $label,
				'canvas' => [ 'width' => $this->file->getWidth( $sourcePage ),
					'height' => $this->file->getHeight( $sourcePage ), 'backgroundColor' => '#ffffff',
					'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
				'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 0, 'y' => 0, 'text' => $label . ' note' ] ],
				'readingOrder' => [ 'note' ], 'source' => [ 'repository' => 'local',
					'fileTitle' => 'File:' . $this->file->getName(), 'timestamp' => $this->file->getTimestamp(),
					'sha1' => $this->file->getSha1(), 'page' => $sourcePage ] ];
		}
		$this->document = [ 'schemaVersion' => 1, 'surfaces' => $surfaces ];
		$this->revisionId = $this->publisher->publish( $this->title, $this->actor, $page->getLatest(),
			json_encode( $this->document ), 'PDF routing fixture', new WikitextContent( 'Fixture' ), $this->pageId );
		$this->pilot = new PageOwnedPilot( $services, [ $this->title->getPrefixedDBkey() ] );
		MigrationState::markComplete( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	private function embed( string $name, string $options = '', string $format = 'thumb|' ): string {
		return '[[File:' . $this->file->getName() . '|' . $format . '120px|' . $options . 'layerset=' . $name . ']]';
	}

	private function parse( string $text, ?int $revisionId = null ): string {
		return $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $this->title,
			ParserOptions::newFromAnon(), true, true, $revisionId ?? $this->revisionId )->getRawText();
	}

	private function images( string $html ): array {
		$document = new \DOMDocument();
		$document->loadHTML( $html, LIBXML_NOERROR | LIBXML_NOWARNING );
		$images = [];
		foreach ( $document->getElementsByTagName( 'img' ) as $image ) {
			$images[] = [ 'binding' => $image->getAttribute( 'data-layers-binding' ),
				'revision' => $image->getAttribute( 'data-layers-revision' ), 'src' => $image->getAttribute( 'src' ) ];
		}
		return $images;
	}

	private function assertImages( string $html, array $ids, ?int $revisionId = null ): array {
		$images = $this->images( $html );
		$this->assertSameSize( $ids, $images, $html );
		foreach ( $ids as $index => $id ) {
			$this->assertSame( $id === null ? '' : "v1:{$this->pageId}:$id", $images[$index]['binding'], $html );
			$this->assertSame( $id === null ? '' : (string)( $revisionId ?? $this->revisionId ),
				$images[$index]['revision'], $html );
		}
		$this->assertStringNotContainsString( 'data-layer-data', $html );
		$this->assertStringNotContainsString( 'Alpha note', $html );
		$this->assertStringNotContainsString( 'Beta note', $html );
		return $images;
	}

	public function testExplicitAndDefaultPagesNeverSubstituteTheOnlyStoredPage(): void {
		foreach ( [ 'thumb|', '' ] as $format ) {
			$text = $this->embed( 'Beta', 'page=2|', $format ) . $this->embed( 'Beta', 'page=1|', $format ) .
				$this->embed( 'Beta', '', $format ) . $this->embed( 'Alpha', '', $format );
			$images = $this->assertImages( $this->parse( $text ), [ 'beta', null, null, 'alpha' ] );
			foreach ( [ 2, 1, 1, 1 ] as $index => $page ) {
				$this->assertStringContainsString( "page$page-", $images[$index]['src'] );
			}
		}
	}

	public function testTemplateOccurrenceAndPlainEmbedKeepTheirPositions(): void {
		$template = $this->getExistingTestPage( 'Template:Pdf routing' )->getTitle();
		$this->editPage( $template, $this->embed( 'Beta', 'page=2|' ) );
		$plain = '[[File:' . $this->file->getName() . '|thumb|120px]]';
		$text = $this->embed( 'Beta', 'page=2|' ) . $plain . $this->embed( 'Alpha', 'page=1|' ) .
			'{{Pdf routing}}';
		$this->assertImages( $this->parse( $text ), [ 'beta', null, 'alpha', 'beta' ] );
	}

	public function testRepeatedAndMalformedOptionsMatchNativeRenderedPages(): void {
		foreach ( [
			[ 'page=1|page=2|', 2, 'beta' ],
			[ 'page=2|page=1|', 1, null ],
			[ 'page=2|page=oops|', 2, 'beta' ],
			[ 'page=02|', 1, null ],
			[ 'page=0|', 1, null ],
			[ 'page=-1|', 1, null ],
			[ 'page=2x|', 1, null ],
			[ 'page= 2 |', 2, 'beta' ]
		] as [ $options, $page, $id ] ) {
			$images = $this->assertImages( $this->parse( $this->embed( 'Beta', $options ) ), [ $id ] );
			$this->assertStringContainsString( "page$page-", $images[0]['src'], $options );
		}
		$html = $this->parse( $this->embed( 'Beta', 'page=3|' ) . $this->embed( 'Alpha' ) );
		$images = $this->assertImages( $html, [ 'beta', 'alpha' ] );
		$this->assertStringContainsString( 'page2-', $images[0]['src'] );
	}

	public function testNativeGalleryUsesCorePageWithoutShiftingOrdinaryEmbeds(): void {
		$name = $this->file->getName();
		$gallery = "<gallery>\nFile:$name|page=2|layerset=Beta\n</gallery>";
		$text = $this->embed( 'Beta', 'page=2|' ) . $gallery . $this->embed( 'Alpha' );
		$images = $this->assertImages( $this->parse( $text ), [ 'beta', 'beta', 'alpha' ] );
		$this->assertStringContainsString( 'page2-', $images[1]['src'] );
		$text = "<gallery>\nFile:$name|layerset=Alpha\n</gallery>";
		$images = $this->assertImages( $this->parse( $text ), [ 'alpha' ] );
		$this->assertStringContainsString( 'page1-', $images[0]['src'] );
		$text = "{{#layers_hint:$name|Beta}}<gallery>\nFile:$name\n</gallery>";
		$this->assertImages( $this->parse( $text ), [ null ] );
	}

	public function testHintedGalleryThumbnailUsesItsActualTransformPage(): void {
		$name = $this->file->getName();
		foreach ( [ 2 => 'beta', 1 => null ] as $page => $id ) {
			$text = "{{#layers_hint:$name|Beta}}<gallery>\nFile:$name|page=$page\n</gallery>";
			$images = $this->assertImages( $this->parse( $text ), [ $id ] );
			$this->assertStringContainsString( "page$page-", $images[0]['src'] );
		}
	}

	public function testFailedEmbedDoesNotSupplyBindingToFollowingGallery(): void {
		$name = $this->file->getName();
		$failed = $this->embed( 'Beta', 'page=2|', 'thumb=Missing_' . wfRandomString() . '.png|' );
		$gallery = "<gallery>\nFile:$name\n</gallery>";
		$this->setTemporaryHook( 'ParserFirstCallInit', static function ( Parser $parser ) use (
			$name, $failed, $gallery
		) {
			$parser->setHook( 'j112b-failed-gallery', static function ( $input, array $args, Parser $parser ) use (
				$name, $failed, $gallery
			) {
				// Extension-generated output can render separate fragments within one parse.
				$html = isset( $args['fail'] ) ? $parser->recursiveTagParse( $failed ) : '';
				WikitextHooks::registerGalleryHint( $name, 'Alpha' );
				return $html . $parser->recursiveTagParse( $gallery );
			} );
			return true;
		} );
		$this->assertImages( $this->parse( '<j112b-failed-gallery/>' ), [ 'alpha' ] );
		$html = $this->parse( '<j112b-failed-gallery fail="1"/>' );
		$this->assertStringContainsString( 'mw:Error', $html );
		$this->assertImages( $html, [ 'alpha' ] );
	}

	public function testExistingEditorUsesSavedPageAndEitherRepeatedOccurrence(): void {
		$alpha = $this->embed( 'Alpha' );
		$beta = $this->embed( 'Beta', 'page=1|page=2|' );
		$clamped = $this->embed( 'Beta', 'page=3|' );
		$text = $alpha . "\n" . $beta . "\n" . $beta . "\n" . $clamped;
		$revisionId = $this->editPage( $this->title, $text )->getNewRevision()->getId();
		$entries = $this->pilot->listBoundEditorSelections( $this->pageId, $revisionId, $this->actor );
		$this->assertSame( [ 'Alpha', 'Beta' ], array_column( $entries, 'label' ) );
		foreach ( [ [ $alpha, 0, 'alpha', 1 ], [ $beta, strlen( $alpha ) + 1, 'beta', 2 ],
			[ $beta, strrpos( $text, $beta ), 'beta', 2 ],
			[ $clamped, strpos( $text, $clamped ), 'beta', 2 ] ] as [ $expected, $start, $id, $page ]
		) {
			$init = $this->pilot->prepareBoundEditor( $this->pageId, $revisionId, $start, $expected, $this->actor );
			$this->assertSame( $id, $init['pageOwned']['surfaceId'] );
			$this->assertSame( $revisionId, $init['pageOwned']['revisionId'] );
			$viewer = $this->pilot->prepareViewer( $this->title->getPrefixedText(), $revisionId,
				$id, $this->actor );
			$this->assertSame( ucfirst( $id ) . ' note', $viewer['surface']['layers'][0]['text'] );
			$this->assertSame( $viewer['source']['url'], $init['imageUrl'] );
			$this->assertStringContainsString( "page$page-", $init['imageUrl'] );
			$this->assertArrayNotHasKey( 'newSurface', $init['pageOwned'] );
		}
	}

	public function testUnannotatedPageStartsEmptyInsideTheSamePdfSet(): void {
		foreach ( [ '', 'page=1|', 'page=2|page=1|' ] as $options ) {
			$text = $this->embed( 'Beta', $options );
			$revisionId = $this->editPage( $this->title, $text )->getNewRevision()->getId();
			$selections = $this->pilot->listBoundEditorSelections( $this->pageId, $revisionId, $this->actor );
			$this->assertCount( 1, $selections );
			$this->assertTrue( $selections[0]['create'] );
			$init = $this->pilot->prepareBoundEditor( $this->pageId, $revisionId, 0, $text, $this->actor );
			$new = $init['pageOwned']['newSurface'];
			$this->assertSame( 'Beta', $new['label'] );
			$this->assertSame( 1, $new['source']['page'] );
			$this->assertSame( [], $new['layers'] );
			$this->assertNotSame( 'beta', $new['id'] );
			$this->assertSame( $this->file->getTimestamp(), $new['source']['timestamp'] );
			$this->assertStringContainsString( 'page1-', $init['imageUrl'] );
		}
	}

	/**
	 * @dataProvider provideNativePageOptions
	 * @param string $language
	 * @param string $options
	 * @param string $id
	 * @param int $page
	 */
	public function testExistingEditorMatchesNativePageOptionSpellings(
		string $language, string $options, string $id, int $page
	): void {
		$this->setContentLang( $language );
		$text = $this->embed( ucfirst( $id ), $options );
		$revisionId = $this->editPage( $this->title, $text )->getNewRevision()->getId();
		$images = $this->assertImages( $this->parse( $text, $revisionId ), [ $id ], $revisionId );
		$this->assertStringContainsString( "page$page-", $images[0]['src'], $options );
		$init = $this->pilot->prepareBoundEditor( $this->pageId, $revisionId, 0, $text, $this->actor );
		$this->assertSame( $id, $init['pageOwned']['surfaceId'], $options );
	}

	public static function provideNativePageOptions(): array {
		return [
			'English space alias' => [ 'en', 'page 2|', 'beta', 2 ],
			'Caption is not a page option' => [ 'en', 'page =2|', 'alpha', 1 ],
			'Last valid alias wins' => [ 'en', 'page=2|page 1|', 'alpha', 1 ],
			'German space alias' => [ 'de', 'seite 2|', 'beta', 2 ],
			'German equals alias' => [ 'de', 'seite=2|', 'beta', 2 ]
		];
	}

	public function testExactOldRevisionAndHiddenRevisionNeverUseLatest(): void {
		$text = $this->embed( 'Beta', 'page=2|' );
		$document = $this->document;
		$document['surfaces'] = [ $document['surfaces'][0] ];
		$newRevision = $this->publisher->publish( $this->title, $this->actor, $this->revisionId,
			json_encode( $document ), 'Remove Beta', null, $this->pageId );
		$this->assertImages( $this->parse( $text, $this->revisionId ), [ 'beta' ] );
		$this->assertImages( $this->parse( $text, $newRevision ), [ null ], $newRevision );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $this->revisionId ] )->caller( __METHOD__ )->execute();
		try {
			$this->pilot->prepareViewer( $this->title->getPrefixedText(), $this->revisionId, 'beta', $this->actor );
			$this->fail( 'Hidden layer content must be unavailable' );
		} catch ( \DomainException $exception ) {
			$this->assertSame( 'layers-revision-unavailable', $exception->getMessage() );
		}
	}

	public function testCargoGalleryHintUsesItsRenderedDefaultPage(): void {
		if ( !class_exists( \CargoGalleryFormat::class ) ) {
			$this->markTestSkipped( 'Cargo is not installed' );
		}
		$name = $this->file->getName();
		$this->setTemporaryHook( 'ParserFirstCallInit', static function ( Parser $parser ) use ( $name ) {
			$parser->setHook( 'j112b-gallery', static function ( $input, array $args, Parser $parser ) use ( $name ) {
				$description = new \CargoFieldDescription();
				$description->mType = 'File';
				$formatter = new CargoLayersGalleryFormat( \RequestContext::getMain()->getOutput(), $parser );
				return $formatter->display( [ [ 'Image' => $name, 'layerset' => $args['set'] ] ], [],
					[ 'Image' => $description ], [] );
			} );
			return true;
		} );
		foreach ( [ 'Alpha' => 'alpha', 'Beta' => null ] as $name => $id ) {
			$text = $this->embed( 'Beta', 'page=2|' ) . "<j112b-gallery set=\"$name\"/>" . $this->embed( 'Alpha' );
			$images = $this->assertImages( $this->parse( $text ), [ 'beta', $id, 'alpha' ] );
			$this->assertStringContainsString( 'page1-', $images[1]['src'] );
		}
	}
}
