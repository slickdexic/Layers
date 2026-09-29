<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\Parser;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IReadableDatabase;

/**
 * Whether the D3 migration has finished, recorded in core's updatelog. The record is what gives bare
 * set and slide names their new meaning; `--undo` removes it.
 */
final class MigrationState {
	public const KEY = 'layers-page-history-migration';
	/** Parser option, in the parser cache key, that is true once the migration has finished. */
	public const PARSER_OPTION = 'layersPageDrawings';

	private static ?bool $current = null;

	/**
	 * @param Parser $parser
	 * @return bool Whether this parse gives bare set and slide names their post-migration meaning
	 */
	public static function forParser( Parser $parser ): bool {
		return $parser->getOptions()->getOption( self::PARSER_OPTION ) === true;
	}

	/**
	 * Lazy value of the parser option. Null, not false, before the migration, so that installing
	 * Layers leaves every existing parser cache key as it was.
	 * @return bool|null
	 */
	public static function parserOptionValue(): ?bool {
		return self::isCompleteNow() ?: null;
	}

	/**
	 * @return bool Whether the migration has finished, read once per request
	 */
	public static function isCompleteNow(): bool {
		self::$current ??= self::isComplete(
			MediaWikiServices::getInstance()->getConnectionProvider()->getReplicaDatabase() );
		return self::$current;
	}

	/**
	 * @param IReadableDatabase $db
	 * @return bool
	 */
	public static function isComplete( IReadableDatabase $db ): bool {
		return $db->newSelectQueryBuilder()->select( 'ul_key' )->from( 'updatelog' )
			->where( [ 'ul_key' => self::KEY ] )->caller( __METHOD__ )->fetchField() !== false;
	}

	/**
	 * @param IDatabase $db
	 */
	public static function markComplete( IDatabase $db ): void {
		$db->newInsertQueryBuilder()->insertInto( 'updatelog' )->ignore()
			->row( [ 'ul_key' => self::KEY, 'ul_value' => wfTimestampNow() ] )->caller( __METHOD__ )->execute();
		self::$current = null;
	}

	/**
	 * @param IDatabase $db
	 */
	public static function clear( IDatabase $db ): void {
		$db->newDeleteQueryBuilder()->deleteFrom( 'updatelog' )->where( [ 'ul_key' => self::KEY ] )
			->caller( __METHOD__ )->execute();
		self::$current = null;
	}
}
