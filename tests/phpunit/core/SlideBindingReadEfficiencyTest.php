<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageReadService::readBoundSurfaces
 * @group Database
 */
class SlideBindingReadEfficiencyTest extends \MediaWikiIntegrationTestCase {
	public function testSlideBindingsDoNotResolveOrDecodeFileSourcesAgain(): void {
		$page = $this->getExistingTestPage( 'Slide binding read efficiency' );
		$fixture = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$content = new LayersDocumentContent( $fixture );
		$surface = json_decode( $fixture, true )['surfaces'][0];
		$access = $this->createMock( PageHistoryAccess::class );
		$access->expects( $this->once() )->method( 'read' )->willReturn( $content );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$sources->expects( $this->never() )->method( 'resolveIndividually' );
		$service = new PageReadService( $access, $sources );
		$binding = 'v1:' . $page->getId() . ':' . $surface['id'];
		$result = $service->readBoundSurfaces( $page->getTitle(), $page->getLatest(), [ $binding ],
			$this->getTestUser()->getUser() );
		$this->assertSame( $surface, $result[$binding]['surface'] );
	}

	public function testMixedBindingsResolveFilesTogetherAndOmitUnavailableSources(): void {
		$page = $this->getExistingTestPage( 'Mixed binding read efficiency' );
		$fixture = file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' );
		$content = new LayersDocumentContent( $fixture );
		$surfaces = json_decode( $fixture, true )['surfaces'];
		$access = $this->createMock( PageHistoryAccess::class );
		$access->expects( $this->once() )->method( 'read' )->willReturn( $content );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$sources->expects( $this->once() )->method( 'resolveIndividually' )
			->with( $content, $this->anything(), [ 'diagram', 'reference' ] )
			->willReturn( [ 'diagram' => $this->createMock( \MediaWiki\FileRepo\File\File::class ) ] );
		$service = new PageReadService( $access, $sources );
		$prefix = 'v1:' . $page->getId() . ':';
		$result = $service->readBoundSurfaces( $page->getTitle(), $page->getLatest(),
			[ $prefix . 'presentation', $prefix . 'diagram', $prefix . 'reference' ],
			$this->getTestUser()->getUser() );
		$this->assertSame( $surfaces[0], $result[$prefix . 'presentation']['surface'] );
		$this->assertSame( $surfaces[1], $result[$prefix . 'diagram']['surface'] );
		$this->assertArrayNotHasKey( $prefix . 'reference', $result );
	}
}
