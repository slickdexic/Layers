<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/NativeCreationImportApiTest.php';

/**
 * Native derivation for untrusted earlier draft identity; no API/UI activation.
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class HistoricalCreationDraftRebaseTest extends NativeCreationImportApiTest {

	private function newer( array $f, ?string $main = null ): int {
		$access = TestingAccessWrapper::newFromObject( $this );
		return $access->registration['publisher']->publish( $f['page']->getTitle(), $access->actor,
			$f['revision'], JsonSnapshotCodec::encode( $f['document'] ), 'Independent current sibling',
			new WikitextContent( $main ?? 'Newer π prefix ' . $f['expected'] ) );
	}

	private function prepare( array $f, int $current ): array {
		return $f['pilot']->prepareCreationDraftRebase( $f['page']->getId(), $current,
			$f['id'], $f['revision'], TestingAccessWrapper::newFromObject( $this )->actor );
	}

	private function refuses( callable $read ): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$this->runDeferredUpdates();
		$before = $access->witness();
		try {
			$read();
			$this->fail( 'Unprovable historical creation identity must refuse' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $access->witness(), 'Derivation writes no fixture table' );
	}

	public static function provideDraftTargets(): array {
		return [ [ 'slide', false ], [ 'slide', true ], [ 'image', false ], [ 'image', true ] ];
	}

	/** @dataProvider provideDraftTargets */
	public function testDerivesExactHistoricalBytesAndReturnsCurrentNativeAdmission( string $kind, bool $slot ): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( $kind, $slot );
		$current = $this->newer( $f );
		$this->runDeferredUpdates();
		$before = $access->witness();
		$result = $this->prepare( $f, $current );
		$this->assertSame( [ 'origin', 'creation' ], array_keys( $result ) );
		$this->assertSame( [ 'pageId' => $f['page']->getId(), 'revisionId' => $f['revision'],
			'surfaceId' => $f['id'], 'selection' => [ 'start' => $f['start'], 'expected' => $f['expected'] ] ],
			$result['origin'] );
		$native = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $current );
		$this->assertSame( json_decode( $native->getContent( 'layers' )->getText(), true ),
			$result['creation']['baseBundle']['snapshot'] );
		$this->assertSame( NewPageDrawing::surfaceId( $f['page']->getId(), $current, $f['label'],
			$f['file'] ? $f['file']->getTitle()->getPrefixedDBkey() : null ), $result['creation']['newSurface']['id'] );
		$this->assertSame( $kind, $result['creation']['newSurface']['kind'] );
		$this->assertSame( $f['label'], $result['creation']['newSurface']['label'] );
		$this->assertSame( strlen( 'Newer π prefix ' ), $result['creation']['selection']['start'] );
		$this->assertSame( [], $result['creation']['newSurface']['layers'] );
		$this->assertSame( $before, $access->witness() );
	}

	public function testSameRevisionWithoutSlotReturnsNoInventedStoredBase(): void {
		$f = TestingAccessWrapper::newFromObject( $this )->fixture();
		$result = $this->prepare( $f, $f['revision'] );
		$this->assertSame( $f['id'], $result['creation']['newSurface']['id'] );
		$this->assertFalse( $result['creation']['hasLayersSlot'] );
		$this->assertNull( $result['creation']['baseBundle'] );
	}

	public function testWrongOwnerRevisionIdAndBoundsRefuseWithoutWrites(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$other = $access->fixture();
		$current = $this->newer( $f );
		foreach ( [ [ $other['page']->getId(), $current, $f['id'], $f['revision'] ],
			[ $f['page']->getId(), $current, $f['id'], $other['revision'] ],
			[ $f['page']->getId(), $current, 'fabricated', $f['revision'] ],
			[ $f['page']->getId(), $current, $f['id'], $current + 1 ],
			[ $f['page']->getId(), $current, $f['id'], 0 ],
			[ $f['page']->getId(), $current, str_repeat( 'x', 81 ), $f['revision'] ],
			[ $f['page']->getId(), $current, 'invalid id', $f['revision'] ],
			[ $f['page']->getId(), $f['revision'], $f['id'], $f['revision'] ] ] as $request ) {
			$this->refuses( static fn () => $f['pilot']->prepareCreationDraftRebase(
				...[ ...$request, $access->actor ] ) );
		}
	}

	public function testReaderAndOutOfScopeAuthorityCannotDerive(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$current = $this->editPage( $f['page'], 'Current ' . $f['expected'] )->getNewRevision()->getId();
		$user = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $user, [ 'read' ] );
		$this->refuses( static fn () => $f['pilot']->prepareCreationDraftRebase( $f['page']->getId(),
			$current, $f['id'], $f['revision'], $user ) );
		$pilot = TestingAccessWrapper::newFromObject( $f['pilot'] );
		$scope = $pilot->scope;
		$pilot->scope = PageOwnedScope::newFromServices( $this->getServiceContainer(), [], [] );
		try {
			$this->refuses( fn () => $this->prepare( $f, $current ) );
		} finally {
			$pilot->scope = $scope;
		}
	}

	public function testIdenticalRepeatedHistoricalOccurrencesAreNotGuessed(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$f['revision'] = $this->editPage( $f['page'], $f['expected'] . "\n" . $f['expected'] )
			->getNewRevision()->getId();
		$f['id'] = NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'], $f['label'] );
		$f['start'] = 0;
		$current = $this->newer( $f );
		$this->refuses( fn () => $this->prepare( $f, $current ) );
		$explicit = $f['pilot']->prepareCreationRebase( $f['page']->getId(), $current, $f['id'],
			$f['revision'], 0, $f['expected'], $access->actor );
		$this->assertSame( $f['id'], $explicit['origin']['surfaceId'],
			'Existing explicit-selection behavior stays available' );
	}

	public function testDifferentFilesWithSameNameDoNotConfuseTheHistoricalId(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( 'image' );
		$other = $access->fixture( 'image' );
		$main = $other['expected'] . "\n" . $f['expected'];
		$f['revision'] = $this->editPage( $f['page'], $main )->getNewRevision()->getId();
		$f['start'] = strlen( $other['expected'] . "\n" );
		$f['id'] = NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'], $f['label'],
			$f['file']->getTitle()->getPrefixedDBkey() );
		$result = $this->prepare( $f, $this->newer( $f ) );
		$this->assertSame( [ 'start' => $f['start'], 'expected' => $f['expected'] ], $result['origin']['selection'] );
		$this->assertSame( $f['file']->getTitle()->getPrefixedDBkey(),
			$result['creation']['newSurface']['source']['fileTitle'] );
	}

	public static function provideChanged(): array {
		return [ [ 'removed' ], [ 'renamed' ], [ 'nowiki' ], [ 'template' ] ];
	}

	/** @dataProvider provideChanged */
	public function testChangedOrOpaqueCurrentEmbedRefuses( string $variant ): void {
		$f = TestingAccessWrapper::newFromObject( $this )->fixture();
		$main = [ 'removed' => 'Removed', 'renamed' => str_replace( 'ABC', 'Other', $f['expected'] ),
			'nowiki' => '<nowiki>' . $f['expected'] . '</nowiki>',
			'template' => '{{Unknown|' . $f['expected'] . '}}' ][$variant];
		$current = $this->newer( $f, $main );
		$this->refuses( fn () => $this->prepare( $f, $current ) );
	}

	public function testAlreadyStoredHistoricalNameAndCurrentCollisionRefuse(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->pair( 'slide', true );
		$current = $access->registration['publisher']->publish( $f['page']->getTitle(), $access->actor,
			$f['revision'], JsonSnapshotCodec::encode( $f['proposed'] ), 'Occupied native name' );
		$this->refuses( fn () => $this->prepare( $f, $current ) );
		$f['revision'] = $current;
		$f['id'] = NewPageDrawing::surfaceId( $f['page']->getId(), $current, $f['label'] );
		$current = $access->registration['publisher']->publish( $f['page']->getTitle(), $access->actor,
			$current, JsonSnapshotCodec::encode( $f['document'] ), 'Remove occupied target' );
		$this->refuses( fn () => $this->prepare( $f, $current ) );
	}

	public function testSuppressedHistoricalTextRefuses(): void {
		$f = TestingAccessWrapper::newFromObject( $this )->fixture();
		$current = $this->newer( $f );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
			RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
			->where( [ 'rev_id' => $f['revision'] ] )->caller( __METHOD__ )->execute();
		$this->refuses( fn () => $this->prepare( $f, $current ) );
	}

	public function testCompleteHistoricalBundleComparisonIncludesUnknownSiblingMetadata(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( 'slide', true );
		$current = $this->newer( $f );
		$pilot = TestingAccessWrapper::newFromObject( $f['pilot'] );
		$native = $pilot->reader;
		$reader = $this->createMock( PageReadService::class );
		$count = 0;
		$reader->method( 'read' )->willReturnCallback( static function ( ...$args ) use ( $native, $f, &$count ) {
			$result = $native->read( ...$args );
			if ( $args[1] === $f['revision'] && ++$count > 1 ) {
				$result['snapshot']['retainedUnknown'] = [ null, false, 0, 'Changed historical context' ];
			}
			return $result;
		} );
		$pilot->reader = $reader;
		try {
			$this->refuses( fn () => $this->prepare( $f, $current ) );
		} finally {
			$pilot->reader = $native;
		}
		$this->assertGreaterThanOrEqual( 4, $count, 'Compare first origin capture with complete fresh history' );
	}

	public function testFinalHistoricalVisibilityRepeatsAfterTheLastOriginRead(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( 'slide', true );
		$current = $this->newer( $f );
		$pilot = TestingAccessWrapper::newFromObject( $f['pilot'] );
		$native = $pilot->reader;
		$reader = $this->createMock( PageReadService::class );
		$count = 0;
		$after = null;
		$caller = __METHOD__;
		$reader->method( 'read' )->willReturnCallback( function ( ...$args ) use (
			$native, $f, &$count, &$after, $access, $caller
		) {
			$result = $native->read( ...$args );
			if ( $args[1] === $f['revision'] && ++$count === 7 ) {
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( [ 'rev_id' => $f['revision'] ] )->caller( $caller )->execute();
				$after = $access->witness();
			}
			return $result;
		} );
		$pilot->reader = $reader;
		try {
			$this->prepare( $f, $current );
			$this->fail( 'Suppression during the final origin read must refuse' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		} finally {
			$pilot->reader = $native;
		}
		$this->assertNotNull( $after, 'The last read must trigger real native suppression' );
		$this->assertSame( $after, $access->witness(), 'The helper makes no further table writes' );
	}
}
