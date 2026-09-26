<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Content;

use MediaWiki\Content\JsonContent;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;

/** Revision snapshot content. Registration remains test-only until H3 is ready. */
class LayersDocumentContent extends JsonContent {
	public const MODEL = 'layers-document';

	private ?string $canonicalText = null;
	private ?bool $readable = null;

	/**
	 * @param string $text
	 * @param string $modelId
	 */
	public function __construct( $text, $modelId = self::MODEL ) {
		if ( $modelId !== self::MODEL ) {
			throw new \InvalidArgumentException( 'Unexpected Layers content model.' );
		}
		parent::__construct( $text, $modelId );
	}

	/** @return bool Strict current-rule validity, required for saving */
	public function isValid() {
		try {
			$this->getCanonicalText();
			return true;
		} catch ( \InvalidArgumentException $e ) {
			return false;
		}
	}

	/** @return bool Structural validity for reading stored history; see DocumentSchema::decodeStored() */
	public function isReadable(): bool {
		if ( $this->readable === null ) {
			try {
				( new DocumentSchema() )->decodeStored( $this->getText() );
				$this->readable = true;
			} catch ( \InvalidArgumentException $e ) {
				$this->readable = false;
			}
		}
		return $this->readable;
	}

	/** @return string */
	public function getCanonicalText(): string {
		$this->canonicalText ??= ( new DocumentSchema() )->canonicalize( $this->getText() );
		return $this->canonicalText;
	}
}
