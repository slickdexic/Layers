<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Database;

use MediaWiki\Installer\DatabaseUpdater;
use Psr\Log\LoggerInterface;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * Schema management for the Layers extension
 *
 * This class provides proper schema versioning and validation without
 * runtime column detection, which is an anti-pattern that can cause
 * performance issues and complex fallback logic.
 */
class LayersSchemaManager {

	/**
	 * Implements the LoadExtensionSchemaUpdates hook.
	 *
	 * All patches are SQLite-compatible. Patches that use MySQL-only syntax
	 * (MODIFY COLUMN, DROP FOREIGN KEY, ADD CONSTRAINT) are implemented as
	 * PHP methods with $dbType branching instead of raw SQL files.
	 *
	 * @param DatabaseUpdater $updater
	 */
	public static function onLoadExtensionSchemaUpdates( DatabaseUpdater $updater ) {
		$dbType = $updater->getDB()->getType();
		$base = __DIR__ . '/../../sql';

		// Prefer per-table files to avoid re-running a monolithic schema multiple times
		$tablesDir = "$base/tables";
		if (
			is_dir( $tablesDir )
			&& file_exists( "$tablesDir/layer_sets.sql" )
			&& file_exists( "$tablesDir/layer_assets.sql" )
			&& file_exists( "$tablesDir/layer_set_usage.sql" )
		) {
			$updater->addExtensionTable( 'layer_sets', "$tablesDir/layer_sets.sql" );
			$updater->addExtensionTable( 'layer_assets', "$tablesDir/layer_assets.sql" );
			$updater->addExtensionTable( 'layer_set_usage', "$tablesDir/layer_set_usage.sql" );
		} else {
			// Fallback: run the monolithic schema once, anchored on layer_sets
			$updater->addExtensionTable( 'layer_sets', "$base/layers_tables.sql" );
			$updater->addExtensionTable( 'layer_assets', "$base/layers_tables.sql" );
			$updater->addExtensionTable( 'layer_set_usage', "$base/layers_tables.sql" );
		}

		// Patches for existing installations.
		// Note: The 'field' argument to addExtensionField is used to check if the patch is already applied.
		// It should be the column (or index) that the patch adds.
		if ( $dbType === 'mysql' || $dbType === 'sqlite' ) {
			// --- Column additions (compatible SQL: ALTER TABLE ADD COLUMN) ---

			// Add lsu_usage_count column if it doesn't exist.
			$updater->addExtensionField(
				'layer_set_usage',
				'lsu_usage_count',
				"$base/patches/patch-add-lsu_usage_count.sql"
			);

			// Add ls_size column for existing installations
			$updater->addExtensionField(
				'layer_sets',
				'ls_size',
				"$base/patches/patch-layer_sets-add-ls_size.sql"
			);

			// Add ls_layer_count column for existing installations
			$updater->addExtensionField(
				'layer_sets',
				'ls_layer_count',
				"$base/patches/patch-layer_sets-add-ls_layer_count.sql"
			);

			// Add la_size column for existing installations
			$updater->addExtensionField(
				'layer_assets',
				'la_size',
				"$base/patches/patch-layer_assets-add-la_size.sql"
			);

			// Add ls_name column for named layer sets (for upgrades from older versions)
			$updater->addExtensionField(
				'layer_sets',
				'ls_name',
				"$base/patches/patch-add-ls-name.sql"
			);

			// --- Index additions (compatible SQL: CREATE INDEX) ---

			$updater->addExtensionIndex(
				'layer_sets',
				'idx_layer_sets_named',
				"$base/patches/patch-idx-layer-sets-named.sql"
			);
			$updater->addExtensionIndex(
				'layer_sets',
				'idx_layer_sets_setname_revision',
				"$base/patches/patch-idx-layer-sets-setname-revision.sql"
			);
			if ( !$this->connectionProvider ) {
				return false;
			}
			$dbr = $this->connectionProvider->getReplicaDatabase();

			// Use MediaWiki's fieldExists method which is designed for this purpose
			return $dbr->fieldExists( $table, $column, __METHOD__ );
		} catch ( \Throwable $e ) {
			if ( $this->logger ) {
				$this->logger->warning( "Failed to check column existence", [
					'table' => $table,
					'column' => $column,
					'error' => $e->getMessage()
				] );
			}
			// Default to false for safety
			return false;
		}
	}

	/**
	 * Clear the schema cache
	 *
	 * This should be called after schema updates to ensure
	 * fresh validation results.
	 */
	public function clearCache(): void {
		$this->schemaCache = [];
		$this->schemaReadyResult = null;
	}

	/**
	 * Get schema information for debugging
	 *
	 * @return array Schema status information
	 */
	public function getSchemaInfo(): array {
		$info = [
			'extension_version' => self::CURRENT_VERSION,
			'schema_ready' => $this->isSchemaReady(),
			'tables' => []
		];

		foreach ( self::SCHEMA_REQUIREMENTS as $table => $requirements ) {
			$tableInfo = [
				'version' => $this->getTableVersion( $table ),
				'required_columns' => [],
				'optional_columns' => []
			];

			foreach ( $requirements['required_columns'] as $column ) {
				$tableInfo['required_columns'][$column] = $this->columnExists( $table, $column );
			}

			foreach ( $requirements['optional_columns'] as $column => $version ) {
				$tableInfo['optional_columns'][$column] = [
					'exists' => $this->columnExists( $table, $column ),
					'added_in_version' => $version
				];
			}

			$info['tables'][$table] = $tableInfo;
		}

		$info['missing_features'] = $this->getMissingFeatures();

		return $info;
	}
}
