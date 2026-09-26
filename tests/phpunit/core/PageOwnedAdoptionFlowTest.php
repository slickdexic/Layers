<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Exception\UserNotLoggedIn;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\SpecialPages\SpecialAdoptLayersDrawing;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Request\FauxRequest;
use MediaWiki\User\User;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Explicit adoption of a shared slide through its confirmation page.
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialAdoptLayersDrawing
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 * @group API
 */
class PageOwnedAdoptionFlowTest extends \MediaWiki\Tests\Api\ApiTestCase {
	private const PREFIX = "Intro<br>\n";
	private const EMBED = '{{#Slide:WelcomePresentation|width=400}}';

	/** The composition whose admission hook is installed; a fresh service instance would not be admitted. */
	private ?PageOwnedPilot $pilot = null;

	/**
	 * @param bool $enabled
	 * @param array $keys
	 * @return PageOwnedPilot
	 */
	private function configure( bool $enabled, array $keys ): PageOwnedPilot {
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => $enabled,
			'LayersPageOwnedPilotOwners' => $keys ] );
		$pilot = null;
		$this->overrideConfigValue( 'APIModules', $this->getServiceContainer()->getMainConfig()->get( 'APIModules' ) + [
			'layerspublish' => [ 'class' => ApiLayersPublish::class,
				'factory' => static function ( $main, $name ) use ( &$pilot ) {
					return $pilot->newPublishApi( $main, $name );
				} ],
			'layersread' => [ 'class' => ApiLayersRead::class,
				'factory' => static function ( $main, $name ) use ( &$pilot ) {
					return $pilot->newReadApi( $main, $name );
				} ]
		] );
		TestingAdmissionRegistration::install( $this );
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->setTemporaryHook( 'MultiContentSave', $pilot->newAdmissionHooks(), true );
		$this->pilot = $pilot;
		return $pilot;
	}

	/**
	 * Shared legacy storage serving one slide row; `getLatestLayerSet` is what an unqualified slide displays.
	 * @param string|null $blob Replacement JSON blob
	 * @return array Legacy row
	 */
	private function legacy( ?string $blob = null ): array {
		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/adoption/slide-falsy-zero.json' ), true );
		$row = $fixture['legacyRecord']['database']['row'];
		$record = [ 'id' => 202, 'imgName' => $row['ls_img_name'], 'sha1' => $row['ls_img_sha1'],
			'mime' => 'application/x-layers-slide', 'name' => $row['ls_name'], 'page' => $row['ls_page'],
			'revision' => $row['ls_revision'], 'timestamp' => $row['ls_timestamp'],
			'json' => $blob ?? $row['ls_json_blob'] ];
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'getLayerSetForAdoption' )->willReturnCallback(
			static fn ( int $id ) => $id === 202 ? $record : null );
		$db->method( 'getLatestLayerSet' )->willReturnCallback( static fn ( string $name ) =>
			$name === 'Slide:WelcomePresentation' ? [ 'id' => 202, 'name' => $row['ls_name'] ] : null );
		// The by-name lookup reports the name under a different key; both shapes must be understood.
		$db->method( 'getLayerSetByName' )->willReturnCallback( static fn ( string $name, string $sha1, string $set ) =>
			$name === 'Slide:WelcomePresentation' && $set === $row['ls_name'] ?
				[ 'id' => 202, 'setName' => $row['ls_name'] ] : null );
		$this->setService( 'LayersDatabase', $db );
		return $row;
	}

	/**
	 * @return array [ page, actor, base revision ID, pilot ]
	 */
	private function sharedSlidePage(): array {
		$page = $this->getExistingTestPage();
		$this->editPage( $page, self::PREFIX . self::EMBED );
		$pilot = $this->configure( true, [ $page->getTitle()->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$base = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle() )->getId();
		return [ $page, $actor, $base, $pilot ];
	}

	/**
	 * @param int $pageId
	 * @return int
	 */
	private function revisionCount( int $pageId ): int {
		return (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->where( [ 'rev_page' => $pageId ] )->caller( __METHOD__ )->fetchField();
	}

	/**
	 * @param User $actor
	 * @param array $params
	 * @param bool $posted
	 * @param bool $withToken
	 * @param string $language
	 * @return RequestContext
	 */
	private function visit( User $actor, array $params, bool $posted = false, bool $withToken = true,
		string $language = 'en'
	): RequestContext {
		$request = new FauxRequest( $params, $posted );
		$context = new RequestContext();
		$context->setRequest( $request );
		$context->setUser( $actor );
		$context->setTitle( SpecialAdoptLayersDrawing::getTitleFor( 'AdoptLayersDrawing' ) );
		$context->setLanguage( $language );
		if ( $posted && $withToken ) {
			$request->setVal( 'wpEditToken', $context->getCsrfTokenSet()->getToken()->toString() );
		}
		$services = $this->getServiceContainer();
		$special = new SpecialAdoptLayersDrawing( $this->pilot, $services->getTitleFactory() );
		$special->setContext( $context );
		$special->execute( null );
		return $context;
	}

	public function testCandidatesAndPreviewDescribeTheDisplayedSetWithoutWriting(): void {
		[ $page, $actor, $base, $pilot ] = $this->sharedSlidePage();
		$row = $this->legacy();
		$before = $this->revisionCount( $page->getId() );
		$candidates = $pilot->listAdoptionCandidates( $page->getId(), $base, $actor );
		$this->assertSame( [ [ 'label' => 'WelcomePresentation', 'setName' => $row['ls_name'], 'params' => [
			'pageid' => $page->getId(), 'revid' => $base, 'start' => strlen( self::PREFIX ),
			'expected' => self::EMBED, 'legacyrev' => 202 ] ] ], $candidates );
		$preview = $pilot->previewDirectAdoption( $page->getId(), $base, strlen( self::PREFIX ), self::EMBED, 202,
			$actor );
		$this->assertTrue( $page->getTitle()->equals( $preview['owner'] ) );
		$this->assertSame( [ 'WelcomePresentation', $row['ls_name'], (int)$row['ls_revision'] ],
			[ $preview['label'], $preview['setName'], $preview['revision'] ] );
		$this->assertSame( [], $pilot->listAdoptionCandidates( $page->getId(), $base,
			$this->getServiceContainer()->getUserFactory()->newAnonymous() ) );
		$this->assertSame( $before, $this->revisionCount( $page->getId() ) );
	}

	public function testPilotPageOffersAdoptionOnlyToEditorsOfTheCurrentRevision(): void {
		$this->overrideConfigValue( 'LayersSlidesEnable', true );
		[ $page, $actor, $base, $pilot ] = $this->sharedSlidePage();
		$this->legacy();
		$title = $page->getTitle();
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( self::PREFIX . self::EMBED,
			$title, ParserOptions::newFromAnon(), true, true, $base );
		$this->assertTrue( $parsed->getExtensionData( BoundSlideHooks::ADOPTABLE_KEY ) );
		$reader = $this->getTestUser( [ 'read' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$html = [];
		$styles = [];
		foreach ( [ 'editor' => [ $actor, [] ], 'reader' => [ $reader, [] ],
			'history' => [ $actor, [ 'oldid' => (string)$base ] ] ] as $case => [ $user, $query ]
		) {
			$context = new RequestContext();
			$context->setTitle( $title );
			$context->setUser( $user );
			$context->setRequest( new FauxRequest( $query ) );
			$out = new OutputPage( $context );
			$out->setRevisionId( $base );
			BoundSlideHooks::output( $out, $parsed, $pilot );
			$html[$case] = $out->getHTML();
			$styles[$case] = $out->getModuleStyles();
		}
		$this->assertStringContainsString( 'layers-page-adopt-link', $html['editor'] );
		$this->assertStringContainsString( 'aria-labelledby="layers-page-edit-controls-heading"', $html['editor'] );
		$this->assertStringContainsString( 'id="layers-page-edit-controls-heading"', $html['editor'] );
		$this->assertStringContainsString( 'role="heading" aria-level="2"', $html['editor'] );
		$this->assertContains( 'ext.layers.pageControls.styles', $styles['editor'] );
		$this->assertNotContains( 'ext.layers.pageControls.styles', $styles['reader'] );
		$this->assertStringContainsString( 'Special:AdoptLayersDrawing', $html['editor'] );
		$this->assertStringContainsString( 'legacyrev=202', $html['editor'] );
		$this->assertStringContainsString( 'revid=' . $base, $html['editor'] );
		$this->assertStringNotContainsString( 'layers-page-adopt-link', $html['reader'] . $html['history'] );
		$this->assertStringNotContainsString( 'layers-page-adopt-link', json_encode( $parsed->toJsonArray() ) );
	}

	public function testExplicitSelectorsAreOfferedOnlyForTheirOwnSet(): void {
		[ $page, $actor ] = $this->sharedSlidePage();
		$row = $this->legacy();
		$named = '{{#Slide:WelcomePresentation|layerset=' . $row['ls_name'] . '}}';
		$text = self::PREFIX . $named . "\n{{#Slide:WelcomePresentation|layerset=Missing}}";
		$this->editPage( $page, $text );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$candidates = $this->pilot->listAdoptionCandidates( $page->getId(), $revision->getId(), $actor );
		$this->assertCount( 1, $candidates );
		$this->assertSame( [ $row['ls_name'], $named, 202 ], [ $candidates[0]['setName'],
			$candidates[0]['params']['expected'], $candidates[0]['params']['legacyrev'] ] );
		// A displayed revision that is no longer current offers nothing.
		$this->editPage( $page, $text . "\nLater" );
		$this->assertSame( [], $this->pilot->listAdoptionCandidates( $page->getId(), $revision->getId(), $actor ) );
	}

	public function testRowThatIsNoLongerDisplayedIsNotAdopted(): void {
		[ $page, $actor, $base, $pilot ] = $this->sharedSlidePage();
		$this->legacy();
		try {
			$pilot->previewDirectAdoption( $page->getId(), $base, strlen( self::PREFIX ), self::EMBED, 203, $actor );
			$this->fail( 'Expected unavailable legacy row' );
		} catch ( PublicationException $e ) {
			$this->assertNotSame( '', $e->getMessage() );
		}
	}

	public function testConfirmationPageShowsOnGetAndAdoptsOnTokenPost(): void {
		[ $page, $actor, $base ] = $this->sharedSlidePage();
		$this->legacy();
		$params = [ 'pageid' => (string)$page->getId(), 'revid' => (string)$base,
			'start' => (string)strlen( self::PREFIX ), 'expected' => self::EMBED, 'legacyrev' => '202' ];
		$before = $this->revisionCount( $page->getId() );

		$shown = $this->visit( $actor, $params )->getOutput();
		$this->assertStringContainsString( 'WelcomePresentation', $shown->getHTML() );
		$this->assertStringContainsString( 'name="wpEditToken"', $shown->getHTML() );
		$this->assertMatchesRegularExpression( '/<a href="' . preg_quote( $page->getTitle()->getLocalURL(), '/' ) .
			'"[^>]*role="button"/', $shown->getHTML(), 'Cancel returns' );
		$this->assertContains( 'mediawiki.htmlform.codex.styles', $shown->getModuleStyles() );
		$this->assertSame( '', $shown->getRedirect() );

		$refused = $this->visit( $actor, $params + [ 'wpsummary' => 'No token' ], true, false )->getOutput();
		$this->assertSame( '', $refused->getRedirect() );
		$this->assertSame( $before, $this->revisionCount( $page->getId() ) );

		$done = $this->visit( $actor, $params + [ 'wpsummary' => 'Owned now' ], true )->getOutput();
		$this->assertSame( $page->getTitle()->getFullURL(), $done->getRedirect() );
		$this->assertSame( $before + 1, $this->revisionCount( $page->getId() ) );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $base, $revision->getParentId() );
		$this->assertSame( 'Owned now', $revision->getComment()->text );
		$this->assertTrue( $revision->hasSlot( 'layers' ) );
		$this->assertMatchesRegularExpression( '/^' . preg_quote( self::PREFIX, '/' ) .
			'\{\{#Slide:WelcomePresentation\|width=400\|layersbinding=v1:' . $page->getId() . ':[^|}]+\}\}$/D',
			$revision->getContent( 'main' )->getText() );

		$repeat = $this->visit( $actor, $params + [ 'wpsummary' => 'Again' ], true, true, 'qqx' )->getOutput();
		$this->assertSame( '', $repeat->getRedirect() );
		$this->assertStringContainsString( '(layers-adopt-conflict', $repeat->getHTML() );
		$this->assertStringContainsString( 'cdx-message--error', $repeat->getHTML() );
		$this->assertContains( 'mediawiki.codex.messagebox.styles', $repeat->getModuleStyles() );
		$this->assertStringContainsString( '(returnto:', $repeat->getHTML() );
		$this->assertSame( $before + 1, $this->revisionCount( $page->getId() ) );
		$this->assertSame( [], $this->pilot->listAdoptionCandidates( $page->getId(), $revision->getId(), $actor ) );
	}

	public function testMarkerDrawingIsOfferedAndMalformedRequestsAreRefused(): void {
		[ $page, $actor, $base ] = $this->sharedSlidePage();
		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/adoption/slide-falsy-zero.json' ), true );
		$blob = json_decode( $fixture['legacyRecord']['database']['row']['ls_json_blob'], true );
		$blob['layers'][] = [ 'id' => 'marker_1', 'type' => 'marker', 'x' => 5, 'y' => 5, 'text' => '1' ];
		$this->legacy( json_encode( $blob ) );
		$params = [ 'pageid' => (string)$page->getId(), 'revid' => (string)$base,
			'start' => (string)strlen( self::PREFIX ), 'expected' => self::EMBED, 'legacyrev' => '202' ];
		$before = $this->revisionCount( $page->getId() );
		$html = $this->visit( $actor, $params, false, true, 'qqx' )->getOutput()->getHTML();
		$this->assertStringContainsString( 'wpEditToken', $html );
		$this->assertStringNotContainsString( '(layers-adopt-not-renderable', $html );
		foreach ( [ [ 'pageid' => '0' . $page->getId() ], [ 'start' => '-1' ], [ 'legacyrev' => 'latest' ],
			[ 'expected' => str_repeat( 'x', 4097 ) ] ] as $change
		) {
			$html = $this->visit( $actor, array_replace( $params, $change ), true, true, 'qqx' )
				->getOutput()->getHTML();
			$this->assertStringContainsString( '(layers-adopt-unavailable-generic', $html );
			$this->assertStringNotContainsString( '(returnto:', $html );
		}
		$this->assertSame( $before, $this->revisionCount( $page->getId() ) );
		$this->expectException( UserNotLoggedIn::class );
		$this->visit( $this->getServiceContainer()->getUserFactory()->newAnonymous(), $params );
	}

	/**
	 * A shared file drawing on a pilot page, shown by an explicit set for the current file version.
	 * @param array $layers Legacy layers
	 * @param string $name File name
	 * @param string $fixture Asset fixture
	 * @param int $filePage Page of a multi-page file
	 * @return array [ page, actor, base revision ID, file, embed prefix, embed ]
	 */
	private function sharedFilePage( array $layers, string $name = 'Shared_adoption.png',
		string $fixture = 'test-image.png', int $filePage = 1
	): array {
		$fileTitle = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:' . $name );
		$file = $this->getServiceContainer()->getRepoGroup()->getLocalRepo()->newFile( $fileTitle );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/' . $fixture, 'Fixture', '',
			0, false, '20260906120000', $this->getTestSysop()->getUser() ) );
		$record = [ 'id' => 301, 'imgName' => $name, 'sha1' => $file->getSha1(), 'mime' => $file->getMimeType(),
			'name' => 'default', 'page' => $filePage, 'revision' => 4, 'timestamp' => '20260906130000',
			'json' => json_encode( [ 'revision' => 4, 'ownerId' => 1, 'schema' => 1, 'created' => '20260906130000',
				'layers' => $layers, 'backgroundVisible' => true, 'backgroundOpacity' => 1 ] ) ];
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'getLayerSetForAdoption' )->willReturnCallback(
			static fn ( int $id ) => $id === 301 ? $record : null );
		$db->method( 'getLayerSetByName' )->willReturnCallback(
			static fn ( string $img, string $sha1, string $set, int $page = 1 ) =>
				$img === $name && $sha1 === $record['sha1'] && $set === 'default' && $page === $filePage ?
					[ 'id' => 301, 'setName' => 'default', 'page' => $filePage ] : null );
		$prefix = "Photo:\n\n";
		$embed = '[[File:' . $name . ( $filePage > 1 ? '|page=' . $filePage : '' ) .
			'|120px|layerset=default|Shared photo]]';
		$page = $this->getExistingTestPage();
		$this->editPage( $page, $prefix . $embed );
		$this->configure( true, [ $page->getTitle()->getPrefixedDBkey() ] );
		$this->setService( 'LayersDatabase', $db );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$base = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle() )->getId();
		return [ $page, $actor, $base, $file, $prefix, $embed ];
	}

	public function testSharedFileDrawingIsAdoptedPinnedToTheCurrentFileVersion(): void {
		[ $page, $actor, $base, $file, $prefix, $embed ] = $this->sharedFilePage( [
			[ 'id' => 'note', 'type' => 'text', 'x' => 0, 'y' => 0, 'text' => 'Shared note' ]
		] );
		$candidates = $this->pilot->listAdoptionCandidates( $page->getId(), $base, $actor );
		$this->assertSame( [ [ 'label' => 'Shared adoption.png', 'setName' => 'default', 'params' => [
			'pageid' => $page->getId(), 'revid' => $base, 'start' => strlen( $prefix ), 'expected' => $embed,
			'legacyrev' => 301, 'filets' => $file->getTimestamp() ] ] ], $candidates );
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse( $prefix . $embed,
			$page->getTitle(), ParserOptions::newFromAnon(), true, true, $base );
		$this->assertTrue( $parsed->getExtensionData( BoundSlideHooks::ADOPTABLE_KEY ) );
		$context = new RequestContext();
		$context->setTitle( $page->getTitle() );
		$context->setUser( $actor );
		$out = new OutputPage( $context );
		$out->setRevisionId( $base );
		BoundSlideHooks::output( $out, $parsed, $this->pilot );
		$this->assertStringContainsString( 'Make “Shared adoption.png” owned by this page', $out->getHTML() );
		$this->assertStringContainsString( 'filets=' . $file->getTimestamp(), $out->getHTML() );
		$params = array_map( 'strval', $candidates[0]['params'] );
		$before = $this->revisionCount( $page->getId() );
		$shown = $this->visit( $actor, $params, false, true, 'qqx' )->getOutput()->getHTML();
		$this->assertStringContainsString( '(layers-adopt-intro: Shared adoption.png, default, 4, ', $shown );
		$this->assertStringContainsString( '(layers-adopt-file-version: File:Shared adoption.png)', $shown );
		$this->assertStringContainsString( '<input name="filets" type="hidden" value="' . $file->getTimestamp() . '">',
			$shown );
		$this->assertSame( $before, $this->revisionCount( $page->getId() ) );

		$done = $this->visit( $actor, $params + [ 'wpsummary' => 'Own the photo drawing' ], true )->getOutput();
		$this->assertSame( $page->getTitle()->getFullURL(), $done->getRedirect() );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $before + 1, $this->revisionCount( $page->getId() ) );
		$this->assertMatchesRegularExpression( '/^' . preg_quote( $prefix, '/' ) .
			'\\[\\[File:Shared_adoption\\.png\\|120px\\|layersbinding=v1:' . $page->getId() .
			':[A-Za-z0-9_-]+\\|Shared photo\\]\\]$/D', $revision->getContent( 'main' )->getText() );
		$surface = json_decode( $revision->getContent( 'layers' )->getText(), true )['surfaces'][0];
		$this->assertSame( 'image', $surface['kind'] );
		$this->assertSame( [ 'File:Shared_adoption.png', $file->getTimestamp(), $file->getSha1(), 1 ], [
			$surface['source']['fileTitle'], $surface['source']['timestamp'], $surface['source']['sha1'],
			$surface['source']['page'] ] );
		$this->assertSame( 'Shared note', $surface['layers'][0]['text'] );
		$this->assertSame( [], $this->pilot->listAdoptionCandidates( $page->getId(), $revision->getId(), $actor ) );
	}

	public function testFileAdoptionOffersMarkersAndRefusesAWrongVersion(): void {
		[ $page, $actor, $base, $file ] = $this->sharedFilePage( [
			[ 'id' => 'pin', 'type' => 'marker', 'x' => 5, 'y' => 5, 'text' => '1' ]
		] );
		$candidate = $this->pilot->listAdoptionCandidates( $page->getId(), $base, $actor )[0];
		$params = array_map( 'strval', $candidate['params'] );
		$before = $this->revisionCount( $page->getId() );
		$html = $this->visit( $actor, $params, false, true, 'qqx' )->getOutput()->getHTML();
		$this->assertStringContainsString( 'wpEditToken', $html );
		$this->assertStringNotContainsString( '(layers-adopt-not-renderable', $html );
		foreach ( [ '20250101000000', '2026090612000', 'latest' ] as $version ) {
			$html = $this->visit( $actor, array_replace( $params, [ 'filets' => $version ] ), true, true, 'qqx' )
				->getOutput()->getHTML();
			$this->assertStringNotContainsString( 'wpEditToken', $html, $version );
		}
		$this->assertSame( $before, $this->revisionCount( $page->getId() ) );
	}

	public function testFileAdoptionOpenedBeforeAReuploadIsRefused(): void {
		[ $page, $actor, $base, $file ] = $this->sharedFilePage( [
			[ 'id' => 'note', 'type' => 'text', 'x' => 0, 'y' => 0, 'text' => 'Shared note' ]
		] );
		$candidate = $this->pilot->listAdoptionCandidates( $page->getId(), $base, $actor )[0];
		$params = array_map( 'strval', $candidate['params'] );
		$replacement = $this->getServiceContainer()->getRepoGroup()->getLocalRepo()->newFile( $file->getTitle() );
		$this->assertStatusGood( $replacement->upload( __DIR__ . '/../../fixtures/assets/test-image-replacement.png',
			'Replacement', '', 0, false, '20260907120000', $this->getTestSysop()->getUser() ) );
		$before = $this->revisionCount( $page->getId() );
		// The old version still exists and matches the saved set, but the page no longer shows it.
		$html = $this->visit( $actor, $params, false, true, 'qqx' )->getOutput()->getHTML();
		$this->assertStringContainsString( '(layers-adopt-unavailable', $html );
		$html = $this->visit( $actor, $params + [ 'wpsummary' => 'Stale' ], true, true, 'qqx' )->getOutput()->getHTML();
		$this->assertStringContainsString( '(layers-adopt-unavailable', $html );
		$this->assertSame( $before, $this->revisionCount( $page->getId() ) );
		$this->assertSame( [], $this->pilot->listAdoptionCandidates( $page->getId(), $base, $actor ) );
	}

	public function testPdfPageDrawingIsAdoptedOnThatPageOfTheCurrentVersion(): void {
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		[ $page, $actor, $base, $file, $prefix, $embed ] = $this->sharedFilePage( [
			[ 'id' => 'box', 'type' => 'rectangle', 'x' => 10, 'y' => 10, 'width' => 40, 'height' => 30 ]
		], 'Shared_adoption.pdf', 'test-multipage.pdf', 2 );
		$this->assertSame( 'application/pdf', $file->getMimeType() );
		$candidates = $this->pilot->listAdoptionCandidates( $page->getId(), $base, $actor );
		$this->assertCount( 1, $candidates );
		$this->assertSame( [ 'Shared adoption.pdf', strlen( $prefix ), $embed, $file->getTimestamp() ], [
			$candidates[0]['label'], $candidates[0]['params']['start'], $candidates[0]['params']['expected'],
			$candidates[0]['params']['filets'] ] );
		$adopted = $this->pilot->adoptDirectEmbedding( $page->getId(), $base, strlen( $prefix ), $embed, 301,
			$file->getTimestamp(), $actor, 'Own page two' );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $adopted['revisionId'] );
		$this->assertSame( $prefix . '[[File:Shared_adoption.pdf|page=2|120px|layersbinding=' . $adopted['binding'] .
			'|Shared photo]]', $revision->getContent( 'main' )->getText() );
		$surface = json_decode( $revision->getContent( 'layers' )->getText(), true )['surfaces'][0];
		$this->assertSame( [ 'pdf', 2, $file->getTimestamp() ], [ $surface['kind'], $surface['source']['page'],
			$surface['source']['timestamp'] ] );
		// The canvas is that page's geometry, not page one's: page two of the fixture is portrait.
		$this->assertSame( [ $file->getWidth( 2 ), $file->getHeight( 2 ) ],
			[ $surface['canvas']['width'], $surface['canvas']['height'] ] );
		$this->assertLessThan( $surface['canvas']['height'], $surface['canvas']['width'] );
		$view = $this->pilot->prepareViewer( $page->getTitle()->getPrefixedText(), $adopted['revisionId'],
			$adopted['surfaceId'], $actor );
		$this->assertStringContainsString( 'page2-', $view['source']['url'] );
	}
}
