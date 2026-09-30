<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\MediaWikiServices;
use MediaWiki\Permissions\Authority;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;

/**
 * After the migration a file's drawings belong to its File: page. The legacy entry points (the File page's
 * section and tab, action=editlayers) lead to them instead of to shared sets, which are read-only.
 */
final class FilePageDrawings {
	/**
	 * @param Title $title The File: page
	 * @param Authority $authority The reader
	 * @return array [ revisionId, drawings ]: the current revision and its drawings ([ id, label ]) the reader
	 *  may read; no drawings when there are none or the reader may not read them
	 */
	public static function current( Title $title, Authority $authority ): array {
		$revisionId = $title->getLatestRevID();
		if ( !$revisionId ) {
			return [ 0, [] ];
		}
		try {
			return [ $revisionId, MediaWikiServices::getInstance()->getService( 'LayersPageOwnedPilot' )
				->getHistorySurfaces( $title, $revisionId, $authority ) ];
		} catch ( \DomainException $e ) {
			return [ $revisionId, [] ];
		}
	}

	/**
	 * The drawing a legacy set reference meant: the set's name (on PDF page N after the first, the name the
	 * migration gave that page's notes), or with no name the only drawing.
	 * @param array[] $drawings From current()
	 * @param string $setName '' for none
	 * @param int $page PDF page
	 * @return array|null
	 */
	public static function find( array $drawings, string $setName, int $page ): ?array {
		if ( $setName === '' ) {
			return count( $drawings ) === 1 ? $drawings[0] : null;
		}
		$wanted = $page > 1 ? wfMessage( 'layers-migration-pdf-page-name' )->plaintextParams( $setName, $page )
			->inContentLanguage()->text() : $setName;
		foreach ( $drawings as $drawing ) {
			if ( DrawingName::key( (string)$drawing['label'] ) === DrawingName::key( $wanted ) ) {
				return $drawing;
			}
		}
		return null;
	}

	/**
	 * @param Title $title
	 * @param string $surfaceId
	 * @return string The page-owned editor for the drawing at the current revision
	 */
	public static function editUrl( Title $title, string $surfaceId ): string {
		return SpecialPage::getTitleFor( 'EditLayersPage' )->getLocalURL( [
			'owner' => $title->getPrefixedDBkey(), 'revid' => 'current', 'surface' => $surfaceId ] );
	}

	/**
	 * @param Title $title
	 * @param int $revisionId
	 * @param string $surfaceId
	 * @return string The read-only viewer for the drawing at that revision
	 */
	public static function viewUrl( Title $title, int $revisionId, string $surfaceId ): string {
		return SpecialPage::getTitleFor( 'ViewLayersPage' )->getLocalURL( [
			'owner' => $title->getPrefixedDBkey(), 'revid' => $revisionId, 'surface' => $surfaceId ] );
	}
}
