<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Hooks\PageOwnedHistoryHooks;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use RequestContext;

/** @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedHistoryHooks */
class PageOwnedHistoryHooksTest extends \MediaWikiIntegrationTestCase {
	public function testExactLinkEncodingAndOriginalAuthority(): void {
		$context = new RequestContext();
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( 'History Owner' );
		$context->setTitle( $title );
		$pilot = $this->createMock( PageOwnedPilot::class );
		$pilot->expects( $this->once() )->method( 'getHistorySurfaces' )
			->with( $title, 123, $this->identicalTo( $context->getAuthority() ) )
			->willReturn( [ [ 'id' => 'surface & one', 'label' => '<img src=x onerror=alert(1)>' ] ] );
		$hook = new PageOwnedHistoryHooks( $pilot, $this->getServiceContainer()->getLinkRenderer() );
		$row = (object)[ 'rev_id' => 123 ];
		$html = 'Existing history';
		$classes = [ 'existing' ];
		$attributes = [ 'data-mw-revid' => 123 ];
		$hook->onPageHistoryLineEnding( $context, $row, $html, $classes, $attributes );
		$this->assertStringStartsWith( 'Existing history ', $html );
		$this->assertStringContainsString( 'revid=123', $html );
		$this->assertStringContainsString( 'surface=surface', $html );
		$this->assertStringNotContainsString( '<img', $html );
		$this->assertStringContainsString( '&lt;img', $html );
		$this->assertSame( [ 'existing' ], $classes );
		$this->assertSame( [ 'data-mw-revid' => 123 ], $attributes );
	}

	public function testUnavailableRevisionLeavesHistoryUntouched(): void {
		$context = new RequestContext();
		$context->setTitle( $this->getServiceContainer()->getTitleFactory()->newFromText( 'History Owner' ) );
		$pilot = $this->createMock( PageOwnedPilot::class );
		$pilot->method( 'getHistorySurfaces' )->willThrowException( new \DomainException( 'private' ) );
		$hook = new PageOwnedHistoryHooks( $pilot, $this->getServiceContainer()->getLinkRenderer() );
		$row = (object)[ 'rev_id' => 123 ];
		$html = 'Existing history';
		$classes = [];
		$attributes = [];
		$hook->onPageHistoryLineEnding( $context, $row, $html, $classes, $attributes );
		$this->assertSame( 'Existing history', $html );
	}
}
