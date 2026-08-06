<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Utility;

use MediaWiki\Extension\Layers\Utility\FramingHeaders;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Utility\FramingHeaders
 * @group Layers
 */
class FramingHeadersTest extends TestCase {

	/**
	 * @return \stdClass Response spy recording header() calls
	 */
	private function makeResponse() {
		return new class {
			/** @var array<int,array> */
			public array $headers = [];

			/**
			 * @param string $string
			 * @param bool $replace
			 * @return void
			 */
			public function header( $string, $replace = true ) {
				$this->headers[] = [ $string, $replace ];
			}
		};
	}

	public function testEmitsBothLegacyAndCspFramingHeaders(): void {
		$out = new class {
			/** @var mixed */
			public $prevented = null;

			/**
			 * @param bool $enable
			 * @return void
			 */
			public function setPreventClickjacking( $enable ) {
				$this->prevented = $enable;
			}
		};
		$response = $this->makeResponse();

		FramingHeaders::allowSameOriginFraming( $out, $response );

		$this->assertFalse( $out->prevented, 'MediaWiki default DENY must be suppressed' );
		$sent = array_column( $response->headers, 0 );
		$this->assertContains( 'X-Frame-Options: SAMEORIGIN', $sent );
		$this->assertContains( "Content-Security-Policy: frame-ancestors 'self'", $sent );
	}

	/**
	 * A replacing CSP header would override, rather than intersect with, any
	 * policy the wiki already sends.
	 */
	public function testCspHeaderIsAppendedNotReplaced(): void {
		$response = $this->makeResponse();

		FramingHeaders::allowSameOriginFraming( new \stdClass(), $response );

		foreach ( $response->headers as [ $string, $replace ] ) {
			if ( strpos( $string, 'Content-Security-Policy' ) === 0 ) {
				$this->assertFalse( $replace );
				return;
			}
		}
		$this->fail( 'No Content-Security-Policy header was sent' );
	}

	/**
	 * MediaWiki removed allowClickjacking() in 1.44 and added
	 * setPreventClickjacking() in 1.38; neither may be assumed to exist.
	 */
	public function testFallsBackToLegacyAllowClickjacking(): void {
		$out = new class {
			/** @var bool */
			public bool $called = false;

			/**
			 * @return void
			 */
			public function allowClickjacking() {
				$this->called = true;
			}
		};

		FramingHeaders::allowSameOriginFraming( $out, $this->makeResponse() );

		$this->assertTrue( $out->called );
	}

	public function testDoesNotFatalWhenNeitherMethodExists(): void {
		$response = $this->makeResponse();

		FramingHeaders::allowSameOriginFraming( new \stdClass(), $response );

		$this->assertCount( 2, $response->headers );
	}
}
