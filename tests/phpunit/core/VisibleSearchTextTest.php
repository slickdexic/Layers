<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Extension\Layers\Search\VisibleLegacySearchProjection;
use MediaWiki\Extension\Layers\Search\VisiblePageSearchProjection;
use MediaWiki\Extension\Layers\Search\VisibleSearchText;
use MediaWiki\Revision\RevisionRecord;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * @covers \MediaWiki\Extension\Layers\Search\VisibleSearchText
 * @group Database
 */
class VisibleSearchTextTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	/** @return string[] */
	private function searchTitles( string $term ): array {
		$engine = $this->getServiceContainer()->getSearchEngineFactory()->create();
		$engine->setNamespaces( [ NS_MAIN ] );
		$titles = [];
		foreach ( $engine->searchText( $term ) ?: [] as $result ) {
			$titles[] = $result->getTitle()->getPrefixedDBkey();
		}
		return $titles;
	}

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	public function testMixedSourcesStayIndependentAndRespectRevisionIdentity(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$ownedFile = $this->upload( 'Owned-search-' . wfRandomString( 8 ) . '.png' );
		$legacyFile = $this->upload( 'Shared-search-' . wfRandomString( 8 ) . '.png' );
		$slideName = 'SearchSlide' . wfRandomString( 8 );
		$this->saveSet( $legacyFile, 'ABC', 1, 'legacy marker' );
		$this->saveSlide( $slideName, 'ABC', 'shared slide marker' );
		$doc = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$doc['surfaces'][0]['kind'] = 'image';
		$doc['surfaces'][0]['source'] = [ 'repository' => 'local',
			'fileTitle' => $ownedFile->getTitle()->getPrefixedDBkey(), 'timestamp' => $ownedFile->getTimestamp(),
			'sha1' => $ownedFile->getSha1(), 'page' => 1 ];
		$doc['surfaces'][0]['layers'][0]['text'] = 'owned marker';
		$content = new LayersDocumentContent( json_encode( $doc ) );
		$this->assertTrue( $content->isReadable() );
		$page = $this->getExistingTestPage();
		$revision = $this->createMock( RevisionRecord::class );
		$revision->method( 'getPageId' )->willReturn( $page->getId() );
		$revision->method( 'hasSlot' )->willReturn( true );
		$revision->method( 'isDeleted' )->willReturn( false );
		$revision->method( 'getContent' )->willReturnCallback( static fn ( $role ) => $role === 'main' ?
			new WikitextContent( 'ordinarysearchword' ) : $content );
		$services = $this->getServiceContainer();
		$repo = $services->getRepoGroup()->getLocalRepo();
		$projection = new VisibleSearchText( $this->pilot->getScope(),
			new VisiblePageSearchProjection( new SourceVersionResolver( $repo, $services->getTitleFactory() ) ),
			new VisibleLegacySearchProjection( $services->getService( 'LayersDatabase' ),
				new LegacySearchSourceAdmission( $repo ), $services->getTitleFactory() ) );
		$shown = [ [ ShownLayerSets::FILE, $legacyFile->getName(), 'ABC' ],
			[ ShownLayerSets::FILE, $legacyFile->getName(), 'ABC', 2 ],
			[ ShownLayerSets::SLIDE, $slideName, 'ABC' ] ];
		$result = $projection->get( $page, $revision, $this->actor, $shown, true );
		$this->assertStringContainsString( 'owned marker', $result );
		$this->assertSame( 1, substr_count( $result, 'legacy marker' ) );
		$this->assertStringContainsString( 'shared slide marker', $result );
		$search = $services->getService( 'LayersDrawingSearchText' );
		$key = $page->getTitle()->getPrefixedDBkey();
		$search->index( $page->getId(), $page, $revision, $result );
		$this->assertContains( $key, $this->searchTitles( 'owned' ) );
		$this->assertContains( $key, $this->searchTitles( 'legacy' ) );
		$this->assertStatusGood( $ownedFile->deleteFile( 'Synthetic fixture', $this->actor, true ) );
		$result = $projection->get( $page, $revision, $this->actor, $shown, true );
		$this->assertStringNotContainsString( 'owned marker', $result );
		$this->assertStringContainsString( 'legacy marker', $result );
		$this->assertStringContainsString( 'shared slide marker', $result );
		$search->index( $page->getId(), $page, $revision, $result );
		$this->assertNotContains( $key, $this->searchTitles( 'owned' ) );
		$this->assertContains( $key, $this->searchTitles( 'legacy' ) );
		$this->assertContains( $key, $this->searchTitles( 'ordinarysearchword' ) );
		$this->assertStatusGood( $legacyFile->deleteFile( 'Synthetic fixture', $this->actor, true ) );
		$result = $projection->get( $page, $revision, $this->actor, $shown, true );
		$this->assertStringNotContainsString( 'owned marker', $result );
		$this->assertStringNotContainsString( 'legacy marker', $result );
		$this->assertStringContainsString( 'shared slide marker', $result );
		$search->index( $page->getId(), $page, $revision, $result );
		$this->assertNotContains( $key, $this->searchTitles( 'legacy' ) );
		$this->assertContains( $key, $this->searchTitles( 'shared' ) );
		$this->assertStatusGood( $legacyFile->restore( [], true ) );
		$result = $projection->get( $page, $revision, $this->actor, $shown, true );
		$this->assertStringContainsString( 'legacy marker', $result );
		$search->index( $page->getId(), $page, $revision, $result );
		$this->assertContains( $key, $this->searchTitles( 'legacy' ) );
		$this->assertNotContains( $key, $this->searchTitles( 'owned' ) );
		$foreign = $this->createMock( RevisionRecord::class );
		$foreign->method( 'getPageId' )->willReturn( $page->getId() + 1 );
		$this->assertSame( '', $projection->get( $page, $foreign, $this->actor, $shown, true ) );
		$hidden = $this->createMock( RevisionRecord::class );
		$hidden->method( 'getPageId' )->willReturn( $page->getId() );
		$hidden->method( 'isDeleted' )->willReturn( true );
		$this->assertSame( '', $projection->get( $page, $hidden, $this->actor, $shown, true ) );
		$unreadable = $this->createMock( RevisionRecord::class );
		$unreadable->method( 'getPageId' )->willReturn( $page->getId() );
		$unreadable->method( 'isDeleted' )->willReturn( false );
		$unreadable->method( 'hasSlot' )->willReturn( true );
		$unreadable->method( 'getContent' )->willReturn( new LayersDocumentContent( 'invalid json' ) );
		$this->assertSame( '', $projection->get( $page, $unreadable, $this->actor, $shown, true ) );
	}
}
