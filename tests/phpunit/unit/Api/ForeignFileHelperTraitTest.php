<?php
// phpcs:disable MediaWiki.Files.OneClassPerFile,Generic.Files.OneObjectStructurePerFile -- Test harness class

namespace MediaWiki\Extension\Layers\Tests\Api;

require_once __DIR__ . '/../../../../src/Api/Traits/ForeignFileHelperTrait.php';

use MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait
 */
class ForeignFileHelperTraitTest extends TestCase {

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::isForeignFile
	 */
	public function testIsForeignFileReturnsFalseForLocalFile(): void {
		$harness = new ForeignFileHelperTraitHarness();

		// Create a mock local file
		$mockFile = $this->createMock( MockLocalFile::class );
		$mockFile->method( 'getRepo' )->willReturn( null );

		$this->assertFalse( $harness->callIsForeignFile( $mockFile ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::isForeignFile
	 */
	public function testIsForeignFileReturnsTrueForForeignClassName(): void {
		$harness = new ForeignFileHelperTraitHarness();

		// Create a mock with "Foreign" in class name
		$mockFile = new MockForeignFile();

		$this->assertTrue( $harness->callIsForeignFile( $mockFile ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::isForeignFile
	 */
	public function testIsForeignFileReturnsTrueForNonLocalRepo(): void {
		$harness = new ForeignFileHelperTraitHarness();

		// Create mock repo that reports isLocal() = false
		$mockRepo = $this->getMockBuilder( \stdClass::class )
			->addMethods( [ 'isLocal' ] )
			->getMock();
		$mockRepo->method( 'isLocal' )->willReturn( false );

		// Create mock file with the repo
		$mockFile = $this->getMockBuilder( MockLocalFile::class )
			->onlyMethods( [ 'getRepo' ] )
			->getMock();
		$mockFile->method( 'getRepo' )->willReturn( $mockRepo );

		$this->assertTrue( $harness->callIsForeignFile( $mockFile ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::isForeignFile
	 */
	public function testIsForeignFileReturnsFalseForLocalRepo(): void {
		$harness = new ForeignFileHelperTraitHarness();

		// Create mock repo that reports isLocal() = true
		$mockRepo = $this->getMockBuilder( \stdClass::class )
			->addMethods( [ 'isLocal' ] )
			->getMock();
		$mockRepo->method( 'isLocal' )->willReturn( true );

		// Create mock file with the repo
		$mockFile = $this->getMockBuilder( MockLocalFile::class )
			->onlyMethods( [ 'getRepo' ] )
			->getMock();
		$mockFile->method( 'getRepo' )->willReturn( $mockRepo );

		$this->assertFalse( $harness->callIsForeignFile( $mockFile ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::getFileSha1
	 */
	public function testGetFileSha1ReturnsActualSha1WhenAvailable(): void {
		$harness = new ForeignFileHelperTraitHarness();

		$expectedSha1 = 'abc123def456';
		$mockFile = $this->getMockBuilder( MockLocalFile::class )
			->onlyMethods( [ 'getSha1', 'getRepo' ] )
			->getMock();
		$mockFile->method( 'getSha1' )->willReturn( $expectedSha1 );
		$mockFile->method( 'getRepo' )->willReturn( null );

		$this->assertSame( $expectedSha1, $harness->callGetFileSha1( $mockFile, 'Test.jpg' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::getFileSha1
	 */
	public function testGetFileSha1ReturnsFallbackForForeignFileWithoutSha1(): void {
		$harness = new ForeignFileHelperTraitHarness();

		// Create mock foreign file without SHA1
		$mockFile = new MockForeignFileWithSha1( '' );

		$imgName = 'Example.jpg';
		$expectedFallback = 'foreign_' . sha1( $imgName );

		$this->assertSame( $expectedFallback, $harness->callGetFileSha1( $mockFile, $imgName ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::getFileSha1
	 */
	public function testGetFileSha1ReturnsEmptyStringForLocalFileWithoutSha1(): void {
		$harness = new ForeignFileHelperTraitHarness();

		// Create mock local file without SHA1
		$mockFile = $this->getMockBuilder( MockLocalFile::class )
			->onlyMethods( [ 'getSha1', 'getRepo' ] )
			->getMock();
		$mockFile->method( 'getSha1' )->willReturn( '' );
		$mockFile->method( 'getRepo' )->willReturn( null );

		$this->assertSame( '', $harness->callGetFileSha1( $mockFile, 'Test.jpg' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::getFileSha1
	 */
	public function testGetFileSha1FallbackIsDeterministic(): void {
		$harness = new ForeignFileHelperTraitHarness();

		$mockFile = new MockForeignFileWithSha1( '' );
		$imgName = 'Commons_Image.jpg';

		// Call twice with same input
		$result1 = $harness->callGetFileSha1( $mockFile, $imgName );
		$result2 = $harness->callGetFileSha1( $mockFile, $imgName );

		// Should be deterministic
		$this->assertSame( $result1, $result2 );
		$this->assertStringStartsWith( 'foreign_', $result1 );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait::getFileSha1
	 */
	public function testGetFileSha1FallbackDiffersForDifferentImages(): void {
		$harness = new ForeignFileHelperTraitHarness();

		$mockFile = new MockForeignFileWithSha1( '' );

		$result1 = $harness->callGetFileSha1( $mockFile, 'Image1.jpg' );
		$result2 = $harness->callGetFileSha1( $mockFile, 'Image2.jpg' );

		// Should produce different fallbacks for different images
		$this->assertNotSame( $result1, $result2 );
	}
}

/**
 * Harness class to expose protected trait methods for testing.
 */
class ForeignFileHelperTraitHarness {
	use ForeignFileHelperTrait;

	/**
	 * Expose isForeignFile for testing.
	 *
	 * @param mixed $file File object to check
	 * @return bool True if foreign file
	 */
	public function callIsForeignFile( $file ): bool {
		return $this->isForeignFile( $file );
	}

	/**
	 * Expose getFileSha1 for testing.
	 *
	 * @param mixed $file File object
	 * @param string $imgName Image name for fallback
	 * @return string SHA1 hash or fallback
	 */
	public function callGetFileSha1( $file, string $imgName ): string {
		return $this->getFileSha1( $file, $imgName );
	}
}

/**
 * Mock class representing a local file.
 */
class MockLocalFile {
	/**
	 * Get SHA1 hash.
	 *
	 * @return string Empty string
	 */
	public function getSha1(): string {
		return '';
	}

	/**
	 * Get repository.
	 *
	 * @return null No repository
	 */
	public function getRepo() {
		return null;
	}
}

/**
 * Mock class with "Foreign" in name (simulates ForeignAPIFile behavior).
 */
class MockForeignFile {
	/**
	 * Get SHA1 hash.
	 *
	 * @return string Empty string
	 */
	public function getSha1(): string {
		return '';
	}

	/**
	 * Get repository.
	 *
	 * @return null No repository
	 */
	public function getRepo() {
		return null;
	}
}

/**
 * Mock foreign file with configurable SHA1.
 */
class MockForeignFileWithSha1 {
	/** @var string */
	private string $sha1;

	/**
	 * Constructor.
	 *
	 * @param string $sha1 SHA1 value to return
	 */
	public function __construct( string $sha1 ) {
		$this->sha1 = $sha1;
	}

	/**
	 * Get SHA1 hash.
	 *
	 * @return string Configured SHA1
	 */
	public function getSha1(): string {
		return $this->sha1;
	}

	/**
	 * Get repository.
	 *
	 * @return null No repository
	 */
	public function getRepo() {
		return null;
	}
}
