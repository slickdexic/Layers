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
class PageOwnedPdfEditorBootstrapTest extends RealAssetTestCase {
	private function fixture(): array {
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$this->setService( 'RepoGroup', $repos );
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Bootstrap-' . wfRandomString( 8 ) . '.pdf' );
		$surface = $this->makePdfSurface( 'anchor', 'ABC', $file->getTitle()->getPrefixedDBkey(),
			$file->getTimestamp(), $file->getSha1(), 2 );
		$surface['canvas']['width'] = 333;
		$surface['canvas']['height'] = 111;
		$owner = $this->getExistingTestPage()->getTitle();
		$actor = $this->actor();
		$revision = $this->publisher->publish( $owner, $actor, $owner->getLatestRevID(),
			$this->buildDocument( [ $surface ] ), 'Disposable PDF bootstrap fixture' );
		$surface = json_decode( $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision )
			->getContent( 'layers' )->serialize(), true )['surfaces'][0];
		return [ $owner, $revision, $actor, $surface ];
	}

	private function witness( Title $owner ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $owner );
		$value = [ 'revision' => $revision->getId(),
			'main' => $revision->getContent( 'main', RevisionRecord::RAW )->serialize(),
			'layers' => $revision->getContent( 'layers', RevisionRecord::RAW )->serialize() ];
		if ( getenv( 'LAYERS_BOOTSTRAP_WITNESSES' ) ) {
			file_put_contents( getenv( 'LAYERS_BOOTSTRAP_WITNESSES' ), json_encode( [
				'test' => $this->getName(), 'witness' => $value,
				'pilotSha256' => hash_file( 'sha256', ( new \ReflectionClass( PageOwnedPilot::class ) )->getFileName() )
			] ) . "\n", FILE_APPEND | LOCK_EX );
		}
		return $value;
	}

	public function testStoredPageTwoUsesNativeContextWithoutScalingOrWriting(): void {
		[ $owner, $revision, $actor, $surface ] = $this->fixture();
		$before = $this->witness( $owner );
		$pilot = new PageOwnedPilot( $this->getServiceContainer() );
		$init = $pilot->prepareEditor( $owner->getPrefixedDBkey(), $revision, 'anchor', $actor );
		$this->assertSame( 2, $init['page'] );
		$this->assertSame( 2, $init['pageCount'] );
		$this->assertSame( 333, $init['baseWidth'] );
		$this->assertSame( 111, $init['baseHeight'] );
		$this->assertFalse( $init['pageOwned']['readOnly'] );
		$this->assertSame( $surface, $init['pageOwned']['pdfContext']['surface'] );
		$this->assertSame( $init['pageOwned']['pdfContext']['rendition']['url'], $init['imageUrl'] );
		$this->assertSame( 'ABC', $init['pageOwned']['pdfContext']['label'] );
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	public function testEligiblePreparationRefusalNeverFallsBackToIndividualEdit(): void {
		[ $owner, $revision, $actor ] = $this->fixture();
		$before = $this->witness( $owner );
		$pilot = new class( $this->getServiceContainer() ) extends PageOwnedPilot {
			public function preparePdfEditorPage( Title $owner, int $revisionId, string $binding,
				int $targetPage, Authority $authority
			): array {
				throw new \DomainException( 'private source unavailable' );
			}
		};
		try {
			$pilot->prepareEditor( $owner->getPrefixedDBkey(), $revision, 'anchor', $actor );
			$this->fail( 'Eligible PDF fell back to individual editing' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-editor-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->witness( $owner ) );
	}
}
