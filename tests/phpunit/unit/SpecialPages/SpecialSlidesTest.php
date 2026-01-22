<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\SpecialPages;

use MediaWiki\Extension\Layers\SpecialPages\SpecialSlides;
use PHPUnit\Framework\TestCase;

/**
 * Tests for SpecialSlides special page.
 *
 * @coversDefaultClass \MediaWiki\Extension\Layers\SpecialPages\SpecialSlides
 * @group Layers
 */
class SpecialSlidesTest extends TestCase {

	/**
	 * @covers ::__construct
	 */
	public function testConstructorSetsCorrectName(): void {
		$special = new SpecialSlides();

		// Use reflection to access the protected mName property
		$reflection = new \ReflectionClass( $special );
		$property = $reflection->getProperty( 'mName' );
		$property->setAccessible( true );

		$this->assertSame( 'Slides', $property->getValue( $special ) );
	}

	/**
	 * @covers ::getGroupName
	 */
	public function testGroupNameIsMedia(): void {
		$special = new SpecialSlides();

		$reflection = new \ReflectionClass( $special );
		$method = $reflection->getMethod( 'getGroupName' );
		$method->setAccessible( true );

		$this->assertSame( 'media', $method->invoke( $special ) );
	}
}
