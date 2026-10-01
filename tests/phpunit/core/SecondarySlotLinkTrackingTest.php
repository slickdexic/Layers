<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\ExternalLinks\LinkFilter;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\Title;
use SpecialPageTestBase;

/**
 * Proves that tracking metadata registered by a secondary slot reaches core LinksUpdate.
 * @coversNothing
 * @group Database
 */
class SecondarySlotLinkTrackingTest extends SpecialPageTestBase {
	private string $specialPageName = 'Whatlinkshere';

	protected function setUp(): void {
		parent::setUp();
		$services = $this->getServiceContainer();
		$services->getContentHandlerFactory()->defineContentHandler(
			LayersDocumentContent::MODEL,
			SecondarySlotLinkProofContentHandler::class
		);
		$roles = $services->getSlotRoleRegistry();
		if ( !$roles->isDefinedRole( 'layers' ) ) {
			$roles->defineRoleWithModel( 'layers', LayersDocumentContent::MODEL, [ 'display' => 'none' ], false );
		}
	}

	/** @inheritDoc */
	protected function newSpecialPage() {
		return $this->getServiceContainer()->getSpecialPageFactory()->getPage( $this->specialPageName );
	}

	public function testSecondarySlotLinksReachCoreTablesAndSpecialPages(): void {
		$services = $this->getServiceContainer();
		$sourceTitle = $this->getNonexistingTestPage()->getTitle();
		$sourcePage = $services->getWikiPageFactory()->newFromTitle( $sourceTitle );
		$existingTarget = Title::newFromText( 'SecondarySlotExistingTarget' );
		$this->editPage( $existingTarget, 'Target page for secondary-slot link proof' );
		$missingTarget = Title::newFromText( 'SecondarySlotMissingTarget' );
		$fileTarget = Title::newFromText( 'File:Example.png' );
		$this->assertNotNull( $existingTarget );
		$this->assertNotNull( $missingTarget );
		$this->assertNotNull( $fileTarget );
		$this->assertTrue( $existingTarget->exists() );
		$this->assertFalse( $missingTarget->exists() );

		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json'
		), true );
		$targets = [
			$existingTarget->getPrefixedText(),
			$missingTarget->getPrefixedText(),
			$fileTarget->getPrefixedText(),
			'#Section',
			'https://example.org/a'
		];
		foreach ( $targets as $index => $link ) {
			$document['surfaces'][0]['layers'][] = [
				'id' => 'secondary-link-' . $index,
				'type' => 'rectangle',
				'x' => 10 + $index * 20,
				'y' => 100,
				'width' => 12,
				'height' => 12,
				'fill' => '#112233',
				'link' => $link
			];
		}

		$editor = $this->getTestSysop()->getUser();
		$updater = $sourcePage->newPageUpdater( $editor );
		$updater->setContent( SlotRecord::MAIN, new WikitextContent( 'Secondary slot link tracking proof.' ) );
		$updater->setContent( 'layers', new LayersDocumentContent( json_encode( $document ) ) );
		$revision = $updater->saveRevision(
			CommentStoreComment::newUnsavedComment( 'Test secondary slot link tracking' )
		);
		$this->assertNotNull( $revision );
		$this->runJobs();
		$this->runDeferredUpdates();

		$db = $services->getConnectionProvider()->getReplicaDatabase();
		$pageLinks = $db->newSelectQueryBuilder()
			->select( [ 'lt_namespace', 'lt_title' ] )
			->from( 'pagelinks' )
			->join( 'linktarget', null, 'pl_target_id = lt_id' )
			->where( [ 'pl_from' => $sourcePage->getId() ] )
			->caller( __METHOD__ )
			->fetchResultSet();
		$actualPageLinks = [];
		foreach ( $pageLinks as $row ) {
			$actualPageLinks[] = [ (int)$row->lt_namespace, $row->lt_title ];
		}
		$this->assertContains( [ $existingTarget->getNamespace(), $existingTarget->getDBkey() ], $actualPageLinks );
		$this->assertContains( [ $missingTarget->getNamespace(), $missingTarget->getDBkey() ], $actualPageLinks );
		$this->assertContains( [ $fileTarget->getNamespace(), $fileTarget->getDBkey() ], $actualPageLinks );
		$this->assertNotContains( [ NS_MAIN, '' ], $actualPageLinks,
			'A bare section must not create a pagelinks row.' );

		$externalRows = $db->newSelectQueryBuilder()
			->select( [ 'el_to_domain_index', 'el_to_path' ] )
			->from( 'externallinks' )
			->where( [ 'el_from' => $sourcePage->getId() ] )
			->caller( __METHOD__ )
			->fetchResultSet();
		$externalTargets = [];
		foreach ( $externalRows as $row ) {
			$externalTargets[] = LinkFilter::reverseIndexes( $row->el_to_domain_index ) . ( $row->el_to_path ?? '' );
		}
		$this->assertContains( 'https://example.org/a', $externalTargets );

		$this->specialPageName = 'Whatlinkshere';
		[ $whatLinksHere ] = $this->executeSpecialPage( $existingTarget->getPrefixedText() );
		$this->assertStringContainsString( $sourceTitle->getPrefixedText(), $whatLinksHere );

		$this->specialPageName = 'LinkSearch';
		[ $linkSearch ] = $this->executeSpecialPage( '', new FauxRequest( [ 'target' => '*.example.org' ] ) );
		$this->assertStringContainsString( $sourceTitle->getPrefixedText(), $linkSearch );
	}
}
