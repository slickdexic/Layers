<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PrivateStagingDirectory;

/**
 * Acceptance and configuration tests for PrivateStagingDirectory.
 *
 * Verifies private staging path validation, multiple served roots, symlink resolution,
 * path normalization, forbidden root ancestors, stream wrapper rejection, non-creation,
 * and effective write permissions.
 *
 * @covers \MediaWiki\Extension\Layers\Revision\PrivateStagingDirectory
 */
class PrivateStagingDirectoryTest extends \MediaWikiIntegrationTestCase {

	/** Valid private sibling directories with lexical prefix similarity are accepted. */
	public function testPrivateSiblingFactoryCreatesOnlyPrivateArtifact(): void {
		$root = $this->getNewTempDirectory();
		mkdir( $root . '/public' );
		mkdir( $root . '/public-private' );
		$factory = PrivateStagingDirectory::createFactory( $root . '/public-private', [ $root . '/public' ] );
		$this->assertSame( [], glob( $root . '/public-private/*' ) );
		$artifact = $factory->newTempFSFile( 'layers-test-', 'png' );
		$this->assertNotNull( $artifact );
		try {
			$this->assertSame( realpath( $root . '/public-private' ), dirname( $artifact->getPath() ) );
			$this->assertSame( [], glob( $root . '/public/*' ) );
		} finally {
			$this->assertTrue( $artifact->purge() );
		}
	}

