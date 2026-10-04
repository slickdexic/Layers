<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Publication owns complete file/name groups, including every retained PDF page.
 * Fixtures use the real guarded publisher; only upload availability is controlled.
 * Advances HIST-4 and HIST-7 without bypassing the multi-slot admission boundary.
 *
 * @covers \MediaWiki\Extension\Layers\Revision\PagePublicationService
 * @covers \MediaWiki\Extension\Layers\Revision\DrawingName
 * @covers \MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter
 * @group Database
 */
class ScopedPublicationTest extends \MediaWikiIntegrationTestCase {

	private PublicationAdmissionContext $context;
	private Authority $actor;

	protected function setUp(): void {
		parent::setUp();
		$this->context = TestingAdmissionRegistration::install( $this )['context'];
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor->getUser(),
			[ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
	}

	private function service( ?SourceVersionResolver $sources = null ): PagePublicationService {
		if ( $sources === null ) {
			$sources = $this->createMock( SourceVersionResolver::class );
			$sources->method( 'resolve' )->willReturn( [] );
		}
		$s = $this->getServiceContainer();
		return new PagePublicationService( $s->getWikiPageFactory(),
			new PageHistoryAccess( $s->getRevisionLookup() ), $sources, new PageRevisionWriter(),
			$this->context, $s->getHookContainer(), $s->getUserFactory() );
	}

	/**
	 * @param string $id Stable surface ID
	 * @param string $kind
	 * @param string $label
	 * @param string $file Canonical file title for file surfaces
	 * @param int $page
	 * @return array
	 */
	private function surface( string $id, string $kind = 'pdf', string $label = 'ABC',
		string $file = 'File:Publication_A.pdf', int $page = 1
	): array {
		$fixture = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ),
			true );
		$surface = $fixture['surfaces'][array_search( $kind, [ 'slide', 'image', 'pdf' ], true )];
		$surface['id'] = $id;
		$surface['label'] = $label;
		$surface['layers'][0]['text'] = 'Retain layers of ' . $id;
		if ( $kind !== 'slide' ) {
			$surface['source']['fileTitle'] = $file;
			$surface['source']['page'] = $page;
		}
		return $surface;
	}

	/** @return array */
	private function pdfPages(): array {
		$one = $this->surface( 'a-one' );
		$two = $this->surface( 'a-two', 'pdf', 'ABC', 'File:Publication_A.pdf', 2 );
		// Different retained upload pins and dimensions are data, not separate layer-set names.
		$two['source']['timestamp'] = '20260907120000';
		$two['source']['sha1'] = str_repeat( '2', 31 );
		$two['canvas']['width'] = 640;
		return [ $one, $two ];
	}

	/**
	 * @param array $surfaces
	 * @return string
	 */
	private function snapshot( array $surfaces ): string {
		return json_encode( [ 'schemaVersion' => 1, 'surfaces' => array_values( $surfaces ) ], JSON_THROW_ON_ERROR );
	}

	/**
	 * @param int $revisionId
	 * @return array
	 */
	private function surfaces( int $revisionId ): array {
		$content = $this->revision( $revisionId )->getContent( PageRevisionWriter::SLOT );
		$document = json_decode( $content->getText(), true );
		return array_column( $document['surfaces'], null, 'id' );
	}

	/**
	 * @param int $revisionId
	 * @return \MediaWiki\Revision\RevisionRecord
	 */
	private function revision( int $revisionId ) {
		return $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId );
	}

	/**
	 * @param int $revisionId
	 * @return string
	 */
	private function mainText( int $revisionId ): string {
		return $this->revision( $revisionId )->getContent( 'main' )->getText();
	}

	/**
	 * @param Title $owner
	 * @param int $revisionId
	 */
	private function assertStillCurrent( Title $owner, int $revisionId ): void {
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $owner );
		$this->assertSame( $revisionId, $current->getId() );
		$this->assertSame( $this->mainText( $revisionId ), $current->getContent( 'main' )->getText() );
		$this->assertSame( $this->revision( $revisionId )->getContent( PageRevisionWriter::SLOT )->getText(),
			$current->getContent( PageRevisionWriter::SLOT )->getText() );
	}

	public function testEqualLabelsAcrossFilesAndSlidePublishWithoutSuffixes(): void {
		$page = $this->getExistingTestPage();
		$surfaces = array_merge( $this->pdfPages(), [
			$this->surface( 'b-one', 'pdf', 'ABC', 'File:Publication_B.pdf' ),
			$this->surface( 'photo', 'image', 'ABC', 'File:Publication_photo.png' ),
			$this->surface( 'slide', 'slide' )
		] );
		$service = $this->service();
		$revision = $service->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'Distinct layer sets' );
		$this->assertEquals( array_column( $surfaces, null, 'id' ), $this->surfaces( $revision ) );
		$this->assertSame( [ 'ABC', 'ABC', 'ABC', 'ABC', 'ABC' ],
			array_values( array_column( $this->surfaces( $revision ), 'label' ) ) );
		$this->assertSame( $revision, $service->publish( $page->getTitle(), $this->actor, $revision,
			$this->snapshot( $surfaces ), 'No changes' ) );
	}

	public function testRenameExpandsPdfGroupBeforeAdmissionAndRewritesOnlyItsFile(): void {
		$page = $this->getExistingTestPage();
		$owner = $page->getTitle();
		$id = $page->getId();
		$otherId = $id + 100000;
		$surfaces = array_merge( $this->pdfPages(), [
			$this->surface( 'b-one', 'pdf', 'ABC', 'File:Publication_B.pdf' ),
			$this->surface( 'slide', 'slide' )
		] );
		$text = "[[File:Publication_A.pdf|page=1|layerset=$id:ABC|alt=ABC]]\n" .
			"[[Image:Publication_A.pdf|page=99|layers=$id:ABC]]\n" .
			"[[File:Publication_B.pdf|page=1|layerset=$id:ABC]]\n" .
			"{{#Slide:$id:ABC|width=400}}\n[[File:Publication_A.pdf|layerset=$otherId:ABC]]";
		$base = $this->service()->publish( $owner, $this->actor, $page->getLatest(), $this->snapshot( $surfaces ),
			'Publish groups', new WikitextContent( $text ) );
		$surfaces[1]['label'] = 'XYZ';
		$expected = $this->surfaces( $base );
		$expected['a-one']['label'] = 'XYZ';
		$expected['a-two']['label'] = 'XYZ';
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->once() )->method( 'resolve' )->willReturnCallback(
			function ( LayersDocumentContent $content, Authority $actor, ?array $changed ) use ( $expected ) {
				$this->assertEqualsCanonicalizing( [ 'a-one', 'a-two' ], $changed );
				$admitted = json_decode( $content->getText(), true )['surfaces'];
				$this->assertEquals( $expected, array_column( $admitted, null, 'id' ),
					'Every renamed PDF page, its layers, canvas and exact pin must reach source admission' );
				return [];
			} );
		$next = $this->service( $sources )->publish( $owner, $this->actor, $base,
			$this->snapshot( $surfaces ), 'Rename one PDF layer set' );
		$this->assertSame( $base, $this->revision( $next )->getParentId() );
		$this->assertEquals( $expected, $this->surfaces( $next ) );
		$this->assertSame( "[[File:Publication_A.pdf|page=1|layerset=$id:XYZ|alt=ABC]]\n" .
			"[[Image:Publication_A.pdf|page=99|layers=$id:XYZ]]\n" .
			"[[File:Publication_B.pdf|page=1|layerset=$id:ABC]]\n" .
			"{{#Slide:$id:ABC|width=400}}\n[[File:Publication_A.pdf|layerset=$otherId:ABC]]",
			$this->mainText( $next ) );
		$this->assertSame( $text, $this->mainText( $base ) );
		$this->assertSame( 'ABC', $this->surfaces( $base )['a-one']['label'] );
	}

	public function testSimultaneousSwapsUseOriginalPdfGroups(): void {
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$surfaces = array_merge( $this->pdfPages(), [
			$this->surface( 'other-three', 'pdf', 'Other', 'File:Publication_A.pdf', 3 ),
			$this->surface( 'other-four', 'pdf', 'Other', 'File:Publication_A.pdf', 4 )
		] );
		$service = $this->service();
		$base = $service->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'Two sets', new WikitextContent(
				"[[File:Publication_A.pdf|page=2|layerset=$id:ABC]] " .
				"[[File:Publication_A.pdf|page=4|layerset=$id:Other]]" ) );
		$surfaces[0]['label'] = 'Other';
		$surfaces[2]['label'] = 'ABC';
		$next = $service->publish( $page->getTitle(), $this->actor, $base,
			$this->snapshot( $surfaces ), 'Swap' );
		$expected = $this->surfaces( $base );
		foreach ( [ 'a-one', 'a-two' ] as $surfaceId ) {
			$expected[$surfaceId]['label'] = 'Other';
		}
		foreach ( [ 'other-three', 'other-four' ] as $surfaceId ) {
			$expected[$surfaceId]['label'] = 'ABC';
		}
		$this->assertEquals( $expected, $this->surfaces( $next ) );
		$this->assertSame( "[[File:Publication_A.pdf|page=2|layerset=$id:Other]] " .
			"[[File:Publication_A.pdf|page=4|layerset=$id:ABC]]", $this->mainText( $next ) );
	}

	public function testRenameCannotMergeExistingSetsEvenWhenTheirPdfPagesAreDisjoint(): void {
		$page = $this->getExistingTestPage();
		$surfaces = array_merge( $this->pdfPages(), [
			$this->surface( 'other-three', 'pdf', 'Other', 'File:Publication_A.pdf', 3 )
		] );
		$base = $this->service()->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'Two separate sets' );
		$surfaces[0]['label'] = 'Other';
		try {
			$this->service()->publish( $page->getTitle(), $this->actor, $base,
				$this->snapshot( $surfaces ), 'Must refuse merge', new WikitextContent( 'Must not commit' ) );
			$this->fail( 'A rename must not silently merge the contents of two existing layer sets' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-invalid-snapshot', $e->getMessage() );
		}
		$this->assertStillCurrent( $page->getTitle(), $base );
	}

	public function testConflictingRenameRequestsForOnePdfGroupRefuseBothSlots(): void {
		$page = $this->getExistingTestPage();
		$surfaces = $this->pdfPages();
		$base = $this->service()->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'One set' );
		$surfaces[0]['label'] = 'First';
		$surfaces[1]['label'] = 'Second';
		try {
			$this->service()->publish( $page->getTitle(), $this->actor, $base,
				$this->snapshot( $surfaces ), 'Conflicting renames', new WikitextContent( 'Must not commit' ) );
			$this->fail( 'One layer set cannot receive two explicit rename destinations' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-invalid-snapshot', $e->getMessage() );
		}
		$this->assertStillCurrent( $page->getTitle(), $base );
	}

	public function testNewPdfPageCanJoinASetButCannotDuplicateAnExistingPage(): void {
		$page = $this->getExistingTestPage();
		$surfaces = $this->pdfPages();
		$service = $this->service();
		$base = $service->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'Two pages' );
		$surfaces[] = $this->surface( 'a-three', 'pdf', 'ABC', 'File:Publication_A.pdf', 3 );
		$next = $service->publish( $page->getTitle(), $this->actor, $base,
			$this->snapshot( $surfaces ), 'Add third annotated page' );
		$this->assertEquals( array_column( $surfaces, null, 'id' ), $this->surfaces( $next ) );
		$surfaces[] = $this->surface( 'duplicate-two', 'pdf', 'abc', 'File:Publication_A.pdf', 2 );
		try {
			$service->publish( $page->getTitle(), $this->actor, $next,
				$this->snapshot( $surfaces ), 'Must refuse duplicate page' );
			$this->fail( 'Equivalent labels on the same file and PDF page are one occupied identity' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-invalid-snapshot', $e->getMessage() );
		}
		$this->assertStillCurrent( $page->getTitle(), $next );
	}

	public function testExpandedSiblingSourceRefusalAbortsBothSlots(): void {
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$surfaces = $this->pdfPages();
		$base = $this->service()->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'Original',
			new WikitextContent( "[[File:Publication_A.pdf|layerset=$id:ABC]]" ) );
		$surfaces[1]['label'] = 'XYZ';
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->once() )->method( 'resolve' )->willReturnCallback(
			static function ( LayersDocumentContent $content, Authority $actor, ?array $changed ) {
				if ( in_array( 'a-one', $changed, true ) ) {
					throw new \DomainException( 'layers-source-unavailable' );
				}
				return [];
			} );
		try {
			$this->service( $sources )->publish( $page->getTitle(), $this->actor, $base,
				$this->snapshot( $surfaces ), 'Rename',
				new WikitextContent( "Changed [[File:Publication_A.pdf|layerset=$id:ABC]]" ) );
			$this->fail( 'A sibling changed by group expansion must pass source validation too' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertStillCurrent( $page->getTitle(), $base );
	}

	public function testScannerRefusalCannotPublishRenamedGroupWithOldEmbeds(): void {
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$surfaces = $this->pdfPages();
		$base = $this->service()->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'Original',
			new WikitextContent( "[[File:Publication_A.pdf|layerset=$id:ABC]]" ) );
		$surfaces[0]['label'] = 'XYZ';
		try {
			$this->service()->publish( $page->getTitle(), $this->actor, $base,
				$this->snapshot( $surfaces ), 'Rename with unreadable source',
				new WikitextContent( "[[File:Publication_A.pdf|layerset=$id:ABC]] {{unclosed" ) );
			$this->fail( 'A required rename rewrite must not be silently skipped after scanner refusal' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-embedding-source-unavailable', $e->getMessage() );
		}
		$this->assertStillCurrent( $page->getTitle(), $base );
	}

	public function testAutomaticallyRewrittenMainTextStillPassesEditFilters(): void {
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$surfaces = $this->pdfPages();
		$base = $this->service()->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'Original',
			new WikitextContent( "[[File:Publication_A.pdf|layerset=$id:ABC]]" ) );
		$seen = [];
		$this->setTemporaryHook( 'EditFilterMergedContent',
			static function ( $context, $content, $status ) use ( &$seen ) {
				$seen[] = $content->getText();
				$status->fatal( 'spamprotectiontext' );
			} );
		$surfaces[0]['label'] = 'XYZ';
		try {
			$this->service()->publish( $page->getTitle(), $this->actor, $base,
				$this->snapshot( $surfaces ), 'Rename' );
			$this->fail( 'Automatic embed rewrites must not bypass ordinary edit filters' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-filtered', $e->getMessage() );
		}
		$this->assertSame( [ "[[File:Publication_A.pdf|layerset=$id:XYZ]]" ], $seen );
		$this->assertStillCurrent( $page->getTitle(), $base );
	}

	public function testCaseOnlyRenamePropagatesLabelAndKeepsCompatibleEmbedBytes(): void {
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$surfaces = $this->pdfPages();
		$text = "[[File:Publication_A.pdf|page=2|layerset=$id:ABC]]";
		$service = $this->service();
		$base = $service->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			$this->snapshot( $surfaces ), 'Original', new WikitextContent( $text ) );
		$surfaces[0]['label'] = 'abc';
		$next = $service->publish( $page->getTitle(), $this->actor, $base,
			$this->snapshot( $surfaces ), 'Adjust case' );
		$this->assertSame( [ 'abc', 'abc' ], array_values( array_column( $this->surfaces( $next ), 'label' ) ) );
		$this->assertSame( $text, $this->mainText( $next ) );
		$this->assertSame( $next, $service->publish( $page->getTitle(), $this->actor, $next,
			$this->snapshot( $this->surfaces( $next ) ), 'No change' ) );
	}

	public function testRenameExpansionOverDocumentLimitRefusesBeforeSourceAdmission(): void {
		$page = $this->getExistingTestPage();
		$surfaces = [];
		for ( $number = 1; $number <= 100; $number++ ) {
			$surface = $this->surface( 'pdf-' . $number, 'pdf', 'ABC', 'File:Publication_A.pdf', $number );
			$layer = $surface['layers'][0];
			$layer['text'] = 'x';
			$layer['name'] = 'x';
			$surface['layers'] = [];
			$surface['readingOrder'] = [];
			for ( $index = 0; $index < 10; $index++ ) {
				$layer['id'] = 'text-' . $index;
				$surface['layers'][] = $layer;
				$surface['readingOrder'][] = $layer['id'];
			}
			$surfaces[] = $surface;
		}
		$document = [ 'schemaVersion' => 1, 'surfaces' => $surfaces ];
		$remaining = DocumentSchema::MAX_BYTES - 1024 - strlen( JsonSnapshotCodec::encode( $document ) );
		// Both text and layer-name strings have a 1,000-byte bound. Fill those independently
		// to reach the document limit while keeping all 1,000 layers valid and nonempty.
		foreach ( $document['surfaces'] as &$surface ) {
			foreach ( $surface['layers'] as &$layer ) {
				foreach ( [ 'text', 'name' ] as $field ) {
					$bytes = min( 999, $remaining );
					$layer[$field] .= str_repeat( 'x', $bytes );
					$remaining -= $bytes;
				}
			}
			unset( $layer );
		}
		unset( $surface );
		$this->assertSame( 0, $remaining );
		$base = $this->service()->publish( $page->getTitle(), $this->actor, $page->getLatest(),
			JsonSnapshotCodec::encode( $document ), 'Large valid PDF set', new WikitextContent( 'Keep this text' ) );
		$document['surfaces'][0]['label'] = str_repeat( 'N', 255 );
		$submitted = JsonSnapshotCodec::encode( $document );
		$this->assertLessThan( DocumentSchema::MAX_BYTES, strlen( $submitted ) );
		$this->assertSame( $submitted, ( new LayersDocumentContent( $submitted ) )->getCanonicalText(),
			'The submitted snapshot itself must be valid; only expansion exceeds the limit' );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		try {
			$this->service( $sources )->publish( $page->getTitle(), $this->actor, $base,
				$submitted, 'Rename all PDF pages', new WikitextContent( 'Must not commit' ) );
			$this->fail( 'An expanded document over the byte limit must use the stable snapshot refusal' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-invalid-snapshot', $e->getMessage() );
		}
		$this->assertStillCurrent( $page->getTitle(), $base );
	}
}
