<?php

require_once __DIR__ . '/Config.php';

class HashConfig extends Config {
	/** @var array */
	private $settings;

	/**
	 * @param array $settings
	 */
	public function __construct( array $settings ) {
		$this->settings = $settings;
	}

	/**
	 * @param string $name
	 * @return mixed
	 */
	public function get( $name ) {
		return $this->settings[$name] ?? null;
	}
}
