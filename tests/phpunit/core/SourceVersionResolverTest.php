<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Permissions\Authority;

/**
 * Controlled repository/file doubles plus one real temporary-upload scenario.
 * @group Database
 * @covers \MediaWiki\Extension\Layers\Revision\SourceVersionResolver
 */
class SourceVersionResolverTest extends \MediaWikiIntegrationTestCase {
	private function document( string $kind = 'image' ): LayersDocumentContent {
		$doc = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ) );
		$doc->surfaces = [ $doc->surfaces[$kind === 'image' ? 1 : ( $kind === 'pdf' ? 2 : 0 )] ];
		return new LayersDocumentContent( json_encode( $doc ) );
	}

	private function resolver( LocalRepo $repo ): SourceVersionResolver {
		return new SourceVersionResolver( $repo, $this->getServiceContainer()->getTitleFactory() );
	}

	private function authority( bool $allowed = true ): Authority {
		$authority = $this->createMock( Authority::class );
		$authority->method( 'authorizeRead' )->willReturn( $allowed );
		return $authority;
	}

	/**
	 * @dataProvider provideSources
	 * @param string $kind
	 * @param string|null $failure
	 */
	public function testExactSourceValidation( string $kind, ?string $failure ): void {
		$content = $this->document( $kind );
		$source = json_decode( $content->getText() )->surfaces[0]->source;
		$repo = $this->createMock( LocalRepo::class );
		$file = $this->createMock( File::class );
		$file->method( 'getRepo' )->willReturn(
			$failure === 'foreign' ? $this->createMock( LocalRepo::class ) : $repo );
		$file->method( 'isVisible' )->willReturn( $failure !== 'invisible' );
		$file->method( 'isDeleted' )->willReturn( $failure === 'hidden' );
		$file->method( 'getName' )->willReturn(
			$failure === 'redirect' ? 'Other.png' : substr( $source->fileTitle, 5 ) );
		$file->method( 'getTimestamp' )->willReturn( $failure === 'timestamp' ? '20260907120000' : $source->timestamp );
		$file->method( 'getSha1' )->willReturn( $failure === 'hash' ? str_repeat( 'z', 31 ) : $source->sha1 );
		$file->method( 'getPath' )->willReturn( $failure === 'path' ? false : 'mwstore://test/source' );
		$file->method( 'getMediaType' )->willReturn( $failure === 'type' ? 'VIDEO' : 'BITMAP' );
		$file->method( 'getMimeType' )->willReturn( $failure === 'type' ? 'image/png' : 'application/pdf' );
		$file->method( 'pageCount' )->willReturn(
			$failure === 'pages' ? 1 : ( $failure === 'unknown-pages' ? false : 2 ) );
		$repo->method( 'fileExists' )->willReturn( $failure !== 'bytes' );
		$repo->expects( $this->once() )->method( 'findFile' )->with(
			$this->callback( static function ( $title ) use ( $source ) {
				return 'File:' . $title->getDBkey() === $source->fileTitle;
			} ),
			[ 'time' => $source->timestamp, 'ignoreRedirect' => true, 'latest' => true ]
		)->willReturn( $failure === 'missing' ? false : $file );
		if ( $failure !== null ) {
			$this->expectException( \DomainException::class );
			$this->expectExceptionMessage( 'layers-source-unavailable' );
		}
		$result = $this->resolver( $repo )->resolve( $content, $this->authority() );
		$this->assertSame( [ $file ], array_values( $result ) );
	}

	/** @return array */
	public static function provideSources(): array {
		$cases = [ 'image' => [ 'image', null ], 'pdf' => [ 'pdf', null ] ];
		foreach ( [ 'missing', 'foreign', 'invisible', 'hidden', 'redirect', 'timestamp', 'hash',
			'path', 'bytes', 'type' ] as $failure ) {
			$cases['image-' . $failure] = [ 'image', $failure ];
		}
		foreach ( [ 'pages', 'unknown-pages', 'type' ] as $failure ) {
			$cases['pdf-' . $failure] = [ 'pdf', $failure ];
		}
		return $cases;
	}

	public function testSlidesDoNotLookUpFilesOrRequireSourceRead(): void {
		$repo = $this->createMock( LocalRepo::class );
		$repo->expects( $this->never() )->method( 'findFile' );
		$authority = $this->createMock( Authority::class );
		$authority->expects( $this->never() )->method( 'authorizeRead' );
		$this->assertSame( [], $this->resolver( $repo )->resolve( $this->document( 'slide' ), $authority ) );
	}

	public function testDeniedReadDoesNotLookUpFile(): void {
		$repo = $this->createMock( LocalRepo::class );
		$repo->expects( $this->never() )->method( 'findFile' );
		$this->expectException( \DomainException::class );
		$this->resolver( $repo )->resolve( $this->document(), $this->authority( false ) );
	}

	public function testNoncanonicalTitleRejectedBeforeLookup(): void {
		$doc = json_decode( $this->document()->getText() );
		$doc->surfaces[0]->source->fileTitle = 'File:Diagram with spaces.png';
		$repo = $this->createMock( LocalRepo::class );
		$repo->expects( $this->never() )->method( 'findFile' );
		$this->expectException( \DomainException::class );
		$this->resolver( $repo )->resolve( new LayersDocumentContent( json_encode( $doc ) ), $this->authority() );
	}

	public function testInvalidSnapshotRejectedBeforeLookup(): void {
		$repo = $this->createMock( LocalRepo::class );
		$repo->expects( $this->never() )->method( 'findFile' );
		$this->expectException( \InvalidArgumentException::class );
		$this->resolver( $repo )->resolve( new LayersDocumentContent( '{}' ), $this->authority() );
	}

	public function testRealLocalUploadReplacementPreservesExactOldVersion(): void {
		$directory = $this->getNewTempDirectory();
		$paths = [];
		foreach ( [ 'public', 'thumb', 'transcoded', 'temp', 'deleted' ] as $zone ) {
			$paths['layers-test-' . $zone] = $directory . '/' . $zone;
		}
		$backend = new \Wikimedia\FileBackend\FSFileBackend( [
			'name' => 'layers-source-test', 'wikiId' => \MediaWiki\WikiMap\WikiMap::getCurrentWikiId(),
			'containerPaths' => $paths
		] );
		$repo = new LocalRepo( [ 'name' => 'layers-test', 'backend' => $backend, 'url' => '/test-files' ] );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:Layers_source_test.png' );
		$user = $this->getTestSysop()->getUser();
		$input = $this->getNewTempFile();
		$png = base64_decode(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6X8AAAAASUVORK5CYII=' );
		file_put_contents( $input, $png );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( $input, 'Initial', 'Test file', 0, false,
			'20260906120000', $user )->isOK() );
		$doc = json_decode( $this->document()->getText() );
		$doc->surfaces[0]->source->fileTitle = 'File:Layers_source_test.png';
		$doc->surfaces[0]->source->sha1 = $file->getSha1();
		$content = new LayersDocumentContent( json_encode( $doc ) );
		$this->assertCount( 1, $this->resolver( $repo )->resolve( $content, $user ) );
		file_put_contents( $input, $png . "\n" );
		$this->assertTrue( $file->upload( $input, 'Replacement', 'Test file', 0, false,
			'20260907120000', $user )->isOK() );
		$resolved = array_values( $this->resolver( $repo )->resolve( $content, $user ) )[0];
		$this->assertInstanceOf( \MediaWiki\FileRepo\File\OldLocalFile::class, $resolved );
		$this->assertSame( '20260906120000', $resolved->getTimestamp() );
		$this->assertSame( $doc->surfaces[0]->source->sha1, $resolved->getSha1() );
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
			->set( [ 'oi_deleted' => File::DELETED_FILE ] )
			->where( [ 'oi_name' => $title->getDBkey() ] )->caller( __METHOD__ )->execute();
		// Even this privileged actor cannot republish a hidden source through this gate.
		$this->expectException( \DomainException::class );
		$this->resolver( $repo )->resolve( $content, $user );
	}
}
