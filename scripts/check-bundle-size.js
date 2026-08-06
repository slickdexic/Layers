/**
 * Enforces the per-ResourceLoader-module size budgets in `bundlesize.config.json`.
 *
 * The budgets existed as a JSON file for a long time with nothing reading them,
 * so every one of them had quietly been exceeded. This script closes that loop:
 * it resolves each module's `scripts`, `styles` and `packageFiles` entries from
 * `extension.json`, sums the on-disk bytes, and fails if a module is over budget.
 * A budget may instead list `files` directly, for static assets that are fetched
 * by URL rather than through ResourceLoader.
 *
 * Raw source bytes are measured deliberately. ResourceLoader minifies and gzips
 * at request time with settings this repo does not control, so raw size is the
 * only figure that is reproducible offline — and it is the figure that actually
 * grows when someone adds code.
 *
 * Usage:
 *   node scripts/check-bundle-size.js            # enforce budgets
 *   node scripts/check-bundle-size.js --report   # print sizes, never fail
 */
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const projectRoot = path.resolve( __dirname, '..' );
const extension = JSON.parse( fs.readFileSync( path.join( projectRoot, 'extension.json' ), 'utf8' ) );
const budgets = JSON.parse( fs.readFileSync( path.join( projectRoot, 'bundlesize.config.json' ), 'utf8' ) );

const KB = 1024;
const FILE_KEYS = [ 'scripts', 'styles', 'packageFiles' ];

/**
 * Parse a "123 KB" / "1.4 MB" budget string into bytes.
 *
 * @param {string} value Human-readable size.
 * @return {number} Size in bytes.
 */
function parseSize( value ) {
	const match = /^\s*([\d.]+)\s*(B|KB|MB)\s*$/i.exec( String( value ) );
	if ( !match ) {
		throw new Error( 'Unparseable maxSize "' + value + '" in bundlesize.config.json' );
	}
	const scale = { b: 1, kb: KB, mb: KB * KB }[ match[ 2 ].toLowerCase() ];
	return parseFloat( match[ 1 ] ) * scale;
}

/**
 * Format bytes for human output.
 *
 * @param {number} bytes Size in bytes.
 * @return {string} Formatted size.
 */
function formatSize( bytes ) {
	return ( bytes / KB ).toFixed( 1 ) + ' KB';
}

/**
 * Collect every file path a ResourceLoader module ships.
 *
 * `styles` may be an array or an object keyed by path; `packageFiles` entries may
 * be strings or `{ name, file }` objects. Non-file package entries (`callback`,
 * `config`, `main`-only records) contribute no bytes and are skipped.
 *
 * @param {Object} module A ResourceModules entry.
 * @return {string[]} Absolute file paths.
 */
function collectFiles( module ) {
	const base = path.join( projectRoot, module.localBasePath || '' );
	const files = [];

	for ( const key of FILE_KEYS ) {
		const value = module[ key ];
		if ( !value ) {
			continue;
		}
		const entries = Array.isArray( value ) ? value : Object.keys( value );
		for ( const entry of entries ) {
			if ( typeof entry === 'string' ) {
				files.push( path.join( base, entry ) );
			} else if ( entry && typeof entry.file === 'string' ) {
				files.push( path.join( base, entry.file ) );
			}
		}
	}

	return files;
}

function main() {
	const reportOnly = process.argv.includes( '--report' );
	const failures = [];
	const rows = [];

	for ( const budget of budgets ) {
		let files;
		if ( budget.files ) {
			// Static assets served by URL rather than through ResourceLoader.
			files = budget.files.map( ( file ) => path.join( projectRoot, file ) );
		} else {
			const module = extension.ResourceModules[ budget.resourceModule ];
			if ( !module ) {
				failures.push( 'Unknown resourceModule "' + budget.resourceModule + '" in bundlesize.config.json' );
				continue;
			}
			files = collectFiles( module );
		}
		const label = budget.name || budget.resourceModule;

		const max = parseSize( budget.maxSize );
		let total = 0;
		for ( const file of files ) {
			if ( !fs.existsSync( file ) ) {
				failures.push(
					label + ' references a missing file: ' +
					path.relative( projectRoot, file )
				);
				continue;
			}
			total += fs.statSync( file ).size;
		}

		const over = total > max;
		rows.push( {
			name: label,
			total: total,
			max: max,
			over: over
		} );
		if ( over ) {
			failures.push(
				label + ' is ' + formatSize( total ) + ', over its ' +
				formatSize( max ) + ' budget by ' + formatSize( total - max ) + '.'
			);
		}
	}

	console.log( '\n📦 ResourceLoader bundle size' );
	console.log( '=============================\n' );
	for ( const row of rows ) {
		const pct = ( ( row.total / row.max ) * 100 ).toFixed( 0 );
		console.log(
			( row.over ? '  ✗ ' : '  ✓ ' ) + row.name.padEnd( 20 ) +
			formatSize( row.total ).padStart( 10 ) + ' / ' + formatSize( row.max ).padStart( 10 ) +
			'  (' + pct + '%)'
		);
	}
	console.log( '' );

	if ( !failures.length ) {
		console.log( '✅ All modules are within budget.\n' );
		return;
	}

	for ( const failure of failures ) {
		console.log( ( reportOnly ? '  ! ' : '  ✗ ' ) + failure );
	}
	console.log(
		'\nIf the growth is intentional, raise the budget in bundlesize.config.json ' +
		'in the same commit and say why in the note.\n'
	);
	if ( !reportOnly ) {
		process.exitCode = 1;
	}
}

main();
