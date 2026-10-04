<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Migration;

use InvalidArgumentException;
use MediaWiki\Extension\Layers\Migration\MigrationNameAllocator;
use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWikiUnitTestCase;
use stdClass;

/**
 * @covers \MediaWiki\Extension\Layers\Migration\MigrationNameAllocator
 */
class MigrationNameAllocatorTest extends MediaWikiUnitTestCase {

	private function makePdfMember(
		string $id,
		string $label,
		string $fileTitle,
		int $page,
		string $timestamp = '20260101000000'
	): stdClass {
		return (object)[
			'id' => $id,
			'kind' => 'pdf',
			'label' => $label,
			'source' => (object)[
				'fileTitle' => $fileTitle,
				'page' => $page,
				'timestamp' => $timestamp,
				'sha1' => 'dummy-sha1-' . $id,
			],
			'canvas' => (object)[ 'width' => 800, 'height' => 600 ],
			'layers' => [
				(object)[ 'id' => 'layer-1', 'type' => 'rectangle', 'text' => $id ],
			],
		];
	}

	private function makeImageMember(
		string $id,
		string $label,
		string $fileTitle,
		int $page = 1,
		string $timestamp = '20260101000000'
	): stdClass {
		return (object)[
			'id' => $id,
			'kind' => 'image',
			'label' => $label,
			'source' => (object)[
				'fileTitle' => $fileTitle,
				'page' => $page,
				'timestamp' => $timestamp,
				'sha1' => 'dummy-img-sha1-' . $id,
			],
			'canvas' => (object)[ 'width' => 1024, 'height' => 768 ],
			'layers' => [
				(object)[ 'id' => 'layer-1', 'type' => 'text', 'text' => $id ],
			],
		];
	}

	private function makeSlideMember(
		string $id,
		string $label
	): stdClass {
		return (object)[
			'id' => $id,
			'kind' => 'slide',
			'label' => $label,
			'canvas' => (object)[ 'width' => 1920, 'height' => 1080 ],
			'layers' => [
				(object)[ 'id' => 'layer-1', 'type' => 'box', 'text' => $id ],
			],
		];
	}

	public function testEmptyNewGroupsReturnsEmptyArray(): void {
		$existing = [ $this->makeSlideMember( 's1', 'Slide A' ) ];
		$before = JsonSnapshotCodec::encode( $existing );
		$result = MigrationNameAllocator::allocate( $existing, [] );
		$this->assertSame( [], $result );
		$this->assertSame( $before, JsonSnapshotCodec::encode( $existing ) );
	}

	public function testOnePdfGroupWithMultiplePagesReceivesNameOnceAndPreservesInputBytes(): void {
		$existing = [];
		$m1 = $this->makePdfMember( 'p1', 'ABC', 'File:Doc.pdf', 1 );
		$m3 = $this->makePdfMember( 'p3', 'ABC', 'File:Doc.pdf', 3 );
		$groups = [
			[
				'key' => 'g-pdf',
				'wanted' => 'ABC',
				'members' => [ $m1, $m3 ],
			],
		];

		$existingBefore = JsonSnapshotCodec::encode( $existing );
		$groupsBefore = JsonSnapshotCodec::encode( $groups );

		$result = MigrationNameAllocator::allocate( $existing, $groups );

		$this->assertSame( [ [ 'key' => 'g-pdf', 'name' => 'ABC' ] ], $result );
		$this->assertSame( $existingBefore, JsonSnapshotCodec::encode( $existing ) );
		$this->assertSame( $groupsBefore, JsonSnapshotCodec::encode( $groups ) );

		// Reverse member order: page 3 then page 1
		$m1Rev = $this->makePdfMember( 'p1', 'ABC', 'File:Doc.pdf', 1 );
		$m3Rev = $this->makePdfMember( 'p3', 'ABC', 'File:Doc.pdf', 3 );
		$groupsReversed = [
			[
				'key' => 'g-pdf',
				'wanted' => 'ABC',
				'members' => [ $m3Rev, $m1Rev ],
			],
		];
		$groupsReversedBefore = JsonSnapshotCodec::encode( $groupsReversed );

		$resultReversed = MigrationNameAllocator::allocate( $existing, $groupsReversed );

		$this->assertSame( [ [ 'key' => 'g-pdf', 'name' => 'ABC' ] ], $resultReversed );
		$this->assertSame( $groupsReversedBefore, JsonSnapshotCodec::encode( $groupsReversed ) );
	}

