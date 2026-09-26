<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Content;

use MediaWiki\Content\Content;
use MediaWiki\Content\JsonContentHandler;
use MediaWiki\Content\Transform\PreSaveTransformParams;
use MediaWiki\Content\ValidationParams;
use MediaWiki\Context\IContextSource;
use MediaWiki\Title\Title;

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

	/** @inheritDoc */
	protected function getSlotDiffRendererWithOptions( IContextSource $context, $options = [] ) {
		return new LayersSlotDiffRenderer( $this->createTextSlotDiffRenderer( $options ) );
	}

	/**
	 * Snapshots live only in the dedicated Layers slot, never as a page's main content.
	 * @param Title $title
	 * @return bool
	 */
	public function canBeUsedOn( Title $title ) {
		return false;
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
