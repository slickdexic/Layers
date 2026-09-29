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
use MediaWiki\Extension\Layers\Migration\PageCopyMigration;
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
	/** @var string[] Documents step 1 would write, by File: page ID, for planning step 2 in a dry run */
	private array $pending = [];

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Move shared Layers sets and slides into page history. Lists the changes ' .
			'without making them unless --commit is given.' );
		$this->addOption( 'commit', 'Make the edits' );
		$this->addOption( 'user', 'Account that makes the edits; default: the "' . self::DEFAULT_USER .
			'" system user', false, true );
		$this->addOption( 'file', 'Only move this file\'s sets to its File: page (name without "File:")', false, true );
		$this->addOption( 'page', 'Only give this page copies of the sets and slides it shows', false, true );
		$this->setBatchSize( 100 );
		$this->requireExtension( 'Layers' );
	}

	/** @inheritDoc */
	public function execute() {
		$commit = $this->hasOption( 'commit' );
		$user = $commit ? $this->actor() : $this->planner();
		$this->output( $commit ? "Migrating.\n" : "Dry run: nothing is written. Add --commit to make these edits.\n" );
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		if ( !$this->hasOption( 'page' ) ) {
			$this->output( "Step 1: shared sets onto their File: pages.\n" );
			$migration = $pilot->newFilePageMigration();
			foreach ( $this->files() as $name ) {
				$this->migrateFile( $migration, $name, $user, $commit );
			}
		}
		if ( !$this->hasOption( 'file' ) ) {
			$this->output( "Step 2: copies for the pages that show shared sets and slides.\n" );
			$migration = $pilot->newPageCopyMigration();
			foreach ( $this->pages( $pilot->getScope() ) as $pageId ) {
				$this->migratePage( $migration, $pageId, $user, $commit );
			}
		}
		if ( $this->failures > 0 ) {
			$this->fatalError( $this->failures . " edit(s) failed; run the script again to retry them." );
		}
		return true;
	}

	/**
	 * @param PageCopyMigration $migration
	 * @param int $pageId
	 * @param Authority $user
	 * @param bool $commit
	 */
	private function migratePage( PageCopyMigration $migration, int $pageId, Authority $user, bool $commit ): void {
		$plan = $migration->plan( $pageId, $user, $commit ? [] : $this->pending );
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
			if ( $plan['document'] !== null ) {
				$this->pending[$plan['pageId']] = $plan['document'];
			}
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
