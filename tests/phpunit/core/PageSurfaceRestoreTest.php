<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\SpecialPages\SpecialViewLayersPage;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use MediaWikiIntegrationTestCase;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * An editor makes an earlier version of one drawing current again from the historical viewer.
 * @covers \MediaWiki\Extension\Layers\Revision\PageSurfaceRestore
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialViewLayersPage
 * @group Database
 */
class PageSurfaceRestoreTest extends MediaWikiIntegrationTestCase {
	private function document( string $version ): string {
		$document = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$notes = clone $document->surfaces[0];
		$notes->id = 'notes';
		$notes->label = 'Notes';
		$notes->layers = [ (object)( (array)$document->surfaces[0]->layers[0] + [] ) ];
		$notes->layers[0]->text = "Notes $version";
		$document->surfaces[0]->layers[0]->text = "Drawing $version";
		$document->surfaces[] = $notes;
		return json_encode( $document );
	}

	/**
	 * @return array [ owner title, first revision, second revision, editor, pilot ]
	 */
	private function owner(): array {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ $title->getPrefixedDBkey() ] ] );
		$registered = TestingAdmissionRegistration::install( $this );
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$first = $registered['publisher']->publish( $title, $editor, 0, $this->document( 'one' ), 'First',
			new WikitextContent( 'Text one' ) );
		$second = $registered['publisher']->publish( $title, $editor, $first, $this->document( 'two' ), 'Second',
			new WikitextContent( 'Text two' ) );
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		// Restores go through the installed composition's own admission, as on a real wiki.
		$this->setTemporaryHook( 'MultiContentSave', $pilot->newAdmissionHooks(), true );
		return [ $title, $first, $second, $editor, $pilot ];
	}

	private function surfaces( int $revisionId ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId );
		$texts = [];
		foreach ( json_decode( $revision->getContent( 'layers' )->getText(), true )['surfaces'] as $surface ) {
			$texts[$surface['id']] = $surface['layers'][0]['text'];
		}
		return [ $revision->getContent( 'main' )->getText(), $texts ];
	}

	public function testEditorRestoresOneDrawingAndKeepsEverythingElse(): void {
		[ $title, $first, $second, $editor, $pilot ] = $this->owner();
		$restore = $pilot->newSurfaceRestore();
		$offer = $restore->prepare( $title->getPrefixedText(), $first, 'presentation', $editor );
		$this->assertSame( [ 'Welcome Slide', $second ], [ $offer['label'], $offer['baseRevisionId'] ] );
		$this->assertTrue( $title->equals( $offer['owner'] ) );
		// Nothing is offered for the current version, a missing drawing, or a reader.
		$this->assertNull( $restore->prepare( $title->getPrefixedText(), $second, 'presentation', $editor ) );
		$this->assertNull( $restore->prepare( $title->getPrefixedText(), $first, 'missing', $editor ) );
		$reader = $this->getTestUser( [ 'reader' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$this->assertNull( $restore->prepare( $title->getPrefixedText(), $first, 'presentation', $reader ) );

		$restored = $restore->restore( $title->getPrefixedText(), $first, 'presentation', $second, $editor,
			'Restore test' );
		$this->assertGreaterThan( $second, $restored );
		$this->assertSame( [ 'Text two', [ 'presentation' => 'Drawing one', 'notes' => 'Notes two' ] ],
			$this->surfaces( $restored ) );
		$this->assertContains( 'layers-page-drawing', $this->getServiceContainer()->getChangeTagsStore()
			->getTags( $this->getDb(), null, $restored ) );
		$this->assertNull( $restore->prepare( $title->getPrefixedText(), $first, 'presentation', $editor ) );

		// The form the editor saw is now stale; restoring from it changes nothing.
		try {
			$restore->restore( $title->getPrefixedText(), $first, 'notes', $second, $editor, 'Stale' );
			$this->fail( 'A stale restore was saved' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertSame( $restored, $title->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	private function visit( User $user, Title $title, int $revisionId, bool $posted = false,
		array $extra = []
	): RequestContext {
		$request = new FauxRequest( [ 'owner' => $title->getPrefixedText(), 'revid' => (string)$revisionId,
			'surface' => 'presentation' ] + $extra, $posted );
		$context = new RequestContext();
		$context->setRequest( $request );
		$context->setUser( $user );
		$context->setTitle( SpecialViewLayersPage::getTitleFor( 'ViewLayersPage' ) );
		$context->setLanguage( 'qqx' );
		if ( $posted ) {
			$request->setVal( 'wpEditToken', $context->getCsrfTokenSet()->getToken()->toString() );
		}
		/** @var PageOwnedPilot $pilot */
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$special = new SpecialViewLayersPage( $pilot );
		$special->setContext( $context );
		$special->execute( null );
		return $context;
	}

	public function testViewerOffersRestoreToEditorsAndSavesOnConfirmation(): void {
		[ $title, $first, $second, $editor ] = $this->owner();
		$html = $this->visit( $editor, $title, $first )->getOutput()->getHTML();
		$this->assertStringContainsString( '(layers-page-restore-intro: Welcome Slide, ', $html );
		$this->assertStringContainsString( '(layers-page-restore-submit)', $html );
		$this->assertStringContainsString( 'name="wpbase" type="hidden" value="' . $second . '"', $html );
		$this->assertStringNotContainsString( 'layers-page-restore-submit',
			$this->visit( $editor, $title, $second )->getOutput()->getHTML() );
		$this->assertSame( $second, $title->getLatestRevID( IDBAccessObject::READ_LATEST ) );

		$done = $this->visit( $editor, $title, $first, true, [ 'wpbase' => (string)$second ] )->getOutput();
		$this->assertSame( $title->getFullURL(), $done->getRedirect() );
		$latest = $title->getLatestRevID( IDBAccessObject::READ_LATEST );
		$this->assertSame( [ 'Text two', [ 'presentation' => 'Drawing one', 'notes' => 'Notes two' ] ],
			$this->surfaces( $latest ) );
		$comment = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $latest )->getComment();
		$this->assertSame( 'Restored the drawing “Welcome Slide” from revision ' . $first, $comment->text );

		// Submitting the same form again is refused and saves nothing.
		$again = $this->visit( $editor, $title, $first, true, [ 'wpbase' => (string)$second ] )->getOutput();
		$this->assertStringContainsString( '(layers-page-restore-unavailable)', $again->getHTML() );
		$this->assertSame( $latest, $title->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}
}
