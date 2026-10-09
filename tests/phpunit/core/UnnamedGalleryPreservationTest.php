<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use DOMDocument;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\WikitextHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundFileHooks
 * @group Database
 * @group API
 */
class UnnamedGalleryPreservationTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use LegacyMigrationFixtures;
	use IsolatedLocalRepoFixture;

	protected function setUp(): void {
		parent::setUp();
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		$this->setUpIsolatedLocalRepoFixture();
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		WikitextHooks::resetPageLayersFlag();
		parent::tearDown();
	}

	/** @param array $sets @param bool $pdf @return LocalFile */
	private function seedFile( array $sets, bool $pdf = false ): LocalFile {
		$file = $this->upload( 'J115C_' . wfRandomString( 10 ) . ( $pdf ? '.pdf' : '.png' ),
			$pdf ? 'test-multipage.pdf' : 'test-image.png' );
		foreach ( $sets as $name => $pages ) {
			foreach ( $pages as $page ) {
				$this->saveSet( $file, $name, 1, "J115C-Payload-$name-page-$page", $page );
			}
		}
		if ( $sets ) {
			$migration = $this->pilot->newFilePageMigration();
			$migration->commit( $migration->plan( $file->getName(), $this->actor ), $this->actor );
		}
		return $file;
	}

	/** @param string $text @param array $references @return array */
	private function owner( string $text, array $references ): array {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->editPage( $title, $text, '', NS_MAIN, $this->actor );
		if ( $references ) {
			$this->getDb()->newDeleteQueryBuilder()->deleteFrom( 'page_props' )
				->where( [ 'pp_page' => $title->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY ] )
				->caller( __METHOD__ )->execute();
			$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
				'pp_page' => $title->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY,
				'pp_value' => json_encode( $references )
			] )->caller( __METHOD__ )->execute();
			$migration = $this->pilot->newPageCopyMigration();
			$migration->commit( $migration->plan( $title->getArticleID(), $this->actor ), $this->actor );
		}
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $title );
		return [ 'title' => $title, 'revision' => $revision->getId(), 'text' => $text,
			'surfaces' => $revision->hasSlot( 'layers' ) ? $this->surfaces( $revision ) : [] ];
	}

	/** @return string */
	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	/** @param string $before */
	private function unchanged( string $before ): void {
		$after = $this->witness();
		$this->assertSame( $before, $after );
		$output = getenv( 'LAYERS_CREATION_WITNESSES' );
		if ( $output ) {
			file_put_contents( $output, json_encode( [ 'case' => $this->getName(),
				'before' => base64_encode( $before ), 'after' => base64_encode( $after ) ] ) . "\n",
				FILE_APPEND | LOCK_EX );
		}
	}

	/** @param array $owner @param string|null $text @param bool $migrated @return ParserOutput */
	private function parseOwner( array $owner, ?string $text = null, bool $migrated = true ): ParserOutput {
		$before = $this->witness();
		$context = RequestContext::getMain();
		$previousTitle = $context->getTitle();
		$context->setTitle( $owner['title'] );
		try {
			$options = ParserOptions::newFromAnon();
			$options->setOption( MigrationState::PARSER_OPTION, $migrated );
			$output = $this->getServiceContainer()->getParserFactory()->create()->parse(
				$text ?? $owner['text'], $owner['title'], $options, true, true, $owner['revision'] );
			if ( $migrated ) {
				$cache = json_encode( $output->toJsonArray() );
				foreach ( [ 'J115C-Payload-', 'data-layer-data', 'layers-m2-', 'UNIQ-' ] as $private ) {
					$this->assertStringNotContainsString( $private, $output->getRawText() );
					$this->assertStringNotContainsString( $private, $cache );
				}
			}
			return $output;
		} finally {
			$context->setTitle( $previousTitle );
			$this->unchanged( $before );
		}
	}

	/** @param ParserOutput $output @return array */
	private function images( ParserOutput $output ): array {
		$document = new DOMDocument();
		$document->loadHTML( $output->getRawText(), LIBXML_NOERROR | LIBXML_NOWARNING );
		$images = [];
		foreach ( $document->getElementsByTagName( 'img' ) as $image ) {
			$images[] = [ 'binding' => $image->getAttribute( 'data-layers-binding' ),
				'src' => $image->getAttribute( 'src' ), 'alt' => $image->getAttribute( 'alt' ),
				'width' => $image->getAttribute( 'width' ), 'height' => $image->getAttribute( 'height' ),
				'link' => $image->parentNode->nodeName === 'a' ?
					$image->parentNode->getAttribute( 'href' ) : '' ];
		}
		return $images;
	}

	/** @param array $owner @param LocalFile $file @param string $name @param int $page @return string */
	private function binding( array $owner, LocalFile $file, string $name, int $page = 1 ): string {
		foreach ( $owner['surfaces'] as $surface ) {
			if ( $surface['source']['fileTitle'] === 'File:' . $file->getName() &&
				strcasecmp( $surface['label'], $name ) === 0 && $surface['source']['page'] === $page
			) {
				return 'v1:' . $owner['title']->getArticleID() . ':' . $surface['id'];
			}
		}
		return '';
	}

	/** @return array */
	public static function provideSelectorCases(): array {
		return [ 'sole non-Default' => [ [ 'Labels' ] ], 'sole normalized Default' => [ [ 'dEfAuLt' ] ],
			'ambiguous with Default' => [ [ 'Labels', 'Default' ] ], 'zero names' => [ [] ] ];
	}

	/**
	 * @dataProvider provideSelectorCases
	 * @param array $names
	 */
	public function testOmittedAndExplicitSelectorsKeepDifferentMeanings( array $names ): void {
		$file = $this->seedFile( array_fill_keys( $names, [ 1 ] ) );
		$key = $file->getName();
		$named = $names[0] ?? 'Missing';
		$text = "<gallery widths=90 heights=70>\nFile:$key|alt=Implicit alt|link=Main Page|Implicit caption\n" .
			"File:$key|layerset=on|Explicit Default\nFile:$key|layerset=$named|Named caption\n" .
			"File:$key|layerset=off|Hidden caption\n</gallery>";
		$owner = $this->owner( $text, array_map( static fn ( $name ) => [ 'file', $key, $name ], $names ) );
		MigrationState::markComplete( $this->getDb() );
		$output = $this->parseOwner( $owner );
		$images = $this->images( $output );
		$this->assertCount( 4, $images );
		$this->assertSame( [ count( $names ) === 1 ? $this->binding( $owner, $file, $names[0] ) : '',
			$this->binding( $owner, $file, 'Default' ), $this->binding( $owner, $file, $named ), '' ],
			array_column( $images, 'binding' ) );
		$this->assertSame( 'Implicit alt', $images[0]['alt'] );
		$this->assertStringContainsString( 'Main_Page', $images[0]['link'] );
		$this->assertStringContainsString( 'Implicit caption', $output->getRawText() );
		$this->assertStringContainsString( 'Named caption', $output->getRawText() );
		$this->assertStringNotContainsString( 'layerset=', $output->getRawText() );
	}

	public function testRegisteredHintsAndBeforeCompletionPathsRemainNamed(): void {
		$file = $this->seedFile( [ 'Alpha' => [ 1 ], 'Beta' => [ 1 ] ] );
		$key = $file->getName();
		$text = "{{#layers_hint:$key|Alpha}}<gallery>\nFile:$key|layerset=Beta|Explicit Beta\n" .
			"File:$key|Implicit hint\nFile:$key|layerset=on|Missing Default\n" .
			"File:$key|layerset=off|Hidden\n</gallery>";
		$owner = $this->owner( $text, [ [ 'file', $key, 'Alpha' ], [ 'file', $key, 'Beta' ] ] );
		$legacy = $this->parseOwner( $owner, null, false );
		$this->assertStringContainsString( 'J115C-Payload-Beta-page-1', $legacy->getRawText() );
		$this->assertStringContainsString( 'J115C-Payload-Alpha-page-1', $legacy->getRawText() );
		MigrationState::markComplete( $this->getDb() );
		$this->assertSame( [ $this->binding( $owner, $file, 'Beta' ),
			$this->binding( $owner, $file, 'Alpha' ), '', '' ],
			array_column( $this->images( $this->parseOwner( $owner ) ), 'binding' ) );
		$this->assertSame( [ $this->binding( $owner, $file, 'Beta' ), '', '', '' ],
			array_column( $this->images( $this->parseOwner( $owner,
			str_replace( "{{#layers_hint:$key|Alpha}}", "{{#layers_hint:$key|off}}", $text ) ) ), 'binding' ) );
	}

	public function testOtherFilesOwnersFilePageAndMissingRevisionNeverSupplyFallbacks(): void {
		$one = $this->seedFile( [ 'Labels' => [ 1 ] ] );
		$two = $this->seedFile( [ 'Other' => [ 1 ] ] );
		$text = '<gallery>' . "\nFile:{$one->getName()}|One\nFile:{$two->getName()}|Two\n</gallery>";
		$owner = $this->owner( $text, [ [ 'file', $one->getName(), 'Labels' ] ] );
		$other = $this->owner( $text, [ [ 'file', $one->getName(), 'Labels' ],
			[ 'file', $two->getName(), 'Other' ] ] );
		MigrationState::markComplete( $this->getDb() );
		$this->assertSame( [ $this->binding( $owner, $one, 'Labels' ), '' ],
			array_column( $this->images( $this->parseOwner( $owner ) ), 'binding' ) );
		$this->assertSame( [ $this->binding( $other, $one, 'Labels' ), $this->binding( $other, $two, 'Other' ) ],
			array_column( $this->images( $this->parseOwner( $other ) ), 'binding' ) );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $one->getTitle() );
		$fileOwner = [ 'title' => $one->getTitle(), 'revision' => $revision->getId(), 'text' => $text ];
		$this->assertSame( [ '', '' ], array_column( $this->images( $this->parseOwner( $fileOwner ) ), 'binding' ) );
		$this->assertSame( [ '', '' ], array_column( $this->images( $this->parseOwner(
			[ 'title' => $owner['title'], 'revision' => null, 'text' => $text ] ) ), 'binding' ) );
		$this->assertSame( [ $this->binding( $owner, $one, 'Labels' ), '' ],
			array_column( $this->images( $this->parseOwner( $owner ) ), 'binding' ) );
	}

	public function testPdfMembersKeepOneNameAndExactPagePayloadAndGeometry(): void {
		$file = $this->seedFile( [ 'Notes' => [ 1, 2 ] ], true );
		$key = $file->getName();
		$text = "<gallery>\nFile:$key|page=1|First\nFile:$key|page=2|Second\n" .
			"File:$key|page=1|Repeated\nFile:$key|page=2|layerset=on|Missing Default\n</gallery>";
		$owner = $this->owner( $text, [ [ 'file', $key, 'Notes' ] ] );
		MigrationState::markComplete( $this->getDb() );
		$images = $this->images( $this->parseOwner( $owner ) );
		$first = $this->binding( $owner, $file, 'Notes', 1 );
		$second = $this->binding( $owner, $file, 'Notes', 2 );
		$this->assertNotSame( '', $first );
		$this->assertNotSame( $first, $second );
		$this->assertSame( [ $first, $second, $first, '' ], array_column( $images, 'binding' ) );
		$before = $this->witness();
		try {
			$bundles = $this->pilot->prepareBoundViewers( $owner['title'], $owner['revision'],
				[ $first, $second ], $this->actor );
			foreach ( [ $first => 1, $second => 2 ] as $binding => $page ) {
				$bundle = $bundles[$binding];
				$this->assertSame( 'Notes', $bundle['surface']['label'] );
				$this->assertSame( $page, $bundle['surface']['source']['page'] );
				$this->assertSame( "J115C-Payload-Notes-page-$page", $bundle['surface']['layers'][0]['text'] );
				$this->assertSame( $page === 1 ? [ 416, 208 ] : [ 208, 416 ],
					[ $bundle['surface']['canvas']['width'], $bundle['surface']['canvas']['height'] ] );
				$this->assertStringContainsString( "page$page-", $bundle['source']['url'] );
			}
		} finally {
			$this->unchanged( $before );
		}
		$missing = $this->seedFile( [ 'Single' => [ 1 ] ], true );
		$missingOwner = $this->owner( "<gallery>\nFile:{$missing->getName()}|page=2|Absent member\n</gallery>",
			[ [ 'file', $missing->getName(), 'Single' ] ] );
		$this->assertSame( [ '' ], array_column( $this->images( $this->parseOwner( $missingOwner ) ), 'binding' ) );
	}

	public function testTemplatesInterleavedDefaultAndNestedCaptionsKeepTheirOccurrences(): void {
		$file = $this->seedFile( [ 'Alpha' => [ 1 ], 'Default' => [ 1 ] ] );
		$key = $file->getName();
		$template = Title::newFromText( 'Template:J115C_' . wfRandomString( 10 ) );
		$this->editPage( $template, "<gallery>\nFile:$key|layerset=Alpha|Template Alpha\n</gallery>",
			'', NS_MAIN, $this->actor );
		$tag = 'j115cnest' . strtolower( wfRandomString( 8 ) );
		$this->setTemporaryHook( 'ParserFirstCallInit', static function ( Parser $parser ) use ( $key, $tag ) {
			$parser->setHook( $tag, static function ( $input, array $args, Parser $captionParser ) use ( $key ) {
				return $captionParser->recursiveTagParse(
					"<gallery>\nFile:$key|layerset=on|Nested Default\n</gallery>" );
			} );
			return true;
		}, false );
		$text = "[[File:$key|80px|layerset=on|Direct Default]]\n{{{$template->getText()}}}\n" .
			"<gallery>\nFile:Missing_J115C.png|Skipped\nFile:$key|layerset=Alpha|<$tag/>\n" .
			"File:$key|Implicit ambiguous\nFile:$key|layerset=on|Final Default\n</gallery>";
		$owner = $this->owner( $text, [ [ 'file', $key, 'Alpha' ], [ 'file', $key, 'Default' ] ] );
		MigrationState::markComplete( $this->getDb() );
		$expected = [ $this->binding( $owner, $file, 'Default' ), $this->binding( $owner, $file, 'Alpha' ),
			$this->binding( $owner, $file, 'Alpha' ), $this->binding( $owner, $file, 'Default' ), '',
			$this->binding( $owner, $file, 'Default' ) ];
		foreach ( [ 1, 2 ] as $parse ) {
			$output = $this->parseOwner( $owner );
			$this->assertSame( $expected, array_column( $this->images( $output ), 'binding' ), "Parse $parse" );
			$this->assertStringContainsString( 'Template Alpha', $output->getRawText() );
			$this->assertStringContainsString( 'Nested Default', $output->getRawText() );
		}
	}

	public function testSuppressedSameFileEntryDoesNotDisplaceLaterGalleryOrDirectDefault(): void {
		$file = $this->seedFile( [ 'Default' => [ 1 ] ] );
		$key = $file->getName();
		$text = "<gallery>\nFile:$key|Suppressed\nFile:$key|Next implicit\n</gallery>\n" .
			"[[File:$key|80px|layerset=on|Direct Default]]";
		$owner = $this->owner( $text, [ [ 'file', $key, 'Default' ] ] );
		MigrationState::markComplete( $this->getDb() );
		$suppressOnce = true;
		$this->setTemporaryHook( 'BadImage', static function ( string $name, bool &$bad ) use (
			&$suppressOnce, $key
		) {
			if ( $name === $key && $suppressOnce ) {
				$suppressOnce = false;
				$bad = true;
				return false;
			}
			return true;
		} );
		$this->assertSame( [ $this->binding( $owner, $file, 'Default' ),
			$this->binding( $owner, $file, 'Default' ) ],
			array_column( $this->images( $this->parseOwner( $owner ) ), 'binding' ) );
	}
}
