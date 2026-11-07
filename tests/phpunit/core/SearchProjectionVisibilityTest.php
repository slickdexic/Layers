<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;

/** @covers \MediaWiki\Extension\Layers\Revision\PageDrawingSearchText */
class SearchProjectionVisibilityTest extends \MediaWikiIntegrationTestCase {
	public function testOnlyAdmittedFileSurfacesAndSlidesContributeTerms(): void {
		$surface = static fn ( string $id, string $kind ): array => [
			'id' => $id, 'kind' => $kind, 'label' => $id . 'label',
			'layers' => [ [ 'text' => $id . 'text', 'link' => $id . '_target' ] ]
		];
		$content = new LayersDocumentContent( json_encode( [ 'schemaVersion' => 1, 'surfaces' => [
			$surface( 'image', 'image' ), $surface( 'pdfone', 'pdf' ), $surface( 'pdftwo', 'pdf' ),
			$surface( 'slide', 'slide' ), $surface( 'unknown', 'unknown' )
		] ] ) );
		$result = PageDrawingSearchText::extractWithAdmittedSources( $content, [ 'image', 'pdftwo' ] );
		foreach ( [ 'imagelabel', 'imagetext', 'image_target', 'pdftwotext', 'slidetext' ] as $term ) {
			$this->assertStringContainsString( $term, $result );
		}
		foreach ( [ 'pdfonelabel', 'pdfonetext', 'pdfone_target', 'unknowntext' ] as $term ) {
			$this->assertStringNotContainsString( $term, $result );
		}
		$this->assertStringContainsString( 'pdfonetext', PageDrawingSearchText::extract( $content ),
			'Approved option A keeps page-owned text independent of file-source admission.' );
	}
}
