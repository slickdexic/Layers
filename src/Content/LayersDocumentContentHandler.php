<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Content;

use MediaWiki\Content\Content;
use MediaWiki\Content\JsonContentHandler;
use MediaWiki\Content\Transform\PreSaveTransformParams;
use MediaWiki\Content\ValidationParams;

/** Core saves validate the snapshot via Content::isValid, including non-API writes. */
class LayersDocumentContentHandler extends JsonContentHandler {
	public function __construct() {
		parent::__construct( LayersDocumentContent::MODEL );
	}

	/**
	 * Validate at the core save boundary, not only through a custom API.
	 *
	 * @param Content $content
	 * @param ValidationParams $validationParams
	 * @return \StatusValue
	 */
	public function validateSave( Content $content, ValidationParams $validationParams ) {
		if ( !$content instanceof LayersDocumentContent || !$content->isValid() ) {
			return \StatusValue::newFatal( 'invalid-content-data' );
		}
		return parent::validateSave( $content, $validationParams );
	}

	/** @return string */
	protected function getContentClass() {
		return LayersDocumentContent::class;
	}

	/** @return LayersDocumentContent */
	public function makeEmptyContent() {
		return new LayersDocumentContent( '{"schemaVersion":1,"surfaces":[]}' );
	}

	/**
	 * Canonicalize valid content; keep invalid input intact for core rejection.
	 *
	 * @param Content $content
	 * @param PreSaveTransformParams $pstParams
	 * @return Content
	 */
	public function preSaveTransform( Content $content, PreSaveTransformParams $pstParams ): Content {
		if ( !$content instanceof LayersDocumentContent || !$content->isValid() ) {
			return $content;
		}
		return new LayersDocumentContent( $content->getCanonicalText() );
	}
}