	/** Multiple served roots reject when only a later root overlaps in either direction. */
	public function testMultipleServedRootsRejectWhenOnlyLaterRootOverlaps(): void {
		$root = $this->getNewTempDirectory();
		mkdir( $root . '/public-first' );
		mkdir( $root . '/public-second' );
		mkdir( $root . '/public-second/nested-staging' );
		mkdir( $root . '/staging-parent' );
		mkdir( $root . '/staging-parent/nested-public' );
		file_put_contents( $root . '/sentinel', 'Keep' );

		// Case 1: Staging is child of later served root
		try {
			PrivateStagingDirectory::createFactory(
				$root . '/public-second/nested-staging',
				[ $root . '/public-first', $root . '/public-second' ]
			);
			$this->fail( 'Overlap with second served root must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
		}

		// Case 2: Staging is parent of later served root
		try {
			PrivateStagingDirectory::createFactory(
				$root . '/staging-parent',
				[ $root . '/public-first', $root . '/staging-parent/nested-public' ]
			);
			$this->fail( 'Staging parent of second served root must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
		}

		$this->assertSame( [], glob( $root . '/public-first/*' ) );
		$this->assertSame( [], glob( $root . '/public-second/nested-staging/*' ) );
		$this->assertSame( 'Keep', file_get_contents( $root . '/sentinel' ) );
	}

	/** Symlinks to public storage are rejected; symlinks to real private targets are accepted. */
	public function testSymlinksToServedStorageAreRejectedWhilePrivateSymlinkIsAllowed(): void {
		$root = $this->getNewTempDirectory();
		mkdir( $root . '/public' );
		mkdir( $root . '/private-target' );

		$publicAlias = $root . '/public-alias';
		$stagingAlias = $root . '/staging-alias';
		$servedLink = $root . '/served-link';

		$this->assertTrue( symlink( $root . '/public', $publicAlias ) );

		try {
			// 1. Staging symlink pointing to public directory is rejected
			try {
				PrivateStagingDirectory::createFactory( $publicAlias, [ $root . '/public' ] );
				$this->fail( 'Staging symlink to public directory must be rejected' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
			}

			// 2. Served root expressed through symlink pointing to public storage
			$this->assertTrue( symlink( $root . '/public', $servedLink ) );
			try {
				PrivateStagingDirectory::createFactory( $root . '/public', [ $servedLink ] );
				$this->fail( 'Served root expressed through symlink must detect overlap' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
			}

			// 3. Staging symlink to an actually private directory is allowed
			$this->assertTrue( symlink( $root . '/private-target', $stagingAlias ) );
			$factory = PrivateStagingDirectory::createFactory( $stagingAlias, [ $root . '/public' ] );
			$artifact = $factory->newTempFSFile( 'layers-test-', 'png' );
			$this->assertNotNull( $artifact );
			try {
				$this->assertSame(
					realpath( $root . '/private-target' ),
					dirname( $artifact->getPath() )
				);
				$this->assertSame( [], glob( $root . '/public/*' ) );
			} finally {
				$this->assertTrue( $artifact->purge() );
			}
		} finally {
			if ( file_exists( $publicAlias ) || is_link( $publicAlias ) ) {
				unlink( $publicAlias );
			}
			if ( file_exists( $servedLink ) || is_link( $servedLink ) ) {
				unlink( $servedLink );
			}
			if ( file_exists( $stagingAlias ) || is_link( $stagingAlias ) ) {
				unlink( $stagingAlias );
			}
		}
		$this->assertSame( [], glob( $root . '/public/*' ) );
		$this->assertSame( [], glob( $root . '/private-target/*' ) );
	}

	/** Trailing separators and dot/parent components are normalized; escaping is rejected. */
	public function testPathNormalizationTrailingSeparatorsAndDotComponents(): void {
		$root = $this->getNewTempDirectory();
		mkdir( $root . '/public' );
		mkdir( $root . '/public/child' );
		mkdir( $root . '/private' );
		mkdir( $root . '/private/sub' );

		// Trailing slashes on valid private staging and public roots are normalized
		$factory = PrivateStagingDirectory::createFactory(
			$root . '/private///',
			[ $root . '/public/' ]
		);
		$artifact = $factory->newTempFSFile( 'layers-test-', 'png' );
		$this->assertNotNull( $artifact );
		try {
			$this->assertSame( realpath( $root . '/private' ), dirname( $artifact->getPath() ) );
		} finally {
			$this->assertTrue( $artifact->purge() );
		}

		// Trailing slashes on overlapping staging and public roots must still be rejected
		try {
			PrivateStagingDirectory::createFactory( $root . '/public///', [ $root . '/public/' ] );
			$this->fail( 'Overlapping paths with trailing slashes must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
		}

		// Valid dot/parent components that resolve inside private staging
		$factoryDot = PrivateStagingDirectory::createFactory(
			$root . '/private/./sub/..',
			[ $root . '/public' ]
		);
		$artifactDot = $factoryDot->newTempFSFile( 'layers-test-', 'png' );
		$this->assertNotNull( $artifactDot );
		try {
			$this->assertSame( realpath( $root . '/private' ), dirname( $artifactDot->getPath() ) );
		} finally {
			$this->assertTrue( $artifactDot->purge() );
		}

		// Dot/parent traversal attempting to reach public storage
		foreach ( [
			$root . '/private/../public',
			$root . '/public/.',
			$root . '/public/child/..',
		] as $traversalPath ) {
			try {
				PrivateStagingDirectory::createFactory( $traversalPath, [ $root . '/public' ] );
				$this->fail( "Traversal path '$traversalPath' into public storage must be rejected" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
			}
		}
	}

	/** Filesystem root and container directory ancestors are forbidden as staging or served roots. */
	public function testRootDirectoryAsForbiddenAncestorIsRejected(): void {
		$root = $this->getNewTempDirectory();
		mkdir( $root . '/public' );
		mkdir( $root . '/private' );

		$fsRoot = realpath( $root );
		while ( dirname( $fsRoot ) !== $fsRoot ) {
			$fsRoot = dirname( $fsRoot );
		}

		// 1. Filesystem root as staging
		try {
			PrivateStagingDirectory::createFactory( $fsRoot, [ $root . '/public' ] );
			$this->fail( 'Filesystem root as staging directory must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
		}

		// 2. Filesystem root as served root
		try {
			PrivateStagingDirectory::createFactory( $root . '/private', [ $fsRoot ] );
			$this->fail( 'Filesystem root as served root must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
		}

		// 3. Isolated test temp directory as staging (ancestor of public)
		try {
			PrivateStagingDirectory::createFactory( $root, [ $root . '/public' ] );
			$this->fail( 'Ancestor directory as staging must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
		}

		// 4. Isolated test temp directory as served root (ancestor of private staging)
		try {
			PrivateStagingDirectory::createFactory( $root . '/private', [ $root ] );
			$this->fail( 'Ancestor directory as served root must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
		}
	}

	/** Stream wrappers, NUL bytes, empty/non-string values and files are rejected without side effects. */
	public function testMalformedInputsStreamWrappersAndTypeViolationsAreRejected(): void {
		$root = $this->getNewTempDirectory();
		mkdir( $root . '/public' );
		mkdir( $root . '/private' );
		file_put_contents( $root . '/sentinel', 'Keep' );

		$invalidInputs = [
			// Stream wrappers as staging
			[ 'mwstore://local-backend/public', [ $root . '/public' ] ],
			[ 'file://' . $root . '/private', [ $root . '/public' ] ],
			[ 'php://memory', [ $root . '/public' ] ],
			[ 'php://temp', [ $root . '/public' ] ],
			// Stream wrappers as served root
			[ $root . '/private', [ 'mwstore://local-backend/public' ] ],
			[ $root . '/private', [ 'file://' . $root . '/public' ] ],
			[ $root . '/private', [ 'php://temp' ] ],
			// Embedded NUL
			[ $root . "/private\0dir", [ $root . '/public' ] ],
			[ $root . '/private', [ $root . "/public\0dir" ] ],
			// Relative paths
			[ '', [ $root . '/public' ] ],
			[ '.', [ $root . '/public' ] ],
			[ 'relative/path', [ $root . '/public' ] ],
			[ $root . '/private', [ '.' ] ],
			[ $root . '/private', [ 'relative/path' ] ],
			// Non-string root entries
			[ $root . '/private', [ null ] ],
			[ $root . '/private', [ 123 ] ],
			[ $root . '/private', [ false ] ],
			[ $root . '/private', [ true ] ],
			[ $root . '/private', [ [] ] ],
			// Empty public roots
			[ $root . '/private', [] ],
			[ $root . '/private', [ '' ] ],
			// File-valued staging and roots
			[ $root . '/sentinel', [ $root . '/public' ] ],
			[ $root . '/private', [ $root . '/sentinel' ] ],
			// Missing directories
			[ $root . '/missing', [ $root . '/public' ] ],
			[ $root . '/private', [ $root . '/missing' ] ],
		];

		foreach ( $invalidInputs as $index => [ $staging, $served ] ) {
			try {
				PrivateStagingDirectory::createFactory( $staging, $served );
				$this->fail( "Invalid input at index $index must be rejected" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
			}
		}

		$this->assertFileDoesNotExist( $root . '/missing' );
		$this->assertSame( [], glob( $root . '/private/*' ) );
		$this->assertSame( [], glob( $root . '/public/*' ) );
		$this->assertSame( 'Keep', file_get_contents( $root . '/sentinel' ) );
	}

	/** Missing staging directories are not silently created and return no factory. */
	public function testMissingStagingIsNotSilentlyCreated(): void {
		$root = $this->getNewTempDirectory();
		mkdir( $root . '/public' );
		file_put_contents( $root . '/sentinel', 'Keep' );
		$missing = $root . '/missing-staging';

		try {
			PrivateStagingDirectory::createFactory( $missing, [ $root . '/public' ] );
			$this->fail( 'Missing staging directory must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
		}

		$this->assertFileDoesNotExist( $missing );
		$this->assertSame( 'Keep', file_get_contents( $root . '/sentinel' ) );
	}

	/** Effective write denial must be tested honestly, with temporary permissions restored. */
	public function testUnwritableStagingRejectionOrEnvironmentOverride(): void {
		$root = $this->getNewTempDirectory();
		mkdir( $root . '/public' );
		$unwritable = $root . '/unwritable-staging';
		mkdir( $unwritable );
		$originalMode = fileperms( $unwritable ) & 0777;
		try {
			$this->assertTrue( chmod( $unwritable, 0555 ) );
			clearstatcache( true );
			if ( is_writable( $unwritable ) ) {
				$this->markTestSkipped( 'Effective runner can still write; no write-denial coverage on this runner.' );
			}
			try {
				PrivateStagingDirectory::createFactory( $unwritable, [ $root . '/public' ] );
				$this->fail( 'Unwritable staging directory must be rejected' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-private-staging-invalid', $e->getMessage() );
			}
			$this->assertSame( [], glob( $unwritable . '/*' ) );
		} finally {
			$this->assertTrue( chmod( $unwritable, $originalMode ) );
			clearstatcache( true );
		}
	}
}
