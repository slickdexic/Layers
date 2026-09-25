'use strict';

const PageOwnedRevisionControl = require( '../../resources/ext.layers.editor/PageOwnedRevisionControl.js' );

describe( 'PageOwnedRevisionControl', () => {
	let parent, messageMock;

	/** Helper to create a deferred promise for controlled async resolution */
	function createDeferred() {
		let resolve, reject;
		const promise = new Promise( ( res, rej ) => {
			resolve = res;
			reject = rej;
		} );
		return { promise, resolve, reject };
	}

	beforeEach( () => {
		parent = document.createElement( 'div' );
		document.body.appendChild( parent );
		messageMock = jest.fn( ( key ) => `msg:${ key }` );
	} );

	afterEach( () => {
		if ( parent && parent.parentNode ) {
			parent.parentNode.removeChild( parent );
		}
	} );

	describe( 'constructor and exports', () => {
		it( 'does not steal focus moved to another control while checking', async () => {
			const pending = createDeferred();
			const control = new PageOwnedRevisionControl( { check: () => pending.promise, message: messageMock } );
			control.mount( parent );
			const input = document.createElement( 'input' );
			parent.appendChild( input );
			control.button.focus();
			const checking = control._handleClick();
			input.focus();
			pending.resolve( { phase: 'ready', revisionId: 12, dirty: false, editorStateValid: true, draftPersisted: true } );
			await checking;
			expect( document.activeElement ).toBe( input );
			control.dispose();
		} );
		it( 'exports to window.Layers.Editor.PageOwnedRevisionControl and CommonJS', () => {
			expect( window.Layers.Editor.PageOwnedRevisionControl ).toBe( PageOwnedRevisionControl );
			expect( typeof PageOwnedRevisionControl ).toBe( 'function' );
		} );

		it.each( [
			[ 'null options', null ],
			[ 'undefined options', undefined ],
			[ 'number options', 42 ],
			[ 'string options', 'invalid' ],
			[ 'array options', [] ],
			[ 'empty object options', {} ],
			[ 'missing check', { message: () => '' } ],
			[ 'non-function check', { check: 'notAFunction', message: () => '' } ],
			[ 'missing message', { check: async () => ( {} ) } ],
			[ 'non-function message', { check: async () => ( {} ), message: 'notAFunction' } ]
		] )( 'rejects invalid constructor options: %s', ( _, options ) => {
			expect( () => new PageOwnedRevisionControl( options ) ).toThrow( 'layers-invalid-revision-control' );
		} );

		it( 'does no work on construction', () => {
			const checkMock = jest.fn();
			const control = new PageOwnedRevisionControl( { check: checkMock, message: messageMock } );
			expect( checkMock ).not.toHaveBeenCalled();
			expect( messageMock ).not.toHaveBeenCalled();
			expect( control.mounted ).toBe( false );
			expect( control.disposed ).toBe( false );
		} );
	} );

	describe( 'mounting and DOM structure', () => {
		it( 'does no work on mount and creates labelled button and status element', () => {
			const checkMock = jest.fn();
			const control = new PageOwnedRevisionControl( { check: checkMock, message: messageMock } );

			control.mount( parent );

			expect( checkMock ).not.toHaveBeenCalled();
			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-button' );

			const button = parent.querySelector( 'button' );
			expect( button ).not.toBeNull();
			expect( button.type ).toBe( 'button' );
			expect( button.className ).toBe( 'layers-page-revision-check-button' );
			expect( button.textContent ).toBe( 'msg:layers-page-revision-check-button' );
			expect( button.disabled ).toBe( false );

			const status = parent.querySelector( '[role="status"]' );
			expect( status ).not.toBeNull();
			expect( status.getAttribute( 'aria-live' ) ).toBe( 'polite' );
			expect( status.className ).toBe( 'layers-page-revision-check-status' );
			expect( status.textContent ).toBe( '' );

			control.dispose();
		} );

		it.each( [
			[ 'null parent', null ],
			[ 'undefined parent', undefined ],
			[ 'primitive parent', 'notAnElement' ],
			[ 'object without appendChild', {} ]
		] )( 'rejects invalid mount target: %s', ( _, invalidParent ) => {
			const control = new PageOwnedRevisionControl( { check: jest.fn(), message: messageMock } );
			expect( () => control.mount( invalidParent ) ).toThrow( 'layers-invalid-mount-target' );
			expect( control.mounted ).toBe( false );
		} );

		it( 'rejects mounting the same live instance twice without duplicate controls or side effects', () => {
			const control = new PageOwnedRevisionControl( { check: jest.fn(), message: messageMock } );
			control.mount( parent );

			const otherParent = document.createElement( 'div' );
			document.body.appendChild( otherParent );

			expect( () => control.mount( otherParent ) ).toThrow( 'layers-control-already-mounted' );
			expect( otherParent.children.length ).toBe( 0 );
			expect( parent.querySelectorAll( 'button' ).length ).toBe( 1 );

			otherParent.remove();
			control.dispose();
		} );

		it( 'rejects mounting on a disposed instance', () => {
			const control = new PageOwnedRevisionControl( { check: jest.fn(), message: messageMock } );
			control.dispose();
			expect( () => control.mount( parent ) ).toThrow( 'layers-revision-control-disposed' );
			expect( parent.children.length ).toBe( 0 );
		} );
	} );

	describe( 'click handling, in-flight guard, and focus preservation', () => {
		it( 'calls check once on click, disables button while pending, and sets checking message', async () => {
			const deferred = createDeferred();
			const checkMock = jest.fn( () => deferred.promise );
			const control = new PageOwnedRevisionControl( { check: checkMock, message: messageMock } );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();

			expect( checkMock ).toHaveBeenCalledTimes( 1 );
			expect( button.disabled ).toBe( true );
			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-checking' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-checking' );

			// Repeated clicks while pending do nothing
			button.click();
			button.click();
			expect( checkMock ).toHaveBeenCalledTimes( 1 );

			deferred.resolve( {
				phase: 'ready',
				revisionId: 14,
				dirty: false,
				editorStateValid: true,
				draftPersisted: true
			} );

			await deferred.promise;
			// Allow microtasks to complete
			await Promise.resolve();

			expect( button.disabled ).toBe( false );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-matched' );

			control.dispose();
		} );

		it( 'keeps focus on the existing button and does not replace the DOM tree on completion', async () => {
			const deferred = createDeferred();
			const checkMock = jest.fn( () => deferred.promise );
			const control = new PageOwnedRevisionControl( { check: checkMock, message: messageMock } );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );
			const container = parent.querySelector( '.layers-page-revision-control' );

			button.focus();
			expect( document.activeElement ).toBe( button );

			button.click();

			deferred.resolve( {
				phase: 'ready',
				revisionId: 14,
				dirty: true,
				editorStateValid: true,
				draftPersisted: true
			} );

			await deferred.promise;
			await Promise.resolve();

			// Ensure DOM tree was not replaced
			expect( parent.querySelector( 'button' ) ).toBe( button );
			expect( parent.querySelector( '[role="status"]' ) ).toBe( status );
			expect( parent.querySelector( '.layers-page-revision-control' ) ).toBe( container );

			// Focus should remain on the button
			expect( document.activeElement ).toBe( button );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );
	} );

	describe( 'success states and outcome precedence', () => {
		it( 'precedence 1: displays backup-failed message when draftPersisted is false', async () => {
			const control = new PageOwnedRevisionControl( {
				check: async () => ( {
					phase: 'ready',
					revisionId: 14,
					dirty: true,
					editorStateValid: false,
					draftPersisted: false
				} ),
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-backup-failed' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-backup-failed' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );

		it( 'precedence 2: displays invalid-edits message when draftPersisted is true and editorStateValid is false', async () => {
			const control = new PageOwnedRevisionControl( {
				check: async () => ( {
					phase: 'ready',
					revisionId: 14,
					dirty: false,
					editorStateValid: false,
					draftPersisted: true
				} ),
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-invalid-edits' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-invalid-edits' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );

		it( 'precedence 3: displays ready message when draftPersisted and editorStateValid are true, and dirty is true', async () => {
			const control = new PageOwnedRevisionControl( {
				check: async () => ( {
					phase: 'ready',
					revisionId: 14,
					dirty: true,
					editorStateValid: true,
					draftPersisted: true
				} ),
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-ready' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-ready' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );

		it( 'precedence 4: displays matched message when draftPersisted and editorStateValid are true, and dirty is false', async () => {
			const control = new PageOwnedRevisionControl( {
				check: async () => ( {
					phase: 'ready',
					revisionId: 14,
					dirty: false,
					editorStateValid: true,
					draftPersisted: true
				} ),
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-matched' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-matched' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );

		it.each( [ 1, 2147483647 ] )( 'accepts boundary revision ID %d', async ( revisionId ) => {
			const control = new PageOwnedRevisionControl( {
				check: async () => ( {
					phase: 'ready',
					revisionId,
					dirty: false,
					editorStateValid: true,
					draftPersisted: true
				} ),
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-matched' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );
	} );

	describe( 'malformed results', () => {
		it.each( [
			[ 'null result', null ],
			[ 'undefined result', undefined ],
			[ 'primitive number', 123 ],
			[ 'primitive string', 'valid' ],
			[ 'primitive boolean', true ],
			[ 'array result', [] ],
			[ 'missing phase', { revisionId: 1, dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'phase not ready (saving)', { phase: 'saving', revisionId: 1, dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'phase not ready (conflict)', { phase: 'conflict', revisionId: 1, dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'phase not ready (uncertain)', { phase: 'uncertain', revisionId: 1, dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'missing revisionId', { phase: 'ready', dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'zero revisionId', { phase: 'ready', revisionId: 0, dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'negative revisionId', { phase: 'ready', revisionId: -5, dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'fractional revisionId', { phase: 'ready', revisionId: 14.5, dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'overflow revisionId', { phase: 'ready', revisionId: 2147483648, dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'string revisionId', { phase: 'ready', revisionId: '14', dirty: false, editorStateValid: true, draftPersisted: true } ],
			[ 'missing dirty', { phase: 'ready', revisionId: 14, editorStateValid: true, draftPersisted: true } ],
			[ 'non-boolean dirty', { phase: 'ready', revisionId: 14, dirty: 1, editorStateValid: true, draftPersisted: true } ],
			[ 'missing editorStateValid', { phase: 'ready', revisionId: 14, dirty: false, draftPersisted: true } ],
			[ 'non-boolean editorStateValid', { phase: 'ready', revisionId: 14, dirty: false, editorStateValid: 'true', draftPersisted: true } ],
			[ 'missing draftPersisted', { phase: 'ready', revisionId: 14, dirty: false, editorStateValid: true } ],
			[ 'non-boolean draftPersisted', { phase: 'ready', revisionId: 14, dirty: false, editorStateValid: true, draftPersisted: null } ]
		] )( 'displays generic failure message for malformed result: %s', async ( _, malformedResult ) => {
			const control = new PageOwnedRevisionControl( {
				check: async () => malformedResult,
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-failed' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-failed' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );
	} );

	describe( 'rejection handling and diagnostic safety', () => {
		it( 'displays conflict message when rejection code is layers-editor-reconciliation-required', async () => {
			const conflictError = new Error( 'Some internal message' );
			conflictError.code = 'layers-editor-reconciliation-required';

			const control = new PageOwnedRevisionControl( {
				check: async () => {
					throw conflictError;
				},
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-conflict' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-conflict' );
			expect( status.textContent ).not.toContain( 'Some internal message' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );

		it( 'displays conflict message when rejection message is layers-editor-reconciliation-required', async () => {
			const conflictError = new Error( 'layers-editor-reconciliation-required' );

			const control = new PageOwnedRevisionControl( {
				check: async () => {
					throw conflictError;
				},
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-conflict' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-conflict' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );

		it.each( [
			[ 'layers-revision-unavailable', new Error( 'layers-revision-unavailable' ) ],
			[ 'network failure', new Error( 'Failed to fetch /api.php' ) ],
			[ 'non-Error object', { code: 'unknown-error', message: 'Something broke' } ],
			[ 'string error', 'Internal server error 500' ]
		] )( 'displays generic failure message for other rejections: %s', async ( _, rejection ) => {
			const control = new PageOwnedRevisionControl( {
				check: async () => {
					throw rejection;
				},
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-revision-check-failed' );
			expect( status.textContent ).toBe( 'msg:layers-page-revision-check-failed' );
			// Diagnostics must never leak
			expect( status.textContent ).not.toContain( 'Failed to fetch' );
			expect( status.textContent ).not.toContain( 'Something broke' );
			expect( status.textContent ).not.toContain( '500' );
			expect( button.disabled ).toBe( false );

			control.dispose();
		} );
	} );

	describe( 'markup safety', () => {
		it( 'renders markup-like messages as literal text and creates no HTML elements', async () => {
			const maliciousMessageMock = jest.fn( () => '<img src="x" onerror="alert(1)"><b>HTML Warning</b>' );
			const control = new PageOwnedRevisionControl( {
				check: async () => ( {
					phase: 'ready',
					revisionId: 14,
					dirty: false,
					editorStateValid: true,
					draftPersisted: true
				} ),
				message: maliciousMessageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			const status = parent.querySelector( '[role="status"]' );

			button.click();
			await Promise.resolve();
			await Promise.resolve();

			expect( status.textContent ).toBe( '<img src="x" onerror="alert(1)"><b>HTML Warning</b>' );
			expect( status.children.length ).toBe( 0 );
			expect( parent.querySelector( 'img' ) ).toBeNull();
			expect( parent.querySelector( 'b' ) ).toBeNull();

			control.dispose();
		} );
	} );

	describe( 'disposal and idempotent cleanup', () => {
		it( 'disposal removes component DOM elements and click listeners', () => {
			const control = new PageOwnedRevisionControl( { check: jest.fn(), message: messageMock } );
			control.mount( parent );

			expect( parent.children.length ).toBe( 1 );
			control.dispose();

			expect( parent.children.length ).toBe( 0 );
			expect( control.mounted ).toBe( false );
			expect( control.disposed ).toBe( true );
		} );

		it( 'disposal is idempotent and does not throw on repeated calls', () => {
			const control = new PageOwnedRevisionControl( { check: jest.fn(), message: messageMock } );
			control.mount( parent );

			expect( () => {
				control.dispose();
				control.dispose();
				control.dispose();
			} ).not.toThrow();

			expect( parent.children.length ).toBe( 0 );
		} );

		it( 'disposal before mount succeeds cleanly and prevents future mounting', () => {
			const control = new PageOwnedRevisionControl( { check: jest.fn(), message: messageMock } );
			control.dispose();

			expect( control.disposed ).toBe( true );
			expect( () => control.mount( parent ) ).toThrow( 'layers-revision-control-disposed' );
			expect( parent.children.length ).toBe( 0 );
		} );

		it( 'makes late resolution inert when disposed while check is pending', async () => {
			const deferred = createDeferred();
			const control = new PageOwnedRevisionControl( {
				check: () => deferred.promise,
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			button.click();

			expect( control.pending ).toBe( true );
			expect( parent.children.length ).toBe( 1 );

			// Dispose while check is pending
			control.dispose();
			expect( parent.children.length ).toBe( 0 );
			expect( control.disposed ).toBe( true );

			// Late resolve
			deferred.resolve( {
				phase: 'ready',
				revisionId: 14,
				dirty: false,
				editorStateValid: true,
				draftPersisted: true
			} );

			await deferred.promise;
			await Promise.resolve();

			// Should remain inert: no errors, no DOM resurrection
			expect( parent.children.length ).toBe( 0 );
		} );

		it( 'makes late rejection inert when disposed while check is pending', async () => {
			const deferred = createDeferred();
			const control = new PageOwnedRevisionControl( {
				check: () => deferred.promise,
				message: messageMock
			} );
			control.mount( parent );

			const button = parent.querySelector( 'button' );
			button.click();

			control.dispose();

			// Late rejection
			deferred.reject( new Error( 'layers-editor-reconciliation-required' ) );

			try {
				await deferred.promise;
			} catch ( _ ) {
				// expected rejection from mock
			}
			await Promise.resolve();

			// Should remain inert
			expect( parent.children.length ).toBe( 0 );
		} );
	} );
} );
