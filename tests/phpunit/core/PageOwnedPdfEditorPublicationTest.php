<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiQueryTokens;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPublish
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 * @group API
 */
class PageOwnedPdfEditorPublicationTest extends RealAssetTestCase {
	private function publicationWitness( Title $owner, string $journey ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$owner, 0, IDBAccessObject::READ_LATEST );
		$value = [ 'revision' => $revision->getId(),
			'main' => $revision->getContent( 'main', RevisionRecord::RAW )->serialize(),
			'layers' => $revision->getContent( 'layers', RevisionRecord::RAW )->serialize() ];
		$loaded = [];
		foreach ( [ PageOwnedPilot::class, ApiLayersPublish::class, get_class( $this->publisher ),
			'MediaWiki\\Extension\\Layers\\Revision\\PagePdfEditorReadService',
			'MediaWiki\\Extension\\PdfHandler\\PdfHandler' ] as $class ) {
			if ( class_exists( $class, false ) ) {
				$file = ( new \ReflectionClass( $class ) )->getFileName();
				$loaded[$class] = [ 'file' => $file, 'sha256' => hash_file( 'sha256', $file ) ];
			}
		}
		if ( getenv( 'LAYERS_PUBLICATION_WITNESSES' ) ) {
			file_put_contents( getenv( 'LAYERS_PUBLICATION_WITNESSES' ), json_encode( [ 'test' => $this->getName(),
				'journey' => $journey, 'witness' => $value, 'loaded' => $loaded ] ) . "\n", FILE_APPEND | LOCK_EX );
		}
		return $value;
	}

	public function testBothPdfPagesAndWholeSetRenamePublishOneCompleteNativeRevision(): void {
		$services = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace( $services->getMainConfig()->get( 'APIModules' ), [
			'layerspublish' => [ 'class' => ApiLayersPublish::class, 'factory' => function ( $main, $name ) {
				$services = $this->getServiceContainer();
				return new ApiLayersPublish( $main, $name, $this->publisher, $services->getTitleFactory(),
					PageOwnedScope::newFromServices( $services, [] ) );
			} ]
		] ) );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$this->setService( 'RepoGroup', $repos );
		$this->publisher = TestingAdmissionRegistration::install( $this, $this->context, $this->resolver )['publisher'];
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Publication-' . wfRandomString( 8 ) . '.pdf' );
		$otherFile = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Publication-other-' . wfRandomString( 8 ) . '.pdf' );
		$anchor = $this->makePdfSurface( 'anchor', 'ABC', $file->getTitle()->getPrefixedDBkey(),
			$file->getTimestamp(), $file->getSha1(), 2 );
		$anchor['canvas']['width'] = 333;
		$anchor['canvas']['height'] = 111;
		$other = $this->makePdfSurface( 'other-file', 'ABC', $otherFile->getTitle()->getPrefixedDBkey(),
			$otherFile->getTimestamp(), $otherFile->getSha1(), 2 );
		$otherName = $anchor;
		$otherName['id'] = 'other-name';
		$otherName['label'] = 'XYZ';
		$slide = $this->makeSlideSurface( 'slide', 'ABC' );
		$document = [ 'schemaVersion' => 1, 'surfaces' => [ $anchor, $other, $otherName, $slide ] ];
		$owner = $this->getExistingTestPage()->getTitle();
		$actor = $this->actor();
		$base = $this->publisher->publish( $owner, $actor, $owner->getLatestRevID(),
			json_encode( $document ), 'Disposable publication fixture' );
		$pilot = new PageOwnedPilot( $this->getServiceContainer() );
		$binding = 'v1:' . $owner->getArticleID() . ':anchor';
		$beforeRead = $this->publicationWitness( $owner, 'read-before' );
		$stored = $pilot->preparePdfEditorPage( $owner, $base, $binding, 2, $actor );
		$missing = $pilot->preparePdfEditorPage( $owner, $base, $binding, 1, $actor );
		$this->assertSame( $beforeRead, $this->publicationWitness( $owner, 'read-after' ) );
		$this->assertFalse( $missing['stored'] );
		$this->assertEquals( $anchor, $stored['surface'] );
		$expected = json_decode( $beforeRead['layers'], true );
		$expected['surfaces'][] = $missing['surface'];
		foreach ( $expected['surfaces'] as &$surface ) {
			if ( $surface['kind'] === 'pdf' && $surface['source']['fileTitle'] === $anchor['source']['fileTitle'] &&
				$surface['label'] === 'ABC' ) {
				$surface['label'] = 'Renamed whole set';
				$surface['layers'] = [ [ 'id' => 'page-' . $surface['source']['page'], 'type' => 'text',
					'text' => 'Edited page ' . $surface['source']['page'], 'x' => -17, 'y' => 29 ] ];
				$surface['readingOrder'] = [ $surface['layers'][0]['id'] ];
			}
		}
		unset( $surface );
		$revisionCount = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->where( [ 'rev_page' => $owner->getArticleID() ] )->caller( __METHOD__ )->fetchField();
		$before = $this->publicationWitness( $owner, 'publication-before' );
		$params = [ 'action' => 'layerspublish', 'formatversion' => 2, 'owner' => $owner->getPrefixedDBkey(),
			'pageid' => $owner->getArticleID(), 'baserevid' => $base, 'data' => json_encode( $expected ),
			'summary' => 'Intentional isolated two-page publication' ];
		$request = new FauxRequest( $params, true );
		$request->getSession()->setUser( $actor->getUser() );
		$request->setVal( 'token', ApiQueryTokens::getToken( $actor->getUser(), $request->getSession(),
			ApiQueryTokens::getTokenTypeSalts()['csrf'] )->toString() );
		$context = new RequestContext();
		$context->setRequest( $request );
		$context->setAuthority( $actor );
		$api = new ApiMain( $context, true );
		$api->execute();
		$result = $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] )['layerspublish'];
		$this->assertSame( 'Success', $result['result'] );
		$after = $this->publicationWitness( $owner, 'publication-after' );
		$this->assertSame( (int)$result['revid'], $after['revision'] );
		$this->assertNotSame( $base, $after['revision'] );
		$countAfter = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->where( [ 'rev_page' => $owner->getArticleID() ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( (int)$revisionCount + 1, (int)$countAfter );
		$this->assertSame( $before['main'], $after['main'] );
		$this->assertSame( JsonSnapshotCodec::encode( $expected ), $after['layers'] );
		$this->assertSame( $beforeRead, $before );
		foreach ( [ 1, 2 ] as $page ) {
			$fresh = $pilot->preparePdfEditorPage( $owner, $after['revision'], $binding, $page, $actor );
			$this->assertSame( $after['revision'], $fresh['revisionId'] );
			$this->assertTrue( $fresh['stored'] );
			$this->assertSame( 'Renamed whole set', $fresh['label'] );
			$this->assertSame( $page === 1 ? $missing['surface']['id'] : 'anchor', $fresh['surface']['id'] );
			$this->assertSame( JsonSnapshotCodec::encode( $page === 1 ?
				$missing['surface']['canvas'] : $stored['surface']['canvas'] ),
				JsonSnapshotCodec::encode( $fresh['surface']['canvas'] ) );
		}
		$this->assertSame( $after, $this->publicationWitness( $owner, 'confirmed-read-after' ) );
	}
}
