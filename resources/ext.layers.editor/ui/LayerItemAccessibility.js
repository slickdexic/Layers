/** Shared names and state for interactive controls within noninteractive list rows. */
( function () {
	'use strict';
	function update( item, layer, name, selected, msg ) {
		item.setAttribute( 'role', 'listitem' );
		item.setAttribute( 'aria-label', name );
		item.removeAttribute( 'aria-selected' );
		const controls = [
			[ '.layer-grab-area', layer.type === 'group' ? msg( 'layers-folder-grab', 'Drag to reorder folder' ) :
				msg( 'layers-grab-area', 'Drag to move/select' ), selected ],
			[ '.layer-name[role="button"]', msg( 'layers-layer-name', 'Layer Name' ) ],
			[ '.layer-visibility', msg( 'layers-toggle-visibility', 'Toggle visibility' ), layer.visible !== false && layer.visible !== 0 ],
			[ '.layer-lock', msg( 'layers-toggle-lock', 'Toggle lock' ), !!layer.locked ],
			[ '.layer-delete', msg( 'layers-delete-layer-button', 'Delete layer' ) ],
			[ '.layer-expand-toggle', layer.expanded !== false ? msg( 'layers-collapse-group', 'Collapse group' ) :
				msg( 'layers-expand-group', 'Expand group' ) ]
		];
		for ( const [ selector, label, pressed ] of controls ) {
			const control = item.querySelector( selector );
			if ( control ) {
				control.setAttribute( 'aria-label', label + ' - ' + name );
				if ( pressed !== undefined ) { control.setAttribute( 'aria-pressed', String( pressed ) ); }
			}
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.UI = window.Layers.UI || {};
	window.Layers.UI.updateLayerItemAccessibility = update;
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = update; }
}() );
