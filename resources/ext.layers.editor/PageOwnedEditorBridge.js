/** Maps a page-owned surface session to the existing editor state without legacy API calls. */
( function () {
	'use strict';

	const slideFields = {
		width: 'slideCanvasWidth', height: 'slideCanvasHeight',
		backgroundColor: 'slideBackgroundColor', backgroundVisible: 'backgroundVisible',
		backgroundOpacity: 'backgroundOpacity'
	};
	// An image/PDF canvas is the pinned source page; only how its picture shows is editable.
	const sourceFields = { backgroundVisible: 'backgroundVisible', backgroundOpacity: 'backgroundOpacity' };

	// The editor clears a property by setting it to null or undefined; the server stores neither.
	function withoutClearedValues( layer ) {
		if ( !layer || Object.getPrototypeOf( layer ) !== Object.prototype ) {
			return layer;
		}
		return Object.fromEntries( Object.entries( layer ).filter( ( [ , value ] ) => value !== null && value !== undefined ) );
	}

	class PageOwnedEditorBridge {
		/**
		 * @param {Object} editor Existing editor with StateManager and optional rendering components
		 * @param {Object} session PageOwnedEditorSession
		 */
		constructor( editor, session ) {
			this.editor = editor;
			this.session = session;
			this.disposed = false;
			this.loaded = false;
			this.saving = false;
			this.isSlide = true;
		}

		/** @return {Object} Surface canvas fields mapped to editor state keys @private */
		_fields() {
			return this.isSlide ? slideFields : sourceFields;
		}

		/** @return {Promise<Object>} Loaded selected surface, with no legacy normalization or draft recovery */
		async load() {
			const state = await this.session.load();
			this._requireActive();
			const draft = this.session.getDraft();
			const surface = draft.snapshot.surfaces.find( ( item ) => item.id === draft.surfaceId );
			// The background must be the pinned file version the server issued; never draw one as a blank slide.
			const config = this.editor.config || {};
			if ( surface.kind === 'slide' ? config.isSlide === false : config.isSlide !== false || !config.imageUrl ) {
				throw this._error( 'layers-editor-surface-unavailable' );
			}
			this.isSlide = surface.kind === 'slide';
			this._applyState( state );
			this.editor.stateManager.set( 'isDirty', false );
			this.loaded = true;
			return state;
		}

		/**
		 * Apply an inspected, explicitly accepted draft without changing server identity.
		 * @param {Object} candidate Validated draft-controller recovery candidate
		 */
		restoreDraft( candidate ) {
			this._requireActive();
			if ( !this.loaded || this.session.getStatus().readOnly || this.session.getStatus().phase !== 'ready' ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
			this._applyState( candidate.editorState );
			if ( typeof candidate.label === 'string' && candidate.label !== this.session.getLabel() ) {
				this.session.rename( candidate.label );
			}
			if ( candidate.publicationBlocked ) {
				this.session.blockPublication();
			}
			this.editor.stateManager.set( 'isDirty', true );
		}

		/** @param {Object} state Canvas/layers pair @private */
		_applyState( state ) {
			const store = this.editor.stateManager;
			store.set( 'isSlide', this.isSlide );
			for ( const [ field, key ] of Object.entries( this._fields() ) ) {
				store.set( key, state.canvas[ field ] );
			}
			store.set( 'baseWidth', state.canvas.width );
			store.set( 'baseHeight', state.canvas.height );
			store.set( 'layers', state.layers );
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.setBaseDimensions( state.canvas.width, state.canvas.height );
				this.editor.canvasManager.renderLayers( state.layers );
			}
			if ( this.editor.layerPanel ) {
				this.editor.layerPanel.updateLayers( state.layers );
			}
			if ( this.editor.historyManager ) {
				this.editor.historyManager.saveInitialState();
			}
		}

		/** @return {string} The drawing's name, including a rename not yet saved */
		getName() {
			this._requireActive();
			return this.session.getLabel();
		}

		/**
		 * Rename the drawing; the next save publishes the name and updates this page's embeds.
		 * @param {string} name Proposed name
		 * @return {string} The name as it will be saved
		 */
		rename( name ) {
			this._requireActive();
			if ( !this.loaded ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
			const label = this.session.rename( name );
			if ( this.session.getStatus().dirty ) {
				this.editor.stateManager.set( 'isDirty', true );
			}
			return label;
		}

		/** Capture current editor values while retaining unexposed canvas fields. */
		capture() {
			this.session.update( this.getLiveState() );
		}

		/** @return {Object} Live editor data, including edits not yet valid for publication */
		getLiveState() {
			this._requireActive();
			if ( !this.loaded ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
			const state = this.session.getEditorState();
			for ( const [ field, key ] of Object.entries( this._fields() ) ) {
				const value = this.editor.stateManager.get( key );
				if ( value !== undefined ) {
					state.canvas[ field ] = value;
				}
			}
			const layers = this.editor.stateManager.get( 'layers' );
			state.layers = Array.isArray( layers ) ? layers.map( withoutClearedValues ) : layers;
			return state;
		}

		/**
		 * @param {string} summary Explicit page-history summary
		 * @param {Function} [beforePublish] Persist a saving-phase draft before dispatch
		 * @return {Promise<Object>} Confirmed save state, including whether newer editor data is valid
		 */
		async save( summary = '', beforePublish ) {
			this._requireActive();
			if ( this.saving || this.session.getStatus().phase !== 'ready' ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
			this.capture();
			this.saving = true;
			let editorStateValid = true;
			try {
				await this.session.save( summary, beforePublish );
			} finally {
				this.saving = false;
				if ( !this.disposed ) {
					// The canvas can change while the POST is pending. Do not mark those edits saved.
					try {
						this.capture();
					} catch ( error ) {
						// A confirmed write remains confirmed. Keep newer invalid editor data intact/dirty.
						editorStateValid = false;
					}
					this.editor.stateManager.set( 'isDirty', !editorStateValid || this.session.getStatus().dirty );
				}
			}
			this._requireActive();
			return {
				...this.session.getStatus(),
				dirty: this.editor.stateManager.get( 'isDirty' ),
				editorStateValid
			};
		}

		/**
		 * @param {number} revisionId Exact server revision to compare
		 * @return {Promise<Object>} Reconciled status; newer live edits remain dirty
		 */
		async reconcile( revisionId ) {
			this.capture();
			let editorStateValid = true;
			try {
				await this.session.reconcile( revisionId );
			} finally {
				if ( !this.disposed ) {
					try {
						this.capture();
					} catch ( error ) {
						editorStateValid = false;
					}
					this.editor.stateManager.set( 'isDirty', !editorStateValid || this.session.getStatus().dirty );
				}
			}
			this._requireActive();
			return { ...this.session.getStatus(), dirty: this.editor.stateManager.get( 'isDirty' ), editorStateValid };
		}

		/** Call only after the owning UI has preserved any draft it needs. */
		dispose() {
			this.disposed = true;
			this.loaded = false;
			this.session.dispose();
			this.editor = null;
		}

		/** @private */
		_requireActive() {
			if ( this.disposed ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
		}

		/** @param {string} code @return {Error} @private */
		_error( code ) {
			const error = new Error( code );
			error.code = code;
			return error;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedEditorBridge = PageOwnedEditorBridge;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedEditorBridge;
	}
}() );
