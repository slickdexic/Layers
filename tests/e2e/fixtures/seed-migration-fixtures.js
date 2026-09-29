/**
 * J93 Seeder: Seed migration fixtures on the test wiki (D3 / HIST-8)
 *
 * Creates a repeatable, idempotent fixture set covering every case of the D3 migration design:
 * - Files:
 *   - Layers migration fixture A.png: sets anatomy and labels (saved 3 times, saved last)
 *   - Layers migration fixture B.pdf: 3-page PDF with set notes on pages 1 and 3 only
 *   - Layers migration fixture C.png: version 1 has set old, replacement version 2 has no sets
 * - Slides:
 *   - Layers migration fixture slide one: embedded by Slides 1 and Slides 2
 *   - Layers migration fixture slide two: shown nowhere
 * - Pages:
 *   - Layers migration fixture/Direct: embeds A (anatomy x2, on, off, bare) and B (p1 notes, p3 notes)
 *   - Layers migration fixture/Slides 1: embeds slide one
 *   - Layers migration fixture/Slides 2: embeds slide one
 *   - Template:Layers migration fixture frame: template embedding A with layerset=anatomy
 *   - Layers migration fixture/Template: uses {{Layers migration fixture frame}}
 *   - Layers migration fixture/Taken: embeds A with layerset=anatomy and owns drawing "anatomy"
 *   - Layers migration fixture/Uses C: embeds C with layerset=old
 *   - Project:Layers migration fixture: embeds A with layerset=anatomy
 */

/* eslint-env node */
const fs = require( 'fs' );
const path = require( 'path' );
const zlib = require( 'zlib' );

/**
 * Generate a valid, uncompressed truecolor PNG buffer without external dependencies.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @return {Buffer}
 */
function makePng( width, height, r, g, b ) {
	const chunk = ( type, data ) => {
		const typeBuf = Buffer.from( type, 'ascii' );
		const lenBuf = Buffer.alloc( 4 );
		lenBuf.writeUInt32BE( data.length, 0 );
		const crcVal = zlib.crc32( Buffer.concat( [ typeBuf, data ] ) );
		const crcBuf = Buffer.alloc( 4 );
		crcBuf.writeUInt32BE( crcVal, 0 );
		return Buffer.concat( [ lenBuf, typeBuf, data, crcBuf ] );
	};
	const scanlineLen = 1 + width * 3;
	const rawData = Buffer.alloc( height * scanlineLen );
	for ( let y = 0; y < height; y++ ) {
		const rowOffset = y * scanlineLen;
		rawData[ rowOffset ] = 0;
		for ( let x = 0; x < width; x++ ) {
			const pxOffset = rowOffset + 1 + x * 3;
			rawData[ pxOffset ] = r;
			rawData[ pxOffset + 1 ] = g;
			rawData[ pxOffset + 2 ] = b;
		}
	}
	const ihdr = Buffer.alloc( 13 );
	ihdr.writeUInt32BE( width, 0 );
	ihdr.writeUInt32BE( height, 4 );
	ihdr[ 8 ] = 8;
	ihdr[ 9 ] = 2; // RGB
	ihdr[ 10 ] = 0;
	ihdr[ 11 ] = 0;
	ihdr[ 12 ] = 0;
	const idat = zlib.deflateSync( rawData );
	return Buffer.concat( [
		Buffer.from( [ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ] ),
		chunk( 'IHDR', ihdr ),
		chunk( 'IDAT', idat ),
		chunk( 'IEND', Buffer.alloc( 0 ) )
	] );
}

/**
 * Generate a valid, uncompressed multipage PDF buffer without external dependencies.
 * Follows tests/fixtures/assets/generate.php.
 *
 * @param {Array<{width: number, height: number, label: string}>} pages
 * @return {Buffer}
 */
