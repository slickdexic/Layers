<?php

namespace MediaWiki\Extension\Layers\Api\Traits;

trait LayersContinuationTrait {
	/**
	 * Parse the continue parameter into an offset integer.
	 *
	 * @param string $continue
	 * @return int
	 */
	protected function parseContinueParameter( string $continue ): int {
		if ( strpos( $continue, 'offset|' ) === 0 ) {
			$parts = explode( '|', $continue );
			$offset = (int)( $parts[1] ?? 0 );
			return max( 0, $offset );
		}
		return max( 0, (int)$continue );
	}

	/**
	 * Build a continue parameter for the next offset.
	 *
	 * @param int $offset
	 * @return string
	 */
	protected function formatContinueParameter( int $offset ): string {
		return 'offset|' . max( 0, $offset );
	}
}
