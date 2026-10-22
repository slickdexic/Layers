<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\MissingPdfImportReceipt;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportOutcomeReadService;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPreparation;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfImportPublicationService;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfSetPreparation;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Lost-response confirmation against exact native publication evidence.
 * @covers \MediaWiki\Extension\Layers\Revision\PageMissingPdfImportOutcomeReadService
 * @group Database
 */
class MissingPdfImportOutcomeTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->setContentLang( 'en' );
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		MigrationState::markComplete( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage',
			'comment', 'change_tag', 'change_tag_def' ] as $table ) {
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

	private function upload( ?string $title = null, string $asset = 'test-multipage.pdf',
		string $timestamp = '20260906120000'
	): \MediaWiki\FileRepo\File\LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			$title ?? 'File:EmptyPdf-' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( __DIR__ . '/../../fixtures/assets/' . $asset,
			'Isolated PDF preparation', 'Fixture only', 0, false, $timestamp,
			$this->getTestSysop()->getUser() )->isOK() );
		return $file;
	}

	private function fixture( int $pageNumber = 2, bool $slot = false,
		string $selector = 'ABC'
	): array {
		$file = $this->upload();
		$embed = '[[' . $file->getTitle()->getPrefixedDBkey() . '|page=' . $pageNumber .
			'|layerset=' . $selector . '|Plain caption]]';
		$prefix = "Préface π\n";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		if ( $slot ) {
			$document = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$revision, $document, 'Preserved native sibling' );
		}
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
		return [ 'file' => $file, 'page' => $page, 'revision' => $revision, 'start' => strlen( $prefix ),
			'expected' => $embed, 'main' => $stored->getContent( 'main' )->serialize(),
			'base' => $slot ? $stored->getContent( 'layers' )->serialize() : null,
			'pilot' => new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] ) ];
	}

	private function service( array $f, ?SourceRenditions $renditions = null,
		?SourceVersionResolver $sources = null
	): PageMissingPdfSetPreparation {
		$services = $this->getServiceContainer();
		$lookup = $services->getRevisionLookup();
		$access = new PageHistoryAccess( $lookup );
		$nativeSources = new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
			$services->getTitleFactory() );
		$renditions ??= new SourceRenditions( $services->getUrlUtils() );
		return new PageMissingPdfSetPreparation( $f['pilot'],
			new PageOwnedIdentityResolver( $services->getTitleFactory(), $lookup, $access ), $lookup,
			new PageReadService( $access, $nativeSources ), $sources ?? $nativeSources,
			new NewPageDrawing( $nativeSources, $renditions, $services->getRepoGroup()->getLocalRepo(),
				$services->getTitleFactory(), [] ), $renditions );
	}

	private function sourceFixture( array $target, array $pages = [ 2, 1 ], string $label = 'ABC',
		?string $fileTitle = null
	): array {
		$page = $this->getExistingTestPage();
		$surfaces = [];
		foreach ( $pages as $number ) {
			$surface = $target['pilot']->prepareBoundEditor( $target['page']->getId(), $target['revision'],
				$target['start'], $target['expected'], $this->actor )['pageOwned']['newSurface'];
			$surface['id'] = 'source-' . $number;
			$surface['source']['page'] = $number;
			$surface['label'] = $label;
			if ( $fileTitle !== null ) {
				$surface['source']['fileTitle'] = $fileTitle;
			}
			$surface['layers'] = [ [ 'id' => 'text-' . $number, 'type' => 'text',
				'text' => 'Source page ' . $number, 'x' => 17, 'y' => 23 ] ];
			$surfaces[] = $surface;
		}
		$text = JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] );
		$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
			$page->getLatest(), $text, 'Isolated Import source' );
		return [ 'page' => $page, 'revision' => $revision, 'anchor' => $surfaces[0]['id'],
			'text' => $text, 'surfaces' => $surfaces ];
	}

	private function importReader(
		?SourceRenditions $renditions = null
	): PageWorkingCopyPdfImportReadService {
		$services = $this->getServiceContainer();
		$access = new PageHistoryAccess( $services->getRevisionLookup() );
		$repo = $services->getRepoGroup()->getLocalRepo();
		$sources = new SourceVersionResolver( $repo, $services->getTitleFactory() );
		$renditions ??= new SourceRenditions( $services->getUrlUtils() );
		return new PageWorkingCopyPdfImportReadService( new PageOwnedIdentityResolver(
			$services->getTitleFactory(), $services->getRevisionLookup(), $access ),
			$services->getTitleFactory(), PageOwnedScope::newFromServices( $services, [], [ NS_MAIN ] ),
			$access, $sources, $renditions,
			new NewPageDrawing( $sources, $renditions, $repo, $services->getTitleFactory(), [] ) );
	}

	private function publication( array $f,
		?PagePublicationService $publisher = null
	): PageMissingPdfImportPublicationService {
		$s = $this->getServiceContainer();
		$access = new PageHistoryAccess( $s->getRevisionLookup() );
		return new PageMissingPdfImportPublicationService(
			new PageMissingPdfImportPreparation( $this->service( $f ), $this->importReader() ),
			$publisher ?? $this->registration['publisher'],
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $s->getRevisionLookup(), $access ),
			$s->getTitleFactory(), PageOwnedScope::newFromServices( $s, [], [ NS_MAIN ] ),
			$s->getRevisionLookup(), $access,
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ),
			$s->getConnectionProvider() );
	}

	private function descriptor( array $source, ?string $anchor = null ): array {
		return [ 'sourcePageId' => $source['page']->getId(), 'sourceRevisionId' => $source['revision'],
			'sourceSurfaceId' => $anchor ?? $source['anchor'] ];
	}

	private function proposed( array $f, array $source ): array {
		$selected = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$document = $f['base'] === null ? [ 'schemaVersion' => 1, 'surfaces' => [] ] :
			json_decode( $f['base'], true );
		foreach ( [ 1, 2 ] as $number ) {
			$surface = $selected;
			$surface['id'] = NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'],
				$selected['label'], $selected['source']['fileTitle'], $number );
			$surface['source']['page'] = $number;
			$surface['canvas']['width'] = $f['file']->getWidth( $number );
			$surface['canvas']['height'] = $f['file']->getHeight( $number );
			$surface['layers'] = [];
			foreach ( $source['surfaces'] as $member ) {
				if ( $member['source']['page'] === $number ) {
					$surface['layers'] = $member['layers'];
					$surface['readingOrder'] = array_column( $member['layers'], 'id' );
				}
			}
			$document['surfaces'][] = $surface;
		}
		return $document;
	}

	private function outcome( array $f, ?SourceVersionResolver $sources = null,
		?PageWorkingCopyPdfImportReadService $reader = null
	): PageMissingPdfImportOutcomeReadService {
		$s = $this->getServiceContainer();
		$lookup = $s->getRevisionLookup();
		$access = new PageHistoryAccess( $lookup );
		$sources ??= new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() );
		return new PageMissingPdfImportOutcomeReadService( $f['pilot'],
			new PageOwnedIdentityResolver( $s->getTitleFactory(), $lookup, $access ), $s->getTitleFactory(),
			$lookup, $access, $reader ?? $this->importReader(), $sources );
	}

	private function confirm( array $f, string $json, array $descriptors, string $note = '',
		?Authority $authority = null
	): int {
		return $this->outcome( $f )->confirm( $f['page']->getId(), $f['revision'],
			$f['page']->getTitle()->getPrefixedDBkey(), $f['start'], $f['expected'], $json, $descriptors,
			$authority ?? $this->actor, $note );
	}

	private function summary( array $source, string $note = '' ): string {
		$item = wfMessage( 'layers-copy-summary' )->plaintextParams( 'ABC' )
			->params( $source['page']->getTitle()->getPrefixedText(), (string)$source['revision'] )
			->inContentLanguage()->text();
		return trim( $note ) === '' ? $item : $item .
			wfMessage( 'colon-separator' )->inContentLanguage()->text() . trim( $note );
	}

	private function publish( array $f, string $json, array $descriptors, string $note = '' ): int {
		return $this->publication( $f )->publish( $f['page']->getId(), $f['revision'], $f['start'],
			$f['expected'], $json, $descriptors, $this->actor, $note );
	}

	private function unavailable( callable $operation ): void {
		try {
			$operation();
			$this->fail( 'An unproven import outcome must not be confirmed' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-working-copy-import-unavailable', $error->getMessage() );
		}
	}

	public static function provideSiblingSlotStates(): array {
		return [ 'without existing layers slot' => [ false ], 'with existing layers slot' => [ true ] ];
	}

	/** @dataProvider provideSiblingSlotStates */
	public function testConfirmsExactNativeSuccessorWithoutWriting( bool $hasSiblingSlot ): void {
		$f = $this->fixture( 2, $hasSiblingSlot );
		$source = $this->sourceFixture( $f );
		$document = $this->proposed( $f, $source );
		$json = JsonSnapshotCodec::encode( $document );
		$descriptors = [ $this->descriptor( $source ) ];
		$note = ' Confirm this exact Save ';
		$revisionId = $this->publication( $f )->publish( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $json, $descriptors, $this->actor, $note );
		$this->runDeferredUpdates();
		$before = $this->witness();

		$this->assertSame( $revisionId, $this->confirm( $f, $json, $descriptors, $note ) );
		$this->assertSame( $before, $this->witness(), 'Confirmation is read-only across native rows' );
	}

	public function testDoesNotConfirmWhenNoSuccessorWasPublished(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$this->runDeferredUpdates();
		$before = $this->witness();

		$this->unavailable( fn () => $this->confirm( $f, $json, $descriptors ) );
		$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
	}

	public function testSubmittedJsonBytesArePartOfConfirmationIdentity(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$this->publish( $f, $json, $descriptors );
		$this->runDeferredUpdates();
		$before = $this->witness();

		$this->unavailable( fn () => $this->confirm( $f, "\n" . $json, $descriptors ) );
		$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
	}

	public function testNoteBytesArePartOfConfirmationIdentity(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$this->publish( $f, $json, $descriptors, 'Original note' );
		$this->runDeferredUpdates();
		$before = $this->witness();

		$this->unavailable( fn () => $this->confirm( $f, $json, $descriptors, 'Changed note' ) );
		$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
	}

	public function testOrderedSourceDescriptorsArePartOfConfirmationIdentity(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$first = $this->descriptor( $source, 'source-2' );
		$second = $this->descriptor( $source, 'source-1' );
		$this->publish( $f, $json, [ $first, $second ] );
		$this->runDeferredUpdates();
		$before = $this->witness();

		$this->unavailable( fn () => $this->confirm( $f, $json, [ $second, $first ] ) );
		$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
	}

	public function testDoesNotConfirmSameSnapshotWithoutExactReceipt(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor, $f['revision'],
			$json, $this->summary( $source ), null, $f['page']->getId() );
		$this->runDeferredUpdates();
		$before = $this->witness();

		$this->unavailable( fn () => $this->confirm( $f, $json, $descriptors ) );
		$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
	}

	public function testDoesNotConfirmWhenReceiptNamesAnotherOwner(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$document = $this->proposed( $f, $source );
		$json = JsonSnapshotCodec::encode( $document );
		$descriptors = [ $this->descriptor( $source ) ];
		$note = 'Exact copy note';
		$wrongReceipt = MissingPdfImportReceipt::newCommentData( $f['page']->getId() + 1,
			$f['revision'], $f['start'], $f['expected'], $json, $descriptors, $note );
		$this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor, $f['revision'],
			$json, $this->summary( $source, $note ), null, $f['page']->getId(), null, null, $wrongReceipt );
		$this->runDeferredUpdates();
		$before = $this->witness();

		$this->unavailable( fn () => $this->confirm( $f, $json, $descriptors, $note ) );
		$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
	}

	public function testDoesNotConfirmAfterAnotherRevisionBecomesCurrent(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$publishedId = $this->publication( $f )->publish( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $json, $descriptors, $this->actor );
		$this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$publishedId, file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'Later ordinary publication' );
		$this->runDeferredUpdates();
		$before = $this->witness();

		$this->unavailable( fn () => $this->confirm( $f, $json, $descriptors ) );
		$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
	}

	public function testDoesNotConfirmWhenTargetCommentIsHidden(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$revisionId = $this->publish( $f, $json, $descriptors );
		$this->runDeferredUpdates();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_COMMENT ] )
			->where( [ 'rev_id' => $revisionId ] )->caller( __METHOD__ )->execute();
		$before = $this->witness();

		try {
			$this->unavailable( fn () => $this->confirm( $f, $json, $descriptors ) );
			$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
		} finally {
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
				->where( [ 'rev_id' => $revisionId ] )->caller( __METHOD__ )->execute();
		}
	}

	public function testDoesNotConfirmWhenSourceTextIsHidden(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$this->publish( $f, $json, $descriptors );
		$this->runDeferredUpdates();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $source['revision'] ] )->caller( __METHOD__ )->execute();
		$before = $this->witness();

		try {
			$this->unavailable( fn () => $this->confirm( $f, $json, $descriptors ) );
			$this->assertSame( $before, $this->witness(), 'Failed confirmation is read-only' );
		} finally {
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
				->where( [ 'rev_id' => $source['revision'] ] )->caller( __METHOD__ )->execute();
		}
	}

	public function testReadAndEditPermissionsAreRequiredWithoutNativeWrites(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$this->publish( $f, $json, $descriptors );
		$this->runDeferredUpdates();
		$before = $this->witness();

		$groups = $this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' );
		$groups['*']['read'] = false;
		$groups['user']['read'] = false;
		$this->overrideConfigValue( 'GroupPermissions', $groups );
		foreach ( [ [ 'read' ], [ 'edit', 'editlayers' ] ] as $permissions ) {
			$user = $this->getTestUser()->getUser();
			$user->clearInstanceCache();
			$this->overrideUserPermissions( $user, $permissions );
			$this->assertFalse( $user->isAllowed( in_array( 'read', $permissions, true ) ? 'editlayers' : 'read' ),
				'The fixture authority must actually lack its missing right' );
			$this->unavailable( fn () => $this->confirm( $f, $json, $descriptors, '', $user ) );
			$this->assertSame( $before, $this->witness(), 'Denied confirmation is read-only' );
		}
	}

	public function testFreshSourceReadRefusesVisibilityChangeDuringFinalTargetFileChecks(): void {
		$f = $this->fixture();
		$source = $this->sourceFixture( $f );
		$json = JsonSnapshotCodec::encode( $this->proposed( $f, $source ) );
		$descriptors = [ $this->descriptor( $source ) ];
		$this->publish( $f, $json, $descriptors );
		$this->runDeferredUpdates();
		$before = $this->witness();
		$services = $this->getServiceContainer();
		$realSources = new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(),
			$services->getTitleFactory() );
		$state = (object)[ 'targetResolutions' => 0, 'sourceReads' => 0, 'unavailable' => false ];
		$targetSources = $this->createMock( SourceVersionResolver::class );
		$targetSources->method( 'resolve' )->willReturnCallback(
			static function ( ...$args ) use ( $realSources, $state ): array {
				$result = $realSources->resolve( ...$args );
				if ( ++$state->targetResolutions === 4 ) {
					$state->unavailable = true;
				}
				return $result;
			} );
		$realReader = $this->importReader();
		$reader = $this->createMock( PageWorkingCopyPdfImportReadService::class );
		$reader->method( 'readSource' )->willReturnCallback(
			static function ( ...$args ) use ( $realReader, $state ): array {
				$state->sourceReads++;
				if ( $state->unavailable ) {
					throw new \DomainException( 'layers-working-copy-import-unavailable' );
				}
				return $realReader->readSource( ...$args );
			} );
		$service = $this->outcome( $f, $targetSources, $reader );

		$this->unavailable( fn () => $service->confirm( $f['page']->getId(), $f['revision'],
			$f['page']->getTitle()->getPrefixedDBkey(), $f['start'], $f['expected'], $json,
			$descriptors, $this->actor ) );
		$this->assertSame( 4, $state->targetResolutions );
		$this->assertSame( 4, $state->sourceReads, 'Each capture is followed by a fresh source read' );
		$this->assertSame( $before, $this->witness(), 'Refusal is read-only' );
	}
}
