<?php

namespace MediaWiki\Extension\Layers\Validation;

/**
 * Result container for validation operations
 *
 * This class encapsulates the results of validation operations,
 * including validated data, error messages, and metadata.
 */
class ValidationResult {

	/** @var bool Whether validation was successful */
	private $isValid;

	/** @var array Validated and sanitized data */
	private $data;

	/** @var array Error messages */
	private $errors;

	/** @var array Warning messages */
	private $warnings;

	/** @var array Additional metadata */
	private $metadata;

	/**
	 * Constructor
	 *
	 * @param bool $isValid Whether validation passed
	 * @param array $data Validated data
	 * @param array $errors Error messages
	 * @param array $warnings Warning messages
	 * @param array $metadata Additional metadata
	 */
	public function __construct(
		bool $isValid = true,
		array $data = [],
		array $errors = [],
		array $warnings = [],
		array $metadata = []
 ) {
		$this->isValid = $isValid;
		$this->data = $data;
		$this->errors = $errors;
		$this->warnings = $warnings;
		$this->metadata = $metadata;
	}

	/**
	 * Check if validation was successful
	 *
	 * @return bool True if valid
	 */
	public function isValid(): bool {
		return $this->isValid;
	}

	/**
	 * Get the validated data
	 *
	 * @return array Validated data
	 */
	public function getData(): array {
		return $this->data;
	}

	/**
	 * Get error messages
	 *
	 * @return array Error messages
	 */
	public function getErrors(): array {
		return $this->errors;
	}

	/**
	 * Get warning messages
	 *
	 * @return array Warning messages
	 */
	public function getWarnings(): array {
		return $this->warnings;
	}

	/**
	 * Get metadata
	 *
	 * @return array Metadata
	 */
	public function getMetadata(): array {
		return $this->metadata;
	}

	/**
	 * Check if there are any errors
	 *
	 * @return bool True if errors exist
	 */
	public function hasErrors(): bool {
		return !empty( $this->errors );
	}

	/**
	 * Check if there are any warnings
	 *
	 * @return bool True if warnings exist
	 */
	public function hasWarnings(): bool {
		return !empty( $this->warnings );
	}

	/**
	 * Add an error message
	 *
	 * @param string $error Error message
	 * @param string|null $field Field name (optional)
	 */
	public function addError( string $error, ?string $field = null ): void {
		if ( $field ) {
			$this->errors[$field][] = $error;
		} else {
			$this->errors[] = $error;
		}
		$this->isValid = false;
	}

	/**
	 * Add a warning message
	 *
	 * @param string $warning Warning message
	 * @param string|null $field Field name (optional)
	 */
	public function addWarning( string $warning, ?string $field = null ): void {
		if ( $field ) {
			$this->warnings[$field][] = $warning;
		} else {
			$this->warnings[] = $warning;
		}
	}

	/**
	 * Set metadata
	 *
	 * @param string $key Metadata key
	 * @param mixed $value Metadata value
	 */
	public function setMetadata( string $key, $value ): void {
		$this->metadata[$key] = $value;
	}

	/**
	 * Get specific metadata value
	 *
	 * @param string $key Metadata key
	 * @param mixed $default Default value if key not found
	 * @return mixed Metadata value
	 */
	public function getMetadataValue( string $key, $default = null ) {
		return $this->metadata[$key] ?? $default;
	}

	/**
	 * Create a successful validation result
	 *
	 * @param array $data Validated data
	 * @param array $warnings Optional warnings
	 * @param array $metadata Optional metadata
	 * @return ValidationResult Success result
	 */
	public static function success( array $data, array $warnings = [], array $metadata = [] ): ValidationResult {
		return new self( true, $data, [], $warnings, $metadata );
	}

	/**
	 * Create a failed validation result
	 *
	 * @param array $errors Error messages
	 * @param array $warnings Optional warnings
	 * @param array $metadata Optional metadata
	 * @return ValidationResult Failure result
	 */
	public static function failure( array $errors, array $warnings = [], array $metadata = [] ): ValidationResult {
		return new self( false, [], $errors, $warnings, $metadata );
	}

	/**
	 * Merge multiple validation results
	 *
	 * @param ValidationResult[] $results Results to merge
	 * @return ValidationResult Merged result
	 */
	public static function merge( array $results ): ValidationResult {
		$isValid = true;
		$allData = [];
		$allErrors = [];
		$allWarnings = [];
		$allMetadata = [];

		foreach ( $results as $result ) {
			if ( !$result->isValid() ) {
				$isValid = false;
			}

			$allData = array_merge( $allData, $result->getData() );
			$allErrors = array_merge( $allErrors, $result->getErrors() );
			$allWarnings = array_merge( $allWarnings, $result->getWarnings() );
			$allMetadata = array_merge( $allMetadata, $result->getMetadata() );
		}

		return new self( $isValid, $allData, $allErrors, $allWarnings, $allMetadata );
	}
}
