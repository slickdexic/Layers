<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionIntent;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\Revision\RenderedRevision;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Status\Status;
use MediaWiki\Storage\Hook\MultiContentSaveHook;
use MediaWiki\User\UserIdentity;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Enforces page-owned publication admission at the core MultiContentSave boundary.
 *
 * Classifies proposed saves:
 * 1. Ordinary edits retaining inherited unchanged Layers content pass freely.
 * 2. Unrelated pages without Layers slots are completely unaffected.
 * 3. Add or change to Layers slot requires a matching, unconsumed service scope.
 * 4. Slot removal or foreign model placement is strictly denied.
 */
class PageOwnedAdmissionHooks implements MultiContentSaveHook {
	private ?PublicationAdmissionContext $context;
	private RevisionLookup $revisionLookup;

	/**
	 * @param ?PublicationAdmissionContext $context
	 * @param RevisionLookup $revisionLookup
	 */
	public function __construct(
		?PublicationAdmissionContext $context,
		RevisionLookup $revisionLookup
	) {
		$this->context = $context;
		$this->revisionLookup = $revisionLookup;
	}

	/**
	 * @inheritDoc
	 *
	 * @param RenderedRevision $renderedRevision
	 * @param UserIdentity $user
	 * @param CommentStoreComment $summary
	 * @param int $flags
	 * @param Status $status
	 * @return bool
	 */
	public function onMultiContentSave( $renderedRevision, $user, $summary, $flags, $status ) {
		$revisionRecord = $renderedRevision->getRevision();
		$slots = $revisionRecord->getSlots();
		$slotRoles = $slots->getSlotRoles();

		// 1. Foreign slots must not hold LayersDocumentContent model.
		foreach ( $slotRoles as $role ) {
			if ( $role !== PageRevisionWriter::SLOT ) {
				$slotContent = $slots->getContent( $role );
				if ( $slotContent->getModel() === LayersDocumentContent::MODEL ) {
					$this->deny( $status, 'layers-admission-unauthorized', 'foreign_slot_has_layers_model' );
					return false;
				}
			}
		}

		$proposedHasLayers = $slots->hasSlot( PageRevisionWriter::SLOT );

		// 2. If proposed revision has layers slot, model must be LayersDocumentContent.
		if ( $proposedHasLayers ) {
			$proposedLayers = $slots->getContent( PageRevisionWriter::SLOT );
			if ( $proposedLayers->getModel() !== LayersDocumentContent::MODEL ) {
				$this->deny( $status, 'layers-admission-unauthorized', 'foreign_model_in_layers_slot' );
				return false;
			}
		}

		// 3. Inspect parent revision for classification.
		// On null-edits (no-ops), MediaWiki copies the existing revision onto $revisionRecord,
		// setting its ID to the parent revision ID and setting parentId to the older parent.
		$parentId = $revisionRecord->getParentId();
		$effectiveParentId = ( $revisionRecord->getId() > 0 ) ? $revisionRecord->getId() : $parentId;

		$parentRevision = null;
		$parentHasLayers = false;

		if ( $effectiveParentId !== null && $effectiveParentId > 0 ) {
			$parentRevision = $this->revisionLookup->getRevisionById(
				$effectiveParentId,
				IDBAccessObject::READ_LATEST
			);
			if ( !$parentRevision ) {
				// Parent lookup failed; fail closed safely.
				$this->deny( $status, 'layers-admission-unauthorized', 'parent_lookup_failed' );
				return false;
			}
			if ( !$parentRevision->getPage()->isSamePageAs( $revisionRecord->getPage() ) ) {
				// Parent belongs to a different page; fail closed.
				$this->deny( $status, 'layers-admission-unauthorized', 'parent_owner_mismatch' );
				return false;
			}
			$parentHasLayers = $parentRevision->hasSlot( PageRevisionWriter::SLOT );
		}

		// 4. Slot removal is denied initially.
		if ( $parentHasLayers && !$proposedHasLayers ) {
			$this->deny( $status, 'layers-slot-removal-denied', 'slot_removal_denied' );
			return false;
		}

		// 5. Neither parent nor proposed has layers: unaffected standard edit.
		if ( !$parentHasLayers && !$proposedHasLayers ) {
			return true;
		}

		// 6. Same Layers content inherited: fast-path preservation.
		if ( $parentHasLayers && $proposedHasLayers ) {
			$parentLayers = $parentRevision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW );
			if ( $parentLayers && $parentLayers->getModel() === LayersDocumentContent::MODEL ) {
				if ( $parentLayers->serialize() === $proposedLayers->serialize() ) {
					// Exact same serialized content inherited; allow without requiring scope.
					return true;
				}
			}
		}

		// 7. Add or Replace Layers content: requires active, matching admission scope.
		if ( !$this->context || !$this->context->hasActiveScope() ) {
			$this->deny( $status, 'layers-admission-unauthorized', 'no_active_scope' );
			return false;
		}

		$intent = $this->context->getActiveIntent();
		if ( !$intent ) {
			$this->deny( $status, 'layers-admission-unauthorized', 'missing_active_intent' );
			return false;
		}

