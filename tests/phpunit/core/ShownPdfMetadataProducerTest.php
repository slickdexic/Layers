<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use DOMDocument;
use MediaWiki\Extension\Layers\Cargo\CargoLayersGalleryFormat;
use MediaWiki\Extension\Layers\Hooks\WikitextHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Native PDF metadata producer evidence verifying rendered thumbnail pages,
 * selected layer payloads and unchanged shown-set metadata across direct embeds,
 * templates and galleries.
 *
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Search\ShownLayerSets
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundFileHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions
 * @group Database
 */
class ShownPdfMetadataProducerTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValues( [
			'LayersPageDrawingNamespaces' => null,
			'PdfHandlerDpi' => 150,
		] );
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		WikitextHooks::resetPageLayersFlag();
		parent::tearDown();
	}

	/**
	 * @param string $prefix
	 * @return LocalFile
	 */
	private function uploadPdf( string $prefix = 'Producer_pdf_' ): LocalFile {
		return $this->upload( $prefix . wfRandomString() . '.pdf', 'test-multipage.pdf' );
	}

	/**
	 * @param string $wikitext
	 * @param Title|null $title
	 * @return ParserOutput
	 */
	private function parseWikitext( string $wikitext, ?Title $title = null ): ParserOutput {
		$title ??= $this->getExistingTestPage()->getTitle();
		return $this->getServiceContainer()->getParserFactory()->create()->parse(
			$wikitext,
			$title,
			ParserOptions::newFromAnon(),
			true,
			true
		);
	}

	/**
	 * @param string $html
	 * @return array[] Extracted image attributes
	 */
	private function extractImages( string $html ): array {
		$document = new DOMDocument();
		$document->loadHTML( $html, LIBXML_NOERROR | LIBXML_NOWARNING );
		$images = [];
		foreach ( $document->getElementsByTagName( 'img' ) as $image ) {
			$images[] = [
				'src' => $image->getAttribute( 'src' ),
				'data-layer-data' => $image->getAttribute( 'data-layer-data' ),
				'data-layers-large' => $image->getAttribute( 'data-layers-large' ),
				'data-layers-binding' => $image->getAttribute( 'data-layers-binding' ),
				'data-page' => $image->getAttribute( 'data-page' ),
				'data-file-name' => $image->getAttribute( 'data-file-name' ),
				'data-layer-setname' => $image->getAttribute( 'data-layer-setname' ),
				'data-layers-intent' => $image->getAttribute( 'data-layers-intent' ),
			];
		}
		return $images;
	}

	/** @param LocalFile $file @param array $image @param int $page */
	private function assertNotesMember( LocalFile $file, array $image, int $page ): void {
		$this->assertStringContainsString( "page$page-", $image['src'] );
		$this->assertSame( [
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 10, 'y' => 20,
				'text' => $page === 1 ? 'Notes page one payload' : 'Notes page two payload' ] ],
			'backgroundVisible' => true, 'backgroundOpacity' => 1,
			'baseWidth' => $page === 1 ? 416 : 208, 'baseHeight' => $page === 1 ? 208 : 416
		], json_decode( $image['data-layer-data'], true, 64, JSON_THROW_ON_ERROR ) );
		$this->assertSame( $page > 1 ? (string)$page : '', $image['data-page'] );
	}

	/**
	 * Journey 1: Actual native uploads, shared legacy rows for two PDF pages,
	 * direct embeds (page 1, page 2, repeated page 2) and template expansion.
	 * Asserts rendered thumbnail pages, selected payloads and collapsed legacy triple.
	 */
	public function testDirectEmbedsAndTemplateExpansionEmitSingleSharedTriple(): void {
		$file = $this->uploadPdf( 'Shown_journey1_' );
		$this->saveSet( $file, 'Notes', 1, 'Notes page one payload', 1 );
		$this->saveSet( $file, 'Notes', 1, 'Notes page two payload', 2 );
		$fileName = $file->getName();

		// Template expansion mixed with ordinary embed
		$templateTitle = Title::newFromText( 'Template:NotesEmbed' . wfRandomString() );
		$this->editPage( $templateTitle, "[[File:$fileName|thumb|120px|page=2|layerset=Notes]]" );

		$pageTitle = $this->getExistingTestPage()->getTitle();
		$wikitext = "[[File:$fileName|thumb|120px|page=1|layerset=Notes]]\n" .
			'{{' . $templateTitle->getText() . "}}\n" .
			"{{#layers_hint:$fileName|Notes}}<gallery>\nFile:$fileName|page=2\n</gallery>\n" .
			"[[File:$fileName|thumb|120px|page=1|layerset=Notes]]\n" .
			"[[File:$fileName|thumb|120px|page=2|layerset=Notes]]\n" .
			'{{' . $templateTitle->getText() . '}}';

		$output = $this->parseWikitext( $wikitext, $pageTitle );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 6, $images, 'Interleaved direct, template and hinted gallery thumbnails' );

		foreach ( [ 1, 2, 2, 1, 2, 2 ] as $index => $page ) {
			$this->assertNotesMember( $file, $images[$index], $page );
		}

		// All member page occurrences collapse to one exact shared file/name selector
		$shown = $output->getPageProperty( ShownLayerSets::PROPERTY );
		$this->assertNotNull( $shown );
		$decoded = ShownLayerSets::decode( $shown );
		$this->assertSame( [ [ 'file', $fileName, 'Notes' ] ], $decoded );
	}

	public function testMissingMembersNeverSubstituteAnotherPageOfTheNamedSet(): void {
		$file = $this->uploadPdf( 'Shown_missing_member_' );
		$this->saveSet( $file, 'OnlyFirst', 1, 'First-only payload', 1 );
		$this->saveSet( $file, 'OnlySecond', 1, 'Second-only payload', 2 );
		$name = $file->getName();
		$output = $this->parseWikitext(
			"[[File:$name|thumb|120px|page=2|layerset=OnlyFirst]]\n" .
			"[[File:$name|thumb|120px|page=1|layerset=OnlySecond]]" );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );
		foreach ( [ [ 2, 'OnlyFirst' ], [ 1, 'OnlySecond' ] ] as $index => [ $page, $set ] ) {
			$this->assertStringContainsString( "page$page-", $images[$index]['src'] );
			$this->assertSame( '', $images[$index]['data-layer-data'] );
			$this->assertSame( '', $images[$index]['data-layers-large'] );
			$this->assertSame( $page === 2 ? '2' : '', $images[$index]['data-page'] );
			$this->assertSame( $name, $images[$index]['data-file-name'] );
			$this->assertSame( $set, $images[$index]['data-layers-intent'] );
			$this->assertSame( '', $images[$index]['data-layer-setname'] );
		}
		$this->assertSame( [ [ 'file', $name, 'OnlyFirst' ], [ 'file', $name, 'OnlySecond' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
	}

	/**
	 * Journey 2: Ordinary and helper-hinted galleries with supported native page=2
	 * syntax interleaved with ordinary embeds.
	 */
	public function testOrdinaryAndHintedGalleriesRenderSelectedPagesAndCollapseMetadata(): void {
		$file = $this->uploadPdf( 'Shown_journey2_' );
		$this->saveSet( $file, 'Notes', 1, 'Notes page one payload', 1 );
		$this->saveSet( $file, 'Notes', 1, 'Notes page two payload', 2 );
		$fileName = $file->getName();

		$wikitext = "[[File:$fileName|thumb|120px|page=1|layerset=Notes]]\n" .
			"<gallery>\nFile:$fileName|page=2|layerset=Notes\n</gallery>\n" .
			"{{#layers_hint:$fileName|Notes}}<gallery>\nFile:$fileName|page=2\n</gallery>\n" .
			"[[File:$fileName|thumb|120px|page=2|layerset=Notes]]";

		$output = $this->parseWikitext( $wikitext );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 4, $images, 'Four thumbnails across ordinary embeds and galleries' );

		foreach ( [ 1, 2, 2, 2 ] as $index => $page ) {
			$this->assertNotesMember( $file, $images[$index], $page );
		}

		// Metadata collapses to one shared triple
		$decoded = ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) );
		$this->assertSame( [ [ 'file', $fileName, 'Notes' ] ], $decoded );
	}

	/**
	 * Journey 2 (continued): Malformed repeated options and out-of-range pages
	 * compared with native adapter behavior.
	 */
	public function testMalformedRepeatedOptionsAndOutOfRangePagesMatchNativeAdapter(): void {
		$file = $this->uploadPdf( 'Shown_malformed_' );
		$this->saveSet( $file, 'Notes', 1, 'Notes page one payload', 1 );
		$this->saveSet( $file, 'Notes', 1, 'Notes page two payload', 2 );
		$fileName = $file->getName();

		// The last valid native option selects both the thumbnail and its member payload.
		$output1 = $this->parseWikitext( "[[File:$fileName|thumb|120px|page=1|page=2|layerset=Notes]]" );
		$images1 = $this->extractImages( $output1->getRawText() );
		$this->assertNotesMember( $file, $images1[0], 2 );

		// Repeated options: page=2|page=1| (page 1 thumbnail wins, page 1 payload)
		$output2 = $this->parseWikitext( "[[File:$fileName|thumb|120px|page=2|page=1|layerset=Notes]]" );
		$images2 = $this->extractImages( $output2->getRawText() );
		$this->assertNotesMember( $file, $images2[0], 1 );

		// Invalid options do not erase the prior valid page.
		$output3 = $this->parseWikitext( "[[File:$fileName|thumb|120px|page=2|page=oops|layerset=Notes]]" );
		$images3 = $this->extractImages( $output3->getRawText() );
		$this->assertNotesMember( $file, $images3[0], 2 );

		// Out of range: page=3| on a 2-page document clamps to page 2 in native render
		$output4 = $this->parseWikitext( "[[File:$fileName|thumb|120px|page=3|layerset=Notes]]" );
		$images4 = $this->extractImages( $output4->getRawText() );
		$this->assertNotesMember( $file, $images4[0], 2 );

		// The pure option adapter validates order; native rendering separately clamps to page count.
		$pageOptions = $this->getServiceContainer()->getMagicWordFactory()->newArray( [ 'img_page' ] );
		$matchFn = static function ( string $option ) use ( $pageOptions ): ?string {
			[ $name, $value ] = $pageOptions->matchVariableStartToEnd( $option );
			return $name === 'img_page' ? $value : null;
		};
		$this->assertSame( 2, PageOwnedBindingOptions::sourcePage( [ 'page=1', 'page=2' ], $matchFn ) );
		$this->assertSame( 1, PageOwnedBindingOptions::sourcePage( [ 'page=2', 'page=1' ], $matchFn ) );
		$this->assertSame( 2, PageOwnedBindingOptions::sourcePage( [ 'page=2', 'page=oops' ], $matchFn ) );
		$this->assertSame( 3, PageOwnedBindingOptions::sourcePage( [ 'page=3' ], $matchFn ) );
	}

	/**
	 * Journey 3: Cargo gallery formatter field contract verification or explicit deferral.
	 */
	public function testCargoGalleryFormatRendersDefaultPageOneAndPreservesMetadata(): void {
		if ( !class_exists( 'CargoGalleryFormat' ) || !class_exists( CargoLayersGalleryFormat::class ) ) {
			$this->markTestSkipped( 'Cargo extension / CargoGalleryFormat class not installed' );
		}

		$file = $this->uploadPdf( 'Shown_cargo_' );
		$this->saveSet( $file, 'Notes', 1, 'Notes page one payload', 1 );
		$this->saveSet( $file, 'Notes', 1, 'Notes page two payload', 2 );
		$fileName = $file->getName();

		$tag = 'cargo-producer-' . wfRandomString();
		$this->setTemporaryHook( 'ParserFirstCallInit', static function ( Parser $parser ) use (
			$tag, $fileName
		) {
			$parser->setHook( $tag, static function ( $input, array $args, Parser $parser ) use (
				$fileName
			) {
				$description = new \CargoFieldDescription();
				$description->mType = 'File';
				$formatter = new CargoLayersGalleryFormat( \RequestContext::getMain()->getOutput(), $parser );
				return $formatter->display(
					[
						[ 'Image' => $fileName, 'layerset' => 'Notes' ],
						[ 'Image' => $fileName, 'layerset' => 'Notes' ],
					],
					[],
					[ 'Image' => $description ],
					[]
				);
			} );
			return true;
		} );

		$output = $this->parseWikitext( "<$tag/>" );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );
		// Both rows render default page 1 (no per-row page selector exists in Cargo field contract)
		$this->assertNotesMember( $file, $images[0], 1 );
		$this->assertNotesMember( $file, $images[1], 1 );

		// Metadata property notes 'Notes' from hint, and the repeated occurrence notes default latest ''
		$decoded = ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) );
		$this->assertSame( [ [ 'file', $fileName, '' ], [ 'file', $fileName, 'Notes' ] ], $decoded );
	}

	/**
	 * Journey 4: Distinguish named/latest gallery, hide intent, missing name and failed transform.
	 */
	public function testGallerySyntacticIntentDistinguishedFromSuccessfulRender(): void {
		$file = $this->uploadPdf( 'Shown_journey4_' );
		$this->saveSet( $file, 'Notes', 1, 'Notes page one payload', 1 );
		$this->saveSet( $file, 'Notes', 1, 'Notes page two payload', 2 );
		$fileName = $file->getName();

		// 1. Named gallery: metadata intent and exact rendered member payload.
		$outNamed = $this->parseWikitext( "<gallery>\nFile:$fileName|page=2|layerset=Notes\n</gallery>" );
		$imgNamed = $this->extractImages( $outNamed->getRawText() );
		$this->assertNotesMember( $file, $imgNamed[0], 2 );
		$this->assertSame( [ [ 'file', $fileName, 'Notes' ] ],
			ShownLayerSets::decode( $outNamed->getPageProperty( ShownLayerSets::PROPERTY ) ) );

		// 2. Latest gallery retains its empty selector and selects the rendered member.
		$outLatest = $this->parseWikitext( "<gallery>\nFile:$fileName|page=2|layerset=on\n</gallery>" );
		$imgLatest = $this->extractImages( $outLatest->getRawText() );
		$this->assertNotesMember( $file, $imgLatest[0], 2 );
		$this->assertSame( [ [ 'file', $fileName, '' ] ],
			ShownLayerSets::decode( $outLatest->getPageProperty( ShownLayerSets::PROPERTY ) ) );

		// 3. Hide intent (layerset=off): NOT noted in metadata, no layer payload
		$outHide = $this->parseWikitext( "<gallery>\nFile:$fileName|page=2|layerset=off\n</gallery>" );
		$imgHide = $this->extractImages( $outHide->getRawText() );
		$this->assertSame( '', $imgHide[0]['data-layer-data'] );
		$this->assertSame( [], ShownLayerSets::decode( $outHide->getPageProperty( ShownLayerSets::PROPERTY ) ) );

		// 4. Missing named set (layerset=NonExistentSet): scan-time syntactic intent IS noted,
		// but no payload is rendered because the set does not exist
		$outMissing = $this->parseWikitext( "<gallery>\nFile:$fileName|page=2|layerset=NonExistentSet\n</gallery>" );
		$imgMissing = $this->extractImages( $outMissing->getRawText() );
		$this->assertSame( '', $imgMissing[0]['data-layer-data'] );
		$this->assertSame( [ [ 'file', $fileName, 'NonExistentSet' ] ],
			ShownLayerSets::decode( $outMissing->getPageProperty( ShownLayerSets::PROPERTY ) ) );

		// 5. Failed transform queue isolation: an invalid thumbnail does not corrupt next gallery
		$failed = "[[File:$fileName|thumb=Missing_" . wfRandomString() . ".png|page=2|layerset=Notes]]";
		$validGallery = "<gallery>\nFile:$fileName|page=2|layerset=Notes\n</gallery>";
		$outCombined = $this->parseWikitext( $failed . "\n" . $validGallery );
		$imgCombined = $this->extractImages( $outCombined->getRawText() );
		$this->assertNotSame( [], $imgCombined );
		$validImg = end( $imgCombined );
		$this->assertNotesMember( $file, $validImg, 2 );
	}

	/**
	 * Journey 5: Bounded syntax evidence for separate ID mechanisms.
	 */
	public function testSeparateIdMechanismsAndNumericOwnerReferences(): void {
		$file = $this->uploadPdf( 'Shown_journey5_' );
		$rowId = $this->saveSet( $file, 'Notes', 1, 'Notes page one payload', 1 );
		$fileName = $file->getName();

		// 1. layerset=id:<rowID>: exact row-ID syntax is excluded from shown metadata
		$outId = $this->parseWikitext( "[[File:$fileName|thumb|120px|layerset=id:$rowId]]" );
		$this->assertSame( [], ShownLayerSets::decode( $outId->getPageProperty( ShownLayerSets::PROPERTY ) ),
			'layerset=id:<rowId> is excluded from ShownLayerSets' );

		// 2. layerset=Notes|layersetid=<rowID>: producer notes 'Notes' from layerset= option
		// (while migration independently refuses the pinned option)
		$outPinned = $this->parseWikitext( "[[File:$fileName|thumb|120px|layerset=Notes|layersetid=$rowId]]" );
		$this->assertSame( [ [ 'file', $fileName, 'Notes' ] ],
			ShownLayerSets::decode( $outPinned->getPageProperty( ShownLayerSets::PROPERTY ) ),
			'Producer notes the layerset name even when layersetid is present' );

		// 3. Numeric owner/name reference is excluded from shared metadata.
		$outOwner = $this->parseWikitext( "[[File:$fileName|thumb|120px|layerset=150:Notes]]" );
		$this->assertSame( [], ShownLayerSets::decode( $outOwner->getPageProperty( ShownLayerSets::PROPERTY ) ),
			'Numeric owner/name reference is excluded from ShownLayerSets' );

		// 4. Page-owned binding (layersbinding=v1:<pageId>:<surfaceId>): excluded from ShownLayerSets
		$outBound = $this->parseWikitext( "[[File:$fileName|thumb|120px|layersbinding=v1:150:surface_abc]]" );
		$this->assertSame( [], ShownLayerSets::decode( $outBound->getPageProperty( ShownLayerSets::PROPERTY ) ),
			'layersbinding option is excluded from ShownLayerSets' );
	}
}
