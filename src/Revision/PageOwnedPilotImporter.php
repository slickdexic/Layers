<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use ImportableOldRevision;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use OldRevisionImporter;
use RuntimeException;
use Wikimedia\Rdbms\IDBAccessObject;

/** Native importer decorator. Drawings are never imported, and pages that own drawings take no imports. */
class PageOwnedPilotImporter implements OldRevisionImporter {
	private OldRevisionImporter $inner;
	private PageOwnedScope $scope;

	/**
	 * @param OldRevisionImporter $inner Original native service
	 * @param PageOwnedScope $scope
	 */
	public function __construct( OldRevisionImporter $inner, PageOwnedScope $scope ) {
		$this->inner = $inner;
		$this->scope = $scope;
	}

	/** @inheritDoc */
	public function import( ImportableOldRevision $importableRevision ) {
		// An imported revision can become current and drop the drawing slot without save admission.
		if ( $this->scope->ownsDrawings( $importableRevision->getTitle(), IDBAccessObject::READ_LATEST ) ) {
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
