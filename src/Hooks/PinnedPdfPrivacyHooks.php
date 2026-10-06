<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Rest\PinnedPdfResponseHeaders;
use MediaWiki\Hook\SetupAfterCacheHook;
use MediaWiki\MainConfigNames;
use MediaWiki\MediaWikiServices;
use MediaWiki\Request\WebRequest;

/** Scoped bootstrap privacy covering PDF refusals before a REST handler runs. */
final class PinnedPdfPrivacyHooks implements SetupAfterCacheHook {
	/** @inheritDoc */
	public function onSetupAfterCache() {
		if ( !defined( 'MW_ENTRY_POINT' ) || MW_ENTRY_POINT !== 'rest' ) {
			return;
		}
		$config = MediaWikiServices::getInstance()->getMainConfig();
		$scriptPath = $config->get( MainConfigNames::ScriptPath );
		self::protectRequest( RequestContext::getMain()->getRequest(),
			$config->get( MainConfigNames::RestPath ) ?: $scriptPath . '/rest.php', $scriptPath );
	}

	/**
	 * Establish native response headers before dispatch, including framework-generated errors.
	 * Only the exact PDF route and its unmatched descendants receive this baseline.
	 * @param WebRequest $request
	 * @param string $restPath Configured native REST prefix
	 * @param string $scriptPath Native script prefix (also accepted by the router)
	 */
	public static function protectRequest( WebRequest $request, string $restPath, string $scriptPath ): void {
		$path = parse_url( $request->getRequestURL(), PHP_URL_PATH );
		if ( !is_string( $path ) ) {
			return;
		}
		foreach ( [ $restPath, $scriptPath . '/rest.php' ] as $prefix ) {
			$endpoint = rtrim( $prefix, '/' ) . '/layers/v0/pdf';
			if ( $path !== $endpoint && !str_starts_with( $path, $endpoint . '/' ) ) {
				continue;
			}
			foreach ( PinnedPdfResponseHeaders::HEADERS as $name => $value ) {
				$request->response()->header( $name . ': ' . $value );
			}
			return;
		}
	}
}
