<?php

namespace MediaWiki\Extension\Layers\Tests;

use MediaWiki\Extension\Layers\Hooks;

/**
 * @coversDefaultClass \MediaWiki\Extension\Layers\Hooks
 */
class HooksTest extends \MediaWikiUnitTestCase {

	/**
	 * @covers ::onBeforePageDisplay
	 */
	public function testOnBeforePageDisplayWithFileNamespace() {
		$config = new \HashConfig( [
			'LayersEnable' => true
		] );
		$outputPageMock = $this->getMockBuilder( \OutputPage::class )
			->disableOriginalConstructor()
			->getMock();
		$outputPageMock->method( 'getConfig' )
			->willReturn( $config );

		$titleMock = $this->getMockBuilder( \Title::class )
			->disableOriginalConstructor()
			->getMock();
		$titleMock->method( 'inNamespace' )
			->with( NS_FILE )
			->willReturn( true );

		$userMock = $this->getMockBuilder( \User::class )
			->disableOriginalConstructor()
			->getMock();
		$userMock->method( 'isAllowed' )
			->with( 'editlayers' )
			->willReturn( true );

		$outputPageMock->method( 'getTitle' )
			->willReturn( $titleMock );
		$outputPageMock->method( 'getUser' )
			->willReturn( $userMock );

		$outputPageMock->expects( $this->exactly( 2 ) )
			->method( 'addModules' )
			->withConsecutive( [ 'ext.layers.editor' ], [ 'ext.layers' ] );

		$skinMock = $this->getMockBuilder( \Skin::class )
			->disableOriginalConstructor()
			->getMock();

		( new Hooks )->onBeforePageDisplay( $outputPageMock, $skinMock );
	}

	/**
	 * @covers ::onBeforePageDisplay
	 */
	public function testOnBeforePageDisplayDisabled() {
		$config = new \HashConfig( [
			'LayersEnable' => false
		] );
		$outputPageMock = $this->getMockBuilder( \OutputPage::class )
			->disableOriginalConstructor()
			->getMock();
		$outputPageMock->method( 'getConfig' )
			->willReturn( $config );
		$outputPageMock->expects( $this->never() )
			->method( 'addModules' );
		
		$skinMock = $this->getMockBuilder( \Skin::class )
			->disableOriginalConstructor()
			->getMock();
		
		( new Hooks )->onBeforePageDisplay( $outputPageMock, $skinMock );
	}

}