function generateMultipagePdf( pages ) {
	const pageCount = pages.length;
	const kids = [];
	for ( let i = 0; i < pageCount; i++ ) {
		kids.push( `${ i + 3 } 0 R` );
	}
	const fontObjNum = pageCount + 3;
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		`<< /Type /Pages /Kids [${ kids.join( ' ' ) }] /Count ${ pageCount } >>`
	];
	for ( let i = 0; i < pageCount; i++ ) {
		const contentObjNum = fontObjNum + 1 + i;
		const w = pages[ i ].width;
		const h = pages[ i ].height;
		objects.push( `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ w } ${ h }] ` +
			`/Resources << /Font << /F1 ${ fontObjNum } 0 R >> >> /Contents ${ contentObjNum } 0 R >>` );
	}
	objects.push( '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' );
	for ( let i = 0; i < pageCount; i++ ) {
		const label = pages[ i ].label;
		const stream = `BT /F1 12 Tf 10 40 Td (${ label }) Tj ET\n`;
		objects.push( `<< /Length ${ Buffer.byteLength( stream ) } >>\nstream\n${ stream }endstream` );
	}
	let result = '%PDF-1.4\n';
	const offsets = [];
	for ( let i = 0; i < objects.length; i++ ) {
		offsets.push( Buffer.byteLength( result ) );
		result += `${ i + 1 } 0 obj\n${ objects[ i ] }\nendobj\n`;
	}
	const xref = Buffer.byteLength( result );
	const size = objects.length + 1;
	result += `xref\n0 ${ size }\n0000000000 65535 f \n`;
	for ( let i = 0; i < offsets.length; i++ ) {
		result += `${ String( offsets[ i ] ).padStart( 10, '0' ) } 00000 n \n`;
	}
	result += `trailer\n<< /Size ${ size } /Root 1 0 R >>\nstartxref\n${ xref }\n%%EOF\n`;
	return Buffer.from( result, 'binary' );
}

class MigrationFixtureSeeder {
	constructor( base, username, password ) {
		this.base = base;
		this.username = username;
		this.password = password;
		this.cookieJar = {};
		this.csrfToken = null;
		this.createdRevisions = [];
	}

	getCookieHeader() {
		return Object.entries( this.cookieJar ).map( ( [ k, v ] ) => `${ k }=${ v }` ).join( '; ' );
	}

	saveCookies( res ) {
		const raw = res.headers.get( 'set-cookie' );
		if ( raw ) {
			const parts = raw.split( /,\s*(?=[a-zA-Z0-9_-]+=)/ );
			for ( const p of parts ) {
				const m = p.match( /^([^=]+)=([^;]+)/ );
				if ( m ) {
					this.cookieJar[ m[ 1 ].trim() ] = m[ 2 ].trim();
				}
			}
		}
	}

	async api( params, method = 'GET', body = null ) {
		const url = new URL( '/api.php', this.base );
		let reqBody = body;
		const headers = { Cookie: this.getCookieHeader() };

		if ( method === 'GET' ) {
			for ( const [ k, v ] of Object.entries( params ) ) {
				url.searchParams.set( k, v );
			}
			url.searchParams.set( 'format', 'json' );
		} else if ( body instanceof FormData ) {
			// FormData sets its own multipart Content-Type
		} else {
			const p = new URLSearchParams( { ...params, format: 'json' } );
			headers[ 'Content-Type' ] = 'application/x-www-form-urlencoded';
			reqBody = p;
		}

		const res = await fetch( url.toString(), {
			method,
			headers,
			body: reqBody
		} );
		this.saveCookies( res );
		const data = await res.json();
		if ( data.error ) {
			throw new Error( `API error [${ data.error.code }]: ${ data.error.info }` );
		}
		return data;
	}

	async login() {
		const tokenRes = await this.api( { action: 'query', meta: 'tokens', type: 'login' } );
		const loginToken = tokenRes.query.tokens.logintoken;

		const loginRes = await this.api( {
			action: 'login',
			lgname: this.username,
			lgpassword: this.password,
			lgtoken: loginToken
		}, 'POST' );
		if ( loginRes.login?.result !== 'Success' ) {
			throw new Error( `Login failed: ${ JSON.stringify( loginRes ) }` );
		}

		const csrfRes = await this.api( { action: 'query', meta: 'tokens', type: 'csrf' } );
		this.csrfToken = csrfRes.query.tokens.csrftoken;
		if ( !this.csrfToken ) {
			throw new Error( 'Failed to obtain CSRF token' );
		}
	}

