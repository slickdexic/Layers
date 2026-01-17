<?php

namespace MediaWiki\Extension\Layers\Database;

use MediaWiki\Installer\DatabaseUpdater;
use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;

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
	 * @param DatabaseUpdater $updater
	 */
	public static function onLoadExtensionSchemaUpdates( DatabaseUpdater $updater ) {
		$dbType = $updater->getDB()->getType();
		$base = __DIR__ . '/../../sql';

		// Initial schema. These will only run if the tables do not exist.
		$updater->addExtensionTable( 'layer_sets', "$base/layers_tables.sql" );
		$updater->addExtensionTable( 'layer_assets', "$base/layers_tables.sql" );
		$updater->addExtensionTable( 'layer_set_usage', "$base/layers_tables.sql" );

		// Patches for existing installations.
		// Note: The 'field' argument to addExtensionField is used to check if the patch is already applied.
		// It should be the column (or index) that the patch adds.
		if ( $dbType === 'mysql' || $dbType === 'sqlite' ) {
			// Add lsu_usage_count column if it doesn't exist.
			$updater->addExtensionField(
				'layer_set_usage',
				'lsu_usage_count',
				"$base/patches/patch-add-lsu_usage_count.sql"
			);

			// For now, we'll use a dedicated method.
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::runCheckConstraintsPatch'
			] );

			// Add ls_name column for named layer sets (for upgrades from older versions)
			$updater->addExtensionField(
				'layer_sets',
				'ls_name',
				"$base/patches/patch-add-ls-name.sql"
			);

			// Update unique key to include ls_name for named sets
			// This must run after ls_name column is added
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::updateUniqueKeyForNamedSets'
			] );

			// Named layer sets migration: set default name for existing rows
			// Must run after ls_name column is added
			$updater->addExtensionUpdate( [
				'applyPatch',
				"$base/patches/patch-named-sets-migration.sql",
				true
			] );

			// Add indexes for named layer sets (uses addExtensionIndex to handle "if not exists")
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
		}
	}

	/**
	 * Apply the patch-add-check-constraints.sql patch idempotently.
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function runCheckConstraintsPatch( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();

		$constraints = [
			'layer_sets' => [
				'chk_ls_size_positive' => 'CHECK (ls_size >= 0)',
				'chk_ls_size_reasonable' => 'CHECK (ls_size <= 2097152)',
				'chk_ls_layer_count_positive' => 'CHECK (ls_layer_count >= 0)',
				'chk_ls_layer_count_reasonable' => 'CHECK (ls_layer_count <= 100)',
				'chk_ls_revision_positive' => 'CHECK (ls_revision >= 1)',
				'chk_ls_img_name_not_empty' => "CHECK (ls_img_name != '')",
				'chk_ls_img_sha1_format' => 'CHECK (ls_img_sha1 IS NULL OR LENGTH(ls_img_sha1) <= 40)',
			],
			'layer_assets' => [
				'chk_la_title_not_empty' => "CHECK (la_title != '')",
			],
			'layer_set_usage' => [
				'chk_lsu_usage_count_positive' => 'CHECK (lsu_usage_count >= 0)',
				'chk_lsu_usage_count_reasonable' => 'CHECK (lsu_usage_count <= 1000000)',
			]
		];

		foreach ( $constraints as $tableNameSuffix => $tableConstraints ) {
			$tableName = $dbw->tableName( $tableNameSuffix );
			$updater->output( "Applying constraints for {$tableName}...\n" );
			foreach ( $tableConstraints as $constraintName => $checkClause ) {
				try {
					$dbw->query(
						"ALTER TABLE {$tableName} ADD CONSTRAINT {$constraintName} {$checkClause}",
						__METHOD__
					);
					$updater->output( "   Added constraint {$constraintName}.\n" );
				} catch ( \Wikimedia\Rdbms\DBQueryError $e ) {
					$message = $e->getMessage();
					// MySQL uses error 3822 for duplicate CHECK constraint
					// MariaDB uses error 1826 for duplicate CHECK constraint name
					if ( preg_match( '/^Error (\d+):/', $message, $matches ) &&
						 in_array( (int)$matches[1], [ 3822, 1826 ] ) ) {
						$updater->output( "   ...constraint {$constraintName} already exists.\n" );
					} else {
						throw $e;
					}
				}
			}
		}

		return true;
	}

	/**
	 * Update the unique key to include ls_name for named layer sets.
	 *
	 * This allows multiple named sets per image, each with their own revision sequence.
	 * Old key: ls_img_name_revision (ls_img_name, ls_img_sha1, ls_revision)
	 * New key: ls_img_name_set_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision)
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function updateUniqueKeyForNamedSets( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();
		$tableName = $dbw->tableName( 'layer_sets' );

		// Check if the new key already exists
		$indexInfo = $dbw->indexInfo( 'layer_sets', 'ls_img_name_set_revision', __METHOD__ );
		if ( $indexInfo ) {
			$updater->output( "   ...unique key ls_img_name_set_revision already exists.\n" );
			return true;
		}

		// Check if the old key exists (it should, from initial schema)
		$oldIndexInfo = $dbw->indexInfo( 'layer_sets', 'ls_img_name_revision', __METHOD__ );

		$updater->output( "Updating unique key for named layer sets...\n" );

		try {
			if ( $oldIndexInfo ) {
				// Drop the old unique key
				$dbw->query(
					"ALTER TABLE {$tableName} DROP INDEX ls_img_name_revision",
					__METHOD__
				);
				$updater->output( "   Dropped old unique key ls_img_name_revision.\n" );
			}

			// Create the new unique key that includes ls_name
			$uniqueKey = 'ls_img_name_set_revision';
			$columns = 'ls_img_name, ls_img_sha1, ls_name, ls_revision';
			$dbw->query(
				"ALTER TABLE {$tableName} ADD UNIQUE KEY $uniqueKey ($columns)",
				__METHOD__
			);
			$updater->output( "   Created new unique key ls_img_name_set_revision.\n" );
		} catch ( \Wikimedia\Rdbms\DBQueryError $e ) {
			// Handle duplicate key name error (already exists)
			$message = $e->getMessage();
			if ( strpos( $message, 'Duplicate key name' ) !== false ) {
				$updater->output( "   ...unique key already exists (duplicate key name).\n" );
			} else {
				$updater->output( "   Warning: Failed to update unique key: {$message}\n" );
				// Don't throw - this is not fatal, just log it
			}
		}

		return true;
	}

	/** @var LoggerInterface */
	private $logger;

	/** @var array Schema version requirements */
	private const SCHEMA_REQUIREMENTS = [
		'layer_sets' => [
			'required_columns' => [
				'ls_id', 'ls_img_name', 'ls_img_major_mime', 'ls_img_minor_mime',
				'ls_img_sha1', 'ls_json_blob', 'ls_user_id', 'ls_timestamp',
				'ls_revision', 'ls_name', 'ls_size', 'ls_layer_count'
			],
			'optional_columns' => [
				// All columns are now required in current schema
			]
		],
		'layer_assets' => [
			'required_columns' => [
				'la_id', 'la_title', 'la_json_blob', 'la_preview_sha1',
				'la_user_id', 'la_timestamp', 'la_size'
			],
			'optional_columns' => []
		],
		'layer_set_usage' => [
			'required_columns' => [
				'lsu_layer_set_id', 'lsu_page_id', 'lsu_timestamp', 'lsu_usage_count'
			],
			'optional_columns' => []
		]
	];

	/** @var string Current extension version */
	private const CURRENT_VERSION = '0.8.1-dev';

	/** @var array Cached schema validation results */
	private $schemaCache = [];

	public function __construct() {
		$this->logger = MediaWikiServices::getInstance()
			->get( 'LayersLogger' ) ?? null;
	}

	/**
	 * Check if the database schema is properly installed and up to date
	 *
	 * @return bool True if schema is available and current
	 */
	public function isSchemaReady(): bool {
		try {
			foreach ( self::SCHEMA_REQUIREMENTS as $table => $requirements ) {
				if ( !$this->validateTableSchema( $table ) ) {
					return false;
				}
			}
			return true;
		} catch ( \Throwable $e ) {
			if ( $this->logger ) {
				$this->logger->error( 'Schema validation failed', [
					'error' => $e->getMessage(),
					'table' => $table ?? 'unknown'
				] );
			}
			return false;
		}
	}

	/**
	 * Get the current schema version for a table
	 *
	 * @param string $table Table name
	 * @return string Schema version or 'unknown'
	 */
	public function getTableVersion( string $table ): string {
		if ( !isset( self::SCHEMA_REQUIREMENTS[$table] ) ) {
			return 'unknown';
		}

		$requirements = self::SCHEMA_REQUIREMENTS[$table];
		// Base version before optional columns
		$version = '0.7.0';

		// Check which optional columns exist to determine version
		foreach ( $requirements['optional_columns'] as $column => $addedInVersion ) {
			if ( $this->columnExists( $table, $column ) ) {
				if ( version_compare( $addedInVersion, $version, '>' ) ) {
					$version = $addedInVersion;
				}
			}
		}

		return $version;
	}

	/**
	 * Check if a specific table feature is available
	 *
	 * @param string $table Table name
	 * @param string $feature Feature name (column name)
	 * @return bool True if feature is available
	 */
	public function hasFeature( string $table, string $feature ): bool {
		$cacheKey = "{$table}.{$feature}";

		if ( isset( $this->schemaCache[$cacheKey] ) ) {
			return $this->schemaCache[$cacheKey];
		}

		$available = false;

		if ( isset( self::SCHEMA_REQUIREMENTS[$table] ) ) {
			$requirements = self::SCHEMA_REQUIREMENTS[$table];

			// Check if it's a required column (always available)
			if ( in_array( $feature, $requirements['required_columns'], true ) ) {
				$available = true;
			} elseif ( isset( $requirements['optional_columns'][$feature] ) ) {
				// Check if it's an optional column that exists
				$available = $this->columnExists( $table, $feature );
			}
		}

		$this->schemaCache[$cacheKey] = $available;
		return $available;
	}

	/**
	 * Get list of missing schema features
	 *
	 * @return array List of missing features with recommendations
	 */
	public function getMissingFeatures(): array {
		$missing = [];

		foreach ( self::SCHEMA_REQUIREMENTS as $table => $requirements ) {
			// Check required columns
			foreach ( $requirements['required_columns'] as $column ) {
				if ( !$this->columnExists( $table, $column ) ) {
					$missing[] = [
						'type' => 'required_column',
						'table' => $table,
						'column' => $column,
						'severity' => 'critical',
						'action' => 'Run maintenance/update.php to create missing tables'
					];
				}
			}

			// Check optional columns
			foreach ( $requirements['optional_columns'] as $column => $version ) {
				if ( !$this->columnExists( $table, $column ) ) {
					$missing[] = [
						'type' => 'optional_column',
						'table' => $table,
						'column' => $column,
						'version' => $version,
						'severity' => 'warning',
						'action' => 'Run maintenance/update.php to add performance columns'
					];
				}
			}
		}

		return $missing;
	}

	/**
	 * Validate that a table has the expected schema
	 *
	 * @param string $table Table name
	 * @return bool True if table schema is valid
	 */
	private function validateTableSchema( string $table ): bool {
		if ( !isset( self::SCHEMA_REQUIREMENTS[$table] ) ) {
			return false;
		}

		$requirements = self::SCHEMA_REQUIREMENTS[$table];

		// Check that all required columns exist
		foreach ( $requirements['required_columns'] as $column ) {
			if ( !$this->columnExists( $table, $column ) ) {
				if ( $this->logger ) {
					$this->logger->error( "Missing required column in {$table}: {$column}" );
				}
				return false;
			}
		}

		return true;
	}

	/**
	 * Check if a column exists in a table
	 *
	 * This method uses MediaWiki's proper database abstraction
	 * and caches results to avoid repeated database queries.
	 *
	 * @param string $table Table name
	 * @param string $column Column name
	 * @return bool True if column exists
	 */
	private function columnExists( string $table, string $column ): bool {
		try {
			$loadBalancer = MediaWikiServices::getInstance()->getDBLoadBalancer();
			$dbr = $loadBalancer->getConnection( DB_REPLICA );

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
