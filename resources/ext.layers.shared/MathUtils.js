/**
 * MathUtils - Shared mathematical utility functions for the Layers extension.
 *
 * This module provides commonly used math operations to avoid code duplication
 * across renderers and other modules.
 *
 * @module MathUtils
 */
( function () {
	'use strict';

	/**
	 * Clamp an opacity value to the valid range [0, 1].
	 *
	 * @param {*} value - Value to clamp
	 * @return {number} Clamped opacity value (defaults to 1 if invalid)
	 */
	function clampOpacity( value ) {
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	}

	/**
	 * Clamp a numeric value to a specified range.
	 *
	 * @param {number} value - Value to clamp
	 * @param {number} min - Minimum allowed value
	 * @param {number} max - Maximum allowed value
	 * @return {number} Clamped value
	 */
	function clamp( value, min, max ) {
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return min;
		}
		return Math.max( min, Math.min( max, value ) );
	}

	/**
	 * Convert degrees to radians.
	 *
	 * @param {number} degrees - Angle in degrees
	 * @return {number} Angle in radians
	 */
	function degreesToRadians( degrees ) {
		return ( degrees * Math.PI ) / 180;
	}

	/**
	 * Convert radians to degrees.
	 *
	 * @param {number} radians - Angle in radians
	 * @return {number} Angle in degrees
	 */
	function radiansToDegrees( radians ) {
		return ( radians * 180 ) / Math.PI;
	}

	// Create the MathUtils object
	const MathUtils = {
		clampOpacity,
		clamp,
		degreesToRadians,
		radiansToDegrees
	};

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.MathUtils = MathUtils;
	}

	// Export for Node.js/Jest testing
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		// eslint-disable-next-line no-undef
		module.exports = MathUtils;
	}
}() );
