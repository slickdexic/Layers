<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Config\HashConfig;
use MediaWiki\Registration\ExtensionRegistry;

/**
 * For tests that register their own slot/model: rebuild services without the host wiki's pilot bootstrap.
 * Using classes must set $installedPilotOverride to null after parent::tearDown().
 */
trait ExcludesInstalledPilot {
	/** @var \Wikimedia\ScopedCallback|null Native registry override, restored during teardown */
	private $installedPilotOverride;

	private function excludeInstalledPilot(): void {
		$registry = ExtensionRegistry::getInstance();
		$hooks = $registry->getAttribute( 'Hooks' );
		$hooks['MediaWikiServices'] = array_values( array_filter( $hooks['MediaWikiServices'] ?? [],
			static fn ( $handler ) => strpos( json_encode( $handler ), 'PageOwnedPilotRegistration' ) === false ) );
		$this->installedPilotOverride = $registry->setAttributeForTest( 'Hooks', $hooks );
		$this->overrideMwServices( new HashConfig( [ 'LayersPageDrawingNamespaces' => [] ] ) );
	}
}
