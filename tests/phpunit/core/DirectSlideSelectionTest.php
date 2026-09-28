<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\DirectEmbeddingSelection;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;

/**
 * Native slide-parser correspondence tests for PageID direct embedding adoption.
 *
 * Verifies that native Parser output from SlideHooks matches the conservative
 * boundaries enforced by DirectEmbeddingRewriter and DirectEmbeddingSelection.
 *
 * @covers \MediaWiki\Extension\Layers\Revision\DirectEmbeddingSelection
 * @covers \MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter
 * @covers \MediaWiki\Extension\Layers\Hooks\SlideHooks
 * @group Database
 */
class DirectSlideSelectionTest extends \MediaWikiIntegrationTestCase {

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'LayersSlidesEnable', true );
	}

	/**
	 * Case 1: Parse literal {{#Slide:WelcomePresentation|layerset=Drawing_A}}.
	 * Inspect emitted element's actual class (layers-slide-container) and data attributes.
	 * Compare identity to the scanner candidate and selection helper. Verify case preservation.
	 */
	public function testLiteralSlideParserOutputAndCandidateCorrespondence(): void {
		$wikitext = '{{#Slide:WelcomePresentation|layerset=Drawing_A}}';
		$output = $this->parseWikitext( $wikitext );
		$html = $output->getRawText();

		// Confirm actual container and canvas classes from source
		$containers = $this->extractSlideContainers( $html );
		$this->assertCount( 1, $containers, 'Exactly one slide container must be emitted' );
		$this->assertStringContainsString( 'layers-slide-container', $containers[0]['class'] );
		$this->assertStringContainsString( '<canvas class="layers-slide-canvas"></canvas>', $html );

		// Verify case-preserved attributes from native output
		$this->assertSame( 'WelcomePresentation', $containers[0]['slideName'] );
		$this->assertSame( 'Drawing_A', $containers[0]['layerset'] );
		$this->assertSame( 'true', $containers[0]['editable'] );

		// Scanner candidate correspondence
		$rewriter = new DirectEmbeddingRewriter();
		$candidates = $rewriter->scan( $wikitext, $this->getFileResolver() );
		$this->assertCount( 1, $candidates );

		$candidate = $candidates[0];
		$this->assertSame( 'slide', $candidate['kind'] );
		$this->assertSame( 'WelcomePresentation', $candidate['target'] );
		$this->assertSame( [ 'layerset=Drawing_A' ], $candidate['options'] );
		$this->assertSame( 0, $candidate['start'] );
		$this->assertSame( strlen( $wikitext ), $candidate['length'] );
		$this->assertSame( $wikitext, $candidate['raw'] );

		// Identity matches native output exactly
		$this->assertSame( $candidate['target'], $containers[0]['slideName'] );
		$this->assertSame( 'Drawing_A', $containers[0]['layerset'] );

		// Selection helper accepts server-shaped metadata matching the native embed
		$legacySelection = [
			'imgName' => 'Slide:WelcomePresentation',
			'name' => 'Drawing_A',
			'page' => 1,
		];
		DirectEmbeddingSelection::assertMatches( $candidate, $legacySelection );

		// Selection helper rejects mismatched legacy identities
		$this->expectSelectionUnavailable( static function () use ( $candidate, $legacySelection ) {
			$mismatched = $legacySelection;
			// Case mismatch rejected
			$mismatched['name'] = 'drawing_a';
			DirectEmbeddingSelection::assertMatches( $candidate, $mismatched );
		} );
		$this->expectSelectionUnavailable( static function () use ( $candidate, $legacySelection ) {
			$mismatched = $legacySelection;
			// Slide target case mismatch rejected
			$mismatched['imgName'] = 'Slide:welcomepresentation';
			DirectEmbeddingSelection::assertMatches( $candidate, $mismatched );
		} );
		$this->expectSelectionUnavailable( static function () use ( $candidate, $legacySelection ) {
			$mismatched = $legacySelection;
			// Slide page must be 1
			$mismatched['page'] = 2;
			DirectEmbeddingSelection::assertMatches( $candidate, $mismatched );
		} );
	}

	/**
	 * Case 2: Two identical direct slides separated by Unicode text.
	 * Verify two native slide outputs and distinct scanner byte offsets,
	 * then rewrite only the second complete source span.
	 */
	public function testTwoIdenticalSlidesSeparatedByUnicodeTextRewriteSecondOnly(): void {
		$slide = '{{#Slide:WelcomePresentation|layerset=Drawing_A}}';
		$unicodeSeparator = "\n日本語の説明テキスト — 概要とメモ 🎨\n";
		$wikitext = $slide . $unicodeSeparator . $slide;

		// Verify native parser emits two distinct slide containers
		$output = $this->parseWikitext( $wikitext );
		$containers = $this->extractSlideContainers( $output->getRawText() );
		$this->assertCount( 2, $containers );
		$this->assertSame( 'WelcomePresentation', $containers[0]['slideName'] );
		$this->assertSame( 'Drawing_A', $containers[0]['layerset'] );
		$this->assertSame( 'WelcomePresentation', $containers[1]['slideName'] );
		$this->assertSame( 'Drawing_A', $containers[1]['layerset'] );

		// Verify scanner finds both occurrences with distinct byte offsets
		$rewriter = new DirectEmbeddingRewriter();
		$candidates = $rewriter->scan( $wikitext, $this->getFileResolver() );
		$this->assertCount( 2, $candidates );

		$this->assertSame( 0, $candidates[0]['start'] );
		$this->assertSame( strlen( $slide ), $candidates[0]['length'] );
		$this->assertSame( $slide, $candidates[0]['raw'] );

		$expectedSecondStart = strlen( $slide . $unicodeSeparator );
		$this->assertSame( $expectedSecondStart, $candidates[1]['start'] );
		$this->assertSame( strlen( $slide ), $candidates[1]['length'] );
		$this->assertSame( $slide, $candidates[1]['raw'] );
		$this->assertNotSame( $candidates[0]['start'], $candidates[1]['start'] );

		// Rewrite ONLY the second complete source span
		$rewritten = $rewriter->rewrite(
			$wikitext,
			$candidates[1]['start'],
			$candidates[1]['raw'],
			456,
			'Surface B',
			$this->getFileResolver()
		);

		// First slide remains untouched with its original layerset
		$expectedFirstSlide = $slide;
		$this->assertSame(
			$expectedFirstSlide,
			substr( $rewritten, 0, strlen( $expectedFirstSlide ) )
		);

		// Unicode text between occurrences remains identical
		$this->assertSame(
			$slide . $unicodeSeparator,
			substr( $rewritten, 0, $expectedSecondStart )
		);

		// The second slide now names the page's drawing, and its set selector is gone
		$expectedSecondSlide = '{{#Slide:456:Surface B}}';
		$this->assertSame(
			$expectedSecondSlide,
			substr( $rewritten, $expectedSecondStart )
		);
		$this->assertSame(
			$slide . $unicodeSeparator . $expectedSecondSlide,
			$rewritten
		);
	}

	/**
	 * Case 3: Native name=Other overrides the first positional slide name.
	 * Prove native output names Other while DirectEmbeddingSelection rejects the candidate.
	 * Include mixed-case NAME=Other and empty/bare name options.
	 */
	public function testNameOptionOverridesPositionalNameAndDirectEmbeddingSelectionRejects(): void {
		$rewriter = new DirectEmbeddingRewriter();

		// 3a: name=Other
		$wikitext1 = '{{#Slide:PositionalName|name=Other|layerset=Drawing_A}}';
		$output1 = $this->parseWikitext( $wikitext1 );
		$containers1 = $this->extractSlideContainers( $output1->getRawText() );
		$this->assertCount( 1, $containers1 );
		$this->assertSame(
			'Other',
			$containers1[0]['slideName'],
			'Native parser must override positional name with name=Other'
		);

		$candidates1 = $rewriter->scan( $wikitext1, $this->getFileResolver() );
		$this->assertCount( 1, $candidates1 );
		$this->assertSame( 'PositionalName', $candidates1[0]['target'], 'Scanner extracts positional target' );
		$this->assertContains( 'name=Other', $candidates1[0]['options'] );

		// Selection helper must reject candidate because name option is forbidden for slides
		$this->expectSelectionUnavailable( static function () use ( $candidates1 ) {
			DirectEmbeddingSelection::assertMatches( $candidates1[0], [
				'imgName' => 'Slide:PositionalName',
				'name' => 'Drawing_A',
				'page' => 1,
			] );
		} );
		$this->expectSelectionUnavailable( static function () use ( $candidates1 ) {
			DirectEmbeddingSelection::assertMatches( $candidates1[0], [
				'imgName' => 'Slide:Other',
				'name' => 'Drawing_A',
				'page' => 1,
			] );
		} );

		// 3b: mixed-case NAME=OtherMixed
		$wikitext2 = '{{#Slide:PositionalName|NAME=OtherMixed|layerset=Drawing_A}}';
		$output2 = $this->parseWikitext( $wikitext2 );
		$containers2 = $this->extractSlideContainers( $output2->getRawText() );
		$this->assertCount( 1, $containers2 );
		$this->assertSame(
			'OtherMixed',
			$containers2[0]['slideName'],
			'Native parser must override with mixed-case NAME=OtherMixed'
		);

		$candidates2 = $rewriter->scan( $wikitext2, $this->getFileResolver() );
		$this->assertCount( 1, $candidates2 );
		$this->expectSelectionUnavailable( static function () use ( $candidates2 ) {
			DirectEmbeddingSelection::assertMatches( $candidates2[0], [
				'imgName' => 'Slide:PositionalName',
				'name' => 'Drawing_A',
				'page' => 1,
			] );
		} );

		// 3c: bare name flag and empty name=
		foreach ( [ 'name', 'name=' ] as $nameOption ) {
			$wikitext = "{{#Slide:PositionalName|$nameOption|layerset=Drawing_A}}";
			$candidates = $rewriter->scan( $wikitext, $this->getFileResolver() );
			$this->assertCount( 1, $candidates );
			$this->expectSelectionUnavailable( static function () use ( $candidates ) {
				DirectEmbeddingSelection::assertMatches( $candidates[0], [
					'imgName' => 'Slide:PositionalName',
					'name' => 'Drawing_A',
					'page' => 1,
				] );
			} );
		}
	}

	/**
	 * Case 4: Native layerset duplicate options use the last value.
	 * Prove native output uses the last value and prove adoption rejects duplication
	 * rather than adopting an earlier value. Cover identical duplicate values too.
	 */
	public function testDuplicateLayersetUsesLastValueAndAdoptionRejectsDuplication(): void {
		$rewriter = new DirectEmbeddingRewriter();

		// 4a: Different duplicate values
		$wikitextDiff = '{{#Slide:WelcomePresentation|layerset=Drawing_First|layerset=Drawing_Last}}';
		$outputDiff = $this->parseWikitext( $wikitextDiff );
		$containersDiff = $this->extractSlideContainers( $outputDiff->getRawText() );
		$this->assertCount( 1, $containersDiff );
		$this->assertSame(
			'Drawing_Last',
			$containersDiff[0]['layerset'],
			'Native SlideHooks must use the last layerset option value'
		);

		$candidatesDiff = $rewriter->scan( $wikitextDiff, $this->getFileResolver() );
		$this->assertCount( 1, $candidatesDiff );
		$this->assertSame(
			[ 'layerset=Drawing_First', 'layerset=Drawing_Last' ],
			$candidatesDiff[0]['options']
		);

		// Adoption must reject matching against either the first or last value
		$this->expectSelectionUnavailable( static function () use ( $candidatesDiff ) {
			DirectEmbeddingSelection::assertMatches( $candidatesDiff[0], [
				'imgName' => 'Slide:WelcomePresentation',
				'name' => 'Drawing_First',
				'page' => 1,
			] );
		} );
		$this->expectSelectionUnavailable( static function () use ( $candidatesDiff ) {
			DirectEmbeddingSelection::assertMatches( $candidatesDiff[0], [
				'imgName' => 'Slide:WelcomePresentation',
				'name' => 'Drawing_Last',
				'page' => 1,
			] );
		} );

		// 4b: Identical duplicate values
		$wikitextSame = '{{#Slide:WelcomePresentation|layerset=Drawing_Same|layerset=Drawing_Same}}';
		$outputSame = $this->parseWikitext( $wikitextSame );
		$containersSame = $this->extractSlideContainers( $outputSame->getRawText() );
		$this->assertCount( 1, $containersSame );
		$this->assertSame( 'Drawing_Same', $containersSame[0]['layerset'] );

		$candidatesSame = $rewriter->scan( $wikitextSame, $this->getFileResolver() );
		$this->assertCount( 1, $candidatesSame );
		$this->assertSame(
			[ 'layerset=Drawing_Same', 'layerset=Drawing_Same' ],
			$candidatesSame[0]['options']
		);

		// Adoption rejects identical duplicate options
		$this->expectSelectionUnavailable( static function () use ( $candidatesSame ) {
			DirectEmbeddingSelection::assertMatches( $candidatesSame[0], [
				'imgName' => 'Slide:WelcomePresentation',
				'name' => 'Drawing_Same',
				'page' => 1,
			] );
		} );
	}

	/**
	 * Case 5: Verify at least one template-generated slide renders natively
	 * but is excluded from direct source candidates; likewise comments/nowiki
	 * must not become selectable direct embeds.
	 */
	public function testTemplateGeneratedSlideRendersNativelyButExcludedFromDirectCandidates(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$resolveFile = $this->getFileResolver();

		// 5a: Template-generated slide
		$templateName = 'DirectSlideTemplate_' . wfRandomString( 8 );
		$this->insertPage(
			$templateName,
			'{{#Slide:TemplatedSlide|layerset=TemplateSet}}',
			NS_TEMPLATE
		);

		$transclusionWikitext = '{{' . $templateName . '}}';

		// Native parser expands template and renders the slide container
		$output = $this->parseWikitext( $transclusionWikitext );
		$containers = $this->extractSlideContainers( $output->getRawText() );
		$this->assertCount( 1, $containers, 'Template-generated slide must render natively' );
		$this->assertSame( 'TemplatedSlide', $containers[0]['slideName'] );
		$this->assertSame( 'TemplateSet', $containers[0]['layerset'] );

		// Direct source scanner excludes template transclusion from direct candidates
		$candidates = $rewriter->scan( $transclusionWikitext, $resolveFile );
		$this->assertSame( [], $candidates, 'Template invocation must be excluded from direct candidates' );

		// 5b: Comments containing a slide embed
		$commentWikitext = "<!-- {{#Slide:CommentedSlide|layerset=CommentSet}} -->\nVisible Text";
		$commentOutput = $this->parseWikitext( $commentWikitext );
		$commentContainers = $this->extractSlideContainers( $commentOutput->getRawText() );
		$this->assertSame( [], $commentContainers, 'Commented slide must not render natively' );
		$this->assertStringNotContainsString( 'CommentedSlide', $commentOutput->getRawText() );

		$commentCandidates = $rewriter->scan( $commentWikitext, $resolveFile );
		$this->assertSame( [], $commentCandidates, 'Commented slide must be excluded from direct candidates' );

		// 5c: Nowiki-wrapped slide embed
		$nowikiWikitext = "<nowiki>{{#Slide:NowikiSlide|layerset=NowikiSet}}</nowiki>";
		$nowikiOutput = $this->parseWikitext( $nowikiWikitext );
		$nowikiContainers = $this->extractSlideContainers( $nowikiOutput->getRawText() );
		$this->assertSame( [], $nowikiContainers, 'Nowiki slide must not render as a slide container' );

		$nowikiCandidates = $rewriter->scan( $nowikiWikitext, $resolveFile );
		$this->assertSame( [], $nowikiCandidates, 'Nowiki slide must be excluded from direct candidates' );

		// 5d: Mixed page: literal slide, template slide, commented slide, and nowiki slide
		$mixedWikitext = "{{#Slide:LiteralSlide|layerset=LiteralSet}}\n" .
			'{{' . $templateName . "}}\n" .
			"<!-- {{#Slide:CommentedSlide|layerset=CommentSet}} -->\n" .
			"<nowiki>{{#Slide:NowikiSlide|layerset=NowikiSet}}</nowiki>";

		$mixedOutput = $this->parseWikitext( $mixedWikitext );
		$mixedContainers = $this->extractSlideContainers( $mixedOutput->getRawText() );
		$this->assertCount( 2, $mixedContainers, 'Only literal and template slides render natively' );
		$this->assertSame( 'LiteralSlide', $mixedContainers[0]['slideName'] );
		$this->assertSame( 'TemplatedSlide', $mixedContainers[1]['slideName'] );

		$mixedCandidates = $rewriter->scan( $mixedWikitext, $resolveFile );
		$this->assertCount( 1, $mixedCandidates, 'Only the literal slide is discovered as a direct candidate' );
		$this->assertSame( 'LiteralSlide', $mixedCandidates[0]['target'] );
		$this->assertSame( [ 'layerset=LiteralSet' ], $mixedCandidates[0]['options'] );

		// Selection helper validates the single literal candidate
		DirectEmbeddingSelection::assertMatches( $mixedCandidates[0], [
			'imgName' => 'Slide:LiteralSlide',
			'name' => 'LiteralSet',
			'page' => 1,
		] );
	}

	/**
	 * Execute wikitext through the native MediaWiki Parser.
	 */
	private function parseWikitext( string $wikitext, ?Title $title = null ): ParserOutput {
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$title = $title ?? Title::makeTitle( NS_MAIN, 'SlideTestPage' );
		$options = ParserOptions::newFromAnon();
		return $parser->parse( $wikitext, $title, $options );
	}

	public function testReservedBindingCannotFallBackToSharedLegacySlide(): void {
		foreach ( [ 'layersbinding=v1:123:Drawing_A', 'LAYERSBINDING=v1:123:Drawing_A',
			'layersbinding', 'layersbinding=', 'layersbinding=private-diagnostic-sentinel',
			'layersbinding=v1:123:Drawing_A|layerset=Drawing_A',
			'layersbinding=v1:123:Drawing_A|layersbinding=v1:123:Drawing_B'
		] as $options ) {
			$html = $this->parseWikitext( '{{#Slide:WelcomePresentation|' . $options . '}}' )->getRawText();
			$this->assertSame( [], $this->extractSlideContainers( $html ) );
			$this->assertStringContainsString( 'layers-slide-error', $html );
			$this->assertStringNotContainsString( 'layers-slide-canvas', $html );
			$this->assertStringNotContainsString( 'private-diagnostic-sentinel', $html );
		}
	}

	/**
	 * Extract slide container data from rendered HTML.
	 *
	 * @param string $html Rendered HTML
	 * @return array<int, array{class: string, slideName: string, layerset: string, editable: string}>
	 */
	private function extractSlideContainers( string $html ): array {
		$containers = [];
		$document = new \DOMDocument();
		$previous = libxml_use_internal_errors( true );
		try {
			$document->loadHTML( '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>' .
				$html . '</body></html>' );
		} finally {
			libxml_clear_errors();
			libxml_use_internal_errors( $previous );
		}
		$xpath = new \DOMXPath( $document );
		$nodes = $xpath->query( '//div[contains(concat(" ", normalize-space(@class), " "),' .
			' " layers-slide-container ")]' );
		foreach ( $nodes as $node ) {
			$containers[] = [
				'class' => $node->getAttribute( 'class' ),
				'slideName' => $node->getAttribute( 'data-slide-name' ),
				'layerset' => $node->getAttribute( 'data-layerset' ),
				'editable' => $node->getAttribute( 'data-editable' )
			];
		}
		return $containers;
	}

	/**
	 * Helper for file resolution callback required by DirectEmbeddingRewriter.
	 */
	private function getFileResolver(): \Closure {
		$factory = $this->getServiceContainer()->getTitleFactory();
		return static function ( string $text ) use ( $factory ): ?string {
			$title = $factory->newFromText( $text );
			return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() &&
				!$title->isExternal() ? 'File:' . $title->getDBkey() : null;
		};
	}

	/**
	 * Assert that a callback throws layers-embedding-selection-unavailable.
	 */
	private function expectSelectionUnavailable( callable $callback ): void {
		try {
			$callback();
			$this->fail( 'Expected InvalidArgumentException was not thrown' );
		} catch ( \InvalidArgumentException $e ) {
			$this->assertSame( 'layers-embedding-selection-unavailable', $e->getMessage() );
		}
	}
}
