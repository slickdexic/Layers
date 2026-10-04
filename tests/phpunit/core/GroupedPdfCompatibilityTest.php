<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Parser\ParserOutputFlags;
use MediaWiki\Revision\MutableRevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundFileHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBinding
 * @group Database
 */
class GroupedPdfCompatibilityTest extends \MediaWikiIntegrationTestCase {

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
	/** @var PageOwnedPilot */
	private $pilot;
	/** @var array */
	private $surfaces = [];

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null, 'PdfHandlerDpi' => 150 ] );
		$this->publisher = TestingAdmissionRegistration::install( $this )['publisher'];
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$services = $this->getServiceContainer();
		$fileTitle = $services->getTitleFactory()->newFromText( 'File:Grouped_' . wfRandomString() . '.pdf' );
		$this->file = $services->getRepoGroup()->getLocalRepo()->newFile( $fileTitle );
		$this->assertStatusGood( $this->file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Fixture', '', 0, false, '20261003120000', $this->getTestSysop()->getUser() ) );
		$page = $this->getExistingTestPage();
		$this->title = $page->getTitle();
		$this->pageId = $this->title->getArticleID( IDBAccessObject::READ_LATEST );
		$this->revisionId = $page->getLatest();
		$this->pilot = new PageOwnedPilot( $services, [ $this->title->getPrefixedDBkey() ] );
		MigrationState::markComplete( $this->getDb() );
		$canonicalFile = 'File:' . $this->file->getName();
		$this->setTemporaryHook( 'ParserFirstCallInit', static function ( Parser $parser ) use ( $canonicalFile ) {
			$parser->setHook( 'j113d-compatibility', static function ( $input, array $args, Parser $parser ) use (
				$canonicalFile
			) {
				$parser->getOutput()->setExtensionData( 'j113d-labels', [
					BoundSlideHooks::drawingOfFileNamed( $parser, $canonicalFile, 'ABC' ),
					BoundSlideHooks::onlyDrawingOf( $parser, $canonicalFile ),
					BoundSlideHooks::drawingOfFileNamed( $parser, $canonicalFile, 'abc_2' )
				] );
				return '';
			} );
			return true;
		} );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	private function surface( string $id, string $label, int $page ): array {
		return [ 'id' => $id, 'kind' => 'pdf', 'label' => $label,
			'canvas' => [ 'width' => $this->file->getWidth( $page ), 'height' => $this->file->getHeight( $page ),
				'backgroundColor' => '#ffffff', 'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => $page * 10, 'y' => $page * 20,
				'text' => $id . ' private payload', 'fontSize' => 20 + $page, 'color' => '#123456' ] ],
			'readingOrder' => [ 'note' ], 'source' => [ 'repository' => 'local',
				'fileTitle' => 'File:' . $this->file->getName(), 'timestamp' => $this->file->getTimestamp(),
				'sha1' => $this->file->getSha1(), 'page' => $page ] ];
	}

	private function publish( array $surfaces ): int {
		$this->revisionId = $this->publisher->publish( $this->title, $this->actor, $this->revisionId,
			json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ), 'Grouped PDF fixture',
			new WikitextContent( 'Fixture' ), $this->pageId );
		$this->surfaces[$this->revisionId] = array_column( $surfaces, null, 'id' );
		return $this->revisionId;
	}

	/**
	 * Insert historical fixture content in isolated tables without changing publication validation or page_latest.
	 * @param array $surfaces
	 * @return int
	 */
	private function historical( array $surfaces ): int {
		$content = new LayersDocumentContent( json_encode( [ 'schemaVersion' => 1,
			'surfaces' => $surfaces ] ) );
		$this->assertTrue( $content->isReadable() );
		$revision = new MutableRevisionRecord( $this->title );
		$revision->setUser( $this->actor );
		$revision->setTimestamp( wfTimestampNow() );
		$revision->setComment( CommentStoreComment::newUnsavedComment( 'Historical grouped PDF fixture' ) );
		$revision->setParentId( $this->revisionId );
		$revision->setContent( 'main', new WikitextContent( 'Fixture' ) );
		$revision->setContent( 'layers', $content );
		$stored = $this->getServiceContainer()->getRevisionStore()->insertRevisionOn( $revision, $this->getDb() );
		$this->surfaces[$stored->getId()] = array_column( $surfaces, null, 'id' );
		return $stored->getId();
	}

	private function embed( string $name, string $options = '', ?string $fileName = null ): string {
		return '[[File:' . ( $fileName ?? $this->file->getName() ) .
			'|thumb|120px|' . $options . 'layerset=' . $name . ']]';
	}

	private function assertParsed( string $text, array $ids, array $pages, ?int $revisionId = null,
		?ParserOptions $options = null, bool $varies = true
	): ParserOutput {
		$revisionId = $revisionId ?? $this->revisionId;
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $this->title,
			$options ?? ParserOptions::newFromAnon(), true, true, $options === null ? $revisionId : 0 );
		$html = $parsed->getRawText();
		$document = new \DOMDocument();
		$document->loadHTML( $html, LIBXML_NOERROR | LIBXML_NOWARNING );
		$images = $document->getElementsByTagName( 'img' );
		$this->assertSame( count( $ids ), $images->length, $html );
		$bindings = [];
		foreach ( $ids as $index => $id ) {
			$image = $images->item( $index );
			$this->assertStringContainsString( 'page' . $pages[$index] . '-', $image->getAttribute( 'src' ) );
			$binding = $id === null ? '' : "v1:{$this->pageId}:$id";
			$this->assertSame( $binding, $image->getAttribute( 'data-layers-binding' ), $html );
			$this->assertSame( $id === null ? '' : (string)$revisionId,
				$image->getAttribute( 'data-layers-revision' ), $html );
			if ( $id !== null ) {
				$bindings[$binding] = [ 'revisionId' => $revisionId, 'pageId' => $this->pageId ];
				$viewer = $this->pilot->prepareViewer( $this->title->getPrefixedText(),
					$revisionId, $id, $this->actor );
				$this->assertEquals( $this->surfaces[$revisionId][$id], $viewer['surface'] );
				$this->assertStringContainsString( 'page' . $pages[$index] . '-', $viewer['source']['url'] );
			}
		}
		$actualBindings = $parsed->getExtensionData( BoundSlideHooks::DATA_KEY ) ?? [];
		ksort( $bindings );
		ksort( $actualBindings );
		$this->assertSame( $bindings, $actualBindings );
		$this->assertSame( $varies, $parsed->getOutputFlag( ParserOutputFlags::VARY_REVISION ) );
		$this->assertStringNotContainsString( 'private payload', json_encode( $parsed->toJsonArray() ) );
		$this->assertStringNotContainsString( 'data-layer-data', $html );
		return $parsed;
	}

	private function namesAt( int $revisionId, ?ParserOptions $options = null ): array {
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( '<j113d-compatibility/>',
			$this->title, $options ?? ParserOptions::newFromAnon(), true, true,
			$options === null ? $revisionId : 0 );
		$this->assertTrue( $parsed->getOutputFlag( ParserOutputFlags::VARY_REVISION ) );
		return $parsed->getExtensionData( 'j113d-labels' );
	}

	public function testNumberedGroupResolvesEachPageAndCompletePayload(): void {
		$this->publish( [ $this->surface( 'numbered-one', 'ABC 2', 1 ),
			$this->surface( 'numbered-two', 'ABC 2', 2 ) ] );
		$this->assertParsed( $this->embed( 'ABC' ) . $this->embed( 'ABC', 'page=2|' ),
			[ 'numbered-one', 'numbered-two' ], [ 1, 2 ] );
	}

	public function testTransitionalOnCountsOneGroupAcrossPages(): void {
		$this->publish( [ $this->surface( 'single-one', 'ABC 2', 1 ),
			$this->surface( 'single-two', 'ABC 2', 2 ) ] );
		$this->assertParsed( $this->embed( 'on' ) . $this->embed( 'on', 'page=2|' ),
			[ 'single-one', 'single-two' ], [ 1, 2 ] );
	}

	public function testExactNameWinsEvenWhenItsSelectedPageIsMissing(): void {
		$this->publish( [ $this->surface( 'numbered-one', 'ABC 2', 1 ),
			$this->surface( 'numbered-two', 'ABC 2', 2 ), $this->surface( 'exact-one', 'ABC', 1 ) ] );
		$this->assertParsed( $this->embed( 'abc' ) . $this->embed( 'ABC', 'page=2|' ) .
			$this->embed( 'ABC 2', 'page=2|' ), [ 'exact-one', null, 'numbered-two' ], [ 1, 2, 2 ] );
	}

	public function testTwoNumberedNamesStayAmbiguousAcrossTheEntireFile(): void {
		$this->publish( [ $this->surface( 'second-one', 'ABC 2', 1 ),
			$this->surface( 'third-two', 'ABC 3', 2 ) ] );
		$this->assertParsed( $this->embed( 'ABC' ) . $this->embed( 'ABC', 'page=2|' ) .
			$this->embed( 'on' ) . $this->embed( 'on', 'page=2|' ), [ null, null, null, null ], [ 1, 2, 1, 2 ] );
		$this->assertSame( [ 'ABC', null, 'ABC 2' ], $this->namesAt( $this->revisionId ) );
	}

	public function testDuplicateSelectedPageRemainsAmbiguousInHistoricalContent(): void {
		$revisionId = $this->historical( [ $this->surface( 'duplicate-one', 'ABC 2', 1 ),
			$this->surface( 'duplicate-other', 'ABC 2', 1 ), $this->surface( 'unique-two', 'ABC 2', 2 ) ] );
		$this->assertParsed( $this->embed( 'ABC' ) . $this->embed( 'ABC', 'page=2|' ) .
			$this->embed( 'on' ) . $this->embed( 'on', 'page=2|' ),
			[ null, 'unique-two', null, 'unique-two' ], [ 1, 2, 1, 2 ], $revisionId );
	}

	/**
	 * @dataProvider provideEquivalentSpellings
	 * @param string $first
	 * @param string $second
	 */
	public function testHistoricalEquivalentLabelsKeepFirstStoredSpelling( string $first, string $second ): void {
		$revisionId = $this->historical( [ $this->surface( 'spelling-one', $first, 1 ),
			$this->surface( 'spelling-two', $second, 2 ) ] );
		$this->assertParsed( $this->embed( 'ABC' ) . $this->embed( 'ABC', 'page=2|' ) .
			$this->embed( 'on' ) . $this->embed( 'on', 'page=2|' ),
			[ 'spelling-one', 'spelling-two', 'spelling-one', 'spelling-two' ], [ 1, 2, 1, 2 ], $revisionId );
		$this->assertSame( [ $first, $first, $first ], $this->namesAt( $revisionId ) );
	}

	public static function provideEquivalentSpellings(): array {
		return [ 'Space first' => [ 'AbC 2', 'abc_2' ], 'Underscore first' => [ 'AbC_2', 'abc 2' ] ];
	}

	public function testOtherFileAndSlideEqualNamesDoNotParticipate(): void {
		$services = $this->getServiceContainer();
		$fileTitle = $services->getTitleFactory()->newFromText( 'File:Other_grouped_' . wfRandomString() . '.pdf' );
		$otherFile = $services->getRepoGroup()->getLocalRepo()->newFile( $fileTitle );
		$this->assertStatusGood( $otherFile->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Fixture', '', 0, false, '20261003120000', $this->getTestSysop()->getUser() ) );
		$other = $this->surface( 'other-one', 'ABC 2', 1 );
		$other['source']['fileTitle'] = 'File:' . $otherFile->getName();
		$other['source']['timestamp'] = $otherFile->getTimestamp();
		$other['source']['sha1'] = $otherFile->getSha1();
		$slide = $this->surface( 'slide', 'ABC 2', 1 );
		$slide['kind'] = 'slide';
		unset( $slide['source'] );
		$this->publish( [ $other, $slide, $this->surface( 'own-one', 'ABC 2', 1 ),
			$this->surface( 'own-two', 'ABC 2', 2 ) ] );
		$this->assertParsed( $this->embed( 'ABC' ) . $this->embed( 'on', 'page=2|' ) .
			$this->embed( 'ABC', '', $otherFile->getName() ) . $this->embed( 'on', '', $otherFile->getName() ),
			[ 'own-one', 'own-two', 'other-one', 'other-one' ], [ 1, 2, 1, 1 ] );
	}

	public function testOldRevisionSelectionSurvivesCurrentGroupChanges(): void {
		$first = $this->publish( [ $this->surface( 'old-one', 'ABC 2', 1 ),
			$this->surface( 'old-two', 'ABC 2', 2 ) ] );
		$this->publish( [ $this->surface( 'current-one', 'XYZ 2', 1 ),
			$this->surface( 'current-two', 'XYZ 2', 2 ) ] );
		$text = $this->embed( 'ABC' ) . $this->embed( 'on', 'page=2|' );
		$this->assertParsed( $text, [ 'old-one', 'old-two' ], [ 1, 2 ], $first );
		$this->assertParsed( $text, [ null, 'current-two' ], [ 1, 2 ] );
	}

	public function testUnavailableRevisionsAndMissingSlotsNeverUseTheCurrentGroup(): void {
		$withoutSlot = $this->revisionId;
		$this->publish( [ $this->surface( 'current-one', 'ABC 2', 1 ),
			$this->surface( 'current-two', 'ABC 2', 2 ) ] );
		foreach ( [ $withoutSlot, 2147483647 ] as $revisionId ) {
			$this->assertParsed( $this->embed( 'ABC' ) . $this->embed( 'on', 'page=2|' ),
				[ null, null ], [ 1, 2 ], $revisionId, null, $revisionId !== 2147483647 );
			$this->assertSame( [ 'ABC', null, 'abc_2' ], $this->namesAt( $revisionId ) );
		}
		$content = new LayersDocumentContent( '{"schemaVersion":0,"surfaces":[]}' );
		$this->assertFalse( $content->isReadable() );
		$unreadable = new MutableRevisionRecord( $this->title );
		$unreadable->setId( $this->revisionId );
		$unreadable->setTimestamp( wfTimestampNow() );
		$unreadable->setUser( $this->actor );
		$unreadable->setContent( 'main', new WikitextContent( 'Fixture' ) );
		$unreadable->setContent( 'layers', $content );
		$options = ParserOptions::newFromAnon();
		$options->setCurrentRevisionRecordCallback( static fn () => $unreadable );
		$this->assertParsed( $this->embed( 'ABC' ) . $this->embed( 'on', 'page=2|' ),
			[ null, null ], [ 1, 2 ], $this->revisionId, $options );
		$this->assertSame( [ 'ABC', null, 'abc_2' ], $this->namesAt( $this->revisionId, $options ) );
	}

	public function testNativeOptionsClampingAndGallerySelectTheirOwnGroupedPages(): void {
		$this->setContentLang( 'en' );
		$this->publish( [ $this->surface( 'options-one', 'ABC 2', 1 ),
			$this->surface( 'options-two', 'ABC 2', 2 ) ] );
		foreach ( [ [ 'page 2|', 2 ], [ 'page=1|page=2|', 2 ], [ 'page=2|page 1|', 1 ],
			[ 'page=2|page=oops|', 2 ], [ 'page=99|', 2 ] ] as [ $options, $page ]
		) {
			$this->assertParsed( $this->embed( 'ABC', $options ),
				[ $page === 1 ? 'options-one' : 'options-two' ], [ $page ] );
		}
		$fileName = $this->file->getName();
		$text = $this->embed( 'ABC' ) . "<gallery>\nFile:$fileName|page=2|layerset=ABC\n" .
			"File:$fileName|page=2\n</gallery>" . $this->embed( 'on' );
		$this->assertParsed( $text, [ 'options-one', 'options-two', 'options-two', 'options-one' ], [ 1, 2, 2, 1 ] );
	}

	public function testNumericSuffixPatternIsNotExpanded(): void {
		foreach ( [ 'ABC (page 2)', 'ABC_2', 'ABC2', 'ABC 2a' ] as $label ) {
			$this->publish( [ $this->surface( 'literal', $label, 1 ) ] );
			$this->assertParsed( $this->embed( 'ABC' ), [ null ], [ 1 ] );
		}
	}
}
