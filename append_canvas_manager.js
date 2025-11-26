const fs = require('fs');
const path = require('path');

const filePath = path.join('resources', 'ext.layers.editor', 'CanvasManager.js');

const contentToAppend = `
			return null;
		}

		return layer;
	};

	// Expose globally
	window.CanvasManager = CanvasManager;

}() );
`;

fs.appendFileSync(filePath, contentToAppend);
console.log('Appended content to CanvasManager.js');
