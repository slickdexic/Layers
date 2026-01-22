<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\SpecialPages;

use MediaWiki\Extension\Layers\SpecialPages\SpecialEditSlide;
use PHPUnit\Framework\TestCase;

/**
 * Tests for SpecialEditSlide special page.
 *
 * @coversDefaultClass \MediaWiki\Extension\Layers\SpecialPages\SpecialEditSlide
 * @group Layers
 */
class SpecialEditSlideTest extends TestCase {

	/**
	 * @covers ::__construct
	 */
	public function testConstructorSetsCorrectName(): void {
		$special = new SpecialEditSlide();

		$reflection = new \ReflectionClass( $special );
		$property = $reflection->getProperty( 'mName' );
		$property->setAccessible( true );

		$this->assertSame( 'EditSlide', $property->getValue( $special ) );
	}

	/**
	 * @covers ::getGroupName
	 */
	public function testGroupNameIsMedia(): void {
		$special = new SpecialEditSlide();

		$reflection = new \ReflectionClass( $special );
		$method = $reflection->getMethod( 'getGroupName' );
		$method->setAccessible( true );

		$this->assertSame( 'media', $method->invoke( $special ) );
	}
}
