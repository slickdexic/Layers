<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;

require_once __DIR__ . '/RealAssetTestCase.php';
require_once __DIR__ . '/../../../maintenance/migrateLayersToPageHistory.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions
 * @covers \MediaWiki\Extension\Layers\Revision\CreationOverlayControls
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @group Database
 */
class DefaultShortcutAdmissionTest extends RealAssetTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		$this->assertSame( 0, (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'layer_sets' )->caller( __METHOD__ )->fetchField() );
		$before = $this->witness();
		$maintenance = new \MigrateLayersToPageHistory();
		$maintenance->setDB( $this->getDb() );
		$maintenance->setOption( 'user', $this->getTestSysop()->getUser()->getName() );
		$maintenance->setOption( 'commit', true );
		ob_start();
		try {
			$this->assertTrue( $maintenance->execute() );
		} finally {
			$output = ob_get_clean();
		}
		$this->assertStringContainsString( 'Migration recorded as complete:', $output );
		$this->assertSame( $before, $this->witness() );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repos->method( 'findFile' )->willReturnCallback( fn ( $title ) => $this->repo->findFile( $title ) );
		$this->setService( 'RepoGroup', $repos );
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

	/** @param array $labels @param string $selector @return array */
	private function fixture( array $labels = [], string $selector = 'layerset=on' ): array {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Default-matrix-' . wfRandomString( 8 ) . '.png' );
		$embed = '[[' . $file->getTitle()->getPrefixedDBkey() . '|80px|' . $selector .
			'|class=original-default|alt=Default alt|Default caption]]';
		$text = $embed . "\n" . $embed;
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $text )->getNewRevision()->getId();
		$surfaces = [];
		foreach ( $labels as $index => $label ) {
			$surface = $this->makeImageSurface( 'stored-' . $index, $label, 'File:' . $file->getName(),
				$file->getTimestamp(), $file->getSha1() );
			$surface['layers'] = [ [ 'id' => 'text-' . $index, 'type' => 'text', 'x' => 1, 'y' => 1,
				'text' => 'Exact saved ' . $label, 'fontSize' => 16, 'color' => '#000000' ] ];
			$surface['readingOrder'] = [ 'text-' . $index ];
			$surfaces[] = $surface;
			$revision = $this->publisher->publish( $page->getTitle(), $this->actor(), $revision,
				$this->buildDocument( $surfaces ), 'Seed explicit test layer set', null, $page->getId() );
		}
		return [ 'page' => $page, 'revision' => $revision, 'text' => $text, 'embed' => $embed,
			'file' => $file, 'surfaces' => $surfaces,
			'pilot' => new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] ) ];
	}

	/**
	 * @param array $fixture
	 * @param bool $migrated
	 * @return \MediaWiki\Parser\ParserOutput
	 */
	private function parseFixture( array $fixture, bool $migrated = true ) {
		$options = ParserOptions::newFromAnon();
		$options->setOption( MigrationState::PARSER_OPTION, $migrated );
		return $this->getServiceContainer()->getParserFactory()->create()->parse( $fixture['text'],
			$fixture['page']->getTitle(), $options, true, true, $fixture['revision'] );
	}

	/**
	 * @param array $fixture
	 * @param \MediaWiki\Parser\ParserOutput $parsed
	 * @return array
	 */
	private function controls( array $fixture, $parsed ): array {
		$context = new RequestContext();
		$context->setUser( $this->actor() );
		$context->setTitle( $fixture['page']->getTitle() );
		$context->setRequest( new FauxRequest() );
		$out = new OutputPage( $context );
		$out->setRevisionId( $fixture['revision'] );
		BoundSlideHooks::output( $out, $parsed, $fixture['pilot'] );
		return $out->getJsConfigVars()['wgLayersCreationOverlays'] ?? [];
	}

	public function testAbsentUnrelatedAndNumberedSetsStillOpenOnlyEmptyDefault(): void {
		foreach ( [ [], [ 'Anatomy' ], [ 'Default 2' ] ] as $labels ) {
			$fixture = $this->fixture( $labels );
			$before = $this->witness();
			try {
				$entries = $fixture['pilot']->listCreationOverlaySelections( $fixture['page']->getId(),
					$fixture['revision'], $this->actor() );
				$this->assertCount( 1, $entries );
				$this->assertSame( 'Default', $entries[0]['label'] );
				$this->assertSame( $fixture['embed'], $entries[0]['params']['expected'] );
				$init = $fixture['pilot']->prepareBoundEditor( $fixture['page']->getId(),
					$fixture['revision'], 0, $fixture['embed'], $this->actor() );
				$this->assertSame( 'Default', $init['pageOwned']['newSurface']['label'] );
				$this->assertSame( [], $init['pageOwned']['newSurface']['layers'] );
				$parsed = $this->parseFixture( $fixture );
				$this->assertSame( 2, substr_count( $parsed->getRawText(), 'data-layers-creation=' ) );
				$this->assertStringNotContainsString( 'data-layers-binding=', $parsed->getRawText() );
				$this->assertStringContainsString( 'alt="Default alt"', $parsed->getRawText() );
				$this->assertStringContainsString( 'Default caption', $parsed->getRawText() );
				$shared = serialize( $parsed->toJsonArray() );
				$controls = $this->controls( $fixture, $parsed );
				$this->assertCount( 1, $controls );
				$this->assertSame( [], array_values( $controls )[0]['preview']['layers'] );
				$this->assertArrayHasKey( 'editUrl', array_values( $controls )[0] );
				$this->assertSame( $shared, serialize( $parsed->toJsonArray() ) );
			} finally {
				$this->unchanged( $before );
			}
		}
	}

	public function testSavedDefaultKeepsItsSpellingPayloadIdentityAndPinInsteadOfNewerOtherSet(): void {
		$fixture = $this->fixture( [ 'dEfAuLt', 'Unrelated' ] );
		$before = $this->witness();
		try {
			$this->assertSame( [], $fixture['pilot']->listCreationOverlaySelections( $fixture['page']->getId(),
				$fixture['revision'], $this->actor() ) );
			$init = $fixture['pilot']->prepareBoundEditor( $fixture['page']->getId(), $fixture['revision'],
				0, $fixture['embed'], $this->actor() );
			$this->assertSame( 'stored-0', $init['pageOwned']['surfaceId'] );
			$this->assertArrayNotHasKey( 'newSurface', $init['pageOwned'] );
			$this->assertArrayNotHasKey( 'layers', $init );
			$this->assertSame( 'dEfAuLt', $fixture['pilot']->listBoundEditorSelections(
				$fixture['page']->getId(), $fixture['revision'], $this->actor() )[0]['label'] );
			$parsed = $this->parseFixture( $fixture );
			$this->assertSame( 2, substr_count( $parsed->getRawText(), 'data-layers-binding="v1:' .
				$fixture['page']->getId() . ':stored-0"' ) );
			$this->assertStringNotContainsString( 'data-layers-creation=', $parsed->getRawText() );
			$document = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $fixture['revision'] )
				->getContent( 'layers', RevisionRecord::RAW );
			$saved = json_decode( $document->getText(), true )['surfaces'][0];
			foreach ( $fixture['surfaces'][0]['layers'][0] as $key => $value ) {
				$this->assertSame( $value, $saved['layers'][0][$key] );
			}
			foreach ( $fixture['surfaces'][0]['source'] as $key => $value ) {
				$this->assertSame( $value, $saved['source'][$key] );
			}
		} finally {
			$this->unchanged( $before );
		}
	}

	public function testLegacyParserOptionAndLiteralOnNeverBecomeDefault(): void {
		$fixture = $this->fixture( [ 'on' ], 'layerset=name:on' );
		$before = $this->witness();
		try {
			$init = $fixture['pilot']->prepareBoundEditor( $fixture['page']->getId(), $fixture['revision'],
				0, $fixture['embed'], $this->actor() );
			$this->assertSame( 'stored-0', $init['pageOwned']['surfaceId'] );
			$this->assertStringContainsString( ':stored-0"', $this->parseFixture( $fixture )->getRawText() );
			$this->assertStringNotContainsString( 'data-layers-creation=',
				$this->parseFixture( $fixture, false )->getRawText() );
		} finally {
			$this->unchanged( $before );
		}
	}

	public function testFirstDefaultSaveCreatesOneRevisionAndReopensTheSameSetWithoutChangingSource(): void {
		$fixture = $this->fixture( [ 'Unrelated' ], 'layers=ON' );
		$before = $this->witness();
		$entries = $fixture['pilot']->listCreationOverlaySelections( $fixture['page']->getId(),
			$fixture['revision'], $this->actor() );
		$context = new RequestContext();
		$context->setUser( $this->actor() );
		$context->setTitle( $fixture['page']->getTitle() );
		$context->setRequest( new FauxRequest( $entries[0]['params'] ) );
		$special = $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'EditLayersPage' );
		$special->setContext( $context );
		$special->execute( '' );
		$config = $context->getOutput()->getJsConfigVars();
		$this->assertSame( $fixture['page']->getTitle()->getLocalURL(), $config['wgLayersReturnToUrl'] );
		$surface = $config['wgLayersEditorInit']['pageOwned']['newSurface'];
		$this->assertSame( 'Default', $surface['label'] );
		$this->unchanged( $before );
		$count = (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->where( [ 'rev_page' => $fixture['page']->getId() ] )->caller( __METHOD__ )->fetchField();
		$revision = $this->publisher->publish( $fixture['page']->getTitle(), $this->actor(), $fixture['revision'],
			$this->buildDocument( [ ...$fixture['surfaces'], $surface ] ), 'Explicit first Default Save', null,
			$fixture['page']->getId() );
		$this->assertSame( $count + 1, (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'revision' )->where( [ 'rev_page' => $fixture['page']->getId() ] )
			->caller( __METHOD__ )->fetchField() );
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
		$this->assertSame( $fixture['text'], $current->getContent( SlotRecord::MAIN, RevisionRecord::RAW )->getText() );
		$beforeReopen = $this->witness();
		$init = $fixture['pilot']->prepareBoundEditor( $fixture['page']->getId(), $revision, 0,
			$fixture['embed'], $this->actor() );
		$this->assertSame( $surface['id'], $init['pageOwned']['surfaceId'] );
		$this->assertArrayNotHasKey( 'newSurface', $init['pageOwned'] );
		$this->unchanged( $beforeReopen );
	}

	public function testDifferentFilesSlidesAndOwnersKeepIndependentDefaultIdentities(): void {
		$fixture = $this->fixture( [ 'Default' ] );
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Independent-default-' . wfRandomString( 8 ) . '.png' );
		$otherEmbed = '[[' . $file->getTitle()->getPrefixedDBkey() . '|layerset=on]]';
		$slideEmbed = '{{#Slide:Default}}';
		$text = $fixture['embed'] . "\n" . $otherEmbed . "\n" . $slideEmbed . "\n" . $fixture['embed'];
		$base = $fixture['revision'];
		$preserved = json_decode( $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $base )
			->getContent( 'layers', RevisionRecord::RAW )->getText(), true )['surfaces'];
		$image = $this->makeImageSurface( 'other-file-default', 'Default', 'File:' . $file->getName(),
			$file->getTimestamp(), $file->getSha1() );
		$slide = $this->makeSlideSurface( 'slide-default', 'Default' );
		$fixture['revision'] = $this->publisher->publish( $fixture['page']->getTitle(), $this->actor(), $base,
			$this->buildDocument( [ ...$preserved, $image, $slide ] ), 'Seed independent Defaults',
			new WikitextContent( $text ),
			$fixture['page']->getId() );
		$this->assertGreaterThan( $base, $fixture['revision'] );
		$result = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $fixture['revision'] );
		$this->assertSame( $fixture['page']->getId(), $result->getPageId() );
		$this->assertSame( $base, $result->getParentId() );
		$this->assertSame( $text, $result->getContent( SlotRecord::MAIN, RevisionRecord::RAW )->getText() );
		$published = json_decode( $result->getContent( 'layers', RevisionRecord::RAW )->getText(), true )['surfaces'];
		$this->assertSame( $preserved, array_slice( $published, 0, count( $preserved ) ) );
		$this->assertSame( [ 'stored-0', 'other-file-default', 'slide-default' ], array_column( $published, 'id' ) );
		$fixture['text'] = $text;
		$other = $this->getExistingTestPage();
		$otherRevision = $this->editPage( $other, $fixture['embed'] )->getNewRevision()->getId();
		$before = $this->witness();
		try {
			$this->assertCount( 3, $fixture['pilot']->listBoundEditorSelections( $fixture['page']->getId(),
				$fixture['revision'], $this->actor() ) );
			foreach ( [ $fixture['embed'] => 'stored-0', $otherEmbed => 'other-file-default',
				$slideEmbed => 'slide-default' ] as $embed => $id ) {
				$init = $fixture['pilot']->prepareBoundEditor( $fixture['page']->getId(), $fixture['revision'],
					strpos( $text, $embed ), $embed, $this->actor() );
				$this->assertSame( $id, $init['pageOwned']['surfaceId'] );
			}
			$parsed = $this->parseFixture( $fixture );
			$this->assertSame( 2, substr_count( $parsed->getRawText(), ':stored-0"' ) );
			$this->assertStringContainsString( ':other-file-default"', $parsed->getRawText() );
			$this->assertStringContainsString( ':slide-default"', $parsed->getRawText() );
			$init = $fixture['pilot']->prepareBoundEditor( $other->getId(), $otherRevision, 0,
				$fixture['embed'], $this->actor() );
			$this->assertSame( 'Default', $init['pageOwned']['newSurface']['label'] );
			$this->assertSame( [], $init['pageOwned']['newSurface']['layers'] );
			$this->assertSame( $other->getId(), $init['pageOwned']['pageId'] );
		} finally {
			$this->unchanged( $before );
		}
	}

	/** @dataProvider conflictingSelectorsProvider */
	public function testConflictingDefaultSelectorsNeverRenderOrAdmitASavedDefault( string $selector ): void {
			$fixture = $this->fixture( [ 'Default' ], $selector );
			$before = $this->witness();
		try {
			$this->assertSame( [], $fixture['pilot']->listBoundEditorSelections( $fixture['page']->getId(),
				$fixture['revision'], $this->actor() ) );
			$refusal = null;
			try {
				$fixture['pilot']->prepareBoundEditor( $fixture['page']->getId(), $fixture['revision'],
					0, $fixture['embed'], $this->actor() );
			} catch ( \DomainException $error ) {
				$refusal = $error->getMessage();
			}
			$this->assertSame( 'layers-editor-unavailable', $refusal );
			$html = $this->parseFixture( $fixture )->getRawText();
			$this->assertStringNotContainsString( 'data-layers-binding=', $html );
			$this->assertStringNotContainsString( 'data-layers-creation=', $html );
		} finally {
			$this->unchanged( $before );
		}
	}

	public static function conflictingSelectorsProvider(): array {
		return [
			'mixed-forward' => [ 'layerset=on|layers=on' ],
			'mixed-reverse' => [ 'layers=on|layerset=on' ],
			'name-forward' => [ 'layerset=on|layerset=Other' ],
			'name-reverse' => [ 'layerset=Other|layerset=on' ],
			'binding-forward' => [ 'layerset=on|layersbinding=v1:999:foreign' ],
			'binding-reverse' => [ 'layersbinding=v1:999:foreign|layerset=on' ],
			'alias-binding-forward' => [ 'layers=on|layersbinding=v1:999:foreign' ],
			'alias-binding-reverse' => [ 'layersbinding=v1:999:foreign|layers=on' ],
			'repeated' => [ 'layerset=on|layerset=ON' ],
		];
	}

	public function testNativeLinkedCaptionAndFollowingDefaultKeepOriginalAssociation(): void {
		$fixture = $this->fixture( [ 'Default' ] );
		$linked = str_replace( '|Default caption]]', '|Caption [[Main Page|native label]]]]', $fixture['embed'] );
		$text = $linked . "\n" . $fixture['embed'];
		$fixture['revision'] = $this->publisher->publish( $fixture['page']->getTitle(), $this->actor(),
			$fixture['revision'], $this->buildDocument( $fixture['surfaces'] ), 'Preserve native linked caption',
			new WikitextContent( $text ), $fixture['page']->getId() );
		$fixture['text'] = $text;
		$before = $this->witness();
		try {
			$html = $this->parseFixture( $fixture )->getRawText();
			$this->assertSame( 2, substr_count( $html, 'class="mw-file-element' ) );
			$this->assertSame( 2, substr_count( $html, 'data-layers-binding="v1:' .
				$fixture['page']->getId() . ':stored-0"' ) );
			$this->assertStringNotContainsString( 'data-layers-creation=', $html );
			$this->assertStringContainsString( 'native label', $html );
		} finally {
			$this->unchanged( $before );
		}
	}

	/** @dataProvider adjacentOccurrencesProvider */
	public function testRefusedAndValidSameFileOccurrencesKeepTheirOwnQueueSlots(
		bool $invalidFirst, bool $saved
	): void {
		$fixture = $this->fixture( $saved ? [ 'Default' ] : [] );
		$invalid = str_replace( '|layerset=on|', '|layerset=Other|layers=on|', $fixture['embed'] );
		$occurrences = $invalidFirst ? [ $invalid, $fixture['embed'] ] : [ $fixture['embed'], $invalid ];
		$text = implode( "\n", $occurrences );
		$fixture['revision'] = $this->publisher->publish( $fixture['page']->getTitle(), $this->actor(),
			$fixture['revision'], $this->buildDocument( $fixture['surfaces'] ), 'Preserve occurrence queue slots',
			new WikitextContent( $text ), $fixture['page']->getId() );
		$fixture['text'] = $text;
		$before = $this->witness();
		try {
			$document = new \DOMDocument();
			$document->loadHTML( $this->parseFixture( $fixture )->getRawText() );
			$images = ( new \DOMXPath( $document ) )->query( '//img' );
			$this->assertCount( 2, $images );
			$refused = $images->item( $invalidFirst ? 0 : 1 );
			$valid = $images->item( $invalidFirst ? 1 : 0 );
			$this->assertFalse( $refused->hasAttribute( 'data-layers-binding' ) );
			$this->assertFalse( $refused->hasAttribute( 'data-layers-creation' ) );
			$this->assertFalse( $refused->hasAttribute( 'data-layer-set' ) );
			$this->assertSame( 'Default alt', $refused->getAttribute( 'alt' ) );
			if ( $saved ) {
				$this->assertSame( 'v1:' . $fixture['page']->getId() . ':stored-0',
					$valid->getAttribute( 'data-layers-binding' ) );
				$this->assertFalse( $valid->hasAttribute( 'data-layers-creation' ) );
			} else {
				$this->assertTrue( $valid->hasAttribute( 'data-layers-creation' ) );
				$this->assertFalse( $valid->hasAttribute( 'data-layers-binding' ) );
				$this->assertCount( 1, $this->controls( $fixture, $this->parseFixture( $fixture ) ) );
			}
		} finally {
			$this->unchanged( $before );
		}
	}

	public static function adjacentOccurrencesProvider(): array {
		return [ 'invalid-before-saved' => [ true, true ], 'saved-before-invalid' => [ false, true ],
			'invalid-before-empty' => [ true, false ], 'empty-before-invalid' => [ false, false ] ];
	}

	public function testDefaultRoutesStillRejectReaderForeignStaleAndChangedSource(): void {
		$fixture = $this->fixture();
		$before = $this->witness();
		try {
			$reader = $this->actor( [ 'read' ] );
			$this->assertSame( [], $fixture['pilot']->listCreationOverlaySelections( $fixture['page']->getId(),
				$fixture['revision'], $reader ) );
			$refusal = null;
			try {
				$fixture['pilot']->prepareBoundEditor( $fixture['page']->getId(), $fixture['revision'],
					0, $fixture['embed'], $reader );
			} catch ( \DomainException $error ) {
				$refusal = $error->getMessage();
			}
			$this->assertSame( 'layers-editor-unavailable', $refusal );
		} finally {
			$this->unchanged( $before );
		}
		$actor = $this->actor();
		$other = $this->getExistingTestPage();
		$current = $this->editPage( $fixture['page'], $fixture['text'] . "\nOwner changed" )
			->getNewRevision()->getId();
		$before = $this->witness();
		try {
			foreach ( [ [ $fixture['page']->getId(), $fixture['revision'], $fixture['embed'] ],
				[ $other->getId(), $current, $fixture['embed'] ],
				[ $fixture['page']->getId(), $current, str_replace( 'on', 'Default', $fixture['embed'] ) ]
			] as [ $pageId, $revisionId, $expected ] ) {
				$refusal = null;
				try {
					$fixture['pilot']->prepareBoundEditor( $pageId, $revisionId, 0, $expected, $actor );
				} catch ( \DomainException $error ) {
					$refusal = $error->getMessage();
				}
				$this->assertSame( 'layers-editor-unavailable', $refusal );
			}
		} finally {
			$this->unchanged( $before );
		}
	}

	/** @return array */
	public static function nativeCollectorBoundariesProvider(): array {
		return [
			'literal-colon' => [ '[[:FILE|ordinary link]]', 'Native caption', '' ],
			'encoded-colon' => [ '[[%3AFILE|ordinary link]]', 'Native caption', '' ],
			'external-triple-close' => [ '', '[https://example.org native external label]', '' ],
			'nested-trailing-bracket' => [ '', 'Caption [[Main Page|native label]]', ']' ],
			'caption-selector-text' => [ '', 'Caption [[Main Page|layerset=off]]', '' ],
			'unlayered-caption-neighbor' => [ '', 'Native caption', '', true ],
			'multiple-nested-captions' => [ '', '[[Main Page|first]] and [[Help:Contents|second]]', '' ]
		];
	}

	/**
	 * @dataProvider nativeCollectorBoundariesProvider
	 * @param string $prefix
	 * @param string $caption
	 * @param string $trailing
	 * @param bool $neighbor
	 */
	public function testCollectorBoundariesKeepSavedDefaultQueueAndNativeOutput(
		string $prefix, string $caption, string $trailing, bool $neighbor = false
	): void {
		$fixture = $this->fixture( [ 'Default' ] );
		$title = $fixture['file']->getTitle()->getPrefixedDBkey();
		$image = '[[' . $title . '|thumb|80px|alt=Native alt|class=native-boundary|' . $caption . '|layerset=on]]';
		$neighborImage = $neighbor ? '[[' . $title . '|thumb|40px|Neighbor [[Main Page|layerset=off]]]]' : '';
		$fixture['text'] = str_replace( 'FILE', $title, $prefix ) . "\n" . $image . $trailing . "\nAFTER\n" .
			$neighborImage . "\n" . $image;
		$before = $this->witness();
		$integrated = false;
		$this->setTemporaryHook( 'InternalParseBeforeLinks',
			static function ( $parser, &$text, $strip ) use ( &$integrated ) {
				if ( $integrated ) {
					return \MediaWiki\Extension\Layers\Hooks\WikitextHooks::onInternalParseBeforeLinks(
						$parser, $text, $strip );
				}
				return true;
			}, true );
		try {
			$coreFixture = $fixture;
			$coreFixture['text'] = str_replace( '|layerset=on]]', ']]', $fixture['text'] );
			$core = $this->parseFixture( $coreFixture )->getRawText();
			$integrated = true;
			$actual = $this->parseFixture( $fixture )->getRawText();
			$this->assertSame( 2, substr_count( $actual, 'data-layers-binding="v1:' .
				$fixture['page']->getId() . ':stored-0"' ) );
			$this->assertStringNotContainsString( 'data-layers-creation=', $actual );
			$this->assertSame( $neighbor ? 3 : 2, substr_count( $actual, '<img ' ) );
			$normalize = static fn ( string $html ): string => str_replace( ' layers-bound-file', '',
				preg_replace( '/ data-layers-(?:instance|binding|revision)="[^"]*"/', '', $html ) );
			$this->assertSame( $normalize( $core ), $normalize( $actual ) );
			$output = getenv( 'LAYERS_CREATION_WITNESSES' );
			if ( $output ) {
				file_put_contents( $output, json_encode( [ 'case' => $this->getName(),
					'native' => $core, 'integrated' => $actual, 'source' => $fixture['text'],
					'normalization' => [ 'layers-bound-file class', 'data-layers-instance',
						'data-layers-binding', 'data-layers-revision' ] ] ) . "\n", FILE_APPEND | LOCK_EX );
			}
		} finally {
			$this->unchanged( $before );
		}
	}
}
