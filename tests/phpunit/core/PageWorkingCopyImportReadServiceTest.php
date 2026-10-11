<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Native pages, revisions and moves; selective Authority contracts and real isolated LocalRepo bytes.
 * @covers \MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService
 * @group Database
 */
class PageWorkingCopyImportReadServiceTest extends \MediaWikiIntegrationTestCase {
	use IsolatedLocalRepoFixture;

	private array $registration;
	private array $pair;
	private array $permissions = [];
	private array $checks = [];
	private Authority $actor;
	private PageReadService $reader;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'move', 'createpage' ] );
		$services = $this->getServiceContainer();
		$this->reader = new PageReadService( new PageHistoryAccess( $services->getRevisionLookup() ),
			new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(), $services->getTitleFactory() ) );
		$this->pair = [];
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'ImportRead' . $role . wfRandomString( 8 ) );
			$document = $this->document();
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$page->getLatest(), json_encode( $document ), 'Isolated Import read fixture' );
			$this->pair[$role] = [ 'page' => $page, 'pageId' => $page->getId(), 'revisionId' => $revision ];
		}
		$this->permissions = [];
		$this->checks = [];
	}

	private function document(): array {
		return json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
	}

	private function service( ?PageReadService $reader = null ): PageWorkingCopyImportReadService {
		$services = $this->getServiceContainer();
		return new PageWorkingCopyImportReadService( new PageOwnedIdentityResolver( $services->getTitleFactory(),
			$services->getRevisionLookup(), new PageHistoryAccess( $services->getRevisionLookup() ) ),
			$services->getTitleFactory(), $reader ?? $this->reader, PageOwnedScope::newFromServices( $services, [] ) );
	}

	private function authority(): Authority {
		$authority = $this->createMock( Authority::class );
		$callback = function ( $right, $page ) {
			$id = $page->getArticleID( IDBAccessObject::READ_LATEST );
			$this->checks[] = [ $right, $id ];
			return $this->permissions[$id][$right] ?? ( $right === 'read' || $id === $this->pair['target']['pageId'] );
		};
		$authority->method( 'authorizeRead' )->willReturnCallback( $callback );
		$authority->method( 'definitelyCan' )->willReturnCallback( $callback );
		return $authority;
	}

	private function invoke( PageWorkingCopyImportReadService $service, ?Authority $authority = null,
		array $overrides = []
	): array {
		$args = array_replace( [ $this->pair['target']['pageId'], $this->pair['target']['revisionId'], 'presentation',
			$this->pair['source']['pageId'], $this->pair['source']['revisionId'], 'presentation' ], $overrides );
		return $service->read( ...array_merge( $args, [ $authority ?? $this->actor ] ) );
	}

	private function unavailable( callable $call ): void {
		try {
			$call();
			$this->fail( 'Expected fixed unavailable refusal' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
			$this->assertNull( $error->getPrevious() );
		}
	}

	private function observingReader( callable $after ): PageReadService {
		$reader = $this->createMock( PageReadService::class );
		$reader->method( 'read' )->willReturnCallback( function ( ...$args ) use ( $after ) {
			$result = $this->reader->read( ...$args );
			$after( $args, $result );
			return $result;
		} );
		return $reader;
	}

	private function advanceTarget(): int {
		$target = $this->pair['target'];
		$document = $this->document();
		$document['surfaces'][0]['layers'][0]['text'] = 'New isolated revision ' . wfRandomString( 8 );
		$revision = $this->registration['publisher']->publish( $target['page']->getTitle(), $this->actor,
			$target['revisionId'], json_encode( $document ), 'Isolated concurrent target revision' );
		$this->assertGreaterThan( $target['revisionId'], $revision );
		return $revision;
	}

	public function testAuthorizedReadOnlySourceAndDetachedCompleteBundles(): void {
		$service = $this->service();
		$before = $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->orderBy( 'rev_id' )->caller( __METHOD__ )->fetchResultSet()->numRows();
		$result = $this->invoke( $service, $this->authority() );
		$this->assertSame( [ 'target', 'source', 'targetBundle', 'sourceBundle' ], array_keys( $result ) );
		foreach ( [ 'target', 'source' ] as $role ) {
			$this->assertSame( [ 'pageId' => $this->pair[$role]['pageId'],
				'owner' => $this->pair[$role]['page']->getTitle()->getPrefixedDBkey(),
				'revisionId' => $this->pair[$role]['revisionId'], 'surfaceId' => 'presentation' ], $result[$role] );
			$this->assertSame( $this->reader->read( $this->pair[$role]['page']->getTitle(),
				$this->pair[$role]['revisionId'], $this->actor, $this->pair[$role]['pageId'], [ 'presentation' ] ),
				$result[$role . 'Bundle'] );
		}
		$this->assertNotContains( [ 'edit', $this->pair['source']['pageId'] ], $this->checks );
		$this->assertNotContains( [ 'editlayers', $this->pair['source']['pageId'] ], $this->checks );
		$result['sourceBundle']['snapshot']['surfaces'][0]['layers'][0]['text'] = 'Detached mutation';
		$this->assertNotSame( $result, $this->invoke( $service ) );
		$this->assertSame( $before, $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->caller( __METHOD__ )->fetchResultSet()->numRows() );
	}

	public function testSameNativeOwnerRefuses(): void {
		$this->unavailable( fn () => $this->invoke( $this->service(), null,
			[ 3 => $this->pair['target']['pageId'], 4 => $this->pair['target']['revisionId'] ] ) );
	}

	public function testInvalidInputsBeforeDependenciesAndFiniteBoundary(): void {
		$services = $this->getServiceContainer();
		$identities = $this->createMock( PageOwnedIdentityResolver::class );
		$identities->expects( $this->never() )->method( 'resolveForEdit' );
		$titles = $this->createMock( \MediaWiki\Title\TitleFactory::class );
		$titles->expects( $this->never() )->method( 'newFromID' );
		$reader = $this->createMock( PageReadService::class );
		$reader->expects( $this->never() )->method( 'read' );
		$service = new PageWorkingCopyImportReadService( $identities, $titles, $reader,
			PageOwnedScope::newFromServices( $services, [] ) );
		foreach ( [ 0, 1, 3, 4 ] as $index ) {
			$this->unavailable( fn () => $this->invoke( $service, null, [ $index => 0 ] ) );
		}
		foreach ( [ 2, 5 ] as $index ) {
			$this->unavailable( fn () => $this->invoke( $service, null, [ $index => '' ] ) );
		}
		$finite = [ 'null' => null, 'false' => false, 'zero' => 0, 'fraction' => 0.0,
			'unknown' => [ 'nested' => [ null, false, 0, [] ] ] ];
		$reader = $this->createMock( PageReadService::class );
		$reader->method( 'read' )->willReturnCallback( function ( ...$args ) use ( $finite ) {
			return $this->reader->read( ...$args ) + [ 'finiteBoundaryContract' => $finite ];
		} );
		$result = $this->invoke( $this->service( $reader ) );
		$this->assertSame( $finite, $result['targetBundle']['finiteBoundaryContract'] );
		$this->assertSame( $finite, $result['sourceBundle']['finiteBoundaryContract'] );
	}

	public function testTargetEditAndCurrentBaseAdmission(): void {
		foreach ( [ 'read', 'edit', 'editlayers' ] as $right ) {
			$this->permissions[$this->pair['target']['pageId']][$right] = false;
			$this->unavailable( fn () => $this->invoke( $this->service(), $this->authority() ) );
			$this->permissions = [];
		}
		$this->advanceTarget();
		$this->unavailable( fn () => $this->invoke( $this->service() ) );
	}

	public function testRepeatedReadRevokesSourceApproval(): void {
		$service = $this->service();
		$authority = $this->authority();
		$this->assertIsArray( $this->invoke( $service, $authority ) );
		$this->permissions[$this->pair['source']['pageId']]['read'] = false;
		$this->unavailable( fn () => $this->invoke( $service, $authority ) );
	}

	public function testHistoricalSelectionHiddenAndSuppressedSource(): void {
		$source = $this->pair['source'];
		$document = $this->document();
		$document['surfaces'][0]['layers'][0]['text'] = 'Later source';
		$this->registration['publisher']->publish( $source['page']->getTitle(), $this->actor,
			$source['revisionId'], json_encode( $document ), 'Later isolated source' );
		$this->assertNotSame( 'Later source', $this->invoke( $this->service() )['sourceBundle']
			['snapshot']['surfaces'][0]['layers'][0]['text'] );
		$visibility = [ RevisionRecord::DELETED_TEXT,
			RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ];
		foreach ( $visibility as $bits ) {
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => $bits ] )
				->where( [ 'rev_id' => $source['revisionId'] ] )->caller( __METHOD__ )->execute();
			$this->unavailable( fn () => $this->invoke( $this->service() ) );
		}
	}

	public function testInvalidIdsWrongOwnersAbsentSlotAndUnknownMember(): void {
		foreach ( [ 0, 1, 3, 4 ] as $index ) {
			foreach ( [ 0, -1, 2147483648 ] as $id ) {
				$this->unavailable( fn () => $this->invoke( $this->service(), null, [ $index => $id ] ) );
			}
		}
		foreach ( [ 2, 5 ] as $index ) {
			foreach ( [ '', 'missing' ] as $id ) {
				$this->unavailable( fn () => $this->invoke( $this->service(), null, [ $index => $id ] ) );
			}
		}
		$this->unavailable( fn () => $this->invoke( $this->service(), null,
			[ 4 => $this->pair['target']['revisionId'] ] ) );
		$this->unavailable( fn () => $this->invoke( $this->service(), null,
			[ 1 => $this->pair['source']['revisionId'] ] ) );
		$page = $this->getExistingTestPage();
		foreach ( [ [ 0 => $page->getId(), 1 => $page->getLatest() ],
			[ 3 => $page->getId(), 4 => $page->getLatest() ], [ 3 => 2147483647 ] ] as $args ) {
			$this->unavailable( fn () => $this->invoke( $this->service(), null, $args ) );
		}
	}

	public function testNativeMovesAndOldTitleRedirectOwnership(): void {
		$services = $this->getServiceContainer();
		foreach ( [ 'source', 'target' ] as $role ) {
			$old = $this->pair[$role]['page']->getTitle();
			$new = $this->getNonexistingTestPage()->getTitle();
			$status = $services->getMovePageFactory()->newMovePage( $old, $new )
				->moveIfAllowed( $this->actor, 'Isolated Import owner move' );
			$this->assertTrue( $status->isOK() );
			if ( $role === 'target' ) {
				$this->pair[$role]['revisionId'] = $services->getRevisionLookup()
					->getRevisionByTitle( $new, 0, IDBAccessObject::READ_LATEST )->getId();
			}
			$this->assertSame( $new->getPrefixedDBkey(), $this->invoke( $this->service() )[$role]['owner'] );
			$redirect = $services->getTitleFactory()->newFromText( $old->getPrefixedText() );
			$this->assertNotSame( $this->pair[$role]['pageId'],
				$redirect->getArticleID( IDBAccessObject::READ_LATEST ) );
			$this->unavailable( fn () => $this->invoke( $this->service(), null,
				[ $role === 'source' ? 3 : 0 => $redirect->getArticleID( IDBAccessObject::READ_LATEST ) ] ) );
		}
	}

	public function testChangesDuringDependencyWorkRefuse(): void {
		foreach ( [ 'source-read', 'source-hidden', 'target-edit', 'target-current', 'source-move' ] as $change ) {
			$changed = false;
			$reader = $this->observingReader( function ( $args ) use ( $change, &$changed ) {
				if ( $changed || $args[3] !== $this->pair['source']['pageId'] ) {
					return;
				}
				$changed = true;
				if ( $change === 'source-read' ) {
					$this->permissions[$this->pair['source']['pageId']]['read'] = false;
				} elseif ( $change === 'target-edit' ) {
					$this->permissions[$this->pair['target']['pageId']]['edit'] = false;
				} elseif ( $change === 'source-hidden' ) {
					$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
						->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
						->where( [ 'rev_id' => $this->pair['source']['revisionId'] ] )
						->caller( 'ImportReadDependencyChangeTest' )->execute();
				} elseif ( $change === 'source-move' ) {
					$status = $this->getServiceContainer()->getMovePageFactory()
						->newMovePage( $this->pair['source']['page']->getTitle(),
							$this->getNonexistingTestPage()->getTitle() )
						->moveIfAllowed( $this->actor, 'Isolated move during read' );
					$this->assertTrue( $status->isOK() );
				} else {
					$this->advanceTarget();
				}
			} );
			$this->unavailable( fn () => $this->invoke( $this->service( $reader ), $this->authority() ) );
			$this->assertTrue( $changed );
			if ( $change === 'source-hidden' ) {
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
					->where( [ 'rev_id' => $this->pair['source']['revisionId'] ] )->caller( __METHOD__ )->execute();
			}
			$this->permissions = [];
			if ( $change === 'target-current' ) {
				$this->pair['target']['revisionId'] = $this->getServiceContainer()->getRevisionLookup()
					->getRevisionByTitle( $this->pair['target']['page']->getTitle(), 0,
						IDBAccessObject::READ_LATEST )->getId();
			}
		}
	}

	public function testMalformedDuplicatePdfAndEngineFailures(): void {
		foreach ( [ 'duplicate', 'pdf', 'null', 'nan', 'object', 'engine' ] as $failure ) {
			$reader = $this->createMock( PageReadService::class );
			$reader->method( 'read' )->willReturnCallback( function ( ...$args ) use ( $failure ) {
				if ( $failure === 'engine' ) {
					throw new \Error( 'Nested secret failure' );
				}
				$result = $this->reader->read( ...$args );
				if ( $failure === 'duplicate' ) {
					$result['snapshot']['surfaces'][] = $result['snapshot']['surfaces'][0];
				} elseif ( $failure === 'pdf' ) {
					$result['snapshot']['surfaces'][0]['kind'] = 'pdf';
				} elseif ( $failure === 'null' ) {
					$result['snapshot']['surfaces'] = null;
				} else {
					$result['bad'] = $failure === 'nan' ? NAN : new \stdClass();
				}
				return $result;
			} );
			$this->unavailable( fn () => $this->invoke( $this->service( $reader ) ) );
		}
	}

	public function testSelectedSlideSkipsUnavailableSiblingAndPreservesFiniteData(): void {
		$source = $this->pair['source'];
		$document = $this->document();
		$fixturePath = __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json';
		$sibling = json_decode( file_get_contents( $fixturePath ), true )['surfaces'][1];
		$document['surfaces'][] = $sibling;
		$reader = $this->observingReader( function ( $args ) {
			$this->assertSame( [ 'presentation' ], $args[4] );
		} );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturn( [] );
		$fixture = TestingAdmissionRegistration::install( $this, null, $sources );
		$revision = $fixture['publisher']->publish( $source['page']->getTitle(), $this->actor,
			$source['revisionId'], json_encode( $document ), 'Isolated unavailable sibling' );
		$result = $this->invoke( $this->service( $reader ), null, [ 4 => $revision ] );
		$this->assertCount( 2, $result['sourceBundle']['snapshot']['surfaces'] );
		$this->assertSame( $this->reader->read( $source['page']->getTitle(), $revision, $this->actor,
			$source['pageId'], [ 'presentation' ] ), $result['sourceBundle'] );
		$this->assertSame( [], $result['sourceBundle']['sourceGeometry'] );
		$withFiniteData = $this->observingReader( static function () {
		} );
		$this->assertSame( $result, $this->invoke( $this->service( $withFiniteData ), null, [ 4 => $revision ] ) );
	}

	public function testRealImagePinsRemainExactAfterIsolatedReupload(): void {
		$services = $this->getServiceContainer();
		$repo = $services->getRepoGroup()->getLocalRepo();
		$title = $services->getTitleFactory()->newFromText( 'File:ImportRead' . wfRandomString( 8 ) . '.png' );
		$input = $this->getNewTempFile();
		$png = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAA' .
			'C0lEQVR42mP8/x8AAwMCAO+j6X8AAAAASUVORK5CYII=' );
		file_put_contents( $input, $png );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( $input, 'Isolated initial', 'Import pin test', 0, false,
			'20260906120000', $this->getTestSysop()->getUser() )->isOK() );
		$fixturePath = __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json';
		$surface = json_decode( file_get_contents( $fixturePath ), true )['surfaces'][1];
		$surface['source']['fileTitle'] = $title->getPrefixedDBkey();
		$surface['source']['sha1'] = $file->getSha1();
		$surface['source']['timestamp'] = '20260906120000';
		foreach ( [ 'source', 'target' ] as $role ) {
			$this->pair[$role]['revisionId'] = $this->registration['publisher']->publish(
				$this->pair[$role]['page']->getTitle(), $this->actor, $this->pair[$role]['revisionId'],
				json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ), 'Isolated image member' );
		}
		$before = $this->invoke( $this->service(), null, [ 2 => $surface['id'], 5 => $surface['id'] ] );
		file_put_contents( $input, $png . "\n" );
		$this->assertTrue( $file->upload( $input, 'Isolated replacement', 'Import pin test', 0, false,
			'20260907120000', $this->getTestSysop()->getUser() )->isOK() );
		$this->assertSame( $before, $this->invoke( $this->service(), null,
			[ 2 => $surface['id'], 5 => $surface['id'] ] ) );
		$this->assertSame( 1, $before['sourceBundle']['sourceGeometry'][$surface['id']]['width'] );
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
			->set( [ 'oi_deleted' => \MediaWiki\FileRepo\File\File::DELETED_FILE ] )
			->where( [ 'oi_name' => $title->getDBkey() ] )->caller( __METHOD__ )->execute();
		$this->unavailable( fn () => $this->invoke( $this->service(), null,
			[ 2 => $surface['id'], 5 => $surface['id'] ] ) );
	}
}
