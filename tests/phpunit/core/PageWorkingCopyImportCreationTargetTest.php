<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationTarget;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';
require_once __DIR__ . '/../../../maintenance/migrateLayersToPageHistory.php';

/**
 * Real native current revisions and guarded isolated file storage; no editor/API activation.
 * @covers \MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationTarget
 * @group Database
 */
class PageWorkingCopyImportCreationTargetTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		$maintenance = new \MigrateLayersToPageHistory();
		$maintenance->setDB( $this->getDb() );
		$maintenance->setOption( 'user', $this->getTestSysop()->getUser()->getName() );
		$maintenance->setOption( 'commit', true );
		ob_start();
		try {
			$this->assertTrue( $maintenance->execute() );
		} finally {
			ob_end_clean();
		}
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	private function upload( string $letter = 'A' ): \MediaWiki\FileRepo\File\LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			'File:ImportCreation' . $letter . wfRandomString( 8 ) . '.png' );
		$input = $this->getNewTempFile();
		copy( __DIR__ . '/../../fixtures/assets/test-image.png', $input );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( $input, 'Isolated creation target', 'Fixture only', 0, false,
			'20260906120000', $this->getTestSysop()->getUser() )->isOK() );
		return $file;
	}

	private function fixture( string $kind = 'slide', bool $slot = false,
		string $selector = 'ABC', bool $linkedCaption = false
	): array {
		$file = $kind === 'image' ? $this->upload() : null;
		$embed = $file ? '[[' . $file->getTitle()->getPrefixedDBkey() . '|layerset=' . $selector .
			( $linkedCaption ? '|A [[Main Page|linked caption]]]]' : '|Plain caption]]' ) :
			'{{#Slide:' . $selector . '}}';
		$prefix = "Préface π\n";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$document['surfaces'][0]['label'] = 'Preserved sibling';
		if ( $slot ) {
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$revision, json_encode( $document ), 'Isolated sibling setup' );
			$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
			$document = json_decode( $stored->getContent( 'layers' )->getText(), true );
		}
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] );
		$label = $selector === 'on' ? 'Default' : $selector;
		$id = NewPageDrawing::surfaceId( $page->getId(), $revision, $label,
			$file ? $file->getTitle()->getPrefixedDBkey() : null );
		return [ 'page' => $page, 'revision' => $revision, 'id' => $id, 'start' => strlen( $prefix ),
			'expected' => $embed, 'pilot' => $pilot, 'document' => $document, 'file' => $file, 'label' => $label ];
	}

	private function service( PageOwnedPilot $pilot ): PageWorkingCopyImportCreationTarget {
		$services = $this->getServiceContainer();
		$lookup = $services->getRevisionLookup();
		$access = new PageHistoryAccess( $lookup );
		return new PageWorkingCopyImportCreationTarget( $pilot,
			new PageOwnedIdentityResolver( $services->getTitleFactory(), $lookup, $access ), $lookup,
			new PageReadService( $access, new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
				$services->getTitleFactory() ) ) );
	}

	private function invoke( array $fixture, array $overrides = [], ?Authority $authority = null ): array {
		$args = array_replace( [ $fixture['page']->getId(), $fixture['revision'], $fixture['id'],
			$fixture['start'], $fixture['expected'] ], $overrides );
		return $this->service( $fixture['pilot'] )->prepare( ...array_merge( $args, [ $authority ?? $this->actor ] ) );
	}

	private function unavailable( callable $call ): void {
		try {
			$call();
			$this->fail( 'Expected native creation-target refusal' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
			$this->assertNull( $error->getPrevious() );
		}
	}

	/** @return array */
	public static function provideTargets(): array {
		return [ 'slide without slot' => [ 'slide', false ], 'slide with siblings' => [ 'slide', true ],
			'image without slot' => [ 'image', false ], 'image with siblings' => [ 'image', true ] ];
	}

	/** @dataProvider provideTargets @param string $kind @param bool $slot */
	public function testNativeEmptyAdmissionStaysSeparateFromExactStoredBase( string $kind, bool $slot ): void {
		$f = $this->fixture( $kind, $slot );
		$before = $this->witness();
		$result = $this->invoke( $f );
		$this->assertSame( $before, $this->witness() );
		$this->assertSame( $slot, $result['hasLayersSlot'] );
		$this->assertSame( $f['id'], $result['newSurface']['id'] );
		$this->assertSame( $kind, $result['newSurface']['kind'] );
		$this->assertSame( 'ABC', $result['newSurface']['label'] );
		$this->assertSame( [], $result['newSurface']['layers'] );
		$this->assertSame( [ 'start' => $f['start'], 'expected' => $f['expected'] ], $result['selection'] );
		$this->assertSame( [ 'pageId' => $f['page']->getId(), 'owner' => $f['page']->getTitle()->getPrefixedDBkey(),
			'revisionId' => $f['revision'], 'surfaceId' => $f['id'] ], $result['target'] );
		if ( $slot ) {
			$this->assertSame( $f['document'], $result['baseBundle']['snapshot'] );
			$this->assertSame( $f['revision'], $result['baseBundle']['revisionId'] );
			$this->assertSame( [], $result['baseBundle']['sourceGeometry'] );
		} else {
			$this->assertNull( $result['baseBundle'] );
		}
		$this->assertSame( $result, $this->invoke( $f ) );
		if ( $kind === 'image' ) {
			$this->assertSame( $f['file']->getSha1(), $result['newSurface']['source']['sha1'] );
			$this->assertSame( $f['file']->getTimestamp(), $result['newSurface']['source']['timestamp'] );
		}
	}

	public function testDefaultShortcutUsesExactDefaultAndDoesNotPublish(): void {
		$f = $this->fixture( 'image', false, 'on' );
		$before = $this->witness();
		$this->assertSame( 'Default', $this->invoke( $f )['newSurface']['label'] );
		$this->assertSame( $before, $this->witness() );
	}

	public function testInheritedNestedCaptionCreationRefusalRemainsIntact(): void {
		$f = $this->fixture( 'image', false, 'ABC', true );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testSameNameOnAnotherFileDoesNotCollideWithStoredSibling(): void {
		$f = $this->fixture( 'image' );
		$stored = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$otherFile = $this->upload( 'B' );
		$otherEmbed = '[[' . $otherFile->getTitle()->getPrefixedDBkey() . '|layerset=ABC]]';
		$main = $f['expected'] . "\n" . $otherEmbed;
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $stored ] ] ),
			'Isolated two-file setup', new \MediaWiki\Content\WikitextContent( $main ) );
		$f['start'] = strlen( $f['expected'] . "\n" );
		$f['expected'] = $otherEmbed;
		$f['id'] = NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'], 'ABC',
			$otherFile->getTitle()->getPrefixedDBkey() );
		$before = $this->witness();
		$result = $this->invoke( $f );
		$this->assertSame( $stored['id'], $result['baseBundle']['snapshot']['surfaces'][0]['id'] );
		$this->assertSame( $otherFile->getTitle()->getPrefixedDBkey(), $result['newSurface']['source']['fileTitle'] );
		$this->assertSame( 'ABC', $result['newSurface']['label'] );
		$this->assertSame( $before, $this->witness() );
	}

	/** @return array */
	public static function provideInvalidRequests(): array {
		return [ 'zero owner' => [ 0, 0 ], 'zero base' => [ 1, 0 ], 'oversized owner' => [ 0, 2147483648 ],
			'fabricated ID' => [ 2, 'fabricated' ], 'empty ID' => [ 2, '' ], 'negative offset' => [ 3, -1 ],
			'character offset instead of byte offset' => [ 3, 10 ], 'empty embed' => [ 4, '' ],
			'different embed' => [ 4, '{{#Slide:Other}}' ], 'not saved syntax' => [ 4, '{{#Slide:ABC|noedit}}' ],
			'invalid UTF-8' => [ 4, "\xff" ] ];
	}

	/** @dataProvider provideInvalidRequests @param int $field @param mixed $value */
	public function testRequestAssertionsCannotGrantAdmission( int $field, $value ): void {
		$f = $this->fixture();
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, [ $field => $value ] ) );
		$this->assertSame( $before, $this->witness() );
	}

	/** @return array */
	public static function provideDeniedRights(): array {
		return [ [ 'read' ], [ 'edit' ], [ 'editlayers' ] ];
	}

	/** @dataProvider provideDeniedRights @param string $denied */
	public function testNativeRightsAreRequired( string $denied ): void {
		$f = $this->fixture();
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static fn ( $right ) => $right !== $denied );
		$authority->method( 'authorizeRead' )->willReturnCallback( static fn ( $right ) => $right !== $denied );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, [], $authority ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testForeignAndStaleNativeBasesRefuse(): void {
		$f = $this->fixture();
		$foreign = $this->getExistingTestPage();
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, [ 1 => $foreign->getLatest() ] ) );
		$this->assertSame( $before, $this->witness() );
		$this->editPage( $f['page'], $f['expected'] . ' concurrent edit' );
		$afterEdit = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $afterEdit, $this->witness() );
	}

	public function testOutsideCreationScopeRefuses(): void {
		$f = $this->fixture();
		$f['pilot'] = new PageOwnedPilot( $this->getServiceContainer() );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testStoredEmptyMemberCannotBecomeANewAdmission(): void {
		$f = $this->fixture();
		$surface = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ),
			'Store empty fixture' );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testChangedPreparationWithTheSameIDRefuses(): void {
		$f = $this->fixture();
		$native = $f['pilot'];
		$pilot = $this->getMockBuilder( PageOwnedPilot::class )
			->setConstructorArgs( [ $this->getServiceContainer(), [], [ NS_MAIN ] ] )
			->onlyMethods( [ 'prepareBoundEditor' ] )->getMock();
		$calls = 0;
		$pilot->method( 'prepareBoundEditor' )->willReturnCallback(
			static function ( ...$args ) use ( $native, &$calls ) {
				$init = $native->prepareBoundEditor( ...$args );
				if ( ++$calls === 2 ) {
					$init['pageOwned']['newSurface']['canvas']['width']++;
				}
				return $init;
			} );
		$f['pilot'] = $pilot;
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( 2, $calls );
		$this->assertSame( $before, $this->witness() );
	}

	public function testCompetingNativeEditAfterSecondCaptureRefusesAtFinalCheck(): void {
		$f = $this->fixture();
		$native = $f['pilot'];
		$pilot = $this->getMockBuilder( PageOwnedPilot::class )
			->setConstructorArgs( [ $this->getServiceContainer(), [], [ NS_MAIN ] ] )
			->onlyMethods( [ 'prepareBoundEditor' ] )->getMock();
		$calls = 0;
		$afterCompetingEdit = null;
		$pilot->method( 'prepareBoundEditor' )->willReturnCallback(
			function ( ...$args ) use ( $native, &$calls, &$afterCompetingEdit, $f ) {
				$init = $native->prepareBoundEditor( ...$args );
				if ( ++$calls === 2 ) {
					$this->editPage( $f['page'], $f['expected'] . ' competing native edit' );
					$afterCompetingEdit = $this->witness();
				}
				return $init;
			} );
		$f['pilot'] = $pilot;
		$this->unavailable( fn () => $this->invoke( $f ) );
		$this->assertSame( 2, $calls );
		$this->assertSame( $afterCompetingEdit, $this->witness() );
	}

	public function testUnreadableNativeFileCannotBeAdmitted(): void {
		$f = $this->fixture( 'image' );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturn( true );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static fn ( $right, $title ) => $title->getNamespace() !== NS_FILE );
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, [], $authority ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testRevokedRightsAfterSecondCaptureRefuse(): void {
		$f = $this->fixture();
		$native = $f['pilot'];
		$allowed = true;
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static function () use ( &$allowed ) {
			return $allowed;
		} );
		$authority->method( 'authorizeRead' )->willReturn( true );
		$pilot = $this->getMockBuilder( PageOwnedPilot::class )
			->setConstructorArgs( [ $this->getServiceContainer(), [], [ NS_MAIN ] ] )
			->onlyMethods( [ 'prepareBoundEditor' ] )->getMock();
		$calls = 0;
		$pilot->method( 'prepareBoundEditor' )->willReturnCallback(
			static function ( ...$args ) use ( $native, &$calls, &$allowed ) {
				$init = $native->prepareBoundEditor( ...$args );
				if ( ++$calls === 2 ) {
					$allowed = false;
				}
				return $init;
			} );
		$f['pilot'] = $pilot;
		$before = $this->witness();
		$this->unavailable( fn () => $this->invoke( $f, [], $authority ) );
		$this->assertSame( 2, $calls );
		$this->assertSame( $before, $this->witness() );
	}
}
