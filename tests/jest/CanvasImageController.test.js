const CanvasImageController = require('../../resources/ext.layers.editor/canvas/CanvasImageController');

describe('CanvasImageController', () => {
    afterEach(() => {
        delete global.ImageLoader;
    });

    test('delegates to global ImageLoader when available and calls manager.handleImageLoaded', () => {
        const calls = [];
        global.ImageLoader = class {
            constructor(opts) { this.opts = opts; calls.push('ctor'); }
            load() { calls.push('load'); this.opts.onLoad && this.opts.onLoad({ img: true }, { width: 100, height: 50 }); }
        };

        const manager = { handleImageLoaded: jest.fn(), loadBackgroundImageFallback: jest.fn(), handleImageLoadError: jest.fn() };
        const ctrl = new CanvasImageController(manager);
        ctrl.load('file.jpg', 'http://example');

        expect(calls).toContain('ctor');
        expect(calls).toContain('load');
        expect(manager.handleImageLoaded).toHaveBeenCalled();
    });

    test('falls back to manager.loadBackgroundImageFallback when no ImageLoader present', () => {
        const manager = { handleImageLoaded: jest.fn(), loadBackgroundImageFallback: jest.fn() };
        const ctrl = new CanvasImageController(manager);
        ctrl.load('file.jpg', 'http://example');
        expect(manager.loadBackgroundImageFallback).toHaveBeenCalled();
    });
});
