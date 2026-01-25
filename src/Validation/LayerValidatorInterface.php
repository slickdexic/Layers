<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Validation;

/**
 * Interface for layer validation services
 *
 * This interface defines the contract for validating and sanitizing
 * layer data to ensure security, data integrity, and consistency.
 */
interface LayerValidatorInterface {

	/**
	 * Validate and sanitize an array of layers
	 *
	 * @param array $layersData Raw layer data from client
	 * @return ValidationResult Result containing validated data and any issues
	 */
	public function validateLayers( array $layersData ): ValidationResult;

	/**
	 * Validate a single layer
	 *
	 * @param array $layer Raw layer data
	 * @return ValidationResult Result for the single layer
	 */
	public function validateLayer( array $layer ): ValidationResult;

	/**
	 * Get the maximum number of layers allowed
	 *
	 * @return int Maximum layer count
	 */
	public function getMaxLayerCount(): int;

	/**
	 * Get the list of supported layer types
	 *
	 * @return array Supported layer types
	 */
	public function getSupportedLayerTypes(): array;

	/**
	 * Check if a layer type is supported
	 *
	 * @param string $type Layer type to check
	 * @return bool True if supported
	 */
	public function isLayerTypeSupported( string $type ): bool;
}
