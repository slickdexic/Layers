<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class PageOwnedPdfEditorBootstrapQualificationTest extends RealAssetTestCase {
	private function qualificationFixture( bool $storedFirst = false ): array {
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$this->setService( 'RepoGroup', $repos );
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Qualified-bootstrap-' . wfRandomString( 8 ) . '.pdf' );
		$otherFile = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Other-bootstrap-' . wfRandomString( 8 ) . '.pdf' );
		$anchor = $this->makePdfSurface( 'anchor', 'ABC', $file->getTitle()->getPrefixedDBkey(),
			$file->getTimestamp(), $file->getSha1(), 2 );
		$anchor['canvas']['width'] = 333;
		$anchor['canvas']['height'] = 111;
		$anchor['layers'] = [ [ 'id' => 'native-note', 'type' => 'text', 'text' => 'Stored coordinates',
			'x' => -17, 'y' => 29, 'rotation' => 21 ] ];
		$anchor['readingOrder'] = [ 'native-note' ];
		$first = $anchor;
		$first['id'] = 'first';
		$first['source']['page'] = 1;
		$first['canvas']['width'] = 208;
		$first['canvas']['height'] = 416;
		$other = $this->makePdfSurface( 'other-file', 'ABC', $otherFile->getTitle()->getPrefixedDBkey(),
			$otherFile->getTimestamp(), $otherFile->getSha1(), 2 );
		$otherName = $anchor;
		$otherName['id'] = 'other-name';
		$otherName['label'] = 'XYZ';
		$slide = $this->makeSlideSurface( 'slide', 'ABC' );
		$surfaces = array_merge( [ $anchor ], $storedFirst ? [ $first ] : [], [ $other, $otherName, $slide ] );
		$owner = $this->getExistingTestPage()->getTitle();
		$actor = $this->actor();
		$revision = $this->publisher->publish( $owner, $actor, $owner->getLatestRevID(),
			$this->buildDocument( $surfaces ), 'Disposable qualified PDF bootstrap fixture' );
		return [ $owner, $revision, $actor, $file, $surfaces ];
	}

	private function qualificationWitness( Title $owner ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $owner,
			0, \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST );
		$value = [ 'revision' => $revision->getId(),
			'main' => $revision->getContent( 'main', RevisionRecord::RAW )->serialize(),
			'layers' => $revision->getContent( 'layers', RevisionRecord::RAW )->serialize() ];
		$loaded = [];
		foreach ( [ PageOwnedPilot::class, 'MediaWiki\\Extension\\Layers\\Revision\\PagePdfEditorReadService',
			'MediaWiki\\Extension\\Layers\\Revision\\SourceRenditions',
			'MediaWiki\\Extension\\PdfHandler\\PdfHandler' ] as $class ) {
			if ( class_exists( $class, false ) ) {
				$file = ( new \ReflectionClass( $class ) )->getFileName();
				$loaded[$class] = [ 'file' => $file, 'sha256' => hash_file( 'sha256', $file ) ];
			}
		}
		if ( getenv( 'LAYERS_BOOTSTRAP_WITNESSES' ) ) {
			file_put_contents( getenv( 'LAYERS_BOOTSTRAP_WITNESSES' ), json_encode( [
				'test' => $this->getName(), 'journey' => 'read-only', 'witness' => $value, 'loaded' => $loaded
			] ) . "\n", FILE_APPEND | LOCK_EX );
		}
		return $value;
	}

	/** @dataProvider provideStoredPages */
	public function testCanonicalFileIsolationSparseAndStoredPages( bool $storedFirst ): void {
		[ $owner, $revision, $actor, $file, $surfaces ] = $this->qualificationFixture( $storedFirst );
		$this->assertInstanceOf( \MediaWiki\Extension\PdfHandler\PdfHandler::class, $file->getHandler() );
		$before = $this->qualificationWitness( $owner );
		$pilot = new PageOwnedPilot( $this->getServiceContainer() );
		$init = $pilot->prepareEditor( $owner->getPrefixedDBkey(), $revision, 'anchor', $actor );
		$context = $init['pageOwned']['pdfContext'];
		$this->assertSame( [ 2, 2, 333, 111 ],
			[ $init['page'], $init['pageCount'], $init['baseWidth'], $init['baseHeight'] ] );
		$this->assertSame( $revision, $context['revisionId'] );
		$this->assertEquals( $surfaces[0], $context['surface'] );
		$this->assertSame( $context['rendition']['url'], $init['imageUrl'] );
		$this->assertStringContainsString( 'page2-333px-', $init['imageUrl'] );
		$this->assertSame( 333, $context['rendition']['width'] );
		$bitmap = $file->transform( [ 'width' => 333, 'page' => 2 ],
			\MediaWiki\FileRepo\File\File::RENDER_NOW );
		$this->assertInstanceOf( \MediaTransformOutput::class, $bitmap );
		$reference = $bitmap->getLocalCopyPath();
		$this->assertIsString( $reference );
		$pixels = getimagesize( $reference );
		$this->assertIsArray( $pixels );
		$this->assertSame( $pixels[1], $context['rendition']['height'] );
		$this->assertSame( [ 'page' => 2, 'width' => $file->getWidth( 2 ), 'height' => $file->getHeight( 2 ),
			'units' => 'file-handler-pixels' ], $context['sourceGeometry'] );
		$this->assertSame( $storedFirst ? [ [ 'page' => 1, 'surfaceId' => 'first' ],
			[ 'page' => 2, 'surfaceId' => 'anchor' ] ] : [ [ 'page' => 2, 'surfaceId' => 'anchor' ] ],
			$context['members'] );
		$other = $pilot->prepareEditor( $owner->getPrefixedDBkey(), $revision, 'other-file', $actor );
		$this->assertSame( [ [ 'page' => 2, 'surfaceId' => 'other-file' ] ],
			$other['pageOwned']['pdfContext']['members'] );
		$this->assertNotSame( $context['surface']['source']['fileTitle'],
			$other['pageOwned']['pdfContext']['surface']['source']['fileTitle'] );
		$slide = $pilot->prepareEditor( $owner->getPrefixedDBkey(), $revision, 'slide', $actor );
		$this->assertTrue( $slide['isSlide'] );
		$this->assertArrayNotHasKey( 'pdfContext', $slide['pageOwned'] );
		$this->assertSame( $before, $this->qualificationWitness( $owner ) );
	}

	public static function provideStoredPages(): array {
		return [ 'sparse' => [ false ], 'two stored' => [ true ] ];
	}

	/** @dataProvider provideLegacyGroup */
	public function testIneligibleNormalizedGroupsKeepIndividualEditPath( string $mode ): void {
		[ $owner, $revision, $actor, $file, $surfaces ] = $this->qualificationFixture();
		$before = $this->qualificationWitness( $owner );
		$other = $surfaces[0];
		$other['id'] = 'legacy';
		if ( $mode !== 'duplicate-page' ) {
			$other['source']['page'] = 1;
		}
		if ( $mode === 'mixed-pin' ) {
			$other['source']['timestamp'] = '20260906130000';
		} elseif ( $mode === 'mixed-label' ) {
			$other['label'] = 'abc';
		}
		$surfaces[] = $other;
		$content = new \MediaWiki\Extension\Layers\Content\LayersDocumentContent( $this->buildDocument( $surfaces ) );
		$this->assertTrue( $content->isReadable() );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$original = $lookup->getRevisionById( $revision );
		$record = $this->createMock( RevisionRecord::class );
		$record->method( 'getId' )->willReturn( $revision );
		$record->method( 'getPageId' )->willReturn( $owner->getArticleID() );
		$record->method( 'getPage' )->willReturn( $owner );
		$record->method( 'getVisibility' )->willReturn( 0 );
		$record->method( 'hasSlot' )->willReturn( true );
		$record->method( 'getContent' )->willReturnCallback( static function ( $slot ) use ( $content, $original ) {
			return $slot === 'layers' ? $content : $original->getContent( $slot );
		} );
		$revisions = $this->createMock( \MediaWiki\Revision\RevisionLookup::class );
		$revisions->method( 'getRevisionById' )->willReturnCallback( static function ( $id ) use (
			$revision, $record, $lookup
		) {
			return $id === $revision ? $record : $lookup->getRevisionById( $id );
		} );
		$revisions->method( 'getRevisionByTitle' )->willReturnCallback( static function ( ...$args ) use ( $lookup ) {
			return $lookup->getRevisionByTitle( ...$args );
		} );
		$this->setService( 'RevisionLookup', $revisions );
		$init = ( new PageOwnedPilot( $this->getServiceContainer() ) )->prepareEditor(
			$owner->getPrefixedDBkey(), $revision, 'anchor', $actor );
		$this->assertArrayNotHasKey( 'pdfContext', $init['pageOwned'] );
		$this->assertSame( [ 333, 111 ], [ $init['baseWidth'], $init['baseHeight'] ] );
		$this->assertStringContainsString( 'page2-333px-', $init['imageUrl'] );
		$this->assertFalse( $init['pageOwned']['readOnly'] );
		$this->assertSame( $before, $this->qualificationWitness( $owner ) );
	}

	public static function provideLegacyGroup(): array {
		return [ [ 'duplicate-page' ], [ 'mixed-pin' ], [ 'mixed-label' ] ];
	}

	/** @dataProvider provideBootstrapRefusal */
	public function testEligibleRefusalsStayGenericWithoutWrites( string $reason ): void {
		[ $owner, $revision, $actor, $file, $surfaces ] = $this->qualificationFixture();
		if ( $reason === 'current-base' ) {
			$surfaces[0]['layers'][0]['text'] = 'New isolated base';
			$this->publisher->publish( $owner, $actor, $revision,
				$this->buildDocument( $surfaces ), 'Isolated newer base' );
		} elseif ( $reason === 'source' ) {
			$this->getDb()->newDeleteQueryBuilder()->deleteFrom( 'image' )->where( [ 'img_name' => $file->getName() ] )
				->caller( __METHOD__ )->execute();
			$file->purgeCache();
		} elseif ( $reason === 'permission' ) {
			$actor = $this->actor( [ 'read' ] );
		}
		$before = $this->qualificationWitness( $owner );
		$pilot = new PageOwnedPilot( $this->getServiceContainer() );
		if ( $reason === 'bounds' || $reason === 'count' ) {
			$pilot = new class( $this->getServiceContainer() ) extends PageOwnedPilot {
				public string $boundary;

				public function preparePdfEditorPage( Title $owner, int $revisionId, string $binding,
					int $targetPage, Authority $authority
				): array {
					if ( $this->boundary === 'count' ) {
						parent::preparePdfEditorPage( $owner, $revisionId, $binding, $targetPage, $authority );
						throw new \DomainException( 'Controlled unavailable page count after native preparation' );
					}
					return parent::preparePdfEditorPage( $owner, $revisionId, $binding, 3, $authority );
				}
			};
			$pilot->boundary = $reason;
		}
		try {
			$pilot->prepareEditor( $owner->getPrefixedDBkey(), $revision, 'anchor', $actor );
			$this->fail( 'Eligible refused PDF returned an individual bootstrap' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-editor-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->qualificationWitness( $owner ) );
	}

	public static function provideBootstrapRefusal(): array {
		return [ [ 'permission' ], [ 'current-base' ], [ 'source' ], [ 'bounds' ], [ 'count' ] ];
	}
}
