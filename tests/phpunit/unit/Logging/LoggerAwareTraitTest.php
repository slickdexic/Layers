<?php
// phpcs:disable MediaWiki.Files.ClassMatchesFilename,Generic.Files.OneObjectStructurePerFile

namespace MediaWiki\Extension\Layers\Tests\Unit\Logging;

use MediaWiki\Extension\Layers\Logging\LoggerAwareTrait;
use MediaWikiUnitTestCase;
use Psr\Log\LoggerInterface;

/**
 * Test class that uses LoggerAwareTrait.
 */
class LoggerAwareTestClass {
	use LoggerAwareTrait;

	/**
	 * Expose getLogger for testing.
	 *
	 * @return LoggerInterface
	 */
	public function exposeGetLogger(): LoggerInterface {
		return $this->getLogger();
	}

	/**
	 * Expose log for testing.
	 *
	 * @param string $message Message to log
	 * @param array $context Context array
	 */
	public function exposeLog( string $message, array $context = [] ): void {
		$this->log( $message, $context );
	}

	/**
	 * Expose logError for testing.
	 *
	 * @param string $message Message to log
	 * @param array $context Context array
	 */
	public function exposeLogError( string $message, array $context = [] ): void {
		$this->logError( $message, $context );
	}

	/**
	 * Expose logWarning for testing.
	 *
	 * @param string $message Message to log
	 * @param array $context Context array
	 */
	public function exposeLogWarning( string $message, array $context = [] ): void {
		$this->logWarning( $message, $context );
	}

	/**
	 * Expose logDebug for testing.
	 *
	 * @param string $message Message to log
	 * @param array $context Context array
	 */
	public function exposeLogDebug( string $message, array $context = [] ): void {
		$this->logDebug( $message, $context );
	}
}

/**
 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait
 */
class LoggerAwareTraitTest extends MediaWikiUnitTestCase {

	/**
	 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait::setLogger
	 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait::getLogger
	 */
	public function testSetLoggerOverridesDefault(): void {
		$obj = new LoggerAwareTestClass();
		$mockLogger = $this->createMock( LoggerInterface::class );

		$obj->setLogger( $mockLogger );

		$this->assertSame( $mockLogger, $obj->exposeGetLogger() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait::log
	 */
	public function testLogCallsInfoWithPrefix(): void {
		$obj = new LoggerAwareTestClass();
		$mockLogger = $this->createMock( LoggerInterface::class );

		$mockLogger->expects( $this->once() )
			->method( 'info' )
			->with(
				'Layers: Test message',
				[ 'key' => 'value' ]
			);

		$obj->setLogger( $mockLogger );
		$obj->exposeLog( 'Test message', [ 'key' => 'value' ] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait::logError
	 */
	public function testLogErrorCallsErrorWithPrefix(): void {
		$obj = new LoggerAwareTestClass();
		$mockLogger = $this->createMock( LoggerInterface::class );

		$mockLogger->expects( $this->once() )
			->method( 'error' )
			->with(
				'Layers: Error occurred',
				[]
			);

		$obj->setLogger( $mockLogger );
		$obj->exposeLogError( 'Error occurred' );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait::logWarning
	 */
	public function testLogWarningCallsWarningWithPrefix(): void {
		$obj = new LoggerAwareTestClass();
		$mockLogger = $this->createMock( LoggerInterface::class );

		$mockLogger->expects( $this->once() )
			->method( 'warning' )
			->with(
				'Layers: Be careful',
				[ 'field' => 'x' ]
			);

		$obj->setLogger( $mockLogger );
		$obj->exposeLogWarning( 'Be careful', [ 'field' => 'x' ] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait::logDebug
	 */
	public function testLogDebugCallsDebugWithPrefix(): void {
		$obj = new LoggerAwareTestClass();
		$mockLogger = $this->createMock( LoggerInterface::class );

		$mockLogger->expects( $this->once() )
			->method( 'debug' )
			->with(
				'Layers: Debug info',
				[ 'data' => 123 ]
			);

		$obj->setLogger( $mockLogger );
		$obj->exposeLogDebug( 'Debug info', [ 'data' => 123 ] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait::getLogger
	 */
	public function testGetLoggerReturnsSameInstanceOnSubsequentCalls(): void {
		$obj = new LoggerAwareTestClass();
		$mockLogger = $this->createMock( LoggerInterface::class );

		$obj->setLogger( $mockLogger );

		$logger1 = $obj->exposeGetLogger();
		$logger2 = $obj->exposeGetLogger();

		$this->assertSame( $logger1, $logger2 );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Logging\LoggerAwareTrait::log
	 */
	public function testLogWithEmptyContext(): void {
		$obj = new LoggerAwareTestClass();
		$mockLogger = $this->createMock( LoggerInterface::class );

		$mockLogger->expects( $this->once() )
			->method( 'info' )
			->with(
				'Layers: Simple message',
				[]
			);

		$obj->setLogger( $mockLogger );
		$obj->exposeLog( 'Simple message' );
	}
}
