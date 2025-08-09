<?php
/**
 * EditLayersAction - dedicated Action to render the Layers editor
 */

namespace {
	if ( !class_exists( 'Action' ) ) {
		class Action {
			public function getName() { return ''; }
			public function requiresWrite() { return false; }
			public function requiresUnblock() { return false; }
			public function show() {}
			// Minimal shims for static analysis/tools outside MediaWiki
			public function getOutput() {
				return new class {
					public function showErrorPage( $a = null, $b = null ) {}
					public function setPageTitle( $t ) {}
					public function addModules( $m ) {}
					public function addHTML( $h ) {}
					public function addInlineScript( $s ) {}
					public function addJsConfigVars( $key, $value = null ) {}
					public function setArticleBodyOnly( $b ) {}
				};
			}
			public function getUser() {
				return new class {
					public function isAllowed( $right ) { return true; }
				};
			}
			public function getTitle() {
				return new class {
					public function inNamespace( $ns ) { return true; }
				};
			}
		}
	}
}

namespace MediaWiki\Extension\Layers\Action {

use MediaWiki\Extension\Layers\Database\LayersDatabase;

class EditLayersAction extends \Action {
	/** @inheritDoc */
	public function getName() {
		return 'editlayers';
	}

	/** @inheritDoc */
	public function requiresWrite() {
		return false;
	}

	/** @inheritDoc */
	public function requiresUnblock() {
		return false;
	}

	/** @inheritDoc */
	public function show() {
		$out = $this->getOutput();
		$user = $this->getUser();
		$title = $this->getTitle();

		if ( !$user->isAllowed( 'editlayers' ) ) {
			$out->showErrorPage( 'permissionserrorstext-withaction', 'layers-editor-title' );
			return;
		}

		if ( !$title || !$title->inNamespace( NS_FILE ) ) {
			$out->showErrorPage( 'error', 'layers-not-file-page' );
			return;
		}

		$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
			? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
			: null;
		$repoGroup = $services ? $services->getRepoGroup() : null;
		$file = $repoGroup ? $repoGroup->findFile( $title ) : null;
		if ( !$file || !$file->exists() ) {
			$out->showErrorPage( 'error', 'layers-file-not-found' );
			return;
		}

		// Page title
		$out->setPageTitle( ( function_exists( 'wfMessage' ) ? wfMessage( 'layers-editor-title' )->text() : 'Edit Layers' ) . ': ' . $file->getName() );

		// Load editor module
		$out->addModules( 'ext.layers.editor' );


		// Init config via JS config vars; module will bootstrap itself
		$fileUrl = $this->getPublicImageUrl( $file );
		$out->addJsConfigVars( 'wgLayersEditorInit', [
			'filename' => $file->getName(),
			'imageUrl' => $fileUrl,
		] );

	}

	/**
	 * Resolve a best-effort public URL for the image, with a robust fallback for private repos.
	 * @param mixed $file
	 * @return string
	 */
	private function getPublicImageUrl( $file ): string {
		try {
			if ( method_exists( $file, 'getFullUrl' ) ) {
				$direct = $file->getFullUrl();
				if ( is_string( $direct ) && $direct !== '' ) {
					return $direct;
				}
			}
		} catch ( \Throwable $e ) {
			// ignore and try fallback
		}

		// Fallback via Special:Redirect/file
		try {
			$title = method_exists( $file, 'getTitle' ) ? $file->getTitle() : null;
			if ( $title && \class_exists( '\\SpecialPage' ) ) {
				$param = 'file/' . $title->getPrefixedDBkey();
				$spTitle = \call_user_func( [ '\\SpecialPage', 'getTitleFor' ], 'Redirect', $param );
				if ( $spTitle ) {
					return $spTitle->getLocalURL();
				}
			}
		} catch ( \Throwable $e ) {
			// last resort below
		}

		return method_exists( $file, 'getUrl' ) ? (string)$file->getUrl() : '';
	}
}
}
