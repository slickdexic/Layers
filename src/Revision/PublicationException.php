<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** Stable internal publication failure. Never return the previous exception to clients. */
class PublicationException extends \RuntimeException {
	/** @var array|null Message key and parameters naming only the author's own content */
	private ?array $userMessage = null;

	/**
	 * A refused snapshot that says which of the author's layers, and which property, was refused.
	 *
	 * @param LossyLayerException $e
	 * @return self
	 */
	public static function refusedLayer( LossyLayerException $e ): self {
		$exception = new self( 'layers-invalid-snapshot', 0, $e );
		if ( $e->getLayer() !== null ) {
			$exception->userMessage = $e->getProperty() !== null ?
				[ 'layers-invalid-snapshot-property', $e->getLayer(), $e->getProperty() ] :
				[ 'layers-invalid-snapshot-layer', $e->getLayer() ];
		}
		return $exception;
	}

	/**
	 * @param string $name
	 * @param bool $taken Another drawing on the page already has the name
	 * @return self
	 */
	public static function refusedName( string $name, bool $taken ): self {
		$exception = new self( 'layers-invalid-snapshot' );
		$exception->userMessage = [
			$taken ? 'layers-invalid-snapshot-name-taken' : 'layers-invalid-snapshot-name', $name
		];
		return $exception;
	}

	/** @return array|null Message key followed by its parameters */
	public function getUserMessage(): ?array {
		return $this->userMessage;
	}
}
