/**
 * @jest-environment jsdom
 */

const HitTestController = require('../../resources/ext.layers.editor/canvas/HitTestController.js');

describe('HitTestController', () => {
    let hitTestController;
    let mockCanvasManager;
    let mockLayers;

    beforeEach(() => {
        // Create mock layers
        mockLayers = [
            {
                id: 'rect1',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                visible: true,
                locked: false
            },
            {
                id: 'circle1',
                type: 'circle',
                x: 400,
                y: 200,
                radius: 50,
                visible: true,
                locked: false
            },
            {
                id: 'ellipse1',
                type: 'ellipse',
                x: 600,
                y: 200,
                radiusX: 80,
                radiusY: 40,
                visible: true,
                locked: false
            },
            {
                id: 'text1',
                type: 'text',
                x: 100,
                y: 300,
                width: 150,
                height: 30,
                text: 'Test Text',
                visible: true,
                locked: false
            },
            {
                id: 'line1',
                type: 'line',
                x1: 50,
                y1: 400,
                x2: 250,
                y2: 450,
                strokeWidth: 2,
                visible: true,
                locked: false
            },
            {
                id: 'arrow1',
                type: 'arrow',
                x1: 300,
                y1: 400,
                x2: 500,
                y2: 420,
                strokeWidth: 3,
                visible: true,
                locked: false
            },
            {
                id: 'polygon1',
                type: 'polygon',
                x: 700,
                y: 400,
                sides: 6,
                radius: 60,
                rotation: 0,
                visible: true,
                locked: false
            },
            {
                id: 'star1',
                type: 'star',
                x: 850,
                y: 400,
                starPoints: 5,
                outerRadius: 50,
                innerRadius: 20,
                rotation: 0,
                visible: true,
                locked: false
            },
            {
                id: 'path1',
                type: 'path',
                points: [
                    { x: 100, y: 500 },
                    { x: 150, y: 520 },
                    { x: 200, y: 510 },
                    { x: 250, y: 540 }
                ],
                strokeWidth: 3,
                visible: true,
                locked: false
            },
            {
                id: 'highlight1',
                type: 'highlight',
                x: 300,
                y: 500,
                width: 200,
                height: 25,
                visible: true,
                locked: false
            },
            {
                id: 'blur1',
                type: 'blur',
                x: 550,
                y: 500,
                width: 150,
                height: 100,
                visible: true,
                locked: false
            }
        ];

        // Create mock selection handles
        const mockSelectionHandles = [
            { type: 'nw', rect: { x: 95, y: 95, width: 10, height: 10 } },
            { type: 'ne', rect: { x: 295, y: 95, width: 10, height: 10 } },
            { type: 'sw', rect: { x: 95, y: 245, width: 10, height: 10 } },
            { type: 'se', rect: { x: 295, y: 245, width: 10, height: 10 } },
            { type: 'rotate', rect: { x: 195, y: 60, width: 12, height: 12 } }
        ];

        // Create mock CanvasManager
        mockCanvasManager = {
            editor: {
                layers: mockLayers
            },
            renderer: {
                selectionHandles: mockSelectionHandles
            },
            selectionManager: {
                selectionHandles: mockSelectionHandles
            },
            selectionHandles: mockSelectionHandles,
            getLayerBounds: jest.fn((layer) => {
                // Return bounds for text layers
                if (layer.type === 'text') {
                    return {
                        x: layer.x,
                        y: layer.y,
                        width: layer.width || 150,
                        height: layer.height || 30
                    };
                }
                return null;
            })
        };

        // Create HitTestController instance
        hitTestController = new HitTestController(mockCanvasManager);
    });

    describe('initialization', () => {
        test('should create HitTestController with manager reference', () => {
            expect(hitTestController.manager).toBe(mockCanvasManager);
        });
    });

    describe('isPointInRect', () => {
        test('should return true for point inside rectangle', () => {
            const point = { x: 150, y: 150 };
            const rect = { x: 100, y: 100, width: 200, height: 100 };
            expect(hitTestController.isPointInRect(point, rect)).toBe(true);
        });

        test('should return true for point on boundary', () => {
            const point = { x: 100, y: 100 };
            const rect = { x: 100, y: 100, width: 200, height: 100 };
            expect(hitTestController.isPointInRect(point, rect)).toBe(true);
        });

        test('should return false for point outside rectangle', () => {
            const point = { x: 50, y: 50 };
            const rect = { x: 100, y: 100, width: 200, height: 100 };
            expect(hitTestController.isPointInRect(point, rect)).toBe(false);
        });
    });

    describe('hitTestSelectionHandles', () => {
        test('should find handle when point is inside', () => {
            const point = { x: 98, y: 98 };
            const result = hitTestController.hitTestSelectionHandles(point);
            expect(result).not.toBeNull();
            expect(result.type).toBe('nw');
        });

        test('should return null when point is outside all handles', () => {
            const point = { x: 500, y: 500 };
            const result = hitTestController.hitTestSelectionHandles(point);
            expect(result).toBeNull();
        });

        test('should find rotate handle', () => {
            const point = { x: 200, y: 65 };
            const result = hitTestController.hitTestSelectionHandles(point);
            expect(result).not.toBeNull();
            expect(result.type).toBe('rotate');
        });

        test('should use renderer handles first', () => {
            mockCanvasManager.renderer.selectionHandles = [
                { type: 'test', rect: { x: 0, y: 0, width: 10, height: 10 } }
            ];
            const point = { x: 5, y: 5 };
            const result = hitTestController.hitTestSelectionHandles(point);
            expect(result.type).toBe('test');
        });
    });

    describe('getLayerAtPoint', () => {
        test('should find rectangle layer at point', () => {
            const point = { x: 150, y: 150 };
            const result = hitTestController.getLayerAtPoint(point);
            expect(result).not.toBeNull();
            expect(result.id).toBe('rect1');
        });

        test('should find circle layer at point', () => {
            const point = { x: 400, y: 200 };
            const result = hitTestController.getLayerAtPoint(point);
            expect(result).not.toBeNull();
            expect(result.id).toBe('circle1');
        });

        test('should return null for point outside all layers', () => {
            const point = { x: 1000, y: 1000 };
            const result = hitTestController.getLayerAtPoint(point);
            expect(result).toBeNull();
        });

        test('should skip invisible layers', () => {
            mockLayers[0].visible = false;
            const point = { x: 150, y: 150 };
            const result = hitTestController.getLayerAtPoint(point);
            expect(result).toBeNull();
        });

        test('should skip locked layers', () => {
            mockLayers[0].locked = true;
            const point = { x: 150, y: 150 };
            const result = hitTestController.getLayerAtPoint(point);
            expect(result).toBeNull();
        });

        test('should return topmost layer when overlapping', () => {
            // Add overlapping layer at index 0 (drawn on top)
            mockLayers.unshift({
                id: 'overlay',
                type: 'rectangle',
                x: 50,
                y: 50,
                width: 200,
                height: 200,
                visible: true,
                locked: false
            });
            const point = { x: 150, y: 150 };
            const result = hitTestController.getLayerAtPoint(point);
            expect(result.id).toBe('overlay');
        });
    });

    describe('isPointInLayer - rectangle', () => {
        test('should detect point inside rectangle', () => {
            const layer = mockLayers[0]; // rect1
            const point = { x: 200, y: 175 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside rectangle', () => {
            const layer = mockLayers[0];
            const point = { x: 50, y: 50 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });

        test('should handle negative width/height rectangles', () => {
            const layer = {
                type: 'rectangle',
                x: 200,
                y: 200,
                width: -100,
                height: -50
            };
            const point = { x: 150, y: 175 };
            expect(hitTestController.isPointInRectangleLayer(point, layer)).toBe(true);
        });
    });

    describe('isPointInLayer - circle', () => {
        test('should detect point inside circle', () => {
            const layer = mockLayers[1]; // circle1
            const point = { x: 420, y: 210 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside circle', () => {
            const layer = mockLayers[1];
            const point = { x: 500, y: 300 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });

        test('should detect point on circle edge', () => {
            const layer = mockLayers[1];
            const point = { x: 450, y: 200 }; // exactly on radius
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });
    });

    describe('isPointInLayer - ellipse', () => {
        test('should detect point inside ellipse', () => {
            const layer = mockLayers[2]; // ellipse1
            const point = { x: 600, y: 200 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside ellipse', () => {
            const layer = mockLayers[2];
            const point = { x: 700, y: 200 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });

        test('should return false for zero-radius ellipse', () => {
            const layer = {
                type: 'ellipse',
                x: 100,
                y: 100,
                radiusX: 0,
                radiusY: 0
            };
            const point = { x: 100, y: 100 };
            expect(hitTestController.isPointInEllipse(point, layer)).toBe(false);
        });
    });

    describe('isPointInLayer - text', () => {
        test('should detect point inside text bounds', () => {
            const layer = mockLayers[3]; // text1
            const point = { x: 150, y: 315 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside text bounds', () => {
            const layer = mockLayers[3];
            const point = { x: 50, y: 300 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });
    });

    describe('isPointInLayer - line and arrow', () => {
        test('should detect point near line', () => {
            const layer = mockLayers[4]; // line1
            const point = { x: 150, y: 425 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point far from line', () => {
            const layer = mockLayers[4];
            const point = { x: 150, y: 500 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });

        test('should detect point near arrow', () => {
            const layer = mockLayers[5]; // arrow1
            const point = { x: 400, y: 410 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });
    });

    describe('isPointInLayer - path', () => {
        test('should detect point near path', () => {
            const layer = mockLayers[8]; // path1
            const point = { x: 150, y: 520 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point far from path', () => {
            const layer = mockLayers[8];
            const point = { x: 150, y: 600 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });

        test('should return false for path with insufficient points', () => {
            const layer = {
                type: 'path',
                points: [{ x: 100, y: 100 }]
            };
            const point = { x: 100, y: 100 };
            expect(hitTestController.isPointInPath(point, layer)).toBe(false);
        });

        test('should return false for path with no points', () => {
            const layer = {
                type: 'path',
                points: null
            };
            const point = { x: 100, y: 100 };
            expect(hitTestController.isPointInPath(point, layer)).toBe(false);
        });
    });

    describe('isPointInLayer - polygon', () => {
        test('should detect point inside polygon', () => {
            const layer = mockLayers[6]; // polygon1 (hexagon)
            const point = { x: 700, y: 400 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside polygon', () => {
            const layer = mockLayers[6];
            const point = { x: 800, y: 500 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });
    });

    describe('isPointInLayer - star', () => {
        test('should detect point inside star center', () => {
            const layer = mockLayers[7]; // star1
            const point = { x: 850, y: 400 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside star', () => {
            const layer = mockLayers[7];
            const point = { x: 950, y: 500 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });
    });

    describe('isPointInLayer - highlight', () => {
        test('should detect point inside highlight', () => {
            const layer = mockLayers[9]; // highlight1
            const point = { x: 400, y: 510 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside highlight', () => {
            const layer = mockLayers[9];
            const point = { x: 600, y: 510 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });

        test('should use default height for highlight without height', () => {
            const layer = {
                type: 'highlight',
                x: 100,
                y: 100,
                width: 200
                // no height - should default to 20
            };
            const point = { x: 150, y: 115 };
            expect(hitTestController.isPointInHighlight(point, layer)).toBe(true);
        });
    });

    describe('isPointInLayer - blur', () => {
        test('should detect point inside blur region', () => {
            const layer = mockLayers[10]; // blur1
            const point = { x: 600, y: 550 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside blur region', () => {
            const layer = mockLayers[10];
            const point = { x: 800, y: 550 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });
    });

    describe('isPointInLayer - unknown type', () => {
        test('should return false for unknown layer type', () => {
            const layer = {
                type: 'unknown_type',
                x: 100,
                y: 100,
                width: 50,
                height: 50
            };
            const point = { x: 125, y: 125 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });

        test('should return false for null layer', () => {
            const point = { x: 100, y: 100 };
            expect(hitTestController.isPointInLayer(point, null)).toBe(false);
        });
    });

    describe('pointToSegmentDistance', () => {
        test('should calculate distance to horizontal line segment', () => {
            const dist = hitTestController.pointToSegmentDistance(100, 150, 0, 100, 200, 100);
            expect(dist).toBe(50);
        });

        test('should calculate distance to vertical line segment', () => {
            const dist = hitTestController.pointToSegmentDistance(150, 50, 100, 0, 100, 100);
            expect(dist).toBe(50);
        });

        test('should calculate distance to point on segment', () => {
            const dist = hitTestController.pointToSegmentDistance(100, 100, 0, 0, 200, 200);
            expect(dist).toBeCloseTo(0, 5);
        });

        test('should calculate distance to endpoint', () => {
            const dist = hitTestController.pointToSegmentDistance(0, 0, 100, 0, 200, 0);
            expect(dist).toBe(100);
        });

        test('should handle zero-length segment (point)', () => {
            const dist = hitTestController.pointToSegmentDistance(100, 100, 50, 50, 50, 50);
            const expected = Math.sqrt(50 * 50 + 50 * 50);
            expect(dist).toBeCloseTo(expected, 5);
        });
    });

    describe('isPointNearLine', () => {
        test('should return true for point within tolerance', () => {
            const result = hitTestController.isPointNearLine(
                { x: 100, y: 105 }, // 5 units from line
                0, 100, 200, 100,   // horizontal line at y=100
                10                  // tolerance
            );
            expect(result).toBe(true);
        });

        test('should return false for point outside tolerance', () => {
            const result = hitTestController.isPointNearLine(
                { x: 100, y: 120 }, // 20 units from line
                0, 100, 200, 100,   // horizontal line at y=100
                10                  // tolerance
            );
            expect(result).toBe(false);
        });

        test('should use default tolerance', () => {
            const result = hitTestController.isPointNearLine(
                { x: 100, y: 105 },
                0, 100, 200, 100
                // no tolerance - should default to 6
            );
            expect(result).toBe(true);
        });
    });

    describe('isPointInPolygon - ray casting algorithm', () => {
        test('should detect point inside triangle', () => {
            const polygon = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 50, y: 100 }
            ];
            const point = { x: 50, y: 50 };
            expect(hitTestController.isPointInPolygon(point, polygon)).toBe(true);
        });

        test('should detect point outside triangle', () => {
            const polygon = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 50, y: 100 }
            ];
            const point = { x: 150, y: 50 };
            expect(hitTestController.isPointInPolygon(point, polygon)).toBe(false);
        });

        test('should detect point inside square', () => {
            const polygon = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];
            const point = { x: 50, y: 50 };
            expect(hitTestController.isPointInPolygon(point, polygon)).toBe(true);
        });

        test('should detect point outside concave polygon', () => {
            // L-shaped polygon
            const polygon = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 50 },
                { x: 50, y: 50 },
                { x: 50, y: 100 },
                { x: 0, y: 100 }
            ];
            // Point in the "notch" of the L
            const point = { x: 75, y: 75 };
            expect(hitTestController.isPointInPolygon(point, polygon)).toBe(false);
        });
    });
});
