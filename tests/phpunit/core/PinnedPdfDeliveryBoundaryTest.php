<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\FileRepo\File\OldLocalFile;
use MediaWiki\Rest\ResponseFactory;
use MediaWiki\Rest\Stream;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\FileBackend\FSFile\TempFSFile;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\SourceVersionResolver
 * @covers \MediaWiki\Extension\Layers\Revision\PageHistoryAccess
 * @group Database
 */
class PinnedPdfDeliveryBoundaryTest extends RealAssetTestCase {

	private function fixture(): array {
		$actor = $this->actor();
		$fileTitle = 'File:PinnedDelivery-' . wfRandomString() . '.pdf';
		$file = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage.pdf', $fileTitle, '20261005100000'
		);
		$page = $this->getExistingTestPage();
		$surface = $this->makePdfSurface(
			'pdf-anchor', 'Plan001', $fileTitle, $file->getTimestamp(), $file->getSha1()
		);
		$revision = $this->publisher->publish(
			$page->getTitle(), $actor, $page->getLatest(), $this->buildDocument( [ $surface ] ),
			'Isolated pinned PDF delivery fixture'
		);
		$history = new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() );
		$content = $history->read( $page->getTitle(), $revision, $actor, $page->getId() );
		$expectedSource = $surface['source'];
		$storedSource = json_decode( $content->getText(), true )['surfaces'][0]['source'];
		ksort( $expectedSource );
		ksort( $storedSource );
		$this->assertSame( $expectedSource, $storedSource );
		return [ 'actor' => $actor, 'fileTitle' => $fileTitle, 'file' => $file, 'page' => $page,
			'surface' => $surface, 'revision' => $revision, 'history' => $history, 'content' => $content ];
	}

	/**
	 * @param resource $handle
	 * @param string $expected
	 * @return string
	 */
	private function verifiedBytes( $handle, string $expected ): string {
		$this->assertTrue( stream_get_meta_data( $handle )['seekable'] );
		$this->assertTrue( rewind( $handle ) );
		$hash = hash_init( 'sha256' );
		$this->assertSame( strlen( $expected ), hash_update_stream( $hash, $handle ) );
		$this->assertSame( hash( 'sha256', $expected ), hash_final( $hash ) );
		$this->assertTrue( rewind( $handle ) );
		$sha1 = hash_init( 'sha1' );
		$this->assertSame( strlen( $expected ), hash_update_stream( $sha1, $handle ) );
		$this->assertSame( sha1( $expected ), hash_final( $sha1 ) );
		$this->assertSame( strlen( $expected ), fstat( $handle )['size'] );
		$this->assertTrue( rewind( $handle ) );
		$bytes = stream_get_contents( $handle );
		$this->assertSame( $expected, $bytes );
		return $bytes;
	}

	private function archivedFixture(): array {
		$fixture = $this->fixture();
		$this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			$fixture['fileTitle'], '20261005120000', 'Isolated archive fixture'
		);
		$fixture['resolved'] = $this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'];
		$this->assertInstanceOf( OldLocalFile::class, $fixture['resolved'] );
		return $fixture;
	}

	private function readFixture( array $fixture ): array {
		$reader = new PageReadService( $fixture['history'], $this->resolver );
		return $reader->readBoundSurface(
			$fixture['page']->getTitle(), $fixture['revision'],
			'v1:' . $fixture['page']->getId() . ':pdf-anchor', $fixture['actor']
		);
	}

	private function assertRefused( callable $operation, string $message ): void {
		try {
			$operation();
			$this->fail( 'Expected unavailable pinned PDF' );
		} catch ( \DomainException $exception ) {
			$this->assertSame( $message, $exception->getMessage() );
		}
	}

	private function rows(): array {
		$result = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = $values;
			}
			usort( $rows, static fn ( $left, $right ) => strcmp( serialize( $left ), serialize( $right ) ) );
			$result[$table] = $rows;
		}
		return $result;
	}

	private function evidence( string $name, array $observations, array $files = [] ): void {
		$directory = getenv( 'LAYERS_PDF_DELIVERY_EVIDENCE_DIR' );
		if ( !is_string( $directory ) || $directory === '' ) {
			return;
		}
		$this->assertDirectoryExists( $directory );
		foreach ( $files as $filename => $bytes ) {
			$path = $directory . '/' . $filename;
			$this->assertFileDoesNotExist( $path );
			$this->assertSame( strlen( $bytes ), file_put_contents( $path, $bytes ) );
			$observations['files'][$filename] = [
				'bytes' => strlen( $bytes ), 'sha256' => hash( 'sha256', $bytes ),
				'sha1Hex' => sha1( $bytes ), 'mime' => ( new \finfo( FILEINFO_MIME_TYPE ) )->buffer( $bytes )
			];
		}
		$path = $directory . '/' . $name . '.json';
		$this->assertFileDoesNotExist( $path );
		$json = json_encode( $observations, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR ) . "\n";
		$this->assertSame( strlen( $json ), file_put_contents( $path, $json ) );
	}

	public function testNativeCopyPreservesAdmittedCurrentBytesAfterReupload(): void {
		$fixture = $this->fixture();
		$resolved = $this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'];
		$this->assertInstanceOf( LocalFile::class, $resolved );
		$reference = $this->repo->getLocalReference( $resolved->getPath() );
		$this->assertNotFalse( $reference );
		$this->assertNotNull( $reference );
		$currentPath = $resolved->getLocalRefPath();
		$this->assertSame( $reference->getPath(), $currentPath );
		$original = file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' );
		$this->assertSame( $original, file_get_contents( $currentPath ) );
		$copy = $this->repo->getLocalCopy( $resolved->getPath() );
		$this->assertInstanceOf( TempFSFile::class, $copy );
		$copyPath = $copy->getPath();
		$this->assertNotSame( $currentPath, $copyPath );
		$handle = fopen( $copyPath, 'rb' );
		$this->assertIsResource( $handle );
		$stream = new Stream( $handle );
		$copy->bind( $stream );
		$response = ( new ResponseFactory( [] ) )->create();
		$response->setBody( $stream );
		$response->setHeader( 'Content-Type', ( new \finfo( FILEINFO_MIME_TYPE ) )->buffer( $original ) );
		$response->setHeader( 'Content-Length', (string)$stream->getSize() );
		$response->setHeader( 'Cache-Control', 'private, no-store, max-age=0' );
		try {
			$this->verifiedBytes( $handle, $original );
			$this->assertSame( $fixture['surface']['source']['sha1'], $copy->getSha1Base36() );
			$replacement = $this->uploadFixtureFile(
				__DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$fixture['fileTitle'], '20261005120000', 'Isolated different PDF reupload'
			);
			$newBytes = file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf' );
			$this->assertNotSame( $original, $newBytes );
			$this->assertSame( 2, $resolved->pageCount() );
			$this->assertSame( 1, $replacement->pageCount() );
			$this->assertSame( $currentPath, $replacement->getLocalRefPath() );
			$this->assertSame( $newBytes, file_get_contents( $reference->getPath() ) );
			$this->assertSame( $newBytes, file_get_contents( $resolved->getLocalRefPath() ) );
			$staleCopy = $this->repo->getLocalCopy( $resolved->getPath() );
			$this->assertInstanceOf( TempFSFile::class, $staleCopy );
			try {
				$this->assertSame( $newBytes, file_get_contents( $staleCopy->getPath() ) );
				$this->assertNotSame( $fixture['surface']['source']['sha1'], $staleCopy->getSha1Base36() );
			} finally {
				$staleCopy->purge();
			}
			$this->assertSame( $original, $this->verifiedBytes( $handle, $original ) );
			$this->assertSame( $stream, $response->getBody() );
			$this->assertSame( 'application/pdf', $response->getHeaderLine( 'Content-Type' ) );
			$this->assertSame( (string)strlen( $original ), $response->getHeaderLine( 'Content-Length' ) );
			$this->assertSame( 'private, no-store, max-age=0', $response->getHeaderLine( 'Cache-Control' ) );
			$sink = fopen( 'php://temp', 'w+b' );
			$this->assertIsResource( $sink );
			try {
				$stream->rewind();
				$stream->copyToStream( $sink );
				rewind( $sink );
				$this->assertSame( $original, stream_get_contents( $sink ) );
			} finally {
				fclose( $sink );
			}
			$archived = $this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'];
			$this->assertInstanceOf( OldLocalFile::class, $archived );
			$this->assertSame( $fixture['surface']['source']['timestamp'], $archived->getTimestamp() );
			$this->assertSame( $fixture['surface']['source']['sha1'], $archived->getSha1() );
			$this->assertSame( $original, file_get_contents( $archived->getLocalRefPath() ) );
			$this->assertSame( $original, $this->repo->getBackend()->getFileContents(
				[ 'src' => $archived->getPath() ]
			) );
			$this->evidence( 'capture-current', [
				'pin' => $fixture['surface']['source'], 'revision' => $fixture['revision'],
				'ownerId' => $fixture['page']->getId(), 'currentClass' => get_class( $resolved ),
				'archivedClass' => get_class( $archived ), 'copyClass' => get_class( $copy ),
				'currentReferenceAfterReuploadSha256' => hash( 'sha256', file_get_contents( $currentPath ) ),
				'heldCopyAfterReuploadSha256' => hash( 'sha256', $this->verifiedBytes( $handle, $original ) ),
				'originalPageCount' => $resolved->pageCount(), 'replacementPageCount' => $replacement->pageCount(),
				'seekable' => stream_get_meta_data( $handle )['seekable'], 'length' => fstat( $handle )['size'],
				'responseObjectHeaders' => $response->getHeaders(),
				'responseEvidence' => 'same retained resource copied to a local sink; not HTTP'
			], [ 'original.pdf' => file_get_contents( $copyPath ), 'replacement.pdf' => $newBytes ] );
		} finally {
			$stream->close();
			$this->assertSame( 'resource (closed)', get_debug_type( $handle ) );
			$copy->purge();
			$this->assertFileDoesNotExist( $copyPath );
		}
	}

	public function testArchivedCopyIsSeekableAndOwnerRevisionAdmissionIsIndependent(): void {
		$fixture = $this->archivedFixture();
		$baseline = $this->readFixture( $fixture );
		$this->assertSame( $fixture['page']->getId(), $baseline['pageId'] );
		$this->assertSame( $fixture['revision'], $baseline['revisionId'] );
		$this->assertSame( $fixture['surface']['source']['sha1'], $baseline['surface']['source']['sha1'] );
		$copy = $this->repo->getBackend()->getLocalCopy( [
			'src' => $fixture['resolved']->getPath(), 'latest' => true
		] );
		$this->assertInstanceOf( TempFSFile::class, $copy );
		$path = $copy->getPath();
		$handle = fopen( $path, 'rb' );
		$this->assertIsResource( $handle );
		try {
			$this->verifiedBytes( $handle, file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) );
			$this->assertSame( $fixture['surface']['source']['sha1'], $copy->getSha1Base36() );
			$other = $this->getExistingTestPage();
			$before = $this->rows();
			$this->assertRefused( static function () use ( $fixture, $other ) {
				$fixture['history']->read( $other->getTitle(), $fixture['revision'], $fixture['actor'] );
			}, 'layers-revision-unavailable' );
			$reader = new PageReadService( $fixture['history'], $this->resolver );
			$this->assertRefused( static function () use ( $reader, $fixture, $other ) {
				$reader->readBoundSurface( $fixture['page']->getTitle(), $fixture['revision'],
					'v1:' . $other->getId() . ':pdf-anchor', $fixture['actor'] );
			}, 'layers-revision-unavailable' );
			$this->assertRefused( static function () use ( $fixture ) {
				$fixture['history']->read( $fixture['page']->getTitle(), 0, $fixture['actor'] );
			}, 'layers-revision-unavailable' );
			$permissions = $this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' );
			try {
				$this->setGroupPermissions( '*', 'read', true );
				$anonymous = $this->getServiceContainer()->getUserFactory()->newAnonymous();
				$this->assertFalse( $anonymous->isAllowed( 'editlayers' ) );
				$this->assertSame( $fixture['content']->getText(), $fixture['history']->read(
					$fixture['page']->getTitle(), $fixture['revision'], $anonymous
				)->getText() );
				$this->assertCount( 1, $this->resolver->resolve( $fixture['content'], $anonymous ) );
				$this->setGroupPermissions( '*', 'read', false );
				$denied = $this->getServiceContainer()->getUserFactory()->newAnonymous();
				$this->assertFalse( $denied->authorizeRead( 'read', $fixture['page']->getTitle() ) );
				$this->assertRefused( static function () use ( $fixture, $denied ) {
					$fixture['history']->read( $fixture['page']->getTitle(), $fixture['revision'], $denied );
				}, 'layers-revision-unavailable' );
				$this->assertRefused( function () use ( $fixture, $denied ) {
					$this->resolver->resolve( $fixture['content'], $denied );
				}, 'layers-source-unavailable' );
			} finally {
				$this->overrideConfigValue( 'GroupPermissions', $permissions );
			}
			$this->assertSame( $permissions, $this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' ) );
			$this->assertSame( $baseline, $this->readFixture( $fixture ) );
			$this->assertSame( $before, $this->rows() );
			$this->evidence( 'archive-and-admission', [
				'authorizedRead' => $baseline, 'restoredRead' => $this->readFixture( $fixture ),
				'capturedSha256' => hash( 'sha256', $this->verifiedBytes( $handle,
					file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) ) ),
				'rowWitnessBefore' => hash( 'sha256', serialize( $before ) ),
				'rowWitnessAfter' => hash( 'sha256', serialize( $this->rows() ) ),
				'tables' => array_keys( $before ), 'anonymousAllowedThenDenied' => true
			] );
		} finally {
			fclose( $handle );
			$copy->purge();
			$this->assertFileDoesNotExist( $path );
		}
	}

	public static function provideVisibilityCases(): array {
		return [ 'archived media' => [ 'archive' ],
			'owner revision' => [ 'revision' ] ];
	}

	/** @dataProvider provideVisibilityCases */
	public function testCaptureDoesNotConferAdmissionAfterVisibilityChanges( string $kind ): void {
		$fixture = $kind === 'archive' ? $this->archivedFixture() : $this->fixture();
		$file = $this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'];
		$baseline = $this->readFixture( $fixture );
		$copy = $this->repo->getLocalCopy( $file->getPath() );
		$this->assertInstanceOf( TempFSFile::class, $copy );
		$path = $copy->getPath();
		$bytes = file_get_contents( $path );
		$before = $this->rows();
		if ( $kind === 'revision' ) {
			$table = 'revision';
			$column = 'rev_deleted';
			$where = [ 'rev_id' => $fixture['revision'] ];
			$hidden = RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED;
		} else {
			$table = 'oldimage';
			$column = 'oi_deleted';
			$where = [ 'oi_name' => $file->getName(), 'oi_timestamp' => $file->getTimestamp() ];
			$hidden = File::DELETED_FILE | File::DELETED_RESTRICTED;
		}
		$original = $this->getDb()->newSelectQueryBuilder()->select( $column )->from( $table )
			->where( $where )->caller( __METHOD__ )->fetchField();
		$this->assertNotFalse( $original );
		try {
			$this->getDb()->newUpdateQueryBuilder()->update( $table )->set( [ $column => $hidden ] )
				->where( $where )->caller( __METHOD__ )->execute();
			$this->assertSame( $bytes, file_get_contents( $copy->getPath() ) );
			$this->assertRefused( function () use ( $fixture ) {
				$this->readFixture( $fixture );
			}, 'layers-revision-unavailable' );
			if ( $kind !== 'revision' ) {
				$this->assertRefused( function () use ( $fixture ) {
					$this->resolver->resolve( $fixture['content'], $fixture['actor'] );
				}, 'layers-source-unavailable' );
			}
		} finally {
			$this->getDb()->newUpdateQueryBuilder()->update( $table )->set( [ $column => (int)$original ] )
				->where( $where )->caller( __METHOD__ )->execute();
			$copy->purge();
			$this->assertFileDoesNotExist( $path );
		}
		$this->assertSame( (int)$original, (int)$this->getDb()->newSelectQueryBuilder()->select( $column )
			->from( $table )->where( $where )->caller( __METHOD__ )->fetchField() );
		$this->assertSame( $bytes, file_get_contents( $file->getLocalRefPath() ) );
		$this->assertSame( $baseline, $this->readFixture( $fixture ) );
		$this->assertSame( $before, $this->rows() );
		$this->evidence( 'visibility-' . $kind, [
			'authorizedRead' => $baseline, 'restoredRead' => $this->readFixture( $fixture ),
			'table' => $table, 'column' => $column, 'beforeFlags' => (int)$original, 'hiddenFlags' => $hidden,
			'afterFlags' => (int)$this->getDb()->newSelectQueryBuilder()->select( $column )->from( $table )
				->where( $where )->caller( __METHOD__ )->fetchField(),
			'originalSha256' => hash( 'sha256', $bytes ),
			'restoredSha256' => hash( 'sha256', file_get_contents( $file->getLocalRefPath() ) ),
			'tables' => array_keys( $before ), 'rowWitnessBefore' => hash( 'sha256', serialize( $before ) ),
			'rowWitnessAfter' => hash( 'sha256', serialize( $this->rows() ) )
		] );
	}

	public static function providePinStates(): array {
		return [ 'current' => [ false ], 'archived' => [ true ] ];
	}

	/** @dataProvider providePinStates */
	public function testMissingPinnedMediaRefusesReadAndRestoresExactBytes( bool $archived ): void {
		$fixture = $archived ? $this->archivedFixture() : $this->fixture();
		$baseline = $this->readFixture( $fixture );
		$file = $this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'];
		$path = $file->getPath();
		$backend = $this->repo->getBackend();
		$original = $backend->getFileContents( [ 'src' => $path ] );
		$this->assertIsString( $original );
		$copy = $backend->getLocalCopy( [ 'src' => $path, 'latest' => true ] );
		$this->assertInstanceOf( TempFSFile::class, $copy );
		$copyPath = $copy->getPath();
		$before = $this->rows();
		try {
			$this->assertStatusGood( $backend->delete( [ 'src' => $path ] ) );
			$this->assertFalse( $this->repo->fileExists( $path ) );
			$this->assertSame( $original, file_get_contents( $copyPath ) );
			$this->assertFalse( $backend->getLocalCopy( [ 'src' => $path, 'latest' => true ] ) );
			$this->assertRefused( function () use ( $fixture ) {
				$this->resolver->resolve( $fixture['content'], $fixture['actor'] );
			}, 'layers-source-unavailable' );
			$this->assertRefused( function () use ( $fixture ) {
				$this->readFixture( $fixture );
			}, 'layers-revision-unavailable' );
		} finally {
			$this->assertStatusGood( $backend->quickCreate( [ 'dst' => $path, 'content' => $original ] ) );
			$copy->purge();
			$this->assertFileDoesNotExist( $copyPath );
		}
		$this->assertSame( $original, $backend->getFileContents( [ 'src' => $path ] ) );
		$this->assertSame( hash( 'sha256', $original ),
			hash( 'sha256', $backend->getFileContents( [ 'src' => $path ] ) ) );
		$this->assertSame( $baseline, $this->readFixture( $fixture ) );
		$this->assertSame( $before, $this->rows() );
		$this->evidence( 'missing-' . ( $archived ? 'archive' : 'current' ), [
			'authorizedRead' => $baseline, 'restoredRead' => $this->readFixture( $fixture ),
			'originalSha256' => hash( 'sha256', $original ),
			'restoredSha256' => hash( 'sha256', $backend->getFileContents( [ 'src' => $path ] ) ),
			'tables' => array_keys( $before ), 'rowWitnessBefore' => hash( 'sha256', serialize( $before ) ),
			'rowWitnessAfter' => hash( 'sha256', serialize( $this->rows() ) )
		] );
	}
}
