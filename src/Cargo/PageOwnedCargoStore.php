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
 * {{#layers_cargo_store:_table=Name}} stores one Cargo row per stored surface that the parsed revision owns.
 * Rows go through Cargo's own #cargo_store, so Cargo decides when they are written, replaced and deleted.
 * Without _table, Cargo uses the table declared by the calling template.
 */
final class PageOwnedCargoStore {
	/** Fields a per-surface table may declare; Cargo ignores those it does not declare. */
	public const FIELDS = [
		'surface_id', 'surface_label', 'surface_kind', 'source_file', 'source_page', 'drawing_text'
	];

	/** Fields a table may declare for the opt-in row-per-layer mode. */
	public const LAYER_FIELDS = [ 'page', 'revision', 'layer_set', 'kind', 'layer', 'type', 'text', 'link_target' ];

	/**
	 * @param Parser $parser
	 * @param PPFrame $frame
	 * @param array $args
	 * @return string|array Empty for supported modes, or a localized parser error for an unknown mode
	 */
	public static function parserFunction( Parser $parser, PPFrame $frame, array $args ) {
		$table = '';
		$rowsMode = null;
		foreach ( $args as $arg ) {
			$expanded = trim( $frame->expand( $arg ) );
			$parts = explode( '=', $expanded, 2 );
			if ( count( $parts ) === 2 ) {
				$name = trim( $parts[0] );
				if ( $name === '_table' ) {
					$table = trim( $parts[1] );
				} elseif ( $name === '_rows' ) {
					$rowsMode = trim( $parts[1] );
				}
			} elseif ( $expanded === '_rows' ) {
				$rowsMode = '';
			}
		}
		if ( $rowsMode !== null && $rowsMode !== 'layers' ) {
			return self::error( $parser );
		}
		if ( class_exists( \CargoStore::class ) ) {
			$rows = $rowsMode === 'layers' ? self::layerRows( $parser ) : self::rows( $parser );
			$stores = $rowsMode === 'layers' ? self::layerStoreArguments( $table, $rows ) :
				self::storeArguments( $table, $rows );
			foreach ( $stores as $store ) {
				\CargoStore::run( $parser, $frame, $store );
			}
		}
		return '';
	}

	/**
	 * @param Parser $parser
	 * @return array[] One row per stored surface of the revision being parsed; empty outside page-owned scope
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

	/**
	 * @param Parser $parser
	 * @return array[] One row for each layer with projected visible text or a link target
	 */
	public static function layerRows( Parser $parser ): array {
		$services = MediaWikiServices::getInstance();
		$title = $parser->getTitle();
		$revision = $parser->getRevisionRecordObject();
		if ( !$revision && $parser->getRevisionId() === null && self::cargoIsStoring() ) {
			// Cargo stores after a save or a data rebuild without a revision ID; bind to that current revision.
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

		$content = $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW );
		if ( !$content ) {
			return [];
		}
		$page = $title->getDBkey();
		$rows = [];
		foreach ( PageDrawingSearchText::surfaces( $content ) as $surface ) {
			$label = is_string( $surface['label'] ?? null ) ? $surface['label'] : '';
			$kind = is_string( $surface['kind'] ?? null ) ? $surface['kind'] : '';
			foreach ( is_array( $surface['layers'] ?? null ) ? $surface['layers'] : [] as $layer ) {
				if ( !is_array( $layer ) ) {
					continue;
				}
				// Reuse the search projection so rich text and hidden text follow the same rule.
				$text = PageDrawingSearchText::layerText( [ 'layers' => [ $layer ] ] );
				$link = is_string( $layer['link'] ?? null ) ? $layer['link'] : '';
				if ( $text === '' && $link === '' ) {
					continue;
				}
				$rows[] = [
					'page' => $page,
					'revision' => (string)$revision->getId(),
					'layer_set' => $label,
					'kind' => $kind,
					'layer' => is_string( $layer['id'] ?? null ) ? $layer['id'] : '',
					'type' => is_string( $layer['type'] ?? null ) ? $layer['type'] : '',
					'text' => $text,
					'link_target' => $link,
				];
			}
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

	/**
	 * @param string $table
	 * @param array[] $rows
	 * @return string[][] #cargo_store arguments for opt-in layer rows
	 */
	public static function layerStoreArguments( string $table, array $rows ): array {
		$stores = [];
		foreach ( $rows as $row ) {
			$store = $table === '' ? [] : [ '_table=' . $table ];
			foreach ( self::LAYER_FIELDS as $field ) {
				$store[] = $field . '=' . ( $row[$field] ?? '' );
			}
			$stores[] = $store;
		}
		return $stores;
	}

	/** @return array Parser error HTML that does not reflect an unsupported mode value */
	private static function error( Parser $parser ): array {
		return [ \MediaWiki\Html\Html::element( 'strong', [ 'class' => 'error' ],
			$parser->msg( 'layers-cargo-invalid-rows' )->text() ), 'noparse' => true, 'isHTML' => true ];
	}
}
