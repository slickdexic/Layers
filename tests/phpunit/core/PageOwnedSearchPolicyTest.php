<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Deferred\DeferredUpdates;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * Owner-approved option A: saved page text follows page/revision access, not file visibility.
 * Uses active search registration without a test-only projection or indexing callback.
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchText
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchIngress
 * @group Database
 */
class PageOwnedSearchPolicyTest extends RealAssetTestCase {

	protected function setUp(): void {
		parent::setUp();
		$this->assertSame( 'unittest_', $this->getDb()->tablePrefix(), 'Only isolated test tables are allowed.' );
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$this->overrideConfigValue( 'GroupPermissions', array_replace_recursive(
			$this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' ), [ '*' => [ 'read' => true ] ] ) );
		$repo = $this->createMock( RepoGroup::class );
		$repo->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repo->method( 'findFile' )->willReturnCallback( fn ( $title, $options = [] ) =>
			$this->repo->findFile( $title, $options ) );
		$this->setService( 'RepoGroup', $repo );
	}

	private function query( array $params, $actor ): array {
		$context = new RequestContext();
		$context->setUser( $actor );
		$context->setRequest( new FauxRequest( $params + [ 'action' => 'query', 'formatversion' => 2 ] ) );
		$api = new ApiMain( $context, true );
		$api->execute();
		return $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] );
	}

	private function assertSearch( string $word, string $title, $actor, bool $expected = true ): void {
		$list = $this->query( [ 'list' => 'search', 'srsearch' => $word,
			'srwhat' => 'text', 'srnamespace' => NS_MAIN ], $actor );
		$this->assertSame( $expected, in_array( $title,
			array_column( $list['query']['search'] ?? [], 'title' ), true ), 'Native list search: ' . $word );
		$generator = $this->query( [ 'generator' => 'search', 'gsrsearch' => $word,
			'gsrwhat' => 'text', 'gsrnamespace' => NS_MAIN ], $actor );
		$this->assertSame( $expected, in_array( $title,
			array_column( $generator['query']['pages'] ?? [], 'title' ), true ), 'Native generator: ' . $word );
	}

	private function revisionText( int $id, $actor ): string {
		$data = $this->query( [ 'prop' => 'revisions', 'revids' => $id,
			'rvprop' => 'content', 'rvslots' => 'layers' ], $actor );
		$pages = $data['query']['pages'] ?? [];
		$page = reset( $pages ) ?: [];
		return $page['revisions'][0]['slots']['layers']['content'] ?? '';
	}

