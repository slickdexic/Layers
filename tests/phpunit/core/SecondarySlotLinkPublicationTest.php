<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Deferred\LinksUpdate\LinksUpdate;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext;
use MediaWiki\HookContainer\HookRunner;
use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutputLinkTypes;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Exercises production Layers link metadata through layerspublish and core's current-page link lifecycle.
 * @coversNothing
 * @group Database
 * @group API
 */
class SecondarySlotLinkPublicationTest extends \MediaWiki\Tests\Api\ApiTestCase {
	private array $ownerKeys = [];
	private ?PublicationAdmissionContext $context = null;

	protected function setUp(): void {
		parent::setUp();
		$this->context = new PublicationAdmissionContext();
		$initialServices = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace(
			$initialServices->getMainConfig()->get( 'APIModules' ), [
				'layerspublish' => [
					'class' => ApiLayersPublish::class,
					'factory' => function ( ApiMain $main, string $name ) {
						$services = $this->getServiceContainer();
						$registered = TestingAdmissionRegistration::install( $this, $this->context );
						return new ApiLayersPublish( $main, $name, $registered['publisher'],
							$services->getTitleFactory(),
							PageOwnedScope::newFromServices( $services, $this->ownerKeys ) );
					}
				]
			]
		) );
		// The APIModules override rebuilds the test service container. Confirm the
		// normal extension content handler remains registered after that rebuild.
		$services = $this->getServiceContainer();
		foreach ( [ $services, MediaWikiServices::getInstance() ] as $container ) {
			$roles = $container->getSlotRoleRegistry();
			if ( !$roles->isDefinedRole( 'layers' ) ) {
				$roles->defineRoleWithModel( 'layers', LayersDocumentContent::MODEL, [ 'display' => 'none' ], false );
			}
		}
		$handler = MediaWikiServices::getInstance()->getContentHandlerFactory()
			->getContentHandler( LayersDocumentContent::MODEL );
		$this->assertInstanceOf( LayersDocumentContentHandler::class, $handler );
	}

	/** @inheritDoc */
	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, true, $session );
	}

	private function actor(): User {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
		return $user;
	}

	/**
	 * @dataProvider provideSlotDisplayModes
	 */
	public function testLayersPublishUpdatesRemovesAndKeepsCurrentOnlyLinks( string $display ): void {
		$this->setLayersSlotDisplayForTest( $display );
		$owner = $this->getNonexistingTestPage()->getTitle();
		$this->ownerKeys = [ $owner->getPrefixedDBkey() ];
		$this->editPage( $owner, 'Page with a secondary Layers slot.' );
		$pageId = $owner->getArticleID( IDBAccessObject::READ_LATEST );
		$existing = Title::newFromText( 'SecondarySlotApiExistingTarget' );
		$missing = Title::newFromText( 'SecondarySlotApiMissingTarget' );
		$file = Title::newFromText( 'File:Example.png' );
		$this->assertNotNull( $existing );
		$this->assertNotNull( $missing );
		$this->assertNotNull( $file );
		$this->editPage( $existing, 'Existing target for layerspublish link test.' );
		$this->assertTrue( $existing->exists() );
		$this->assertFalse( $missing->exists() );

		$actor = $this->actor();
		$links = [ $existing->getPrefixedText(), $missing->getPrefixedText(), $file->getPrefixedText(),
			'#Section', 'https://example.org/a' ];
		$firstData = $this->documentWithLinks( $links );
		$firstRevision = $this->publish( $owner, $owner->getLatestRevID( IDBAccessObject::READ_LATEST ),
			$firstData, $actor );
		$this->refreshLinkState();
		$firstRecord = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $firstRevision );
		$this->assertNotNull( $firstRecord );
		$this->assertSame( $pageId, $firstRecord->getPageId() );
		$this->assertTrue( $firstRecord->hasSlot( PageRevisionWriter::SLOT ) );
		$publishedSlot = $firstRecord->getContent( PageRevisionWriter::SLOT );
		$this->assertInstanceOf( LayersDocumentContentHandler::class, $publishedSlot->getContentHandler() );
		$this->assertStringContainsString( $existing->getPrefixedText(), $publishedSlot->getText(),
			'The published revision must retain the link-bearing Layers slot.' );
		$this->assertCurrentPageLinks( $pageId, [ $existing, $missing, $file ] );
		$this->assertSame( [ 'https://example.org/a' ], $this->externalLinks( $pageId ) );
		$renderedRevision = $this->getServiceContainer()->getRevisionRenderer()
			->getRenderedRevision( $firstRecord, null, $actor );
		$this->assertNotNull( $renderedRevision );
		$parserOutput = $renderedRevision->getRevisionParserOutput( [ 'generate-html' => false ] );
		$this->assertNotEmpty( $parserOutput->getLinkList( ParserOutputLinkTypes::LOCAL ),
			'The native revision renderer can derive internal link metadata from the published Layers slot. ' .
			'Parsoid=' . (int)$renderedRevision->getOptions()->getUseParsoid() .
			'; test handler parse calls=' . SecondarySlotLinkProofContentHandler::$parseCalls );
		$this->assertNotEmpty( $parserOutput->getExternalLinks(),
			'The native revision renderer can derive external link metadata from the published Layers slot.' );

		$secondRevision = $this->publish( $owner, $firstRevision, $this->documentWithLinks( [] ), $actor );
		$this->assertGreaterThan( $firstRevision, $secondRevision );
		$this->refreshLinkState();
		$this->assertSame( [], $this->pageLinks( $pageId ),
			'Removing links in a new current revision removes link rows.' );
		$this->assertSame( [], $this->externalLinks( $pageId ) );

		// A hidden old revision can still contain link metadata, but must not
		// resurrect its targets as current-page links when it is hidden.
		$this->revisionDelete( $firstRevision, [ RevisionRecord::DELETED_TEXT => 1 ],
			'Hide historical Layers link test revision' );
		$this->refreshLinkState();
		$this->assertSame( $secondRevision, $owner->getLatestRevID( IDBAccessObject::READ_LATEST ) );
		$this->assertSame( RevisionRecord::DELETED_TEXT,
			$this->getServiceContainer()->getRevisionLookup()->getRevisionById( $firstRevision )->getVisibility() );
		$this->assertSame( [], $this->pageLinks( $pageId ),
			'Hiding a non-current revision does not make its old layer links current.' );
		$this->assertSame( [], $this->externalLinks( $pageId ) );
	}

	public function testParsoidRevisionLinksUpdateRetainsPageOwnedLayerLinks(): void {
		$this->setLayersSlotDisplayForTest( 'none' );
		$owner = $this->getNonexistingTestPage()->getTitle();
		$this->ownerKeys = [ $owner->getPrefixedDBkey() ];
		$this->editPage( $owner, 'Parsoid page-owned Layers link test.' );
		$pageId = $owner->getArticleID( IDBAccessObject::READ_LATEST );
		$target = Title::newFromText( 'ParsoidSecondarySlotTarget' );
		$this->editPage( $target, 'Target for Parsoid secondary-slot links.' );
		$this->assertTrue( $target->exists() );
		$actor = $this->actor();
		$revisionId = $this->publish( $owner, $owner->getLatestRevID( IDBAccessObject::READ_LATEST ),
			$this->documentWithLinks( [ $target->getPrefixedText(), 'https://example.org/parsoid' ] ), $actor );
		$this->refreshLinkState();
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId );
		$this->assertNotNull( $revision );
		$this->assertCurrentPageLinks( $pageId, [ $target ] );
		$this->assertContains( 'https://example.org/parsoid', $this->externalLinks( $pageId ) );

		$options = ParserOptions::newFromAnon();
		$options->setUseParsoid();
		$renderedRevision = $this->getServiceContainer()->getRevisionRenderer()
			->getRenderedRevision( $revision, $options, $actor );
		$layerOutput = $renderedRevision->getSlotParserOutput( PageRevisionWriter::SLOT );
		$this->assertSame( '', $layerOutput->getRawText(),
			'HTML generation for the Layers slot must not render JsonContentHandler table output.' );
		$this->assertStringNotContainsString( 'schemaVersion', $layerOutput->getRawText() );
		$this->assertStringNotContainsString( '<table', $layerOutput->getRawText() );

		$parsoidOutput = $renderedRevision->getRevisionParserOutput( [ 'generate-html' => false ] );
		$this->assertNotContains( $target->getDBkey(), array_map( static fn ( $item ) =>
			$item['link']->getDBkey(), $parsoidOutput->getLinkList( ParserOutputLinkTypes::LOCAL ) ),
			'MediaWiki 1.45 Parsoid combined output intentionally contains main-slot output only.' );
		$this->assertSame( [], $parsoidOutput->getExternalLinks(),
			'MediaWiki 1.45 Parsoid combined output intentionally omits secondary-slot external links.' );

		// Exercise core's supported LinksUpdate entry point with the actual Parsoid-mode output.
		// The extension hook must restore only the current Layers slot's tracking metadata.
		$update = new LinksUpdate( $owner, $parsoidOutput, false, false );
		$update->setRevisionRecord( $revision );
		$this->assertTrue( $this->getServiceContainer()->getHookContainer()->isRegistered( 'LinksUpdate' ) );
		( new HookRunner( $this->getServiceContainer()->getHookContainer() ) )->onLinksUpdate( $update );
		$this->assertContains( $target->getDBkey(), array_map( static fn ( $item ) =>
			$item['link']->getDBkey(), $update->getParserOutput()->getLinkList( ParserOutputLinkTypes::LOCAL ) ),
			'The Layers hook restores link metadata to the Parsoid LinksUpdate output.' );
		$update->doUpdate();
		$this->runDeferredUpdates();
		$this->assertCurrentPageLinks( $pageId, [ $target ] );
		$this->assertContains( 'https://example.org/parsoid', $this->externalLinks( $pageId ) );
		$this->assertTrue( ( new \RefreshLinksJob( $owner, [
			'rootJobTimestamp' => wfTimestamp( TS_MW, time() + 60 ),
			'triggeringRevisionId' => $revisionId
		] ) )->run(), 'The normal refreshLinks job completes for the current page revision.' );
		$this->assertCurrentPageLinks( $pageId, [ $target ] );
		$this->assertContains( 'https://example.org/parsoid', $this->externalLinks( $pageId ) );

		$specialPages = $this->getServiceContainer()->getSpecialPageFactory();
		[ $whatLinksHere ] = ( new \SpecialPageExecutor() )->executeSpecialPage(
			$specialPages->getPage( 'Whatlinkshere' ), $target->getPrefixedText(), null, 'en', $actor
		);
		$this->assertStringContainsString( $owner->getPrefixedText(), $whatLinksHere );
		[ $linkSearch ] = ( new \SpecialPageExecutor() )->executeSpecialPage(
			$specialPages->getPage( 'LinkSearch' ), '', new FauxRequest( [ 'target' => '*.example.org' ] ), 'en', $actor
		);
		$this->assertStringContainsString( $owner->getPrefixedText(), $linkSearch );

		// Visible and text-hidden stale records cannot add old links, with or without
		// the internal marker that a normal combined output may already carry.
		$currentRevisionId = $this->publish( $owner, $revisionId, $this->documentWithLinks( [] ), $actor );
		$this->refreshLinkState();
		$this->assertSame( [], $this->pageLinks( $pageId ) );
		$this->assertStaleRecordDoesNotAddLinks( $owner, $revision );
		$this->revisionDelete( $revisionId, [ RevisionRecord::DELETED_TEXT => 1 ],
			'Hide old Parsoid Layers link target' );
		$hiddenStaleRevision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId );
		$this->assertSame( RevisionRecord::DELETED_TEXT, $hiddenStaleRevision->getVisibility() );
		$this->assertStaleRecordDoesNotAddLinks( $owner, $hiddenStaleRevision );

		// Core rejects stale triggering revisions before it creates a LinksUpdate,
		// preventing a marked old parse from replacing current page link tables.
		$this->assertTrue( ( new \RefreshLinksJob( $owner, [
			'rootJobTimestamp' => wfTimestamp( TS_MW, time() + 60 ),
			'triggeringRevisionId' => $revisionId
		] ) )->run() );
		$this->assertSame( $currentRevisionId, $owner->getLatestRevID( IDBAccessObject::READ_LATEST ) );
		$this->assertSame( [], $this->pageLinks( $pageId ) );
	}

	private function assertStaleRecordDoesNotAddLinks( Title $owner, RevisionRecord $staleRevision ): void {
		foreach ( [ false, true ] as $hasTrackingMarker ) {
			$output = new \MediaWiki\Parser\ParserOutput( '' );
			if ( $hasTrackingMarker ) {
				$output->setExtensionData( LayersDocumentContentHandler::LINKS_TRACKING_MARKER, true );
			}
			$update = new LinksUpdate( $owner, $output, false, false );
			$update->setRevisionRecord( $staleRevision );
			( new HookRunner( $this->getServiceContainer()->getHookContainer() ) )->onLinksUpdate( $update );
			$this->assertSame( [], $output->getLinkList( ParserOutputLinkTypes::LOCAL ),
				'Stale layer links are not merged for marker=' . (int)$hasTrackingMarker );
			$this->assertSame( [], $output->getExternalLinks(),
				'Stale external layer links are not merged for marker=' . (int)$hasTrackingMarker );
		}
	}

	/** @return array<string,array{string}> */
	public static function provideSlotDisplayModes(): array {
		return [ 'production hidden slot' => [ 'none' ], 'eligible displayed slot' => [ 'section' ] ];
	}

	private function setLayersSlotDisplayForTest( string $display ): void {
		foreach ( [ $this->getServiceContainer(), MediaWikiServices::getInstance() ] as $container ) {
			$handler = $container->getSlotRoleRegistry()->getRoleHandler( 'layers' );
			$layout = ( new \ReflectionProperty( $handler, 'layout' ) )->getValue( $handler );
			$layout['display'] = $display;
			( new \ReflectionProperty( $handler, 'layout' ) )->setValue( $handler, $layout );
		}
	}

	private function documentWithLinks( array $links ): string {
		$layers = [];
		foreach ( $links as $index => $link ) {
			$layers[] = [ 'id' => 'api-link-' . $index, 'type' => 'rectangle', 'x' => 10 + 20 * $index,
				'y' => 100, 'width' => 12, 'height' => 12, 'fill' => '#112233', 'link' => $link ];
		}
		return json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ [
			'id' => 'presentation', 'kind' => 'slide',
			'label' => 'Links', 'canvas' => [
				'width' => 800, 'height' => 600, 'backgroundColor' => '#ffffff',
				'backgroundVisible' => true, 'backgroundOpacity' => 1
			], 'layers' => $layers ] ] ], JSON_THROW_ON_ERROR );
	}

	private function publish( Title $owner, int $baseRevision, string $data, User $actor ): int {
		$params = [ 'action' => 'layerspublish', 'owner' => $owner->getPrefixedText(),
			'pageid' => $owner->getArticleID( IDBAccessObject::READ_LATEST ),
			'baserevid' => $baseRevision,
			'data' => $data ];
		$result = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish'];
		$this->assertSame( 'Success', $result['result'] );
		return (int)$result['revid'];
	}

	private function refreshLinkState(): void {
		$this->runJobs();
		$this->runDeferredUpdates();
	}

	private function pageLinks( int $pageId ): array {
		$db = $this->getServiceContainer()->getConnectionProvider()->getReplicaDatabase();
		$rows = $db->newSelectQueryBuilder()->select( [ 'lt_namespace', 'lt_title' ] )->from( 'pagelinks' )
			->join( 'linktarget', null, 'pl_target_id = lt_id' )
			->where( [ 'pl_from' => $pageId ] )
			->caller( __METHOD__ )->fetchResultSet();
		$links = [];
		foreach ( $rows as $row ) {
			$links[] = [ (int)$row->lt_namespace, $row->lt_title ];
		}
		return $links;
	}

	private function assertCurrentPageLinks( int $pageId, array $expectedTitles ): void {
		$expected = [];
		foreach ( $expectedTitles as $title ) {
			$expected[] = [ $title->getNamespace(), $title->getDBkey() ];
		}
		$actual = $this->pageLinks( $pageId );
		foreach ( $expected as $link ) {
			$this->assertContains( $link, $actual );
		}
		$this->assertNotContains( [ NS_MAIN, '' ], $actual,
			'A bare section does not produce an empty page-link target.' );
	}

	private function externalLinks( int $pageId ): array {
		$db = $this->getServiceContainer()->getConnectionProvider()->getReplicaDatabase();
		$rows = $db->newSelectQueryBuilder()->select( [ 'el_to_domain_index', 'el_to_path' ] )
			->from( 'externallinks' )->where( [ 'el_from' => $pageId ] )->caller( __METHOD__ )->fetchResultSet();
		$links = [];
		foreach ( $rows as $row ) {
			$links[] = \MediaWiki\ExternalLinks\LinkFilter::reverseIndexes( $row->el_to_domain_index ) .
				( $row->el_to_path ?? '' );
		}
		return $links;
	}
}
