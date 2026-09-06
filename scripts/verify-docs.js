#!/usr/bin/env node
/* eslint-env node */
'use strict';

// Check maintained documentation; historical records intentionally retain old paths.
const fs = require( 'fs' );
const path = require( 'path' );
const { execFileSync } = require( 'child_process' );
const root = path.resolve( __dirname, '..' );
const read = ( file ) => fs.readFileSync( path.join( root, file ), 'utf8' ).replace( /\r/g, '' );
const files = [ ...new Set( execFileSync( 'git', [
	'ls-files', '--cached', '--others', '--exclude-standard'
], { cwd: root, encoding: 'utf8' } ).trim().split( '\n' ) ) ];
const errors = [];
const docs = files.filter( ( file ) => /\.(md|mediawiki)$/.test( file ) &&
	!file.startsWith( 'node_modules/' ) && !file.startsWith( 'vendor/' ) );
let currentCount = 0;
let historicalCount = 0;
for ( const file of docs ) {
	const text = read( file );
	if ( file.startsWith( 'docs/archive/' ) || text.includes( '**Historical record:**' ) ||
		[ 'codebase_review.md', 'CHANGELOG.md', 'wiki/Changelog.md',
			'docs/DOCUMENTATION_REVIEW_REPORT.md', 'improvement_plan.md' ].includes( file ) ) {
		historicalCount++;
		continue;
	}
	currentCount++;
	// Examples can contain intentional placeholder paths. Anchor-only links are not checked.
	const prose = text.replace( /```[\s\S]*?```/g, '' )
		.replace( /<syntaxhighlight\b[^>]*>[\s\S]*?<\/syntaxhighlight>/g, '' )
		.replace( /`[^`\n]*`/g, '' );
	for ( const match of prose.matchAll( /!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g ) ) {
		const target = match[ 1 ].replace( /^<|>$/g, '' );
		if ( /^(?:[a-z]+:|#|\/)/i.test( target ) ) {
			continue;
		}
		const clean = decodeURIComponent( target.split( /[?#]/ )[ 0 ] );
		if ( clean && !fs.existsSync( path.resolve( root, path.dirname( file ), clean ) ) ) {
			errors.push( `${ file }: missing local target ${ target }` );
		}
	}
	if ( file.startsWith( 'wiki/' ) ) {
		for ( const match of prose.matchAll( /\[\[([^\]\n]+)\]\]/g ) ) {
			if ( match[ 1 ].includes( ':' ) ) {
				continue;
			}
			const target = match[ 1 ].split( '|' ).pop().split( '#' )[ 0 ].trim().replace( / /g, '-' );
			// File/Slide markup examples are not GitHub wiki page links.
			if ( target.includes( ':' ) ) {
				continue;
			}
			if ( !fs.existsSync( path.join( root, 'wiki', target + '.md' ) ) ) {
				errors.push( `${ file }: missing wiki page ${ target }` );
			}
		}
	}
}
for ( const [ source, mirror ] of [
	[ 'CHANGELOG.md', 'wiki/Changelog.md' ],
	[ 'docs/CURRENT_STATUS.md', 'wiki/Current-Status.md' ]
] ) {
	if ( read( source ) !== read( mirror ) ) {
		errors.push( `${ mirror } differs from ${ source }` );
	}
}
const manifest = JSON.parse( read( 'extension.json' ) );
for ( const name of Object.keys( manifest.config ) ) {
	if ( !read( 'wiki/Configuration-Reference.md' ).includes( '$wg' + name ) ) {
		errors.push( `Configuration reference omits ${ name }` );
	}
}
for ( const name of Object.keys( manifest.APIModules ) ) {
	if ( !read( 'wiki/API-Reference.md' ).includes( '### ' + name + ' ' ) ) {
		errors.push( `API reference omits ${ name }` );
	}
}
for ( const file of docs.filter( ( name ) => name.endsWith( '.mediawiki' ) ) ) {
	const text = read( file );
	for ( const tag of [ 'syntaxhighlight', 'nowiki' ] ) {
		const opening = ( text.match( new RegExp( '<' + tag + '(?:\\s[^>]*)?>', 'g' ) ) || [] ).length;
		const closing = ( text.match( new RegExp( '</' + tag + '>', 'g' ) ) || [] ).length;
		if ( opening !== closing ) {
			errors.push( `${ file }: unbalanced ${ tag } tags` );
		}
	}
}
for ( const column of read( 'sql/tables/layer_sets.sql' ).matchAll( /^\s+(ls_\w+)\s+\w+/gm ) ) {
	if ( !read( 'Mediawiki-layer_sets-table.mediawiki' ).includes( '<code>' + column[ 1 ] + '</code>' ) ) {
		errors.push( `MediaWiki schema reference omits ${ column[ 1 ] }` );
	}
}
if ( errors.length ) {
	console.error( errors.join( '\n' ) );
	process.exitCode = 1;
} else {
	console.log( `Documentation checks passed: ${ currentCount } maintained/policy documents, ${ historicalCount } historical records; mirrors, references and MediaWiki source checks agree.` );
}
