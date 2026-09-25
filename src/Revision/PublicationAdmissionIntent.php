<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Permissions\Authority;
use MediaWiki\User\UserIdentity;

/**
 * Immutable intent object representing an authorized publication operation.
 * Created exclusively by PagePublicationService immediately before writing.
 */
class PublicationAdmissionIntent {
	public const ACTION_ADD = 'add';
	public const ACTION_REPLACE = 'replace';

	private Authority $authority;
	private UserIdentity $expectedAuthor;
	private int $ownerPageId;
	private int $ownerNamespace;
	private string $ownerDbKey;
	private int $baseRevisionId;
	private string $permittedAction;
	private string $expectedRole;
	private string $expectedModel;
	private string $canonicalSnapshotDigest;
	private bool $allowsMainModification;
	private ?string $expectedMainText;

	/**
	 * @param Authority $authority Original caller authority (never widened)
	 * @param UserIdentity $expectedAuthor Expected revision author
	 * @param int $ownerPageId Existing page ID, or 0 for page creation
	 * @param int $ownerNamespace Page namespace
	 * @param string $ownerDbKey Page database key
	 * @param int $baseRevisionId Parent revision ID, or 0 for creation
	 * @param string $permittedAction self::ACTION_ADD or self::ACTION_REPLACE
	 * @param string $expectedRole Expected slot name (e.g. PageRevisionWriter::SLOT)
	 * @param string $expectedModel Expected content model (LayersDocumentContent::MODEL)
	 * @param string $canonicalSnapshotDigest Hash or exact canonical text of the admitted snapshot
	 * @param bool $allowsMainModification Whether main-slot edit was requested
	 * @param ?string $expectedMainText Expected main-slot text if modification requested
	 */
	public function __construct(
		Authority $authority,
		UserIdentity $expectedAuthor,
		int $ownerPageId,
		int $ownerNamespace,
		string $ownerDbKey,
		int $baseRevisionId,
		string $permittedAction,
		string $expectedRole = PageRevisionWriter::SLOT,
		string $expectedModel = LayersDocumentContent::MODEL,
		string $canonicalSnapshotDigest = '',
		bool $allowsMainModification = false,
		?string $expectedMainText = null
	) {
		$this->authority = $authority;
		$this->expectedAuthor = $expectedAuthor;
		$this->ownerPageId = $ownerPageId;
		$this->ownerNamespace = $ownerNamespace;
		$this->ownerDbKey = $ownerDbKey;
		$this->baseRevisionId = $baseRevisionId;
		$this->permittedAction = $permittedAction;
		$this->expectedRole = $expectedRole;
		$this->expectedModel = $expectedModel;
		$this->canonicalSnapshotDigest = $canonicalSnapshotDigest;
		$this->allowsMainModification = $allowsMainModification;
		$this->expectedMainText = $expectedMainText;
	}

	public function getAuthority(): Authority {
		return $this->authority;
	}

	public function getExpectedAuthor(): UserIdentity {
		return $this->expectedAuthor;
	}

	public function getOwnerPageId(): int {
		return $this->ownerPageId;
	}

	public function getOwnerNamespace(): int {
		return $this->ownerNamespace;
	}

	public function getOwnerDbKey(): string {
		return $this->ownerDbKey;
	}

	public function getBaseRevisionId(): int {
		return $this->baseRevisionId;
	}

	public function getPermittedAction(): string {
		return $this->permittedAction;
	}

	public function getExpectedRole(): string {
		return $this->expectedRole;
	}

	public function getExpectedModel(): string {
		return $this->expectedModel;
	}

	public function getCanonicalSnapshotDigest(): string {
		return $this->canonicalSnapshotDigest;
	}

	public function allowsMainModification(): bool {
		return $this->allowsMainModification;
	}

	public function getExpectedMainText(): ?string {
		return $this->expectedMainText;
	}

	/**
	 * Matches owner page identity against namespace, database key, and page ID.
	 *
	 * @param PageIdentity $page
	 * @return bool
	 */
	public function matchesOwner( PageIdentity $page ): bool {
		if ( $page->getNamespace() !== $this->ownerNamespace ) {
			return false;
		}
		if ( $page->getDBkey() !== $this->ownerDbKey ) {
			return false;
		}
		if ( $page->getId() !== $this->ownerPageId ) {
			return false;
		}
		return true;
	}

	/**
	 * Validates author identity without widening to unrestricted user rights.
	 *
	 * @param UserIdentity $user
	 * @return bool
	 */
	public function matchesAuthor( UserIdentity $user ): bool {
		if ( $this->expectedAuthor->getId() > 0 && $user->getId() > 0 ) {
			return $this->expectedAuthor->getId() === $user->getId();
		}
		return $this->expectedAuthor->getName() === $user->getName();
	}

	/**
	 * Validates canonical snapshot bytes or hash.
	 *
	 * @param string $serialized
	 * @return bool
	 */
	public function matchesSnapshot( string $serialized ): bool {
		if ( $this->canonicalSnapshotDigest === '' ) {
			return false;
		}
		if ( $this->canonicalSnapshotDigest === $serialized ) {
			return true;
		}
		return hash( 'sha256', $serialized ) === $this->canonicalSnapshotDigest;
	}
}
