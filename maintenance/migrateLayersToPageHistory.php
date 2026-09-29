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
use MediaWiki\Extension\Layers\Revision\PublicationException;
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

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Move shared Layers sets and slides into page history. Lists the changes ' .
			'without making them unless --commit is given.' );
		$this->addOption( 'commit', 'Make the edits' );
		$this->addOption( 'user', 'Account that makes the edits; default: the "' . self::DEFAULT_USER .
			'" system user', false, true );
		$this->addOption( 'file', 'Only this file (name without "File:")', false, true );
		$this->setBatchSize( 100 );
		$this->requireExtension( 'Layers' );
	}

	/** @inheritDoc */
	public function execute() {
		$commit = $this->hasOption( 'commit' );
		$user = $commit ? $this->actor() : $this->planner();
		$this->output( $commit ? "Migrating.\n" : "Dry run: nothing is written. Add --commit to make these edits.\n" );
		$migration = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' )->newFilePageMigration();
		foreach ( $this->files() as $name ) {
			$this->migrateFile( $migration, $name, $user, $commit );
		}
		if ( $this->failures > 0 ) {
			$this->fatalError( $this->failures . " edit(s) failed; run the script again to retry them." );
		}
		return true;
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
