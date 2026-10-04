<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions;

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
		$this->assertSame( '[[Image:Thing with spaces.png|layerset=123:Drawing A|Caption]]' .
			"\n" . $second . ' [[:File:Thing_with_spaces.png]]',
			$r->rewrite( $text, 0, $first, 123, 'Drawing A', $resolve ) );
		$this->assertSame( [], $r->scan( '[[File:Thing.png#Section]]', $resolve ) );
		$bare = '[[Image:Thing with spaces.png|layerset=Notes_Été|Caption]]' .
			"\n" . $second . ' [[:File:Thing_with_spaces.png]]';
		$this->assertSame( $bare, $r->rewrite( $text, 0, $first, 123, 'Notes_Été', $resolve, true ) );
		$candidate = $r->scan( $bare, $resolve )[0];
		$this->assertSame( [ 'pageId' => 123, 'name' => 'Notes_Été' ], PageOwnedBindingOptions::named(
			$candidate['options'], $candidate['kind'], $candidate['target'], 123 ) );
	}

	/**
	 * @dataProvider provideNativeFileNamespaces
	 * @param string $language
	 * @param string $namespace
	 */
	public function testScopedRenameUsesNativeAliasesAndCaseSensitiveCanonicalFiles(
		string $language, string $namespace
	): void {
		$this->setContentLang( $language );
		$factory = $this->getServiceContainer()->getTitleFactory();
		$resolve = static function ( string $text ) use ( $factory ): ?string {
			$title = $factory->newFromText( $text );
			return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() &&
				!$title->isExternal() ? 'File:' . $title->getDBkey() : null;
		};
		$canonical = 'File:Thing_with_spaces.png';
		$caseDistinct = 'File:Thing_with_Spaces.png';
		$this->assertSame( $canonical, $resolve( $namespace . ':thing with spaces.png' ) );
		$this->assertSame( $caseDistinct, $resolve( $caseDistinct ) );
		$first = '[[' . $namespace . ':thing with spaces.png|thumb|layers = 7:ABC|Caption]]';
		$second = '[[File:Thing_with_spaces.png|layerset=7:ABC]]';
		$third = '[[File:Thing_with_Spaces.png|layerset=7:ABC]]';
		$protected = ' [[:File:Thing_with_spaces.png|layerset=7:ABC]] ' .
			'[[File:Thing_with_spaces.png#Section|layerset=7:ABC]] {{#Slide:7:ABC}}';
		$text = $first . "\n" . $second . "\n" . $third . $protected;
		$expected = '[[' . $namespace . ':thing with spaces.png|thumb|layers =7:Plans|Caption]]' .
			"\n[[File:Thing_with_spaces.png|layerset=7:Plans]]\n";
		$renames = [ [ 'kind' => 'file', 'fileTitle' => $canonical, 'oldName' => 'ABC', 'newName' => 'Plans' ] ];
		$rewriter = new DirectEmbeddingRewriter();
		$this->assertSame( $expected . $third . $protected,
			$rewriter->renameScopedReferences( $text, 7, $renames, $resolve ) );
		$this->assertSame( $expected . $third . $protected,
			$rewriter->renameScopedReferences( $text, 7, $renames, $resolve, false, false ) );
		$bareExpected = '[[' . $namespace . ':thing with spaces.png|thumb|layers =Plans|Caption]]' .
			"\n[[File:Thing_with_spaces.png|layerset=Plans]]\n";
		$serialized = serialize( $renames );
		$result = $rewriter->renameScopedReferences( $text, 7, $renames, $resolve, false, true );
		$this->assertSame( $bareExpected . $third . $protected, $result );
		$this->assertSame( $first . "\n" . $second . "\n" . $third . $protected, $text );
		$this->assertSame( $serialized, serialize( $renames ) );
		$candidate = $rewriter->scan( $result, $resolve )[0];
		$this->assertSame( $canonical, $candidate['target'] );
		$this->assertSame( [ 'pageId' => 7, 'name' => 'Plans' ], PageOwnedBindingOptions::named(
			$candidate['options'], $candidate['kind'], $candidate['target'], 7 ) );
		$this->assertSame( '[[' . $namespace . ':thing with spaces.png|thumb|layerset=Default|Caption]]' .
			"\n" . $second . "\n" . $third . $protected,
			$rewriter->rewrite( $text, 0, $first, 7, 'Default', $resolve, true ) );
		$renames[] = [ 'kind' => 'file', 'fileTitle' => $caseDistinct, 'oldName' => 'ABC', 'newName' => 'Other' ];
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			$this->assertSame( $expected . '[[File:Thing_with_Spaces.png|layerset=7:Other]]' . $protected,
				$rewriter->renameScopedReferences( $text, 7, $instructions, $resolve ) );
			$this->assertSame( $bareExpected . '[[File:Thing_with_Spaces.png|layerset=Other]]' . $protected,
				$rewriter->renameScopedReferences( $text, 7, $instructions, $resolve, false, true ) );
		}
		foreach ( [ $namespace . ':Thing_with_spaces.png', 'File:Thing with spaces.png',
			'File:thing_with_spaces.png', 'File:Thing_with_spaces.png#Section', 'File:' ] as $noncanonical
		) {
			try {
				$rewriter->renameScopedReferences( 'No matching embed', 7, [
					[ 'kind' => 'file', 'fileTitle' => $noncanonical, 'oldName' => 'ABC', 'newName' => 'Plans' ]
				], $resolve );
				$this->fail( 'Noncanonical descriptors must refuse before rewriting' );
			} catch ( \InvalidArgumentException $exception ) {
				$this->assertSame( 'layers-embedding-source-unavailable', $exception->getMessage() );
			}
		}
	}

	/** @return array */
	public static function provideNativeFileNamespaces(): array {
		return [ 'English alias' => [ 'en', 'Image' ], 'German namespace' => [ 'de', 'Datei' ],
			'French namespace' => [ 'fr', 'Fichier' ] ];
	}
}
