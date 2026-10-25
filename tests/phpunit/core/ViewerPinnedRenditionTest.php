<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\FileRepo\File\OldLocalFile;
use MediaWiki\Permissions\Authority;

require_once __DIR__ . '/RealAssetTestCase.php';
require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Corrected native test evidence for full-size exact-version PDF rendition delivery (J114B1).
 *
 * Verifies that full-size PDF pages retain the exact saved file version after reupload,
 * proves published payload retrieval and authorization isolation via real PageReadService,
 * decodes truthful image MIME and pixel dimensions, exercises extreme portrait geometry
 * under the 4000-pixel budget, proves refusal of unavailable sources with finally-restoration,
 * and characterizes why the inline forSurface() width policy alone is insufficient.
 *
 * @covers \MediaWiki\Extension\Layers\Revision\SourceVersionResolver
 * @covers \MediaWiki\Extension\Layers\Revision\SourceRenditions
 * @covers \MediaWiki\Extension\Layers\Revision\PageReadService
 * @group Database
 */
class ViewerPinnedRenditionTest extends RealAssetTestCase {

	/**
	 * Pure PHP multi-page PDF generator using Helvetica font and standard PDF 1.4 objects.
	 *
	 * @param array<int, array{width: int, height: int, stream: string}> $pages
	 * @return string Complete PDF 1.4 file bytes
	 */
	public static function buildPdf( array $pages ): string {
		$pageCount = count( $pages );
		$kids = [];
		for ( $i = 0; $i < $pageCount; $i++ ) {
			$kids[] = ( $i + 3 ) . ' 0 R';
		}
		$fontObjNum = $pageCount + 3;
		$objects = [
			'<< /Type /Catalog /Pages 2 0 R >>',
			'<< /Type /Pages /Kids [' . implode( ' ', $kids ) . '] /Count ' . $pageCount . ' >>',
		];
		foreach ( $pages as $i => $page ) {
			$contentObjNum = $fontObjNum + 1 + $i;
			$w = $page['width'];
			$h = $page['height'];
			$objects[] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . $w . ' ' . $h . '] ' .
				'/Resources << /Font << /F1 ' . $fontObjNum . ' 0 R >> >> /Contents ' . $contentObjNum . ' 0 R >>';
		}
		$objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
		foreach ( $pages as $page ) {
			$stream = $page['stream'];
			$objects[] = '<< /Length ' . strlen( $stream ) . " >>\nstream\n" . $stream . "\nendstream";
		}
		$result = "%PDF-1.4\n";
		$offsets = [];
		foreach ( $objects as $index => $object ) {
			$offsets[] = strlen( $result );
			$result .= ( $index + 1 ) . " 0 obj\n" . $object . "\nendobj\n";
		}
		$xref = strlen( $result );
		$size = count( $objects ) + 1;
		$result .= "xref\n0 $size\n0000000000 65535 f \n";
		foreach ( $offsets as $offset ) {
			$result .= sprintf( "%010d 00000 n \n", $offset );
		}
		return $result . "trailer\n<< /Size $size /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n";
	}

	/**
	 * Upload arbitrary PDF bytes to the isolated test repository.
	 *
	 * @param string $pdfBytes
	 * @param string $fileTitle
	 * @param string $timestamp
	 * @param string $comment
	 * @return LocalFile
	 */
	private function uploadPdfBytes(
		string $pdfBytes,
		string $fileTitle,
		string $timestamp = '20261005100000',
		string $comment = 'Fixture PDF upload'
	): LocalFile {
		$tmpDir = $this->getNewTempDirectory();
		$tmpPath = $tmpDir . '/' . wfRandomString() . '.pdf';
		file_put_contents( $tmpPath, $pdfBytes );
		return $this->uploadFixtureFile( $tmpPath, $fileTitle, $timestamp, $comment );
	}

