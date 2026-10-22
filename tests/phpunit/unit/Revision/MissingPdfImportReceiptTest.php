<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\MissingPdfImportReceipt;
use PHPUnit\Framework\TestCase;

/** @covers \MediaWiki\Extension\Layers\Revision\MissingPdfImportReceipt */
class MissingPdfImportReceiptTest extends TestCase {

	private static function request(): array {
		return [ 15, 99, 7, "[[File:Doc.pdf|layerset=ABC|cafe\u{0301}]]",
			'{"schemaVersion":1,"surfaces":[]}', [
				[ 'sourcePageId' => 20, 'sourceRevisionId' => 100, 'sourceSurfaceId' => 'source-1' ],
				[ 'sourcePageId' => 21, 'sourceRevisionId' => 101, 'sourceSurfaceId' => 'source-2' ]
			], " Owner cafe\u{0301} π 日本 😀 " ];
	}

	public function testDeterministicSmallMetadataContainsNoRequestContent(): void {
		$r = self::request();
		$data = MissingPdfImportReceipt::newCommentData( ...$r );
		$this->assertSame( $data, MissingPdfImportReceipt::newCommentData( ...$r ) );
		$this->assertSame( [ MissingPdfImportReceipt::KEY ], array_keys( $data ) );
		$this->assertSame( [ 'version', 'requestSha256' ], array_keys( $data[MissingPdfImportReceipt::KEY] ) );
		$this->assertSame( 1, $data[MissingPdfImportReceipt::KEY]['version'] );
		$this->assertMatchesRegularExpression( '/^[0-9a-f]{64}$/D',
			$data[MissingPdfImportReceipt::KEY]['requestSha256'] );
		$this->assertLessThan( 150, strlen( json_encode( $data ) ) );
		$this->assertStringNotContainsString( 'Doc.pdf', json_encode( $data ) );
		$this->assertStringNotContainsString( 'source-1', json_encode( $data ) );
	}

	public static function provideChangedRequests(): array {
		$out = [];
		foreach ( [ 'owner', 'base', 'offset', 'embedding', 'snapshot', 'source-owner',
			'source-revision', 'source-member', 'source-order', 'source-duplicate',
			'note', 'note-trim', 'note-unicode', 'snapshot-spelling', 'embedding-unicode' ] as $change ) {
			$r = self::request();
			switch ( $change ) {
				case 'owner':
					$r[0]++;
					break;
				case 'base':
					$r[1]++;
					break;
				case 'offset':
					$r[2]++;
					break;
				case 'embedding':
					$r[3] .= ' ';
					break;
				case 'snapshot':
					$r[4] .= ' ';
					break;
				case 'source-owner':
					$r[5][0]['sourcePageId']++;
					break;
				case 'source-revision':
					$r[5][0]['sourceRevisionId']++;
					break;
				case 'source-member':
					$r[5][0]['sourceSurfaceId'] = 'source:3';
					break;
				case 'source-order':
					$r[5] = array_reverse( $r[5] );
					break;
				case 'source-duplicate':
					$r[5][] = $r[5][0];
					break;
				case 'note':
					$r[6] .= 'x';
					break;
				case 'note-trim':
					$r[6] = trim( $r[6] );
					break;
				case 'note-unicode':
					$r[6] = str_replace( "e\u{0301}", 'é', $r[6] );
					break;
				case 'snapshot-spelling':
					$r[4] = '{"surfaces":[],"schemaVersion":1}';
					break;
				case 'embedding-unicode':
					$r[3] = str_replace( "e\u{0301}", 'é', $r[3] );
					break;
			}
			$out[$change] = [ $r ];
		}
		return $out;
	}

	/** @dataProvider provideChangedRequests */
	public function testEveryRequestComponentAndRawStringSpellingIsBound( array $changed ): void {
		$this->assertNotSame( MissingPdfImportReceipt::newCommentData( ...self::request() ),
			MissingPdfImportReceipt::newCommentData( ...$changed ) );
	}

	public function testDescriptorObjectKeyOrderDoesNotChangeNativeValues(): void {
		$r = self::request();
		$before = MissingPdfImportReceipt::newCommentData( ...$r );
		$r[5][0] = array_reverse( $r[5][0], true );
		$this->assertSame( $before, MissingPdfImportReceipt::newCommentData( ...$r ) );
	}

	public function testMalformedUtf8CannotProduceReceipt(): void {
		$r = self::request();
		$r[6] = "\xFF";
		$this->expectException( \JsonException::class );
		MissingPdfImportReceipt::newCommentData( ...$r );
	}
}
