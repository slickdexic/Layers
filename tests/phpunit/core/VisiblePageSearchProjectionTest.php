<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Search\VisiblePageSearchProjection;
use MediaWiki\Permissions\Authority;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Search\VisiblePageSearchProjection
 * @group Database
 */
class VisiblePageSearchProjectionTest extends RealAssetTestCase {
	public function testFileVisibilityIsCheckedIndependentlyOfSlideText(): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Projection-visibility-' . wfRandomString( 8 ) . '.png' );
		$surface = $this->makeImageSurface( 'image', 'Image label', $file->getTitle()->getPrefixedDBkey(),
			$file->getTimestamp(), $file->getSha1() );
		$surface['layers'] = $this->makeSlideSurface()['layers'];
		$surface['layers'][0]['text'] = 'image marker';
		$surface['layers'][0]['link'] = 'Image_Target';
		$surface['readingOrder'] = [ 'title' ];
		$slide = $this->makeSlideSurface( 'slide', 'Slide label' );
		$slide['layers'][0]['text'] = 'slide marker';
		$content = new LayersDocumentContent( $this->buildDocument( [ $surface, $slide ] ) );
		$projection = new VisiblePageSearchProjection( $this->resolver );
		$actor = $this->actor();
		$this->assertStringContainsString( 'image marker', $projection->get( $content, $actor ) );
		$denied = $this->createMock( Authority::class );
		$denied->method( 'authorizeRead' )->willReturnCallback(
			static fn ( $right, $title ) => !$title->equals( $file->getTitle() ) &&
				$actor->authorizeRead( $right, $title ) );
		$this->assertStringNotContainsString( 'image marker', $projection->get( $content, $denied ) );
		$this->assertStringNotContainsString( 'Image_Target', $projection->get( $content, $denied ) );
		$this->assertStringContainsString( 'slide marker', $projection->get( $content, $denied ) );
		$this->assertStatusGood( $file->deleteFile( 'Synthetic fixture', $this->getTestSysop()->getUser(), true ) );
		$this->assertStringNotContainsString( 'image marker', $projection->get( $content, $actor ) );
		$this->assertStringContainsString( 'slide marker', $projection->get( $content, $actor ) );
		$this->assertSame( '', $projection->get( new LayersDocumentContent( 'invalid json' ), $actor ) );
	}
}
