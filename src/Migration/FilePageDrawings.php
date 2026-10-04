<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
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
	 * Select the File owner's exact file, normalized name and internal page at the authorized revision.
	 * Older split PDF names remain aliases only when retained migration metadata proves that reference.
	 * This read evidence never establishes payload provenance or permits a rename/merge.
	 * @param Title $owner
	 * @param int $revisionId Exact revision used for the entry-point listing
	 * @param Authority $authority
	 * @param string $setName '' retains the existing single-entry selection rule
	 * @param int $page Effective media page
	 * @return array|null Identity metadata only; null leaves the existing list available
	 */
	public static function select( Title $owner, int $revisionId, Authority $authority,
		string $setName, int $page
	): ?array {
		if ( !$owner->inNamespace( NS_FILE ) || $owner->hasFragment() || $page < 1 ) {
			return null;
		}
		$services = MediaWikiServices::getInstance();
		try {
			$selections = $services->getService( 'LayersPageOwnedPilot' )
				->getFileSurfaceSelections( $owner, $revisionId, $authority );
			$file = 'File:' . $owner->getDBkey();
			$candidates = array_values( array_filter( $selections, static fn ( $entry ) =>
				in_array( $entry['kind'], [ 'image', 'pdf' ], true ) &&
				$entry['source']['fileTitle'] === $file && $entry['source']['page'] === $page ) );
			if ( $setName === '' ) {
				return count( $selections ) === 1 && count( $candidates ) === 1 ?
					self::identity( $candidates[0] ) : null;
			}
			$key = DrawingName::key( $setName );
			$exact = array_values( array_filter( $candidates, static fn ( $entry ) =>
				DrawingName::key( $entry['label'] ) === $key ) );
			if ( $exact ) {
				return count( $exact ) === 1 ? self::identity( $exact[0] ) : null;
			}
			if ( $page === 1 ) {
				return null;
			}
			$oldKey = DrawingName::key( wfMessage( 'layers-migration-pdf-page-name' )
				->plaintextParams( $setName, $page )->inContentLanguage()->text() );
			$aliases = array_column( array_filter( $candidates, static fn ( $entry ) =>
				$entry['kind'] === 'pdf' && DrawingName::key( $entry['label'] ) === $oldKey ), null, 'id' );
			if ( count( $aliases ) !== 1 ) {
				return null;
			}
			$audit = new FileMigrationAudit( $services->getService( 'LayersDatabase' ),
				new PageHistoryAccess( $services->getRevisionLookup() ), $services->getTitleFactory() );
			$proven = [];
			foreach ( $audit->inspect( $owner, $revisionId, $authority )['entries'] as $entry ) {
				if ( isset( $aliases[$entry['id']] ) && $entry['status'] === 'retained-row-match' &&
					DrawingName::key( $entry['legacy']['name'] ) === $key ) {
					$proven[] = $aliases[$entry['id']];
				}
			}
			return count( $proven ) === 1 ? self::identity( $proven[0] ) : null;
		} catch ( \DomainException $e ) {
			return null;
		}
	}

	/** @param array $entry @return array */
	private static function identity( array $entry ): array {
		return [ 'id' => $entry['id'], 'label' => $entry['label'], 'kind' => $entry['kind'] ];
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
