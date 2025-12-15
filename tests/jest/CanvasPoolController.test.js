const CanvasPoolController = require('../../resources/ext.layers.editor/canvas/CanvasPoolController');

describe('CanvasPoolController', () => {
    test('getTempCanvas and returnTempCanvas reuse canvases and destroy clears pool', () => {
        const mgr = { maxPoolSize: 2 };
        const ctrl = new CanvasPoolController(mgr, { maxPoolSize: 2 });

        const t1 = ctrl.getTempCanvas(50, 60);
        expect(t1).toHaveProperty('canvas');
        expect(t1).toHaveProperty('context');

        ctrl.returnTempCanvas(t1);
        expect(ctrl.pool.length).toBe(1);

        const t2 = ctrl.getTempCanvas(30, 20);
        // t2 reused from pool
        expect(t2).toHaveProperty('canvas');
        expect(ctrl.pool.length).toBe(0);

        ctrl.returnTempCanvas(t2);
        expect(ctrl.pool.length).toBe(1);

        ctrl.destroy();
        expect(ctrl.pool.length).toBe(0);
    });
});
