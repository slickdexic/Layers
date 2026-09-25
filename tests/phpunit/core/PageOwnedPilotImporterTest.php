<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilotImporter;
use MediaWikiIntegrationTestCase;
use RuntimeException;
use WikiRevision;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilotImporter
 * @group Database
 */
class PageOwnedPilotImporterTest extends MediaWikiIntegrationTestCase {
	/**
	 * @dataProvider provideImports
	 * @param bool $noUpdates
	 * @param string $kind
	 */
	public function testNativeImport( bool $noUpdates, string $kind ): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$page = $kind === 'pilot-existing' ? $this->getExistingTestPage() : $this->getNonexistingTestPage();
		$title = $page->getTitle();
		$baseId = null;
		if ( $kind === 'pilot-existing' ) {
			$actor = $this->getTestUser()->getUser();
			$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
			$baseId = $registered['publisher']->publish( $title, $actor, $page->getLatest(),
				'{"schemaVersion":1,"surfaces":[]}', 'Existing pilot snapshot' );
		}
		$revision = new WikiRevision();
		$revision->setTitle( $title );
		$revision->setTimestamp( '20260101000000' );
		$revision->setUsername( $this->getTestUser()->getUser()->getName() );
		$revision->setComment( 'Native import test' );
		$revision->setContent( 'main', new WikitextContent( 'Ordinary imported text' ) );
		$revision->setNoUpdates( $noUpdates );
		$keys = in_array( $kind, [ 'pilot', 'pilot-existing' ], true ) ? [ $title->getPrefixedDBkey() ] : [];
		if ( $kind === 'layers-role' ) {
			$revision->setContent( 'layers', new WikitextContent( 'Wrong model' ) );
		} elseif ( $kind === 'layers-model' ) {
			$revision->setContent( 'main', new LayersDocumentContent( '{"schemaVersion":1,"surfaces":[]}' ) );
		}
		$name = $noUpdates ? 'WikiRevisionOldRevisionImporterNoUpdates' : 'OldRevisionImporter';
		$native = $s->getService( $name );
		$this->setService( $name, new PageOwnedPilotImporter( $native, $keys ) );
		$beforeCount = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();
		if ( $kind === 'ordinary' ) {
			$this->assertTrue( $revision->importOldRevision() );
		} else {
			try {
				$revision->importOldRevision();
				$this->fail( 'Expected explicit import rejection' );
			} catch ( RuntimeException $e ) {
				$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
			}
			$this->assertSame( $beforeCount,
				$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
					->caller( __METHOD__ )->fetchField(), 'Rejected import must not insert historical revisions' );
		}
		$row = $this->getDb()->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
			->where( [ 'page_namespace' => $title->getNamespace(), 'page_title' => $title->getDBkey() ] )
			->caller( __METHOD__ )->fetchField();
		if ( $kind === 'ordinary' ) {
			$this->assertGreaterThan( 0, (int)$row );
			$stored = $s->getRevisionLookup()->getRevisionByTitle( $title );
			$this->assertSame( 'Ordinary imported text', $stored->getContent( 'main' )->serialize() );
		} elseif ( $kind === 'pilot-existing' ) {
			$this->assertGreaterThan( 0, (int)$row );
			$stored = $s->getRevisionLookup()->getRevisionByTitle( $title );
			$this->assertSame( $baseId, $stored->getId() );
			$this->assertTrue( $stored->hasSlot( 'layers' ) );
		} else {
			$this->assertFalse( $row, 'Rejected import must not create even an empty page' );
		}
	}

	/** @return array */
	public static function provideImports(): array {
		$cases = [];
		foreach ( [ false, true ] as $noUpdates ) {
			foreach ( [ 'ordinary', 'pilot', 'pilot-existing', 'layers-role', 'layers-model' ] as $kind ) {
				$cases[] = [ $noUpdates, $kind ];
			}
		}
		return $cases;
	}
}
