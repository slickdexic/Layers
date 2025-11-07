const { create } = require( 'zustand' );

const useLayersStore = create( ( set, get ) => ( {
	layers: [],
	selectedLayerId: null,
	tool: 'select',
	zoom: 1,
	pan: { x: 0, y: 0 },
	history: [],
	historyIndex: -1,

	// Actions
	setLayers: ( layers ) => set( { layers } ),
	addLayer: ( layer ) => set( ( state ) => ( {
		layers: [ ...state.layers, layer ]
	} ) ),
	updateLayer: ( id, updates ) => set( ( state ) => ( {
		layers: state.layers.map( layer => layer.id === id ? { ...layer, ...updates } : layer )
	} ) ),
	deleteLayer: ( id ) => set( ( state ) => ( {
		layers: state.layers.filter( layer => layer.id !== id )
	} ) ),
	selectLayer: ( id ) => set( { selectedLayerId: id } ),
	setTool: ( tool ) => set( { tool } ),
	setZoom: ( zoom ) => set( { zoom } ),
	setPan: ( pan ) => set( { pan } ),

	// History
	saveState: () => set( ( state ) => {
		const currentState = { layers: state.layers, selectedLayerId: state.selectedLayerId };
		const newHistory = state.history.slice( 0, state.historyIndex + 1 );
		newHistory.push( currentState );
		return {
			history: newHistory,
			historyIndex: newHistory.length - 1
		};
	} ),
	undo: () => set( ( state ) => {
		if ( state.historyIndex > 0 ) {
			const prevState = state.history[state.historyIndex - 1];
			return {
				...prevState,
				historyIndex: state.historyIndex - 1
			};
		}
		return state;
	} ),
	redo: () => set( ( state ) => {
		if ( state.historyIndex < state.history.length - 1 ) {
			const nextState = state.history[state.historyIndex + 1];
			return {
				...nextState,
				historyIndex: state.historyIndex + 1
			};
		}
		return state;
	} )
} ) );

module.exports = useLayersStore;