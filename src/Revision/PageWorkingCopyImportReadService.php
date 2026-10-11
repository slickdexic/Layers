<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Inactive exact native read preflight. Its result is not application or publication authority. */
class PageWorkingCopyImportReadService {

	private PageOwnedIdentityResolver $identities;
	private TitleFactory $titles;
	private PageReadService $reader;
	private PageOwnedScope $scope;

	public function __construct( PageOwnedIdentityResolver $identities, TitleFactory $titles,
		PageReadService $reader, PageOwnedScope $scope
	) {
		$this->identities = $identities;
		$this->titles = $titles;
		$this->reader = $reader;
		$this->scope = $scope;
	}

	/**
	 * Read existing image/slide members without planning against the stored target layers.
	 * Each descriptor has pageId, owner (current canonical prefixed DB key), revisionId and surfaceId.
	 * targetBundle and sourceBundle are the complete unchanged PageReadService bundles, detached as
	 * finite JSON data. No owner IDs are author syntax and no approval survives this invocation.
	 *
	 * @param int $targetPageId
	 * @param int $targetBaseRevisionId Explicit current target revision
	 * @param string $targetSurfaceId
	 * @param int $sourcePageId
	 * @param int $sourceRevisionId Explicit source revision, including readable history
	 * @param string $sourceSurfaceId
	 * @param Authority $authority Original native requesting authority
	 * @return array Keys: target, source, targetBundle, sourceBundle
	 * @throws \DomainException Fixed layers-working-copy-import-unavailable for any failed read
	 */
	public function read( int $targetPageId, int $targetBaseRevisionId, string $targetSurfaceId,
		int $sourcePageId, int $sourceRevisionId, string $sourceSurfaceId, Authority $authority
	): array {
		try {
			foreach ( [ $targetPageId, $targetBaseRevisionId, $sourcePageId, $sourceRevisionId ] as $id ) {
				if ( $id < 1 || $id > 2147483647 ) {
					throw new \DomainException();
				}
			}
			if ( $targetSurfaceId === '' || $sourceSurfaceId === '' ) {
				throw new \DomainException();
			}
			$target = $this->identities->resolveForEdit( $targetPageId, $targetBaseRevisionId, $authority );
			$this->assertOwner( $target, $targetPageId );
			$targetBundle = $this->readMember( $target, $targetPageId, $targetBaseRevisionId,
				$targetSurfaceId, $authority );
			$source = $this->sourceOwner( $sourcePageId, $targetPageId );
			$sourceBundle = $this->readMember( $source, $sourcePageId, $sourceRevisionId,
				$sourceSurfaceId, $authority );
			$freshTarget = $this->identities->resolveForEdit( $targetPageId, $targetBaseRevisionId, $authority );
			$this->assertOwner( $freshTarget, $targetPageId );
			$freshSource = $this->sourceOwner( $sourcePageId, $targetPageId );
			if ( $freshTarget->getPrefixedDBkey() !== $target->getPrefixedDBkey() ||
				$freshSource->getPrefixedDBkey() !== $source->getPrefixedDBkey() ||
				$this->readMember( $freshTarget, $targetPageId, $targetBaseRevisionId,
					$targetSurfaceId, $authority ) !== $targetBundle ||
				$this->readMember( $freshSource, $sourcePageId, $sourceRevisionId,
					$sourceSurfaceId, $authority ) !== $sourceBundle
			) {
				throw new \DomainException();
			}
			$lastTarget = $this->identities->resolveForEdit( $targetPageId, $targetBaseRevisionId, $authority );
			$this->assertOwner( $lastTarget, $targetPageId );
			$lastSource = $this->sourceOwner( $sourcePageId, $targetPageId );
			if ( $lastTarget->getPrefixedDBkey() !== $target->getPrefixedDBkey() ||
				$lastSource->getPrefixedDBkey() !== $source->getPrefixedDBkey() ||
				!$authority->authorizeRead( 'read', $lastSource ) ) {
				throw new \DomainException();
			}
			return [
				'target' => $this->descriptor( $lastTarget, $targetPageId, $targetBaseRevisionId, $targetSurfaceId ),
				'source' => $this->descriptor( $lastSource, $sourcePageId, $sourceRevisionId, $sourceSurfaceId ),
				'targetBundle' => $targetBundle,
				'sourceBundle' => $sourceBundle
			];
		} catch ( \Throwable $error ) {
			throw new \DomainException( 'layers-working-copy-import-unavailable' );
		}
	}

	private function assertOwner( Title $owner, int $pageId ): void {
		if ( !$owner->canExist() || $owner->isExternal() || $owner->hasFragment() ||
			$owner->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ||
			!$this->scope->includes( $owner, IDBAccessObject::READ_LATEST ) ) {
			throw new \DomainException();
		}
	}

	private function sourceOwner( int $pageId, int $targetPageId ): Title {
		if ( $pageId === $targetPageId ) {
			throw new \DomainException();
		}
		$owner = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$owner ) {
			throw new \DomainException();
		}
		$this->assertOwner( $owner, $pageId );
		return $owner;
	}

	private function readMember( Title $owner, int $pageId, int $revisionId, string $surfaceId,
		Authority $authority
	): array {
		$bundle = $this->reader->read( $owner, $revisionId, $authority, $pageId, [ $surfaceId ] );
		$this->assertFiniteData( $bundle );
		if ( ( $bundle['revisionId'] ?? null ) !== $revisionId ||
			!is_array( $bundle['snapshot']['surfaces'] ?? null ) ) {
			throw new \DomainException();
		}
		$members = array_values( array_filter( $bundle['snapshot']['surfaces'],
			static fn ( $surface ) => is_array( $surface ) && ( $surface['id'] ?? null ) === $surfaceId ) );
		if ( count( $members ) !== 1 || !in_array( $members[0]['kind'] ?? null, [ 'image', 'slide' ], true ) ) {
			throw new \DomainException();
		}
		return json_decode( json_encode( $bundle, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION ),
			true, 64, JSON_THROW_ON_ERROR );
	}

	/**
	 * @param mixed $value
	 * @param int $depth
	 */
	private function assertFiniteData( $value, int $depth = 0 ): void {
		if ( $depth > 64 ) {
			throw new \DomainException();
		}
		if ( is_array( $value ) ) {
			foreach ( $value as $member ) {
				$this->assertFiniteData( $member, $depth + 1 );
			}
		} elseif ( $value !== null && !is_string( $value ) && !is_bool( $value ) && !is_int( $value ) &&
			!( is_float( $value ) && is_finite( $value ) ) ) {
			throw new \DomainException();
		}
	}

	private function descriptor( Title $owner, int $pageId, int $revisionId, string $surfaceId ): array {
		return [ 'pageId' => $pageId, 'owner' => $owner->getPrefixedDBkey(),
			'revisionId' => $revisionId, 'surfaceId' => $surfaceId ];
	}
}
