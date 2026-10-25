<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PinnedPdfSource;
use MediaWiki\Extension\Layers\Revision\PinnedPdfStream;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\File\OldLocalFile;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use Wikimedia\FileBackend\FSFile\TempFSFile;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PinnedPdfSource
 * @group Database
 */
class PinnedPdfSourceTest extends RealAssetTestCase {
	private array $copyPaths = [];

	private function fixture( bool $extras = false ): array {
		$actor = $this->actor();
		$fileTitle = 'File:PinnedSource-' . wfRandomString() . '.pdf';
		$file = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage.pdf', $fileTitle, '20261005100000'
		);
		$page = $this->getExistingTestPage();
		$surface = $this->makePdfSurface(
			'pdf-anchor', 'Plan001', $fileTitle, $file->getTimestamp(), $file->getSha1() );
		$surfaces = [ $surface ];
		$other = null;
		if ( $extras ) {
			$other = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
				'File:OtherSource-' . wfRandomString() . '.pdf', '20261005100000' );
			$surfaces[] = $this->makePdfSurface( 'other', 'OtherSet', 'File:' . $other->getName(),
				$other->getTimestamp(), $other->getSha1() );
			$surfaces[] = $this->makeSlideSurface( 'non-pdf', 'OtherSlide' );
		}
		$revision = $this->publisher->publish(
			$page->getTitle(), $actor, $page->getLatest(), $this->buildDocument( $surfaces ), 'Isolated PDF capture'
		);
		$content = ( new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ) )->read(
			$page->getTitle(), $revision, $actor, $page->getId() );
		$this->assertEquals( json_decode( $this->buildDocument( $surfaces ) ), json_decode( $content->getText() ) );
		$expected = $surface['source'];
		$stored = json_decode( $content->getText(), true )['surfaces'][0]['source'];
		ksort( $expected );
		ksort( $stored );
		$this->assertSame( $expected, $stored );
		return [ 'actor' => $actor, 'file' => $file, 'page' => $page, 'surface' => $surface,
			'revision' => $revision, 'binding' => 'v1:' . $page->getId() . ':pdf-anchor', 'fileTitle' => $fileTitle,
			'content' => $content, 'other' => $other ];
	}

	private function service( ?\Closure $operation = null, ?PageHistoryAccess $access = null ): PinnedPdfSource {
		$services = $this->getServiceContainer();
		$observe = function ( string $path ) {
			$this->copyPaths[] = $path;
		};
		$operation ??= static fn ( File $file, \Closure $copy ) => $copy();
		return new class( $access ?? new PageHistoryAccess( $services->getRevisionLookup() ), $this->resolver,
			PageOwnedScope::newFromServices( $services, [] ), $operation, $observe ) extends PinnedPdfSource {
			private \Closure $operation;
			private \Closure $observe;

			public function __construct( PageHistoryAccess $access, SourceVersionResolver $sources,
				PageOwnedScope $scope,
				\Closure $operation, \Closure $observe
			) {
				parent::__construct( $access, $sources, $scope );
				$this->operation = $operation;
				$this->observe = $observe;
			}

			protected function copyFile( File $file ): TempFSFile {
				return ( $this->operation )( $file, function () use ( $file ) {
					$copy = parent::copyFile( $file );
					( $this->observe )( $copy->getPath() );
					return $copy;
				} );
			}
		};
	}

	private function capture( array $fixture ): PinnedPdfStream {
		return $this->service()->capture( $fixture['page']->getTitle(), $fixture['revision'],
			$fixture['binding'], $fixture['actor'] );
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

	private function assertCopiesReleased(): void {
		foreach ( $this->copyPaths as $path ) {
			$this->assertFileDoesNotExist( $path );
		}
	}

	private function assertUnavailable( callable $operation ): void {
		$sink = fopen( 'php://temp', 'w+b' );
		$returned = null;
		$exception = null;
		try {
			try {
				$returned = $operation();
				$returned->copyTo( $sink );
			} catch ( \DomainException $caught ) {
				$exception = $caught;
			}
			rewind( $sink );
			$delivered = stream_get_contents( $sink );
			if ( $delivered !== '' ) {
				$name = 'unexpected-' . substr( hash( 'sha256', $this->getName() ), 0, 12 );
				$this->evidence( $name, [ 'test' => $this->getName(), 'refused' => false ],
					[ $name . '.pdf' => $delivered ] );
			}
			$this->assertSame( 0, strlen( $delivered ),
				'Refusal must deliver zero bytes; actual SHA-256 ' . hash( 'sha256', $delivered ) );
			$this->assertNotNull( $exception, 'A deliverable capture must not escape refused admission' );
			$this->assertSame( 'layers-revision-unavailable', $exception->getMessage() );
			$this->assertNull( $exception->getPrevious() );
		} finally {
			if ( $returned ) {
				$returned->close();
			}
			fclose( $sink );
			$this->assertCopiesReleased();
		}
	}

	private function assertRestoredCapture( array $fixture, array $rows ): void {
		$capture = $this->capture( $fixture );
		try {
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->bytes( $capture ) );
		} finally {
			$capture->close();
		}
		$this->assertCopiesReleased();
		$this->assertSame( $rows, $this->rows() );
	}

	private function evidence( string $name, array $observations, array $files = [] ): void {
		$directory = getenv( 'LAYERS_PDF_SOURCE_EVIDENCE_DIR' );
		if ( !is_string( $directory ) || $directory === '' ) {
			return;
		}
		$this->assertDirectoryExists( $directory );
		foreach ( $files as $filename => $bytes ) {
			$this->assertFileDoesNotExist( $directory . '/' . $filename );
			$this->assertSame( strlen( $bytes ), file_put_contents( $directory . '/' . $filename, $bytes ) );
			$observations['files'][$filename] = [ 'bytes' => strlen( $bytes ), 'sha256' => hash( 'sha256', $bytes ),
				'sha1Hex' => sha1( $bytes ) ];
		}
		$destination = $directory . '/' . $name . '.json';
		$this->assertFileDoesNotExist( $destination );
		$json = json_encode( $observations, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR ) . "\n";
		$this->assertSame( strlen( $json ), file_put_contents( $destination, $json ) );
	}

	private function bytes( PinnedPdfStream $capture ): string {
		$sink = fopen( 'php://temp', 'w+b' );
		$this->assertIsResource( $sink );
		try {
			$capture->copyTo( $sink );
			$this->assertSame( $capture->getLength(), fstat( $sink )['size'] );
			rewind( $sink );
			return stream_get_contents( $sink );
		} finally {
			fclose( $sink );
		}
	}

	public function testNativeCurrentAndArchivedCapturesPreserveCompleteOriginalBytes(): void {
		$fixture = $this->fixture();
		$original = file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' );
		$rows = $this->rows();
		$capture = $this->capture( $fixture );
		$before = $rows;
		try {
			$this->assertSame( $rows, $this->rows() );
			$this->assertSame( '{}', json_encode( $capture ) );
			$this->assertSame( 840, $capture->getLength() );
			$this->assertSame( $original, $this->bytes( $capture ) );
			$replacement = $this->uploadFixtureFile(
				__DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$fixture['fileTitle'], '20261005120000', 'Different isolated PDF'
			);
			$this->assertSame( 1, $replacement->pageCount() );
			$this->assertSame( $original, $this->bytes( $capture ) );
			$this->assertSame( sha1( $original ), sha1( $this->bytes( $capture ) ) );
			$this->assertSame( hash( 'sha256', $original ), hash( 'sha256', $this->bytes( $capture ) ) );
			$rows = $this->rows();
			$archived = $this->capture( $fixture );
			try {
				$this->assertSame( $original, $this->bytes( $archived ) );
				$this->assertSame( $rows, $this->rows() );
				$this->evidence( 'current-and-archived', [
					'authorizedSnapshot' => json_decode( $fixture['content']->getText() ),
					'currentTablesBefore' => $before, 'archivedTablesBefore' => $rows,
					'archivedTablesAfter' => $this->rows(), 'currentAndArchivedBytesEqual' => true,
					'deliveredSha256' => hash( 'sha256', $this->bytes( $capture ) ) ],
					[ 'original.pdf' => $this->bytes( $archived ),
						'replacement.pdf' => file_get_contents(
							__DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf' ) ] );
			} finally {
				$archived->close();
			}
		} finally {
			$capture->close();
		}
		$this->assertCopiesReleased();
	}

	public function testInvalidIdentitiesRefuseBeforeCopying(): void {
		$fixture = $this->fixture( true );
		$foreign = $this->getExistingTestPage();
		$owner = $fixture['page']->getTitle();
		$fragment = Title::newFromText( $owner->getPrefixedText() . '#section' );
		$external = $this->createMock( Title::class );
		$external->method( 'getArticleID' )->willReturn( $fixture['page']->getId() );
		$external->method( 'canExist' )->willReturn( true );
		$external->method( 'isExternal' )->willReturn( true );
		$rows = $this->rows();
		foreach ( [
			[ $owner, 0, $fixture['binding'] ], [ $owner, -1, $fixture['binding'] ],
			[ $owner, 2147483648, $fixture['binding'] ], [ $owner, $foreign->getLatest(), $fixture['binding'] ],
			[ $owner, $fixture['revision'], 'v1:' . $foreign->getId() . ':pdf-anchor' ],
			[ $owner, $fixture['revision'], 'v1:' . $owner->getArticleID() . ':missing' ],
			[ $owner, $fixture['revision'], 'v1:' . $owner->getArticleID() . ':non-pdf' ],
			[ $owner, $fixture['revision'], 'v1:0' . $owner->getArticleID() . ':pdf-anchor' ],
			[ $fragment, $fixture['revision'], $fixture['binding'] ],
			[ $external, $fixture['revision'], $fixture['binding'] ],
			[ $foreign->getTitle(), $foreign->getLatest(), 'v1:' . $foreign->getId() . ':pdf-anchor' ]
		] as [ $title, $revision, $binding ] ) {
			$this->assertUnavailable( fn () => $this->service()->capture(
				$title, $revision, $binding, $fixture['actor'] ) );
		}
		$this->assertSame( [], $this->copyPaths );
		$this->assertSame( $rows, $this->rows() );
		$this->assertRestoredCapture( $fixture, $rows );
	}

	public function testUnrelatedUnavailableSourceDoesNotBlockSelectedPdf(): void {
		$fixture = $this->fixture( true );
		$backend = $this->repo->getBackend();
		$path = $fixture['other']->getPath();
		$original = $backend->getFileContents( [ 'src' => $path ] );
		$rows = $this->rows();
		try {
			$this->assertTrue( $backend->delete( [ 'src' => $path ] )->isOK() );
			$this->assertRestoredCapture( $fixture, $rows );
		} finally {
			$this->assertTrue( $backend->quickCreate( [ 'dst' => $path, 'content' => $original ] )->isOK() );
		}
		$this->assertSame( $original, $backend->getFileContents( [ 'src' => $path ] ) );
		$this->assertRestoredCapture( $fixture, $rows );
	}

	public function testStaleCurrentBytesAreRefusedAndRestoredExactly(): void {
		$fixture = $this->fixture();
		$backend = $this->repo->getBackend();
		$path = $fixture['file']->getPath();
		$original = $backend->getFileContents( [ 'src' => $path ] );
		$replacement = file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf' );
		$rows = $this->rows();
		$service = $this->service( function ( File $file, \Closure $copy ) use (
			$backend, $path, $replacement, $fixture
		) {
			$this->assertSame( $fixture['surface']['source']['sha1'], $file->getSha1() );
			$this->assertSame( $fixture['surface']['source']['timestamp'], $file->getTimestamp() );
			$this->assertTrue( $backend->quickCreate( [ 'dst' => $path, 'content' => $replacement ] )->isOK() );
			$this->assertSame( $replacement, $backend->getFileContents( [ 'src' => $path ] ) );
			return $copy();
		} );
		try {
			$this->assertUnavailable( static fn () => $service->capture(
				$fixture['page']->getTitle(), $fixture['revision'], $fixture['binding'], $fixture['actor'] ) );
		} finally {
			$this->assertTrue( $backend->quickCreate( [ 'dst' => $path, 'content' => $original ] )->isOK() );
			$this->assertSame( $original, $backend->getFileContents( [ 'src' => $path ] ) );
			$this->assertRestoredCapture( $fixture, $rows );
			$this->evidence( 'stale-byte-restoration', [ 'originalSha256' => hash( 'sha256', $original ),
				'physicalSha256After' => hash( 'sha256', $backend->getFileContents( [ 'src' => $path ] ) ),
				'tablesBefore' => $rows, 'tablesAfter' => $this->rows(),
				'authorizedCaptureRepeatedInFinally' => true ] );
		}
		$this->evidence( 'stale-byte-refusal', [ 'admittedPin' => $fixture['surface']['source'],
			'originalSha256' => hash( 'sha256', $original ), 'replacementSha256' => hash( 'sha256', $replacement ),
			'capturedCopies' => count( $this->copyPaths ), 'zeroDeliverableBytes' => true,
			'tablesBefore' => $rows, 'tablesAfter' => $this->rows() ] );
	}

	/** @return array */
	public static function provideCaptureRefusals(): array {
		$cases = [];
		foreach ( [ 'owner', 'file', 'revision', 'archive', 'missing-current', 'missing-archive' ] as $kind ) {
			foreach ( [ false, true ] as $during ) {
				$cases[$kind . ( $during ? '-during' : '-before' )] = [ $kind, $during ];
			}
		}
		return $cases;
	}

	/** @dataProvider provideCaptureRefusals */
	public function testRefusalsRestoreExactFlagsBytesAndRead( string $kind, bool $during ): void {
		$fixture = $this->fixture();
		if ( in_array( $kind, [ 'archive', 'missing-archive' ], true ) ) {
			$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$fixture['fileTitle'], '20261005120000' );
		}
		$file = $this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'];
		$backend = $this->repo->getBackend();
		$path = $file->getPath();
		$original = $backend->getFileContents( [ 'src' => $path ] );
		$rows = $this->rows();
		$denied = false;
		$authority = $this->createMock( Authority::class );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static function ( $permission, $title ) use ( &$denied, $kind, $fixture ) {
				$blocked = $kind === 'file' ? NS_FILE : $fixture['page']->getTitle()->getNamespace();
				return !( $denied && $title->getNamespace() === $blocked ) &&
					$fixture['actor']->authorizeRead( $permission, $title );
			} );
		$fixture['actor'] = $authority;
		$this->assertRestoredCapture( $fixture, $rows );
		$copiesBefore = count( $this->copyPaths );
		$flagTable = $kind === 'archive' ? 'oldimage' : 'revision';
		$flagColumn = $kind === 'archive' ? 'oi_deleted' : 'rev_deleted';
		$where = $kind === 'archive' ? [ 'oi_name' => $file->getName(), 'oi_archive_name' => $file->getArchiveName() ] :
			[ 'rev_id' => $fixture['revision'] ];
		$flag = $this->getDb()->newSelectQueryBuilder()->select( $flagColumn )->from( $flagTable )
			->where( $where )->caller( __METHOD__ )->fetchField();
		$mutate = function () use ( $kind, &$denied, $backend, $path, $flagTable, $flagColumn, $where ) {
			if ( $kind === 'owner' || $kind === 'file' ) {
				$denied = true;
			} elseif ( $kind === 'revision' || $kind === 'archive' ) {
				$bits = $kind === 'archive' ? File::DELETED_FILE | File::DELETED_RESTRICTED :
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED;
				$this->getDb()->newUpdateQueryBuilder()->update( $flagTable )->set( [ $flagColumn => $bits ] )
					->where( $where )->caller( __CLASS__ )->execute();
			} else {
				$this->assertTrue( $backend->delete( [ 'src' => $path ] )->isOK() );
			}
		};
		$service = $this->service( static function ( File $file, \Closure $copy ) use ( $mutate, $during ) {
			$captured = $copy();
			if ( $during ) {
				$mutate();
			}
			return $captured;
		} );
		try {
			if ( !$during ) {
				$mutate();
			}
			$this->assertUnavailable( static fn () => $service->capture(
				$fixture['page']->getTitle(), $fixture['revision'], $fixture['binding'], $authority ) );
			$this->assertCount( $copiesBefore + ( $during ? 1 : 0 ), $this->copyPaths );
		} finally {
			$denied = false;
			$this->getDb()->newUpdateQueryBuilder()->update( $flagTable )->set( [ $flagColumn => $flag ] )
				->where( $where )->caller( __METHOD__ )->execute();
			if ( str_starts_with( $kind, 'missing-' ) ) {
				$this->assertTrue( $backend->quickCreate( [ 'dst' => $path, 'content' => $original ] )->isOK() );
			}
			$this->assertSame( $flag, $this->getDb()->newSelectQueryBuilder()->select( $flagColumn )->from( $flagTable )
				->where( $where )->caller( __METHOD__ )->fetchField() );
			$this->assertSame( $original, $backend->getFileContents( [ 'src' => $path ] ) );
			$this->assertRestoredCapture( $fixture, $rows );
			$this->evidence( $kind . ( $during ? '-during' : '-before' ) . '-restoration', [
				'physicalSha256Before' => hash( 'sha256', $original ),
				'physicalSha256After' => hash( 'sha256', $backend->getFileContents( [ 'src' => $path ] ) ),
				'flagBefore' => $flag, 'flagAfter' => $flag, 'tablesBefore' => $rows, 'tablesAfter' => $this->rows(),
				'identicalAuthorizedCaptureRepeatedInFinally' => true
			] );
		}
		$this->evidence( $kind . ( $during ? '-during' : '-before' ), [
			'admittedSnapshot' => json_decode( $fixture['content']->getText() ), 'zeroDeliverableBytes' => true,
			'copyPreparedDuringRefusal' => $during, 'flagBefore' => $flag, 'flagAfter' => $flag,
			'physicalSha256Before' => hash( 'sha256', $original ),
			'physicalSha256After' => hash( 'sha256', $backend->getFileContents( [ 'src' => $path ] ) ),
			'tablesBefore' => $rows, 'tablesAfter' => $this->rows(), 'identicalAuthorizedCaptureRepeated' => true
		] );
	}

	public function testReuploadDuringCaptureStillAdmitsExactArchivedPin(): void {
		$fixture = $this->fixture();
		$service = $this->service( function ( File $file, \Closure $copy ) use ( $fixture ) {
			$captured = $copy();
			$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$fixture['fileTitle'], '20261005120000' );
			return $captured;
		} );
		$capture = $service->capture( $fixture['page']->getTitle(), $fixture['revision'],
			$fixture['binding'], $fixture['actor'] );
		try {
			$this->assertInstanceOf( OldLocalFile::class,
				$this->resolver->resolve( $fixture['content'], $fixture['actor'] )['pdf-anchor'] );
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$this->bytes( $capture ) );
		} finally {
			$capture->close();
		}
		$this->assertCopiesReleased();
	}

	public function testRealAnonymousPermissionAndConfigRestoration(): void {
		$fixture = $this->fixture();
		$rows = $this->rows();
		$permissions = $this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' );
		try {
			$this->setGroupPermissions( '*', 'read', true );
			$anonymous = $this->getServiceContainer()->getUserFactory()->newAnonymous();
			$this->assertFalse( $anonymous->isAllowed( 'editlayers' ) );
			$fixture['actor'] = $anonymous;
			$this->assertRestoredCapture( $fixture, $rows );
			$this->setGroupPermissions( '*', 'read', false );
			$denied = $this->getServiceContainer()->getUserFactory()->newAnonymous();
			$this->assertUnavailable( fn () => $this->service()->capture( $fixture['page']->getTitle(),
				$fixture['revision'], $fixture['binding'], $denied ) );
			$this->setGroupPermissions( '*', 'read', true );
			$this->assertRestoredCapture( $fixture, $rows );
		} finally {
			$this->overrideConfigValue( 'GroupPermissions', $permissions );
		}
		$this->assertSame( $permissions, $this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' ) );
		$this->assertSame( $rows, $this->rows() );
		$this->evidence( 'anonymous-read', [ 'realAnonymousAllowedThenDenied' => true,
			'fullPermissionConfigurationRestored' => true, 'tablesBefore' => $rows, 'tablesAfter' => $this->rows() ] );
	}

	/** @return array */
	public static function provideBrokenCopies(): array {
		return [ 'empty' => [ 'empty' ], 'open failure' => [ 'open' ], 'copy failure' => [ 'copy' ] ];
	}

	/** @dataProvider provideBrokenCopies */
	public function testFailedEmptyOrUnreadableCopyReleasesResources( string $kind ): void {
		$fixture = $this->fixture();
		$backend = $this->repo->getBackend();
		$path = $fixture['file']->getPath();
		$original = $backend->getFileContents( [ 'src' => $path ] );
		$rows = $this->rows();
		$service = $this->service( function ( File $file, \Closure $copy ) use ( $kind, $backend, $path ) {
			if ( $kind === 'copy' ) {
				$this->assertTrue( $backend->delete( [ 'src' => $path ] )->isOK() );
			}
			$captured = $copy();
			if ( $kind === 'open' ) {
				$captured->purge();
			} else {
				$this->assertSame( 0, file_put_contents( $captured->getPath(), '' ) );
			}
			return $captured;
		} );
		try {
			$this->assertUnavailable( static fn () => $service->capture(
				$fixture['page']->getTitle(), $fixture['revision'], $fixture['binding'], $fixture['actor'] ) );
		} finally {
			if ( $kind === 'copy' ) {
				$this->assertTrue( $backend->quickCreate( [ 'dst' => $path, 'content' => $original ] )->isOK() );
			}
		}
		$this->assertSame( $original, $backend->getFileContents( [ 'src' => $path ] ) );
		$this->assertRestoredCapture( $fixture, $rows );
	}

	public function testAbandonedCapturePurgesNativeCopy(): void {
		$fixture = $this->fixture();
		$rows = $this->rows();
		$capture = $this->capture( $fixture );
		$this->assertCount( 1, $this->copyPaths );
		$this->assertFileExists( $this->copyPaths[0] );
		unset( $capture );
		$this->assertCopiesReleased();
		$this->assertSame( $rows, $this->rows() );
	}

	public function testChangedPostCapturePinIsRefusedWithoutChangingStoredPayload(): void {
		$fixture = $this->fixture( true );
		$rows = $this->rows();
		$history = new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() );
		$access = $this->createMock( PageHistoryAccess::class );
		$reads = 0;
		$access->expects( $this->exactly( 2 ) )->method( 'read' )->willReturnCallback(
			static function ( Title $owner, int $revision, Authority $authority, ?int $pageId ) use (
				$history, &$reads, $fixture
			) {
				$content = $history->read( $owner, $revision, $authority, $pageId );
				if ( ++$reads === 1 ) {
					return $content;
				}
				$document = json_decode( $content->getText(), true );
				$document['surfaces'][0]['source']['fileTitle'] = 'File:' . $fixture['other']->getName();
				return new LayersDocumentContent( json_encode( $document ) );
			} );
		$this->assertUnavailable( fn () => $this->service( null, $access )->capture( $fixture['page']->getTitle(),
			$fixture['revision'], $fixture['binding'], $fixture['actor'] ) );
		$this->assertSame( $fixture['content']->getText(), $history->read( $fixture['page']->getTitle(),
			$fixture['revision'], $fixture['actor'] )->getText() );
		$this->assertRestoredCapture( $fixture, $rows );
	}
}