	public function testExistingNameOnDifferentFileAndSlideDoNotConflictWhileSameFileCollides(): void {
		// Existing ABC on another file and an ABC slide
		$existing = [
			$this->makeSlideMember( 's-abc', 'ABC' ),
			$this->makePdfMember( 'other-1', 'ABC', 'File:Other.pdf', 1 ),
		];
		$existingBefore = JsonSnapshotCodec::encode( $existing );

		// Incoming ABC on File:Target.pdf does not conflict
		$targetMember = $this->makePdfMember( 'tgt-1', 'ABC', 'File:Target.pdf', 1 );
		$groups = [
			[
				'key' => 'g-target',
				'wanted' => 'ABC',
				'members' => [ $targetMember ],
			],
		];
		$result = MigrationNameAllocator::allocate( $existing, $groups );
		$this->assertSame( [ [ 'key' => 'g-target', 'name' => 'ABC' ] ], $result );
		$this->assertSame( $existingBefore, JsonSnapshotCodec::encode( $existing ) );

		// When destination also has existing ABC on File:Target.pdf, it forces ABC 2
		$existingWithSameFile = [
			$this->makeSlideMember( 's-abc', 'ABC' ),
			$this->makePdfMember( 'other-1', 'ABC', 'File:Other.pdf', 1 ),
			$this->makePdfMember( 'tgt-exist', 'ABC', 'File:Target.pdf', 1 ),
		];
		$existingWithSameFileBefore = JsonSnapshotCodec::encode( $existingWithSameFile );

		$freeMember = $this->makePdfMember( 'free-1', 'ABC', 'File:Free.pdf', 1 );
		$twoGroups = [
			[
				'key' => 'g-target',
				'wanted' => 'ABC',
				'members' => [ $this->makePdfMember( 'tgt-new', 'ABC', 'File:Target.pdf', 2 ) ],
			],
			[
				'key' => 'g-free',
				'wanted' => 'ABC',
				'members' => [ $freeMember ],
			],
		];

		$resultCollision = MigrationNameAllocator::allocate( $existingWithSameFile, $twoGroups );
		$this->assertSame(
			[
				[ 'key' => 'g-target', 'name' => 'ABC 2' ],
				[ 'key' => 'g-free', 'name' => 'ABC' ],
			],
			$resultCollision
		);
		$this->assertSame( $existingWithSameFileBefore, JsonSnapshotCodec::encode( $existingWithSameFile ) );
	}

	public function testExistingSameFileNamedSetDoesNotAppendToExistingSet(): void {
		$existing = [
			$this->makePdfMember( 'exist-7', 'ABC 2', 'File:Doc.pdf', 7 ),
		];
		$existingBefore = JsonSnapshotCodec::encode( $existing );

		$groups = [
			[
				'key' => 'g-new-p3',
				'wanted' => 'ABC 2',
				'members' => [
					$this->makePdfMember( 'new-3', 'ABC 2', 'File:Doc.pdf', 3 ),
				],
			],
		];
		$groupsBefore = JsonSnapshotCodec::encode( $groups );

		$result = MigrationNameAllocator::allocate( $existing, $groups );

		$this->assertSame( [ [ 'key' => 'g-new-p3', 'name' => 'ABC 2 2' ] ], $result );
		$this->assertSame( $existingBefore, JsonSnapshotCodec::encode( $existing ) );
		$this->assertSame( $groupsBefore, JsonSnapshotCodec::encode( $groups ) );
	}

