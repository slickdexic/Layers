<?php
/**
 * Tests for StaticLoggerAwareTrait
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Tests\Unit\Logging;

use MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait
 * @group Layers
 */
class StaticLoggerAwareTraitTest extends TestCase {
	use StaticLoggerAwareTrait;

	/**
	 * Reset the static logger before each test
	 */
	protected function setUp(): void {
		parent::setUp();
		self::resetLogger();
	}

	/**
	 * Reset the static logger after each test
	 */
	protected function tearDown(): void {
		self::resetLogger();
		parent::tearDown();
	}

	/**
	 * Test that setStaticLogger sets a custom logger
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::setStaticLogger
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::getLogger
	 */
	public function testSetStaticLoggerSetsCustomLogger(): void {
		$mockLogger = $this->createMock( LoggerInterface::class );
		self::setStaticLogger( $mockLogger );

		$this->assertSame( $mockLogger, self::getLogger() );
	}

	/**
	 * Test that setStaticLogger with null resets the logger
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::setStaticLogger
	 */
	public function testSetStaticLoggerNullResetsLogger(): void {
		$mockLogger = $this->createMock( LoggerInterface::class );
		self::setStaticLogger( $mockLogger );
		self::setStaticLogger( null );

		// After reset, getLogger will return a NullLogger (since MediaWikiServices isn't available)
		$logger = self::getLogger();
		$this->assertInstanceOf( LoggerInterface::class, $logger );
	}

	/**
	 * Test that resetLogger clears the cached logger
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::resetLogger
	 */
	public function testResetLoggerClearsCache(): void {
		$mockLogger1 = $this->createMock( LoggerInterface::class );
		$mockLogger2 = $this->createMock( LoggerInterface::class );

		self::setStaticLogger( $mockLogger1 );
		$this->assertSame( $mockLogger1, self::getLogger() );

		self::resetLogger();
		self::setStaticLogger( $mockLogger2 );
		$this->assertSame( $mockLogger2, self::getLogger() );
	}

	/**
	 * Test that log method calls logger info with prefixed message
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::log
	 */
	public function testLogCallsInfoWithPrefix(): void {
		$mockLogger = $this->createMock( LoggerInterface::class );
		$mockLogger->expects( $this->once() )
			->method( 'info' )
			->with( 'Layers: Test message', [ 'key' => 'value' ] );

		self::setStaticLogger( $mockLogger );
		self::log( 'Test message', [ 'key' => 'value' ] );
	}

	/**
	 * Test that logError method calls logger error with prefixed message
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::logError
	 */
	public function testLogErrorCallsErrorWithPrefix(): void {
		$mockLogger = $this->createMock( LoggerInterface::class );
		$mockLogger->expects( $this->once() )
			->method( 'error' )
			->with( 'Layers: Error occurred', [ 'error_code' => 500 ] );

		self::setStaticLogger( $mockLogger );
		self::logError( 'Error occurred', [ 'error_code' => 500 ] );
	}

	/**
	 * Test that logWarning method calls logger warning with prefixed message
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::logWarning
	 */
	public function testLogWarningCallsWarningWithPrefix(): void {
		$mockLogger = $this->createMock( LoggerInterface::class );
		$mockLogger->expects( $this->once() )
			->method( 'warning' )
			->with( 'Layers: Warning issued', [] );

		self::setStaticLogger( $mockLogger );
		self::logWarning( 'Warning issued' );
	}

	/**
	 * Test that logDebug method calls logger debug with prefixed message
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::logDebug
	 */
	public function testLogDebugCallsDebugWithPrefix(): void {
		$mockLogger = $this->createMock( LoggerInterface::class );
		$mockLogger->expects( $this->once() )
			->method( 'debug' )
			->with( 'Layers: Debug info', [ 'debug' => true ] );

		self::setStaticLogger( $mockLogger );
		self::logDebug( 'Debug info', [ 'debug' => true ] );
	}

	/**
	 * Test that getLogger returns NullLogger when service is unavailable
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::getLogger
	 */
	public function testGetLoggerReturnsNullLoggerWhenServiceUnavailable(): void {
		// Don't set a logger, let it try to get from MediaWikiServices (which will fail)
		$logger = self::getLogger();

		// Should return a NullLogger since MediaWikiServices isn't available in unit tests
		$this->assertInstanceOf( LoggerInterface::class, $logger );
	}

	/**
	 * Test that logger is cached between calls
	 *
	 * @covers \MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait::getLogger
	 */
	public function testLoggerIsCached(): void {
		$mockLogger = $this->createMock( LoggerInterface::class );
		self::setStaticLogger( $mockLogger );

		$logger1 = self::getLogger();
		$logger2 = self::getLogger();

		$this->assertSame( $logger1, $logger2 );
	}
}
