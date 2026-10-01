<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\Content;
use MediaWiki\Content\Renderer\ContentParseParams;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;

/** Test-only handler to isolate MediaWiki's secondary-slot tracking behavior. */
class SecondarySlotLinkProofContentHandler extends LayersDocumentContentHandler {
	public static int $parseCalls = 0;

	/** @inheritDoc */
	protected function fillParserOutput(
		Content $content,
		ContentParseParams $cpoParams,
		ParserOutput &$parserOutput
	): void {
		self::$parseCalls++;
		if ( $content instanceof LayersDocumentContent && $content->isReadable() ) {
			$document = json_decode( $content->getText(), true );
			foreach ( $document['surfaces'] ?? [] as $surface ) {
				foreach ( $surface['layers'] ?? [] as $layer ) {
					$link = is_array( $layer ) && is_string( $layer['link'] ?? null ) ? $layer['link'] : '';
					if ( $link === '' ) {
						continue;
					}
					if ( str_starts_with( $link, 'https://' ) ) {
						$parserOutput->addExternalLink( $link );
					} else {
						$target = Title::newFromText( $link );
						if ( $target && $target->getDBkey() !== '' ) {
							$parserOutput->addLink( $target );
						}
					}
				}
			}
		}

		$parserOutput->setRawText( $cpoParams->getGenerateHtml() ? '' : null );
	}
}
