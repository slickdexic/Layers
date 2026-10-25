/* eslint-env node */
/** Chromium request admission for read-only benchmarks, without changing HTTP caching. */
async function guardNativeReads( page, origin, errors ) {
	const session = await page.context().newCDPSession( page );
	session.on( 'Fetch.requestPaused', ( event ) => {
		const request = event.request;
		let url;
		try { url = new URL( request.url ); } catch ( error ) { /* Invalid URLs are refused below. */ }
		const allowed = url && url.origin === origin && request.method === 'GET';
		if ( !allowed ) {
			errors.push( { method: request.method, url: url ? url.origin + url.pathname : 'invalid' } );
		}
		const command = allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest';
		session.send( command, { requestId: event.requestId,
			...( allowed ? {} : { errorReason: 'BlockedByClient' } ) } )
			.catch( () => errors.push( { message: 'Native request guard failed' } ) );
	} );
	// Playwright routing disables HTTP cache. Native Fetch admission preserves normal image reuse.
	await session.send( 'Fetch.enable', { patterns: [ { urlPattern: '*', requestStage: 'Request' } ] } );
	return session;
}

module.exports = guardNativeReads;
