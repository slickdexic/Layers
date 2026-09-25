<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use Wikimedia\FileBackend\FSFile\TempFSFileFactory;

/** Internal configuration boundary; does not infer web-server aliases or register services. */
class PrivateStagingDirectory {
	/**
	 * Validate explicit local staging before constructing the renderer's temporary-file factory.
	 * Creates no directories or files and has no default directory fallback.
	 * The operator must supply every document root and served repository/alias root.
	 * Parent directories must be controlled by the operator: validation cannot prevent later remapping.
	 *
	 * @param string $directory Existing absolute writable local directory
	 * @param string[] $publicRoots Nonempty complete list of existing absolute served directories
	 * @return TempFSFileFactory Factory using the canonical staging path
	 * @throws \DomainException Invalid, unknown or overlapping configuration
	 */
	public static function createFactory( string $directory, array $publicRoots ): TempFSFileFactory {
		$staging = self::canonicalDirectory( $directory );
		if ( !$publicRoots || !is_writable( $staging ) ) {
			throw new \DomainException( 'layers-private-staging-invalid' );
		}
		foreach ( $publicRoots as $root ) {
			if ( !is_string( $root ) ) {
				throw new \DomainException( 'layers-private-staging-invalid' );
			}
			$public = self::canonicalDirectory( $root );
			// Reject overlap in either direction, including a staging parent of public storage.
			if ( self::contains( $public, $staging ) || self::contains( $staging, $public ) ) {
				throw new \DomainException( 'layers-private-staging-invalid' );
			}
		}
		return new TempFSFileFactory( $staging );
	}

	/** @return string Canonical existing absolute directory */
	private static function canonicalDirectory( string $path ): string {
		// No relative paths, stream wrappers or embedded NULs. Accept POSIX, drive and UNC paths.
		if ( $path === '' || strpos( $path, "\0" ) !== false ||
			!preg_match( '~^(?:/|[A-Za-z]:[\\\\/]|\\\\\\\\)~', $path )
		) {
			throw new \DomainException( 'layers-private-staging-invalid' );
		}
		clearstatcache( true );
		$canonical = realpath( $path );
		if ( $canonical === false || !is_dir( $canonical ) ) {
			throw new \DomainException( 'layers-private-staging-invalid' );
		}
		return $canonical;
	}

	/** Compare full directory components, including canonicalized symlink targets. */
	private static function contains( string $parent, string $child ): bool {
		if ( PHP_OS_FAMILY === 'Windows' ) {
			$parent = strtolower( str_replace( '\\', '/', $parent ) );
			$child = strtolower( str_replace( '\\', '/', $child ) );
		}
		$parent = rtrim( $parent, '/' );
		$child = rtrim( $child, '/' );
		return $parent === $child || strpos( $child, $parent . '/' ) === 0;
	}
}
