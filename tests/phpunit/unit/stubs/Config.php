<?php

abstract class Config {
	/**
	 * @param string $name
	 * @return mixed
	 */
	abstract public function get( $name );
}
