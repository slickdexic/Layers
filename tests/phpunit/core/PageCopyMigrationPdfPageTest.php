<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * @covers \MediaWiki\Extension\Layers\Migration\PageCopyMigration
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class PageCopyMigrationPdfPageTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	private function latest( Title $title ): RevisionRecord {
		return $this->getServiceContainer()->getRevisionLookup()->getRevisionByPageId(
			$title->getArticleID( IDBAccessObject::READ_LATEST ), 0, IDBAccessObject::READ_LATEST );
	}

	private function page( string $text ): Title {
		$title = $this->getExistingTestPage()->getTitle();
		$this->assertStatusGood( $this->editPage( $title, $text, '', NS_MAIN, $this->actor ) );
		return $title;
	}

	private function embed( LocalFile $file, string $options ): string {
		return '[[File:' . $file->getName() . '|thumb|120px|' . $options . 'layerset=Notes]]';
	}

	private function assertRenderedPage( Title $title, string $text, int $page ): void {
		$html = $this->getServiceContainer()->getParserFactory()->create()->parse( $text, $title,
			ParserOptions::newFromAnon(), true, true, $this->latest( $title )->getId() )->getRawText();
		$document = new \DOMDocument();
		$document->loadHTML( $html, LIBXML_NOERROR | LIBXML_NOWARNING );
		$images = $document->getElementsByTagName( 'img' );
		$this->assertCount( 1, $images, $html );
		$this->assertStringContainsString( "page$page-", $images->item( 0 )->getAttribute( 'src' ), $html );
	}

	/**
	 * @dataProvider provideNativePageOptions
	 * @param string $language
	 * @param string $options
	 * @param int $page
	 */
	public function testNativePageOptionsCopyExactSelectedPayload(
		string $language, string $options, int $page
	): void {
		$this->setContentLang( $language );
		$file = $this->upload( 'Migration_pdf_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$rowIds = [ 1 => $this->saveSet( $file, 'Notes', 1, 'PDF page one', 1 ),
			2 => $this->saveSet( $file, 'Notes', 1, 'PDF page two', 2 ) ];
		$stepOne = $this->pilot->newFilePageMigration();
		$stepOnePlan = $stepOne->plan( $file->getName(), $this->actor );
		$sourceRevision = $stepOne->commit( $stepOnePlan, $this->actor );
		$this->assertNotNull( $sourceRevision );
		$sourceSurfaces = $this->surfaces( $this->latest( $file->getTitle() ) );
		$source = array_values( array_filter( $sourceSurfaces,
			static fn ( $surface ) => $surface['source']['page'] === $page ) )[0];
		$expectedText = $page === 1 ? 'PDF page one' : 'PDF page two';
		$this->assertSame( $expectedText, $source['layers'][0]['text'] );
		$text = $this->embed( $file, $options );
		$title = $this->page( $text );
		$baseRevision = $this->latest( $title )->getId();
		$this->assertRenderedPage( $title, $text, $page );
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertCount( 1, $plan['copies'] );
		$copy = json_decode( $plan['document'], true, 64, JSON_THROW_ON_ERROR )['surfaces'][0];
		$this->assertSame( $source['layers'], $copy['layers'], 'Copy the payload of the page core rendered' );
		$this->assertSame( $rowIds[$page], $plan['copies'][0]['legacyId'] );
		$this->assertSame( $sourceRevision, $plan['copies'][0]['sourceRevision'] );
		$this->assertSame( FilePageMigration::surfaceId( $rowIds[$page], $title->getArticleID() ), $copy['id'] );
		$this->assertSame( [ 'fileTitle' => 'File:' . $file->getName(), 'page' => $page, 'repository' => 'local',
			'sha1' => $file->getSha1(), 'timestamp' => $file->getTimestamp() ], $copy['source'] );
		$this->assertSame( $source['canvas'], $copy['canvas'] );
		$source['id'] = $copy['id'];
		$this->assertSame( $source, $copy );
		$this->assertSame( str_replace( '|layerset=Notes', '|layerset=' . $title->getArticleID() . ':' .
			$copy['label'], $text ), $plan['main'], 'Keep every other embed byte and explicit output' );
		$this->assertSame( $baseRevision, $this->latest( $title )->getId(), 'Planning writes nothing' );
		$this->assertSame( $text, $this->latest( $title )->getContent( 'main' )->getText() );
	}

	public static function provideNativePageOptions(): array {
		return [
			'Default' => [ 'en', '', 1 ],
			'Explicit page one' => [ 'en', 'page=1|', 1 ],
			'Explicit page two' => [ 'en', 'page=2|', 2 ],
			'English space alias' => [ 'en', 'page 2|', 2 ],
			'German space alias' => [ 'de', 'seite 2|', 2 ],
			'German equals alias' => [ 'de', 'seite=2|', 2 ],
			'Caption boundary' => [ 'en', 'page =2|', 1 ],
			'Last valid page wins' => [ 'en', 'page=1|page=2|', 2 ],
			'Reverse ordering' => [ 'en', 'page=2|page=1|', 1 ],
			'Last valid alias wins' => [ 'en', 'page=2|page 1|', 1 ],
			'Invalid does not erase valid' => [ 'en', 'page=2|page=oops|', 2 ],
			'Leading zero' => [ 'en', 'page=02|', 1 ],
			'Zero' => [ 'en', 'page=0|', 1 ],
			'Negative' => [ 'en', 'page=-1|', 1 ],
			'Trailing junk' => [ 'en', 'page=2x|', 1 ],
			'Noninteger' => [ 'en', 'page=oops|', 1 ],
			'Empty value' => [ 'en', 'page=|', 1 ],
			'Value whitespace' => [ 'en', 'page= 2 |', 2 ],
			'Page three clamps' => [ 'en', 'page=3|', 2 ],
			'Large canonical integer clamps' => [ 'en', 'page=1000|', 2 ]
		];
	}

	private function pdfFixture( array $pages = [ 1, 2 ] ): array {
		$file = $this->upload( 'Migration_pdf_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$rowIds = [];
		foreach ( $pages as $page ) {
			$rowIds[$page] = $this->saveSet( $file, 'Notes', 1,
				$page === 1 ? 'PDF page one' : 'PDF page two', $page );
		}
		$plan = $this->pilot->newFilePageMigration()->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSameSize( $pages, $plan['add'] );
		return [ $file, $rowIds, $plan ];
	}

	private function sourceSurface( array $stepOnePlan, int $page ): array {
		$surfaces = json_decode( $stepOnePlan['document'], true, 64, JSON_THROW_ON_ERROR )['surfaces'];
		$matches = array_values( array_filter( $surfaces,
			static fn ( $surface ) => $surface['source']['page'] === $page ) );
		$this->assertCount( 1, $matches );
		return $matches[0];
	}

	private function assertSelectedCopy( array $plan, Title $title, LocalFile $file, int $rowId,
		array $source, ?int $sourceRevision
	): array {
		$this->assertNull( $plan['problem'] );
		$descriptors = array_values( array_filter( $plan['copies'],
			static fn ( $copy ) => $copy['legacyId'] === $rowId ) );
		$this->assertCount( 1, $descriptors, 'Select the exact legacy row' );
		$this->assertSame( $sourceRevision, $descriptors[0]['sourceRevision'] );
		$id = FilePageMigration::surfaceId( $rowId, $title->getArticleID() );
		$surfaces = json_decode( $plan['document'], true, 64, JSON_THROW_ON_ERROR )['surfaces'];
		$matches = array_values( array_filter( $surfaces, static fn ( $surface ) => $surface['id'] === $id ) );
		$this->assertCount( 1, $matches, 'Preserve the deterministic destination ID' );
		$copy = $matches[0];
		$this->assertSame( $source['layers'], $copy['layers'] );
		$this->assertSame( [ 'fileTitle' => 'File:' . $file->getName(), 'page' => $source['source']['page'],
			'repository' => 'local', 'sha1' => $file->getSha1(), 'timestamp' => $file->getTimestamp() ],
			$copy['source'] );
		$this->assertSame( $source['canvas'], $copy['canvas'] );
		$source['id'] = $id;
		$source['label'] = $descriptors[0]['name'];
		$this->assertSame( $source, $copy, 'Preserve the complete selected surface' );
		return $copy;
	}

	private function legacyRows( LocalFile $file ): array {
		$rows = [];
		foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'layer_sets' )
			->where( [ 'ls_img_name' => $file->getName() ] )->orderBy( 'ls_id' )
			->caller( __METHOD__ )->fetchResultSet() as $row
		) {
			$rows[] = (array)$row;
		}
		return $rows;
	}

	/**
	 * @dataProvider provideMissingPages
	 * @param int $storedPage
	 * @param int $requestedPage
	 */
	public function testMissingLegacyPageNeverBorrowsAnotherPage( int $storedPage, int $requestedPage ): void {
		[ $file, , $stepOnePlan ] = $this->pdfFixture( [ $storedPage ] );
		$this->pilot->newFilePageMigration()->commit( $stepOnePlan, $this->actor );
		$text = $this->embed( $file, "page=$requestedPage|" );
		$title = $this->page( $text );
		$base = $this->latest( $title )->getId();
		$this->assertRenderedPage( $title, $text, $requestedPage );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [], $plan['copies'] );
		$this->assertSame( [ [ 'what' => $text, 'reason' => 'no-current-set' ] ], $plan['notMoved'] );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $plan['main'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $base, $this->latest( $title )->getId() );
		$this->assertSame( $text, $this->latest( $title )->getContent( 'main' )->getText() );
		$this->assertFalse( $this->latest( $title )->hasSlot( 'layers' ) );
	}

	/**
	 * @dataProvider provideMissingPages
	 * @param int $storedPage
	 * @param int $requestedPage
	 */
	public function testMissingMigratedPageNeverBorrowsPendingSurface( int $storedPage, int $requestedPage ): void {
		[ $file, , $stepOnePlan ] = $this->pdfFixture();
		$pending = json_decode( $stepOnePlan['document'], true, 64, JSON_THROW_ON_ERROR );
		$pending['surfaces'] = [ $this->sourceSurface( $stepOnePlan, $storedPage ) ];
		$pendingJson = json_encode( $pending, JSON_THROW_ON_ERROR );
		$text = $this->embed( $file, "page=$requestedPage|" );
		$title = $this->page( $text );
		$base = $this->latest( $title )->getId();
		$fileBase = $this->latest( $file->getTitle() )->getId();
		$legacy = $this->legacyRows( $file );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor,
			static fn ( string $name ): ?string => $name === $file->getName() ? $pendingJson : null );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [], $plan['copies'] );
		$this->assertSame( [ [ 'what' => $text, 'reason' => 'file-not-migrated' ] ], $plan['notMoved'] );
		$this->assertNull( $plan['document'] );
		$this->assertNull( $plan['main'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $base, $this->latest( $title )->getId() );
		$this->assertSame( $text, $this->latest( $title )->getContent( 'main' )->getText() );
		$this->assertFalse( $this->latest( $title )->hasSlot( 'layers' ) );
		$this->assertSame( $fileBase, $this->latest( $file->getTitle() )->getId() );
		$this->assertFalse( $this->latest( $file->getTitle() )->hasSlot( 'layers' ) );
		$this->assertSame( $legacy, $this->legacyRows( $file ) );
	}

	public static function provideMissingPages(): array {
		return [ 'Only page two available' => [ 2, 1 ], 'Only page one available' => [ 1, 2 ] ];
	}

	public function testInterleavedFilesAndAliasesDeduplicateOnlyTheExactSourceRow(): void {
		[ $pdf, $rowIds, $pdfPlan ] = $this->pdfFixture();
		$image = $this->upload( 'Migration_image_' . wfRandomString() . '.png', 'test-image.png',
			'20260906121000' );
		$imageId = $this->saveSet( $image, 'Notes', 1, 'Image payload only' );
		$stepOne = $this->pilot->newFilePageMigration();
		$imagePlan = $stepOne->plan( $image->getName(), $this->actor );
		$pdfRevision = $stepOne->commit( $pdfPlan, $this->actor );
		$imageRevision = $stepOne->commit( $imagePlan, $this->actor );
		$first = $this->embed( $pdf, 'page=1|left|First caption|' );
		$second = $this->embed( $pdf, 'page=1|page=2|right|Second caption|' );
		$alias = str_replace( '[[File:', '[[Image:', $this->embed( $pdf, 'page 2|alt=PDF alt|' ) );
		$photo = $this->embed( $image, 'page=1|page=2|page 2|alt=Image alt|' );
		$unrelated = '\n[[:File:' . $pdf->getName() . '|Unchanged link]] <nowiki>' . $second . '</nowiki>';
		$text = "Prefix\n$second\n$photo\n$first\n$second\n$alias\n$photo" . $unrelated;
		$title = $this->page( $text );
		$base = $this->latest( $title )->getId();
		$plan = $this->pilot->newPageCopyMigration()->plan( $title->getArticleID(), $this->actor );
		$this->assertCount( 3, $plan['copies'] );
		$this->assertSame( [], $plan['notMoved'] );
		$one = $this->assertSelectedCopy( $plan, $title, $pdf, $rowIds[1],
			$this->sourceSurface( $pdfPlan, 1 ), $pdfRevision );
		$two = $this->assertSelectedCopy( $plan, $title, $pdf, $rowIds[2],
			$this->sourceSurface( $pdfPlan, 2 ), $pdfRevision );
		$picture = $this->assertSelectedCopy( $plan, $title, $image, $imageId,
			$this->sourceSurface( $imagePlan, 1 ), $imageRevision );
		$this->assertSame( 'Image payload only', $picture['layers'][0]['text'] );
		$this->assertSame( 1, $picture['source']['page'] );
		$this->assertNotSame( $pdf->getSha1(), $image->getSha1() );
		$this->assertSame( [ 3, 2, 1 ], array_column( $plan['copies'], 'embeds' ) );
		$this->assertSame( [ $rowIds[2], $imageId, $rowIds[1] ], array_column( $plan['copies'], 'legacyId' ) );
		$owner = $title->getArticleID();
		$rewrittenOne = str_replace( '|layerset=Notes', '|layerset=' . $owner . ':' . $one['label'], $first );
		$rewrittenTwo = str_replace( '|layerset=Notes', '|layerset=' . $owner . ':' . $two['label'], $second );
		$rewrittenAlias = str_replace( '|layerset=Notes', '|layerset=' . $owner . ':' . $two['label'], $alias );
		$rewrittenPhoto = str_replace( '|layerset=Notes', '|layerset=' . $owner . ':' . $picture['label'], $photo );
		$this->assertSame( "Prefix\n$rewrittenTwo\n$rewrittenPhoto\n$rewrittenOne\n$rewrittenTwo\n" .
			"$rewrittenAlias\n$rewrittenPhoto" . $unrelated, $plan['main'] );
		$this->assertSame( $base, $this->latest( $title )->getId() );
		$this->assertSame( $text, $this->latest( $title )->getContent( 'main' )->getText() );
	}

	public function testPendingAndCommittedStepOneAgreeAndResumeWithoutWrites(): void {
		[ $file, $rowIds, $stepOnePlan ] = $this->pdfFixture();
		$text = $this->embed( $file, 'page=1|' ) . "\n" . $this->embed( $file, 'page=1|page=2|' ) .
			"\n" . $this->embed( $file, 'page 2|' );
		$title = $this->page( $text );
		$base = $this->latest( $title )->getId();
		$fileBase = $this->latest( $file->getTitle() )->getId();
		$legacy = $this->legacyRows( $file );
		$migration = $this->pilot->newPageCopyMigration();
		$pending = $migration->plan( $title->getArticleID(), $this->actor,
			static fn ( string $name ): ?string => $name === $file->getName() ? $stepOnePlan['document'] : null );
		$this->assertCount( 2, $pending['copies'] );
		foreach ( $rowIds as $page => $rowId ) {
			$this->assertSelectedCopy( $pending, $title, $file, $rowId,
				$this->sourceSurface( $stepOnePlan, $page ), null );
		}
		$this->assertSame( $base, $this->latest( $title )->getId(), 'Destination dry run writes nothing' );
		$this->assertSame( $text, $this->latest( $title )->getContent( 'main' )->getText() );
		$this->assertSame( $fileBase, $this->latest( $file->getTitle() )->getId(), 'Step one dry run writes nothing' );
		$this->assertFalse( $this->latest( $file->getTitle() )->hasSlot( 'layers' ) );
		$this->assertSame( $legacy, $this->legacyRows( $file ) );
		$stepOne = $this->pilot->newFilePageMigration();
		$sourceRevision = $stepOne->commit( $stepOnePlan, $this->actor );
		$committed = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( $pending['document'], $committed['document'] );
		$this->assertSame( $pending['main'], $committed['main'] );
		$this->assertSame( [ 1, 2 ], array_column( $committed['copies'], 'embeds' ) );
		foreach ( $rowIds as $page => $rowId ) {
			$this->assertSelectedCopy( $committed, $title, $file, $rowId,
				$this->sourceSurface( $stepOnePlan, $page ), $sourceRevision );
		}
		$this->assertSame( $base, $this->latest( $title )->getId(), 'Committed-source planning writes nothing' );
		$this->assertSame( $legacy, $this->legacyRows( $file ) );
		$revisionId = $migration->commit( $committed, $this->actor );
		$revision = $this->latest( $title );
		$this->assertSame( [ $revisionId, $base ], [ $revision->getId(), $revision->getParentId() ] );
		$this->assertSame( $committed['document'], $revision->getContent( 'layers' )->getText() );
		$this->assertSame( $committed['main'], $revision->getContent( 'main' )->getText() );
		$this->assertContains( PagePublicationService::MIGRATION_TAG,
			$this->getServiceContainer()->getChangeTagsStore()->getTags( $this->getDb(), null, $revisionId ) );
		$this->assertStringContainsString( 'Copied 2 shared layer sets into this page:',
			$revision->getComment()->text );
		$again = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [ [], null, null ], [ $again['copies'], $again['document'], $again['main'] ] );
		$this->assertNull( $migration->commit( $again, $this->actor ) );
		$this->assertSame( $revisionId, $this->latest( $title )->getId() );
		$fileAgain = $stepOne->plan( $file->getName(), $this->actor );
		$this->assertSame( [], $fileAgain['add'] );
		$this->assertCount( 2, $fileAgain['done'] );
		$this->assertNull( $stepOne->commit( $fileAgain, $this->actor ) );
		$this->assertSame( $sourceRevision, $this->latest( $file->getTitle() )->getId() );
		$this->assertSame( $legacy, $this->legacyRows( $file ) );
	}

	public function testStalePlanPreservesTheNewerMainAndLayersRevision(): void {
		[ $file, $rowIds, $stepOnePlan ] = $this->pdfFixture();
		$sourceRevision = $this->pilot->newFilePageMigration()->commit( $stepOnePlan, $this->actor );
		$title = $this->page( $this->embed( $file, 'page 2|' ) );
		$legacy = $this->legacyRows( $file );
		$migration = $this->pilot->newPageCopyMigration();
		$stale = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSelectedCopy( $stale, $title, $file, $rowIds[2],
			$this->sourceSurface( $stepOnePlan, 2 ), $sourceRevision );
		$newerText = "Newer page content\n" . $this->embed( $file, 'page=1|' );
		$this->assertStatusGood( $this->editPage( $title, $newerText, '', NS_MAIN, $this->actor ) );
		$newerPlan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSelectedCopy( $newerPlan, $title, $file, $rowIds[1],
			$this->sourceSurface( $stepOnePlan, 1 ), $sourceRevision );
		$newerRevision = $migration->commit( $newerPlan, $this->actor );
		try {
			$migration->commit( $stale, $this->actor );
			$this->fail( 'A stale page-two plan must not overwrite the newer page-one layers' );
		} catch ( PublicationException $exception ) {
			$this->assertSame( 'layers-edit-conflict', $exception->getMessage() );
		}
		$latest = $this->latest( $title );
		$this->assertSame( $newerRevision, $latest->getId() );
		$this->assertSame( $newerPlan['main'], $latest->getContent( 'main' )->getText() );
		$this->assertSame( $newerPlan['document'], $latest->getContent( 'layers' )->getText() );
		$this->assertCount( 1, $this->surfaces( $latest ) );
		$this->assertSame( $sourceRevision, $this->latest( $file->getTitle() )->getId() );
		$this->assertSame( $legacy, $this->legacyRows( $file ) );
	}
}
