<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Real uploads, editor preparation and guarded publication for file-scoped layer sets.
 * @covers \MediaWiki\Extension\Layers\Revision\NewPageDrawing
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Revision\PageDrawingCopy
 * @covers \MediaWiki\Extension\Layers\Revision\DirectAdoptionPreparationService
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedAdoptionService
 * @group Database
 * @group API
 */
class ScopedCreationCopyTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	private function pdf(): \MediaWiki\FileRepo\File\LocalFile {
		return $this->upload( 'Scoped_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
	}

	private function pdfSurface( $file, int $page, string $id, string $name = 'ABC' ): array {
		return [ 'id' => $id, 'label' => $name, 'kind' => 'pdf',
			'canvas' => [ 'width' => $file->getWidth( $page ), 'height' => $file->getHeight( $page ),
				'backgroundColor' => '#ffffff', 'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 1, 'y' => 2, 'text' => $id ] ],
			'source' => [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
				'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => $page ] ];
	}

	private function publish( Title $title, int $base, array $surfaces, ?string $main = null ): int {
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => $base,
			'data' => json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) ];
		if ( $main !== null ) {
			$params['maintext'] = $main;
		}
		return $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layerspublish']['revid'];
	}

	private function revision( int $id ): \MediaWiki\Revision\RevisionRecord {
		return $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
	}

	public function testNewFileAndPdfPageIdsAreIndependentAndRepeatedEmbedsShareOne(): void {
		$a = $this->pdf();
		$b = $this->pdf();
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$embeds = [ "[[File:{$a->getName()}|page=1|layerset=$id:ABC]]",
			"[[File:{$a->getName()}|page=2|layerset=$id:ABC]]",
			"[[File:{$b->getName()}|page=1|layerset=$id:ABC]]", "{{#Slide:$id:ABC}}" ];
		$main = implode( "\n", array_merge( $embeds, [ $embeds[0] ] ) );
		$base = $this->editPage( $page, $main )->getNewRevision()->getId();
		$ids = [];
		foreach ( $embeds as $embed ) {
			$init = $this->pilot->prepareBoundEditor( $id, $base, strpos( $main, $embed ), $embed, $this->actor );
			$ids[] = $init['pageOwned']['surfaceId'];
			$this->assertNotSame( NewPageDrawing::legacySurfaceId( $id, $base, 'ABC' ),
				$init['pageOwned']['surfaceId'] );
			$this->assertSame( 'ABC', $init['pageOwned']['newSurface']['label'] );
			$this->assertArrayNotHasKey( 'legacySurface', $init['pageOwned']['draftScope'] );
		}
		$this->assertCount( 4, array_unique( $ids ) );
		$this->assertCount( 4, $this->pilot->listBoundEditorSelections( $id, $base, $this->actor ) );
		$repeat = $this->pilot->prepareBoundEditor( $id, $base,
			strrpos( $main, $embeds[0] ), $embeds[0], $this->actor );
		$this->assertSame( $ids[0], $repeat['pageOwned']['surfaceId'] );
		$this->assertFalse( $this->revision( $base )->hasSlot( 'layers' ) );
	}

	public function testNewPdfPageKeepsNameAndExactPinAfterAnotherUpload(): void {
		$file = $this->pdf();
		$one = $this->pdfSurface( $file, 1, 'retained-one' );
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$embed = "[[File:{$file->getName()}|page 2|layerset=$id:abc]]";
		$base = $this->publish( $page->getTitle(), $page->getLatest(), [ $one ], $embed );
		$this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20261001000000' );
		$init = $this->pilot->prepareBoundEditor( $id, $base, 0, $embed, $this->actor );
		$two = $init['pageOwned']['newSurface'];
		$this->assertSame( 'ABC', $two['label'] );
		$this->assertSame( 2, $two['source']['page'] );
		$this->assertSame( $one['source']['timestamp'], $two['source']['timestamp'] );
		$this->assertSame( $one['source']['sha1'], $two['source']['sha1'] );
		$this->assertSame( [], $two['layers'] );
		$next = $this->publish( $page->getTitle(), $base, [ $one, $two ] );
		$this->assertSame( $embed, $this->revision( $next )->getContent( 'main' )->getText() );
		$again = $this->pilot->prepareBoundEditor( $id, $next, 0, $embed, $this->actor );
		$this->assertSame( $two['id'], $again['pageOwned']['surfaceId'] );
		$this->assertArrayNotHasKey( 'newSurface', $again['pageOwned'] );
		$this->assertCount( 1, $this->surfaces( $this->revision( $base ) ) );
	}

	public function testCopyFromEitherPdfPageCopiesTheWholeSetWithOneScopedName(): void {
		$file = $this->pdf();
		$other = $this->pdf();
		$source = $this->getExistingTestPage();
		$original = [ $this->pdfSurface( $file, 1, 'source-one' ), $this->pdfSurface( $file, 2, 'source-two' ) ];
		$sourceRev = $this->publish( $source->getTitle(), $source->getLatest(), $original );
		$target = $this->getExistingTestPage();
		$unrelated = $this->pdfSurface( $other, 1, 'other-file' );
		$base = $this->publish( $target->getTitle(), $target->getLatest(), [ $unrelated ] );
		foreach ( [ 'source-two' => 'ABC', 'source-one' => 'ABC 2' ] as $selected => $label ) {
			$preview = $this->pilot->previewListCopy( $target->getId(), $base, $source->getId(), $selected,
				$sourceRev, $this->actor );
			$this->assertSame( $label, $preview['label'] );
			$next = $this->pilot->copyListDrawing( $target->getId(), $base, $source->getId(), $selected,
				$sourceRev, $this->actor, '' );
			$copied = $this->surfaces( $this->revision( $next ) );
			$tail = array_slice( $copied, -2 );
			$this->assertSame( [ $label, $label ], array_column( $tail, 'label' ) );
			$this->assertCount( 2, array_unique( array_column( $tail, 'id' ) ) );
			foreach ( $tail as $i => $surface ) {
				$this->assertEquals( $original[$i]['source'], $surface['source'] );
				$this->assertEquals( $original[$i]['layers'], $surface['layers'] );
				$this->assertNotSame( $original[$i]['id'], $surface['id'] );
			}
			$this->assertSame( 'other-file', $copied[0]['id'] );
			$this->assertSame( $this->revision( $base )->getContent( 'main' )->getText(),
				$this->revision( $next )->getContent( 'main' )->getText() );
			$base = $next;
		}
		$this->assertCount( 2, $this->surfaces( $this->revision( $sourceRev ) ) );
	}

	public function testNamedEmbedCopyUsesNativePageThenCopiesWholeSet(): void {
		$file = $this->pdf();
		$source = $this->getExistingTestPage();
		$sourceRev = $this->publish( $source->getTitle(), $source->getLatest(),
			[ $this->pdfSurface( $file, 1, 'one' ), $this->pdfSurface( $file, 2, 'two' ) ] );
		$target = $this->getExistingTestPage();
		$sourceId = $source->getId();
		$embed = "[[File:{$file->getName()}|page 2|layerset=$sourceId:ABC]]";
		$base = $this->editPage( $target, $embed )->getNewRevision()->getId();
		$this->assertCount( 1, $this->pilot->listCopyCandidates( $target->getId(), $base, $this->actor ) );
		$next = $this->pilot->copyDrawing( $target->getId(), $base, 0, $embed, $sourceRev, $this->actor, '' );
		$copies = $this->surfaces( $this->revision( $next ) );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $copies, 'source' ), 'page' ) );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $copies, 'label' ) );
		$this->assertSame( str_replace( "layerset=$sourceId:", 'layerset=' . $target->getId() . ':', $embed ),
			$this->revision( $next )->getContent( 'main' )->getText() );
	}

	public function testWholePdfCopyRetainsPreviewedRevisionAfterSourceSetChanges(): void {
		$file = $this->pdf();
		$other = $this->pdf();
		$source = $this->getExistingTestPage();
		$original = [ $this->pdfSurface( $file, 1, 'source-one' ), $this->pdfSurface( $file, 2, 'source-two' ) ];
		$sourceRevision = $this->publish( $source->getTitle(), $source->getLatest(), $original );
		$target = $this->getExistingTestPage();
		$unrelated = $this->pdfSurface( $other, 1, 'unrelated-file' );
		$base = $this->publish( $target->getTitle(), $target->getLatest(), [ $unrelated ] );
		$preview = $this->pilot->previewListCopy( $target->getId(), $base, $source->getId(), 'source-two',
			$sourceRevision, $this->actor );
		$this->assertSame( [ 'ABC', $sourceRevision ], [ $preview['label'], $preview['sourceRevision'] ] );
		$changed = $original;
		$changed[0]['label'] = 'New name';
		$changed[0]['layers'][0]['text'] = 'Newer page one';
		$changed[1]['layers'][0]['text'] = 'Newer page two';
		$newer = $this->publish( $source->getTitle(), $sourceRevision, $changed );
		$this->assertSame( $sourceRevision, $this->revision( $newer )->getParentId() );
		$copiedRevision = $this->pilot->copyListDrawing( $target->getId(), $base, $source->getId(), 'source-two',
			$sourceRevision, $this->actor, 'J112C2 exact preview' );
		$read = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $target->getTitle()->getPrefixedText(),
			'revid' => $copiedRevision ], null, $this->actor )[0]['layersread'];
		$copied = array_slice( $read['snapshot']['surfaces'], -2 );
		$this->assertCount( 2, $copied );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $copied, 'label' ) );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $copied, 'source' ), 'page' ) );
		$this->assertCount( 2, array_unique( array_column( $copied, 'id' ) ) );
		foreach ( $copied as $index => $surface ) {
			$this->assertNotSame( $original[$index]['id'], $surface['id'] );
			$this->assertEquals( $original[$index]['source'], $surface['source'] );
			$this->assertEquals( $original[$index]['canvas'], $surface['canvas'] );
			$this->assertEquals( $original[$index]['layers'], $surface['layers'] );
		}
		$this->assertEquals( $unrelated, $read['snapshot']['surfaces'][0] );
		$this->assertSame( $base, $this->revision( $copiedRevision )->getParentId() );
		$this->assertSame( $this->revision( $base )->getContent( 'main' )->getText(),
			$this->revision( $copiedRevision )->getContent( 'main' )->getText() );
		$this->assertEquals( $original, $this->surfaces( $this->revision( $sourceRevision ) ) );
		$this->assertSame( [ 'New name', 'New name' ],
			array_column( $this->surfaces( $this->revision( $newer ) ), 'label' ) );
	}

	public function testDedicatedEmptyBaselineRestoresExactlyAndStaleCleanupCannotOverwriteAnotherWriter(): void {
		$page = $this->getNonexistingTestPage();
		$title = $page->getTitle();
		$main = 'Dedicated automated Layers scoped source acceptance page.';
		$baseline = $this->publish( $title, 0, [], $main );
		$baselineRevision = $this->revision( $baseline );
		$this->assertSame( 0, $baselineRevision->getParentId() );
		$this->assertTrue( $baselineRevision->hasSlot( 'layers' ) );
		$this->assertSame( [], $this->surfaces( $baselineRevision ) );
		$originalLayers = $baselineRevision->getContent( 'layers' )->serialize();
		$originalMain = $baselineRevision->getContent( 'main' )->serialize();
		$fixture = json_decode(
			file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ), true );
		$surfaces = [ $fixture['surfaces'][0] ];
		$changed = $this->publish( $title, $baseline, $surfaces, 'Temporary acceptance text.' );
		$this->assertSame( $baseline, $this->revision( $changed )->getParentId() );
		$restored = $this->publish( $title, $changed, [], $originalMain );
		$restoredRevision = $this->revision( $restored );
		$this->assertSame( $changed, $restoredRevision->getParentId() );
		$this->assertTrue( $restoredRevision->hasSlot( 'layers' ) );
		foreach ( [ 'layers', 'main' ] as $role ) {
			$this->assertSame( $baselineRevision->getContent( $role )->getModel(),
				$restoredRevision->getContent( $role )->getModel() );
			$this->assertSame( $baselineRevision->getContent( $role )->serialize(),
				$restoredRevision->getContent( $role )->serialize() );
		}
		$read = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
			'revid' => $restored ], null, $this->actor )[0]['layersread'];
		$this->assertSame( [ 'schemaVersion' => 1, 'surfaces' => [] ], $read['snapshot'] );
		$lastOwned = $this->publish( $title, $restored, $surfaces, 'Second acceptance run.' );
		$otherActor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $otherActor, [ 'read', 'edit', 'editlayers' ] );
		$other = $this->doApiRequestWithToken( [ 'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(), 'baserevid' => $lastOwned,
			'data' => json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ),
			'maintext' => 'Another writer owns this newer revision.'
		], null, $otherActor )[0]['layerspublish']['revid'];
		$this->assertSame( $lastOwned, $this->revision( $other )->getParentId() );
		$this->assertSame( $otherActor->getId(), $this->revision( $other )->getUser()->getId() );
		try {
			$this->publish( $title, $lastOwned, [], $originalMain );
			$this->fail( 'Stale cleanup must not overwrite another writer' );
		} catch ( \MediaWiki\Api\ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-edit-conflict' ) );
		}
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $title );
		$this->assertSame( $other, $current->getId() );
		$this->assertSame( 'Another writer owns this newer revision.', $current->getContent( 'main' )->serialize() );
		$this->assertSame( $this->revision( $other )->getContent( 'layers' )->serialize(),
			$current->getContent( 'layers' )->serialize() );
		$this->assertSame( $originalLayers, $this->revision( $baseline )->getContent( 'layers' )->serialize() );
		$this->assertSame( $originalMain, $this->revision( $baseline )->getContent( 'main' )->serialize() );
	}

	public function testAdoptionAddsPdfPagesUnderOnePreparedName(): void {
		$file = $this->pdf();
		$rows = [ $this->saveSet( $file, 'notes', 1, 'Page one', 1 ),
			$this->saveSet( $file, 'notes', 1, 'Page two', 2 ) ];
		$page = $this->getExistingTestPage();
		$embeds = [ "[[File:{$file->getName()}|page=1|layerset=notes]]",
			"[[File:{$file->getName()}|page=2|layerset=notes]]" ];
		$base = $this->editPage( $page, implode( "\n", $embeds ) )->getNewRevision()->getId();
		foreach ( $embeds as $i => $embed ) {
			$main = $this->revision( $base )->getContent( 'main' )->getText();
			$result = $this->pilot->adoptDirectEmbedding( $page->getId(), $base, strpos( $main, $embed ),
				$embed, $rows[$i], $file->getTimestamp(), $this->actor, '' );
			$base = $result['revisionId'];
		}
		$surfaces = $this->surfaces( $this->revision( $base ) );
		$this->assertSame( [ 'notes', 'notes' ], array_column( $surfaces, 'label' ) );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $surfaces, 'source' ), 'page' ) );
		$this->assertSame( 2, substr_count( $this->revision( $base )->getContent( 'main' )->getText(),
			'layerset=' . $page->getId() . ':notes' ) );
	}

	public function testLegacyDraftAliasRequiresUniqueTargetAndSamePageInterpretation(): void {
		$file = $this->pdf();
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$options = [ 'page=1' => true, 'page=2' => true, 'page 2' => false, 'page=2.5' => false ];
		foreach ( $options as $option => $alias ) {
			$embed = "[[File:{$file->getName()}|$option|layerset=$id:ABC]]";
			$base = $this->editPage( $page, $embed )->getNewRevision()->getId();
			$init = $this->pilot->prepareBoundEditor( $id, $base, 0, $embed, $this->actor );
			$scope = $init['pageOwned']['draftScope'];
			if ( $alias ) {
				$this->assertSame( [ 'surfaceId' => NewPageDrawing::legacySurfaceId( $id, $base, 'ABC' ),
					'baseRevisionId' => $base ], $scope['legacySurface'] );
				$this->assertNotSame( $scope['legacySurface']['surfaceId'], $init['pageOwned']['surfaceId'] );
			} else {
				$this->assertArrayNotHasKey( 'legacySurface', $scope );
			}
		}
	}

	public function testUniqueRepeatedSlideOffersLegacyRecoveryWithoutReusingTheOldId(): void {
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$embed = "{{#Slide:$id:ABC}}";
		$base = $this->editPage( $page, "$embed\n$embed" )->getNewRevision()->getId();
		$init = $this->pilot->prepareBoundEditor( $id, $base, 0, $embed, $this->actor );
		$this->assertSame( [ 'surfaceId' => NewPageDrawing::legacySurfaceId( $id, $base, 'ABC' ),
			'baseRevisionId' => $base ], $init['pageOwned']['draftScope']['legacySurface'] );
		$this->assertSame( NewPageDrawing::surfaceId( $id, $base, 'ABC' ), $init['pageOwned']['surfaceId'] );
		$this->assertNotSame( $init['pageOwned']['draftScope']['legacySurface']['surfaceId'],
			$init['pageOwned']['surfaceId'] );
		$this->assertCount( 1, $this->pilot->listBoundEditorSelections( $id, $base, $this->actor ) );
	}

	public function testRenameScannerRefusalIsAKnownApiFailureAndLeavesBothSlotsUntouched(): void {
		$file = $this->pdf();
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$surfaces = [ $this->pdfSurface( $file, 1, 'one' ), $this->pdfSurface( $file, 2, 'two' ) ];
		$embed = "[[File:{$file->getName()}|layerset=$id:ABC]]";
		$base = $this->publish( $page->getTitle(), $page->getLatest(), $surfaces, $embed );
		$surfaces[0]['label'] = 'Renamed';
		try {
			$this->publish( $page->getTitle(), $base, $surfaces, $embed . ' {{unclosed' );
			$this->fail( 'A failed required rewrite must refuse the entire publication' );
		} catch ( \MediaWiki\Api\ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-invalid-publication-request' ) );
		}
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $base, $current->getId() );
		$this->assertSame( $embed, $current->getContent( 'main' )->getText() );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $this->surfaces( $current ), 'label' ) );
	}

	public function testAnUploadAfterTheBaseCannotReceiveAnUnpinnedLegacyDraft(): void {
		$file = $this->upload( 'Newer_' . wfRandomString() . '.pdf', 'test-multipage.pdf', '20270101000000' );
		$page = $this->getExistingTestPage();
		$id = $page->getId();
		$embed = "[[File:{$file->getName()}|layerset=$id:ABC]]";
		$base = $this->editPage( $page, $embed )->getNewRevision()->getId();
		$init = $this->pilot->prepareBoundEditor( $id, $base, 0, $embed, $this->actor );
		$this->assertArrayNotHasKey( 'legacySurface', $init['pageOwned']['draftScope'] );
		$this->assertSame( '20270101000000', $init['pageOwned']['newSurface']['source']['timestamp'] );
	}
}