	async checkFile( filename ) {
		const res = await this.api( {
			action: 'query',
			titles: `File:${ filename }`,
			prop: 'imageinfo',
			iiprop: 'timestamp|sha1|size|dimensions',
			iilimit: '5'
		} );
		const page = Object.values( res.query.pages )[ 0 ];
		if ( page.missing !== undefined ) {
			return null;
		}
		return page.imageinfo || [];
	}

	async uploadFile( filename, buffer, mimeType, comment ) {
		const form = new FormData();
		form.append( 'action', 'upload' );
		form.append( 'filename', filename );
		form.append( 'token', this.csrfToken );
		form.append( 'ignorewarnings', '1' );
		form.append( 'comment', comment );
		form.append( 'file', new Blob( [ buffer ], { type: mimeType } ), filename );
		form.append( 'format', 'json' );

		const res = await this.api( {}, 'POST', form );
		if ( res.upload?.result !== 'Success' ) {
			throw new Error( `Upload of ${ filename } failed: ${ JSON.stringify( res ) }` );
		}
		return res.upload;
	}

	async getLayersInfo( params ) {
		try {
			const res = await this.api( {
				action: 'layersinfo',
				...params
			} );
			return res.layersinfo || null;
		} catch ( e ) {
			return null;
		}
	}

	async saveLayerSet( filename, setname, page, layerData ) {
		const res = await this.api( {
			action: 'layerssave',
			filename,
			setname,
			page: String( page ),
			data: JSON.stringify( layerData ),
			token: this.csrfToken
		}, 'POST' );
		if ( !res.layerssave?.success ) {
			throw new Error( `layerssave failed for ${ filename } set ${ setname }: ${ JSON.stringify( res ) }` );
		}
		return res.layerssave.layersetid;
	}

	async saveSlide( slidename, setname, slideData ) {
		const params = {
			action: 'layerssave',
			slidename,
			data: JSON.stringify( slideData ),
			token: this.csrfToken
		};
		if ( setname ) {
			params.setname = setname;
		}
		const res = await this.api( params, 'POST' );
		if ( !res.layerssave?.success ) {
			throw new Error( `layerssave failed for slide ${ slidename }: ${ JSON.stringify( res ) }` );
		}
		return res.layerssave.layersetid;
	}

	async getPage( title ) {
		const res = await this.api( {
			action: 'query',
			titles: title,
			prop: 'info|revisions',
			rvprop: 'ids|content',
			rvslots: 'main|layers'
		} );
		const page = Object.values( res.query.pages )[ 0 ];
		if ( page.missing !== undefined ) {
			return null;
		}
		const rev = page.revisions?.[ 0 ];
		const main = rev?.slots?.main?.content ?? rev?.slots?.main?.[ '*' ] ?? '';
		const layers = rev?.slots?.layers?.content ?? rev?.slots?.layers?.[ '*' ] ?? null;
		return {
			pageid: page.pageid,
			revid: rev?.revid,
			main,
			hasLayersSlot: Boolean( rev?.slots?.layers ),
			layersContent: layers
		};
	}

	async editPage( title, text, summary ) {
		const res = await this.api( {
			action: 'edit',
			title,
			text,
			summary,
			token: this.csrfToken
		}, 'POST' );
		if ( res.edit?.result !== 'Success' ) {
			throw new Error( `Edit of ${ title } failed: ${ JSON.stringify( res ) }` );
		}
		const revid = res.edit.newrevid;
		if ( revid ) {
			this.createdRevisions.push( { title, revid, type: 'wikitext edit' } );
		}
		return res.edit;
	}

