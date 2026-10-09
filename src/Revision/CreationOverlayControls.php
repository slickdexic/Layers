<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Hooks\BoundFileHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Linker\Linker;
use MediaWiki\MediaWikiServices;
use MediaWiki\Output\OutputPage;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Parser\ParserOutputFlags;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\SpecialPage\SpecialPage;
use Wikimedia\Rdbms\IDBAccessObject;

/** Public parse identities and separate, authorized request-time creation controls. */
class CreationOverlayControls {
	public const DATA_KEY = 'layers-creation-occurrences-v1';
	private static ?\WeakMap $tokens = null;
	private static ?\WeakMap $hookContainers = null;
	private static ?array $renderContext = null;

	/**
	 * @param Parser $parser
	 * @param string &$text Temporary parse text, never stored page source
	 */
	public static function seed( Parser $parser, string &$text ): void {
		if ( !MigrationState::forParser( $parser ) ) {
			return;
		}
		$revision = $parser->getRevisionRecordObject();
		$services = MediaWikiServices::getInstance();
		$pilot = $services->getService( 'LayersPageOwnedPilot' );
		if ( !$revision || $revision->getId() < 1 ||
			$revision->getPageId() !== $parser->getTitle()->getArticleID() ||
			!$pilot->getScope()->includesRevision( $parser->getTitle(), $revision ) ||
			( $revision->getVisibility() & RevisionRecord::DELETED_TEXT ) ) {
			return;
		}
		$main = $revision->getContent( SlotRecord::MAIN, RevisionRecord::RAW );
		$current = $services->getRevisionLookup()->getRevisionByTitle( $parser->getTitle(), 0,
			IDBAccessObject::READ_LATEST );
		if ( !$current || $current->getId() !== $revision->getId() ||
			!$main instanceof WikitextContent || $main->getText() !== $text ) {
			return;
		}
		$titles = $services->getTitleFactory();
		try {
			$candidates = ( new DirectEmbeddingRewriter( $parser->getTags() ) )->scan( $text,
				static function ( string $target ) use ( $titles ): ?string {
					$title = $titles->newFromText( $target );
					return $title && $title->getNamespace() === NS_FILE && !$title->hasFragment() ?
						'File:' . $title->getDBkey() : null;
				} );
		} catch ( \InvalidArgumentException $error ) {
			return;
		}
		self::$tokens ??= new \WeakMap();
		self::$hookContainers ??= new \WeakMap();
		$hooks = $services->getHookContainer();
		if ( !isset( self::$hookContainers[$hooks] ) ) {
			$hooks->register( 'ImageBeforeProduceHTML', [ self::class, 'onImageBeforeProduceHTML' ] );
			self::$hookContainers[$hooks] = true;
		}
		$classOptions = $services->getMagicWordFactory()->newArray( [ 'img_class' ] );
		$tokens = [];
		foreach ( array_reverse( $candidates ) as $candidate ) {
			$token = bin2hex( random_bytes( 16 ) );
			$tokens[$token] = $candidate;
			$at = $candidate['start'] + $candidate['length'] - 2;
			$marker = '|layerscreation=' . $token;
			if ( $candidate['kind'] === 'file' ) {
				$class = '';
				foreach ( $candidate['options'] as $option ) {
					[ $name, $value ] = $classOptions->matchVariableStartToEnd( trim( $option ) );
					if ( $name === 'img_class' ) {
						$class = $value;
					}
				}
				$marker = '|class=' . $class . ' layerscreation-' . $token;
			}
			$text = substr( $text, 0, $at ) . $marker . substr( $text, $at );
		}
		self::$tokens[$parser] = $tokens;
	}