	public function testTwoIncomingGroupsOnSameFileWithEquivalentNamesReserveSequentially(): void {
		$existing = [];
		$groups = [
			[
				'key' => 'k1',
				'wanted' => 'Pump labels',
				'members' => [ $this->makePdfMember( 'm1', 'Pump labels', 'File:A.pdf', 1 ) ],
			],
			[
				'key' => 'k2',
				'wanted' => 'pump_LABELS',
				'members' => [ $this->makePdfMember( 'm2', 'pump_LABELS', 'File:A.pdf', 2 ) ],
			],
			[
				'key' => 'k3',
				'wanted' => "  Pump \t labels ",
				'members' => [ $this->makePdfMember( 'm3', "  Pump \t labels ", 'File:A.pdf', 3 ) ],
			],
			[
				'key' => 'k4',
				'wanted' => 'Pump labels',
				'members' => [ $this->makePdfMember( 'm4', 'Pump labels', 'File:B.pdf', 1 ) ],
			],
			[
				'key' => 'k5',
				'wanted' => 'pump_LABELS',
				'members' => [ $this->makePdfMember( 'm5', 'pump_LABELS', 'File:B.pdf', 2 ) ],
			],
		];

		$existingBefore = JsonSnapshotCodec::encode( $existing );
		$groupsBefore = JsonSnapshotCodec::encode( $groups );

		$result = MigrationNameAllocator::allocate( $existing, $groups );

		$this->assertSame(
			[
				[ 'key' => 'k1', 'name' => 'Pump labels' ],
				[ 'key' => 'k2', 'name' => 'pump_LABELS 2' ],
				[ 'key' => 'k3', 'name' => 'Pump labels 3' ],
				[ 'key' => 'k4', 'name' => 'Pump labels' ],
				[ 'key' => 'k5', 'name' => 'pump_LABELS 2' ],
			],
			$result
		);
		$this->assertSame( $existingBefore, JsonSnapshotCodec::encode( $existing ) );
		$this->assertSame( $groupsBefore, JsonSnapshotCodec::encode( $groups ) );
	}

	public function testPreservesLegitimateLiteralNamesAndHandlesMultiByteBoundary(): void {
		$existing = [];

		$longName = str_repeat( 'é', 255 );
		$groups = [
			[
				'key' => 'lit-1',
				'wanted' => 'Notes (page 2)',
				'members' => [ $this->makePdfMember( 'n1', 'Notes (page 2)', 'File:Doc.pdf', 1 ) ],
			],
			[
				'key' => 'lit-2',
				'wanted' => 'Notes (page 2)',
				'members' => [ $this->makePdfMember( 'n2', 'Notes (page 2)', 'File:Doc.pdf', 2 ) ],
			],
			[
				'key' => 'mb-1',
				'wanted' => $longName,
				'members' => [ $this->makeImageMember( 'mb1', $longName, 'File:Photo.jpg', 1 ) ],
			],
			[
				'key' => 'mb-2',
				'wanted' => $longName,
				'members' => [ $this->makeImageMember( 'mb2', $longName, 'File:Photo.jpg', 1 ) ],
			],
			[
				'key' => 'mb-3',
				'wanted' => $longName,
				'members' => [ $this->makeImageMember( 'mb3', $longName, 'File:Photo.jpg', 1 ) ],
			],
		];

		$existingBefore = JsonSnapshotCodec::encode( $existing );
		$groupsBefore = JsonSnapshotCodec::encode( $groups );

		$result = MigrationNameAllocator::allocate( $existing, $groups );

		$expectedMb2 = str_repeat( 'é', 253 ) . ' 2';
		$expectedMb3 = str_repeat( 'é', 253 ) . ' 3';

		$this->assertSame(
			[
				[ 'key' => 'lit-1', 'name' => 'Notes (page 2)' ],
				[ 'key' => 'lit-2', 'name' => 'Notes (page 2) 2' ],
				[ 'key' => 'mb-1', 'name' => $longName ],
				[ 'key' => 'mb-2', 'name' => $expectedMb2 ],
				[ 'key' => 'mb-3', 'name' => $expectedMb3 ],
			],
			$result
		);

		// Assert length of multi-byte truncated names does not exceed 255
		$this->assertSame( 255, mb_strlen( $expectedMb2 ) );
		$this->assertSame( 255, mb_strlen( $expectedMb3 ) );
		$this->assertSame( $expectedMb2, DrawingName::normalize( $expectedMb2 ) );
		$this->assertSame( $expectedMb3, DrawingName::normalize( $expectedMb3 ) );

		$this->assertSame( $existingBefore, JsonSnapshotCodec::encode( $existing ) );
		$this->assertSame( $groupsBefore, JsonSnapshotCodec::encode( $groups ) );
	}

