<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
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
		}
		$this->assertStringContainsString( 'layers-page-adopt-link', $html['editor'] );
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

		$repeat = $this->visit( $actor, $params + [ 'wpsummary' => 'Again' ], true )->getOutput();
		$this->assertSame( '', $repeat->getRedirect() );
		$this->assertSame( $before + 1, $this->revisionCount( $page->getId() ) );
		$this->assertSame( [], $this->pilot->listAdoptionCandidates( $page->getId(), $revision->getId(), $actor ) );
	}

	public function testUnrenderableDrawingAndMalformedRequestsAreRefused(): void {
		[ $page, $actor, $base ] = $this->sharedSlidePage();
		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/adoption/slide-falsy-zero.json' ), true );
		$blob = json_decode( $fixture['legacyRecord']['database']['row']['ls_json_blob'], true );
		$blob['layers'][] = [ 'id' => 'marker_1', 'type' => 'marker', 'x' => 5, 'y' => 5, 'text' => '1' ];
		$this->legacy( json_encode( $blob ) );
		$params = [ 'pageid' => (string)$page->getId(), 'revid' => (string)$base,
			'start' => (string)strlen( self::PREFIX ), 'expected' => self::EMBED, 'legacyrev' => '202' ];
		$before = $this->revisionCount( $page->getId() );
		$output = $this->visit( $actor, $params + [ 'wpsummary' => 'Refuse' ], true, true, 'qqx' )->getOutput();
		$this->assertStringContainsString( '(layers-adopt-not-renderable', $output->getHTML() );
		$this->assertStringNotContainsString( 'wpEditToken', $output->getHTML() );
		foreach ( [ [ 'pageid' => '0' . $page->getId() ], [ 'start' => '-1' ], [ 'legacyrev' => 'latest' ],
			[ 'expected' => str_repeat( 'x', 4097 ) ] ] as $change
		) {
			$html = $this->visit( $actor, array_replace( $params, $change ), true, true, 'qqx' )
				->getOutput()->getHTML();
			$this->assertStringContainsString( '(layers-adopt-unavailable-generic', $html );
		}
		$this->assertSame( $before, $this->revisionCount( $page->getId() ) );
	}
}