	async publishDrawing( owner, pageid, baserevid, documentObj, summary ) {
		const res = await this.api( {
			action: 'layerspublish',
			owner,
			pageid: String( pageid ),
			baserevid: String( baserevid ),
			data: JSON.stringify( documentObj ),
			summary,
			token: this.csrfToken
		}, 'POST' );
		if ( res.layerspublish?.result !== 'Success' ) {
			throw new Error( `layerspublish on ${ owner } failed: ${ JSON.stringify( res ) }` );
		}
		const revid = res.layerspublish.revid;
		this.createdRevisions.push( { title: owner, revid, type: 'layerspublish' } );
		return revid;
	}

	async purgePage( title ) {
		await this.api( { action: 'purge', titles: title }, 'POST' );
	}

	async seed() {
		console.log( 'Starting J95 migration fixture seeding on test wiki...' );
		await this.login();
		console.log( `Authenticated as ${ this.username } (CSRF token acquired).` );

		const png400x300A = makePng( 400, 300, 32, 96, 192 );
		const png400x300Cv1 = makePng( 400, 300, 32, 192, 96 );
		const png400x300Cv2 = makePng( 400, 300, 220, 100, 30 );

		// ---------------------------------------------------------------------
		// 1. File A: Layers migration fixture A.png (>= 400x300)
		// Sets: anatomy (page 1), labels (page 1, 3 revisions, saved last)
		// ---------------------------------------------------------------------
		console.log( '\n--- Fixture A: Layers migration fixture A.png ---' );
		const fileAInfo = await this.checkFile( 'Layers migration fixture A.png' );
		const needUploadA = !fileAInfo || fileAInfo.length === 0 ||
			fileAInfo[ 0 ].width < 400 || fileAInfo[ 0 ].height < 300;
		if ( needUploadA ) {
			console.log( 'Uploading 400x300 Layers migration fixture A.png...' );
			await this.uploadFile( 'Layers migration fixture A.png', png400x300A, 'image/png', 'J95: upload 400x300 fixture A' );
		} else {
			console.log( 'Layers migration fixture A.png already 400x300.' );
		}

		const infoA = await this.getLayersInfo( { filename: 'Layers_migration_fixture_A.png' } );
		const namedA = infoA?.named_sets || [];
		const anatomyA = namedA.find( ( s ) => s.name === 'anatomy' );
		const labelsA = namedA.find( ( s ) => s.name === 'labels' );

		if ( !anatomyA || needUploadA ) {
			console.log( 'Saving set "anatomy" on Layers migration fixture A.png...' );
			const id = await this.saveLayerSet( 'Layers migration fixture A.png', 'anatomy', 1, [
				{ id: 'layer_anatomy', type: 'text', x: 50, y: 50, text: 'Fixture A anatomy', fontSize: 16, color: '#000000' }
			] );
			console.log( `Saved anatomy: row ${ id }` );
		} else {
			console.log( 'Set "anatomy" already present on fixture A.' );
		}

		const currentLabelsRevCount = needUploadA ? 0 : ( labelsA?.revision_count || 0 );
		if ( currentLabelsRevCount < 3 ) {
			for ( let r = currentLabelsRevCount + 1; r <= 3; r++ ) {
				console.log( `Saving set "labels" revision ${ r } on Layers migration fixture A.png...` );
				const id = await this.saveLayerSet( 'Layers migration fixture A.png', 'labels', 1, [
					{ id: 'layer_labels', type: 'text', x: 50, y: 120, text: `Fixture A labels v${ r }`, fontSize: 16, color: '#000000' }
				] );
				console.log( `Saved labels v${ r }: row ${ id }` );
			}
		} else {
			console.log( 'Set "labels" already has 3 revisions on fixture A.' );
		}

		// Verify labels was saved last
		const finalInfoA = await this.getLayersInfo( { filename: 'Layers_migration_fixture_A.png' } );
		const finalLabels = finalInfoA?.named_sets?.find( ( s ) => s.name === 'labels' );
		const finalAnatomy = finalInfoA?.named_sets?.find( ( s ) => s.name === 'anatomy' );
		if ( finalLabels && finalAnatomy && finalLabels.latest_timestamp < finalAnatomy.latest_timestamp ) {
			console.log( 'Re-saving labels to ensure it was saved last...' );
			await this.saveLayerSet( 'Layers migration fixture A.png', 'labels', 1, [
				{ id: 'layer_labels', type: 'text', x: 50, y: 120, text: 'Fixture A labels v3', fontSize: 16, color: '#000000' }
			] );
		}

		// ---------------------------------------------------------------------
		// 2. File B: Layers migration fixture B.pdf (>= 400x300)
		// 3-page PDF with set notes on pages 1 and 3 only
		// ---------------------------------------------------------------------
		console.log( '\n--- Fixture B: Layers migration fixture B.pdf ---' );
		const fileBInfo = await this.checkFile( 'Layers migration fixture B.pdf' );
		const needUploadB = !fileBInfo || fileBInfo.length === 0 ||
			fileBInfo[ 0 ].width < 400 || fileBInfo[ 0 ].height < 300;
		if ( needUploadB ) {
			console.log( 'Generating and uploading 600x400 3-page PDF Layers migration fixture B.pdf...' );
			const pdf3PageBytes = generateMultipagePdf( [
				{ width: 600, height: 400, label: 'Page 1' },
				{ width: 600, height: 400, label: 'Page 2' },
				{ width: 600, height: 400, label: 'Page 3' }
			] );
			await this.uploadFile( 'Layers migration fixture B.pdf', pdf3PageBytes, 'application/pdf', 'J95: upload 600x400 fixture B 3-page PDF' );
		} else {
			console.log( 'Layers migration fixture B.pdf already uploaded and >= 400x300.' );
		}

		const infoBp1 = await this.getLayersInfo( { filename: 'Layers_migration_fixture_B.pdf', page: '1' } );
		if ( !infoBp1?.layerset || infoBp1.layerset.name !== 'notes' || needUploadB ) {
			console.log( 'Saving set "notes" on page 1 of Layers migration fixture B.pdf...' );
			const id = await this.saveLayerSet( 'Layers migration fixture B.pdf', 'notes', 1, [
				{ id: 'note_p1', type: 'text', x: 50, y: 60, text: 'Fixture B page 1 notes', fontSize: 16, color: '#000000' }
			] );
			console.log( `Saved page 1 notes: row ${ id }` );
		} else {
			console.log( 'Page 1 set "notes" already present on fixture B.' );
		}

		const infoBp3 = await this.getLayersInfo( { filename: 'Layers_migration_fixture_B.pdf', page: '3' } );
		if ( !infoBp3?.layerset || infoBp3.layerset.name !== 'notes' || needUploadB ) {
			console.log( 'Saving set "notes" on page 3 of Layers migration fixture B.pdf...' );
			const id = await this.saveLayerSet( 'Layers migration fixture B.pdf', 'notes', 3, [
				{ id: 'note_p3', type: 'text', x: 50, y: 120, text: 'Fixture B page 3 notes', fontSize: 16, color: '#000000' }
			] );
			console.log( `Saved page 3 notes: row ${ id }` );
		} else {
			console.log( 'Page 3 set "notes" already present on fixture B.' );
		}

		// Verify page 2 has no sets
		const infoBp2 = await this.getLayersInfo( { filename: 'Layers_migration_fixture_B.pdf', page: '2' } );
		if ( infoBp2?.layerset ) {
			throw new Error( 'Fixture B page 2 unexpectedly has a layer set; expected none.' );
		}

		// ---------------------------------------------------------------------
		// 3. File C: Layers migration fixture C.png (>= 400x300)
		// Version 1 has set old; version 2 (different image) has no sets
		// ---------------------------------------------------------------------
		console.log( '\n--- Fixture C: Layers migration fixture C.png ---' );
		const fileCInfo = await this.checkFile( 'Layers migration fixture C.png' );
		const needUploadC = !fileCInfo || fileCInfo.length < 2 ||
			fileCInfo[ 0 ].width < 400 || fileCInfo[ 0 ].height < 300;
		if ( needUploadC ) {
			console.log( 'Uploading 400x300 version 1 of Layers migration fixture C.png...' );
			await this.uploadFile( 'Layers migration fixture C.png', png400x300Cv1, 'image/png', 'J95: seed fixture C v1 400x300' );
			console.log( 'Saving set "old" on version 1 of Layers migration fixture C.png...' );
			await this.saveLayerSet( 'Layers migration fixture C.png', 'old', 1, [
				{ id: 'note_old', type: 'text', x: 50, y: 50, text: 'Fixture C old', fontSize: 16, color: '#000000' }
			] );
			console.log( 'Uploading 400x300 version 2 (replacement image) of Layers migration fixture C.png...' );
			await this.uploadFile( 'Layers migration fixture C.png', png400x300Cv2, 'image/png', 'J95: seed fixture C v2 400x300' );
		} else {
			console.log( 'Layers migration fixture C.png already has multiple revisions and >= 400x300.' );
		}

		// ---------------------------------------------------------------------
		// 4. Slides:
		// slide one (shown by two pages) and slide two (shown nowhere)
		// ---------------------------------------------------------------------
		console.log( '\n--- Slides ---' );
		const slideOneInfo = await this.getLayersInfo( { slidename: 'Layers_migration_fixture_slide_one' } );
		if ( !slideOneInfo?.layerset ) {
			console.log( 'Saving shared slide Layers_migration_fixture_slide_one...' );
			const id = await this.saveSlide( 'Layers_migration_fixture_slide_one', 'default', {
				layers: [ { id: 'slide_1_text', type: 'text', x: 100, y: 100, text: 'Fixture slide one text', fontSize: 24, color: '#000088' } ],
				canvasWidth: 800,
				canvasHeight: 600,
				backgroundColor: '#ffffff'
			} );
			console.log( `Saved slide one: row ${ id }` );
		} else {
			console.log( 'Shared slide Layers_migration_fixture_slide_one already present.' );
		}

		const slideTwoInfo = await this.getLayersInfo( { slidename: 'Layers_migration_fixture_slide_two' } );
		if ( !slideTwoInfo?.layerset ) {
			console.log( 'Saving shared slide Layers_migration_fixture_slide_two...' );
			const id = await this.saveSlide( 'Layers_migration_fixture_slide_two', 'default', {
				layers: [ { id: 'slide_2_text', type: 'text', x: 100, y: 100, text: 'Fixture slide two text', fontSize: 24, color: '#880000' } ],
				canvasWidth: 800,
				canvasHeight: 600,
				backgroundColor: '#ffffff'
			} );
			console.log( `Saved slide two: row ${ id }` );
		} else {
			console.log( 'Shared slide Layers_migration_fixture_slide_two already present.' );
		}

		// ---------------------------------------------------------------------
		// 5. Pages
		// ---------------------------------------------------------------------
		console.log( '\n--- Pages ---' );

		// Template:Layers migration fixture frame
		const templateText = '[[File:Layers migration fixture A.png|thumb|layerset=anatomy]]';
		const templatePage = await this.getPage( 'Template:Layers migration fixture frame' );
		if ( !templatePage || templatePage.main.trim() !== templateText.trim() ) {
			console.log( 'Creating/updating Template:Layers migration fixture frame...' );
			await this.editPage( 'Template:Layers migration fixture frame', templateText, 'J95 seed template' );
		} else {
			console.log( 'Template:Layers migration fixture frame already expected.' );
		}

		// Layers migration fixture/Template
		const templateConsumerText = '{{Layers migration fixture frame}}';
		const templateConsumerPage = await this.getPage( 'Layers migration fixture/Template' );
		if ( !templateConsumerPage || templateConsumerPage.main.trim() !== templateConsumerText.trim() ) {
			console.log( 'Creating/updating Layers migration fixture/Template...' );
			await this.editPage( 'Layers migration fixture/Template', templateConsumerText, 'J95 seed template consumer' );
		} else {
			console.log( 'Layers migration fixture/Template already expected.' );
		}
		await this.purgePage( 'Layers migration fixture/Template' );

		// Layers migration fixture/Direct
		const directText = [
			'[[File:Layers migration fixture A.png|thumb|layerset=anatomy]]',
			'[[File:Layers migration fixture A.png|thumb|layerset=anatomy]]',
			'[[File:Layers migration fixture A.png|thumb|layerset=on]]',
			'[[File:Layers migration fixture A.png|thumb|layerset=off]]',
			'[[File:Layers migration fixture A.png|thumb]]',
			'[[File:Layers migration fixture B.pdf|page=1|thumb|layerset=notes]]',
			'[[File:Layers migration fixture B.pdf|page=3|thumb|layerset=notes]]'
		].join( '\n' );
		const directPage = await this.getPage( 'Layers migration fixture/Direct' );
		if ( !directPage || directPage.main.trim() !== directText.trim() ) {
			console.log( 'Creating/updating Layers migration fixture/Direct...' );
			await this.editPage( 'Layers migration fixture/Direct', directText, 'J95 seed direct page' );
		} else {
			console.log( 'Layers migration fixture/Direct already expected.' );
		}
		await this.purgePage( 'Layers migration fixture/Direct' );

		// Layers migration fixture/Slides 1
		const slides1Text = '{{#Slide:Layers_migration_fixture_slide_one}}';
		const slides1Page = await this.getPage( 'Layers migration fixture/Slides 1' );
		if ( !slides1Page || slides1Page.main.trim() !== slides1Text.trim() ) {
			console.log( 'Creating/updating Layers migration fixture/Slides 1...' );
			await this.editPage( 'Layers migration fixture/Slides 1', slides1Text, 'J95 seed Slides 1' );
		} else {
			console.log( 'Layers migration fixture/Slides 1 already expected.' );
		}
		await this.purgePage( 'Layers migration fixture/Slides 1' );

		// Layers migration fixture/Slides 2 (includes valid slide one and deliberately invalid spaced slide)
		const slides2Text = [
			'{{#Slide:Layers_migration_fixture_slide_one}}',
			'{{#Slide:Layers migration fixture invalid spaced slide}}'
		].join( '\n' );
		const slides2Page = await this.getPage( 'Layers migration fixture/Slides 2' );
		if ( !slides2Page || slides2Page.main.trim() !== slides2Text.trim() ) {
			console.log( 'Creating/updating Layers migration fixture/Slides 2...' );
			await this.editPage( 'Layers migration fixture/Slides 2', slides2Text, 'J95 seed Slides 2' );
		} else {
			console.log( 'Layers migration fixture/Slides 2 already expected.' );
		}
		await this.purgePage( 'Layers migration fixture/Slides 2' );

		// Layers migration fixture/Taken
		const takenText = '[[File:Layers migration fixture A.png|thumb|layerset=anatomy]]';
		let takenPage = await this.getPage( 'Layers migration fixture/Taken' );
		if ( !takenPage || takenPage.main.trim() !== takenText.trim() ) {
			console.log( 'Creating/updating Layers migration fixture/Taken text...' );
			await this.editPage( 'Layers migration fixture/Taken', takenText, 'J93 seed Taken wikitext' );
			takenPage = await this.getPage( 'Layers migration fixture/Taken' );
		}
		// Ensure it owns a drawing named anatomy
		let hasAnatomyDrawing = false;
		if ( takenPage?.hasLayersSlot && takenPage.layersContent ) {
			try {
				const doc = JSON.parse( takenPage.layersContent );
				hasAnatomyDrawing = doc.surfaces?.some( ( s ) => s.label === 'anatomy' );
			} catch ( e ) {
				// parse failure
			}
		}
		if ( !hasAnatomyDrawing ) {
			console.log( 'Publishing existing drawing named "anatomy" on Layers migration fixture/Taken...' );
			const doc = {
				schemaVersion: 1,
				surfaces: [
					{
						id: 'surface_taken_anatomy',
						kind: 'slide',
						label: 'anatomy',
						canvas: {
							width: 800,
							height: 600,
							backgroundColor: '#ffffff',
							backgroundVisible: true,
							backgroundOpacity: 1
						},
						layers: [
							{
								id: 'taken_text',
								type: 'text',
								x: 40,
								y: 60,
								text: 'Existing page drawing named anatomy',
								fontSize: 24,
								color: '#000000'
							}
						],
						readingOrder: [ 'taken_text' ]
					}
				]
			};
			await this.publishDrawing( 'Layers migration fixture/Taken', takenPage.pageid, takenPage.revid, doc, 'J93 seed existing drawing anatomy' );
		} else {
			console.log( 'Layers migration fixture/Taken already owns drawing "anatomy".' );
		}
		await this.purgePage( 'Layers migration fixture/Taken' );

		// Layers migration fixture/Uses C
		const usesCText = '[[File:Layers migration fixture C.png|thumb|layerset=old]]';
		const usesCPage = await this.getPage( 'Layers migration fixture/Uses C' );
		if ( !usesCPage || usesCPage.main.trim() !== usesCText.trim() ) {
			console.log( 'Creating/updating Layers migration fixture/Uses C...' );
			await this.editPage( 'Layers migration fixture/Uses C', usesCText, 'J93 seed Uses C' );
		} else {
			console.log( 'Layers migration fixture/Uses C already expected.' );
		}
		await this.purgePage( 'Layers migration fixture/Uses C' );

		// Project:Layers migration fixture
		const projectText = '[[File:Layers migration fixture A.png|thumb|layerset=anatomy]]';
		const projectPage = await this.getPage( 'Project:Layers migration fixture' );
		if ( !projectPage || projectPage.main.trim() !== projectText.trim() ) {
			console.log( 'Creating/updating Project:Layers migration fixture...' );
			await this.editPage( 'Project:Layers migration fixture', projectText, 'J93 seed Project fixture' );
		} else {
			console.log( 'Project:Layers migration fixture already expected.' );
		}
		await this.purgePage( 'Project:Layers migration fixture' );

		console.log( '\n============================================' );
		console.log( 'J93 Fixture Seeding Completed Successfully.' );
		if ( this.createdRevisions.length > 0 ) {
			console.log( `Revisions created in this run (${ this.createdRevisions.length }):` );
			for ( const r of this.createdRevisions ) {
				console.log( `  - ${ r.title }: revid ${ r.revid } (${ r.type })` );
			}
		} else {
			console.log( 'Zero revisions created in this run (all fixtures already in expected state).' );
		}
		console.log( '============================================\n' );
		return this.createdRevisions;
	}
}

// CLI Execution entry point
if ( require.main === module ) {
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	let cfg = null;
	if ( configPath && fs.existsSync( configPath ) ) {
		cfg = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	}
	const base = process.env.PLAYWRIGHT_BASE_URL || cfg?.base || 'http://localhost:8080';
	const username = ( process.env.MW_USERNAME && process.env.MW_PASSWORD ) ?
		process.env.MW_USERNAME : ( cfg?.username || process.env.MW_USERNAME );
	const password = ( process.env.MW_USERNAME && process.env.MW_PASSWORD ) ?
		process.env.MW_PASSWORD : ( cfg?.password || process.env.MW_PASSWORD );

	if ( !username || !password ) {
		console.error( 'Error: MediaWiki credentials not found in environment or session config.' );
		process.exit( 1 );
	}

	const seeder = new MigrationFixtureSeeder( base, username, password );
	seeder.seed()
		.then( () => process.exit( 0 ) )
		.catch( ( err ) => {
			console.error( 'Seeding failed:', err );
			process.exit( 1 );
		} );
}

module.exports = { MigrationFixtureSeeder, generateMultipagePdf };
