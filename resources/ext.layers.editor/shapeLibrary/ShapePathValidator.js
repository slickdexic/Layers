/* eslint-env node */
/**
 * ShapePathValidator - Security gate for SVG path data
 *
 * Validates that path data contains only safe drawing commands
 * with no possibility of script injection or malicious content.
 *
 * @class
 */
class ShapePathValidator {
	/**
	 * Valid SVG path commands (case-insensitive handled by regex)
	 * M = moveto, L = lineto, H = horizontal lineto, V = vertical lineto
	 * C = curveto, S = smooth curveto, Q = quadratic bezier, T = smooth quadratic
	 * A = elliptical arc, Z = closepath
	 *
	 * @static
	 * @type {RegExp}
	 */
	static VALID_PATH_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-+eE]+$/;

	/**
	 * Maximum allowed path length (10KB should handle even complex shapes)
	 *
	 * @static
	 * @type {number}
	 */
	static MAX_PATH_LENGTH = 10000;

	/**
	 * Maximum number of commands in a path
	 *
	 * @static
	 * @type {number}
	 */
	static MAX_COMMAND_COUNT = 2000;

	/**
	 * Validate a path data string
	 *
	 * @param {string} path - SVG path data string
	 * @returns {Object} Validation result with isValid and error properties
	 */
	validate( path ) {
		// Type check
		if ( typeof path !== 'string' ) {
			return {
				isValid: false,
				error: 'Path must be a string'
			};
		}

		// Empty check
		if ( path.trim().length === 0 ) {
			return {
				isValid: false,
				error: 'Path cannot be empty'
			};
		}

		// Length check
		if ( path.length > ShapePathValidator.MAX_PATH_LENGTH ) {
			return {
				isValid: false,
				error: `Path exceeds maximum length of ${ ShapePathValidator.MAX_PATH_LENGTH } characters`
			};
		}

		// Character whitelist check - this is the main security gate
		if ( !ShapePathValidator.VALID_PATH_PATTERN.test( path ) ) {
			return {
				isValid: false,
				error: 'Path contains invalid characters'
			};
		}

		// Command count check (prevent DoS via extremely complex paths)
		const commandCount = this.countCommands( path );
		if ( commandCount > ShapePathValidator.MAX_COMMAND_COUNT ) {
			return {
				isValid: false,
				error: `Path exceeds maximum of ${ ShapePathValidator.MAX_COMMAND_COUNT } commands`
			};
		}

		// Syntax validation - ensure path starts with a move command
		if ( !this.startsWithMoveCommand( path ) ) {
			return {
				isValid: false,
				error: 'Path must start with a moveto command (M or m)'
			};
		}

		return {
			isValid: true,
			error: null
		};
	}

	/**
	 * Quick validation check (boolean only)
	 *
	 * @param {string} path - SVG path data string
	 * @returns {boolean} True if path is valid
	 */
	isValid( path ) {
		return this.validate( path ).isValid;
	}

	/**
	 * Count the number of commands in a path
	 *
	 * @private
	 * @param {string} path - SVG path data string
	 * @returns {number} Number of commands
	 */
	countCommands( path ) {
		// Commands are letters, count them
		const matches = path.match( /[MmLlHhVvCcSsQqTtAaZz]/g );
		return matches ? matches.length : 0;
	}

	/**
	 * Check if path starts with a move command
	 *
	 * @private
	 * @param {string} path - SVG path data string
	 * @returns {boolean} True if starts with M or m
	 */
	startsWithMoveCommand( path ) {
		const trimmed = path.trim();
		return trimmed.length > 0 && ( trimmed[ 0 ] === 'M' || trimmed[ 0 ] === 'm' );
	}

	/**
	 * Sanitize a path by removing any invalid characters
	 * Use with caution - prefer rejection over sanitization
	 *
	 * @param {string} path - SVG path data string
	 * @returns {string|null} Sanitized path or null if unsalvageable
	 */
	sanitize( path ) {
		if ( typeof path !== 'string' ) {
			return null;
		}

		// Remove anything that's not a valid path character
		const sanitized = path.replace( /[^MmLlHhVvCcSsQqTtAaZz0-9\s,.\-+eE]/g, '' ).trim();

		// Validate the result
		if ( this.isValid( sanitized ) ) {
			return sanitized;
		}

		return null;
	}

	/**
	 * Validate a viewBox array
	 *
	 * @param {Array<number>} viewBox - [minX, minY, width, height]
	 * @returns {Object} Validation result
	 */
	validateViewBox( viewBox ) {
		if ( !Array.isArray( viewBox ) ) {
			return {
				isValid: false,
				error: 'viewBox must be an array'
			};
		}

		if ( viewBox.length !== 4 ) {
			return {
				isValid: false,
				error: 'viewBox must have exactly 4 values'
			};
		}

		for ( let i = 0; i < 4; i++ ) {
			if ( typeof viewBox[ i ] !== 'number' || !isFinite( viewBox[ i ] ) ) {
				return {
					isValid: false,
					error: 'viewBox values must be finite numbers'
				};
			}
		}

		// Width and height must be positive
		if ( viewBox[ 2 ] <= 0 || viewBox[ 3 ] <= 0 ) {
			return {
				isValid: false,
				error: 'viewBox width and height must be positive'
			};
		}

		return {
			isValid: true,
			error: null
		};
	}

	/**
	 * Validate a complete shape definition
	 *
	 * @param {Object} shape - Shape definition object
	 * @returns {Object} Validation result with details
	 */
	validateShape( shape ) {
		const errors = [];

		if ( !shape || typeof shape !== 'object' ) {
			return {
				isValid: false,
				errors: [ 'Shape must be an object' ]
			};
		}

		// Required: id
		if ( typeof shape.id !== 'string' || shape.id.trim().length === 0 ) {
			errors.push( 'Shape must have a non-empty string id' );
		}

		// Required: path
		const pathResult = this.validate( shape.path );
		if ( !pathResult.isValid ) {
			errors.push( `Invalid path: ${ pathResult.error }` );
		}

		// Required: viewBox
		const viewBoxResult = this.validateViewBox( shape.viewBox );
		if ( !viewBoxResult.isValid ) {
			errors.push( `Invalid viewBox: ${ viewBoxResult.error }` );
		}

		// Optional but must be valid if present: name
		if ( shape.name !== undefined && typeof shape.name !== 'string' ) {
			errors.push( 'Shape name must be a string' );
		}

		// Optional but must be valid if present: category
		if ( shape.category !== undefined && typeof shape.category !== 'string' ) {
			errors.push( 'Shape category must be a string' );
		}

		// Optional but must be valid if present: tags
		if ( shape.tags !== undefined ) {
			if ( !Array.isArray( shape.tags ) ) {
				errors.push( 'Shape tags must be an array' );
			} else if ( !shape.tags.every( ( t ) => typeof t === 'string' ) ) {
				errors.push( 'All shape tags must be strings' );
			}
		}

		return {
			isValid: errors.length === 0,
			errors: errors
		};
	}
}

// Export for ResourceLoader
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = ShapePathValidator;
}
