<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use InvalidArgumentException;
use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\LayerSetIdentity;
use stdClass;

/**
 * Pure whole-layer-set migration name allocation helper.
 * Allocates one name for an entire incoming PDF layer set within its file scope.
 */
final class MigrationNameAllocator {

	/**
	 * Allocate names for incoming groups within destination file/slide scopes.
	 *
	 * @param stdClass[] $existingSurfaces Destination snapshot (already-decoded, validated)
	 * @param array $newGroups Ordered list of incoming groups { key, wanted, members }
	 * @return array Ordered list of allocations { key: original string, name: allocated string }
	 * @throws InvalidArgumentException When validation fails for any incoming group or member
	 */
	public static function allocate( array $existingSurfaces, array $newGroups ): array {
		if ( $newGroups === [] ) {
			return [];
		}

		// 1. Destination preflight: record existing IDs and taken names per scope.
		$existingIds = [];
		$takenByScope = [];
		foreach ( $existingSurfaces as $surface ) {
			if ( isset( $surface->id ) && is_string( $surface->id ) && $surface->id !== '' ) {
				$existingIds[$surface->id] = true;
			}
			$scope = LayerSetIdentity::scope( $surface );
			$takenByScope[$scope][] = (string)$surface->label;
		}

		// 2. Validate all incoming groups and members before performing any allocation.
		$seenGroupKeys = [];
		$seenMemberIds = [];
		$validatedGroups = [];

		foreach ( $newGroups as $group ) {
			if ( is_array( $group ) ) {
				if ( !array_key_exists( 'key', $group ) ||
					!array_key_exists( 'wanted', $group ) ||
					!array_key_exists( 'members', $group )
				) {
					throw new InvalidArgumentException( 'Group missing required fields' );
				}
				$key = $group['key'];
				$wanted = $group['wanted'];
				$members = $group['members'];
			} elseif ( $group instanceof stdClass ) {
				if ( !property_exists( $group, 'key' ) ||
					!property_exists( $group, 'wanted' ) ||
					!property_exists( $group, 'members' )
				) {
					throw new InvalidArgumentException( 'Group missing required properties' );
				}
				$key = $group->key;
				$wanted = $group->wanted;
				$members = $group->members;
			} else {
				throw new InvalidArgumentException( 'Group must be an array or stdClass' );
			}

			if ( !is_string( $key ) || $key === '' ) {
				throw new InvalidArgumentException( 'Group key must be a nonempty string' );
			}
			if ( in_array( $key, $seenGroupKeys, true ) ) {
				throw new InvalidArgumentException( "Duplicate group key: $key" );
			}
			$seenGroupKeys[] = $key;

			if ( !is_string( $wanted ) ) {
				throw new InvalidArgumentException( 'Group wanted name must be a string' );
			}
			$normalizedWanted = DrawingName::normalize( $wanted );
			if ( $normalizedWanted === null ) {
				throw new InvalidArgumentException( 'Group wanted name is invalid' );
			}

			if ( !is_array( $members ) || count( $members ) === 0 ) {
				throw new InvalidArgumentException( 'Group members must be a nonempty array' );
			}

			$groupKind = null;
			$groupScope = null;
			$seenPdfPages = [];
			$isFirstMember = true;

			foreach ( $members as $member ) {
				if ( !( $member instanceof stdClass ) ) {
					throw new InvalidArgumentException( 'Member must be a stdClass' );
				}
				if ( !isset( $member->id ) || !is_string( $member->id ) || $member->id === '' ) {
					throw new InvalidArgumentException( 'Member id must be a nonempty string' );
				}
				if ( isset( $seenMemberIds[$member->id] ) ) {
					throw new InvalidArgumentException( "Duplicate member id in request: $member->id" );
				}
				if ( isset( $existingIds[$member->id] ) ) {
					throw new InvalidArgumentException( "Member id already exists in destination: $member->id" );
				}
				$seenMemberIds[$member->id] = true;

				if ( !isset( $member->kind ) || !in_array( $member->kind, [ 'image', 'pdf', 'slide' ], true ) ) {
					throw new InvalidArgumentException( 'Member kind must be image, pdf, or slide' );
				}

				if ( !isset( $member->label ) || !is_string( $member->label ) || $member->label !== $wanted ) {
					throw new InvalidArgumentException( 'Member label must equal group wanted name exactly' );
				}

				if ( $isFirstMember ) {
					$groupKind = $member->kind;
					if ( ( $groupKind === 'image' || $groupKind === 'slide' ) && count( $members ) !== 1 ) {
						throw new InvalidArgumentException(
							'An image or slide group must contain exactly one member'
						);
					}
				} elseif ( $member->kind !== $groupKind ) {
					throw new InvalidArgumentException( 'All members of a group must have the same kind' );
				}

				if ( $groupKind === 'slide' ) {
					if ( property_exists( $member, 'source' ) ) {
						throw new InvalidArgumentException( 'Slide member must not have a source property' );
					}
				} else {
					if ( !isset( $member->source ) || !( $member->source instanceof stdClass ) ) {
						throw new InvalidArgumentException( 'File member must have a stdClass source' );
					}
					if ( !isset( $member->source->fileTitle ) ||
						!is_string( $member->source->fileTitle ) ||
						$member->source->fileTitle === ''
					) {
						throw new InvalidArgumentException( 'File member must have a nonempty canonical fileTitle' );
					}
					if ( !isset( $member->source->page ) || !is_int( $member->source->page ) ) {
						throw new InvalidArgumentException( 'File member source page must be an integer' );
					}

					if ( $groupKind === 'image' ) {
						if ( $member->source->page !== 1 ) {
							throw new InvalidArgumentException( 'Image member source page must be 1' );
						}
					} elseif ( $groupKind === 'pdf' ) {
						if ( $member->source->page < 1 ) {
							throw new InvalidArgumentException( 'PDF member source page must be greater than zero' );
						}
						if ( isset( $seenPdfPages[$member->source->page] ) ) {
							throw new InvalidArgumentException(
								"Repeated PDF page {$member->source->page} in group"
							);
						}
						$seenPdfPages[$member->source->page] = true;
					}
				}

				$scope = LayerSetIdentity::scope( $member );
				if ( $isFirstMember ) {
					$groupScope = $scope;
					$isFirstMember = false;
				} elseif ( $scope !== $groupScope ) {
					throw new InvalidArgumentException( 'All members of a group must have the same file/slide scope' );
				}
			}

			$validatedGroups[] = [
				'key' => $key,
				'normalizedWanted' => $normalizedWanted,
				'scope' => $groupScope,
			];
		}

		// 3. Allocate sequentially per incoming group within its scope and reserve.
		$results = [];
		foreach ( $validatedGroups as $groupData ) {
			$scope = $groupData['scope'];
			$taken = $takenByScope[$scope] ?? [];
			$allocated = DrawingName::unused( $groupData['normalizedWanted'], $taken );
			$takenByScope[$scope][] = $allocated;
			$results[] = [
				'key' => $groupData['key'],
				'name' => $allocated,
			];
		}

		return $results;
	}
}