	/**
	 * @param mixed $skin
	 * @param mixed $title
	 * @param mixed $file
	 * @param array &$frameParams
	 * @param array &$handlerParams
	 * @param mixed $time
	 * @param mixed &$result
	 * @param mixed $parser
	 * @param mixed $query
	 * @param mixed $widthOption
	 * @return bool
	 */
	public static function onImageBeforeProduceHTML( $skin, $title, $file, array &$frameParams,
		array &$handlerParams, $time, &$result, $parser, $query, $widthOption
	): bool {
		if ( !$parser instanceof Parser || !self::$tokens || !isset( self::$tokens[$parser] ) ) {
			return true;
		}
		$tokens = self::$tokens[$parser];
		$class = $frameParams['class'] ?? '';
		preg_match_all( '/(?:^|\s)layerscreation-([a-f0-9]{32})(?=\s|$)/', $class, $matches );
		$token = null;
		foreach ( $matches[1] as $value ) {
			if ( isset( $tokens[$value] ) ) {
				$token = $value;
			}
		}
		if ( $token === null ) {
			return true;
		}
		$frameParams['class'] = trim( preg_replace_callback(
			'/(?:^|\s)layerscreation-([a-f0-9]{32})(?=\s|$)/',
			static fn ( array $match ): string => isset( $tokens[$match[1]] ) ? '' : $match[0], $class ) );
		$candidate = $tokens[$token];
		if ( !$file instanceof LocalFile || $candidate['target'] !== 'File:' . $file->getName() ||
			!str_starts_with( $file->getMimeType(), 'image/' ) ) {
			return true;
		}
		try {
			if ( PageOwnedBindingOptions::extract( $candidate['options'] ) !== null ) {
				return true;
			}
			$named = PageOwnedBindingOptions::named( $candidate['options'], 'file', $candidate['target'],
				$parser->getRevisionRecordObject()->getPageId() );
			if ( $named === null ) {
				return true;
			}
			$bound = BoundFileHooks::resolveNamed( $parser, $named['pageId'] . ':' . $named['name'],
				$file->getName(), 1, $token );
			if ( !is_array( $bound ) || !isset( $bound['creation'] ) ) {
				return true;
			}
		} catch ( \DomainException | \InvalidArgumentException $error ) {
			return true;
		}
		$previous = self::$renderContext;
		self::$renderContext = [ 'file' => $file, 'bound' => $bound ];
		try {
			$result = Linker::makeImageLink( $parser, $title, $file, $frameParams, $handlerParams, $time,
				$query, $widthOption );
		} finally {
			self::$renderContext = $previous;
		}
		return false;
	}

	/**
	 * @param mixed $thumbnail Native output from the current core render call
	 * @return array|null
	 */
	public static function renderedImage( $thumbnail ): ?array {
		return self::$renderContext && is_object( $thumbnail ) && method_exists( $thumbnail, 'getFile' ) &&
			$thumbnail->getFile() === self::$renderContext['file'] ? self::$renderContext['bound'] : null;
	}