	public function testPreservesNumericLookingKeysAndHistoricDestinationDuplicates(): void {
		// Historic duplicate names in destination
		$existing = [
			$this->makePdfMember( 'dup-1', 'ABC', 'File:Dup.pdf', 1 ),
			$this->makePdfMember( 'dup-2', 'ABC', 'File:Dup.pdf', 2 ),
		];
		$existingBefore = JsonSnapshotCodec::encode( $existing );

		$groups = [
			[
				'key' => '0',
				'wanted' => 'ABC',
				'members' => [ $this->makePdfMember( 'm-0', 'ABC', 'File:Dup.pdf', 3 ) ],
			],
			[
				'key' => '007',
				'wanted' => 'Agent',
				'members' => [ $this->makeSlideMember( 'm-007', 'Agent' ) ],
			],
			[
				'key' => '123',
				'wanted' => 'NumericKey',
				'members' => [ $this->makeImageMember( 'm-123', 'NumericKey', 'File:Img.png', 1 ) ],
			],
		];
		$groupsBefore = JsonSnapshotCodec::encode( $groups );

		$result = MigrationNameAllocator::allocate( $existing, $groups );

		// Historic duplicates on File:Dup.pdf reserved 'ABC' once, so next is 'ABC 2'
		$this->assertSame(
			[
				[ 'key' => '0', 'name' => 'ABC 2' ],
				[ 'key' => '007', 'name' => 'Agent' ],
				[ 'key' => '123', 'name' => 'NumericKey' ],
			],
			$result
		);

		// Assert keys are preserved as string types
		$this->assertSame( '0', $result[0]['key'] );
		$this->assertIsString( $result[0]['key'] );
		$this->assertSame( '007', $result[1]['key'] );
		$this->assertIsString( $result[1]['key'] );
		$this->assertSame( '123', $result[2]['key'] );
		$this->assertIsString( $result[2]['key'] );

		$this->assertSame( $existingBefore, JsonSnapshotCodec::encode( $existing ) );
		$this->assertSame( $groupsBefore, JsonSnapshotCodec::encode( $groups ) );
	}

	public function testStdClassGroupShapeIsAccepted(): void {
		$existing = [];
		$groups = [
			(object)[
				'key' => 'obj-key',
				'wanted' => 'Object Group',
				'members' => [ $this->makeSlideMember( 's-obj', 'Object Group' ) ],
			],
		];

		$result = MigrationNameAllocator::allocate( $existing, $groups );
		$this->assertSame( [ [ 'key' => 'obj-key', 'name' => 'Object Group' ] ], $result );
	}

	/**
	 * @dataProvider provideRefusalCases
	 */
	public function testRefusalsPreserveInputBytes( string $description, array $existing, array $groups ): void {
		$existingBefore = JsonSnapshotCodec::encode( $existing );
		$groupsBefore = JsonSnapshotCodec::encode( $groups );

		try {
			MigrationNameAllocator::allocate( $existing, $groups );
			$this->fail( "Expected InvalidArgumentException for case: $description" );
		} catch ( InvalidArgumentException $e ) {
			// Exception successfully thrown
			$this->assertNotEmpty( $e->getMessage() );
		}

		$this->assertSame(
			$existingBefore,
			JsonSnapshotCodec::encode( $existing ),
			"Destination snapshot modified during refused case: $description"
		);
		$this->assertSame(
			$groupsBefore,
			JsonSnapshotCodec::encode( $groups ),
			"Incoming groups modified during refused case: $description"
		);
	}

