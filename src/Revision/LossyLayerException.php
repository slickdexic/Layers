<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** A layer the save-time validator would refuse or change; names only the author's own layer and key. */
class LossyLayerException extends \InvalidArgumentException {
	private ?string $layer;
	private ?string $property;

	/**
	 * @param string|null $layer Layer name or ID; null when the limit applies to the whole drawing
	 * @param string|null $property Property the server would drop or rewrite; null when the layer is refused
	 */
	public function __construct( ?string $layer = null, ?string $property = null ) {
		parent::__construct( 'invalid-or-lossy-layer-data' );
		$this->layer = $layer;
		$this->property = $property;
	}

	public function getLayer(): ?string {
		return $this->layer;
	}

	public function getProperty(): ?string {
		return $this->property;
	}
}
