<?php

declare( strict_types=1 );
/**
 * Maintenance script: move shared layer sets and slides into page history (charter decision D3).
 *
 * @file
 * @ingroup Maintenance
 * @license GPL-2.0-or-later
 */

// @codeCoverageIgnoreStart
$IP = getenv( 'MW_INSTALL_PATH' );
if ( $IP === false ) {
	$IP = __DIR__ . '/../../..';
}
require_once "$IP/maintenance/Maintenance.php";
// @codeCoverageIgnoreEnd

use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Migration\MigrationUndo;
use MediaWiki\Extension\Layers\Migration\PageCopyMigration;
use MediaWiki\Extension\Layers\Migration\SlidePageMigration;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\Permissions\Authority;
use MediaWiki\Permissions\UltimateAuthority;
use MediaWiki\User\User;

/**
 * Without --commit nothing is written and every planned change is listed. A rerun continues where an
 * interrupted one stopped, because moved drawings are recognised by their IDs. layer_sets is only read.
 */
class MigrateLayersToPageHistory extends Maintenance {
	/** System account that makes the edits unless --user names another. */
	private const DEFAULT_USER = 'Layers migration';

	private int $failures = 0;
	/** @var (string|null)[] Documents step 1 would write, by file name, for planning step 2 in a dry run */
	private array $pending = [];
	/** @var true[] Shared slides some page showed, by name, as step 2 found them */
	private array $shownSlides = [];

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Move shared Layers sets and slides into page history. Lists the changes ' .
			'without making them unless --commit is given.' );
		$this->addOption( 'commit', 'Make the edits' );
		$this->addOption( 'user', 'Account that makes the edits; default: the "' . self::DEFAULT_USER .
			'" system user', false, true );
		$this->addOption( 'file', 'Only move this file\'s sets to its File: page (name without "File:")', false, true );
		$this->addOption( 'page', 'Only give this page copies of the sets and slides it shows', false, true );
		$this->addOption( 'slide', 'Only give this shared slide a page, if no page shows it', false, true );
		$this->addOption( 'undo', 'Undo the migration\'s edits on pages nobody has edited since; with --file, ' .
			'--page or --slide, on that page only' );
		$this->setBatchSize( 100 );
		$this->requireExtension( 'Layers' );
	}

	/** @inheritDoc */
	public function execute() {
		$commit = $this->hasOption( 'commit' );
		$user = $commit ? $this->actor() : $this->planner();
		$this->output( $commit ? "Migrating.\n" : "Dry run: nothing is written. Add --commit to make these edits.\n" );
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$scoped = $this->hasOption( 'file' ) || $this->hasOption( 'page' ) || $this->hasOption( 'slide' );
		if ( $this->hasOption( 'undo' ) ) {
			$this->undo( $pilot->newMigrationUndo(), $user, $commit, $scoped );
			return true;
		}
		if ( !$scoped || $this->hasOption( 'file' ) ) {
			$this->output( "Step 1: shared sets onto their File: pages.\n" );
			$migration = $pilot->newFilePageMigration();
			foreach ( $this->files() as $name ) {
				$this->migrateFile( $migration, $name, $user, $commit );
			}
		}
		if ( !$scoped || $this->hasOption( 'page' ) ) {
			$this->output( "Step 2: copies for the pages that show shared sets and slides.\n" );
			$migration = $pilot->newPageCopyMigration();
			foreach ( $this->pages( $pilot->getScope() ) as $pageId ) {
				$this->migratePage( $migration, $pageId, $user, $commit );
			}
		}
		if ( !$scoped || $this->hasOption( 'slide' ) ) {
			$this->output( "Step 3: pages for shared slides that no page shows.\n" );
			$this->migrateUnshownSlides( $pilot->newSlidePageMigration(), $pilot->newPageCopyMigration(), $user,
				$commit );
		}
		if ( $this->failures > 0 ) {
			$this->fatalError( $this->failures . " edit(s) failed; run the script again to retry them." );
		}
		if ( $commit && !$scoped ) {
			MigrationState::markComplete( $this->getPrimaryDB() );
			$this->output( "Migration recorded as complete: bare set and slide names now mean each page's own " .
				"drawings.\n" );
			$this->purgePagesShowingSets();
		}
		return true;
	}

	/**
	 * Renders cached before this version of Layers do not vary on the migration, so the pages whose
	 * bare names change meaning are purged.
	 */
	private function purgePagesShowingSets(): void {
		$ids = $this->getReplicaDB()->newSelectQueryBuilder()->select( 'pp_page' )->from( 'page_props' )
			->where( [ 'pp_propname' => ShownLayerSets::PROPERTY ] )->caller( __METHOD__ )->fetchFieldValues();
		$pages = $this->getServiceContainer()->getWikiPageFactory();
		foreach ( $ids as $id ) {
			$page = $pages->newFromID( (int)$id );
			if ( $page ) {
				$page->doPurge();
			}
		}
		$this->output( 'Purged ' . count( $ids ) . " page(s) that showed shared sets.\n" );
	}

	/**
	 * @param MigrationUndo $undo
	 * @param Authority $user
	 * @param bool $commit
	 * @param bool $scoped
	 */
	private function undo( MigrationUndo $undo, Authority $user, bool $commit, bool $scoped ): void {
		$titles = $this->getServiceContainer()->getTitleFactory();
		if ( $scoped ) {
			$title = $this->hasOption( 'file' ) ?
				$titles->makeTitleSafe( NS_FILE, (string)$this->getOption( 'file' ) ) :
				$titles->newFromText( $this->hasOption( 'page' ) ? (string)$this->getOption( 'page' ) :
					'Slide:' . $this->getOption( 'slide' ) );
			$pageIds = $title && $title->exists() ? [ $title->getArticleID() ] : [];
		} else {
			$pageIds = $undo->pages();
		}
		foreach ( $pageIds as $pageId ) {
			$plan = $undo->plan( $pageId );
			$page = $plan['title'] ? $plan['title']->getPrefixedText() : "page $pageId";
			if ( $plan['problem'] !== null ) {
				$this->output( "$page: not undone ({$plan['problem']})\n" );
				continue;
			}
			$revisions = implode( ', ', array_reverse( $plan['revisions'] ) );
			$this->output( $plan['baseRevisionId'] === 0 ?
				"$page: delete; the migration created it (revisions $revisions)\n" :
				"$page: undo revisions $revisions, back to revision {$plan['baseRevisionId']}\n" );
			if ( !$commit ) {
				continue;
			}
			try {
				$revision = $undo->commit( $plan, $user );
				$this->output( $revision ? "$page: saved revision $revision\n" : "$page: deleted\n" );
			} catch ( PublicationException $e ) {
				$this->failures++;
				$this->error( "$page: not undone (" . $e->getMessage() . ")" );
			}
		}
		if ( $this->failures > 0 ) {
			$this->fatalError( $this->failures . " page(s) could not be undone; run the script again to retry them." );
		}
		if ( $commit && !$scoped ) {
			MigrationState::clear( $this->getPrimaryDB() );
			$this->output( "Migration record removed: bare set and slide names mean shared sets again.\n" );
			$this->purgePagesShowingSets();
		}
	}

	/**
	 * @param SlidePageMigration $slides
	 * @param PageCopyMigration $copies
	 * @param Authority $user
	 * @param bool $commit
	 */
	private function migrateUnshownSlides( SlidePageMigration $slides, PageCopyMigration $copies, Authority $user,
		bool $commit
	): void {
		$all = $this->hasOption( 'slide' ) ?
			[ str_replace( ' ', '_', trim( (string)$this->getOption( 'slide' ) ) ) ] : $slides->listSlides();
		if ( $this->hasOption( 'slide' ) ) {
			// Step 2 did not run, so read every page to learn which slides are shown; page properties can be stale.
			$scope = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' )->getScope();
			foreach ( $this->pages( $scope ) as $pageId ) {
				foreach ( $copies->plan( $pageId, $user )['slides'] as $shown ) {
					$this->shownSlides[$shown] = true;
				}
			}
		}
		$copied = $slides->copiedSlides( $all );
		foreach ( $all as $slide ) {
			if ( isset( $this->shownSlides[$slide] ) || isset( $copied[$slide] ) ||
				( $this->hasOption( 'slide' ) && $slides->shownByPageProperties( $slide ) )
			) {
				if ( $this->hasOption( 'slide' ) ) {
					$this->output( "Slide \"$slide\": a page shows it or has a copy; nothing to create\n" );
				}
				continue;
			}
			$plan = $slides->plan( $slide );
			$page = $plan['title'] ? $plan['title']->getPrefixedText() : "Slide $slide";
			if ( $plan['problem'] !== null ) {
				$this->output( "$page: not created for slide \"$slide\" ({$plan['problem']})\n" );
				continue;
			}
			$this->output( "$page: create, showing slide \"$slide\" set(s) " . implode( ', ', $plan['sets'] ) . "\n" );
			if ( !$commit ) {
				continue;
			}
			try {
				$pageId = $slides->commit( $plan, $user );
			} catch ( PublicationException $e ) {
				$this->failures++;
				$this->error( "$page: not created (" . $e->getMessage() . ")" );
				continue;
			}
			if ( $pageId ) {
				$this->migratePage( $copies, $pageId, $user, true );
			}
		}
	}

	/**
	 * @param PageCopyMigration $migration
	 * @param int $pageId
	 * @param Authority $user
	 * @param bool $commit
	 */
	private function migratePage( PageCopyMigration $migration, int $pageId, Authority $user, bool $commit ): void {
		$plan = $migration->plan( $pageId, $user,
			$commit ? null : fn ( string $file ): ?string => $this->pendingFor( $file, $user ) );
		foreach ( $plan['slides'] as $slide ) {
			$this->shownSlides[$slide] = true;
		}
		$page = $plan['title'] ? $plan['title']->getPrefixedText() : "page $pageId";
		if ( $plan['problem'] !== null ) {
			$this->output( "$page: not changed ({$plan['problem']})\n" );
			return;
		}
		foreach ( $plan['done'] as $name ) {
			$this->output( "$page: already has \"$name\"\n" );
		}
		foreach ( $plan['notMoved'] as $skip ) {
			$this->output( "$page: {$skip['what']} not copied ({$skip['reason']})\n" );
		}
		foreach ( $plan['copies'] as $copy ) {
			$from = $copy['kind'] === 'slide' ? "slide \"{$copy['source']}\"" : $copy['source'] .
				( $copy['sourceRevision'] ? " (revision {$copy['sourceRevision']})" : ' (after step 1)' );
			$this->output( "$page: copy \"{$copy['name']}\" from $from, " . ( $copy['template'] ?
				'shown through a template' : "named by {$copy['embeds']} embed(s)" ) . "\n" );
		}
		if ( $plan['main'] !== null && !$plan['copies'] ) {
			$this->output( "$page: point embeds at its own drawings\n" );
		}
		if ( !$commit || $plan['document'] === null ) {
			return;
		}
		try {
			$revision = $migration->commit( $plan, $user );
			$this->output( "$page: saved revision $revision\n" );
		} catch ( PublicationException $e ) {
			$this->failures++;
			$this->error( "$page: not saved (" . $e->getMessage() . ")" );
		}
	}

	/**
	 * What step 1 would write for a file, planned once, so a dry run of step 2 alone is still complete.
	 * @param string $file
	 * @param Authority $user
	 * @return string|null
	 */
	private function pendingFor( string $file, Authority $user ): ?string {
		if ( !array_key_exists( $file, $this->pending ) ) {
			$plan = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' )->newFilePageMigration()
				->plan( $file, $user );
			$this->pending[$file] = $plan['problem'] === null ? $plan['document'] : null;
		}
		return $this->pending[$file];
	}

	/**
	 * Pages in the drawing namespaces, then pages elsewhere that showed shared sets when last parsed.
	 * @param PageOwnedScope $scope
	 * @return iterable<int>
	 */
	private function pages( PageOwnedScope $scope ): iterable {
		if ( $this->hasOption( 'page' ) ) {
			$title = $this->getServiceContainer()->getTitleFactory()->newFromText( (string)$this->getOption( 'page' ) );
			if ( !$title || !$title->exists() ) {
				$this->fatalError( 'No such page: ' . $this->getOption( 'page' ) );
			}
			yield $title->getArticleID();
			return;
		}
		$namespaces = PageOwnedScope::configuredNamespaces( $this->getConfig() );
		$db = $this->getReplicaDB();
		foreach ( [ true, false ] as $inScope ) {
			$last = 0;
			do {
				$query = $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
					->where( $db->expr( 'page_id', '>', $last ) )->orderBy( 'page_id' )->limit( $this->getBatchSize() );
				if ( $inScope ) {
					$query->where( [ 'page_namespace' => $namespaces ?: [ -1 ] ] );
				} else {
					$query->join( 'page_props', null, 'pp_page = page_id' )
						->where( [ 'pp_propname' => ShownLayerSets::PROPERTY ] );
					if ( $namespaces ) {
						$query->where( $db->expr( 'page_namespace', '!=', $namespaces ) );
					}
				}
				$ids = $query->caller( __METHOD__ )->fetchFieldValues();
				foreach ( $ids as $id ) {
					$last = (int)$id;
					yield $last;
				}
			} while ( count( $ids ) === $this->getBatchSize() );
		}
	}

	/**
	 * @param FilePageMigration $migration
	 * @param string $name
	 * @param Authority $user
	 * @param bool $commit
	 */
	private function migrateFile( FilePageMigration $migration, string $name, Authority $user, bool $commit ): void {
		$plan = $migration->plan( $name, $user );
		$page = $plan['title'] ? $plan['title']->getPrefixedText() : $name;
		if ( $plan['problem'] !== null ) {
			$this->output( "$page: not moved ({$plan['problem']})\n" );
			return;
		}
		foreach ( $plan['done'] as $done ) {
			$this->output( "$page: already has set \"{$done['set']}\" page {$done['page']}\n" );
		}
		foreach ( $plan['notMoved'] as $skip ) {
			$this->output( "$page: set \"{$skip['set']}\" page {$skip['page']} not moved ({$skip['reason']})\n" );
		}
		foreach ( $plan['add'] as $add ) {
			$this->output( "$page: add drawing \"{$add['name']}\" from set \"{$add['set']}\" page {$add['page']} " .
				"(layer_sets row {$add['legacyId']})\n" );
		}
		if ( !$commit || !$plan['add'] ) {
			$this->pending[$name] = $plan['problem'] === null ? $plan['document'] : null;
			return;
		}
		try {
			$revision = $migration->commit( $plan, $user );
			$this->output( "$page: saved revision $revision\n" );
		} catch ( PublicationException $e ) {
			$this->failures++;
			$this->error( "$page: not saved (" . $e->getMessage() . ")" );
		}
	}

	/**
	 * @return iterable<string> Files that have shared sets, in name order
	 */
	private function files(): iterable {
		if ( $this->hasOption( 'file' ) ) {
			yield str_replace( ' ', '_', trim( (string)$this->getOption( 'file' ) ) );
			return;
		}
		$db = $this->getServiceContainer()->getService( 'LayersDatabase' );
		$after = '';
		do {
			$names = $db->listFilesWithSets( $after, $this->getBatchSize() );
			foreach ( $names as $name ) {
				$after = $name;
				yield $name;
			}
		} while ( count( $names ) === $this->getBatchSize() );
	}

	/** @return Authority Reads everything for the dry run, which writes nothing, not even the system user */
	private function planner(): Authority {
		return new UltimateAuthority( User::newSystemUser( self::DEFAULT_USER, [ 'create' => false ] ) ??
			$this->getServiceContainer()->getUserFactory()->newAnonymous() );
	}

	/** @return User */
	private function actor(): User {
		$name = $this->getOption( 'user' );
		if ( $name === null ) {
			$user = User::newSystemUser( self::DEFAULT_USER, [ 'steal' => true ] );
			if ( !$user ) {
				$this->fatalError( 'Cannot create the "' . self::DEFAULT_USER . '" system user.' );
			}
			$groups = $this->getServiceContainer()->getUserGroupManager();
			if ( !in_array( 'bot', $groups->getUserGroups( $user ), true ) ) {
				$groups->addUserToGroup( $user, 'bot' );
			}
			return $user;
		}
		$user = $this->getServiceContainer()->getUserFactory()->newFromName( (string)$name );
		if ( !$user || !$user->isRegistered() ) {
			$this->fatalError( "No such user: $name" );
		}
		return $user;
	}
}

// @codeCoverageIgnoreStart
$maintClass = MigrateLayersToPageHistory::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