	public function provideRefusalCases(): array {
		$validPdf1 = $this->makePdfMember( 'p1', 'Valid', 'File:A.pdf', 1 );
		$validPdf2 = $this->makePdfMember( 'p2', 'Valid', 'File:A.pdf', 2 );
		$validImg = $this->makeImageMember( 'img1', 'Valid', 'File:A.jpg', 1 );
		$validSlide = $this->makeSlideMember( 'sld1', 'Valid' );

		return [
			'mixed files in group' => [
				'mixed files',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							$validPdf1,
							$this->makePdfMember( 'p-other', 'Valid', 'File:B.pdf', 2 ),
						],
					],
				],
			],
			'mixed kinds in group' => [
				'mixed kinds',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [ $validPdf1, $validImg ],
					],
				],
			],
			'repeated PDF pages in group' => [
				'repeated PDF pages',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							$validPdf1,
							$this->makePdfMember( 'p1-dup-page', 'Valid', 'File:A.pdf', 1 ),
						],
					],
				],
			],
			'image page 2' => [
				'image page 2',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							$this->makeImageMember( 'img-p2', 'Valid', 'File:A.jpg', 2 ),
						],
					],
				],
			],
			'image group with multiple members' => [
				'image group multiple members',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							$validImg,
							$this->makeImageMember( 'img2', 'Valid', 'File:A.jpg', 1 ),
						],
					],
				],
			],
			'slide group with multiple members' => [
				'slide group multiple members',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							$validSlide,
							$this->makeSlideMember( 'sld2', 'Valid' ),
						],
					],
				],
			],
			'slide member has source property' => [
				'slide has source',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							(object)[
								'id' => 'sld-src',
								'kind' => 'slide',
								'label' => 'Valid',
								'source' => (object)[ 'fileTitle' => 'File:NotAllowed.jpg' ],
								'canvas' => (object)[ 'width' => 100, 'height' => 100 ],
								'layers' => [],
							],
						],
					],
				],
			],
			'empty group key' => [
				'empty group key',
				[],
				[
					[
						'key' => '',
						'wanted' => 'Valid',
						'members' => [ $validPdf1 ],
					],
				],
			],
			'duplicate group keys' => [
				'duplicate group keys',
				[],
				[
					[
						'key' => 'dup-key',
						'wanted' => 'Valid',
						'members' => [ $validPdf1 ],
					],
					[
						'key' => 'dup-key',
						'wanted' => 'Valid',
						'members' => [ $validPdf2 ],
					],
				],
			],
			'invalid wanted name with pipe' => [
				'invalid wanted name',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Bad|Name',
						'members' => [ $this->makePdfMember( 'p-bad', 'Bad|Name', 'File:A.pdf', 1 ) ],
					],
				],
			],
			'invalid wanted name empty' => [
				'empty wanted name',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => '',
						'members' => [ $this->makePdfMember( 'p-bad', '', 'File:A.pdf', 1 ) ],
					],
				],
			],
			'invalid wanted name > 255 chars' => [
				'too long wanted name',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => str_repeat( 'a', 256 ),
						'members' => [
							$this->makePdfMember( 'p-bad', str_repeat( 'a', 256 ), 'File:A.pdf', 1 ),
						],
					],
				],
			],
			'member label does not match group wanted exactly' => [
				'mismatched member label',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Alpha',
						'members' => [ $this->makePdfMember( 'p-diff', 'Beta', 'File:A.pdf', 1 ) ],
					],
				],
			],
			'duplicate incoming member IDs within request' => [
				'duplicate incoming IDs',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [ $validPdf1 ],
					],
					[
						'key' => 'g2',
						'wanted' => 'Valid',
						'members' => [
							$this->makePdfMember( 'p1', 'Valid', 'File:B.pdf', 1 ),
						],
					],
				],
			],
			'incoming member ID already in destination' => [
				'destination ID collision',
				[ $validPdf1 ],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							$this->makePdfMember( 'p1', 'Valid', 'File:B.pdf', 1 ),
						],
					],
				],
			],
			'empty members array in group' => [
				'empty group',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [],
					],
				],
			],
			'PDF member source page less than 1' => [
				'PDF page zero',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							$this->makePdfMember( 'p0', 'Valid', 'File:A.pdf', 0 ),
						],
					],
				],
			],
			'file member missing fileTitle' => [
				'missing fileTitle',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							$this->makePdfMember( 'p-nofile', 'Valid', '', 1 ),
						],
					],
				],
			],
			'member is not stdClass' => [
				'array member',
				[],
				[
					[
						'key' => 'g1',
						'wanted' => 'Valid',
						'members' => [
							[ 'id' => 'p1', 'kind' => 'pdf', 'label' => 'Valid' ],
						],
					],
				],
			],
		];
	}
}
