<?php

/**
 * Error handling and logging for Layers extension
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Logging;

use MediaWiki\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class LayersLogger implements LoggerInterface {
	private LoggerInterface $logger;

	public function __construct() {
		$this->logger = LoggerFactory::getInstance( 'Layers' );
	}

	// PSR-3 LoggerInterface implementation - delegate to internal logger

	/**
	 * @inheritDoc
	 */
	public function emergency( $message, array $context = [] ): void {
		$this->logger->emergency( $message, $context );
	}

	/**
	 * @inheritDoc
	 */
	public function alert( $message, array $context = [] ): void {
		$this->logger->alert( $message, $context );
	}

	/**
	 * @inheritDoc
	 */
	public function critical( $message, array $context = [] ): void {
		$this->logger->critical( $message, $context );
	}

	/**
	 * @inheritDoc
	 */
	public function error( $message, array $context = [] ): void {
		$this->logger->error( $message, $context );
	}

	/**
	 * @inheritDoc
	 */
	public function warning( $message, array $context = [] ): void {
		$this->logger->warning( $message, $context );
	}

	/**
	 * @inheritDoc
	 */
	public function notice( $message, array $context = [] ): void {
		$this->logger->notice( $message, $context );
	}

	/**
	 * @inheritDoc
	 */
	public function info( $message, array $context = [] ): void {
		$this->logger->info( $message, $context );
	}

	/**
	 * @inheritDoc
	 */
	public function debug( $message, array $context = [] ): void {
		$this->logger->debug( $message, $context );
	}

	/**
	 * @inheritDoc
	 */
	public function log( $level, $message, array $context = [] ): void {
		$this->logger->log( $level, $message, $context );
	}

	// Custom logging methods for Layers extension

	/**
	 * Log security-related events
	 */
	public function logSecurity( string $event, array $context = [] ): void {
		$this->logger->warning( "Security event: {$event}", $context );
	}

	/**
	 * Log performance issues
	 */
	public function logPerformance( string $event, float $duration, array $context = [] ): void {
		$context['duration'] = $duration;

		if ( $duration > 5.0 ) {
			$this->logger->error( "Performance issue: {$event}", $context );
		} elseif ( $duration > 2.0 ) {
			$this->logger->warning( "Slow operation: {$event}", $context );
		} else {
			$this->logger->info( "Performance: {$event}", $context );
		}
	}

	/**
	 * Log API usage
	 */
	public function logApiUsage( string $action, string $user, array $context = [] ): void {
		$context['user'] = $user;
		$context['action'] = $action;

		$this->logger->info( "API usage: {$action} by {$user}", $context );
	}

	/**
	 * Log errors with full context
	 */
	public function logError( string $message, \Exception $e = null, array $context = [] ): void {
		if ( $e ) {
			$context['exception'] = $e;
			$context['trace'] = $e->getTraceAsString();
		}

		$this->logger->error( $message, $context );
	}

	/**
	 * Log thumbnail generation events
	 */
	public function logThumbnail( string $filename, string $result, float $duration, array $context = [] ): void {
		$context['filename'] = $filename;
		$context['result'] = $result;
		$context['duration'] = $duration;

		$this->logger->info( "Thumbnail generation: {$filename} -> {$result}", $context );
	}

	/**
	 * Log rate limiting events
	 */
	public function logRateLimit( string $user, string $action, array $context = [] ): void {
		$context['user'] = $user;
		$context['action'] = $action;

		$this->logger->warning( "Rate limit exceeded: {$action} by {$user}", $context );
	}
}
