<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Content;

use MediaWiki\Content\Content;
use MediaWiki\Content\TextContent;
use MediaWiki\Context\IContextSource;
use MediaWiki\Output\OutputPage;
use MediaWiki\Title\Title;
use SlotDiffRenderer;
use TextSlotDiffRenderer;

/** Diff stored snapshots one property per line; canonical storage is a single JSON line. */
class LayersSlotDiffRenderer extends SlotDiffRenderer {
	private TextSlotDiffRenderer $text;

	public function __construct( TextSlotDiffRenderer $text ) {
		$this->text = $text;
	}

	/** @inheritDoc */
	public function getDiff( ?Content $oldContent = null, ?Content $newContent = null ) {
		return $this->text->getDiff( self::readable( $oldContent ), self::readable( $newContent ) );
	}

	/**
	 * @param Content|null $content
	 * @return Content|null
	 */
	private static function readable( ?Content $content ): ?Content {
		if ( !$content instanceof TextContent ) {
			return $content;
		}
		try {
			$decoded = json_decode( $content->getText(), false, 64, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
			return $content;
		}
		return new TextContent( json_encode( $decoded,
			JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION ) );
	}

	/** @inheritDoc */
	public function localizeDiff( $diff, $options = [] ) {
		return $this->text->localizeDiff( $diff, $options );
	}

	/** @inheritDoc */
	public function getTablePrefix( IContextSource $context, Title $newTitle ): array {
		return $this->text->getTablePrefix( $context, $newTitle );
	}

	/** @inheritDoc */
	public function addModules( OutputPage $output ) {
		$this->text->addModules( $output );
	}

	/** @inheritDoc */
	public function getExtraCacheKeys() {
		return array_merge( $this->text->getExtraCacheKeys(), [ 'layers-readable-json-1' ] );
	}
}
