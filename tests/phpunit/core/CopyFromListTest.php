<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\SpecialPages\SpecialCopyLayersDrawing;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * The editor's list of other pages' drawings, and copying one of them as a new drawing of this page (D1, HIST-5).
 * @covers \MediaWiki\Extension\Layers\Revision\DrawingCatalog
 * @covers \MediaWiki\Extension\Layers\Revision\PageDrawingCopy
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersDrawings
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialCopyLayersDrawing
 * @group Database
 * @group API
 */
class CopyFromListTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
		$this->setContentLang( 'en' );
	}

	/**
	 * @param string $name
	 * @return array [ Title, publication revision, document JSON ]
	 */
	private function pageWithDrawing( string $name ): array {
		$fixture = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$title = Title::newFromText( $name );
		$revision = $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(),
			'baserevid' => 0, 'data' => $fixture, 'maintext' => 'Text of ' . $name ], null, $this->actor )[0]
			['layerspublish']['revid'];
		return [ $title, $revision, $fixture ];
	}

	private function latest( Title $title ): int {
		return $title->getLatestRevID( IDBAccessObject::READ_LATEST );
	}

	public function testTheListOffersOtherPagesDrawingsToPeopleWhoCanReadThem(): void {
		[ $source, $sourceRev ] = $this->pageWithDrawing( 'Copy list source' );
		[ $other ] = $this->pageWithDrawing( 'Copy list other' );
		[ $target ] = $this->pageWithDrawing( 'Copy list target' );
		$targetId = $target->getArticleID();

		$found = $this->pilot->searchDrawings( 'Copy list s', $targetId, 10, $this->actor );
		$this->assertSame( [ [ $source->getPrefixedText(), $source->getArticleID(), $sourceRev ] ],
			array_map( static fn ( $p ) => [ $p['title']->getPrefixedText(), $p['pageId'], $p['revisionId'] ],
				$found ) );
		$this->assertSame( [ [ 'Welcome Slide', 'slide' ] ],
			array_map( static fn ( $d ) => [ $d['label'], $d['kind'] ], $found[0]['drawings'] ) );

		// Empty search lists recent pages; the page being edited and pages without a match are left out.
		$all = array_map( static fn ( $p ) => $p['title']->getPrefixedText(),
			$this->pilot->searchDrawings( '', $targetId, 10, $this->actor ) );
		$this->assertContains( $source->getPrefixedText(), $all );
		$this->assertContains( $other->getPrefixedText(), $all );
		$this->assertNotContains( $target->getPrefixedText(), $all );
		$this->assertSame( [], $this->pilot->searchDrawings( 'No such prefix', $targetId, 10, $this->actor ) );
		$this->assertCount( 1, $this->pilot->searchDrawings( '', $targetId, 1, $this->actor ) );

		// A page the reader may not read is not listed, and is not reported as missing either.
		$this->setTemporaryHook( 'getUserPermissionsErrors',
			static function ( $title, $user, $action, &$result ) use ( $source ) {
				if ( $action === 'read' && $title->equals( $source ) ) {
					$result = false;
					return false;
				}
				return true;
			} );
		$this->assertSame( [], $this->pilot->searchDrawings( 'Copy list s', $targetId, 10, $this->actor ) );
		$this->assertSame( [], $this->pilot->searchDrawings( 'Copy list s', $targetId, 10,
			$this->getServiceContainer()->getUserFactory()->newAnonymous() ) );
	}

	public function testAPickedDrawingBecomesANewDrawingOfThisPageAndRecordsItsSource(): void {
		[ $source, $sourceRev, $fixture ] = $this->pageWithDrawing( 'Copy pick source' );
		[ $target ] = $this->pageWithDrawing( 'Copy pick target' );
		$targetId = $target->getArticleID();
		$sourceId = $source->getArticleID();
		$base = $this->latest( $target );
		$surfaceId = $this->pilot->searchDrawings( 'Copy pick s', $targetId, 10, $this->actor )[0]['drawings'][0]['id'];

		$preview = $this->pilot->previewListCopy( $targetId, $base, $sourceId, $surfaceId, $sourceRev, $this->actor );
		$this->assertSame( [ 'Welcome Slide 2', $sourceRev ], [ $preview['label'], $preview['sourceRevision'] ],
			'the target already has a drawing of that name' );
		$this->assertSame( $base, $this->latest( $target ), 'a preview writes nothing' );

		$copied = $this->pilot->copyListDrawing( $targetId, $base, $sourceId, $surfaceId, $sourceRev, $this->actor,
			'for the handout' );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $copied );
		$this->assertSame( 'Text of Copy pick target', $revision->getContent( 'main' )->getText(),
			'the page text is untouched' );
		$this->assertSame( 'Copied the layer set “Welcome Slide 2” from [[:' . $source->getPrefixedText() .
			"]] (revision $sourceRev): for the handout", $revision->getComment()->text );
		$surfaces = $this->surfaces( $revision );
		$original = json_decode( ( new LayersDocumentContent( $fixture ) )->getCanonicalText(), true )['surfaces'][0];
		$this->assertSame( [ 'Welcome Slide', 'Welcome Slide 2' ], array_column( $surfaces, 'label' ) );
		$this->assertSame( NewPageDrawing::surfaceId( $targetId, $base, 'Welcome Slide 2' ), $surfaces[1]['id'] );
		$this->assertSame( $original['layers'], $surfaces[1]['layers'] );
		$this->assertSame( $sourceRev, $this->latest( $source ), 'the source is unchanged' );

		// A stale confirmation, this page itself and a malformed drawing ID are refused.
		foreach ( [
			[ $targetId, $base, $sourceId, $surfaceId, 'layers-edit-conflict' ],
			[ $targetId, $copied, $targetId, $surfaceId, 'layers-copy-source-unavailable' ],
			[ $targetId, $copied, $sourceId, 'no such drawing', 'layers-copy-source-unavailable' ],
			[ $targetId, $copied, $sourceId, 'missing-drawing', 'layers-copy-source-unavailable' ]
		] as [ $page, $revisionId, $fromPage, $fromSurface, $code ] ) {
			try {
				$this->pilot->copyListDrawing( $page, $revisionId, $fromPage, $fromSurface, $sourceRev,
					$this->actor, '' );
				$this->fail( "Expected $code" );
			} catch ( PublicationException $e ) {
				$this->assertSame( $code, $e->getMessage() );
			}
		}
		$this->assertSame( $copied, $this->latest( $target ) );

		// Somebody who cannot read the source cannot copy it.
		$this->setTemporaryHook( 'getUserPermissionsErrors',
			static function ( $title, $user, $action, &$result ) use ( $source ) {
				if ( $action === 'read' && $title->equals( $source ) ) {
					$result = false;
					return false;
				}
				return true;
			} );
		$this->expectException( PublicationException::class );
		$this->pilot->copyListDrawing( $targetId, $copied, $sourceId, $surfaceId, $sourceRev, $this->actor, '' );
	}

	public function testTheListIsAnApiForEditorsOnly(): void {
		[ $source ] = $this->pageWithDrawing( 'Copy api source' );
		[ $target ] = $this->pageWithDrawing( 'Copy api target' );
		$result = $this->doApiRequest( [ 'action' => 'layersdrawings', 'search' => 'Copy api s',
			'exclude' => $target->getArticleID() ], null, false, $this->actor )[0]['layersdrawings']['pages'];
		$this->assertSame( [ $source->getPrefixedText(), $source->getArticleID() ],
			[ $result[0]['title'], $result[0]['pageid'] ] );
		$this->assertSame( [ 'Welcome Slide', 'slide' ],
			[ $result[0]['drawings'][0]['label'], $result[0]['drawings'][0]['kind'] ] );

		$this->expectApiErrorCode( 'permissiondenied' );
		$this->doApiRequest( [ 'action' => 'layersdrawings', 'search' => 'Copy api s' ], null, false,
			$this->getServiceContainer()->getUserFactory()->newAnonymous() );
	}

	public function testTheConfirmationPageTakesASourcePageAndDrawing(): void {
		[ $source, $sourceRev ] = $this->pageWithDrawing( 'Copy form source' );
		[ $target ] = $this->pageWithDrawing( 'Copy form target' );
		$surfaceId = $this->pilot->searchDrawings( 'Copy form s', $target->getArticleID(), 10, $this->actor )[0]
			['drawings'][0]['id'];
		$run = function ( array $params ) use ( $target ) {
			$context = new RequestContext();
			$request = new FauxRequest( $params );
			$request->setRequestURL( '/index.php' );
			$context->setRequest( $request );
			$context->setTitle( Title::newFromText( 'Special:CopyLayersDrawing' ) );
			$context->setUser( $this->actor );
			$context->setLanguage( 'en' );
			$special = new SpecialCopyLayersDrawing( $this->pilot, $this->getServiceContainer()->getTitleFactory() );
			$special->setContext( $context );
			$special->execute( '' );
			return $context->getOutput()->getHTML();
		};
		$params = [ 'pageid' => (string)$target->getArticleID(), 'sourcepage' => (string)$source->getArticleID(),
			'sourcesurface' => $surfaceId, 'sourcerev' => (string)$sourceRev ];
		$html = $run( $params );
		$this->assertStringContainsString( 'Welcome Slide 2', $html );
		$this->assertStringContainsString( 'name="revid" type="hidden" value="' . $this->latest( $target ) . '"',
			$html );
		$this->assertStringContainsString( 'name="sourcesurface" type="hidden" value="' . $surfaceId . '"', $html );

		$this->assertStringNotContainsString( 'name="sourcepage"',
			$run( [ 'sourcesurface' => 'x y' ] + $params ), 'a malformed drawing ID is refused' );
		$this->assertSame( $sourceRev, $this->latest( $source ) );
	}
}
