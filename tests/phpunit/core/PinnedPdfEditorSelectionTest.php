<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\FileRepo\File\File;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/LegacyMigrationFixtures.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Native editor selection uses the saved PDF version's page bounds.
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 * @group API
 */
class PinnedPdfEditorSelectionTest extends \MediaWiki\Tests\Api\ApiTestCase {

	use LegacyMigrationFixtures;
	use IsolatedLocalRepoFixture;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setUpMigration();
	}

	private function surface( $file, int $page ): array {
		return [ 'id' => 'saved-' . $page, 'label' => 'ABC', 'kind' => 'pdf',
			'canvas' => [ 'width' => $file->getWidth( $page ), 'height' => $file->getHeight( $page ),
				'backgroundColor' => '#ffffff', 'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 3, 'y' => 5,
				'text' => 'Original page ' . $page ] ],
			'source' => [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
				'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => $page ] ];
	}

	private function publish( Title $title, int $base, array $surfaces, string $main ): int {
		return $this->doApiRequestWithToken( [ 'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(), 'baserevid' => $base, 'maintext' => $main,
			'data' => json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) ],
			null, $this->actor )[0]['layerspublish']['revid'];
	}

	private function witness( Title $title ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$title, 0, IDBAccessObject::READ_LATEST );
		return [ 'revision' => $revision->getId(), 'main' => $revision->getContent( 'main' )->serialize(),
			'layers' => $revision->hasSlot( 'layers' ) ? $revision->getContent( 'layers' )->serialize() : null ];
	}

	/**
	 * @dataProvider providePinnedSelections
	 * @param int[] $members
	 * @param string $option
	 * @param int $expected
	 * @param bool $replacement
	 * @param string $original
	 * @param string $language
	 */
	public function testNativeEditorUsesExactPinnedPage( array $members, string $option, int $expected,
		bool $replacement = true, string $original = 'test-multipage.pdf', string $language = 'en'
	): void {
		$file = $this->upload( 'Pinned_editor_' . wfRandomString() . '.pdf', $original );
		$originalCount = $file->pageCount();
		$surfaces = array_map( fn ( int $page ): array => $this->surface( $file, $page ), $members );
		$owner = $this->getExistingTestPage();
		$id = $owner->getId();
		$embed = "[[File:{$file->getName()}|$option|layerset=$id:abc]]";
		$main = $embed . "\n" . $embed;
		$base = $this->publish( $owner->getTitle(), $owner->getLatest(), $surfaces, $main );
		if ( $replacement ) {
			$this->upload( $file->getName(), $original === 'test-multipage.pdf' ?
				'test-multipage-replacement.pdf' : 'test-multipage.pdf', '20261001000000' );
		}
		$this->setContentLang( $language );
		$before = $this->witness( $owner->getTitle() );
		foreach ( [ 0, strlen( $embed ) + 1 ] as $start ) {
			$init = $this->pilot->prepareBoundEditor( $id, $base, $start, $embed, $this->actor );
			if ( in_array( $expected, $members, true ) ) {
				$this->assertSame( 'saved-' . $expected, $init['pageOwned']['surfaceId'] );
				$this->assertArrayNotHasKey( 'newSurface', $init['pageOwned'] );
				$context = $init['pageOwned']['pdfContext'];
				$this->assertSame( $expected, $context['page'] );
				$this->assertSame( $expected, $context['initialPage'] );
				$this->assertSame( $originalCount, $context['pageCount'] );
				$this->assertTrue( $context['stored'] );
				$selected = $context['surface'];
				$this->assertSame( 'Original page ' . $expected, $selected['layers'][0]['text'] );
			} else {
				$selected = $init['pageOwned']['newSurface'];
				$this->assertSame( [], $selected['layers'] );
			}
			$this->assertSame( $expected, $selected['source']['page'] );
			$this->assertSame( 'ABC', $selected['label'] );
			$this->assertSame( $surfaces[0]['source']['timestamp'], $selected['source']['timestamp'] );
			$this->assertSame( $surfaces[0]['source']['sha1'], $selected['source']['sha1'] );
			$this->assertSame( $surfaces[0]['source']['fileTitle'], $selected['source']['fileTitle'] );
			$this->assertStringContainsString( 'page' . $expected . '-', $init['imageUrl'] );
		}
		$entries = $this->pilot->listBoundEditorSelections( $id, $base, $this->actor );
		$this->assertCount( 1, $entries );
		$this->assertSame( !in_array( $expected, $members, true ), $entries[0]['create'] ?? false );
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
	}

	public static function providePinnedSelections(): array {
		return [
			'English space, missing page 2' => [ [ 1 ], 'page 2', 2 ],
			'English equals, missing page 2' => [ [ 1 ], 'page=2', 2 ],
			'stored page 2' => [ [ 1, 2 ], 'page=2', 2 ],
			'sparse page 2' => [ [ 2 ], 'page=2', 2 ],
			'page 1 unaffected' => [ [ 1 ], 'page=1', 1 ],
			'last option wins' => [ [ 1, 2 ], 'page=2|page 1', 1 ],
			'pinned upper bound' => [ [ 1, 2 ], 'page=3', 2 ],
			'unchanged source upper bound' => [ [ 1, 2 ], 'page=3', 2, false ],
			'unchanged source missing page' => [ [ 1 ], 'page=2', 2, false ],
			'longer replacement keeps original bound' =>
				[ [ 1 ], 'page=2', 1, true, 'test-multipage-replacement.pdf' ],
			'German space spelling' => [ [ 1 ], 'seite 2', 2, true, 'test-multipage.pdf', 'de' ],
			'German equals spelling' => [ [ 1, 2 ], 'seite=2', 2, true, 'test-multipage.pdf', 'de' ]
		];
	}

	public function testMissingSetStillUsesCurrentNativeBounds(): void {
		$file = $this->upload( 'New_editor_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$owner = $this->getExistingTestPage();
		$id = $owner->getId();
		$embed = "[[File:{$file->getName()}|page=3|layerset=$id:ABC]]";
		$base = $this->editPage( $owner, $embed )->getNewRevision()->getId();
		$before = $this->witness( $owner->getTitle() );
		$init = $this->pilot->prepareBoundEditor( $id, $base, 0, $embed, $this->actor );
		$this->assertSame( 2, $init['pageOwned']['newSurface']['source']['page'] );
		$this->assertSame( $file->getSha1(), $init['pageOwned']['newSurface']['source']['sha1'] );
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
	}

	public function testOtherFileAndOwnerCannotRedirectSelection(): void {
		$a = $this->upload( 'Independent_A_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$b = $this->upload( 'Independent_B_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$owner = $this->getExistingTestPage();
		$foreign = $this->getExistingTestPage();
		$id = $owner->getId();
		$a1 = $this->surface( $a, 1 );
		$b2 = $this->surface( $b, 2 );
		$b2['id'] = 'other-file';
		$foreign2 = $this->surface( $a, 2 );
		$foreign2['id'] = 'foreign-page';
		$this->publish( $foreign->getTitle(), $foreign->getLatest(), [ $foreign2 ], 'Foreign owner' );
		$embed = "[[File:{$a->getName()}|page=2|layerset=$id:ABC]]";
		$foreignEmbed = "[[File:{$a->getName()}|page=2|layerset={$foreign->getId()}:ABC]]";
		$base = $this->publish( $owner->getTitle(), $owner->getLatest(), [ $a1, $b2 ],
			$embed . "\n" . $foreignEmbed );
		$this->upload( $a->getName(), 'test-multipage-replacement.pdf', '20261001000000' );
		$before = $this->witness( $owner->getTitle() );
		$foreignBefore = $this->witness( $foreign->getTitle() );
		$init = $this->pilot->prepareBoundEditor( $id, $base, 0, $embed, $this->actor );
		$this->assertSame( 2, $init['pageOwned']['newSurface']['source']['page'] );
		$this->assertSame( $a1['source']['sha1'], $init['pageOwned']['newSurface']['source']['sha1'] );
		$this->assertSame( $a1['source']['fileTitle'], $init['pageOwned']['newSurface']['source']['fileTitle'] );
		try {
			$this->pilot->prepareBoundEditor( $id, $base, strlen( $embed ) + 1, $foreignEmbed, $this->actor );
			$this->fail( 'Another owner must not be admitted' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-editor-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
		$this->assertSame( $foreignBefore, $this->witness( $foreign->getTitle() ) );
	}

	public function testSuppressedSavedSourceRefusesWithoutCurrentFallback(): void {
		$file = $this->upload( 'Hidden_pin_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$surface = $this->surface( $file, 1 );
		$owner = $this->getExistingTestPage();
		$id = $owner->getId();
		$embed = "[[File:{$file->getName()}|page=2|layerset=$id:ABC]]";
		$base = $this->publish( $owner->getTitle(), $owner->getLatest(), [ $surface ], $embed );
		$this->upload( $file->getName(), 'test-multipage-replacement.pdf', '20261001000000' );
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
			->set( [ 'oi_deleted' => File::DELETED_FILE ] )
			->where( [ 'oi_name' => $file->getName(), 'oi_timestamp' => $surface['source']['timestamp'] ] )
			->caller( __METHOD__ )->execute();
		$file->purgeCache();
		$before = $this->witness( $owner->getTitle() );
		try {
			$this->pilot->prepareBoundEditor( $id, $base, 0, $embed, $this->actor );
			$this->fail( 'An unavailable saved source must not select the current upload' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-editor-unavailable', $error->getMessage() );
		}
		$this->assertSame( [], $this->pilot->listBoundEditorSelections( $id, $base, $this->actor ) );
		$this->assertSame( $before, $this->witness( $owner->getTitle() ) );
	}
}
