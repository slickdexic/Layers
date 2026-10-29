<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\DocumentSchema
 * @covers \MediaWiki\Extension\Layers\Revision\PagePublicationService
 * @group Database
 */
class LiteralLayerTextPublicationTest extends \MediaWikiIntegrationTestCase {
	public function testNativePublicationPreservesLiteralTextAndRefusesExecutableMarkup(): void {
		$registration = TestingAdmissionRegistration::install( $this );
		$page = $this->getExistingTestPage( 'Literal layer text' );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$document = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$document->surfaces[0]->layers[0]->text = 'a<b>c <button>';
		$document->surfaces[0]->layers[0]->richText = [ (object)[ 'text' => '  <button>  ' ] ];
		$base = $page->getLatest();
		$id = $registration['publisher']->publish( $page->getTitle(), $actor, $base,
			json_encode( $document ), 'Save literal text', null, $page->getId() );
		$this->assertGreaterThan( $base, $id );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$this->assertEquals( $document, json_decode( $revision->getContent( PageRevisionWriter::SLOT )->serialize() ) );
		$document->surfaces[0]->layers[0]->text = 'Changed later';
		unset( $document->surfaces[0]->layers[0]->richText );
		$laterId = $registration['publisher']->publish( $page->getTitle(), $actor, $id,
			json_encode( $document ), 'Save later edit', null, $page->getId() );
		$historical = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$historicalDocument = json_decode( $historical->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( 'a<b>c <button>', $historicalDocument->surfaces[0]->layers[0]->text );
		$this->assertSame( '  <button>  ', $historicalDocument->surfaces[0]->layers[0]->richText[0]->text );
		$document->surfaces[0]->layers[0]->text = '<script>alert(1)</script>';
		try {
			$registration['publisher']->publish( $page->getTitle(), $actor, $laterId,
				json_encode( $document ), 'Refuse unsafe text', null, $page->getId() );
			$this->fail( 'Executable markup must be refused' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-invalid-snapshot', $e->getMessage() );
		}
		$this->assertSame( $laterId, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle(), 0, IDBAccessObject::READ_LATEST )->getId() );
	}
}
