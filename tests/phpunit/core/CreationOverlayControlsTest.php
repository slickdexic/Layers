<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Revision\CreationOverlayControls;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\User\User;

require_once __DIR__ . '/RealAssetTestCase.php';
require_once __DIR__ . '/../../../maintenance/migrateLayersToPageHistory.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\CreationOverlayControls
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundFileHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\SlideHooks
 * @group Database
 */
class CreationOverlayControlsTest extends RealAssetTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$database = $this->getDb();
		$this->assertStringContainsString( 'unittest', $database->getDomainID() );
		$this->assertSame( 0, (int)$database->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'layer_sets' )->caller( __METHOD__ )->fetchField() );
		$before = $this->witness();
		foreach ( [ false, true ] as $commit ) {
			$maintenance = new \MigrateLayersToPageHistory();
			$maintenance->setDB( $database );
			$maintenance->setOption( 'user', $this->getTestSysop()->getUser()->getName() );
			if ( $commit ) {
				$maintenance->setOption( 'commit', true );
			}
			ob_start();
			try {
				$this->assertTrue( $maintenance->execute() );
			} finally {
				$output = ob_get_clean();
			}
			$this->assertStringContainsString( $commit ? 'Migration recorded as complete:' :
				'Dry run: nothing is written.', $output );
			$this->assertSame( $before, $this->witness() );
		}
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repos->method( 'findFile' )->willReturnCallback( fn ( $title ) => $this->repo->findFile( $title ) );
		$this->setService( 'RepoGroup', $repos );
	}

	/** @return string Full, deterministically ordered test-table bytes */
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

	public function testMissingHostsCarryOnlyCompletePublicIdentityWithoutPublishing(): void {
		$embeds = [];
		foreach ( [ 'First', 'Second' ] as $label ) {
			$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
				'File:Overlay-' . $label . '-' . wfRandomString( 8 ) . '.png' );
			$embeds[] = '[[' . $file->getTitle()->getPrefixedDBkey() . '|80px|layerset=ABC|Original caption]]';
		}
		$text = implode( "\n", [ $embeds[0], $embeds[1], '{{#Slide:ABC}}', $embeds[0] ] );
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $text )->getNewRevision()->getId();
		$before = $this->witness();
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $page->getTitle(),
			ParserOptions::newFromAnon(), true, true, $revision );
		$html = $parsed->getRawText();
		$document = new \DOMDocument();
		$document->loadHTML( $html, LIBXML_NOERROR | LIBXML_NOWARNING );
		$hosts = ( new \DOMXPath( $document ) )->query( '//*[@data-layers-creation]' );
		$this->assertCount( 4, $hosts );
		$entries = $parsed->getExtensionData( CreationOverlayControls::DATA_KEY );
		$this->assertCount( 3, $entries );
		$this->assertSame( $hosts[0]->getAttribute( 'data-layers-creation' ),
			$hosts[3]->getAttribute( 'data-layers-creation' ) );
		foreach ( $entries as $identity => $entry ) {
			$this->assertSame( [ 'identity', 'label', 'kind', 'fileTitle' ], array_keys( $entry ) );
			$this->assertSame( $identity, $entry['identity'] );
			$parts = json_decode( $identity, true, 16, JSON_THROW_ON_ERROR );
			$this->assertSame( [ $page->getId(), $revision ], array_slice( $parts, 0, 2 ) );
			$this->assertSame( 'abc', $parts[4] );
		}
		$this->assertStringContainsString( 'Original caption', $html );
		foreach ( [ 'layerscreation', 'EditLayersPage', 'expected=', 'data-layers-binding',
			'data-layer-data', 'wgLayersCreationOverlays' ] as $forbidden ) {
			$this->assertStringNotContainsString( $forbidden, $html );
		}
		$this->assertSame( $before, $this->witness() );
	}

	/** @return array Native owner, parser output and isolated file identities */
	private function fixture( string $extra = '' ): array {
		$files = [];
		$embeds = [];
		foreach ( [ 'First', 'Second' ] as $label ) {
			$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
				'File:Controls-' . $label . '-' . wfRandomString( 8 ) . '.png' );
			$files[] = $file->getTitle()->getPrefixedDBkey();
			$embeds[] = '[[' . end( $files ) . '|80px|layerset=ABC|Original caption]]';
		}
		$text = implode( "\n", [ $embeds[0], $embeds[1], '{{#Slide:ABC}}', $embeds[0] ] ) . $extra;
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $text )->getNewRevision()->getId();
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $page->getTitle(),
			ParserOptions::newFromAnon(), true, true, $revision );
		return [ 'page' => $page, 'revision' => $revision, 'text' => $text, 'parsed' => $parsed,
			'files' => $files, 'pilot' => new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] ) ];
	}

	/**
	 * @param array $fixture
	 * @param User $user Original native request user
	 * @param array $query
	 * @return OutputPage
	 */
	private function output( array $fixture, User $user, array $query = [] ): OutputPage {
		$context = new RequestContext();
		$context->setTitle( $fixture['page']->getTitle() );
		$context->setUser( $user );
		$context->setRequest( new FauxRequest( $query ) );
		$output = new OutputPage( $context );
		$output->setRevisionId( $fixture['revision'] );
		BoundSlideHooks::output( $output, $fixture['parsed'], $fixture['pilot'] );
		return $output;
	}

	public function testRequestControlsKeepExactRoutesAndEmptyPreviewsOutOfSharedParserCache(): void {
		$fixture = $this->fixture();
		$actor = $this->actor();
		$shared = json_encode( $fixture['parsed']->toJsonArray(), JSON_THROW_ON_ERROR );
		$before = $this->witness();
		$output = $this->output( $fixture, $actor );
		$controls = $output->getJsConfigVars()['wgLayersCreationOverlays'];
		$this->assertCount( 3, $controls );
		foreach ( $controls as $identity => $entry ) {
			$parts = json_decode( $identity, true, 16, JSON_THROW_ON_ERROR );
			$this->assertSame( $identity, $entry['identity'] );
			$this->assertSame( 'ABC', $entry['label'] );
			$this->assertSame( [], $entry['preview']['layers'] );
			$query = [];
			parse_str( parse_url( $entry['editUrl'], PHP_URL_QUERY ), $query );
			$this->assertSame( (string)$fixture['page']->getId(), $query['pageid'] );
			$this->assertSame( (string)$fixture['revision'], $query['revid'] );
			if ( $entry['kind'] === 'image' ) {
				$this->assertStringContainsString( '[[' . $parts[3] . '|', $query['expected'] );
				$this->assertStringContainsString( substr( $parts[3], 5 ), $entry['preview']['imageUrl'] );
			} else {
				$this->assertSame( '{{#Slide:ABC}}', $query['expected'] );
				$this->assertNull( $entry['preview']['imageUrl'] );
				$this->assertSame( [ 800, 600 ], [ $entry['preview']['baseWidth'], $entry['preview']['baseHeight'] ] );
			}
		}
		$this->assertSame( $shared, json_encode( $fixture['parsed']->toJsonArray(), JSON_THROW_ON_ERROR ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testReaderAndAnonymousViewsNeverInheritEditorControlsFromTheSharedParse(): void {
		$fixture = $this->fixture();
		$actor = $this->actor();
		$editor = $this->output( $fixture, $actor )->getJsConfigVars()['wgLayersCreationOverlays'];
		$this->assertCount( 3, $editor );
		$shared = json_encode( $fixture['parsed']->toJsonArray(), JSON_THROW_ON_ERROR );
		$reader = $this->getTestUser( [ 'read' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$before = $this->witness();
		$views = $this->output( $fixture, $reader )->getJsConfigVars()['wgLayersCreationOverlays'];
		$this->assertSame( array_keys( $editor ), array_keys( $views ) );
		foreach ( $views as $entry ) {
			$this->assertArrayNotHasKey( 'editUrl', $entry );
			$this->assertSame( [], $entry['preview']['layers'] );
		}
		$anonymous = User::newFromId( 0 );
		$anonymousOutput = $this->output( $fixture, $anonymous );
		foreach ( $anonymousOutput->getJsConfigVars()['wgLayersCreationOverlays'] ?? [] as $entry ) {
			$this->assertArrayNotHasKey( 'editUrl', $entry );
		}
		$this->assertSame( $shared, json_encode( $fixture['parsed']->toJsonArray(), JSON_THROW_ON_ERROR ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testHistoricalDiffStaleForeignAndOutOfScopeOutputNeverGrantsCreationControls(): void {
		$fixture = $this->fixture();
		$actor = $this->actor();
		foreach ( [ [ 'oldid' => (string)$fixture['revision'] ], [ 'diff' => 'prev' ],
			[ 'action' => 'edit' ] ] as $query ) {
			$this->assertArrayNotHasKey( 'wgLayersCreationOverlays', $this->output( $fixture, $actor, $query )
				->getJsConfigVars() );
		}
		$outOfScope = $fixture;
		$outOfScope['pilot'] = new PageOwnedPilot( $this->getServiceContainer(), [], [] );
		$this->assertArrayNotHasKey( 'wgLayersCreationOverlays', $this->output( $outOfScope, $actor )
			->getJsConfigVars() );
		$other = $this->getExistingTestPage();
		$foreign = $fixture;
		$foreign['page'] = $other;
		$foreign['revision'] = $this->editPage( $other, $fixture['text'] )->getNewRevision()->getId();
		$this->assertArrayNotHasKey( 'wgLayersCreationOverlays', $this->output( $foreign, $actor )->getJsConfigVars() );
		$this->editPage( $fixture['page'], $fixture['text'] . "\nOwner changed" );
		$this->assertArrayNotHasKey( 'wgLayersCreationOverlays', $this->output( $fixture, $actor )->getJsConfigVars() );
	}

	public function testTemplateAndGalleryOccurrencesCannotBorrowDirectCreationIdentity(): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Occurrence-' . wfRandomString( 8 ) . '.png' );
		$key = $file->getTitle()->getPrefixedDBkey();
		$direct = '[[' . $key . '|layerset=ABC|Direct caption]]';
		$template = $this->getExistingTestPage( 'Template:Overlay-' . wfRandomString( 8 ) );
		$this->editPage( $template, $direct );
		$text = $direct . "\n{{" . $template->getTitle()->getText() . "}}\n<gallery>\n" .
			$key . "|layerset=ABC\n</gallery>";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $text )->getNewRevision()->getId();
		$before = $this->witness();
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $page->getTitle(),
			ParserOptions::newFromAnon(), true, true, $revision );
		$document = new \DOMDocument();
		$document->loadHTML( $parsed->getRawText(), LIBXML_NOERROR | LIBXML_NOWARNING );
		$hosts = ( new \DOMXPath( $document ) )->query( '//*[@data-layers-creation]' );
		$this->assertCount( 1, $hosts );
		$this->assertCount( 1, $parsed->getExtensionData( CreationOverlayControls::DATA_KEY ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testClassCaptionNormalizedSpellingNoeditDefaultAndHideIntents(): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Options-' . wfRandomString( 8 ) . '.png' );
		$key = $file->getTitle()->getPrefixedDBkey();
		$text = "[[$key|80px|class=owned-image|alt=Original alt|layerset=ABC|Original caption]]\n" .
			"[[$key|layerset=abc|NOEDIT]]\n[[$key|layerset=on]]\n" .
			"[[$key|layerset=off]]\n[[$key|layerset=none]]\n{{#Slide:ABC|NOEDIT|size=200x100}}";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $text )->getNewRevision()->getId();
		$before = $this->witness();
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $page->getTitle(),
			ParserOptions::newFromAnon(), true, true, $revision );
		$html = $parsed->getRawText();
		$document = new \DOMDocument();
		$document->loadHTML( $html, LIBXML_NOERROR | LIBXML_NOWARNING );
		$xpath = new \DOMXPath( $document );
		$hosts = $xpath->query( '//*[@data-layers-creation]' );
		$this->assertCount( 4, $hosts );
		$this->assertCount( 1, $xpath->query( '//*[contains(concat(" ", @class, " "), " owned-image ")]' ) );
		$this->assertStringContainsString( 'alt="Original alt"', $html );
		$this->assertStringContainsString( 'Original caption', $html );
		$this->assertSame( $hosts[0]->getAttribute( 'data-layers-creation' ),
			$hosts[1]->getAttribute( 'data-layers-creation' ) );
		$this->assertSame( '1', $hosts[1]->getAttribute( 'data-layers-noedit' ) );
		$this->assertSame( '1', $hosts[3]->getAttribute( 'data-layers-noedit' ) );
		$this->assertStringContainsString( '"default"', $hosts[2]->getAttribute( 'data-layers-creation' ) );
		$entries = $parsed->getExtensionData( CreationOverlayControls::DATA_KEY );
		$this->assertSame( 'ABC', $entries[$hosts[0]->getAttribute( 'data-layers-creation' )]['label'] );
		$this->assertStringNotContainsString( 'layerscreation-', $html );
		$this->assertSame( $before, $this->witness() );
	}

	public function testMissingPdfDoesNotEnterTheNewImageCreationIntegration(): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Excluded-pdf-' . wfRandomString( 8 ) . '.pdf' );
		$page = $this->getExistingTestPage();
		$text = '[[' . $file->getTitle()->getPrefixedDBkey() . '|page=2|layerset=ABC]]';
		$revision = $this->editPage( $page, $text )->getNewRevision()->getId();
		$before = $this->witness();
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $page->getTitle(),
			ParserOptions::newFromAnon(), true, true, $revision );
		$this->assertStringContainsString( '<img ', $parsed->getRawText() );
		$this->assertStringNotContainsString( 'data-layers-creation', $parsed->getRawText() );
		$this->assertStringNotContainsString( 'layerscreation-', $parsed->getRawText() );
		$this->assertNull( $parsed->getExtensionData( CreationOverlayControls::DATA_KEY ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testDefaultShortcutUsesExactEditorAdmissionWithoutWriting(): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Default-boundary-' . wfRandomString( 8 ) . '.png' );
		$text = '[[' . $file->getTitle()->getPrefixedDBkey() . '|layerset=on]]';
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $text )->getNewRevision()->getId();
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] );
		$actor = $this->actor();
		$before = $this->witness();
		try {
			$selections = $pilot->listCreationOverlaySelections( $page->getId(), $revision, $actor );
			$this->assertCount( 1, $selections );
			$this->assertSame( 'Default', $selections[0]['label'] );
			$this->assertSame( $text, $selections[0]['params']['expected'] );
			$this->assertIsArray( $pilot->prepareBoundEditor( $page->getId(), $revision,
				(int)$selections[0]['params']['start'], $text, $actor ) );
			$context = new RequestContext();
			$context->setUser( $actor );
			$context->setTitle( $page->getTitle() );
			$context->setRequest( new FauxRequest( $selections[0]['params'] ) );
			$special = $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'EditLayersPage' );
			$special->setContext( $context );
			$special->execute( '' );
			$config = $context->getOutput()->getJsConfigVars();
			$this->assertSame( 'Default', $config['wgLayersEditorInit']['pageOwned']['newSurface']['label'] );
			$this->assertSame( [], $config['wgLayersEditorInit']['pageOwned']['newSurface']['layers'] );
			$this->assertSame( $page->getTitle()->getLocalURL(), $config['wgLayersReturnToUrl'] );
		} finally {
			$after = $this->witness();
			$this->assertSame( $before, $after );
			$output = getenv( 'LAYERS_CREATION_WITNESSES' );
			if ( $output ) {
				file_put_contents( $output, json_encode( [ 'boundary' => 'desired exact Default admission',
					'pageId' => $page->getId(), 'revisionId' => $revision, 'text' => $text,
					'before' => base64_encode( $before ), 'after' => base64_encode( $after ),
					'candidateSha256' => hash_file( 'sha256', ( new \ReflectionClass( PageOwnedPilot::class ) )
						->getFileName() ) ] ) . "\n", FILE_APPEND | LOCK_EX );
			}
		}
	}

	/**
	 * @dataProvider provideSaveKinds
	 * @param string $kind
	 */
	public function testOpenAndCancelPublishNothingAndFirstSaveAddsOneOwnerRevision( string $kind ): void {
		$fixture = $this->fixture();
		$actor = $this->actor();
		$before = $this->witness();
		$selections = $fixture['pilot']->listCreationOverlaySelections( $fixture['page']->getId(),
			$fixture['revision'], $actor );
		$selection = array_values( array_filter( $selections, static fn ( array $entry ): bool =>
			$entry['kind'] === $kind ) )[0];
		$params = $selection['params'];
		$context = new RequestContext();
		$context->setUser( $actor );
		$context->setTitle( $fixture['page']->getTitle() );
		$context->setRequest( new FauxRequest( $params ) );
		$special = $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'EditLayersPage' );
		$special->setContext( $context );
		$special->execute( '' );
		$config = $context->getOutput()->getJsConfigVars();
		$this->assertSame( $fixture['page']->getTitle()->getLocalURL(), $config['wgLayersReturnToUrl'] );
		$init = $config['wgLayersEditorInit'];
		$this->assertSame( 'ABC', $init['pageOwned']['newSurface']['label'] );
		$this->assertSame( [], $init['pageOwned']['newSurface']['layers'] );
		$this->assertSame( $before, $this->witness() );
		$count = (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->where( [ 'rev_page' => $fixture['page']->getId() ] )->caller( __METHOD__ )->fetchField();
		$saved = $this->publisher->publish( $fixture['page']->getTitle(), $actor, $fixture['revision'],
			$this->buildDocument( [ $init['pageOwned']['newSurface'] ] ), 'Explicit first Save', null,
			$fixture['page']->getId() );
		$this->assertSame( $count + 1, (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'revision' )->where( [ 'rev_page' => $fixture['page']->getId() ] )
			->caller( __METHOD__ )->fetchField() );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $saved );
		$this->assertSame( $fixture['text'], $revision->getContent( SlotRecord::MAIN, RevisionRecord::RAW )
			->getText() );
	}

	/** @return array */
	public static function provideSaveKinds(): array {
		return [ 'image' => [ 'image' ], 'slide' => [ 'slide' ] ];
	}

	/** @return array */
	public static function provideReadDenials(): array {
		return [ 'owner' => [ true ], 'files' => [ false ] ];
	}

	/**
	 * @dataProvider provideReadDenials
	 * @param bool $ownerDenied
	 */
	public function testReadDenialsKeepSharedCacheAndPublishNothing( bool $ownerDenied ): void {
		$fixture = $this->fixture();
		$actor = $this->actor();
		$shared = json_encode( $fixture['parsed']->toJsonArray(), JSON_THROW_ON_ERROR );
		$before = $this->witness();
		$owner = $fixture['page']->getTitle();
		$this->setTemporaryHook( 'getUserPermissionsErrors',
			static function ( $title, $user, $action, &$result ) use ( $ownerDenied, $owner ) {
				if ( $action === 'read' && ( $ownerDenied ? $title->equals( $owner ) :
					$title->getNamespace() === NS_FILE ) ) {
					$result = false;
					return false;
				}
				return true;
			} );
		try {
			$controls = $this->output( $fixture, $actor )->getJsConfigVars()['wgLayersCreationOverlays'] ?? [];
			$this->assertCount( $ownerDenied ? 0 : 1, $controls );
			foreach ( $controls as $entry ) {
				$this->assertSame( 'slide', $entry['kind'] );
				$this->assertSame( [], $entry['preview']['layers'] );
			}
			$this->assertSame( $shared, json_encode( $fixture['parsed']->toJsonArray(), JSON_THROW_ON_ERROR ) );
		} finally {
			$after = $this->witness();
			$this->assertSame( $before, $after );
			$output = getenv( 'LAYERS_CREATION_WITNESSES' );
			if ( $output ) {
				file_put_contents( $output, json_encode( [ 'case' => $this->getName(),
					'before' => base64_encode( $before ), 'after' => base64_encode( $after ) ] ) . "\n",
					FILE_APPEND | LOCK_EX );
			}
		}
	}
}
