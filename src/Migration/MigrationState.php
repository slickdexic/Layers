<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IReadableDatabase;

/**
 * Whether the D3 migration has finished, recorded in core's updatelog. The record is what gives bare
 * set and slide names their new meaning; `--undo` removes it.
 */
final class MigrationState {
	public const KEY = 'layers-page-history-migration';

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
	}

	/**
	 * @param IDatabase $db
	 */
	public static function clear( IDatabase $db ): void {
		$db->newDeleteQueryBuilder()->deleteFrom( 'updatelog' )->where( [ 'ul_key' => self::KEY ] )
			->caller( __METHOD__ )->execute();
	}
}
