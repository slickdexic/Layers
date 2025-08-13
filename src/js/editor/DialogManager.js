/**
 * OOUI Dialog Manager for the Layers Editor
 * Replaces browser alerts/confirms with MediaWiki OOUI dialogs
 */

( function () {
	'use strict';

	/**
	 * Dialog Manager class
	 *
	 * @class
	 */
	function DialogManager() {
		this.windowManager = null;
		this.init();
	}

	/**
	 * Initialize the dialog manager
	 */
	DialogManager.prototype.init = function () {
		this.windowManager = new OO.ui.WindowManager();
		$( document.body ).append( this.windowManager.$element );
	};

	/**
	 * Show a confirmation dialog
	 *
	 * @param {string} message - The message to display
	 * @param {string} title - The dialog title
	 * @return {Promise} Promise that resolves to true/false
	 */
	DialogManager.prototype.confirm = function ( message, title ) {
		var dialog = new OO.ui.MessageDialog();
		var deferred = $.Deferred();

		this.windowManager.addWindows( [ dialog ] );

		this.windowManager.openWindow( dialog, {
			title: title || mw.message( 'layers-confirm-title' ).text(),
			message: message,
			actions: [
				{
					action: 'accept',
					label: mw.message( 'layers-confirm-yes' ).text(),
					flags: [ 'primary', 'destructive' ]
				},
				{
					action: 'reject',
					label: mw.message( 'layers-confirm-no' ).text(),
					flags: 'safe'
				}
			]
		} );

		dialog.on( 'closing', function ( win, closed ) {
			closed.then( function ( data ) {
				deferred.resolve( data && data.action === 'accept' );
			} );
		} );

		return deferred.promise();
	};

	/**
	 * Show an alert dialog
	 *
	 * @param {string} message - The message to display
	 * @param {string} title - The dialog title
	 * @param {string} type - The message type ('error', 'warning', 'success')
	 * @return {Promise} Promise that resolves when dialog is closed
	 */
	DialogManager.prototype.alert = function ( message, title, type ) {
		var dialog = new OO.ui.MessageDialog();
		var deferred = $.Deferred();

		this.windowManager.addWindows( [ dialog ] );

		var config = {
			title: title || mw.message( 'layers-alert-title' ).text(),
			message: message,
			actions: [
				{
					action: 'accept',
					label: mw.message( 'layers-alert-ok' ).text(),
					flags: [ 'primary', 'safe' ]
				}
			]
		};

		// Add appropriate icon based on type
		if ( type === 'error' ) {
			// eslint-disable-next-line es-x/no-regexp-prototype-flags
			config.flags = 'warning';
		} else if ( type === 'warning' ) {
			// eslint-disable-next-line es-x/no-regexp-prototype-flags
			config.flags = 'warning';
		} else if ( type === 'success' ) {
			// eslint-disable-next-line es-x/no-regexp-prototype-flags
			config.flags = 'safe';
		}

		this.windowManager.openWindow( dialog, config );

		dialog.on( 'closing', function ( win, closed ) {
			closed.then( function () {
				deferred.resolve();
			} );
		} );

		return deferred.promise();
	};

	/**
	 * Show a progress dialog
	 *
	 * @param {string} message - The progress message
	 * @param {string} title - The dialog title
	 * @return {Object} Object with update and close methods
	 */
	DialogManager.prototype.progress = function ( message, title ) {
		var dialog = new OO.ui.ProcessDialog();
		var progressBar = new OO.ui.ProgressBarWidget();
		var $content = $( '<div>' ).append(
			$( '<p>' ).text( message ),
			progressBar.$element
		);

		this.windowManager.addWindows( [ dialog ] );

		// Override the dialog's getBodyHeight method
		dialog.getBodyHeight = function () {
			return 120;
		};

		// Set up the dialog content
		dialog.initialize = function () {
			OO.ui.ProcessDialog.prototype.initialize.call( this );
			this.$body.append( $content );
		};

		this.windowManager.openWindow( dialog, {
			title: title || mw.message( 'layers-progress-title' ).text()
		} );

		return {
			update: function ( progress, newMessage ) {
				if ( typeof progress === 'number' ) {
					progressBar.setProgress( progress );
				}
				if ( newMessage ) {
					$content.find( 'p' ).first().text( newMessage );
				}
			},
			close: function () {
				dialog.close();
			}
		};
	};

	// Export for use in other modules
	window.LayersDialogManager = DialogManager;

}() );
