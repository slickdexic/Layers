<?php

declare( strict_types=1 );
/**
 * Trait for classes that need access to the Layers logger
 *
 * This trait provides a consistent way to access the LayersLogger service
 * with lazy initialization and graceful fallback when the service is unavailable.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Logging;

use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * Provides logger access for instance-based classes
 *
 * Usage:
 *   class MyClass {
 *       use LoggerAwareTrait;
 *
 *       public function doSomething() {
 *           $this->getLogger()->info( 'Doing something' );
 *           // Or use the convenience method:
 *           $this->log( 'Doing something', [ 'context' => 'value' ] );
 *       }
 *   }
 */
trait LoggerAwareTrait {
	/**
	 * Cached logger instance
	 *
	 * @var LoggerInterface|null
	 */
	private ?LoggerInterface $logger = null;

	/**
	 * Get the Layers logger instance
	 *
	 * Returns the LayersLogger service from MediaWiki's service container,
	 * or a NullLogger if the service is unavailable. The result is cached
	 * for subsequent calls.
	 *
	 * @return LoggerInterface
	 */
	protected function getLogger(): LoggerInterface {
		if ( $this->logger === null ) {
			try {
				$services = MediaWikiServices::getInstance();
				$this->logger = $services->get( 'LayersLogger' );
			} catch ( \Throwable $e ) {
				// Service unavailable - use NullLogger to avoid null checks everywhere
				$this->logger = new NullLogger();
			}
		}
		return $this->logger;
	}

	/**
	 * Set a custom logger (useful for testing)
	 *
	 * @param LoggerInterface $logger
	 * @return void
	 */
	public function setLogger( LoggerInterface $logger ): void {
		$this->logger = $logger;
	}

	/**
	 * Convenience method to log an info-level message
	 *
	 * @param string $message The log message
	 * @param array $context Optional context data
	 * @return void
	 */
	protected function log( string $message, array $context = [] ): void {
		$this->getLogger()->info( "Layers: $message", $context );
	}

	/**
	 * Convenience method to log an error-level message
	 *
	 * @param string $message The log message
	 * @param array $context Optional context data
	 * @return void
	 */
	protected function logError( string $message, array $context = [] ): void {
		$this->getLogger()->error( "Layers: $message", $context );
	}

	/**
	 * Convenience method to log a warning-level message
	 *
	 * @param string $message The log message
	 * @param array $context Optional context data
	 * @return void
	 */
	protected function logWarning( string $message, array $context = [] ): void {
		$this->getLogger()->warning( "Layers: $message", $context );
	}

	/**
	 * Convenience method to log a debug-level message
	 *
	 * @param string $message The log message
	 * @param array $context Optional context data
	 * @return void
	 */
	protected function logDebug( string $message, array $context = [] ): void {
		$this->getLogger()->debug( "Layers: $message", $context );
	}
}
