const PointerController = require('../../resources/ext.layers.editor/canvas/PointerController');

describe('PointerController', () => {
    test('getMousePointFromClient scales and snaps to grid', () => {
        // Create fake canvas with bounding rect
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 100;
        // stub getBoundingClientRect
        canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 50 });

        const manager = { canvas: canvas, snapToGrid: true, gridSize: 10 };
        const ctrl = new PointerController(manager);

        const pt = ctrl.getMousePointFromClient(60, 45); // relX=50, relY=25 -> scaleX=2 -> canvasX=100 canvasY=50 -> snaps to 100,50
        expect(pt.x).toBe(100);
        expect(pt.y).toBe(50);
    });

    test('getRawClientPoint accounts for pan/zoom', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 150;
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 150 });

        const manager = { canvas: canvas, panX: 10, panY: 20, zoom: 2 };
        const ctrl = new PointerController(manager);

        const e = { clientX: 110, clientY: 90 };
        const raw = ctrl.getRawClientPoint(e);
        // clientX=110 -> canvas px 110 -> (110 - panX)/zoom = (110-10)/2 = 50
        expect(raw.canvasX).toBe(50);
        expect(raw.canvasY).toBe(35);
    });
});
