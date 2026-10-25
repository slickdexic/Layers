<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use DOMDocument;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Cargo\CargoLayersGalleryFormat;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Hooks\WikitextHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/LegacyMigrationFixtures.php';
require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Maintained native regression and journey coverage for native gallery layer-set
 * occurrence preservation (J113M).
 *
 * Verifies that each explicit line in a native <gallery> block preserves its
 * requested layer set rather than being overwritten by subsequent lines on the
 * same file, while persistent helper/Cargo filename hints and direct embeds remain
 * separate.
 *
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Search\ShownLayerSets
 * @group Database
 */
class GalleryLayerSetOccurrenceTest extends \MediaWikiIntegrationTestCase {
	use IsolatedLocalRepoFixture;
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValues( [
			'LayersPageDrawingNamespaces' => null,
			'PdfHandlerDpi' => 150,
			'NamespaceAliases' => $this->getServiceContainer()->getMainConfig()->get( 'NamespaceAliases' ) +
				[ 'Datei' => NS_FILE ],
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
	private function uploadPdf( string $prefix = 'Gallery_pdf_' ): LocalFile {
		return $this->upload( $prefix . wfRandomString() . '.pdf', 'test-multipage.pdf' );
	}

	/**
	 * @param string $prefix
	 * @return LocalFile
	 */
	private function uploadImage( string $prefix = 'Gallery_img_' ): LocalFile {
		return $this->upload( $prefix . wfRandomString() . '.png', 'test-image.png' );
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
			$parent = $image->parentNode;
			$linkHref = ( $parent && $parent->nodeName === 'a' ) ? $parent->getAttribute( 'href' ) : '';
			$linkTitle = ( $parent && $parent->nodeName === 'a' ) ? $parent->getAttribute( 'title' ) : '';
			$images[] = [
				'src' => $image->getAttribute( 'src' ),
				'alt' => $image->getAttribute( 'alt' ),
				'data-layer-data' => $image->getAttribute( 'data-layer-data' ),
				'data-layers-large' => $image->getAttribute( 'data-layers-large' ),
				'data-layers-binding' => $image->getAttribute( 'data-layers-binding' ),
				'data-page' => $image->getAttribute( 'data-page' ),
				'data-file-name' => $image->getAttribute( 'data-file-name' ),
				'data-layer-setname' => $image->getAttribute( 'data-layer-setname' ),
				'data-layers-intent' => $image->getAttribute( 'data-layers-intent' ),
				'link-href' => $linkHref,
				'link-title' => $linkTitle,
			];
		}
		return $images;
	}

	/** @param array $image @param string $text @param int $page */
	private function assertCompletePdfPayload( array $image, string $text, int $page = 1 ): void {
		$this->assertSame( [
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 10, 'y' => 20, 'text' => $text ] ],
			'backgroundVisible' => true, 'backgroundOpacity' => 1,
			'baseWidth' => $page === 1 ? 416 : 208, 'baseHeight' => $page === 1 ? 208 : 416,
		], json_decode( $image['data-layer-data'], true, 64, JSON_THROW_ON_ERROR ) );
		$this->assertStringContainsString( "page$page-", $image['src'] );
		$this->assertSame( $page === 1 ? '' : (string)$page, $image['data-page'] );
	}

	/** @param ParserOutput $output */
	private function assertNoOccurrenceTokens( ParserOutput $output ): void {
		$this->assertStringNotContainsString( 'layers-m2-', $output->getRawText() );
		$this->assertStringNotContainsString( 'layers-m2-',
			json_encode( $output->toJsonArray(), JSON_THROW_ON_ERROR ) );
	}

	/**
	 * Journey 1: Promote the preserved Alpha/Beta failure into a maintained native
	 * regression using actual uploads/legacy rows. Checks both complete independently
	 * expected payloads, thumbnail pages, dimensions and unchanged decoded metadata.
	 */
	public function testPromotedAlphaBetaGalleryLineOccurrencePreservation(): void {
		$file = $this->uploadPdf( 'Gallery_alpha_beta_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha first set payload', 1 );
		$this->saveSet( $file, 'Beta', 1, 'Beta second set payload', 1 );
		$fileName = $file->getName();

		$galleryWikitext = "<gallery>\n" .
			"File:$fileName|layerset=Alpha|First Occurrence\n" .
			"File:$fileName|layerset=Beta|Second Occurrence\n" .
			"</gallery>";

		$output = $this->parseWikitext( $galleryWikitext );
		$images = $this->extractImages( $output->getRawText() );

		$this->assertCount( 2, $images );

		// Occurrence 0 must receive Alpha payload
		$this->assertStringContainsString( 'Alpha first set payload', $images[0]['data-layer-data'],
			'First occurrence payload must match Alpha layer set' );
		$decoded0 = json_decode( $images[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( [
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 10, 'y' => 20,
				'text' => 'Alpha first set payload' ] ],
			'backgroundVisible' => true,
			'backgroundOpacity' => 1,
			'baseWidth' => 416,
			'baseHeight' => 208,
		], $decoded0 );
		$this->assertSame( '', $images[0]['data-page'] );

		// Occurrence 1 must receive Beta payload
		$this->assertStringContainsString( 'Beta second set payload', $images[1]['data-layer-data'],
			'Second occurrence payload must match Beta layer set' );
		$decoded1 = json_decode( $images[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( [
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 10, 'y' => 20,
				'text' => 'Beta second set payload' ] ],
			'backgroundVisible' => true,
			'backgroundOpacity' => 1,
			'baseWidth' => 416,
			'baseHeight' => 208,
		], $decoded1 );
		$this->assertSame( '', $images[1]['data-page'] );

		// Unchanged decoded metadata includes both distinct sets
		$decodedProps = ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) );
		$this->assertSame( [
			[ 'file', $fileName, 'Alpha' ],
			[ 'file', $fileName, 'Beta' ]
		], $decodedProps );
		$this->assertCompletePdfPayload( $images[0], 'Alpha first set payload' );
		$this->assertCompletePdfPayload( $images[1], 'Beta second set payload' );
		$this->assertNoOccurrenceTokens( $output );
	}

	/** Literal caption and native alt text are independent of a layerset option segment. */
	public function testLiteralLayersetTextInCaptionAndAltDoesNotSelectOrStripASet(): void {
		$file = $this->uploadPdf( 'Gallery_literal_layerset_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha independent payload', 1 );
		$this->saveSet( $file, 'Beta', 1, 'Beta independent payload', 1 );
		$fileName = $file->getName();
		$output = $this->parseWikitext( "<gallery>\n" .
			"File:$fileName|alt=layerset=Alpha|Literal caption mentions layerset=Alpha\n" .
			"File:$fileName|layerset=Beta|alt=layerset=Alpha|Explicit Beta caption mentions layerset=Alpha\n" .
			'</gallery>' );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );

		$document = new DOMDocument();
		$document->loadHTML( $output->getRawText(), LIBXML_NOERROR | LIBXML_NOWARNING );
		$captions = [];
		foreach ( $document->getElementsByTagName( 'div' ) as $element ) {
			if ( $element->getAttribute( 'class' ) === 'gallerytext' ) {
				$captions[] = trim( $element->textContent );
			}
		}
		$this->assertCount( 2, $captions );
		$expectedBetaPayload = [
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 10, 'y' => 20,
				'text' => 'Beta independent payload' ] ],
			'backgroundVisible' => true, 'backgroundOpacity' => 1, 'baseWidth' => 416, 'baseHeight' => 208,
		];
		$this->assertSame( [
			[ 'alt' => 'layerset=Alpha', 'caption' => 'Literal caption mentions layerset=Alpha',
				'payload' => $expectedBetaPayload ],
			[ 'alt' => 'layerset=Alpha', 'caption' => 'Explicit Beta caption mentions layerset=Alpha',
				'payload' => $expectedBetaPayload ],
		], [
			[ 'alt' => $images[0]['alt'], 'caption' => $captions[0],
				'payload' => json_decode( $images[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR ) ],
			[ 'alt' => $images[1]['alt'], 'caption' => $captions[1],
				'payload' => json_decode( $images[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR ) ],
		] );
		$this->assertCompletePdfPayload( $images[0], 'Beta independent payload' );
		$this->assertCompletePdfPayload( $images[1], 'Beta independent payload' );
		$this->assertSame( [ [ 'file', $fileName, '' ], [ 'file', $fileName, 'Beta' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
		$this->assertNoOccurrenceTokens( $output );
	}

	/**
	 * Journey 2: Cover PDF/set Notes on pages 1 and 2, independently named sets on
	 * one file, repeated identical lines, explicit hide/latest/missing names and an
	 * unhinted line falling back to helper hint.
	 */
	public function testPdfPagesNamedSetsRepeatedLinesAndUnhintedFallback(): void {
		$file = $this->uploadPdf( 'Gallery_journey2_' );
		$this->saveSet( $file, 'Notes', 1, 'Notes page one payload', 1 );
		$this->saveSet( $file, 'Notes', 1, 'Notes page two payload', 2 );
		$this->saveSet( $file, 'Diagram', 1, 'Diagram page one payload', 1 );
		$this->saveSet( $file, 'Diagram', 1, 'Diagram page two payload', 2 );
		$fileName = $file->getName();

		// Part A: Multipage Notes and Diagram across pages, plus repeated line
		$wikitext = "<gallery>\n" .
			"File:$fileName|page=1|layerset=Notes|Notes Page 1\n" .
			"File:$fileName|page=2|layerset=Notes|Notes Page 2\n" .
			"File:$fileName|page=1|layerset=Diagram|Diagram Page 1\n" .
			"File:$fileName|page=2|layerset=Diagram|Diagram Page 2\n" .
			"File:$fileName|page=1|layerset=Notes|Notes Page 1 Repeated\n" .
			"</gallery>";

		$output = $this->parseWikitext( $wikitext );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 5, $images );

		$expectedSets = [
			[ 1, 'Notes', 'Notes page one payload', 416, 208, '' ],
			[ 2, 'Notes', 'Notes page two payload', 208, 416, '2' ],
			[ 1, 'Diagram', 'Diagram page one payload', 416, 208, '' ],
			[ 2, 'Diagram', 'Diagram page two payload', 208, 416, '2' ],
			[ 1, 'Notes', 'Notes page one payload', 416, 208, '' ],
		];

		foreach ( $expectedSets as $idx => [ $page, $setName, $payloadText, $width, $height, $pageAttr ] ) {
			$this->assertStringContainsString( "page$page-", $images[$idx]['src'] );
			$decoded = json_decode( $images[$idx]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
			$this->assertSame( $payloadText, $decoded['layers'][0]['text'] );
			$this->assertSame( $width, $decoded['baseWidth'] );
			$this->assertSame( $height, $decoded['baseHeight'] );
			$this->assertSame( $pageAttr, $images[$idx]['data-page'] );
		}

		$decodedProps = ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) );
		$this->assertSame( [
			[ 'file', $fileName, 'Diagram' ],
			[ 'file', $fileName, 'Notes' ]
		], $decodedProps );

		// Part B: Explicit hide, latest and missing names
		$wikitextIntent = "<gallery>\n" .
			"File:$fileName|page=1|layerset=off|Hide Intent\n" .
			"File:$fileName|page=2|layerset=on|Latest Intent\n" .
			"File:$fileName|page=1|layerset=NonExistentSet|Missing Intent\n" .
			"</gallery>";

		$outputIntent = $this->parseWikitext( $wikitextIntent );
		$imagesIntent = $this->extractImages( $outputIntent->getRawText() );
		$this->assertCount( 3, $imagesIntent );

		// Hide: no layer data
		$this->assertSame( '', $imagesIntent[0]['data-layer-data'] );

		// Latest: loads latest set on page 2 (Diagram was inserted last)
		$this->assertStringContainsString( 'page2-', $imagesIntent[1]['src'] );
		$decodedLatest = json_decode( $imagesIntent[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Diagram page two payload', $decodedLatest['layers'][0]['text'] );

		// Missing set: no payload rendered
		$this->assertSame( '', $imagesIntent[2]['data-layer-data'] );

		// Part C: Unhinted gallery line falling back to persistent helper hint
		$wikitextHelper = "{{#layers_hint:$fileName|Notes}}\n<gallery>\n" .
			"File:$fileName|page=1|layerset=Diagram|Explicit Diagram\n" .
			"File:$fileName|page=2|Unhinted Line Falls Back to Notes\n" .
			"File:$fileName|page=1|Unhinted Line Page 1 Notes\n" .
			"File:$fileName|page=2|layerset=Diagram|Explicit Diagram 2\n" .
			"</gallery>";

		$outputHelper = $this->parseWikitext( $wikitextHelper );
		$imagesHelper = $this->extractImages( $outputHelper->getRawText() );
		$this->assertCount( 4, $imagesHelper );

		// Image 0: Explicit Diagram page 1
		$dec0 = json_decode( $imagesHelper[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Diagram page one payload', $dec0['layers'][0]['text'] );

		// Image 1: Unhinted line falls back to Notes on page 2
		$dec1 = json_decode( $imagesHelper[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Notes page two payload', $dec1['layers'][0]['text'] );

		// Image 2: Unhinted line falls back to Notes on page 1
		$dec2 = json_decode( $imagesHelper[2]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Notes page one payload', $dec2['layers'][0]['text'] );

		// Image 3: Explicit Diagram page 2
		$dec3 = json_decode( $imagesHelper[3]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Diagram page two payload', $dec3['layers'][0]['text'] );
	}

	/**
	 * Journey 3: Multiple gallery blocks, template galleries, interleaved direct embeds,
	 * captions with recursive parsing, skipped/failed gallery entries and subsequent parser instances.
	 */
	public function testMultipleGalleriesTemplatesDirectEmbedsAndParserIsolation(): void {
		$file = $this->uploadPdf( 'Gallery_journey3_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha set payload', 1 );
		$this->saveSet( $file, 'Beta', 1, 'Beta set payload', 1 );
		$fileName = $file->getName();

		$otherFile = $this->uploadImage( 'Gallery_other_' );
		$this->saveSet( $otherFile, 'OtherSet', 1, 'Other set payload', 1 );
		$otherName = $otherFile->getName();

		// Template gallery expansion with helper hint
		$tplTitle = Title::newFromText( 'Template:OccurGallery' . wfRandomString() );
		$this->editPage( $tplTitle, "{{#layers_hint:$fileName|Alpha}}<gallery>\n" .
			"File:$fileName|Template Alpha\n</gallery>" );

		// Interleaved: Gallery block 1, direct embed, template gallery, direct embed, gallery block 2
		$wikitext = "<gallery>\nFile:$fileName|layerset=Beta|Block 1 Beta\n</gallery>\n" .
			"[[File:$fileName|thumb|120px|layerset=Alpha]]\n" .
			'{{' . $tplTitle->getText() . "}}\n" .
			"[[File:$fileName|thumb|120px|layerset=Beta]]\n" .
			"<gallery>\nFile:$fileName|layerset=Alpha|Block 2 Alpha\n</gallery>";

		$output = $this->parseWikitext( $wikitext );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 5, $images );

		$expectedOrder = [
			'Beta set payload',
			'Alpha set payload',
			'Alpha set payload',
			'Beta set payload',
			'Alpha set payload',
		];

		foreach ( $expectedOrder as $idx => $expectedText ) {
			$dec = json_decode( $images[$idx]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
			$this->assertSame( $expectedText, $dec['layers'][0]['text'],
				"Image at index $idx in interleaved sequence must have expected payload" );
		}

		// Captions with recursive formatting and skipped/missing files
		$wikitextComplex = "<gallery>\n" .
			"File:NonExistentMissing_123.pdf|layerset=Alpha|Missing File 1\n" .
			"File:$fileName|layerset=Alpha|Caption with ''italic'' text\n" .
			"File:AnotherMissing_456.pdf|layerset=Beta|Missing File 2\n" .
			"File:$fileName|layerset=Beta|Second caption\n" .
			"</gallery>";

		$outputComplex = $this->parseWikitext( $wikitextComplex );
		$imagesComplex = $this->extractImages( $outputComplex->getRawText() );
		// The two missing files do not render successful images; only the two valid occurrences do.
		$this->assertCount( 2, $imagesComplex );
		$decA = json_decode( $imagesComplex[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Alpha set payload', $decA['layers'][0]['text'] );
		$decB = json_decode( $imagesComplex[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Beta set payload', $decB['layers'][0]['text'] );

		// Subsequent independent parser instance isolation
		$parser1 = $this->getServiceContainer()->getParserFactory()->create();
		$title1 = Title::newFromText( 'GalleryIsolationTest1' . wfRandomString() );
		$out1 = $parser1->parse(
			"<gallery>\nFile:$fileName|layerset=Alpha\n</gallery>",
			$title1,
			ParserOptions::newFromAnon(),
			true,
			true
		);
		$img1 = $this->extractImages( $out1->getRawText() );
		$this->assertCount( 1, $img1 );
		$dec1 = json_decode( $img1[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Alpha set payload', $dec1['layers'][0]['text'] );

		$parser2 = $this->getServiceContainer()->getParserFactory()->create();
		$title2 = Title::newFromText( 'GalleryIsolationTest2' . wfRandomString() );
		$out2 = $parser2->parse(
			"<gallery>\nFile:$fileName|layerset=Beta\n</gallery>",
			$title2,
			ParserOptions::newFromAnon(),
			true,
			true
		);
		$img2 = $this->extractImages( $out2->getRawText() );
		$this->assertCount( 1, $img2 );
		$dec2 = json_decode( $img2[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Beta set payload', $dec2['layers'][0]['text'] );
	}

	/**
	 * Journey 4: Keep native per-line hints separate from persistent helper/Cargo
	 * filename hints. Characterize named set vs latest set containing different text.
	 */
	public function testPersistentHelperAndCargoHintsSeparateFromPerLineHints(): void {
		$file = $this->uploadPdf( 'Gallery_cargo_helper_' );
		$this->saveSet( $file, 'FirstSaved', 1, 'First saved set payload', 1 );
		$this->saveSet( $file, 'SecondSaved', 1, 'Second saved set payload', 1 );
		$fileName = $file->getName();

		// A persistent helper hint {{#layers_hint:}} followed by a gallery with an
		// explicit line for SecondSaved and an unhinted line:
		// Line 1 explicitly requests SecondSaved.
		// Line 2 has no explicit hint, so it falls back to persistent FirstSaved hint.
		$wikitext = "{{#layers_hint:$fileName|FirstSaved}}\n<gallery>\n" .
			"File:$fileName|layerset=SecondSaved|Explicit Line\n" .
			"File:$fileName|Unhinted Line\n" .
			"</gallery>";

		$output = $this->parseWikitext( $wikitext );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );

		$dec0 = json_decode( $images[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Second saved set payload', $dec0['layers'][0]['text'],
			'Explicit line receives its requested set' );

		$dec1 = json_decode( $images[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'First saved set payload', $dec1['layers'][0]['text'],
			'Unhinted line preserves persistent filename hint' );

		// Cargo gallery format integration if available
		if ( class_exists( 'CargoGalleryFormat' ) && class_exists( CargoLayersGalleryFormat::class ) ) {
			$tag = 'cargo-gallery-occur-' . wfRandomString();
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
							[ 'Image' => $fileName, 'layerset' => 'FirstSaved' ],
							[ 'Image' => $fileName, 'layerset' => 'SecondSaved' ],
						],
						[],
						[ 'Image' => $description ],
						[]
					);
				} );
				return true;
			} );

			$outputCargo = $this->parseWikitext( "<$tag/>" );
			$imagesCargo = $this->extractImages( $outputCargo->getRawText() );
			$this->assertCount( 2, $imagesCargo );
			// Cargo gallery format uses registerGalleryHint, which is persistent by filename.
			// The second row overwrites the hint in the Cargo formatter loop, so both rows
			// receive SecondSaved payload under Cargo gallery format.
			$decC0 = json_decode( $imagesCargo[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
			$decC1 = json_decode( $imagesCargo[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
			$this->assertSame( 'Second saved set payload', $decC0['layers'][0]['text'] );
			$this->assertSame( 'Second saved set payload', $decC1['layers'][0]['text'] );
		}
	}

	/**
	 * Journey 5: Page-owned native gallery routing and unchanged caption/alt/link options.
	 */
	public function testCaptionAltAndLinkOptionsPreservedWithoutLayersetLeakage(): void {
		$file = $this->uploadPdf( 'Gallery_options_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha set payload', 1 );
		$fileName = $file->getName();

		$galleryWikitext = "<gallery>\n" .
			"File:$fileName|layerset=Alpha|alt=My Accessible Alt Text|link=Main Page|Visible Caption Text\n" .
			"</gallery>";

		$output = $this->parseWikitext( $galleryWikitext );
		$rawHtml = $output->getRawText();

		// layerset= must NOT be visible in HTML as caption or attribute
		$this->assertStringNotContainsString( 'layerset=', $rawHtml,
			'layerset option must be cleanly stripped from gallery line' );

		// Caption and alt text must be preserved
		$this->assertStringContainsString( 'Visible Caption Text', $rawHtml );
		$this->assertStringContainsString( 'My Accessible Alt Text', $rawHtml );

		$images = $this->extractImages( $rawHtml );
		$this->assertCount( 1, $images );
		$this->assertSame( 'My Accessible Alt Text', $images[0]['alt'] );
		$dec = json_decode( $images[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Alpha set payload', $dec['layers'][0]['text'] );
	}

	/**
	 * Journey 6 (J113M2): Explicit template gallery transclusion retaining both names.
	 *
	 * A transcluded template containing explicit Alpha then Beta gallery lines
	 * for the same file must render Alpha then Beta, not Beta/Beta.
	 */
	public function testExplicitTemplateGalleryRetainsBothNames(): void {
		$file = $this->uploadPdf( 'Gallery_boundary_tpl_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha template payload', 1 );
		$this->saveSet( $file, 'Beta', 1, 'Beta template payload', 1 );
		$fileName = $file->getName();

		$template = Title::newFromText( 'Template:GalleryBoundary' . wfRandomString() );
		$tplWikitext = "<gallery>\n" .
			"File:$fileName|layerset=Alpha|Template Alpha\n" .
			"File:$fileName|layerset=Beta|Template Beta\n" .
			"</gallery>";
		$this->editPage( $template, $tplWikitext );

		$output = $this->parseWikitext( '{{' . $template->getText() . '}}' );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );

		// Image 0 must be Alpha
		$this->assertStringContainsString( 'Alpha template payload', $images[0]['data-layer-data'] );
		$dec0 = json_decode( $images[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Alpha template payload', $dec0['layers'][0]['text'] );
		$this->assertSame( 416, $dec0['baseWidth'] );
		$this->assertSame( 208, $dec0['baseHeight'] );
		$this->assertSame( '', $images[0]['data-page'] );

		// Image 1 must be Beta
		$this->assertStringContainsString( 'Beta template payload', $images[1]['data-layer-data'] );
		$dec1 = json_decode( $images[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Beta template payload', $dec1['layers'][0]['text'] );
		$this->assertSame( 416, $dec1['baseWidth'] );
		$this->assertSame( 208, $dec1['baseHeight'] );
		$this->assertSame( '', $images[1]['data-page'] );

		// Both sets recorded in page metadata
		$decodedProps = ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) );
		$this->assertSame( [
			[ 'file', $fileName, 'Alpha' ],
			[ 'file', $fileName, 'Beta' ]
		], $decodedProps );
		$this->assertCompletePdfPayload( $images[0], 'Alpha template payload' );
		$this->assertCompletePdfPayload( $images[1], 'Beta template payload' );
		$this->assertNoOccurrenceTokens( $output );
	}

	/**
	 * Journey 7 (J113M2): Caption tag rendering an inner gallery of the same file
	 * cannot consume outer occurrence hints.
	 *
	 * Outer line 1 requests Alpha and contains a tag hook that invokes renderImageGallery
	 * with Beta. Outer line 2 requests Beta. Result must be:
	 * Outer 1 => Alpha, Nested => Beta, Outer 2 => Beta.
	 */
	public function testNestedCaptionGalleryCannotConsumeOuterHints(): void {
		$file = $this->uploadPdf( 'Gallery_boundary_nest_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha outer payload', 1 );
		$this->saveSet( $file, 'Beta', 1, 'Beta nested payload', 1 );
		$fileName = $file->getName();

		$tag = 'gallerynest' . strtolower( wfRandomString() );
		$this->setTemporaryHook( 'ParserFirstCallInit', static function ( Parser $parser ) use ( $fileName, $tag ) {
			$parser->setHook( $tag, static function ( $input, array $args, Parser $captionParser ) use ( $fileName ) {
				WikitextHooks::registerGalleryHint( $fileName, 'Beta' );
				return $captionParser->renderImageGallery( "File:$fileName|Nested Beta Caption", [] );
			} );
			return true;
		}, false );

		$wikitext = "<gallery>\n" .
			"File:$fileName|layerset=Alpha|<$tag/>\n" .
			"File:$fileName|layerset=Beta|Outer Beta Caption\n" .
			"</gallery>";

		$output = $this->parseWikitext( $wikitext );
		$rawHtml = $output->getRawText();
		$images = $this->extractImages( $rawHtml );
		$this->assertCount( 3, $images );

		// Image 0: Outer 1 receives Alpha
		$this->assertStringContainsString( 'Alpha outer payload', $images[0]['data-layer-data'] );
		$dec0 = json_decode( $images[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Alpha outer payload', $dec0['layers'][0]['text'] );
		$this->assertSame( 416, $dec0['baseWidth'] );
		$this->assertSame( 208, $dec0['baseHeight'] );

		// Image 1: Nested caption gallery receives Beta
		$this->assertStringContainsString( 'Beta nested payload', $images[1]['data-layer-data'] );
		$dec1 = json_decode( $images[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Beta nested payload', $dec1['layers'][0]['text'] );
		$this->assertStringContainsString( 'Nested Beta Caption', $rawHtml );

		// Image 2: Outer 2 receives Beta
		$this->assertStringContainsString( 'Beta nested payload', $images[2]['data-layer-data'] );
		$dec2 = json_decode( $images[2]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Beta nested payload', $dec2['layers'][0]['text'] );
		$this->assertStringContainsString( 'Outer Beta Caption', $rawHtml );
		$this->assertCompletePdfPayload( $images[0], 'Alpha outer payload' );
		$this->assertCompletePdfPayload( $images[1], 'Beta nested payload' );
		$this->assertCompletePdfPayload( $images[2], 'Beta nested payload' );
		$this->assertSame( [ [ 'file', $fileName, 'Alpha' ], [ 'file', $fileName, 'Beta' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
		$this->assertNoOccurrenceTokens( $output );
	}

	/**
	 * Journey 8 (J113M2): Failed or suppressed same-file transform cannot leave its
	 * selector in staging or displace subsequent lines or blocks.
	 */
	public function testFailedSameFileEntryCannotDisplaceNextLineOrSubsequentBlocks(): void {
		$file = $this->uploadPdf( 'Gallery_failed_suppress_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha first payload', 1 );
		$this->saveSet( $file, 'Beta', 1, 'Beta second payload', 1 );
		$fileName = $file->getName();

		$suppressOnce = true;
		$this->setTemporaryHook( 'BadImage', static function ( string $nameKey, bool &$bad ) use (
			&$suppressOnce, $fileName
		) {
			if ( $nameKey === $fileName && $suppressOnce ) {
				$suppressOnce = false;
				$bad = true;
				return false;
			}
			return true;
		}, false );

		// Line 1 suppressed via BadImage (requesting Alpha).
		// Line 2 succeeds (requesting Beta).
		// Block 2 requests Alpha.
		$wikitext = "<gallery>\n" .
			"File:$fileName|layerset=Alpha|Suppressed Line 1\n" .
			"File:$fileName|layerset=Beta|Successful Line 2\n" .
			"</gallery>\n" .
			"<gallery>\n" .
			"File:$fileName|layerset=Alpha|Block 2 Alpha\n" .
			"</gallery>";

		$output = $this->parseWikitext( $wikitext );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );

		// Image 0 (Block 1 Line 2) must receive Beta, NOT displaced Alpha
		$this->assertStringContainsString( 'Beta second payload', $images[0]['data-layer-data'] );
		$dec0 = json_decode( $images[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Beta second payload', $dec0['layers'][0]['text'] );

		// Image 1 (Block 2 Line 1) must receive Alpha
		$this->assertStringContainsString( 'Alpha first payload', $images[1]['data-layer-data'] );
		$dec1 = json_decode( $images[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Alpha first payload', $dec1['layers'][0]['text'] );
		$this->assertCompletePdfPayload( $images[0], 'Beta second payload' );
		$this->assertCompletePdfPayload( $images[1], 'Alpha first payload' );
		$this->assertSame( [ [ 'file', $fileName, 'Alpha' ], [ 'file', $fileName, 'Beta' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
		$this->assertNoOccurrenceTokens( $output );
	}

	/**
	 * Journey 9 (J113M2): A same-file Cargo caption render does not displace outer line hints.
	 */
	public function testNestedSameFileCargoCaptionGalleryRendersWithoutDisplacingOuterHints(): void {
		if ( !class_exists( 'CargoGalleryFormat' ) || !class_exists( CargoLayersGalleryFormat::class ) ) {
			$this->markTestSkipped( 'Cargo is not installed' );
		}

		$file = $this->uploadPdf( 'Gallery_cargo_nest_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha outer payload', 1 );
		$this->saveSet( $file, 'Beta', 1, 'Beta outer payload', 1 );
		$this->saveSet( $file, 'Gamma', 1, 'Gamma cargo payload', 1 );
		$fileName = $file->getName();

		$tag = 'cargocaption' . strtolower( wfRandomString() );
		$this->setTemporaryHook( 'ParserFirstCallInit', static function ( Parser $parser ) use ( $fileName, $tag ) {
			$parser->setHook( $tag, static function ( $input, array $args, Parser $p ) use ( $fileName ) {
				$desc = new \CargoFieldDescription();
				$desc->mType = 'File';
				$fmt = new CargoLayersGalleryFormat( \RequestContext::getMain()->getOutput(), $p );
				return $fmt->display(
					[ [ 'Image' => $fileName, 'layerset' => 'Gamma' ] ],
					[],
					[ 'Image' => $desc ],
					[]
				);
			} );
			return true;
		}, false );

		$wikitext = "<gallery>\n" .
			"File:$fileName|layerset=Alpha|Outer One <$tag/>\n" .
			"File:$fileName|layerset=Beta|Outer Two\n" .
			"</gallery>";

		$output = $this->parseWikitext( $wikitext );
		$rawHtml = $output->getRawText();
		$images = $this->extractImages( $rawHtml );
		$this->assertCount( 3, $images );

		// Outer 1: Alpha
		$dec0 = json_decode( $images[0]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Alpha outer payload', $dec0['layers'][0]['text'] );

		// Nested Cargo: Gamma
		$dec1 = json_decode( $images[1]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Gamma cargo payload', $dec1['layers'][0]['text'] );

		// Outer 2: Beta
		$dec2 = json_decode( $images[2]['data-layer-data'], true, 64, JSON_THROW_ON_ERROR );
		$this->assertSame( 'Beta outer payload', $dec2['layers'][0]['text'] );
		$this->assertCompletePdfPayload( $images[0], 'Alpha outer payload' );
		$this->assertCompletePdfPayload( $images[1], 'Gamma cargo payload' );
		$this->assertCompletePdfPayload( $images[2], 'Beta outer payload' );
		$this->assertSame( [ [ 'file', $fileName, 'Alpha' ], [ 'file', $fileName, 'Beta' ],
			[ 'file', $fileName, 'Gamma' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
		$this->assertNoOccurrenceTokens( $output );
	}

	/**
	 * Journey 10 (J113M2): Page-owned native gallery routing, binding markers,
	 * selected PDF page, real link destination, alt and caption preservation.
	 */
	public function testPageOwnedNativeGalleryBindingAndRealLinkDestination(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );

		$file = $this->uploadPdf( 'Gallery_page_owned_' );
		$fileName = $file->getName();

		$page = $this->getExistingTestPage( 'Page_owned_gallery_journey' );
		$title = $page->getTitle();
		$pageId = $title->getArticleID( IDBAccessObject::READ_LATEST );

		$document = [
			'schemaVersion' => 1,
			'surfaces' => [ [
				'id' => 'surface_page2',
				'kind' => 'pdf',
				'label' => 'Notes',
				'canvas' => [
					'width' => 208,
					'height' => 416,
					'backgroundColor' => '#ffffff',
					'backgroundVisible' => true,
					'backgroundOpacity' => 1,
				],
				'layers' => [ [
					'id' => 'note',
					'type' => 'text',
					'x' => 10,
					'y' => 20,
					'text' => 'Bound page 2 note',
				] ],
				'readingOrder' => [ 'note' ],
				'source' => [
					'repository' => 'local',
					'fileTitle' => 'File:' . $fileName,
					'timestamp' => $file->getTimestamp(),
					'sha1' => $file->getSha1(),
					'page' => 2,
				],
			] ],
		];

		$galleryWikitext = "<gallery>\n" .
			"File:$fileName|page=2|layerset=$pageId:Notes|alt=Accessible Alt Text|link=Main Page|" .
			"Page-owned Caption Text\n" .
			"</gallery>";

		$revisionId = $registered['publisher']->publish(
			$title,
			$actor,
			$page->getLatest(),
			json_encode( $document ),
			'Bind native gallery image',
			new WikitextContent( $galleryWikitext ),
			$pageId
		);

		$output = $this->getServiceContainer()->getParserFactory()->create()->parse(
			$galleryWikitext,
			$title,
			ParserOptions::newFromAnon(),
			true,
			true,
			$revisionId
		);

		$rawHtml = $output->getRawText();

		// layerset= must NOT leak into HTML
		$this->assertStringNotContainsString( 'layerset=', $rawHtml );

		// Alt and caption text preserved
		$this->assertStringContainsString( 'Page-owned Caption Text', $rawHtml );
		$this->assertStringContainsString( 'Accessible Alt Text', $rawHtml );

		$images = $this->extractImages( $rawHtml );
		$this->assertCount( 1, $images );

		// Binding marker
		$this->assertSame( "v1:$pageId:surface_page2", $images[0]['data-layers-binding'] );

		// Selected PDF page 2 rendered as thumbnail
		$this->assertStringContainsString( 'page2-', $images[0]['src'] );

		// Alt text
		$this->assertSame( 'Accessible Alt Text', $images[0]['alt'] );

		// Real link destination pointing to Main Page
		$this->assertTrue(
			str_contains( $images[0]['link-href'], 'Main_Page' ) ||
			str_contains( $images[0]['link-title'], 'Main Page' ),
			'Link destination must reference Main Page'
		);
		$this->assertSame( [ "v1:$pageId:surface_page2" => [ 'revisionId' => $revisionId, 'pageId' => $pageId ] ],
			$output->getExtensionData( BoundSlideHooks::DATA_KEY ) );
		$this->assertNoOccurrenceTokens( $output );

		MigrationState::markComplete( $this->getDb() );
		$bareText = str_replace( "layerset=$pageId:Notes", 'layerset=Notes', $galleryWikitext );
		$bareOutput = $this->getServiceContainer()->getParserFactory()->create()->parse(
			$bareText, $title, ParserOptions::newFromAnon(), true, true, $revisionId );
		$bareImages = $this->extractImages( $bareOutput->getRawText() );
		$this->assertCount( 1, $bareImages );
		$this->assertSame( "v1:$pageId:surface_page2", $bareImages[0]['data-layers-binding'] );
		$this->assertStringContainsString( 'page2-', $bareImages[0]['src'] );
		$this->assertSame( '', $bareImages[0]['data-layer-data'] );
		$this->assertSame( $output->getExtensionData( BoundSlideHooks::DATA_KEY ),
			$bareOutput->getExtensionData( BoundSlideHooks::DATA_KEY ) );
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), [ $title->getPrefixedDBkey() ] );
		$bundle = $pilot->prepareBoundViewers( $title, $revisionId, [ "v1:$pageId:surface_page2" ], $actor );
		$this->assertSame( JsonSnapshotCodec::encode( $document['surfaces'][0] ),
			JsonSnapshotCodec::encode( $bundle["v1:$pageId:surface_page2"]['surface'] ) );
		$this->assertNoOccurrenceTokens( $bareOutput );
	}

	/** @dataProvider provideNativeGalleryModes */
	public function testAllNativeGalleryModesKeepOccurrenceAndOptions( string $mode ): void {
		$file = $this->uploadPdf( 'Gallery_modes_' );
		$this->saveSet( $file, 'Alpha', 1, 'Alpha page one', 1 );
		$this->saveSet( $file, 'Beta', 1, 'Beta page two', 2 );
		$name = $file->getName();
		$output = $this->parseWikitext( "<gallery mode=\"$mode\" showfilename>\n" .
			"File:$name|layerset=Alpha|alt=First alternative|link=|First caption\n" .
			"File:$name|page=2|layerset=Beta|alt=Second alternative|link=Main Page|Second caption\n</gallery>" );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );
		$this->assertCompletePdfPayload( $images[0], 'Alpha page one' );
		$this->assertCompletePdfPayload( $images[1], 'Beta page two', 2 );
		$this->assertSame( '', $images[0]['link-href'] );
		$this->assertSame( 'First alternative', $images[0]['alt'] );
		$this->assertSame( 'Second alternative', $images[1]['alt'] );
		$this->assertStringContainsString( 'Main_Page', $images[1]['link-href'] );
		$this->assertStringContainsString( 'First caption', $output->getRawText() );
		$this->assertStringContainsString( 'Second caption', $output->getRawText() );
		$this->assertSame( [ [ 'file', $name, 'Alpha' ], [ 'file', $name, 'Beta' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
		$this->assertNoOccurrenceTokens( $output );
	}

	/** @return array[] */
	public static function provideNativeGalleryModes(): array {
		return array_map( static function ( string $mode ): array {
			return [ $mode ];
		}, [ 'traditional', 'nolines', 'packed', 'packed-hover', 'packed-overlay', 'slideshow' ] );
	}

	/** Disposed parser IDs and callbacks inherited by a clone cannot bypass or duplicate wrapping. */
	public function testDisposedAndClonedParsersKeepExactSelections(): void {
		$file = $this->uploadPdf( 'Gallery_parser_lifetime_' );
		$this->saveSet( $file, 'Alpha', 1, 'Lifetime Alpha' );
		$this->saveSet( $file, 'Beta', 1, 'Lifetime Beta' );
		$name = $file->getName();
		$title = $this->getExistingTestPage()->getTitle();
		$seenIds = [];
		$recycled = false;
		for ( $i = 0; $i < 40; $i++ ) {
			$parser = $this->getServiceContainer()->getParserFactory()->create();
			$pid = spl_object_id( $parser );
			$recycled = $recycled || isset( $seenIds[$pid] );
			$seenIds[$pid] = true;
			$output = $parser->parse( "<gallery>\nFile:$name|layerset=Alpha\n</gallery>",
				$title, ParserOptions::newFromAnon(), true, true );
			$this->assertCompletePdfPayload( $this->extractImages( $output->getRawText() )[0], 'Lifetime Alpha' );
			$this->assertNoOccurrenceTokens( $output );
			$weak = \WeakReference::create( $parser );
			unset( $parser, $output );
			gc_collect_cycles();
			$this->assertNull( $weak->get(), 'Gallery registries must not retain disposed parsers' );
		}
		$this->assertTrue( $recycled, 'The native fixture must actually exercise a recycled parser ID' );
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$cloned = clone $parser;
		foreach ( [ $parser, $cloned ] as $instance ) {
			$output = $instance->parse( "<gallery>\nFile:$name|layerset=Alpha\nFile:$name|layerset=Beta\n</gallery>",
				$title, ParserOptions::newFromAnon(), true, true );
			$images = $this->extractImages( $output->getRawText() );
			$this->assertCount( 2, $images );
			$this->assertCompletePdfPayload( $images[0], 'Lifetime Alpha' );
			$this->assertCompletePdfPayload( $images[1], 'Lifetime Beta' );
			$this->assertNoOccurrenceTokens( $output );
		}
	}

	/** A replacement callback may chain to Layers and return the native tag flags. */
	public function testGalleryCallbackChainsAndArrayFlagsRemainNative(): void {
		$file = $this->uploadPdf( 'Gallery_callback_chain_' );
		$this->saveSet( $file, 'Alpha', 1, 'Callback Alpha' );
		$this->saveSet( $file, 'Beta', 1, 'Callback Beta' );
		$name = $file->getName();
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$previous = null;
		$calls = 0;
		$previous = $parser->setHook( 'gallery', static function ( $text, $attrs, $actualParser, ...$rest ) use (
			&$previous, &$calls
		) {
			$calls++;
			return [ call_user_func( $previous, $text, $attrs, $actualParser, ...$rest ), 'markerType' => 'nowiki' ];
		} );
		$output = $parser->parse( "<gallery>\nFile:$name|layerset=Alpha\nFile:$name|layerset=Beta\n</gallery>",
			$this->getExistingTestPage()->getTitle(), ParserOptions::newFromAnon(), true, true );
		$this->assertSame( 1, $calls );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );
		$this->assertCompletePdfPayload( $images[0], 'Callback Alpha' );
		$this->assertCompletePdfPayload( $images[1], 'Callback Beta' );
		$this->assertNoOccurrenceTokens( $output );
	}

	/** A failed final thumbnail leaves no strong parser reference in fetch staging. */
	public function testSuppressedFinalGalleryEntryReleasesParserLifetime(): void {
		$file = $this->uploadPdf( 'Gallery_failed_final_' );
		$this->saveSet( $file, 'Alpha', 1, 'First surviving payload' );
		$this->saveSet( $file, 'Beta', 1, 'Final suppressed payload' );
		$name = $file->getName();
		$calls = 0;
		$this->setTemporaryHook( 'BadImage', static function ( $key, &$bad ) use ( $name, &$calls ) {
			if ( $key === $name && ++$calls === 2 ) {
				$bad = true;
				return false;
			}
			return true;
		}, false );
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$output = $parser->parse( "<gallery>\nFile:$name|layerset=Alpha\nFile:$name|layerset=Beta\n</gallery>",
			$this->getExistingTestPage()->getTitle(), ParserOptions::newFromAnon(), true, true );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 1, $images );
		$this->assertSame( 2, $calls );
		$this->assertCompletePdfPayload( $images[0], 'First surviving payload' );
		$this->assertNoOccurrenceTokens( $output );
		$weak = \WeakReference::create( $parser );
		unset( $parser, $output );
		gc_collect_cycles();
		$this->assertNull( $weak->get(), 'Failed final gallery staging must release its parser' );
	}

	/** Native title normalization, redirects, fragments and failed non-file entries retain their semantics. */
	public function testCanonicalEncodedRedirectAndNonFileTitlesDoNotLeakTokens(): void {
		$file = $this->uploadPdf( 'Gallery title_' );
		$this->saveSet( $file, 'Alpha', 1, 'Title Alpha' );
		$this->saveSet( $file, 'Beta', 1, 'Title Beta' );
		$name = $file->getName();
		$alias = 'Gallery_alias_' . wfRandomString() . '.pdf';
		$aliasTitle = Title::makeTitle( NS_FILE, $alias );
		$this->assertStatusGood( $this->editPage( $aliasTitle, "#REDIRECT [[File:$name]]" ) );
		$this->runDeferredUpdates();
		$redirectRow = $this->getDb()->newSelectQueryBuilder()->select( [ 'rd_namespace', 'rd_title' ] )
			->from( 'redirect' )->where( [ 'rd_from' => $aliasTitle->getArticleID( IDBAccessObject::READ_LATEST ) ] )
			->caller( __METHOD__ )->fetchRow();
		$this->assertNotFalse( $redirectRow, 'The isolated file page must have an actual native redirect row' );
		$this->assertSame( NS_FILE, (int)$redirectRow->rd_namespace );
		$this->assertSame( $name, $redirectRow->rd_title );
		$repos = $this->getServiceContainer()->getRepoGroup();
		$repo = $repos->getLocalRepo();
		$this->assertSame( $this->getDb()->getDomainID(), $repo->getReplicaDB()->getDomainID() );
		$replicaRedirect = $repo->getReplicaDB()->newSelectQueryBuilder()->select( [ 'rd_namespace', 'rd_title' ] )
			->from( 'redirect' )->where( [ 'rd_from' => $aliasTitle->getArticleID( IDBAccessObject::READ_LATEST ) ] )
			->caller( __METHOD__ )->fetchRow();
		$this->assertNotFalse( $replicaRedirect, 'Native repository replica must see the isolated redirect row' );
		$this->assertSame( [ (int)$redirectRow->rd_namespace, $redirectRow->rd_title ],
			[ (int)$replicaRedirect->rd_namespace, $replicaRedirect->rd_title ] );
		$repos->clearCache( $aliasTitle );
		$repo->invalidateImageRedirect( $aliasTitle );
		// Test transactions defer the public invalidation callback until commit. Clear its
		// unique fixture key now so the native repository observes the verified redirect row.
		$key = $repo->getSharedCacheKey( 'file-redirect', md5( $aliasTitle->getDBkey() ) );
		$key = $key !== false ? $key : $repo->getLocalCacheKey( 'file-redirect', md5( $aliasTitle->getDBkey() ) );
		// This isolated LocalRepo owns a different cache from the service cache.
		$wanCache = \Wikimedia\TestingAccessWrapper::newFromObject( $repo )->wanCache;
		$wanCache->delete( $key, 0 );
		$wanCache->clearProcessCache();
		$redirectTarget = $repo->checkRedirect( $aliasTitle );
		$this->assertNotFalse( $redirectTarget, 'The native redirect lookup must resolve in ' . get_class( $repo ) );
		$this->assertSame( $name, $redirectTarget->getDBkey() );
		$redirectedFile = $repos->findFile( $aliasTitle );
		$this->assertNotFalse( $redirectedFile, 'The isolated native file redirect must resolve before parsing' );
		$this->assertSame( $name, $redirectedFile->getName() );
		$encoded = rawurlencode( lcfirst( str_replace( '_', ' ', $name ) ) . '#Original fragment' );
		$localPrefix = $this->getServiceContainer()->getContentLanguage()->getNsText( NS_FILE );
		$fragments = [];
		$this->setTemporaryHook( 'BeforeParserFetchFileAndTitle', static function ( $parser, $title ) use (
			&$fragments, $name
		) {
			if ( $title->getDBkey() === $name ) {
				$fragments[] = $title->getFragment();
			}
			return true;
		}, false );
		$output = $this->parseWikitext( "<gallery showfilename>\n" .
			"$localPrefix:$encoded|layerset=Alpha|link=|Encoded caption\n" .
			"Image:$alias|layerset=Beta|Redirect caption\n" .
			"Category:Gallery_boundary_category|Category caption\n" .
			"File:[invalid|Invalid caption\n</gallery>" );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );
		$this->assertCompletePdfPayload( $images[0], 'Title Alpha' );
		$this->assertCompletePdfPayload( $images[1], 'Title Beta' );
		$this->assertSame( '', $images[0]['link-href'] );
		$this->assertContains( 'Original fragment', $fragments );
		$this->assertSame( [ [ 'file', $name, 'Alpha' ], [ 'file', $name, 'Beta' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
		$this->assertNoOccurrenceTokens( $output );
	}

	/** A configured non-English File alias must resolve through core's actual title parser. */
	public function testNonEnglishNamespaceAliasKeepsIndependentOccurrences(): void {
		$file = $this->uploadPdf( 'Gallery_german_alias_' );
		$this->saveSet( $file, 'Alpha', 1, 'Datei Alpha payload' );
		$this->saveSet( $file, 'Beta', 1, 'Datei Beta payload' );
		$name = $file->getName();
		$nativeTitle = Title::newFromText( "Datei:$name", NS_FILE );
		$this->assertSame( NS_FILE, $nativeTitle->getNamespace() );
		$this->assertSame( $name, $nativeTitle->getDBkey() );
		$output = $this->parseWikitext( "<gallery>\nDatei:$name|layerset=Alpha\n" .
			"Datei:$name|layerset=Beta\n</gallery>" );
		$images = $this->extractImages( $output->getRawText() );
		$this->assertCount( 2, $images );
		$this->assertCompletePdfPayload( $images[0], 'Datei Alpha payload' );
		$this->assertCompletePdfPayload( $images[1], 'Datei Beta payload' );
		$this->assertSame( [ [ 'file', $name, 'Alpha' ], [ 'file', $name, 'Beta' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
		$this->assertNoOccurrenceTokens( $output );
	}

	/** A nested gallery between the outer fetch and thumbnail must restore that exact occurrence. */
	public function testNestedGalleryDuringRenderFetchRestoresOuterOccurrence(): void {
		$file = $this->uploadPdf( 'Gallery_render_fetch_nesting_' );
		$this->saveSet( $file, 'Alpha', 1, 'Outer Alpha payload' );
		$this->saveSet( $file, 'Beta', 1, 'Nested Beta payload' );
		$name = $file->getName();
		$alphaFetches = 0;
		$nestedHtml = '';
		$this->setTemporaryHook( 'BeforeParserFetchFileAndTitle', static function ( $parser, $title ) use (
			$name, &$alphaFetches, &$nestedHtml
		) {
			if ( $title->getDBkey() === $name && $title->getFragment() === 'outer-alpha' &&
				++$alphaFetches === 2
			) {
				$nestedHtml = $parser->recursiveTagParseFully( "<gallery>\n" .
					"File:$name|layerset=Beta|Nested beta\n</gallery>" );
			}
			return true;
		}, false );
		$output = $this->parseWikitext( "<gallery>\nFile:$name#outer-alpha|layerset=Alpha|Outer alpha\n" .
			"File:$name#outer-beta|layerset=Beta|Following beta\n</gallery>" );
		$this->assertSame( 2, $alphaFetches );
		$outer = $this->extractImages( $output->getRawText() );
		$nested = $this->extractImages( $nestedHtml );
		$this->assertCount( 2, $outer );
		$this->assertCount( 1, $nested );
		$this->assertCompletePdfPayload( $outer[0], 'Outer Alpha payload' );
		$this->assertCompletePdfPayload( $nested[0], 'Nested Beta payload' );
		$this->assertCompletePdfPayload( $outer[1], 'Nested Beta payload' );
		$this->assertSame( [ [ 'file', $name, 'Alpha' ], [ 'file', $name, 'Beta' ] ],
			ShownLayerSets::decode( $output->getPageProperty( ShownLayerSets::PROPERTY ) ) );
		$this->assertNoOccurrenceTokens( $output );
		$this->assertStringNotContainsString( 'layers-m2-', $nestedHtml );
	}
}
