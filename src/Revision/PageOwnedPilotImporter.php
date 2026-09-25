<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use ImportableOldRevision;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use OldRevisionImporter;
use RuntimeException;

/** Unregistered native importer decorator. Pilot import is unsupported, not silently skipped. */
class PageOwnedPilotImporter implements OldRevisionImporter {
	private OldRevisionImporter $inner;
	private array $ownerKeys;

	/**
	 * @param OldRevisionImporter $inner Original native service
	 * @param string[] $ownerKeys Exact pilot owner prefixed DB keys
	 */
	public function __construct( OldRevisionImporter $inner, array $ownerKeys ) {
		$this->inner = $inner;
		$this->ownerKeys = $ownerKeys;
	}

	/** @inheritDoc */
	public function import( ImportableOldRevision $importableRevision ) {
		if ( in_array( $importableRevision->getTitle()->getPrefixedDBkey(), $this->ownerKeys, true ) ) {
			throw new RuntimeException( 'layers-admission-unauthorized' );
		}
		foreach ( $importableRevision->getSlotRoles() as $role ) {
			// Do not allow importing Layers under another page name, role or content model.
			if ( $role === PageRevisionWriter::SLOT ||
				$importableRevision->getContent( $role )->getModel() === LayersDocumentContent::MODEL
			) {
				throw new RuntimeException( 'layers-admission-unauthorized' );
			}
		}
		return $this->inner->import( $importableRevision );
	}
}