	/**
	 * @param Parser $parser
	 * @param array $named Canonical owner and admitted name
	 * @param string $kind image or slide
	 * @param string|null $target Canonical file title, or slide name
	 * @param string|null $token Private temporary parse marker
	 * @return array|false Public occurrence only
	 */
	public static function missing( Parser $parser, array $named, string $kind, ?string $target,
		?string $token
	) {
		$tokens = self::$tokens && isset( self::$tokens[$parser] ) ? self::$tokens[$parser] : [];
		$candidate = $token === null ? null : ( $tokens[$token] ?? null );
		$revision = $parser->getRevisionRecordObject();
		if ( !$candidate || !$revision || $revision->getPageId() !== $named['pageId'] ||
			$candidate['kind'] !== ( $kind === 'image' ? 'file' : 'slide' ) ||
			( $kind === 'image' && $candidate['target'] !== $target ) ||
			!MigrationState::forParser( $parser ) ) {
			return false;
		}
		if ( $revision->hasSlot( PageRevisionWriter::SLOT ) ) {
			$content = $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW );
			if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ||
				PageOwnedBinding::resolveNamed( $named, json_decode( $content->getText(), true )['surfaces'],
					$kind === 'image' ? 'file' : 'slide', $kind === 'image' ? $target : null ) !== null ) {
				return false;
			}
		}
		if ( $kind === 'image' ) {
			$services = MediaWikiServices::getInstance();
			$title = $services->getTitleFactory()->newFromText( $target );
			$file = $title ? $services->getRepoGroup()->getLocalRepo()->findFile( $title ) : false;
			if ( !$file || !$file->exists() || !str_starts_with( $file->getMimeType(), 'image/' ) ) {
				return false;
			}
		}
		$identity = self::identity( $revision->getPageId(), $revision->getId(), $kind,
			$kind === 'image' ? $target : null, $named['name'] );
		$output = $parser->getOutput();
		$output->setOutputFlag( ParserOutputFlags::VARY_REVISION );
		$entries = $output->getExtensionData( self::DATA_KEY ) ?? [];
		$entries[$identity] ??= [ 'identity' => $identity, 'label' => $named['name'], 'kind' => $kind,
			'fileTitle' => $kind === 'image' ? $target : null ];
		$output->setExtensionData( self::DATA_KEY, $entries );
		$output->addModules( [ 'ext.layers.history' ] );
		return [ 'creation' => $identity, 'noEdit' => in_array( 'noedit',
			array_map( static fn ( string $option ): string => strtolower( trim( explode( '=', $option, 2 )[0] ) ),
				$candidate['options'] ), true ) ];
	}

	/**
	 * @param int $pageId
	 * @param int $revisionId
	 * @param string $kind
	 * @param string|null $fileTitle
	 * @param string $name
	 * @return string
	 */
	public static function identity( int $pageId, int $revisionId, string $kind, ?string $fileTitle,
		string $name
	): string {
		return json_encode( [ $pageId, $revisionId, $kind, $fileTitle, DrawingName::key( $name ) ],
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR );
	}

	/**
	 * @param OutputPage $out
	 * @param ParserOutput $parsed Shared parser cache object; never mutated
	 * @param PageOwnedPilot $pilot
	 */
	public static function output( OutputPage $out, ParserOutput $parsed, PageOwnedPilot $pilot ): void {
		$entries = $parsed->getExtensionData( self::DATA_KEY );
		$request = $out->getRequest();
		if ( !is_array( $entries ) || !$entries || $request->getVal( 'action', 'view' ) !== 'view' ||
			$request->getCheck( 'oldid' ) || $request->getCheck( 'diff' ) ) {
			return;
		}
		$services = MediaWikiServices::getInstance();
		$owner = $out->getTitle();
		$authority = $out->getAuthority();
		$revisionId = $out->getRevisionId();
		$revision = $owner ? $services->getRevisionLookup()->getRevisionByTitle( $owner, 0,
			IDBAccessObject::READ_LATEST ) : null;
		if ( !$revision || $revision->getId() !== $revisionId ||
			!$pilot->getScope()->includesRevision( $owner, $revision ) ||
			!$authority->definitelyCan( 'read', $owner ) ||
			!RevisionRecord::userCanBitfield( $revision->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $revision->getPage() ) ) {
			return;
		}
		$edits = [];
		$selections = $pilot->listCreationOverlaySelections( $revision->getPageId(), $revisionId, $authority );
		foreach ( $selections as $entry ) {
			if ( $entry['kind'] === 'pdf' ) {
				continue;
			}
			$key = self::identity( $revision->getPageId(), $revisionId, $entry['kind'], $entry['fileTitle'],
				$entry['label'] );
			$edits[$key] = SpecialPage::getTitleFor( 'EditLayersPage' )->getLocalURL( $entry['params'] );
		}
		$config = $services->getMainConfig();
		$titles = $services->getTitleFactory();
		$repo = $services->getRepoGroup()->getLocalRepo();
		$new = new NewPageDrawing( new SourceVersionResolver( $repo, $titles ),
			new SourceRenditions( $services->getUrlUtils() ), $repo, $titles, [
				'width' => $config->get( 'LayersSlideDefaultWidth' ),
				'height' => $config->get( 'LayersSlideDefaultHeight' ),
				'backgroundColor' => $config->get( 'LayersSlideDefaultBackground' ) ] );
		$controls = [];
		foreach ( $entries as $key => $entry ) {
			try {
				if ( !is_array( $entry ) || !in_array( $entry['kind'] ?? null, [ 'image', 'slide' ], true ) ||
					self::identity( $revision->getPageId(), $revisionId, $entry['kind'], $entry['fileTitle'],
						$entry['label'] ) !== $key ) {
					continue;
				}
				$prepared = $new->prepare( $revision->getPageId(), $revisionId, [
					'kind' => $entry['kind'] === 'image' ? 'file' : 'slide',
					'target' => $entry['fileTitle'] ?? $entry['label'], 'options' => [] ],
					$entry['label'], $authority );
				$surface = $prepared['surface'];
				if ( $surface['kind'] !== $entry['kind'] ) {
					continue;
				}
				$controls[$key] = [ 'identity' => $key, 'label' => $entry['label'], 'kind' => $entry['kind'],
					'preview' => [ 'kind' => $entry['kind'], 'layers' => [],
						'baseWidth' => $surface['canvas']['width'], 'baseHeight' => $surface['canvas']['height'],
						'backgroundColor' => $surface['canvas']['backgroundColor'],
						'imageUrl' => $prepared['rendition']['url'] ?? null ] ];
				if ( isset( $edits[$key] ) ) {
					$controls[$key]['editUrl'] = $edits[$key];
				}
			} catch ( \DomainException | \InvalidArgumentException $error ) {
				continue;
			}
		}
		if ( $controls ) {
			$out->addJsConfigVars( 'wgLayersCreationOverlays', $controls );
			$out->addModules( 'ext.layers.history' );
		}
	}
}