	/**
	 * Create PageReadService connected to test services and resolver.
	 *
	 * @return PageReadService
	 */
	private function createReadService(): PageReadService {
		return new PageReadService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver,
			new SourceRenditions( $this->getServiceContainer()->getUrlUtils() )
		);
	}

	/**
	 * Build a PDF surface with custom canvas dimensions and explicit layers.
	 *
	 * @param string $id
	 * @param string $label Visible layer set name
	 * @param string $fileTitle
	 * @param string $timestamp
	 * @param string $sha1
	 * @param int $page
	 * @param int $canvasWidth
	 * @param int $canvasHeight
	 * @param array $layers
	 * @return array
	 */
	private function makeCustomPdfSurface(
		string $id,
		string $label,
		string $fileTitle,
		string $timestamp,
		string $sha1,
		int $page,
		int $canvasWidth,
		int $canvasHeight,
		array $layers = []
	): array {
		$readingOrder = array_map( static fn ( $l ) => $l['id'], $layers );
		return [
			'id' => $id,
			'kind' => 'pdf',
			'label' => $label,
			'canvas' => [
				'width' => $canvasWidth,
				'height' => $canvasHeight,
				'backgroundColor' => '#ffffff',
				'backgroundVisible' => true,
				'backgroundOpacity' => 1,
			],
			'layers' => $layers,
			'readingOrder' => $readingOrder,
			'source' => [
				'repository' => 'local',
				'fileTitle' => $fileTitle,
				'timestamp' => $timestamp,
				'sha1' => $sha1,
				'page' => $page,
			],
		];
	}

	/**
	 * Test-side simulation of the proposed viewer page adapter.
	 *
	 * Takes the exact resolved File, the requested PDF page, and target viewer width (1600).
	 * If the page has an associated stored surface from an authorized read, returns its stored canvas and layers.
	 * If the page is unannotated, queries handler dimensions from the exact resolved File,
	 * renders the media with an empty layer list, and creates no synthetic surface ID or stored name.
	 * Enforces the 4000-pixel largest-side budget by scaling width down when aspect height would exceed 4000.
	 *
	 * @param File $file Exact resolved version from SourceVersionResolver
	 * @param int $page Requested PDF page number (1-based)
	 * @param ?array $storedSurface Stored surface from authorized read, or null if unannotated
	 * @param int $targetWidth Nominal width (default 1600)
	 * @param int $maxDimension Hard cap on largest side (default 4000)
	 * @return array{source: array{url: string, width: int, height: int}, surface: ?array, canvas: array, layers: array}
	 */
	private function adaptViewerPageRendition(
		File $file,
		int $page,
		?array $storedSurface = null,
		int $targetWidth = 1600,
		int $maxDimension = 4000
	): array {
		$handler = $file->getHandler();
		$pageDims = $handler ? $handler->getPageDimensions( $file, $page ) : false;
		$baseWidth = $pageDims ? (int)$pageDims['width'] : (int)$file->getWidth();
		$baseHeight = $pageDims ? (int)$pageDims['height'] : (int)$file->getHeight();

		// Calculate scale bounded by targetWidth and maxDimension
		$scale = ( $baseWidth > 0 ) ? ( $targetWidth / $baseWidth ) : 1.0;
		$largest = max( $baseWidth, $baseHeight ) * $scale;
		if ( $largest > $maxDimension ) {
			$scale = $scale * ( $maxDimension / $largest );
		}
		$effectiveWidth = (int)max( 1, round( $baseWidth * $scale ) );
		while ( $effectiveWidth > 1 && $baseWidth > 0 &&
			(int)round( $effectiveWidth * $baseHeight / $baseWidth ) > $maxDimension ) {
			$effectiveWidth--;
		}

		$thumb = $file->transform( [
			'width' => $effectiveWidth,
			'page' => $page,
		] );
		if ( !$thumb || $thumb->isError() ) {
			throw new \DomainException( 'layers-source-unavailable' );
		}

		$source = [
			'url' => (string)$thumb->getUrl(),
			'width' => (int)$thumb->getWidth(),
			'height' => (int)$thumb->getHeight(),
		];

		if ( $storedSurface !== null ) {
			return [
				'source' => $source,
				'surface' => $storedSurface,
				'canvas' => $storedSurface['canvas'],
				'layers' => $storedSurface['layers'],
			];
		}

		return [
			'source' => $source,
			// Never invent or store a synthetic surface ID
			'surface' => null,
			'canvas' => [
				'width' => $baseWidth,
				'height' => $baseHeight,
				'backgroundColor' => '#ffffff',
				'backgroundVisible' => true,
				'backgroundOpacity' => 1,
			],
			// Empty layer list in adapter
			'layers' => [],
		];
	}

	/**
	 * Decode actual image format and pixel dimensions from physical file bytes.
	 *
	 * @param string $filePath
	 * @return array{width: int, height: int, mime: string, format: string, signature: string}
	 */
	public static function decodeImage( string $filePath ): array {
		$info = getimagesize( $filePath );
		if ( $info === false ) {
			throw new \RuntimeException( "Failed to decode image from $filePath" );
		}
		$raw = file_get_contents( $filePath, false, null, 0, 8 );
		$sig = $raw !== false ? bin2hex( $raw ) : '';
		$format = ( $info[2] === IMAGETYPE_JPEG ) ? 'JPEG' : ( ( $info[2] === IMAGETYPE_PNG ) ? 'PNG' : 'UNKNOWN' );
		return [
			'width' => $info[0],
			'height' => $info[1],
			'mime' => $info['mime'],
			'format' => $format,
			'signature' => $sig,
		];
	}

	/**
	 * Query all columns and rows of the five fixture tables used for this witness.
	 *
	 * @return array{page: array, revision: array, slots: array, content: array, text: array}
	 */
	private function captureStorageWitnessRows(): array {
		$witness = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text' ] as $table ) {
			$rows = [];
			$result = $this->getDb()->newSelectQueryBuilder()->select( '*' )
				->from( $table )->caller( __METHOD__ )->fetchResultSet();
			foreach ( $result as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = $values;
			}
			usort( $rows, static fn ( $left, $right ) =>
				strcmp( serialize( $left ), serialize( $right ) ) );
			$witness[$table] = $rows;
		}
		return $witness;
	}

	/** Export only when the isolated evidence runner explicitly requests it. */
	private function evidenceDirectory(): string {
		$directory = getenv( 'LAYERS_VIEWER_EVIDENCE_DIR' );
		if ( !is_string( $directory ) || $directory === '' ) {
			return $this->getNewTempDirectory();
		}
		if ( !is_dir( $directory ) ) {
			mkdir( $directory, 0777, true );
		}
		return $directory;
	}

	/** Compare exact types/values while preserving list order and ignoring object key order. */
	private static function comparablePayload( array $value ): array {
		foreach ( $value as $key => $child ) {
			if ( is_array( $child ) ) {
				$value[$key] = self::comparablePayload( $child );
			}
		}
		if ( !array_is_list( $value ) ) {
			ksort( $value );
		}
		return $value;
	}

	/**
	 * Journeys 1, 2, 3: Full-size viewer renditions retain exact archived version after reupload,
	 * published payloads are read through real PageReadService with authorization and refusals,
	 * truthful MIME and decoded dimensions are verified, unannotated pages add no stored records,
	 * and extreme portrait pages obey the 4000-pixel budget.
	 */
	public function testPinnedMultiPagePdfRetainsExactArchivedVersionAfterReupload(): void {
		$actor = $this->actor();

		// --- Step 1: Upload recognizable 4-page PDF with thin rules, microtext, and corner landmarks ---
		// Page 1: Landscape (200x100 pt => 416x208 px at 150 DPI)
		// Page 2: Portrait  (100x200 pt => 208x416 px at 150 DPI)
		// Page 3: Square    (150x150 pt => 312x312 px at 150 DPI), unannotated
		// Page 4: Extreme portrait (50x300 pt => 104x625 px at 150 DPI, aspect 1:6)
		$fourPageBytes = self::buildPdf( [
			[
				'width' => 200, 'height' => 100,
				'stream' => "0.5 w 10 50 m 190 50 l S\n" .
					"BT /F1 10 Tf 10 80 Td (Page 1 Landscape with thin rule) Tj ET\n" .
					"BT /F1 6 Tf 10 20 Td (Microtext 6pt: Quick brown fox 123) Tj ET\n" .
					"BT /F1 8 Tf 5 90 Td (TL) Tj ET\nBT /F1 8 Tf 180 90 Td (TR) Tj ET\n" .
					"BT /F1 8 Tf 5 5 Td (BL) Tj ET\nBT /F1 8 Tf 180 5 Td (BR) Tj ET",
			],
			[
				'width' => 100, 'height' => 200,
				'stream' => "0.5 w 50 10 m 50 190 l S\nBT /F1 10 Tf 10 180 Td (Page 2 Portrait) Tj ET\n" .
					"BT /F1 6 Tf 10 20 Td (Microtext 6pt) Tj ET\n" .
					"BT /F1 8 Tf 5 190 Td (TL) Tj ET\nBT /F1 8 Tf 80 190 Td (TR) Tj ET\n" .
					"BT /F1 8 Tf 5 5 Td (BL) Tj ET\nBT /F1 8 Tf 80 5 Td (BR) Tj ET",
			],
			[
				'width' => 150, 'height' => 150,
				'stream' => "BT /F1 10 Tf 10 130 Td (Page 3 Square Unannotated) Tj ET",
			],
			[
				'width' => 50, 'height' => 300,
				'stream' => "0.5 w 5 10 m 5 290 l S\nBT /F1 8 Tf 5 280 Td (P4 Extreme 1:6) Tj ET\n" .
					"BT /F1 6 Tf 5 20 Td (Budget 4000) Tj ET\n" .
					"BT /F1 6 Tf 5 290 Td (TL) Tj ET\nBT /F1 6 Tf 35 290 Td (TR) Tj ET\n" .
					"BT /F1 6 Tf 5 5 Td (BL) Tj ET\nBT /F1 6 Tf 35 5 Td (BR) Tj ET",
			],
		] );
		$fileTitle = 'File:ViewerPinnedMultiPage.pdf';
		$pinnedFile = $this->uploadPdfBytes( $fourPageBytes, $fileTitle, '20261005100000', 'Original 4-page PDF' );
		$pinnedSha1 = $pinnedFile->getSha1();
		$pinnedTimestamp = $pinnedFile->getTimestamp();
		$pinnedSha256 = hash( 'sha256', $fourPageBytes );
		$physicalOriginal = (string)$this->getLocalRepo()->getBackend()->getFileContents(
			[ 'src' => $pinnedFile->getPath() ] );
		$this->assertSame( $fourPageBytes, $physicalOriginal );
		$this->assertSame( 4, $pinnedFile->pageCount() );
		$this->assertSame( '20261005100000', $pinnedTimestamp );

		// Capture pre-reupload renditions of original PDF pages
		$preThumbP1 = $pinnedFile->transform( [ 'width' => 1600, 'page' => 1 ] );
		$this->assertFalse( $preThumbP1->isError() );
		$preBytesP1 = file_get_contents( (string)$preThumbP1->getLocalCopyPath() );
		$preSha256P1 = hash( 'sha256', $preBytesP1 );
		$prePageBytes = [ 1 => $preBytesP1 ];
		foreach ( [ 2 => 1600, 3 => 1600, 4 => 665 ] as $pageNumber => $width ) {
			$originalThumb = $pinnedFile->transform( [ 'width' => $width, 'page' => $pageNumber ] );
			$this->assertFalse( $originalThumb->isError() );
			$prePageBytes[$pageNumber] = file_get_contents( (string)$originalThumb->getLocalCopyPath() );
		}

		// --- Step 2: Separate identities proof ---
		// Upload second file: File:ViewerOtherDoc.pdf
		$otherFileBytes = self::buildPdf( [
			[ 'width' => 200, 'height' => 100, 'stream' => 'BT /F1 10 Tf 10 50 Td (Other File Page 1) Tj ET' ],
		] );
		$otherFile = $this->uploadPdfBytes( $otherFileBytes, 'File:ViewerOtherDoc.pdf', '20261005103000' );

		// Owning Page A: owns layer set "Plan001" on File:ViewerPinnedMultiPage.pdf (pages 1, 2, 4)
		// and also owns layer set "Plan001" on File:ViewerOtherDoc.pdf.
		$pageA = $this->getExistingTestPage( 'PinnedViewerOwnerPageA' );
		$pageATitle = $pageA->getTitle();
		$pageAId = $pageA->getId();

		$surfaceP1 = $this->makeCustomPdfSurface(
			'p1_surf', 'Plan001', $fileTitle, $pinnedTimestamp, $pinnedSha1, 1, 416, 208,
			[ [
				'id' => 'note1', 'type' => 'text', 'x' => 20, 'y' => 30,
				'text' => 'Page 1 Landscape Note', 'fontSize' => 16, 'color' => '#ff0000',
			] ]
		);
		$surfaceP2 = $this->makeCustomPdfSurface(
			'p2_surf', 'Plan001', $fileTitle, $pinnedTimestamp, $pinnedSha1, 2, 208, 416,
			[ [
				'id' => 'note2', 'type' => 'text', 'x' => 10, 'y' => 50,
				'text' => 'Page 2 Portrait Marker', 'fontSize' => 14, 'color' => '#0000ff',
			] ]
		);
		$surfaceP4 = $this->makeCustomPdfSurface(
			'p4_surf', 'Plan001', $fileTitle, $pinnedTimestamp, $pinnedSha1, 4, 104, 625,
			[ [
				'id' => 'note4', 'type' => 'text', 'x' => 5, 'y' => 250,
				'text' => 'Page 4 Extreme Note', 'fontSize' => 10, 'color' => '#aa00aa',
			] ]
		);
		$surfaceOther = $this->makeCustomPdfSurface(
			'pOther_surf', 'Plan001', 'File:ViewerOtherDoc.pdf',
			$otherFile->getTimestamp(), $otherFile->getSha1(), 1, 416, 208,
			[ [
				'id' => 'noteOther', 'type' => 'text', 'x' => 10, 'y' => 10,
				'text' => 'Other File Note', 'fontSize' => 12, 'color' => '#008800',
			] ]
		);
		// Page 3 is intentionally unannotated (absent from surfaces)

		$docAJson = $this->buildDocument( [ $surfaceP1, $surfaceP2, $surfaceP4, $surfaceOther ] );
		$revAId = $this->publisher->publish(
			$pageATitle, $actor, $pageA->getLatest(), $docAJson, 'Publish Page A plan'
		);
		$this->assertGreaterThan( 0, $revAId );

		// Owning Page B: separate page owning its own "Plan001" on File:ViewerPinnedMultiPage.pdf,
		// intentionally reusing surface ID 'p1_surf' to prove cross-owner scope discrimination.
		$pageB = $this->getExistingTestPage( 'PinnedViewerOwnerPageB' );
		$pageBTitle = $pageB->getTitle();
		$pageBId = $pageB->getId();
		$surfaceB = $this->makeCustomPdfSurface(
			'p1_surf', 'Plan001', $fileTitle, $pinnedTimestamp, $pinnedSha1, 1, 416, 208,
			[ [
				'id' => 'noteB', 'type' => 'text', 'x' => 5, 'y' => 5,
				'text' => 'Page B Distinct Note', 'fontSize' => 12, 'color' => '#333333',
			] ]
		);
		$docBJson = $this->buildDocument( [ $surfaceB ] );
		$revBId = $this->publisher->publish(
			$pageBTitle, $actor, $pageB->getLatest(), $docBJson, 'Publish Page B plan'
		);
		$this->assertGreaterThan( 0, $revBId );

		// --- Step 3: Read published revisions through real PageReadService ---
		$readService = $this->createReadService();

		// Read Page A: verify complete surface/layer/canvas/source arrays
		$bundleA = $readService->read( $pageATitle, $revAId, $actor );
		$this->assertSame( $revAId, $bundleA['revisionId'] );
		$storedSurfacesA = $bundleA['snapshot']['surfaces'];
		$this->assertSame( self::comparablePayload( [ $surfaceP1, $surfaceP2, $surfaceP4, $surfaceOther ] ),
			self::comparablePayload( $storedSurfacesA ) );
		$this->assertCount( 4, $storedSurfacesA );
		$this->assertSame( 'p1_surf', $storedSurfacesA[0]['id'] );
		$this->assertSame( 'Page 1 Landscape Note', $storedSurfacesA[0]['layers'][0]['text'] );
		$this->assertSame( 'p2_surf', $storedSurfacesA[1]['id'] );
		$this->assertSame( 'Page 2 Portrait Marker', $storedSurfacesA[1]['layers'][0]['text'] );
		$this->assertSame( 'p4_surf', $storedSurfacesA[2]['id'] );
		$this->assertSame( 'Page 4 Extreme Note', $storedSurfacesA[2]['layers'][0]['text'] );
		$this->assertSame( 'pOther_surf', $storedSurfacesA[3]['id'] );
		$this->assertSame( 'Other File Note', $storedSurfacesA[3]['layers'][0]['text'] );

		// Read Page B: verify distinct layers on reused surface ID 'p1_surf'
		$bundleB = $readService->read( $pageBTitle, $revBId, $actor );
		$this->assertSame( $revBId, $bundleB['revisionId'] );
		$storedSurfacesB = $bundleB['snapshot']['surfaces'];
		$this->assertSame( self::comparablePayload( [ $surfaceB ] ), self::comparablePayload( $storedSurfacesB ) );
		$this->assertCount( 1, $storedSurfacesB );
		$this->assertSame( 'p1_surf', $storedSurfacesB[0]['id'] );
		$this->assertSame( 'Page B Distinct Note', $storedSurfacesB[0]['layers'][0]['text'] );

		// Bound surface reads via readBoundSurface
		$boundP1A = $readService->readBoundSurface( $pageATitle, $revAId, "v1:$pageAId:p1_surf", $actor );
		$this->assertSame( 'Page 1 Landscape Note', $boundP1A['surface']['layers'][0]['text'] );
		$this->assertSame( $pageAId, $boundP1A['pageId'] );

		$boundP1B = $readService->readBoundSurface( $pageBTitle, $revBId, "v1:$pageBId:p1_surf", $actor );
		$this->assertSame( 'Page B Distinct Note', $boundP1B['surface']['layers'][0]['text'] );
		$this->assertSame( $pageBId, $boundP1B['pageId'] );
		foreach ( [
			[ $pageATitle, $revAId, $pageAId, $surfaceP1 ],
			[ $pageATitle, $revAId, $pageAId, $surfaceP2 ],
			[ $pageATitle, $revAId, $pageAId, $surfaceP4 ],
			[ $pageATitle, $revAId, $pageAId, $surfaceOther ],
			[ $pageBTitle, $revBId, $pageBId, $surfaceB ],
		] as [ $ownerTitle, $revisionId, $ownerId, $expectedSurface ] ) {
			$bound = $readService->readBoundSurface( $ownerTitle, $revisionId,
				'v1:' . $ownerId . ':' . $expectedSurface['id'], $actor );
			$this->assertSame( $ownerId, $bound['pageId'] );
			$this->assertSame( $revisionId, $bound['revisionId'] );
			$this->assertSame( self::comparablePayload( $expectedSurface ),
				self::comparablePayload( $bound['surface'] ) );
		}

		// Refusals on foreign revision, foreign binding, and denied reader
		$deniedActor = $this->createMock( Authority::class );
		$deniedActor->method( 'authorizeRead' )->willReturn( false );

		try {
			$readService->readBoundSurface( $pageATitle, $revBId, "v1:$pageAId:p1_surf", $actor );
			$this->fail( 'Expected DomainException for foreign revision' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		try {
			$readService->readBoundSurface( $pageATitle, $revAId, "v1:$pageBId:p1_surf", $actor );
			$this->fail( 'Expected DomainException for foreign binding' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		try {
			$readService->read( $pageATitle, $revAId, $deniedActor );
			$this->fail( 'Expected DomainException for denied reader' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// --- Step 4: Reupload replacement PDF (different bytes, geometry, page count) ---
		$replacementBytes = self::buildPdf( [
			[
				'width' => 300, 'height' => 150,
				'stream' => 'BT /F1 12 Tf 10 50 Td (Replacement Current Upload Single Page) Tj ET',
			],
		] );
		$replacementFile = $this->uploadPdfBytes(
			$replacementBytes, $fileTitle, '20261005120000', 'Replacement upload 1-page PDF'
		);
		$replacementSha256 = hash( 'sha256', $replacementBytes );
		$this->assertSame( 1, $replacementFile->pageCount() );
		$this->assertSame( '20261005120000', $replacementFile->getTimestamp() );
		$this->assertNotSame( $pinnedSha1, $replacementFile->getSha1() );
		$this->assertNotSame( $pinnedSha256, $replacementSha256 );

		// Render replacement Page 1 and show it differs from original Page 1
		$repThumbP1 = $replacementFile->transform( [ 'width' => 1600, 'page' => 1 ] );
		$this->assertFalse( $repThumbP1->isError() );
		$repBytesP1 = file_get_contents( (string)$repThumbP1->getLocalCopyPath() );
		$repSha256P1 = hash( 'sha256', $repBytesP1 );
		$this->assertNotSame( $preSha256P1, $repSha256P1 );

		// --- Step 5: Post-reupload archived source check ---
		$contentA = new LayersDocumentContent( $docAJson );
		$resolved = $this->resolver->resolve( $contentA, $actor, [ 'p1_surf', 'p2_surf', 'p4_surf' ] );

		/** @var OldLocalFile $resolvedP1File */
		$resolvedP1File = $resolved['p1_surf'];
		$this->assertInstanceOf( File::class, $resolvedP1File );
		$this->assertTrue( $resolvedP1File->isOld() );
		$this->assertSame( $pinnedTimestamp, $resolvedP1File->getTimestamp() );
		$this->assertSame( $pinnedSha1, $resolvedP1File->getSha1() );
		// Retains 4 pages, NOT replacement's 1 page!
		$this->assertSame( 4, $resolvedP1File->pageCount() );

		// Compare physical archived source bytes on disk to original PDF bytes before reupload
		$archivedSourceBytes = (string)$this->getLocalRepo()->getBackend()->getFileContents( [
			'src' => $resolvedP1File->getPath(),
		] );
		$this->assertSame( $pinnedSha256, hash( 'sha256', $archivedSourceBytes ) );
		$this->assertSame( $fourPageBytes, $archivedSourceBytes );
		$this->assertSame( $physicalOriginal, $archivedSourceBytes );

		// --- Step 6: Native renditions & Truthful Decoded Dimensions ---
		// Page 1 (200x100 pt, aspect 2:1)
		$thumbP1 = $resolvedP1File->transform( [ 'width' => 1600, 'page' => 1 ] );
		$this->assertFalse( $thumbP1->isError() );
		$pathP1 = (string)$thumbP1->getLocalCopyPath();
		$decodedP1 = self::decodeImage( $pathP1 );
		$this->assertSame( 'JPEG', $decodedP1['format'] );
		$this->assertSame( 1600, $decodedP1['width'] );
		// Actual decoded pixels: 1600x798 (metadata says 1600x800)
		$this->assertSame( 798, $decodedP1['height'] );
		$this->assertSame( 1600, $thumbP1->getWidth() );
		$this->assertSame( 800, $thumbP1->getHeight() );

		// Page 2 (100x200 pt, aspect 1:2)
		$thumbP2 = $resolvedP1File->transform( [ 'width' => 1600, 'page' => 2 ] );
		$this->assertFalse( $thumbP2->isError() );
		$pathP2 = (string)$thumbP2->getLocalCopyPath();
		$decodedP2 = self::decodeImage( $pathP2 );
		$this->assertSame( 'JPEG', $decodedP2['format'] );
		$this->assertSame( 1600, $decodedP2['width'] );
		// Actual decoded pixels: 1600x3208 (metadata says 1600x3200)
		$this->assertSame( 3208, $decodedP2['height'] );
		$this->assertSame( 1600, $thumbP2->getWidth() );
		$this->assertSame( 3200, $thumbP2->getHeight() );

		// Page 3 (150x150 pt, square 1:1, unannotated)
		$thumbP3 = $resolvedP1File->transform( [ 'width' => 1600, 'page' => 3 ] );
		$this->assertFalse( $thumbP3->isError() );
		$pathP3 = (string)$thumbP3->getLocalCopyPath();
		$decodedP3 = self::decodeImage( $pathP3 );
		$this->assertSame( 'JPEG', $decodedP3['format'] );
		$this->assertSame( 1600, $decodedP3['width'] );
		$this->assertSame( 1600, $decodedP3['height'] );

		// Page 4 (50x300 pt, extreme portrait 1:6)
		// Sizing adapter scales width down from 1600 to 665 so largest side stays <= 4000
		$adaptedP4 = $this->adaptViewerPageRendition( $resolvedP1File, 4, $storedSurfacesA[2], 1600, 4000 );
		$this->assertLessThanOrEqual( 4000, max( $adaptedP4['source']['width'], $adaptedP4['source']['height'] ) );
		$thumbP4 = $resolvedP1File->transform( [ 'width' => $adaptedP4['source']['width'], 'page' => 4 ] );
		$pathP4 = (string)$thumbP4->getLocalCopyPath();
		$decodedP4 = self::decodeImage( $pathP4 );
		$this->assertSame( 'JPEG', $decodedP4['format'] );
		$this->assertSame( 665, $decodedP4['width'] );
		$this->assertSame( 3996, $decodedP4['height'] );
		foreach ( [ 1 => $pathP1, 2 => $pathP2, 3 => $pathP3, 4 => $pathP4 ] as $pageNumber => $path ) {
			$this->assertSame( $prePageBytes[$pageNumber], file_get_contents( $path ),
				'Original and archived render bytes agree for PDF page ' . $pageNumber );
		}

		// --- Step 7: Feed Test Adapter from Authorized Stored Read ---
		$adapterP1 = $this->adaptViewerPageRendition( $resolvedP1File, 1, $storedSurfacesA[0], 1600 );
		$this->assertSame( 'Page 1 Landscape Note', $adapterP1['layers'][0]['text'] );

		$adapterP2 = $this->adaptViewerPageRendition( $resolvedP1File, 2, $storedSurfacesA[1], 1600 );
		$this->assertSame( 'Page 2 Portrait Marker', $adapterP2['layers'][0]['text'] );

		// Unannotated Page 3 access: capture storage witness rows before and after
		$witnessBefore = $this->captureStorageWitnessRows();

		$adapterP3 = $this->adaptViewerPageRendition( $resolvedP1File, 3, null, 1600 );
		// No synthetic surface ID
		$this->assertNull( $adapterP3['surface'] );
		// Empty layer list
		$this->assertSame( [], $adapterP3['layers'] );
		$this->assertSame( 312, $adapterP3['canvas']['width'] );
		$this->assertSame( 312, $adapterP3['canvas']['height'] );

		// Re-read Page A through PageReadService: assert no surface, name, or revision added
		$bundleAfter = $readService->read( $pageATitle, $revAId, $actor );
		$this->assertSame( $bundleA['snapshot'], $bundleAfter['snapshot'] );

		$witnessAfter = $this->captureStorageWitnessRows();
		$this->assertSame( $witnessBefore['page'], $witnessAfter['page'] );
		$this->assertSame( $witnessBefore['revision'], $witnessAfter['revision'] );
		$this->assertSame( $witnessBefore['slots'], $witnessAfter['slots'] );
		$this->assertSame( $witnessBefore['content'], $witnessAfter['content'] );
		$this->assertSame( $witnessBefore['text'], $witnessAfter['text'] );

		// --- Step 8: Export Correction Artifacts to acceptance/j114b1 ---
		$runDir = $this->evidenceDirectory();
		foreach ( $prePageBytes as $pageNumber => $bytes ) {
			file_put_contents( $runDir . '/before-reupload-page-' . $pageNumber . '.jpg', $bytes );
		}
		file_put_contents( $runDir . '/authorized-expected-and-read.json', json_encode( [
			'expectedA' => json_decode( $docAJson, true ), 'readA' => $bundleA,
			'expectedB' => json_decode( $docBJson, true ), 'readB' => $bundleB,
			'witnessBefore' => $witnessBefore, 'witnessAfter' => $witnessAfter,
		], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );
		file_put_contents( $runDir . '/pinned-original-fixture.pdf', $fourPageBytes );
		file_put_contents( $runDir . '/replacement-fixture.pdf', $replacementBytes );
		file_put_contents( $runDir . '/pinned-page-1-1600w.jpg', file_get_contents( $pathP1 ) );
		file_put_contents( $runDir . '/pinned-page-2-1600w.jpg', file_get_contents( $pathP2 ) );
		file_put_contents( $runDir . '/pinned-page-3-1600w.jpg', file_get_contents( $pathP3 ) );
		file_put_contents( $runDir . '/pinned-page-4-665w.jpg', file_get_contents( $pathP4 ) );
		file_put_contents( $runDir . '/replacement-page-1-1600w.jpg', $repBytesP1 );
	}

	/**
	 * Journey 4: Resolver refuses unavailable sources (missing archive bytes,
	 * suppressed old media, out-of-range pages), restores modified state in finally,
	 * and characterizes direct transform() clamping versus server validation.
	 */
	public function testResolverRefusesUnavailableSourcesAndNeverSubstitutesCurrentUpload(): void {
		$actor = $this->actor();

		$pdfBytes = self::buildPdf( [
			[ 'width' => 200, 'height' => 100, 'stream' => 'BT /F1 10 Tf 10 50 Td (Original P1) Tj ET' ],
			[ 'width' => 200, 'height' => 100, 'stream' => 'BT /F1 10 Tf 10 50 Td (Original P2) Tj ET' ],
		] );
		$fileTitle = 'File:ViewerRefusalTest.pdf';
		$pinnedFile = $this->uploadPdfBytes( $pdfBytes, $fileTitle, '20261005110000' );
		$pinnedTimestamp = $pinnedFile->getTimestamp();
		$pinnedSha1 = $pinnedFile->getSha1();

		$page = $this->getExistingTestPage( 'PinnedViewerRefusalOwner' );
		$surface1 = $this->makeCustomPdfSurface(
			'ref_surf1', 'RefusalSet', $fileTitle, $pinnedTimestamp, $pinnedSha1, 1, 416, 208
		);
		$docJson = $this->buildDocument( [ $surface1 ] );
		$revId = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(), $docJson, 'Pinned doc' );

		// Reupload replacement
		$repBytes = self::buildPdf( [
			[
				'width' => 300, 'height' => 150,
				'stream' => 'BT /F1 10 Tf 10 50 Td (Replacement) Tj ET',
			],
		] );
		$this->uploadPdfBytes( $repBytes, $fileTitle, '20261005120000' );

		$content = new LayersDocumentContent( $docJson );
		$resolved = $this->resolver->resolve( $content, $actor );
		$archiveFile = $resolved['ref_surf1'];
		$archivePath = $archiveFile->getPath();
		$archiveName = $archiveFile->getName();
		$archiveIdentity = [ 'oi_name' => $archiveName, 'oi_timestamp' => $pinnedTimestamp ];
		$originalVisibility = $this->getDb()->newSelectQueryBuilder()->select( 'oi_deleted' )
			->from( 'oldimage' )->where( $archiveIdentity )->caller( __METHOD__ )->fetchField();
		$this->assertNotFalse( $originalVisibility );

		$readService = $this->createReadService();
		$baselineBundle = $readService->read( $page->getTitle(), $revId, $actor );
		$this->assertNotEmpty( $baselineBundle['sourceRenditions'] );

		// --- Case 4.1: Missing archive bytes with finally restoration ---
		try {
			$this->getLocalRepo()->getBackend()->delete( [ 'src' => $archivePath ] );
			$this->assertFalse( $this->getLocalRepo()->fileExists( $archivePath ) );

			// Resolver MUST refuse unavailable pinned source; current upload MUST NOT be substituted
			try {
				$this->resolver->resolve( $content, $actor );
				$this->fail( 'Expected DomainException for missing archive bytes' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
			}
			try {
				$readService->read( $page->getTitle(), $revId, $actor );
				$this->fail( 'Expected read refusal for missing archive bytes' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
			}
		} finally {
			// Restore archive bytes
			$this->getLocalRepo()->getBackend()->quickCreate( [ 'dst' => $archivePath, 'content' => $pdfBytes ] );
		}
		$this->assertTrue( $this->getLocalRepo()->fileExists( $archivePath ) );
		$this->assertSame(
			hash( 'sha256', $pdfBytes ),
			hash( 'sha256', (string)$this->getLocalRepo()->getBackend()->getFileContents( [ 'src' => $archivePath ] ) )
		);
		// Rerun identical read after restoration to verify full recovery
		$restoredBundle1 = $readService->read( $page->getTitle(), $revId, $actor );
		$this->assertSame( $baselineBundle['sourceRenditions'], $restoredBundle1['sourceRenditions'] );

		// --- Case 4.2: Suppressed old media (oi_deleted) with finally restoration ---
		try {
			$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
				->set( [ 'oi_deleted' => File::DELETED_FILE ] )
				->where( $archiveIdentity )
				->caller( __METHOD__ )->execute();

			try {
				$this->resolver->resolve( $content, $actor );
				$this->fail( 'Expected DomainException for suppressed old media' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
			}
			try {
				$readService->read( $page->getTitle(), $revId, $actor );
				$this->fail( 'Expected read refusal for suppressed archive media' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
			}
		} finally {
			// Restore original visibility
			$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
				->set( [ 'oi_deleted' => (int)$originalVisibility ] )
				->where( $archiveIdentity )
				->caller( __METHOD__ )->execute();
		}
		// Verify visibility restored and rerun identical read
		$this->assertSame( (string)$originalVisibility, (string)$this->getDb()
			->newSelectQueryBuilder()->select( 'oi_deleted' )->from( 'oldimage' )
			->where( $archiveIdentity )->caller( __METHOD__ )->fetchField() );
		$restoredBundle2 = $readService->read( $page->getTitle(), $revId, $actor );
		$this->assertSame( $baselineBundle['sourceRenditions'], $restoredBundle2['sourceRenditions'] );

		// --- Case 4.3: Out-of-bounds page request in document schema ---
		$outOfBoundsSurface = $this->makeCustomPdfSurface(
			'out_surf', 'RefusalSet', $fileTitle, $pinnedTimestamp, $pinnedSha1, 99, 416, 208
		);
		$outDocContent = new LayersDocumentContent( $this->buildDocument( [ $outOfBoundsSurface ] ) );
		try {
			$this->resolver->resolve( $outDocContent, $actor );
			$this->fail( 'Expected DomainException for out-of-range PDF page' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}

		// --- Case 4.4: Direct transform() parameter clamping & error boundary characterization ---
		$validResolved = $this->resolver->resolve( $content, $actor );
		$validFile = $validResolved['ref_surf1'];

		// Core's ImageHandler::normaliseParams() silently clamps out-of-range page numbers:
		// page 99 is clamped to pageCount() (2), so transform() does NOT error.
		// This proves why direct transform() is not the viewer API's generic error boundary,
		// and why SourceVersionResolver / PageReadService viewer bounds checks are strictly required.
		$clampedThumb = $validFile->transform( [ 'width' => 1600, 'page' => 99 ] );
		$this->assertFalse( $clampedThumb->isError(), 'Core normaliseParams() clamps page 99 to pageCount()' );
		$this->assertStringContainsString( 'page2-', $clampedThumb->getUrl() );

		// Similarly, page 0 is clamped to page 1 by core ImageHandler::normaliseParams()
		$zeroClampedThumb = $validFile->transform( [ 'width' => 1600, 'page' => 0 ] );
		$this->assertFalse( $zeroClampedThumb->isError(), 'Core normaliseParams() clamps page 0 to page 1' );
		$this->assertStringContainsString( 'page1-', $zeroClampedThumb->getUrl() );

		// Invalid transform parameters (e.g. missing width) return TransformParameterError
		$invalidParamThumb = $validFile->transform( [ 'page' => 1 ] );
		$this->assertTrue( $invalidParamThumb->isError(), 'Missing width produces TransformParameterError' );
	}

	/**
	 * Journey 5: Characterize why the inline forSurface() width policy alone
	 * is insufficient for full-size viewing.
	 */
	public function testSmallInlineCanvasProducesInsufficientFullSizeRendition(): void {
		$actor = $this->actor();
		$pdfBytes = self::buildPdf( [
			[ 'width' => 200, 'height' => 100, 'stream' => 'BT /F1 10 Tf 10 50 Td (Small Canvas Test) Tj ET' ],
		] );
		$file = $this->uploadPdfBytes( $pdfBytes, 'File:ViewerSmallCanvas.pdf', '20261005113000' );

		// An author specifies a small inline thumbnail canvas (200x100)
		$smallSurface = $this->makeCustomPdfSurface(
			'small_surf', 'SmallSet', 'File:ViewerSmallCanvas.pdf',
			$file->getTimestamp(), $file->getSha1(), 1, 200, 100
		);

		$sourceRenditions = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );

		// Current forSurface() requests: min(canvas.width, 2048) = min(200, 2048) = 200
		$rendition = $sourceRenditions->forSurface( $file, $smallSurface );

		$this->assertSame( 200, $rendition['width'] );
		$this->assertSame( 100, $rendition['height'] );

		// Direct full-size viewer request requests width 1600 within 4000px budget
		$fullSizeThumb = $file->transform( [ 'width' => 1600, 'page' => 1 ] );
		$this->assertFalse( $fullSizeThumb->isError() );

		// Decoded image verification
		$smallThumb = $file->transform( [ 'width' => 200, 'page' => 1 ] );
		$smallPath = (string)$smallThumb->getLocalCopyPath();
		$smallDecoded = self::decodeImage( $smallPath );
		$this->assertSame( 'JPEG', $smallDecoded['format'] );
		$this->assertSame( 200, $smallDecoded['width'] );
		$this->assertSame( 100, $smallDecoded['height'] );

		// Characterization: The inline rendition is 8x smaller in linear resolution (64x smaller in pixel area)
		$this->assertSame( 8, (int)( $fullSizeThumb->getWidth() / $rendition['width'] ) );

		// Archive small-inline rendition for visual comparison by lead
		$runDir = $this->evidenceDirectory();
		file_put_contents( $runDir . '/small-inline-page-1-200w.jpg', file_get_contents( $smallPath ) );
	}
}
