<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter
 * @group Database
 */
class DirectEmbeddingRewriterTest extends \MediaWikiIntegrationTestCase {
	public function testNativeNamespaceAndFilenameNormalizationKeepsSourceBytes(): void {
		$factory = $this->getServiceContainer()->getTitleFactory();
		$resolve = static function ( string $text ) use ( $factory ): ?string {
			$title = $factory->newFromText( $text );
			return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() &&
				!$title->isExternal() ? 'File:' . $title->getDBkey() : null;
		};
		$first = '[[Image:Thing with spaces.png|layers=one|Caption]]';
		$second = '[[File:Thing_with_spaces.png|layers=two]]';
		$text = $first . "\n" . $second . ' [[:File:Thing_with_spaces.png]]';
		$r = new DirectEmbeddingRewriter();
		$found = $r->scan( $text, $resolve );
		$this->assertCount( 2, $found );
		$this->assertSame( 'File:Thing_with_spaces.png', $found[0]['target'] );
		$this->assertSame( $found[0]['target'], $found[1]['target'] );
		$this->assertSame( '[[Image:Thing with spaces.png|layersbinding=v1:123:Drawing_A|Caption]]' .
			"\n" . $second . ' [[:File:Thing_with_spaces.png]]',
			$r->rewrite( $text, 0, $first, 'v1:123:Drawing_A', $resolve ) );
		$this->assertSame( [], $r->scan( '[[File:Thing.png#Section]]', $resolve ) );
	}
}
