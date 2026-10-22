<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/**
 * Native revision-comment evidence, not authorization or a client confirmation.
 * Readers must independently check revision identity, visibility, saved content
 * and sources. An arbitrary caller can reproduce this digest.
 */
class MissingPdfImportReceipt {

	public const KEY = 'layers-missing-pdf-import';

	/**
	 * Bind the exact native request values before snapshot canonicalization or
	 * source deduplication. Object key spelling/order is not request identity;
	 * source list order, duplicates and every string's bytes are retained.
	 *
	 * The note is the native parsed value: an API string parameter may already
	 * have normalized it. This does not claim to fingerprint its HTTP wire bytes.
	 * Request admission remains the guarded publication service's responsibility.
	 *
	 * @param int $pageId Target owner
	 * @param int $baseRevisionId Original parent
	 * @param int $start Embedding byte offset
	 * @param string $expected Complete saved embedding
	 * @param string $json Original submitted snapshot bytes
	 * @param array[] $sources Ordered native descriptors
	 * @param string $note Native parsed owner note, before summary trimming
	 * @return array Small namespaced payload for CommentStoreComment
	 */
	public static function newCommentData( int $pageId, int $baseRevisionId, int $start,
		string $expected, string $json, array $sources, string $note
	): array {
		$tuple = [ self::KEY, 1, $pageId, $baseRevisionId, $start, $expected, $json, $sources, $note ];
		return [ self::KEY => [ 'version' => 1,
			'requestSha256' => hash( 'sha256', JsonSnapshotCodec::encode( $tuple ) ) ] ];
	}
}
