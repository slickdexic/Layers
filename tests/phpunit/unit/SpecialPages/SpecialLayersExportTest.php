<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\SpecialPages;

use MediaWiki\Extension\Layers\SpecialPages\SpecialLayersExport;
use PHPUnit\Framework\TestCase;

/**
 * Tests for Special:LayersExport.
 *
 * @coversDefaultClass \MediaWiki\Extension\Layers\SpecialPages\SpecialLayersExport
 * @group Layers
 */
class SpecialLayersExportTest extends TestCase {

	/**
	 * @param string $method
	 * @param array $args
	 * @return mixed
	 */
	private function invoke( string $method, array $args = [] ) {
		$special = new SpecialLayersExport();
		$reflection = new \ReflectionClass( $special );
		$m = $reflection->getMethod( $method );
		$m->setAccessible( true );
		return $m->invokeArgs( $special, $args );
	}

	/**
	 * @covers ::__construct
	 */
	public function testConstructorSetsCorrectName(): void {
		$special = new SpecialLayersExport();

		$reflection = new \ReflectionClass( $special );
		$property = $reflection->getProperty( 'mName' );
		$property->setAccessible( true );

		$this->assertSame( 'LayersExport', $property->getValue( $special ) );
	}

	/**
	 * @covers ::isListed
	 */
	public function testPageIsUnlisted(): void {
		$this->assertFalse( ( new SpecialLayersExport() )->isListed() );
	}

	/**
	 * @covers ::getGroupName
	 */
	public function testGroupNameIsLayers(): void {
		$this->assertSame( 'layers', $this->invoke( 'getGroupName' ) );
	}

	/**
	 * A malformed or hostile key must never reach the filesystem lookup.
	 *
	 * @dataProvider provideRejectedInput
	 * @covers ::resolveExportPath
	 * @param string $filename
	 * @param string $key
	 */
	public function testResolveExportPathRejectsBadInput( string $filename, string $key ): void {
		$this->assertNull( $this->invoke( 'resolveExportPath', [ $filename, $key ] ) );
	}

	public static function provideRejectedInput(): array {
		$valid = str_repeat( 'a', 32 );
		return [
			'empty filename' => [ '', $valid ],
			'empty key' => [ 'Example.jpg', '' ],
			'short key' => [ 'Example.jpg', 'abc' ],
			'long key' => [ 'Example.jpg', str_repeat( 'a', 33 ) ],
			'uppercase key' => [ 'Example.jpg', strtoupper( $valid ) ],
			'path traversal in key' => [ 'Example.jpg', '../../../etc/passwd' ],
			'null byte in key' => [ 'Example.jpg', $valid . "\0" ],
			'glob in key' => [ 'Example.jpg', '*' ],
			'separator in key' => [ 'Example.jpg', str_repeat( 'a', 16 ) . '/' . str_repeat( 'b', 15 ) ],
		];
	}

	/**
	 * The Content-Disposition value must not be attacker-controllable.
	 *
	 * @dataProvider provideDownloadNames
	 * @covers ::downloadName
	 * @param string $input
	 * @param string $expected
	 */
	public function testDownloadNameIsSanitised( string $input, string $expected ): void {
		$this->assertSame( $expected, $this->invoke( 'downloadName', [ $input ] ) );
	}

	public static function provideDownloadNames(): array {
		return [
			'plain' => [ 'Example.jpg', 'Example.pdf' ],
			'spaces' => [ 'My Holiday Photo.jpg', 'My_Holiday_Photo.pdf' ],
			'quote injection' => [ 'a";attachment;b.jpg', 'a__attachment_b.pdf' ],
			'crlf injection' => [ "a\r\nX-Evil: 1.jpg", 'a__X-Evil__1.pdf' ],
			'path traversal' => [ '../../etc/passwd', 'export.pdf' ],
			'unicode is reduced to ascii' => [ 'Ünïcødé.jpg', 'n__c__d.pdf' ],
			'empty' => [ '', 'export.pdf' ],
			'only punctuation' => [ '___.jpg', 'export.pdf' ],
		];
	}

	/**
	 * @covers ::downloadName
	 */
	public function testDownloadNameIsLengthCapped(): void {
		$name = $this->invoke( 'downloadName', [ str_repeat( 'a', 500 ) . '.jpg' ] );

		$this->assertLessThanOrEqual( 104, strlen( $name ) );
		$this->assertStringEndsWith( '.pdf', $name );
	}

	/**
	 * The Download button relies on an attachment disposition, while the Print
	 * fallback relies on an inline one, so streamPdf must offer both.
	 *
	 * @covers ::streamPdf
	 */
	public function testStreamPdfSupportsAnAttachmentDisposition(): void {
		$method = new \ReflectionMethod( SpecialLayersExport::class, 'streamPdf' );
		$params = $method->getParameters();

		$this->assertCount( 3, $params );
		$this->assertSame( 'asAttachment', $params[2]->getName() );
		$this->assertTrue( $params[2]->isDefaultValueAvailable() );
		$this->assertFalse( $params[2]->getDefaultValue() );
	}
}
