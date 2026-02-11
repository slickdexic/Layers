<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Database;

use MediaWiki\Installer\DatabaseUpdater;
use Psr\Log\LoggerInterface;
use Wikimedia\Rdbms\ILoadBalancer;

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
			$updater->addExtensionIndex(
				'layer_assets',
				'la_size',
				"$base/patches/patch-idx-layer_assets-la_size.sql"
			);

			// --- Data migrations (compatible SQL: UPDATE) ---

			// Named layer sets migration: set default name for existing rows
			// Must run after ls_name column is added
			$updater->addExtensionUpdate( [
				'applyPatch',
				"$base/patches/patch-named-sets-migration.sql",
				true
			] );

			// --- PHP methods for SQLite-incompatible operations ---

			// CHECK constraints (uses ALTER TABLE ADD CONSTRAINT — MySQL only)
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::runCheckConstraintsPatch'
			] );

			// Unique key update for named sets (uses ALTER TABLE DROP INDEX/ADD UNIQUE KEY — MySQL syntax)
			// Must run after ls_name column is added
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::updateUniqueKeyForNamedSets'
			] );

			// Widen ls_layer_count from TINYINT to SMALLINT (uses MODIFY COLUMN — MySQL only)
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::applyLayerCountTypePatch'
			] );

			// P1-012: Make ls_name NOT NULL DEFAULT 'default' (uses MODIFY COLUMN — MySQL only)
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::applyLsNameNotNullPatch'
			] );

			// P1-011: Change ON DELETE CASCADE to ON DELETE SET NULL for user FKs
			// (uses MODIFY COLUMN, DROP FOREIGN KEY, ADD CONSTRAINT — MySQL only)
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::applyFkCascadeToSetNullPatch'
			] );

			// P2-022: Drop FK constraints to comply with MW schema conventions
			// (uses DROP FOREIGN KEY — MySQL only)
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::applyDropForeignKeysPatch'
			] );

			// la_size CHECK constraints (uses ALTER TABLE ADD CONSTRAINT — MySQL only)
			$updater->addExtensionUpdate( [
				'MediaWiki\Extension\Layers\Database\LayersSchemaManager::applyLaSizeConstraintsPatch'
			] );
		}
	}

	/**
	 * Apply CHECK constraints idempotently.
	 *
	 * SQLite does not support ALTER TABLE ADD CONSTRAINT. CHECK constraints
	 * are a safety net; PHP validation is the primary defense.
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function runCheckConstraintsPatch( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();

		if ( $dbw->getType() === 'sqlite' ) {
			$updater->output( "  ...skipping CHECK constraints (SQLite: not supported via ALTER TABLE).\n" );
			return true;
		}

		$constraints = [
			'layer_sets' => [
				'chk_ls_size_positive' => 'CHECK (ls_size >= 0)',
				// Hard safety ceiling (50MB) - actual limits enforced by PHP config ($wgLayersMaxBytes)
				'chk_ls_size_reasonable' => 'CHECK (ls_size <= 52428800)',
				'chk_ls_layer_count_positive' => 'CHECK (ls_layer_count >= 0)',
				// Hard safety ceiling (1000) - actual limits enforced by PHP config ($wgLayersMaxLayerCount)
				'chk_ls_layer_count_reasonable' => 'CHECK (ls_layer_count <= 1000)',
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
	 * Uses ALTER TABLE on MySQL, standalone CREATE/DROP INDEX on SQLite.
	 *
	 * Old key: ls_img_name_revision (ls_img_name, ls_img_sha1, ls_revision)
	 * New key: ls_img_name_set_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision)
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function updateUniqueKeyForNamedSets( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();
		$tableName = $dbw->tableName( 'layer_sets' );
		$isSQLite = ( $dbw->getType() === 'sqlite' );

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
				if ( $isSQLite ) {
					$dbw->query( "DROP INDEX IF EXISTS ls_img_name_revision", __METHOD__ );
				} else {
					$dbw->query(
						"ALTER TABLE {$tableName} DROP INDEX ls_img_name_revision",
						__METHOD__
					);
				}
				$updater->output( "   Dropped old unique key ls_img_name_revision.\n" );
			}

			// Create the new unique key that includes ls_name
			if ( $isSQLite ) {
				$dbw->query(
					"CREATE UNIQUE INDEX ls_img_name_set_revision ON {$tableName}" .
					" (ls_img_name, ls_img_sha1, ls_name, ls_revision)",
					__METHOD__
				);
			} else {
				$dbw->query(
					"ALTER TABLE {$tableName} ADD UNIQUE KEY ls_img_name_set_revision" .
					" (ls_img_name, ls_img_sha1, ls_name, ls_revision)",
					__METHOD__
				);
			}
			$updater->output( "   Created new unique key ls_img_name_set_revision.\n" );
		} catch ( \Wikimedia\Rdbms\DBQueryError $e ) {
			// Handle duplicate key name error (already exists)
			$message = $e->getMessage();
			if ( strpos( $message, 'Duplicate key name' ) !== false ||
				 strpos( $message, 'already exists' ) !== false ) {
				$updater->output( "   ...unique key already exists.\n" );
			} else {
				$updater->output( "   Warning: Failed to update unique key: {$message}\n" );
			}
		}

		return true;
	}

	/**
	 * Widen ls_layer_count from TINYINT (max 255) to SMALLINT (max 65535).
	 *
	 * SQLite uses dynamic typing, so column type changes are meaningless.
	 * The base schema already defines SMALLINT for fresh installs.
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function applyLayerCountTypePatch( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();

		if ( $dbw->getType() === 'sqlite' ) {
			$updater->output( "  ...skipping column type change (SQLite uses dynamic typing).\n" );
			return true;
		}

		$tableName = $dbw->tableName( 'layer_sets' );
		$dbw->query(
			"ALTER TABLE {$tableName} MODIFY COLUMN ls_layer_count smallint unsigned NOT NULL DEFAULT 0",
			__METHOD__
		);
		$updater->output( "   Widened ls_layer_count to SMALLINT.\n" );

		return true;
	}

	/**
	 * P1-012: Make ls_name NOT NULL DEFAULT 'default'.
	 *
	 * SQLite does not support MODIFY COLUMN. The UPDATE to fix NULL values
	 * still runs on both platforms. For SQLite, the base schema already
	 * defines ls_name as NOT NULL DEFAULT 'default' for fresh installs.
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function applyLsNameNotNullPatch( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();
		$tableName = $dbw->tableName( 'layer_sets' );

		// Ensure no NULLs remain (runs on both MySQL and SQLite)
		$dbw->query(
			"UPDATE {$tableName} SET ls_name = 'default' WHERE ls_name IS NULL OR ls_name = ''",
			__METHOD__
		);
		$updater->output( "   Ensured all ls_name values are non-empty.\n" );

		if ( $dbw->getType() === 'sqlite' ) {
			$updater->output( "  ...skipping MODIFY COLUMN (SQLite: not supported; base schema is correct).\n" );
			return true;
		}

		$dbw->query(
			"ALTER TABLE {$tableName} MODIFY COLUMN ls_name varchar(255) NOT NULL DEFAULT 'default'",
			__METHOD__
		);
		$updater->output( "   Changed ls_name to NOT NULL DEFAULT 'default'.\n" );

		return true;
	}

	/**
	 * P1-011: Change ON DELETE CASCADE to ON DELETE SET NULL for user FKs.
	 *
	 * SQLite does not support MODIFY COLUMN, DROP FOREIGN KEY, or ADD CONSTRAINT FK.
	 * SQLite also does not enforce FKs by default (PRAGMA foreign_keys = OFF).
	 * The base schema already defines columns as nullable with no FKs for fresh installs.
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function applyFkCascadeToSetNullPatch( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();

		if ( $dbw->getType() === 'sqlite' ) {
			$updater->output( "  ...skipping FK changes (SQLite: FKs not enforced by default).\n" );
			return true;
		}

		$layerSets = $dbw->tableName( 'layer_sets' );
		$layerAssets = $dbw->tableName( 'layer_assets' );

		// layer_sets: make ls_user_id nullable, then change FK action
		try {
			$dbw->query(
				"ALTER TABLE {$layerSets} MODIFY COLUMN ls_user_id int unsigned DEFAULT NULL",
				__METHOD__
			);
			$dbw->query(
				"ALTER TABLE {$layerSets} DROP FOREIGN KEY fk_layer_sets_user_id",
				__METHOD__
			);
			$dbw->query(
				"ALTER TABLE {$layerSets} ADD CONSTRAINT fk_layer_sets_user_id" .
				" FOREIGN KEY (ls_user_id) REFERENCES {$dbw->tableName( 'user' )} (user_id)" .
				" ON DELETE SET NULL",
				__METHOD__
			);
			$updater->output( "   Changed layer_sets FK to SET NULL.\n" );
		} catch ( \Wikimedia\Rdbms\DBQueryError $e ) {
			$message = $e->getMessage();
			if ( strpos( $message, 'check that it exists' ) !== false ||
				 strpos( $message, 'FOREIGN KEY' ) !== false ) {
				$updater->output( "   ...layer_sets FK already dropped or changed.\n" );
			} else {
				throw $e;
			}
		}

		// layer_assets: make la_user_id nullable, then change FK action
		try {
			$dbw->query(
				"ALTER TABLE {$layerAssets} MODIFY COLUMN la_user_id int unsigned DEFAULT NULL",
				__METHOD__
			);
			$dbw->query(
				"ALTER TABLE {$layerAssets} DROP FOREIGN KEY fk_layer_assets_user_id",
				__METHOD__
			);
			$dbw->query(
				"ALTER TABLE {$layerAssets} ADD CONSTRAINT fk_layer_assets_user_id" .
				" FOREIGN KEY (la_user_id) REFERENCES {$dbw->tableName( 'user' )} (user_id)" .
				" ON DELETE SET NULL",
				__METHOD__
			);
			$updater->output( "   Changed layer_assets FK to SET NULL.\n" );
		} catch ( \Wikimedia\Rdbms\DBQueryError $e ) {
			$message = $e->getMessage();
			if ( strpos( $message, 'check that it exists' ) !== false ||
				 strpos( $message, 'FOREIGN KEY' ) !== false ) {
				$updater->output( "   ...layer_assets FK already dropped or changed.\n" );
			} else {
				throw $e;
			}
		}

		return true;
	}

	/**
	 * P2-022: Drop all FK constraints to comply with MW schema conventions.
	 *
	 * MediaWiki core does not use FK constraints; they cause issues with
	 * maintenance scripts, schema migrations, and SQLite compatibility.
	 * Application-level enforcement is used instead.
	 *
	 * SQLite: No-op because SQLite doesn't support DROP FOREIGN KEY and
	 * doesn't enforce FKs by default (PRAGMA foreign_keys = OFF).
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function applyDropForeignKeysPatch( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();

		if ( $dbw->getType() === 'sqlite' ) {
			$updater->output( "  ...skipping FK drop (SQLite: FKs not supported/enforced).\n" );
			return true;
		}

		$fksToDrop = [
			'layer_sets' => [ 'fk_layer_sets_user_id' ],
			'layer_assets' => [ 'fk_layer_assets_user_id' ],
			'layer_set_usage' => [ 'fk_layer_set_usage_layer_set_id', 'fk_layer_set_usage_page_id' ],
		];

		foreach ( $fksToDrop as $table => $fks ) {
			$tableName = $dbw->tableName( $table );
			foreach ( $fks as $fkName ) {
				try {
					$dbw->query(
						"ALTER TABLE {$tableName} DROP FOREIGN KEY {$fkName}",
						__METHOD__
					);
					$updater->output( "   Dropped FK {$fkName} from {$table}.\n" );
				} catch ( \Wikimedia\Rdbms\DBQueryError $e ) {
					$message = $e->getMessage();
					if ( strpos( $message, 'check that it exists' ) !== false ||
						 strpos( $message, "Can't DROP" ) !== false ) {
						$updater->output( "   ...FK {$fkName} already dropped.\n" );
					} else {
						throw $e;
					}
				}
			}
		}

		return true;
	}

	/**
	 * Apply la_size CHECK constraints for layer_assets table.
	 *
	 * SQLite does not support ALTER TABLE ADD CONSTRAINT. CHECK constraints
	 * are a safety net; PHP validation is the primary defense.
	 *
	 * @param DatabaseUpdater $updater
	 * @return bool
	 */
	public static function applyLaSizeConstraintsPatch( DatabaseUpdater $updater ): bool {
		$dbw = $updater->getDB();

		if ( $dbw->getType() === 'sqlite' ) {
			$updater->output( "  ...skipping la_size constraints (SQLite: not supported via ALTER TABLE).\n" );
			return true;
		}

		$tableName = $dbw->tableName( 'layer_assets' );

		// Clean up invalid data first
		$dbw->query(
			"UPDATE {$tableName} SET la_size = 0 WHERE la_size < 0",
			__METHOD__
		);

		$constraints = [
			'chk_la_size_positive' => 'CHECK (la_size >= 0)',
			// 50MB hard safety ceiling; actual limit enforced by PHP ($wgLayersMaxImageBytes)
			'chk_la_size_reasonable' => 'CHECK (la_size <= 52428800)',
		];

		foreach ( $constraints as $constraintName => $checkClause ) {
			try {
				$dbw->query(
					"ALTER TABLE {$tableName} ADD CONSTRAINT {$constraintName} {$checkClause}",
					__METHOD__
				);
				$updater->output( "   Added constraint {$constraintName}.\n" );
			} catch ( \Wikimedia\Rdbms\DBQueryError $e ) {
				$message = $e->getMessage();
				if ( preg_match( '/^Error (\d+):/', $message, $matches ) &&
					 in_array( (int)$matches[1], [ 3822, 1826 ] ) ) {
					$updater->output( "   ...constraint {$constraintName} already exists.\n" );
				} else {
					throw $e;
				}
			}
		}

		return true;
	}

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger;

	/** @var ILoadBalancer|null */
	private ?ILoadBalancer $loadBalancer;

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
	private const CURRENT_VERSION = '1.5.52';

	/** @var array Cached schema validation results */
	private $schemaCache = [];

	/** @var bool|null Cached result of isSchemaReady() */
	private $schemaReadyResult = null;

	/**
	 * @param LoggerInterface|null $logger Logger instance (injected via DI)
	 * @param ILoadBalancer|null $loadBalancer DB load balancer (injected via DI)
	 */
	public function __construct( ?LoggerInterface $logger = null, ?ILoadBalancer $loadBalancer = null ) {
		$this->logger = $logger;
		$this->loadBalancer = $loadBalancer;
	}

	/**
	 * Check if the database schema is properly installed and up to date
	 *
	 * @return bool True if schema is available and current
	 */
	public function isSchemaReady(): bool {
		// Cache the result to avoid repeated DB queries within the same request
		if ( $this->schemaReadyResult !== null ) {
			return $this->schemaReadyResult;
		}

		try {
			foreach ( self::SCHEMA_REQUIREMENTS as $table => $requirements ) {
				if ( !$this->validateTableSchema( $table ) ) {
					$this->schemaReadyResult = false;
					return false;
				}
			}
			$this->schemaReadyResult = true;
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
			if ( !$this->loadBalancer ) {
				return false;
			}
			$dbr = $this->loadBalancer->getConnection( DB_REPLICA );

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
