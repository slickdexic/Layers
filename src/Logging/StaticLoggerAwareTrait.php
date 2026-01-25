<?php

declare( strict_types=1 );
/**
 * Trait for static classes that need access to the Layers logger
 *
 * This trait provides a consistent way to access the LayersLogger service
 * from static methods with lazy initialization and graceful fallback.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Logging;

use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * Provides logger access for static classes (like hook handlers)
 *
 * Usage:
 *   class MyHooks {
 *       use StaticLoggerAwareTrait;
 *
 *       public static function onSomeHook() {
 *           self::getLogger()->info( 'Hook fired' );
 *           // Or use the convenience method:
 *           self::log( 'Hook fired', [ 'context' => 'value' ] );
 *       }
 *   }
 */
trait StaticLoggerAwareTrait {
	/**
	 * Cached logger instance
	 *
	 * @var LoggerInterface|null
	 */
	private static ?LoggerInterface $staticLogger = null;

	/**
	 * Get the Layers logger instance
	 *
	 * Returns the LayersLogger service from MediaWiki's service container,
	 * or a NullLogger if the service is unavailable. The result is cached
	 * for subsequent calls.
	 *
	 * @return LoggerInterface
	 */
	protected static function getLogger(): LoggerInterface {
		if ( self::$staticLogger === null ) {
			try {
				$services = MediaWikiServices::getInstance();
				self::$staticLogger = $services->get( 'LayersLogger' );
			} catch ( \Throwable $e ) {
				// Service unavailable - use NullLogger to avoid null checks everywhere
				self::$staticLogger = new NullLogger();
			}
		}
		return self::$staticLogger;
	}

	/**
	 * Set a custom logger (useful for testing)
	 *
	 * @param LoggerInterface|null $logger Pass null to reset
	 * @return void
	 */
	public static function setStaticLogger( ?LoggerInterface $logger ): void {
		self::$staticLogger = $logger;
	}

	/**
	 * Reset the logger (useful for testing)
	 *
	 * @return void
	 */
	public static function resetLogger(): void {
		self::$staticLogger = null;
	}

	/**
	 * Convenience method to log an info-level message
	 *
	 * @param string $message The log message
	 * @param array $context Optional context data
	 * @return void
	 */
	protected static function log( string $message, array $context = [] ): void {
		self::getLogger()->info( "Layers: $message", $context );
	}

	/**
	 * Convenience method to log an error-level message
	 *
	 * @param string $message The log message
	 * @param array $context Optional context data
	 * @return void
	 */
	protected static function logError( string $message, array $context = [] ): void {
		self::getLogger()->error( "Layers: $message", $context );
	}

	/**
	 * Convenience method to log a warning-level message
	 *
	 * @param string $message The log message
	 * @param array $context Optional context data
	 * @return void
	 */
	protected static function logWarning( string $message, array $context = [] ): void {
		self::getLogger()->warning( "Layers: $message", $context );
	}

	/**
	 * Convenience method to log a debug-level message
	 *
	 * @param string $message The log message
	 * @param array $context Optional context data
	 * @return void
	 */
	protected static function logDebug( string $message, array $context = [] ): void {
		self::getLogger()->debug( "Layers: $message", $context );
	}
}
