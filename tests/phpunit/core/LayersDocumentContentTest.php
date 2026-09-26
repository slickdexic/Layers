<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\JsonContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;

/**
 * @covers \MediaWiki\Extension\Layers\Content\LayersDocumentContent
 * @covers \MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler
 * @group Database
 */
class LayersDocumentContentTest extends \MediaWikiIntegrationTestCase {
	use ExcludesInstalledPilot;

	protected function setUp(): void {
		parent::setUp();
		$this->excludeInstalledPilot();
		$this->getServiceContainer()->getContentHandlerFactory()->defineContentHandler(
			LayersDocumentContent::MODEL, LayersDocumentContentHandler::class );
		$this->getServiceContainer()->getSlotRoleRegistry()->defineRoleWithModel(
			PageRevisionWriter::SLOT, LayersDocumentContent::MODEL, [ 'display' => 'none' ], false );
	}

	protected function tearDown(): void {
		try {
			parent::tearDown();
		} finally {
			$this->installedPilotOverride = null;
		}
	}

	private function fixture(): string {
		return file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' );
	}

	public function testCustomModelRoundTripAndCanonicalNoOp(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$writer = new PageRevisionWriter();
		$first = $writer->save( $page->newPageUpdater( $user ), $page->getLatest(),
			new LayersDocumentContent( $this->fixture() ),
			CommentStoreComment::newUnsavedComment( 'Adopt mixed document' ) );
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $first->getId() )
			->getContent( PageRevisionWriter::SLOT );
		$this->assertInstanceOf( LayersDocumentContent::class, $stored );
		$this->assertSame( ( new DocumentSchema() )->canonicalize( $this->fixture() ), $stored->getText() );
		$again = $writer->save( $page->newPageUpdater( $user ), $first->getId(),
			new LayersDocumentContent( $stored->getText() ),
			CommentStoreComment::newUnsavedComment( 'Formatting only' ) );
		$this->assertSame( $first->getId(), $again->getId() );
	}

	public function testRevisionDiffShowsChangedPropertiesOnTheirOwnLines(): void {
		$old = json_decode( $this->fixture() );
		$new = json_decode( $this->fixture() );
		$new->surfaces[0]->layers[0]->text = 'Revised label';
		$renderer = $this->getServiceContainer()->getContentHandlerFactory()
			->getContentHandler( LayersDocumentContent::MODEL )
			->getSlotDiffRenderer( \MediaWiki\Context\RequestContext::getMain() );
		$diff = $renderer->getDiff(
			new LayersDocumentContent( ( new DocumentSchema() )->canonicalize( json_encode( $old ) ) ),
			new LayersDocumentContent( ( new DocumentSchema() )->canonicalize( json_encode( $new ) ) ) );
		$this->assertStringContainsString( 'Revised label', $diff );
		// Only the edited property differs; canonical storage is one line, so a raw diff would be one huge row.
		$this->assertSame( 1, substr_count( $diff, 'class="diff-deletedline' ) );
		$this->assertContains( 'layers-readable-json-1', $renderer->getExtraCacheKeys() );
	}

	/**
	 * @dataProvider provideRejectedContent
	 * @param string $json
	 * @param bool $rawJson
	 */
	public function testCoreRejectsInvalidSnapshotWithoutApi( string $json, bool $rawJson ): void {
		$page = $this->getExistingTestPage();
		$base = $page->getLatest();
		$content = $rawJson ?
			new JsonContent( $json, LayersDocumentContent::MODEL ) : new LayersDocumentContent( $json );
		// Deliberately bypass the Layers writer: the core handler must enforce the schema.
		$updater = $page->newPageUpdater( $this->getTestUser()->getUser() );
		$updater->setContent( PageRevisionWriter::SLOT, $content );
		$this->assertNull( $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Must reject' ) ) );
		$this->assertFalse( $updater->wasSuccessful() );
		$this->assertSame( $base, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	/** @return array */
	public static function provideRejectedContent(): array {
		return [
			'scalar' => [ 'null', false ],
			'missing-envelope' => [ '{}', false ],
			'future-version' => [ '{"schemaVersion":2,"surfaces":[]}', false ],
			'bad-list' => [ '{"schemaVersion":1,"surfaces":{}}', false ],
			'raw-json-bypass' => [ '{}', true ],
			'syntax' => [ '{', false ],
			'duplicate-member' => [ '{"schemaVersion":1,"surfaces":[],"surfaces":[]}', false ]
		];
	}

	public function testEmptyContentAndModelGuard(): void {
		$handler = new LayersDocumentContentHandler();
		$this->assertTrue( $handler->makeEmptyContent()->isValid() );
		$this->expectException( \InvalidArgumentException::class );
		new LayersDocumentContent( '{}', 'json' );
	}

	public function testSnapshotLimitsDoNotFollowMutableWikiLayerLimit(): void {
		$this->overrideConfigValue( 'LayersMaxLayerCount', 1 );
		$doc = json_decode( $this->fixture() );
		$second = clone $doc->surfaces[0]->layers[0];
		$second->id = 'second';
		$doc->surfaces[0]->layers[] = $second;
		$this->assertTrue( ( new LayersDocumentContent( json_encode( $doc ) ) )->isValid() );
	}
}
