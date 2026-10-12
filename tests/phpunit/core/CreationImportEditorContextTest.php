<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/NativeCreationImportApiTest.php';

/**
 * Native editor context for independently admitted missing image/slide members.
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class CreationImportEditorContextTest extends NativeCreationImportApiTest {

	public static function provideCreationCases(): array {
		return [ [ 'image', false ], [ 'image', true ], [ 'slide', false ], [ 'slide', true ] ];
	}

	/** @dataProvider provideCreationCases */
	public function testCreationSelectionRetainsExactNativeEmbed( string $kind, bool $slot ): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$fixture = $access->fixture( $kind, $slot );
		$init = $fixture['pilot']->prepareBoundEditor( $fixture['page']->getId(), $fixture['revision'],
			$fixture['start'], $fixture['expected'], $access->actor );
		$this->assertArrayHasKey( 'creationSelection', $init['pageOwned'] );
		$this->assertSame( [ 'start' => $fixture['start'], 'expected' => $fixture['expected'] ],
			$init['pageOwned']['creationSelection'] );
		$this->assertSame( $fixture['page']->getId(), $init['pageOwned']['pageId'] );
		$this->assertSame( $fixture['revision'], $init['pageOwned']['revisionId'] );
		$this->assertSame( $fixture['id'], $init['pageOwned']['surfaceId'] );
		$this->assertSame( !$slot, $init['pageOwned']['emptyBase'] );
		$this->assertSame( $kind, $init['pageOwned']['newSurface']['kind'] );
		$this->assertSame( [], $init['pageOwned']['newSurface']['layers'] );
		$this->assertSame( $fixture['revision'], (int)$this->getDb()->newSelectQueryBuilder()
			->select( 'page_latest' )->from( 'page' )->where( [ 'page_id' => $fixture['page']->getId() ] )
			->caller( __METHOD__ )->fetchField() );
		$this->assertSame( "Préface π\n" . $fixture['expected'],
			$this->getServiceContainer()->getRevisionLookup()->getRevisionById( $fixture['revision'] )
				->getContent( 'main' )->getText() );
	}
}
