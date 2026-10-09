<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\WikiMap\WikiMap;
use Wikimedia\FileBackend\FSFileBackend;

trait IsolatedLocalRepoFixture {
	public static function guardPhysicalPath( string $path, string $root ): void {
		if ( realpath( $root ) !== $root ||
			( $path !== $root && !str_starts_with( $path, $root . '/' ) ) ) {
			throw new \RuntimeException( 'Native fixture escaped its temporary root' );
		}
		$existing = $path;
		while ( !file_exists( $existing ) && !is_link( $existing ) ) {
			$existing = dirname( $existing );
		}
		for ( $ancestor = $existing; dirname( $ancestor ) !== $ancestor; $ancestor = dirname( $ancestor ) ) {
			if ( is_link( $ancestor ) || ( file_exists( $ancestor ) && realpath( $ancestor ) !== $ancestor ) ) {
				throw new \RuntimeException( 'Linked native fixture ancestry refused' );
			}
		}
		if ( !is_writable( $existing ) ||
			( function_exists( 'posix_geteuid' ) && fileowner( $existing ) !== posix_geteuid() ) ) {
			throw new \RuntimeException( 'Native fixture path ownership or writability refused' );
		}
	}

	public static function guardIsolatedFixtureRepository( LocalRepo $repo ): array {
		$backend = $repo->getBackend();
		if ( !$backend instanceof FSFileBackend || !method_exists( $backend, 'fixturePath' ) ||
			!( new \ReflectionClass( $backend ) )->isAnonymous() ) {
			throw new \RuntimeException( 'Installed repository refused before fixture upload' );
		}
		$paths = [];
		foreach ( [ 'public', 'thumb', 'transcoded', 'temp', 'deleted' ] as $zone ) {
			$storage = $repo->getZonePath( $zone ) ??
				'mwstore://' . $backend->getName() . '/layers-native-fixture-' . $zone;
			$paths[$zone] = $backend->fixturePath( $storage );
		}
		$paths['archive'] = $backend->fixturePath( $repo->getZonePath( 'public' ) . '/archive' );
		return $paths;
	}

	protected function setUpIsolatedLocalRepoFixture(): void {
		$directory = $this->getNewTempDirectory();
		$root = realpath( wfTempDir() );
		if ( !$root || !str_starts_with( $directory, $root . '/' ) ) {
			throw new \RuntimeException( 'Native fixture framework root refused' );
		}
		$paths = [];
		foreach ( [ 'public', 'thumb', 'transcoded', 'temp', 'deleted', 'public/archive' ] as $zone ) {
			$path = $directory . '/' . $zone;
			self::guardPhysicalPath( $path, $directory );
			if ( !is_dir( $path ) ) {
				mkdir( $path, 0777, true );
			}
			if ( $zone !== 'public/archive' ) {
				$paths['layers-native-fixture-' . $zone] = $path;
			}
		}
		$backend = new class( [ 'name' => 'layers-native-fixture-' . wfRandomString( 8 ),
			'wikiId' => WikiMap::getCurrentWikiId(), 'containerPaths' => $paths ], $directory,
			static fn ( $path, $root ) => self::guardPhysicalPath( $path, $root ) ) extends FSFileBackend {
			private string $fixtureRoot;
			private \Closure $guard;

			public function __construct( array $config, string $fixtureRoot, \Closure $guard ) {
				$this->fixtureRoot = $fixtureRoot;
				$this->guard = $guard;
				parent::__construct( $config );
			}

			/** @inheritDoc */
			protected function resolveToFSPath( $storagePath ) {
				$path = parent::resolveToFSPath( $storagePath );
				if ( is_string( $path ) ) {
					( $this->guard )( $path, $this->fixtureRoot );
				}
				return $path;
			}

			public function fixturePath( string $storagePath ): string {
				$path = $this->resolveToFSPath( $storagePath );
				if ( !is_string( $path ) ) {
					throw new \RuntimeException( 'Native fixture storage path refused' );
				}
				return $path;
			}
		};
		$repo = new LocalRepo( [ 'name' => 'layers-native-fixture', 'backend' => $backend, 'url' => '/test-files' ] );
		$physical = self::guardIsolatedFixtureRepository( $repo );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $repo );
		$repos->method( 'findFile' )->willReturnCallback( static fn ( $title, $options = [] ) =>
			$repo->findFile( $title, $options ) );
		$this->setService( 'RepoGroup', $repos );
		$output = getenv( 'LAYERS_ISOLATED_FIXTURE_WITNESS' );
		if ( $output ) {
			file_put_contents( $output, json_encode( [ 'test' => $this->getName(), 'class' => static::class,
				'root' => $directory, 'frameworkRoot' => $root, 'paths' => $physical,
				'uid' => function_exists( 'posix_geteuid' ) ? posix_geteuid() : null,
				'backend' => get_class( $backend ), 'helperSha256' => hash_file( 'sha256', __FILE__ ),
				'classSha256' => hash_file( 'sha256', ( new \ReflectionClass( $this ) )->getFileName() ) ] ) . "\n",
				FILE_APPEND | LOCK_EX );
		}
	}
}
