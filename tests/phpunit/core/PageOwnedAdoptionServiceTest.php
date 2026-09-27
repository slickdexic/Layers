<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedAdoptionService;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Revision\SlotRecord;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedAdoptionService
 * @group Database
 */
class PageOwnedAdoptionServiceTest extends \MediaWikiIntegrationTestCase {
	private PageOwnedAdoptionService $adoption;

	protected function setUp(): void {
		parent::setUp();
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$lookup = $s->getRevisionLookup();
		$this->adoption = new PageOwnedAdoptionService(
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $lookup, new PageHistoryAccess( $lookup ) ),
			$lookup, $registered['publisher'] );
	}

	private function addition( string $id ): string {
		$doc = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$doc->surfaces[0]->id = $id;
		return json_encode( $doc );
	}

	private function actor(): \MediaWiki\Permissions\Authority {
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		return $actor;
	}

	public function testAtomicAppendRetainsEarlierSurfaceAndHistoricalSnapshot(): void {
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$base = $page->getLatest();
		$actor = $this->actor();
		$first = $this->adoption->publishPreparedSurface( $id, $base, $actor, $this->addition( 'A' ),
			new WikitextContent( "{{#Slide:First|layersbinding=v1:$id:A}}" ), 'Adopt first' );
		$secondMain = "{{#Slide:First|layersbinding=v1:$id:A}}\n{{#Slide:Second|layersbinding=v1:$id:B}}";
		$second = $this->adoption->publishPreparedSurface( $id, $first, $actor, $this->addition( 'B' ),
			new WikitextContent( $secondMain ), 'Adopt second' );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$old = $lookup->getRevisionById( $first );
		$current = $lookup->getRevisionById( $second );
		$oldDoc = json_decode( $old->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$newDoc = json_decode( $current->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertCount( 1, $oldDoc['surfaces'] );
		$this->assertCount( 2, $newDoc['surfaces'] );
		$this->assertSame( $oldDoc['surfaces'][0], $newDoc['surfaces'][0] );
		$this->assertSame( [ 'A', 'B' ], array_column( $newDoc['surfaces'], 'id' ) );
		// The fixture gives both the same name; names are unique on a page.
		$this->assertSame( [ 'Welcome Slide', 'Welcome Slide 2' ], array_column( $newDoc['surfaces'], 'label' ) );
		$this->assertSame( $first, $current->getParentId() );
		$this->assertSame( $id, $current->getPageId() );
		$this->assertSame( $actor->getUser()->getId(), $current->getUser()->getId() );
		$this->assertSame( $secondMain, $current->getContent( SlotRecord::MAIN )->getText() );
		$this->assertFalse( $lookup->getRevisionById( $base )->hasSlot( PageRevisionWriter::SLOT ) );
	}

	/**
	 * @dataProvider provideRejectedAdditions
	 * @param string $reason
	 * @param string $code
	 */
	public function testRejectedAppendCannotChangeMainOrSnapshot( string $reason, string $code ): void {
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$actor = $this->actor();
		$originalBase = $page->getLatest();
		$first = $this->adoption->publishPreparedSurface( $id, $originalBase, $actor, $this->addition( 'A' ),
			new WikitextContent( "{{#Slide:First|layersbinding=v1:$id:A}}" ), 'First' );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$before = $lookup->getRevisionById( $first );
		$json = $reason === 'empty' ? '{"schemaVersion":1,"surfaces":[]}' : $this->addition( 'B' );
		if ( $reason === 'duplicate' ) {
			$json = $this->addition( 'A' );
		} elseif ( $reason === 'source' ) {
			$json = file_get_contents( __DIR__ . '/../../fixtures/adoption/image-text-callout.json' );
			$json = json_encode( json_decode( $json )->candidatePageOwnedSnapshot->document );
		}
		try {
			$this->adoption->publishPreparedSurface( $id, $reason === 'stale' ? $originalBase : $first,
				$actor, $json, new WikitextContent( 'Must not replace' ), 'Must reject' );
			$this->fail( 'Expected rejection' );
		} catch ( PublicationException $e ) {
			$this->assertSame( $code, $e->getMessage() );
		}
		$after = $lookup->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $first, $after->getId() );
		foreach ( [ SlotRecord::MAIN, PageRevisionWriter::SLOT ] as $slot ) {
			$this->assertSame( $before->getContent( $slot )->serialize(), $after->getContent( $slot )->serialize() );
		}
	}

	/** @return array */
	public static function provideRejectedAdditions(): array {
		return [
			[ 'duplicate', 'layers-surface-already-bound' ],
			[ 'empty', 'layers-invalid-snapshot' ],
			[ 'stale', 'layers-edit-conflict' ],
			[ 'source', 'layers-source-unavailable' ]
		];
	}
}
