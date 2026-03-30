<?php
// phpcs:disable MediaWiki.Files.ClassMatchesFilename,Generic.Files.OneObjectStructurePerFile,MediaWiki.Commenting.FunctionComment.MissingDocumentationPublic -- Standalone PHPUnit bootstrap helpers

namespace {
	require_once __DIR__ . '/../../vendor/autoload.php';

	if ( !defined( 'DB_PRIMARY' ) ) {
		define( 'DB_PRIMARY', 0 );
	}

	if ( !defined( 'DB_REPLICA' ) ) {
		define( 'DB_REPLICA', 1 );
	}

	if ( !defined( 'NS_FILE' ) ) {
		define( 'NS_FILE', 6 );
	}

	if ( !defined( 'TS_ISO_8601' ) ) {
		define( 'TS_ISO_8601', 'TS_ISO_8601' );
	}

	if ( !defined( 'TS_MW' ) ) {
		define( 'TS_MW', 'TS_MW' );
	}

	// Provide lightweight autoloading for extension classes when PHPUnit is run
	// directly from this repository instead of a full MediaWiki checkout.
	spl_autoload_register(
		static function ( string $class ): void {
			$prefix = 'MediaWiki\\Extension\\Layers\\';
			$prefixLength = strlen( $prefix );

			if ( strncmp( $class, $prefix, $prefixLength ) !== 0 ) {
				return;
			}

			$relativeClass = substr( $class, $prefixLength );
			$filePath = __DIR__ . '/../../src/' . str_replace( '\\', '/', $relativeClass ) . '.php';

			if ( is_file( $filePath ) ) {
				require_once $filePath;
			}
		}
	);

	if ( !class_exists( 'MediaWikiUnitTestCase' ) ) {
		abstract class MediaWikiUnitTestCase extends \PHPUnit\Framework\TestCase {
			// Minimal stub so PHPUnit tests can run outside a full MediaWiki install.
		}
	}

	if ( !class_exists( 'Config' ) ) {
		class Config {
			/** @var array */
			protected $settings;

			public function __construct( array $settings = [] ) {
				$this->settings = $settings;
			}

			public function get( string $name ) {
				return $this->settings[$name] ?? null;
			}
		}
	}

	if ( !class_exists( 'HashConfig' ) ) {
		class HashConfig extends Config {
		}
	}

	if ( !class_exists( 'Title' ) ) {
		class Title {
			/** @var int */
			private $namespace;

			/** @var string */
			private $text;

			public function __construct( int $namespace = 0, string $text = '' ) {
				$this->namespace = $namespace;
				$this->text = $text;
			}

			public static function makeTitle( int $namespace, string $text ): self {
				return new self( $namespace, $text );
			}

			public static function makeTitleSafe( int $namespace, string $text ): self {
				return new self( $namespace, $text );
			}

			public static function newFromText( string $text, ?int $defaultNamespace = null ): self {
				return new self( $defaultNamespace ?? 0, $text );
			}

			public function getNamespace(): int {
				return $this->namespace;
			}

			public function inNamespace( int $namespace ): bool {
				return $this->namespace === $namespace;
			}

			public function getText(): string {
				return $this->text;
			}

			public function getLocalURL(): string {
				$prefix = $this->namespace === NS_FILE ? 'File:' : '';
				return '/wiki/' . str_replace( '%2F', '/', rawurlencode( $prefix . $this->text ) );
			}
		}
	}

	if ( !class_exists( 'OutputPage' ) ) {
		class OutputPage {
			/** @var array */
			private $modules = [];

			public function getConfig() {
				return null;
			}

			public function getTitle() {
				return null;
			}

			public function getUser() {
				return null;
			}

			public function addModules( $module ): void {
				$this->modules[] = $module;
			}

			public function getModules(): array {
				return $this->modules;
			}
		}
	}

	if ( !class_exists( 'User' ) ) {
		class User {
			public function isAllowed( string $right ): bool {
				return false;
			}
		}
	}

	if ( !class_exists( 'Skin' ) ) {
		class Skin {
		}
	}

