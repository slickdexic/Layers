<?php
// phpcs:disable MediaWiki.Files.OneClassPerFile,Generic.Files.OneObjectStructurePerFile -- Test harness class

namespace MediaWiki\User;

// Stub UserIdentity interface if not available (standalone test environment)
if ( !interface_exists( '\\MediaWiki\\User\\UserIdentity' ) ) {
	interface UserIdentity {
		public function getId();
		public function getName(): string;
		public function getWikiId();
		public function isRegistered(): bool;
	}
}

namespace MediaWiki\Extension\Layers\Tests\Api;

require_once __DIR__ . '/../../../../src/Api/Traits/AuditTrailTrait.php';

use MediaWiki\Extension\Layers\Api\Traits\AuditTrailTrait;
use MediaWiki\User\UserIdentity;
use PHPUnit\Framework\TestCase;

/**
 * Harness class to expose AuditTrailTrait methods for testing.
 */
class AuditTrailTraitHarness {
	use AuditTrailTrait;

	/**
	 * Public wrapper for createAuditTrailEntry.
	 *
	 * @param mixed $title
	 * @param UserIdentity $user
	 * @param string $action
	 * @param string $setName
	 * @param array $extra
	 */
	public function callCreateAuditTrailEntry( $title, UserIdentity $user, string $action, string $setName, array $extra = [] ): void {
		$this->createAuditTrailEntry( $title, $user, $action, $setName, $extra );
	}

	/**
	 * Public wrapper for buildAuditSummary (via reflection).
	 *
	 * @param string $action
	 * @param string $setName
	 * @param array $extra
	 * @return string
	 */
	public function callBuildAuditSummary( string $action, string $setName, array $extra = [] ): string {
		$reflection = new \ReflectionMethod( $this, 'buildAuditSummary' );
		$reflection->setAccessible( true );
		return $reflection->invoke( $this, $action, $setName, $extra );
	}
}

/**
 * @covers \MediaWiki\Extension\Layers\Api\Traits\AuditTrailTrait
 */
class AuditTrailTraitTest extends TestCase {

	/**
	 * Create a mock UserIdentity.
	 *
	 * @return UserIdentity
	 */
	private function createMockUser(): UserIdentity {
		$mock = $this->createMock( UserIdentity::class );
		$mock->method( 'getId' )->willReturn( 1 );
		$mock->method( 'getName' )->willReturn( 'TestUser' );
		return $mock;
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\AuditTrailTrait::createAuditTrailEntry
	 */
	public function testCreateAuditTrailEntryHandlesNullTitleGracefully(): void {
		$harness = new AuditTrailTraitHarness();

		// Mock user - use stdClass as lightweight stub
		$mockUser = $this->getMockBuilder( \stdClass::class )
			->addMethods( [ 'getId', 'getName' ] )
			->getMock();
		$mockUser->method( 'getId' )->willReturn( 1 );
		$mockUser->method( 'getName' )->willReturn( 'TestUser' );

		// Should not throw when title is null
		$harness->callCreateAuditTrailEntry( null, $this->createMockUser(), 'save', 'default' );
		$this->assertTrue( true, 'No exception thrown for null title' );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\AuditTrailTrait::createAuditTrailEntry
	 */
	public function testCreateAuditTrailEntryHandlesMissingServicesGracefully(): void {
		$harness = new AuditTrailTraitHarness();

		// Create a mock title that reports it exists
		$mockTitle = $this->getMockBuilder( \stdClass::class )
			->addMethods( [ 'exists', 'getPrefixedText' ] )
			->getMock();
		$mockTitle->method( 'exists' )->willReturn( true );
		$mockTitle->method( 'getPrefixedText' )->willReturn( 'File:Test.jpg' );

		// When MediaWikiServices is not available, the method should
		// catch the exception and return silently (best-effort)
		$harness->callCreateAuditTrailEntry( $mockTitle, $this->createMockUser(), 'save', 'default' );
		$this->assertTrue( true, 'No exception thrown when services unavailable' );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\AuditTrailTrait::createAuditTrailEntry
	 */
	public function testCreateAuditTrailEntryHandlesDeleteAction(): void {
		$harness = new AuditTrailTraitHarness();

		// Should not throw for delete action with null title
		$harness->callCreateAuditTrailEntry( null, $this->createMockUser(), 'delete', 'my-set' );
		$this->assertTrue( true, 'Delete action handled gracefully' );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\AuditTrailTrait::createAuditTrailEntry
	 */
	public function testCreateAuditTrailEntryHandlesRenameAction(): void {
		$harness = new AuditTrailTraitHarness();

		// Should not throw for rename action with null title
		$harness->callCreateAuditTrailEntry(
			null, $this->createMockUser(), 'rename', 'old-name',
			[ 'oldname' => 'old-name', 'newname' => 'new-name' ]
		);
		$this->assertTrue( true, 'Rename action handled gracefully' );
	}

	/**
	 * Tests that the create method handles non-existent title gracefully.
	 *
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\AuditTrailTrait::createAuditTrailEntry
	 */
	public function testCreateAuditTrailEntrySkipsNonExistentTitle(): void {
		$harness = new AuditTrailTraitHarness();

		$mockTitle = $this->getMockBuilder( \stdClass::class )
			->addMethods( [ 'exists', 'getPrefixedText' ] )
			->getMock();
		$mockTitle->method( 'exists' )->willReturn( false );
		$mockTitle->method( 'getPrefixedText' )->willReturn( 'File:Missing.jpg' );

		// Non-existent title should cause early return (before touching services)
		$harness->callCreateAuditTrailEntry( $mockTitle, $this->createMockUser(), 'save', 'default' );
		$this->assertTrue( true, 'Non-existent title handled gracefully' );
	}

	/**
	 * Tests buildAuditSummary for the 'save' action.
	 * Note: Requires wfMessage to be available; skipped in standalone mode.
	 *
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\AuditTrailTrait
	 */
	public function testBuildAuditSummaryCallsWfMessage(): void {
		if ( !function_exists( 'wfMessage' ) ) {
			$this->markTestSkipped( 'wfMessage not available in standalone test environment' );
		}

		$harness = new AuditTrailTraitHarness();

		$summary = $harness->callBuildAuditSummary( 'save', 'default' );
		$this->assertIsString( $summary );
		$this->assertNotEmpty( $summary );
	}
}
