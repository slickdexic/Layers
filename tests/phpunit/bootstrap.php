<?php

require_once __DIR__ . '/../../vendor/autoload.php';

if ( !class_exists( 'MediaWikiUnitTestCase' ) ) {
	abstract class MediaWikiUnitTestCase extends PHPUnit\Framework\TestCase {
		// Minimal stub so PHPUnit tests can run outside a full MediaWiki install.
	}
}