	if ( !class_exists( 'PPFrame' ) ) {
		class PPFrame {
			public function expand( $value ) {
				return $value;
			}
		}
	}

	if ( !class_exists( 'Parser' ) ) {
		class Parser {
			public const SFH_OBJECT_ARGS = 1;
		}
	}

	if ( !class_exists( 'ApiBase' ) ) {
		class ApiBase {
			public const PARAM_TYPE = 'type';
			public const PARAM_REQUIRED = 'required';
			public const PARAM_DFLT = 'default';
			public const PARAM_ISMULTI = 'multi';
			public const PARAM_HELP_MSG = 'help';

			public function __construct( ...$args ) {
			}

			public function getUser() {
				return null;
			}

			public function extractRequestParams(): array {
				return [];
			}

			public function checkUserRightsAny( ...$rights ): void {
			}

			public function getConfig() {
				return new HashConfig();
			}

			public function dieWithError( $message, $code = null ): void {
				if ( is_array( $message ) ) {
					$message = json_encode( $message );
				}
				throw new \RuntimeException( (string)$message );
			}

			public function getResult() {
				return new class {
					/** @var array */
					public $values = [];

					public function addValue( $path, $name, $value, $flags = null ): void {
						$this->values[] = [ $path, $name, $value, $flags ];
					}
				};
			}

			public function getModuleName(): string {
				return strtolower( ( new \ReflectionClass( $this ) )->getShortName() );
			}

			public function needsToken() {
				return false;
			}

			public function isWriteMode() {
				return false;
			}

			public function mustBePosted() {
				return false;
			}
		}
	}

	if ( !class_exists( 'ApiUsageException' ) ) {
		class ApiUsageException extends \RuntimeException {
		}
	}

	if ( !class_exists( 'ApiResult' ) ) {
		class ApiResult {
			public const NO_SIZE_CHECK = 1;
		}
	}

	if ( !class_exists( 'SpecialPage' ) ) {
		class SpecialPage {
			/** @var string */
			protected $mName;

			/** @var string */
			protected $mRestriction;

			public function __construct( string $name = '', string $restriction = '' ) {
				$this->mName = $name;
				$this->mRestriction = $restriction;
			}

			public function setHeaders(): void {
			}

			public function getOutput() {
				return new OutputPage();
			}

			public function getUser() {
				return new User();
			}

			public function getConfig() {
				return new HashConfig();
			}

			public function getRequest() {
				return new class {
					public function getText( string $key, string $default = '' ): string {
						return $default;
					}

					public function getBool( string $key, bool $default = false ): bool {
						return $default;
					}

					public function getInt( string $key, int $default = 0 ): int {
						return $default;
					}
				};
			}

			public function msg( string $key ) {
				return wfMessage( $key );
			}

			public static function getTitleFor( string $name ): Title {
				return Title::makeTitle( 0, $name );
			}
		}
	}

	if ( !class_exists( 'ForeignAPIFile' ) ) {
		class ForeignAPIFile {
		}
	}

	if ( !class_exists( 'ForeignDBFile' ) ) {
		class ForeignDBFile {
		}
	}

	if ( !function_exists( 'wfMessage' ) ) {
		function wfMessage( string $key, ...$params ) {
			return new class( $key, $params ) {
				/** @var string */
				private $key;

				/** @var array */
				private $params;

				public function __construct( string $key, array $params ) {
					$this->key = $key;
					$this->params = $params;
				}

				public function text(): string {
					if ( $this->params === [] ) {
						return $this->key;
					}
					return vsprintf( $this->key, $this->params );
				}

				public function inContentLanguage() {
					return $this;
				}

				public function escaped(): string {
					return htmlspecialchars( $this->text(), ENT_QUOTES, 'UTF-8' );
				}
			};
		}
	}

