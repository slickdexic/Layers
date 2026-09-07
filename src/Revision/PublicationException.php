<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** Stable internal publication failure. Never return the previous exception to clients. */
class PublicationException extends \RuntimeException {
}
