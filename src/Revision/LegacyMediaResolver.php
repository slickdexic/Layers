<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Permissions\Authority;

/** Exact authorized media geometry for adoption; never derives upload time from drawing time. */
class LegacyMediaResolver {
	private SourceVersionResolver $sources;

	/** @param SourceVersionResolver $sources */
	public function __construct( SourceVersionResolver $sources ) {
		$this->sources = $sources;
	}

	/**
	 * @param array $record Exact server-selected legacy row
	 * @param string $fileTimestamp Explicit exact upload version, not the layer-set timestamp
	 * @param Authority $authority Request actor
	 * @return array Source descriptor and unscaled selected-page dimensions
	 * @throws \DomainException When source identity, permission or geometry is unavailable
	 */
	public function resolve( array $record, string $fileTimestamp, Authority $authority ): array {
		try {
			foreach ( [ 'imgName', 'sha1', 'mime' ] as $key ) {
				if ( !isset( $record[$key] ) || !is_string( $record[$key] ) ) {
					throw new \DomainException();
				}
			}
			if ( !isset( $record['page'] ) || !is_int( $record['page'] ) || $record['page'] < 1 ||
				( $record['mime'] !== 'application/pdf' && !str_starts_with( $record['mime'], 'image/' ) ) ) {
				throw new \DomainException();
			}
			$source = [
				'repository' => 'local', 'fileTitle' => 'File:' . $record['imgName'],
				'timestamp' => $fileTimestamp, 'sha1' => $record['sha1'], 'page' => $record['page']
			];
			$content = new LayersDocumentContent( JsonSnapshotCodec::encode( (object)[
				'schemaVersion' => 1,
				'surfaces' => [ (object)[
					'id' => 'adoption-source', 'kind' => $record['mime'] === 'application/pdf' ? 'pdf' : 'image',
					'label' => '', 'source' => (object)$source,
					'canvas' => (object)[
						'width' => 1, 'height' => 1, 'backgroundColor' => '#ffffff',
						'backgroundVisible' => true, 'backgroundOpacity' => 1
					],
					'layers' => []
				] ]
			] ) );
			$file = $this->sources->resolve( $content, $authority )['adoption-source'];
			if ( $file->getMimeType() !== $record['mime'] ) {
				throw new \DomainException();
			}
			$width = $file->getWidth( $record['page'] );
			$height = $file->getHeight( $record['page'] );
			foreach ( [ $width, $height ] as $dimension ) {
				if ( !is_int( $dimension ) || $dimension < 1 || $dimension > DocumentSchema::MAX_DIMENSION ) {
					throw new \DomainException();
				}
			}
			return [ 'source' => $source, 'width' => $width, 'height' => $height ];
		} catch ( \InvalidArgumentException | \DomainException | \JsonException $e ) {
			throw new \DomainException( 'layers-source-unavailable' );
		}
	}
}