	if ( !function_exists( 'wfTimestamp' ) ) {
		function wfTimestamp( $format, string $timestamp ): string {
			if ( $format === TS_ISO_8601 && preg_match( '/^\d{14}$/', $timestamp ) ) {
				$year = substr( $timestamp, 0, 4 );
				$month = substr( $timestamp, 4, 2 );
				$day = substr( $timestamp, 6, 2 );
				$hour = substr( $timestamp, 8, 2 );
				$minute = substr( $timestamp, 10, 2 );
				$second = substr( $timestamp, 12, 2 );
				return "$year-$month-$day" . 'T' . "$hour:$minute:$second" . '+00:00';
			}

			return $timestamp;
		}
	}

	if ( !function_exists( 'wfDebugLog' ) ) {
		function wfDebugLog( string $channel, string $message ): void {
		}
	}
}

namespace MediaWiki\User {
	if ( !interface_exists( UserIdentity::class ) ) {
		/**
		 * Minimal standalone UserIdentity stub for package-level PHPUnit runs.
		 */
		interface UserIdentity {
			/**
			 * @return int|string|null
			 */
			public function getId();

			/**
			 * @return string
			 */
			public function getName(): string;

			/**
			 * @return string|false|null
			 */
			public function getWikiId();

			/**
			 * @return bool
			 */
			public function isRegistered(): bool;
		}
	}
}

namespace MediaWiki\Title {
	if ( !class_exists( Title::class ) ) {
		class Title extends \Title {
		}
	}
}

namespace Wikimedia\Rdbms {
	if ( !interface_exists( IConnectionProvider::class ) ) {
		interface IConnectionProvider {
			public function getPrimaryDatabase();

			public function getReplicaDatabase();
		}
	}

	if ( !interface_exists( IResultWrapper::class ) ) {
		interface IResultWrapper extends \Iterator {
			public function current(): mixed;

			public function next(): void;

			public function key(): mixed;

			public function valid(): bool;

			public function rewind(): void;

			public function getIterator(): \Traversable;
		}
	}

	if ( !interface_exists( IDatabase::class ) ) {
		interface IDatabase {
			public const LIST_AND = 'AND';
			public const LIST_OR = 'OR';

			public function selectField( $table, $field, $conds, $fname = __METHOD__, $options = [] );

			public function selectRow( $table, $vars, $conds, $fname = __METHOD__, $options = [] );

			public function select( $table, $vars, $conds, $fname = __METHOD__, $options = [], $joinConds = [] );

			public function selectFieldValues( $table, $field, $conds, $fname = __METHOD__, $options = [] );

			public function insert( $table, $row, $fname = __METHOD__ );

			public function insertId();

			public function startAtomic( $fname = __METHOD__ );

			public function endAtomic( $fname = __METHOD__ );

			public function isDuplicateKeyError( \Throwable $e ): bool;

			public function timestamp( $ts = null );

			public function delete( $table, $conds, $fname = __METHOD__ );

			public function affectedRows();

			public function makeList( $values, $mode = null );

			public function update( $table, $set, $conds, $fname = __METHOD__ );

			public function buildSelectSubquery(
				$table,
				$vars,
				$conds,
				$fname = __METHOD__,
				$options = [],
				$joinConds = []
			);

			public function buildLike( ...$params );

			public function anyString();

			public function addQuotes( $value );

			public function query( $sql, $fname = __METHOD__ );

			public function tableExists( $table, $fname = __METHOD__ );
		}
	}

	if ( !interface_exists( ILoadBalancer::class ) ) {
		interface ILoadBalancer extends IConnectionProvider {
			public function getConnection( $mode );

			public function getConnectionRef( $mode );
		}
	}

	if ( !class_exists( LoadBalancer::class ) ) {
		class LoadBalancer implements ILoadBalancer {
			public function getPrimaryDatabase() {
				return null;
			}

			public function getReplicaDatabase() {
				return null;
			}

			public function getConnection( $mode ) {
				return null;
			}

			public function getConnectionRef( $mode ) {
				return null;
			}
		}
	}

	if ( !class_exists( Subquery::class ) ) {
		class Subquery {
			public function __toString(): string {
				return '';
			}
		}
	}

	if ( !class_exists( DBQueryError::class ) ) {
		class DBQueryError extends \RuntimeException {
		}
	}
}
