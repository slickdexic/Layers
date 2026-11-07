<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot::prepareBoundViewers
 * @group Database
 * @group API
 */
class ReaderSourceRevalidationTest extends RealAssetTestCase {
	public function testRevokedSourceIsOmittedAfterEditorPreparationWithoutHidingOtherBindings(): void {
		$services = $this->getServiceContainer();
		$one = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Reader-revoked-' . wfRandomString( 8 ) . '.png' );
		$two = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Reader-available-' . wfRandomString( 8 ) . '.png' );
		$repo = $this->createMock( RepoGroup::class );
		$repo->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repo->method( 'findFile' )->willReturnCallback( fn ( $title ) => $this->repo->findFile( $title ) );
		$this->setService( 'RepoGroup', $repo );
		$surfaces = [
			$this->makeImageSurface( 'revoked', 'Revoked', $one->getTitle()->getPrefixedDBkey(),
				$one->getTimestamp(), $one->getSha1() ),
			$this->makeImageSurface( 'available', 'Available', $two->getTitle()->getPrefixedDBkey(),
				$two->getTimestamp(), $two->getSha1() ),
			$this->makeSlideSurface( 'slide', 'Slide' )
		];
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$revision = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			$this->buildDocument( $surfaces ), 'Reader fixture', new WikitextContent( 'Reader fixture' ),
			$page->getId() );
		$state = (object)[ 'revoked' => false, 'checks' => 0, 'allowedChecks' => 0 ];
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback(
			static fn ( $right, $title ) => $actor->definitelyCan( $right, $title ) );
		$authority->method( 'isAllowed' )->willReturnCallback( static fn ( $right ) => $actor->isAllowed( $right ) );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static function ( $right, $title ) use ( $actor, $one, $two, $state ) {
				if ( $right === 'read' && $title->equals( $one->getTitle() ) && $state->revoked ) {
					$state->checks++;
					return false;
				}
				if ( $right === 'read' && $title->equals( $two->getTitle() ) && $state->revoked ) {
					$state->allowedChecks++;
				}
				return $actor->authorizeRead( $right, $title );
			} );
		$pilot = new class( $services, [ $page->getTitle()->getPrefixedDBkey() ], $state ) extends PageOwnedPilot {
			public function __construct( $services, array $keys, private $state ) {
				parent::__construct( $services, $keys );
			}

			public function prepareEditor( string $ownerText, int $revisionId, string $surfaceId,
				Authority $authority, ?int $targetPage = null
			): array {
				$result = parent::prepareEditor( $ownerText, $revisionId, $surfaceId, $authority, $targetPage );
				if ( $surfaceId === 'slide' ) {
					$this->state->revoked = true;
				}
				return $result;
			}
		};
		$modules = $services->getMainConfig()->get( 'APIModules' );
		$this->overrideConfigValue( 'APIModules', array_replace( $modules, [
			'layersread' => [ 'class' => ApiLayersRead::class, 'factory' => static function ( $main, $name ) use (
				$services, $pilot, $page
			) {
				$reader = new PageReadService( new PageHistoryAccess( $services->getRevisionLookup() ),
					new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
						$services->getTitleFactory() ) );
				return new ApiLayersRead( $main, $name, $reader, $services->getTitleFactory(),
					PageOwnedScope::newFromServices( $services, [ $page->getTitle()->getPrefixedDBkey() ] ),
					[ $pilot, 'prepareBoundViewers' ] );
			} ]
		] ) );
		$prefix = 'v1:' . $page->getId() . ':';
		$request = new FauxRequest( [ 'action' => 'layersread', 'formatversion' => 2,
			'owner' => $page->getTitle()->getPrefixedDBkey(), 'revid' => $revision,
			'binding' => $prefix . 'revoked|' . $prefix . 'available|' . $prefix . 'slide', 'controls' => 1 ] );
		$context = new RequestContext();
		$context->setRequest( $request );
		$context->setAuthority( $authority );
		$api = new ApiMain( $context, true );
		$api->execute();
		$bindings = $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] )['layersread']['bindings'];
		$this->assertArrayNotHasKey( $prefix . 'revoked', $bindings );
		$this->assertArrayHasKey( $prefix . 'available', $bindings );
		$this->assertArrayHasKey( $prefix . 'slide', $bindings );
		$this->assertNotEmpty( $bindings[$prefix . 'available']['editUrl'] );
		$this->assertNotEmpty( $bindings[$prefix . 'slide']['editUrl'] );
		$this->assertSame( $revision, $bindings[$prefix . 'available']['revisionId'] );
		$this->assertSame( 'private', $api->getCacheMode() );
		$this->assertGreaterThan( 0, $state->checks );
		$this->assertGreaterThan( 0, $state->allowedChecks );
	}
}
