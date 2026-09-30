/* eslint-env node */
/**
 * Layers Extension - Test Wiki Migration Helper (J96)
 *
 * Reads `layerspagehistorymigrated` from MediaWiki API `meta=siteinfo`.
 * When migrated, shared layer sets and slides are read-only and retired.
 *
 * @module tests/e2e/helpers/migration
 */

'use strict';

let cachedStatus = null;

/**
 * Check if the target MediaWiki instance has completed the page history migration.
 *
 * @param {Object} [options]
 * @param {import('@playwright/test').APIRequestContext} [options.request]
 * @param {import('@playwright/test').Page} [options.page]
 * @param {string} [options.base]
 * @return {Promise<boolean>}
 */
async function isWikiMigrated( options = {} ) {
	if ( cachedStatus !== null ) {
		return cachedStatus;
	}

	const base = options.base || options.baseURL || process.env.MW_SERVER || 'http://localhost:8080';

	try {
		if ( options.request ) {
			const res = await options.request.get( `${ base }/api.php`, {
				params: {
					action: 'query',
					meta: 'siteinfo',
					format: 'json',
					formatversion: '2'
				}
			} );
			const data = await res.json();
			const val = data?.query?.general?.layerspagehistorymigrated;
			cachedStatus = Boolean( val === true || val === '' );
			return cachedStatus;
		}

		if ( options.page && options.page.request ) {
			const res = await options.page.request.get( `${ base }/api.php`, {
				params: {
					action: 'query',
					meta: 'siteinfo',
					format: 'json',
					formatversion: '2'
				}
			} );
			const data = await res.json();
			const val = data?.query?.general?.layerspagehistorymigrated;
			cachedStatus = Boolean( val === true || val === '' );
			return cachedStatus;
		}

		const res = await fetch( `${ base }/api.php?action=query&meta=siteinfo&format=json&formatversion=2` );
		const data = await res.json();
		const val = data?.query?.general?.layerspagehistorymigrated;
		cachedStatus = Boolean( val === true || val === '' );
		return cachedStatus;
	} catch ( _err ) {
		return false;
	}
}

/**
 * Reset cached status (for testing)
 */
function resetMigrationCache() {
	cachedStatus = null;
}

module.exports = {
	isWikiMigrated,
	resetMigrationCache
};
