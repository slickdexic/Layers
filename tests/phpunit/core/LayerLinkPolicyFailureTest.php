<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Validation\LayerLinkValidator;
use MediaWiki\Utils\UrlUtils;

/** @covers \MediaWiki\Extension\Layers\Validation\LayerLinkValidator */
class LayerLinkPolicyFailureTest extends \MediaWikiIntegrationTestCase {
	public function testRestrictiveProtocolPolicyDoesNotAdmitDisallowedUrls(): void {
		$validator = new LayerLinkValidator( 'https:\/\/' );
		$this->assertTrue( $validator->validate( 'https://example.org' )['valid'] );
		$this->assertFalse( $validator->validate( 'http://example.org' )['valid'] );
		$this->assertFalse( $validator->validate( 'mailto:person@example.org' )['valid'] );
		$this->assertTrue( $validator->validate( 'Main Page' )['valid'] );
	}

	public function testNativePolicyFailureRefusesLinksWithoutRefusingUnlinkedWork(): void {
		$service = $this->createMock( UrlUtils::class );
		$service->method( 'validProtocols' )->willThrowException( new \RuntimeException( 'Synthetic failure' ) );
		$this->setService( 'UrlUtils', $service );
		$validator = new LayerLinkValidator();
		$this->assertFalse( $validator->validate( 'https://example.org' )['valid'] );
		$this->assertFalse( $validator->validate( 'Main Page' )['valid'] );
		$input = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$this->assertNotEmpty( ( new DocumentSchema() )->canonicalize( $input ) );
	}
}