	public function testSuppressedFileDoesNotHideReadablePageOwnedSearchOrHistory(): void {
		$services = $this->getServiceContainer();
		$actor = $this->actor( [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk',
			'deleterevision', 'suppressrevision', 'viewsuppressed' ] );
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Page-search-policy-' . wfRandomString( 8 ) . '.png' );
		$surface = $this->makeImageSurface( 'image', 'Image', $file->getTitle()->getPrefixedDBkey(),
			$file->getTimestamp(), $file->getSha1() );
		$slide = $this->makeSlideSurface();
		$surface['layers'] = $slide['layers'];
		$surface['layers'][0]['text'] = 'pageownedfilemarker';
		$surface['readingOrder'] = [ 'title' ];
		$slide['layers'][0]['text'] = 'pageownedslidemarker';
		$page = $this->getExistingTestPage();
		$title = $page->getTitle()->getPrefixedText();
		$first = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			$this->buildDocument( [ $surface, $slide ] ), 'First policy fixture',
			new WikitextContent( 'pageownedordinarymarker' ), $page->getId() );
		$slide['label'] = 'Updated slide';
		$current = $this->publisher->publish( $page->getTitle(), $actor, $first,
			$this->buildDocument( [ $surface, $slide ] ), 'Second policy fixture', null, $page->getId() );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-image-replacement.png',
			'Fixture replacement', '', 0, false, '20260907120000', $actor ) );
		DeferredUpdates::doUpdates();
		$anonymous = $services->getUserFactory()->newAnonymous();
		$this->assertSearch( 'pageownedfilemarker', $title, $anonymous );
		$archive = $this->getDb()->newSelectQueryBuilder()->select( 'oi_archive_name' )->from( 'oldimage' )
			->where( [ 'oi_name' => $file->getName(), 'oi_sha1' => $surface['source']['sha1'] ] )
			->caller( __METHOD__ )->fetchField();
		$this->assertIsString( $archive );
		$context = new RequestContext();
		$context->setUser( $actor );
		$context->setTitle( $file->getTitle() );
		$context->setRequest( new FauxRequest() );
		$archiveId = explode( '!', $archive, 2 )[0];
		foreach ( [ 1, 0 ] as $hidden ) {
			$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(), [ $archiveId ] );
			$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => $hidden,
				File::DELETED_RESTRICTED => $hidden ], 'comment' => 'Synthetic policy transition' ] ) );
			$this->assertSearch( 'pageownedfilemarker', $title, $anonymous );
			DeferredUpdates::doUpdates();
			foreach ( [ $anonymous, $actor ] as $reader ) {
				foreach ( [ 'pageownedfilemarker', 'pageownedslidemarker', 'pageownedordinarymarker' ] as $word ) {
					$this->assertSearch( $word, $title, $reader );
				}
				foreach ( [ $first, $current ] as $id ) {
					$this->assertStringContainsString( 'pageownedfilemarker', $this->revisionText( $id, $reader ) );
				}
			}
			$content = ( new PageHistoryAccess( $services->getRevisionLookup() ) )
				->read( $page->getTitle(), $current, $anonymous );
			$visible = $this->resolver->resolveIndividually( $content, $anonymous, [ 'image' ] );
			$this->assertSame( !$hidden, isset( $visible['image'] ), 'Media still follows exact source visibility.' );
		}
	}

	public function testHiddenOldRevisionIsNotPublicAndDoesNotSupplyCurrentSearchTerms(): void {
		$actor = $this->actor( [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk',
			'deleterevision', 'suppressrevision', 'viewsuppressed', 'deletedtext' ] );
		$page = $this->getExistingTestPage();
		$surface = $this->makeSlideSurface();
		$surface['layers'][0]['text'] = 'pageownedoldmarker';
		$first = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			$this->buildDocument( [ $surface ] ), 'Old revision fixture', null, $page->getId() );
		$surface['layers'][0]['text'] = 'pageownedcurrentmarker';
		$current = $this->publisher->publish( $page->getTitle(), $actor, $first,
			$this->buildDocument( [ $surface ] ), 'Current revision fixture', null, $page->getId() );
		DeferredUpdates::doUpdates();
		$anonymous = $this->getServiceContainer()->getUserFactory()->newAnonymous();
		$title = $page->getTitle()->getPrefixedText();
		$this->assertSearch( 'pageownedoldmarker', $title, $anonymous, false );
		$this->assertSearch( 'pageownedcurrentmarker', $title, $anonymous );
		$context = new RequestContext();
		$context->setUser( $actor );
		$context->setTitle( $page->getTitle() );
		$context->setRequest( new FauxRequest() );
		$list = \RevisionDeleter::createList( 'revision', $context, $page->getTitle(), [ $first ] );
		$this->assertStatusGood( $list->setVisibility( [ 'value' => [ RevisionRecord::DELETED_TEXT => 1,
			RevisionRecord::DELETED_RESTRICTED => 1 ], 'comment' => 'Synthetic page revision suppression' ] ) );
		DeferredUpdates::doUpdates();
		$this->assertSame( '', $this->revisionText( $first, $anonymous ) );
		$this->assertStringContainsString( 'pageownedoldmarker', $this->revisionText( $first, $actor ) );
		$this->assertStringContainsString( 'pageownedcurrentmarker', $this->revisionText( $current, $anonymous ) );
		$this->assertSearch( 'pageownedoldmarker', $title, $anonymous, false );
		$this->assertSearch( 'pageownedcurrentmarker', $title, $anonymous );
		// A private wiki's global read boundary also applies to the native search API.
		$this->overrideConfigValue( 'GroupPermissions', [ '*' => [ 'read' => false ] ] );
		// PermissionManager keeps its construction-time options and cached public-read result.
		$this->getServiceContainer()->resetServiceForTesting( 'PermissionManager' );
		$anonymous = $this->getServiceContainer()->getUserFactory()->newAnonymous();
		$this->assertFalse( $this->getServiceContainer()->getPermissionManager()->isEveryoneAllowed( 'read' ) );
		foreach ( [ [ 'list' => 'search', 'srsearch' => 'pageownedcurrentmarker' ],
			[ 'generator' => 'search', 'gsrsearch' => 'pageownedcurrentmarker' ] ] as $params
		) {
			try {
				$this->query( $params, $anonymous );
				$this->fail( 'Search must refuse readers without wiki read permission.' );
			} catch ( ApiUsageException $e ) {
				$this->assertSame( 'apierror-readapidenied', $e->getMessageObject()->getKey() );
			}
		}
	}
}
