/**
 * Global type declarations for Layers extension
 * Shared across all TypeScript modules
 */

import { BoundsCalculator } from './BoundsCalculator';
import { deepClone, deepCloneArray, deepCloneLayer } from './DeepClone';

/**
 * MediaWiki mw global
 */
declare global {
	const mw: {
		log?: {
			warn?: ( message: string, error?: string ) => void;
		};
	} | undefined;

	interface Window {
		Layers?: LayersNamespace;
	}
}

/**
 * Layers namespace structure
 */
export interface LayersNamespace {
	Utils?: LayersUtils;
}

/**
 * Layers.Utils namespace
 */
export interface LayersUtils {
	// DeepClone exports
	deepClone?: typeof deepClone;
	deepCloneArray?: typeof deepCloneArray;
	deepCloneLayer?: typeof deepCloneLayer;

	// BoundsCalculator exports
	BoundsCalculator?: typeof BoundsCalculator;
}

export {};
