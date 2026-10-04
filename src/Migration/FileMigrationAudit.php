<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Read-only retained-row evidence for one owner's exact revision. Never a rename or merge plan. */
final class FileMigrationAudit {

	private LayersDatabase $legacy;
	private PageHistoryAccess $access;
	private TitleFactory $titles;

	/**
	 * @param LayersDatabase $legacy
	 * @param PageHistoryAccess $access
	 * @param TitleFactory $titles
	 */
	public function __construct( LayersDatabase $legacy, PageHistoryAccess $access, TitleFactory $titles ) {
		$this->legacy = $legacy;
		$this->access = $access;
		$this->titles = $titles;
	}

	/**
	 * Match deterministic migration IDs AND source metadata, without inspecting legacy layer payloads.
	 * A match does not establish that the current name or layers are unedited, or that a source is available.
	 * Literal legacy names remain distinct; normalized-name collisions are reported, never coalesced.
	 *
	 * @param Title $owner
	 * @param int $revisionId Exact revision, never replaced by latest
	 * @param Authority $authority
	 * @return array Metadata only; all entries must be preserved pending a separate reviewed write plan
	 */
	public function inspect( Title $owner, int $revisionId, Authority $authority ): array {
		$pageId = $owner->getArticleID( IDBAccessObject::READ_LATEST );
		$content = $this->access->read( $owner, $revisionId, $authority, $pageId );
		$surfaces = json_decode( $content->getText(), false, 64, JSON_THROW_ON_ERROR )->surfaces;
		$report = [ 'readOnly' => true, 'scope' => 'file-and-pdf', 'pageId' => $pageId,
			'revisionId' => $revisionId, 'payloadCompared' => false, 'sourceAvailabilityChecked' => false,
			'entries' => [], 'groups' => [] ];
		$rowsByFile = [];
		$groups = [];
		foreach ( $surfaces as $surface ) {
			$entry = [ 'id' => $surface->id, 'kind' => $surface->kind, 'currentName' => $surface->label ];
			if ( $surface->kind === 'slide' ) {
				$report['entries'][] = $entry + [ 'status' => 'outside-file-scope' ];
				continue;
			}
			$source = $surface->source;
			$entry['source'] = (array)$source;
			$title = $this->titles->newFromText( $source->fileTitle );
			if ( !$title || $title->getNamespace() !== NS_FILE ||
				$source->fileTitle !== 'File:' . $title->getDBkey() ||
				!$authority->authorizeRead( 'read', $title ) ) {
				$report['entries'][] = $entry + [ 'status' => 'source-unavailable' ];
				continue;
			}
			if ( !isset( $rowsByFile[$source->fileTitle] ) ) {
				$rowsByFile[$source->fileTitle] = [];
				foreach ( $this->legacy->listRetainedFileSetRows( $title->getDBkey() ) as $row ) {
					$id = FilePageMigration::surfaceId( $row['id'], $pageId );
					$rowsByFile[$source->fileTitle][$id][] = $row;
				}
			}
			$matches = $rowsByFile[$source->fileTitle][$surface->id] ?? [];
			if ( count( $matches ) !== 1 ) {
				$report['entries'][] = $entry + [ 'status' => $matches ?
					'ambiguous-retained-row' : 'no-retained-row-match' ];
				continue;
			}
			$row = $matches[0];
			$entry['legacy'] = $row;
			$differences = $this->sourceDifferences( $surface, $row );
			if ( $differences ) {
				$report['entries'][] = $entry + [ 'status' => 'source-mismatch', 'differences' => $differences ];
				continue;
			}
			$report['entries'][] = $entry + [ 'status' => 'retained-row-match' ];
			$key = json_encode( [ $source->fileTitle, $row['name'] ], JSON_THROW_ON_ERROR );
			$groups[$key] ??= [ 'fileTitle' => $source->fileTitle, 'legacyName' => $row['name'],
				'members' => [], 'currentNames' => [], 'issues' => [] ];
			$groups[$key]['members'][] = $surface->id;
			$groups[$key]['currentNames'][] = $surface->label;
		}
		$report['groups'] = $this->groupIssues( array_values( $groups ), $report['entries'] );
		return $report;
	}

	/** @param \stdClass $surface @param array $row @return string[] */
	private function sourceDifferences( \stdClass $surface, array $row ): array {
		$title = $this->titles->makeTitleSafe( NS_FILE, $row['imgName'] );
		$kind = $row['mime'] === 'application/pdf' ? 'pdf' :
			( str_starts_with( $row['mime'], 'image/' ) ? 'image' : null );
		$checks = [ 'fileTitle' => $title && $surface->source->fileTitle === 'File:' . $title->getDBkey(),
			'kind' => $surface->kind === $kind,
			'page' => $surface->source->page === $row['page'],
			'sha1' => $surface->source->sha1 === $row['sha1'],
			'repository' => $surface->source->repository === 'local' ];
		return array_keys( array_filter( $checks, static fn ( $matches ) => !$matches ) );
	}

	/** @param array[] $groups @param array[] $entries @return array[] */
	private function groupIssues( array $groups, array $entries ): array {
		$byId = array_column( $entries, null, 'id' );
		foreach ( $groups as &$group ) {
			$group['currentNames'] = array_values( array_unique( $group['currentNames'] ) );
			if ( count( $group['currentNames'] ) > 1 ) {
				$group['issues'][] = 'split-current-names';
			}
			$pins = [];
			$pages = [];
			foreach ( $group['members'] as $id ) {
				$source = $byId[$id]['source'];
				$pins[] = json_encode( [ $source['sha1'], $source['timestamp'] ], JSON_THROW_ON_ERROR );
				$pages[] = $source['page'];
			}
			if ( count( array_unique( $pins ) ) > 1 ) {
				$group['issues'][] = 'multiple-source-pins';
			}
			if ( count( array_unique( $pages ) ) < count( $pages ) ) {
				$group['issues'][] = 'repeated-source-page';
			}
			$names = array_map( [ DrawingName::class, 'key' ], $group['currentNames'] );
			foreach ( $entries as $entry ) {
				if ( ( $entry['source']['fileTitle'] ?? null ) !== $group['fileTitle'] ||
					in_array( $entry['id'], $group['members'], true ) ) {
					continue;
				}
				if ( in_array( DrawingName::key( $entry['currentName'] ), $names, true ) ) {
					$group['issues'][] = 'current-name-used-outside-group';
				}
				if ( isset( $entry['legacy'] ) &&
					DrawingName::key( $entry['legacy']['name'] ) === DrawingName::key( $group['legacyName'] ) ) {
					$group['issues'][] = 'other-entry-for-legacy-name';
				}
			}
			$group['issues'] = array_values( array_unique( $group['issues'] ) );
		}
		unset( $group );
		return $groups;
	}
}
