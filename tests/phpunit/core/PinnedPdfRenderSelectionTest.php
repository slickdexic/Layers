<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\FileRepo\File\File;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/LegacyMigrationFixtures.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Native cached identities select PDF members from the saved source version.
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundFileHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PinnedPdfRenderPage
 * @group Database
 * @group API
 */
class PinnedPdfRenderSelectionTest extends \MediaWiki\Tests\Api\ApiTestCase {

	use LegacyMigrationFixtures;
	use IsolatedLocalRepoFixture;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setUpMigration();
	}

	private function surface( $file, int $page ): array {
		return [ 'id' => 'saved-' . $page, 'label' => 'ABC', 'kind' => 'pdf',
			'canvas' => [ 'width' => $file->getWidth( $page ), 'height' => $file->getHeight( $page ),
				'backgroundColor' => '#ffffff', 'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 3, 'y' => 5,
				'text' => 'Original page ' . $page ] ],
			'source' => [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
				'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => $page ] ];
	}

	private function publish( Title $title, int $base, array $surfaces, string $main ): int {
		return $this->doApiRequestWithToken( [ 'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(), 'baserevid' => $base, 'maintext' => $main,
			'data' => json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) ],
			null, $this->actor )[0]['layerspublish']['revid'];
	}

	private function witness( Title $title ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$title, 0, IDBAccessObject::READ_LATEST );
		return [ 'revision' => $revision->getId(), 'main' => $revision->getContent( 'main' )->serialize(),
			'layers' => $revision->getContent( 'layers' )->serialize() ];
	}

	private function images( Title $title, int $revision, string $text ): array {
		$output = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $title,
			ParserOptions::newFromAnon(), true, true, $revision );
		$html = $output->getRawText();
		$this->assertStringNotContainsString( 'Original page', $html );
		$this->assertStringNotContainsString( 'data-layer-data', $html );
		$this->assertStringNotContainsString( 'layers-m2-', json_encode( $output->toJsonArray() ) );
		$document = new \DOMDocument();
		$document->loadHTML( $html, LIBXML_NOERROR | LIBXML_NOWARNING );
		$images = [];
		foreach ( $document->getElementsByTagName( 'img' ) as $image ) {
			$images[] = [ 'binding' => $image->getAttribute( 'data-layers-binding' ),
				'revision' => $image->getAttribute( 'data-layers-revision' ),
				'src' => $image->getAttribute( 'src' ), 'alt' => $image->getAttribute( 'alt' ) ];
		}
		$capture = getenv( 'LAYERS_PINNED_RENDER_HTML' );
		if ( $capture ) {
			file_put_contents( $capture, json_encode( [ 'test' => $this->getName(), 'html' => $html,
				'images' => $images, 'owner' => $title->getArticleID(), 'revision' => $revision ] ) . "\n",
				FILE_APPEND | LOCK_EX );
		}
		return $images;
	}

	/**
	 * @dataProvider providePinnedOccurrences
	 * @param string $options
	 * @param int $expected
	 * @param string $mode
	 * @param int[] $members
	 * @param string $original
	 * @param string $language
	 */
	public function testNativeOccurrenceUsesSavedPdfPage( string $options, int $expected,
		string $mode = 'direct', array $members = [ 1, 2 ], string $original = 'test-multipage.pdf',
		string $language = 'en'
	): void {
		$file = $this->upload( 'Pinned_render_' . wfRandomString() . '.pdf', $original );
		$surfaces = array_map( fn ( int $page ): array => $this->surface( $file, $page ), $members );
		$owner = $this->getExistingTestPage();
		$id = $owner->getId();
		$line = "File:{$file->getName()}|$options|layerset=$id:abc|alt=Saved PDF|[[Main Page|Caption]]";
		$embed = $mode === 'gallery' ? "<gallery>\n$line\n$line\n</gallery>" :
			"[[$line]]\n[[$line]]";
		$base = $this->publish( $owner->getTitle(), $owner->getLatest(), $surfaces, $embed );
		$this->upload( $file->getName(), $original === 'test-multipage.pdf' ?
			'test-multipage-replacement.pdf' : 'test-multipage.pdf', '20261001000000' );
		$this->setContentLang( $language );
		$before = $this->witness( $owner->getTitle() );
		$images = $this->images( $owner->getTitle(), $base, $embed );
		$this->assertCount( 2, $images );
		$stored = in_array( $expected, $members, true );
		foreach ( $images as $image ) {
			$this->assertSame( $stored ? "v1:$id:saved-$expected" : '', $image['binding'] );
			$this->assertSame( $stored ? (string)$base : '', $image['revision'] );
			$this->assertSame( 'Saved PDF', $image['alt'] );
		}
		if ( $stored ) {
			$read = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $owner->getTitle()->getPrefixedText(),
				'revid' => $base, 'binding' => "v1:$id:saved-$expected", 'controls' => true ],
				null, false, $this->actor )[0]['layersread']['bindings']["v1:$id:saved-$expected"];
			$this->assertSame( 'Original page ' . $expected, $read['surface']['layers'][0]['text'] );
			$this->assertSame( $expected, $read['surface']['source']['page'] );
			$this->assertSame( $surfaces[0]['source']['sha1'], $read['surface']['source']['sha1'] );
			$this->assertSame( $surfaces[0]['source']['timestamp'], $read['surface']['source']['timestamp'] );
			$this->assertStringContainsString( 'page' . $expected . '-', $read['source']['url'] );
		}
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
	}

	public static function providePinnedOccurrences(): array {
		return [
			'direct equals' => [ 'page=2', 2 ],
			'direct space' => [ 'page 2', 2 ],
			'gallery equals' => [ 'page=2', 2, 'gallery' ],
			'gallery space' => [ 'page 2', 2, 'gallery' ],
			'direct last valid' => [ 'page=2|page=1', 1 ],
			'gallery last valid' => [ 'page=2|page=1', 1, 'gallery' ],
			'invalid later option' => [ 'page=2|page=0', 2 ],
			'pinned upper bound' => [ 'page=3', 2 ],
			'gallery upper bound' => [ 'page=3', 2, 'gallery' ],
			'sparse page 2' => [ 'page=2', 2, 'direct', [ 2 ] ],
			'absent member refuses' => [ 'page=2', 2, 'direct', [ 1 ] ],
			'gallery absent member refuses' => [ 'page=2', 2, 'gallery', [ 1 ] ],
			'longer replacement' => [ 'page=2', 1, 'direct', [ 1 ], 'test-multipage-replacement.pdf' ],
			'gallery longer replacement' => [ 'page=2', 1, 'gallery', [ 1 ], 'test-multipage-replacement.pdf' ],
			'caption page text' => [ 'page=2|[[Main Page|page=1]]', 2 ],
			'localized direct' => [ 'seite=2', 2, 'direct', [ 1, 2 ], 'test-multipage.pdf', 'de' ],
			'localized gallery' => [ 'seite 2', 2, 'gallery', [ 1, 2 ], 'test-multipage.pdf', 'de' ],
		];
	}

	public function testSuppressedSourceNeverBindsCurrentPage(): void {
		$file = $this->upload( 'Suppressed_render_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$surface = $this->surface( $file, 1 );
		$owner = $this->getExistingTestPage();
		$id = $owner->getId();
		$main = "[[File:{$file->getName()}|page=2|layerset=$id:ABC]]";
		$base = $this->publish( $owner->getTitle(), $owner->getLatest(), [ $surface ], $main );
		$this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20261001000000' );
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
			->set( [ 'oi_deleted' => File::DELETED_FILE ] )
			->where( [ 'oi_name' => $file->getName(), 'oi_timestamp' => $surface['source']['timestamp'] ] )
			->caller( __METHOD__ )->execute();
		$file->purgeCache();
		$before = $this->witness( $owner->getTitle() );
		$images = $this->images( $owner->getTitle(), $base, $main );
		$this->assertCount( 1, $images );
		$this->assertSame( '', $images[0]['binding'] );
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
	}

	/** @dataProvider provideTemplateModes @param bool $gallery */
	public function testExpandedTemplateKeepsBothPageOccurrences( bool $gallery ): void {
		$file = $this->upload( 'Template_render_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$owner = $this->getExistingTestPage();
		$id = $owner->getId();
		$lines = [];
		foreach ( [ 2, 1 ] as $page ) {
			$line = "File:{$file->getName()}|page=$page|layerset=$id:ABC|Page $page";
			$lines[] = $gallery ? $line : "[[$line]]";
		}
		$text = implode( "\n", $lines );
		$template = Title::newFromText( 'Template:PinnedRender' . wfRandomString() );
		$this->editPage( $template, $gallery ? "<gallery>\n$text\n</gallery>" : $text );
		$main = '{{' . $template->getText() . '}}';
		$surfaces = [ $this->surface( $file, 1 ), $this->surface( $file, 2 ) ];
		$base = $this->publish( $owner->getTitle(), $owner->getLatest(), $surfaces, $main );
		$this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20261001000000' );
		$before = $this->witness( $owner->getTitle() );
		$images = $this->images( $owner->getTitle(), $base, $main );
		$this->assertSame( [ "v1:$id:saved-2", "v1:$id:saved-1" ], array_column( $images, 'binding' ) );
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
	}

	public static function provideTemplateModes(): array {
		return [ 'direct' => [ false ], 'gallery' => [ true ] ];
	}

	public function testNestedCaptionGalleryKeepsItsOwnPageOption(): void {
		$file = $this->upload( 'Nested_render_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$owner = $this->getExistingTestPage();
		$id = $owner->getId();
		$name = $file->getName();
		$tag = 'pinnednest' . strtolower( wfRandomString() );
		$this->setTemporaryHook( 'ParserFirstCallInit', static function ( Parser $parser ) use ( $name, $id, $tag ) {
			$parser->setHook( $tag, static fn ( $input, array $args, Parser $captionParser ) =>
				$captionParser->recursiveTagParseFully(
					"<gallery>\nFile:$name|page=1|layerset=$id:ABC|Inner page\n</gallery>" ) );
			return true;
		}, false );
		$main = "<gallery>\nFile:$name|page=2|layerset=$id:ABC|<$tag/>\n" .
			"File:$name|page=2|layerset=$id:ABC|Outer page\n</gallery>";
		$base = $this->publish( $owner->getTitle(), $owner->getLatest(),
			[ $this->surface( $file, 1 ), $this->surface( $file, 2 ) ], $main );
		$this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20261001000000' );
		$before = $this->witness( $owner->getTitle() );
		$images = $this->images( $owner->getTitle(), $base, $main );
		$this->assertSame( [ "v1:$id:saved-2", "v1:$id:saved-1", "v1:$id:saved-2" ],
			array_column( $images, 'binding' ) );
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
	}

	public function testHistoricalRevisionAndOtherOwnerRemainSeparate(): void {
		$file = $this->upload( 'History_render_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$owner = $this->getExistingTestPage();
		$foreign = $this->getExistingTestPage();
		$id = $owner->getId();
		$main = "[[File:{$file->getName()}|page=2|layerset=$id:ABC]]";
		$surfaces = [ $this->surface( $file, 1 ), $this->surface( $file, 2 ) ];
		$base = $this->publish( $owner->getTitle(), $owner->getLatest(), $surfaces, $main );
		$this->publish( $foreign->getTitle(), $foreign->getLatest(), $surfaces, 'Independent owner' );
		$newer = $this->publish( $owner->getTitle(), $base, $surfaces, 'New main content' );
		$this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20261001000000' );
		$before = $this->witness( $owner->getTitle() );
		$images = $this->images( $owner->getTitle(), $base, $main );
		$this->assertSame( "v1:$id:saved-2", $images[0]['binding'] );
		$this->assertSame( (string)$base, $images[0]['revision'] );
		$foreignMain = str_replace( "layerset=$id:", "layerset={$foreign->getId()}:", $main );
		$images = $this->images( $owner->getTitle(), $newer, $foreignMain );
		$this->assertSame( '', $images[0]['binding'] );
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
	}
}
