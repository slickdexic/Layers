<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Validation\ColorValidator;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\TitleFactory;

/** An empty drawing for an embed that names a drawing its page does not have yet; nothing is saved here. */
class NewPageDrawing {
	private SourceVersionResolver $sources;
	private SourceRenditions $renditions;
	private LocalRepo $repo;
	private TitleFactory $titles;
	private array $slide;

	/**
	 * @param SourceVersionResolver $sources
	 * @param SourceRenditions $renditions
	 * @param LocalRepo $repo
	 * @param TitleFactory $titles
	 * @param array $slide New slide width, height and backgroundColor
	 */
	public function __construct( SourceVersionResolver $sources, SourceRenditions $renditions, LocalRepo $repo,
		TitleFactory $titles, array $slide
	) {
		$this->sources = $sources;
		$this->renditions = $renditions;
		$this->repo = $repo;
		$this->titles = $titles;
		$this->slide = $slide;
	}

	/**
	 * Stable for one base revision, so reopening the editor finds the local draft of an unsaved drawing.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param string $name
	 * @param string|null $fileTitle Canonical file title; null identifies a slide
	 * @param int $sourcePage Internal PDF page, or 1 for an image
	 * @return string
	 */
	public static function surfaceId( int $pageId, int $revisionId, string $name, ?string $fileTitle = null,
		int $sourcePage = 1
	): string {
		$identity = json_encode( [ $pageId, $revisionId, $fileTitle, DrawingName::key( $name ),
			$fileTitle === null ? 1 : $sourcePage ], JSON_THROW_ON_ERROR );
		return 'd' . substr( hash( 'sha256', $identity ), 0, 24 );
	}

	/**
	 * Former page-wide ID, used only for an independently verified read-only draft recovery alias.
	 * @param int $pageId
	 * @param int $revisionId
	 * @param string $name
	 * @return string
	 */
	public static function legacySurfaceId( int $pageId, int $revisionId, string $name ): string {
		return 'd' . substr( hash( 'sha256', $pageId . ':' . $revisionId . ':' . DrawingName::key( $name ) ), 0, 24 );
	}

	/**
	 * @param int $pageId
	 * @param int $revisionId Current revision the drawing will be added to
	 * @param array $candidate Scanned embed: kind, target and options
	 * @param string $name Normalized drawing name
	 * @param Authority $authority
	 * @param int|null $sourcePage Native effective page when supplied by the editor entry point
	 * @param array|null $existingPdfSource Exact source pin shared by an existing PDF layer set
	 * @return array surface, and for an image or PDF page the rendition of the file version it is pinned to
	 * @throws \DomainException When the embedded file cannot carry a drawing
	 */
	public function prepare( int $pageId, int $revisionId, array $candidate, string $name,
		Authority $authority, ?int $sourcePage = null, ?array $existingPdfSource = null
	): array {
		$id = self::surfaceId( $pageId, $revisionId, $name );
		$background = [ 'backgroundVisible' => true, 'backgroundOpacity' => 1 ];
		if ( $candidate['kind'] === 'slide' ) {
			$color = (string)( $this->slide['backgroundColor'] ?? '' );
			return [ 'surface' => [ 'id' => $id, 'kind' => 'slide', 'label' => $name, 'canvas' => [
				'width' => self::dimension( $this->slide['width'] ?? 800 ),
				'height' => self::dimension( $this->slide['height'] ?? 600 ),
				'backgroundColor' => ColorValidator::isValidColor( $color ) ? $color : '#ffffff'
			] + $background, 'layers' => [] ], 'rendition' => null ];
		}
		$title = $this->titles->newFromText( $candidate['target'] );
		$options = [ 'latest' => true, 'ignoreRedirect' => true ];
		if ( $existingPdfSource !== null ) {
			if ( ( $existingPdfSource['fileTitle'] ?? null ) !== $candidate['target'] ||
				!is_string( $existingPdfSource['timestamp'] ?? null ) ||
				!is_string( $existingPdfSource['sha1'] ?? null ) ) {
				throw new \DomainException( 'layers-source-unavailable' );
			}
			$options['time'] = $existingPdfSource['timestamp'];
		}
		$file = $title ? $this->repo->findFile( $title, $options ) : false;
		if ( !$file || !$file->exists() || $file->isDeleted( File::DELETED_FILE ) ) {
			throw new \DomainException( 'layers-source-unavailable' );
		}
		if ( $existingPdfSource !== null && ( $file->getMimeType() !== 'application/pdf' ||
			$file->getTimestamp() !== $existingPdfSource['timestamp'] ||
			$file->getSha1() !== $existingPdfSource['sha1'] ) ) {
			throw new \DomainException( 'layers-source-unavailable' );
		}
		$mime = $file->getMimeType();
		$kind = $mime === 'application/pdf' ? 'pdf' : ( str_starts_with( $mime, 'image/' ) ? 'image' : null );
		$page = $kind === 'pdf' ? ( $sourcePage ?? self::page( $candidate['options'] ) ) : 1;
		$id = self::surfaceId( $pageId, $revisionId, $name, 'File:' . $file->getName(), $page );
		$width = $kind ? $file->getWidth( $page ) : false;
		$height = $kind ? $file->getHeight( $page ) : false;
		if ( $page < 1 || !is_int( $width ) || !is_int( $height ) || $width < 1 || $height < 1 ||
			( $kind === 'pdf' && $page > (int)$file->pageCount() )
		) {
			throw new \DomainException( 'layers-source-unavailable' );
		}
		// Layers keep canvas coordinates; the file is drawn to fit, so large files get a smaller canvas.
		$scale = min( 1, DocumentSchema::MAX_DIMENSION / max( $width, $height ) );
		$surface = [ 'id' => $id, 'kind' => $kind, 'label' => $name, 'canvas' => [
			'width' => max( 1, (int)round( $width * $scale ) ),
			'height' => max( 1, (int)round( $height * $scale ) ),
			'backgroundColor' => '#ffffff'
		] + $background, 'layers' => [], 'source' => [
			'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => $page
		] ];
		try {
			$content = new LayersDocumentContent( json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ],
				JSON_THROW_ON_ERROR ) );
			$resolved = $this->sources->resolve( $content, $authority )[$id];
			return [ 'surface' => $surface, 'rendition' => $this->renditions->forSurface( $resolved, $surface ) ];
		} catch ( \InvalidArgumentException | \JsonException $e ) {
			throw new \DomainException( 'layers-source-unavailable', 0, $e );
		}
	}

	/**
	 * @param mixed $value
	 * @return int
	 */
	private static function dimension( $value ): int {
		return max( 1, min( DocumentSchema::MAX_DIMENSION, (int)$value ) );
	}

	/**
	 * @param string[] $options Raw embed options
	 * @return int The embed's `page=`, or 1
	 */
	private static function page( array $options ): int {
		return PageOwnedBindingOptions::sourcePage( $options, static function ( string $option ): ?string {
			$parts = explode( '=', $option, 2 );
			return trim( $parts[0] ) === 'page' && isset( $parts[1] ) ? $parts[1] : null;
		} );
	}
}
