<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Validation;

use MediaWiki\Extension\Layers\Validation\ValidationResult;
use MediaWikiUnitTestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult
 */
class ValidationResultTest extends MediaWikiUnitTestCase {

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::__construct
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::isValid
	 */
	public function testDefaultConstructorCreatesValidResult(): void {
		$result = new ValidationResult();

		$this->assertTrue( $result->isValid() );
		$this->assertSame( [], $result->getData() );
		$this->assertSame( [], $result->getErrors() );
		$this->assertSame( [], $result->getWarnings() );
		$this->assertSame( [], $result->getMetadata() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::__construct
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::getData
	 */
	public function testConstructorWithData(): void {
		$data = [ 'type' => 'text', 'x' => 100 ];
		$result = new ValidationResult( true, $data );

		$this->assertTrue( $result->isValid() );
		$this->assertSame( $data, $result->getData() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::__construct
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::getErrors
	 */
	public function testConstructorWithErrors(): void {
		$errors = [ 'Invalid type', 'Missing field' ];
		$result = new ValidationResult( false, [], $errors );

		$this->assertFalse( $result->isValid() );
		$this->assertSame( $errors, $result->getErrors() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::success
	 */
	public function testSuccessFactoryMethod(): void {
		$data = [ 'layer' => 'data' ];
		$warnings = [ 'Deprecated property' ];
		$metadata = [ 'version' => 1 ];

		$result = ValidationResult::success( $data, $warnings, $metadata );

		$this->assertTrue( $result->isValid() );
		$this->assertSame( $data, $result->getData() );
		$this->assertSame( [], $result->getErrors() );
		$this->assertSame( $warnings, $result->getWarnings() );
		$this->assertSame( $metadata, $result->getMetadata() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::failure
	 */
	public function testFailureFactoryMethod(): void {
		$errors = [ 'Validation failed' ];
		$warnings = [ 'Check input' ];
		$metadata = [ 'field' => 'type' ];

		$result = ValidationResult::failure( $errors, $warnings, $metadata );

		$this->assertFalse( $result->isValid() );
		$this->assertSame( [], $result->getData() );
		$this->assertSame( $errors, $result->getErrors() );
		$this->assertSame( $warnings, $result->getWarnings() );
		$this->assertSame( $metadata, $result->getMetadata() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::hasErrors
	 */
	public function testHasErrors(): void {
		$resultWithErrors = new ValidationResult( false, [], [ 'error' ] );
		$resultWithoutErrors = new ValidationResult( true, [], [] );

		$this->assertTrue( $resultWithErrors->hasErrors() );
		$this->assertFalse( $resultWithoutErrors->hasErrors() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::hasWarnings
	 */
	public function testHasWarnings(): void {
		$resultWithWarnings = new ValidationResult( true, [], [], [ 'warning' ] );
		$resultWithoutWarnings = new ValidationResult( true, [], [], [] );

		$this->assertTrue( $resultWithWarnings->hasWarnings() );
		$this->assertFalse( $resultWithoutWarnings->hasWarnings() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::addError
	 */
	public function testAddErrorWithoutField(): void {
		$result = new ValidationResult();
		$this->assertTrue( $result->isValid() );

		$result->addError( 'Something went wrong' );

		$this->assertFalse( $result->isValid() );
		$this->assertContains( 'Something went wrong', $result->getErrors() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::addError
	 */
	public function testAddErrorWithField(): void {
		$result = new ValidationResult();

		$result->addError( 'Invalid value', 'x' );
		$result->addError( 'Out of range', 'x' );

		$this->assertFalse( $result->isValid() );
		$errors = $result->getErrors();
		$this->assertArrayHasKey( 'x', $errors );
		$this->assertCount( 2, $errors['x'] );
		$this->assertContains( 'Invalid value', $errors['x'] );
		$this->assertContains( 'Out of range', $errors['x'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::addWarning
	 */
	public function testAddWarningWithoutField(): void {
		$result = new ValidationResult();

		$result->addWarning( 'Deprecated feature' );

		// Warnings don't affect validity
		$this->assertTrue( $result->isValid() );
		$this->assertContains( 'Deprecated feature', $result->getWarnings() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::addWarning
	 */
	public function testAddWarningWithField(): void {
		$result = new ValidationResult();

		$result->addWarning( 'Will be removed', 'oldProp' );

		$warnings = $result->getWarnings();
		$this->assertArrayHasKey( 'oldProp', $warnings );
		$this->assertContains( 'Will be removed', $warnings['oldProp'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::setMetadata
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::getMetadataValue
	 */
	public function testMetadataAccessors(): void {
		$result = new ValidationResult();

		$result->setMetadata( 'layerCount', 5 );
		$result->setMetadata( 'version', '1.0' );

		$this->assertSame( 5, $result->getMetadataValue( 'layerCount' ) );
		$this->assertSame( '1.0', $result->getMetadataValue( 'version' ) );
		$this->assertNull( $result->getMetadataValue( 'nonexistent' ) );
		$this->assertSame( 'default', $result->getMetadataValue( 'nonexistent', 'default' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::merge
	 */
	public function testMergeAllValid(): void {
		$result1 = ValidationResult::success( [ 'a' => 1 ], [], [ 'src' => 'r1' ] );
		$result2 = ValidationResult::success( [ 'b' => 2 ], [ 'warn1' ], [ 'src' => 'r2' ] );

		$merged = ValidationResult::merge( [ $result1, $result2 ] );

		$this->assertTrue( $merged->isValid() );
		$this->assertArrayHasKey( 'a', $merged->getData() );
		$this->assertArrayHasKey( 'b', $merged->getData() );
		$this->assertContains( 'warn1', $merged->getWarnings() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::merge
	 */
	public function testMergeWithOneInvalid(): void {
		$result1 = ValidationResult::success( [ 'good' => 'data' ] );
		$result2 = ValidationResult::failure( [ 'Bad input' ] );

		$merged = ValidationResult::merge( [ $result1, $result2 ] );

		$this->assertFalse( $merged->isValid() );
		$this->assertContains( 'Bad input', $merged->getErrors() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::merge
	 */
	public function testMergeEmptyArray(): void {
		$merged = ValidationResult::merge( [] );

		$this->assertTrue( $merged->isValid() );
		$this->assertSame( [], $merged->getData() );
		$this->assertSame( [], $merged->getErrors() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::getWarnings
	 */
	public function testWarningsPreservedWithFullConstructor(): void {
		$warnings = [ 'Field deprecated' ];
		$result = new ValidationResult( true, [], [], $warnings, [] );

		$this->assertSame( $warnings, $result->getWarnings() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ValidationResult::getMetadata
	 */
	public function testMetadataPreservedWithFullConstructor(): void {
		$metadata = [ 'timestamp' => 12345, 'user' => 'admin' ];
		$result = new ValidationResult( true, [], [], [], $metadata );

		$this->assertSame( $metadata, $result->getMetadata() );
	}
}