		// 7a. Validate permitted action (add vs replace).
		if ( $parentHasLayers && $intent->getPermittedAction() !== PublicationAdmissionIntent::ACTION_REPLACE ) {
			$this->deny( $status, 'layers-admission-unauthorized', 'action_mismatch_expected_replace' );
			return false;
		}
		if ( !$parentHasLayers && $intent->getPermittedAction() !== PublicationAdmissionIntent::ACTION_ADD ) {
			$this->deny( $status, 'layers-admission-unauthorized', 'action_mismatch_expected_add' );
			return false;
		}

		// 7b. Validate owner page identity.
		$page = $revisionRecord->getPage();
		if ( !$intent->matchesOwner( $page ) ) {
			$this->deny( $status, 'layers-admission-unauthorized', 'owner_mismatch' );
			return false;
		}

		// 7c. Validate base revision ID.
		$baseRevId = $intent->getBaseRevisionId();
		if ( $baseRevId === 0 ) {
			if ( $effectiveParentId !== null && $effectiveParentId > 0 ) {
				$this->deny( $status, 'layers-admission-unauthorized', 'base_mismatch_expected_creation' );
				return false;
			}
		} else {
			if ( $effectiveParentId !== $baseRevId ) {
				$this->deny( $status, 'layers-admission-unauthorized', 'base_mismatch' );
				return false;
			}
		}

		// 7d. Validate author identity without widening rights.
		if ( !$intent->matchesAuthor( $user ) ) {
			$this->deny( $status, 'layers-admission-unauthorized', 'author_mismatch' );
			return false;
		}

		// Bind the intended role/model as well as the snapshot bytes.
		if ( $intent->getExpectedRole() !== PageRevisionWriter::SLOT ||
			$intent->getExpectedModel() !== $proposedLayers->getModel()
		) {
			$this->deny( $status, 'layers-admission-unauthorized', 'intent_slot_model_mismatch' );
			return false;
		}

		// 7e. Validate canonical snapshot content.
		if ( !$intent->matchesSnapshot( $proposedLayers->serialize() ) ) {
			$this->deny( $status, 'layers-admission-unauthorized', 'snapshot_content_mismatch' );
			return false;
		}

		// 7f. Validate slot boundaries (no unauthorized third slot or unexpected main mutation).
		$allRoles = array_unique( array_merge(
			$slotRoles, $parentRevision ? $parentRevision->getSlots()->getSlotRoles() : []
		) );
		foreach ( $allRoles as $role ) {
			if ( $role !== PageRevisionWriter::SLOT && $role !== SlotRecord::MAIN ) {
				// Third slot: must exist in parent with unchanged content.
				if ( !$parentRevision || !$parentRevision->hasSlot( $role ) || !$slots->hasSlot( $role ) ) {
					$this->deny( $status, 'layers-admission-unauthorized', 'unauthorized_extra_slot' );
					return false;
				}
				$parentSlotContent = $parentRevision->getContent( $role, RevisionRecord::RAW );
				$proposedSlotContent = $slots->getContent( $role );
				if ( !$parentSlotContent || $parentSlotContent->getModel() !== $proposedSlotContent->getModel() ||
					$parentSlotContent->serialize() !== $proposedSlotContent->serialize()
				) {
					$this->deny( $status, 'layers-admission-unauthorized', 'unauthorized_extra_slot_modified' );
					return false;
				}
			}
		}

		$proposedMain = $slots->hasSlot( SlotRecord::MAIN ) ? $slots->getContent( SlotRecord::MAIN ) : null;
		$parentMain = ( $parentRevision && $parentRevision->hasSlot( SlotRecord::MAIN ) ) ?
			$parentRevision->getContent( SlotRecord::MAIN, RevisionRecord::RAW ) : null;

		if ( $intent->allowsMainModification() ) {
			$expectedMain = $intent->getExpectedMainText();
			if ( $expectedMain === null || !$proposedMain ||
				$proposedMain->getModel() !== CONTENT_MODEL_WIKITEXT ||
				$proposedMain->serialize() !== $expectedMain
			) {
				$this->deny( $status, 'layers-admission-unauthorized', 'main_content_mismatch' );
				return false;
			}
		} elseif ( ( $parentMain === null ) !== ( $proposedMain === null ) ||
			( $parentMain && $proposedMain && (
				$parentMain->getModel() !== $proposedMain->getModel() ||
				$parentMain->serialize() !== $proposedMain->serialize()
			) )
		) {
			$this->deny( $status, 'layers-admission-unauthorized', 'unauthorized_main_mutation' );
			return false;
		}

		// All checks pass: consume the admission scope once.
		$this->context->consume();
		return true;
	}

	/**
	 * Abort save with a fatal hook status and log safely without leaking document contents.
	 *
	 * @param Status $status
	 * @param string $messageKey
	 * @param string $reasonCode Static categorization code (no sensitive data)
	 */
	private function deny( Status $status, string $messageKey, string $reasonCode ): void {
		$status->fatal( $messageKey );
		LoggerFactory::getInstance( 'Layers' )->warning( 'Layers revision admission denied', [
			'reason' => $reasonCode
		] );
	}
}
