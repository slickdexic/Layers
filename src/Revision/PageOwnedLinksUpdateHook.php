<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Deferred\LinksUpdate\LinksUpdate;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler;
use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Restore page-owned layer link metadata when a core parser path omits secondary-slot output.
 *
 * MediaWiki 1.45's Parsoid combined revision output intentionally returns only the main slot.
 * LinksUpdate is the native boundary where the current revision's secondary-slot tracking data
 * can be merged without exposing the JSON content as page HTML.
 */
final class PageOwnedLinksUpdateHook {
	/**
	 * @param LinksUpdate $linksUpdate
	 */
	public static function onLinksUpdate( $linksUpdate ): void {
		$revision = $linksUpdate->getRevisionRecord();
		if ( !$revision instanceof RevisionRecord || !$revision->hasSlot( PageRevisionWriter::SLOT ) ) {
			return;
		}

		$services = MediaWikiServices::getInstance();
		$current = $services->getRevisionLookup()->getRevisionByTitle(
			$linksUpdate->getTitle(), 0, IDBAccessObject::READ_LATEST
		);
		// Link tables describe only the current page revision. Never let a stale refresh or a
		// hidden revision reintroduce targets from historical layer-set content.
		if ( !$current || $current->getId() !== $revision->getId() ||
			!$revision->audienceCan( RevisionRecord::DELETED_TEXT, RevisionRecord::FOR_PUBLIC )
		) {
			return;
		}

		$output = $linksUpdate->getParserOutput();
		if ( $output->getExtensionData( LayersDocumentContentHandler::LINKS_TRACKING_MARKER ) === true ) {
			return;
		}

		$content = $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::FOR_PUBLIC );
		if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ) {
			return;
		}

		$slotOutput = $services->getContentRenderer()->getParserOutput(
			$content,
			$linksUpdate->getTitle(),
			$revision,
			ParserOptions::newFromAnon(),
			[ 'generate-html' => false ]
		);
		$output->mergeTrackingMetaDataFrom( $slotOutput );
	}
}
