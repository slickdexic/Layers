<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Cargo;

use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\PPFrame;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * {{#layers_cargo_store:_table=Name}} stores one Cargo row per drawing that the parsed revision owns.
 * Rows go through Cargo's own #cargo_store, so Cargo decides when they are written, replaced and deleted.
 * Without _table, Cargo uses the table declared by the calling template.
 */
final class PageOwnedCargoStore {
	/** Fields a table may declare; Cargo ignores those it does not declare. */
	public const FIELDS = [
		'surface_id', 'surface_label', 'surface_kind', 'source_file', 'source_page', 'drawing_text'
	];

	/**
	 * @param Parser $parser
	 * @param PPFrame $frame
	 * @param array $args
	 * @return string Always empty: drawing data never goes into page output
	 */
	public static function parserFunction( Parser $parser, PPFrame $frame, array $args ): string {
		$table = '';
		foreach ( $args as $arg ) {
			$parts = explode( '=', trim( $frame->expand( $arg ) ), 2 );
			if ( count( $parts ) === 2 && trim( $parts[0] ) === '_table' ) {
				$table = trim( $parts[1] );
			}
		}
		if ( class_exists( \CargoStore::class ) ) {
			foreach ( self::storeArguments( $table, self::rows( $parser ) ) as $store ) {
				\CargoStore::run( $parser, $frame, $store );
			}
		}
		return '';
	}

	/**
	 * @param Parser $parser
	 * @return array[] One row per drawing of the revision being parsed; empty outside the pilot
	 */
	public static function rows( Parser $parser ): array {
		$services = MediaWikiServices::getInstance();
		$revision = $parser->getRevisionRecordObject();
		$title = $parser->getTitle();
		if ( !$revision && $parser->getRevisionId() === null && self::cargoIsStoring() ) {
			// Cargo stores after a save (or on "recreate data") by reparsing the page's current text
			// without a revision ID, which the parser treats as a preview. Use the matching revision.
			$revision = $services->getRevisionLookup()->getRevisionByTitle( $title, 0,
				IDBAccessObject::READ_LATEST );
		}
		if ( !$revision ||
			!$revision->getId() || $revision->getPageId() !== $title->getArticleID() ||
			!$revision->hasSlot( PageRevisionWriter::SLOT ) || $revision->isDeleted( RevisionRecord::DELETED_TEXT ) ||
			!$services->getService( 'LayersPageOwnedPilot' )->getScope()->includesRevision( $title, $revision )
		) {
			return [];
		}
		$rows = [];
		$content = $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW );
		foreach ( $content ? PageDrawingSearchText::surfaces( $content ) : [] as $surface ) {
			$source = is_array( $surface['source'] ?? null ) ? $surface['source'] : [];
			$rows[] = [
				'surface_id' => is_string( $surface['id'] ?? null ) ? $surface['id'] : '',
				'surface_label' => is_string( $surface['label'] ?? null ) ? $surface['label'] : '',
				'surface_kind' => is_string( $surface['kind'] ?? null ) ? $surface['kind'] : '',
				'source_file' => is_string( $source['fileTitle'] ?? null ) ? $source['fileTitle'] : '',
				'source_page' => is_int( $source['page'] ?? null ) ? (string)$source['page'] : '',
				'drawing_text' => PageDrawingSearchText::layerText( $surface )
			];
		}
		return $rows;
	}

	/** @return bool Whether Cargo is currently storing data (page save or "recreate data") */
	private static function cargoIsStoring(): bool {
		return class_exists( \CargoStore::class ) && isset( \CargoStore::$settings['origin'] );
	}

	/**
	 * Every field is passed, empty ones as blank, so Cargo never fills them from template arguments.
	 *
	 * @param string $table Empty to use the calling template's declared table
	 * @param array[] $rows
	 * @return string[][] #cargo_store arguments per row
	 */
	public static function storeArguments( string $table, array $rows ): array {
		$stores = [];
		foreach ( $rows as $row ) {
			$store = $table === '' ? [] : [ '_table=' . $table ];
			foreach ( self::FIELDS as $field ) {
				$store[] = $field . '=' . ( $row[$field] ?? '' );
			}
			$stores[] = $store;
		}
		return $stores;
	}
}
