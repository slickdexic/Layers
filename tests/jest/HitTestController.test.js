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
                id: 'rect1',
                type: 'rectangle',
                x: 300,
                y: 500,
                width: 200,
                height: 100,
                visible: true,
                locked: false
            },
            {
                id: 'rect2',
                type: 'rectangle',
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

        test('should fall back to manager.selectionHandles when renderer and selectionManager have no handles', () => {
            // Clear renderer handles
            mockCanvasManager.renderer.selectionHandles = null;
            // Clear selectionManager handles
            mockCanvasManager.selectionManager.selectionHandles = [];
            // Set manager.selectionHandles
            mockCanvasManager.selectionHandles = [
                { type: 'fallback', rect: { x: 10, y: 10, width: 10, height: 10 } }
            ];
            const point = { x: 15, y: 15 };
            const result = hitTestController.hitTestSelectionHandles(point);
            expect(result).not.toBeNull();
            expect(result.type).toBe('fallback');
        });

        test('should use manager.selectionHandles when selectionManager exists but has empty handles array', () => {
            mockCanvasManager.renderer.selectionHandles = null;
            mockCanvasManager.selectionManager = {
                selectionHandles: [] // empty array, length = 0
            };
            mockCanvasManager.selectionHandles = [
                { type: 'direct', rect: { x: 20, y: 20, width: 10, height: 10 } }
            ];
            const point = { x: 25, y: 25 };
            const result = hitTestController.hitTestSelectionHandles(point);
            expect(result.type).toBe('direct');
        });

        test('should find handle when point is within hit tolerance (4px outside visual rect)', () => {
            // Handle rect is at x:95, y:95, width:10, height:10 (so right edge is at x=105)
            // Hit tolerance is 4px, so we should still hit at x=108 (3px outside)
            const pointJustOutside = { x: 108, y: 100 };
            const result = hitTestController.hitTestSelectionHandles(pointJustOutside);
            expect(result).not.toBeNull();
            expect(result.type).toBe('nw');
        });

        test('should not find handle when point is beyond hit tolerance', () => {
            // Handle rect is at x:95, y:95, width:10, height:10 (so right edge is at x=105)
            // Hit tolerance is 4px, so we should NOT hit at x=111 (6px outside)
            const pointFarOutside = { x: 111, y: 100 };
            const result = hitTestController.hitTestSelectionHandles(pointFarOutside);
            // Should not match the nw handle, might match something else or null
            if (result !== null) {
                expect(result.type).not.toBe('nw');
            }
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

    describe('isPointInLayer - textbox', () => {
        test('should detect point inside textbox', () => {
            const textbox = {
                id: 'textbox1',
                type: 'textbox',
                x: 100,
                y: 100,
                width: 200,
                height: 100,
                text: 'Hello World',
                visible: true,
                locked: false
            };
            const point = { x: 200, y: 150 };
            expect(hitTestController.isPointInLayer(point, textbox)).toBe(true);
        });

        test('should detect point outside textbox', () => {
            const textbox = {
                id: 'textbox2',
                type: 'textbox',
                x: 100,
                y: 100,
                width: 200,
                height: 100,
                visible: true,
                locked: false
            };
            const point = { x: 50, y: 50 };
            expect(hitTestController.isPointInLayer(point, textbox)).toBe(false);
        });
    });

    describe('isPointInLayer - image', () => {
        test('should detect point inside image layer', () => {
            const imageLayer = {
                id: 'image1',
                type: 'image',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                src: 'data:image/png;base64,test',
                visible: true,
                locked: false
            };
            const point = { x: 200, y: 175 };
            expect(hitTestController.isPointInLayer(point, imageLayer)).toBe(true);
        });

        test('should detect point outside image layer', () => {
            const imageLayer = {
                id: 'image2',
                type: 'image',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                visible: true,
                locked: false
            };
            const point = { x: 50, y: 50 };
            expect(hitTestController.isPointInLayer(point, imageLayer)).toBe(false);
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

        test('should detect point inside ellipse directly', () => {
            const layer = {
                type: 'ellipse',
                x: 100,
                y: 100,
                radiusX: 50,
                radiusY: 30
            };
            // Point at center should be inside
            const centerPoint = { x: 100, y: 100 };
            expect(hitTestController.isPointInEllipse(centerPoint, layer)).toBe(true);

            // Point on horizontal edge should be inside
            const edgeX = { x: 149, y: 100 };
            expect(hitTestController.isPointInEllipse(edgeX, layer)).toBe(true);

            // Point on vertical edge should be inside
            const edgeY = { x: 100, y: 129 };
            expect(hitTestController.isPointInEllipse(edgeY, layer)).toBe(true);
        });

        test('should detect point outside ellipse directly', () => {
            const layer = {
                type: 'ellipse',
                x: 100,
                y: 100,
                radiusX: 50,
                radiusY: 30
            };
            // Point outside horizontally
            const outsideX = { x: 160, y: 100 };
            expect(hitTestController.isPointInEllipse(outsideX, layer)).toBe(false);

            // Point outside vertically
            const outsideY = { x: 100, y: 140 };
            expect(hitTestController.isPointInEllipse(outsideY, layer)).toBe(false);
        });

        test('should handle ellipse with only radiusY zero', () => {
            const layer = {
                type: 'ellipse',
                x: 100,
                y: 100,
                radiusX: 50,
                radiusY: 0
            };
            const point = { x: 100, y: 100 };
            expect(hitTestController.isPointInEllipse(point, layer)).toBe(false);
        });

        test('should handle ellipse with only radiusX zero', () => {
            const layer = {
                type: 'ellipse',
                x: 100,
                y: 100,
                radiusX: 0,
                radiusY: 30
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

        test('should detect point near curved arrow (Bézier curve)', () => {
            const curvedArrow = {
                id: 'curvedArrow1',
                type: 'arrow',
                x1: 100,
                y1: 100,
                x2: 300,
                y2: 100,
                controlX: 200,
                controlY: 0, // control point above the line - makes it curved
                strokeWidth: 2,
                visible: true,
                locked: false
            };
            // Point near the top of the curve
            const point = { x: 200, y: 55 };
            expect(hitTestController.isPointInLayer(point, curvedArrow)).toBe(true);
        });

        test('should detect point far from curved arrow', () => {
            const curvedArrow = {
                id: 'curvedArrow2',
                type: 'arrow',
                x1: 100,
                y1: 100,
                x2: 300,
                y2: 100,
                controlX: 200,
                controlY: 0,
                strokeWidth: 2,
                visible: true,
                locked: false
            };
            // Point far from curve
            const point = { x: 200, y: 200 };
            expect(hitTestController.isPointInLayer(point, curvedArrow)).toBe(false);
        });

        test('should treat arrow without curve offset as straight line', () => {
            // Control point at midpoint = no curve (straight line)
            const straightArrow = {
                id: 'straightArrow',
                type: 'arrow',
                x1: 100,
                y1: 100,
                x2: 300,
                y2: 100,
                controlX: 200,  // midpoint
                controlY: 100,  // midpoint - no offset
                strokeWidth: 2,
                visible: true,
                locked: false
            };
            const point = { x: 200, y: 104 };
            expect(hitTestController.isPointInLayer(point, straightArrow)).toBe(true);
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

        test('should handle star with points as number instead of starPoints', () => {
            // This tests the fallback: (typeof layer.points === 'number' ? layer.points : null)
            const layer = {
                id: 'starWithNumericPoints',
                type: 'star',
                x: 100,
                y: 100,
                points: 6, // Using 'points' instead of 'starPoints'
                outerRadius: 50,
                innerRadius: 20,
                rotation: 0,
                visible: true,
                locked: false
            };
            // Point at center should be inside
            const centerPoint = { x: 100, y: 100 };
            expect(hitTestController.isPointInLayer(centerPoint, layer)).toBe(true);
        });

        test('should handle star using radius instead of outerRadius', () => {
            const layer = {
                id: 'starWithRadius',
                type: 'star',
                x: 100,
                y: 100,
                starPoints: 5,
                radius: 50, // Using 'radius' instead of 'outerRadius'
                rotation: 0,
                visible: true,
                locked: false
            };
            // Point at center should be inside
            const centerPoint = { x: 100, y: 100 };
            expect(hitTestController.isPointInLayer(centerPoint, layer)).toBe(true);
        });

        test('should calculate innerRadius from outerRadius when not provided', () => {
            const layer = {
                id: 'starNoInner',
                type: 'star',
                x: 100,
                y: 100,
                starPoints: 5,
                outerRadius: 50,
                // No innerRadius - should default to outerRadius * 0.4
                rotation: 0,
                visible: true,
                locked: false
            };
            // Point at center should be inside
            const centerPoint = { x: 100, y: 100 };
            expect(hitTestController.isPointInLayer(centerPoint, layer)).toBe(true);
        });

        test('should handle polygon with outerRadius property', () => {
            const layer = {
                id: 'polygonWithOuterRadius',
                type: 'polygon',
                x: 100,
                y: 100,
                sides: 5,
                outerRadius: 50, // Using 'outerRadius' instead of 'radius'
                rotation: 0,
                visible: true,
                locked: false
            };
            // Point at center should be inside
            const centerPoint = { x: 100, y: 100 };
            expect(hitTestController.isPointInLayer(centerPoint, layer)).toBe(true);
        });
    });

    describe('isPointInLayer - blur', () => {
        test('should detect point inside blur region', () => {
            const layer = mockLayers[9]; // blur1
            const point = { x: 400, y: 550 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(true);
        });

        test('should detect point outside blur region', () => {
            const layer = mockLayers[9];
            const point = { x: 600, y: 650 };
            expect(hitTestController.isPointInLayer(point, layer)).toBe(false);
        });
    });

    describe('isPointInLayer - blur2', () => {
        test('should detect point inside blur2 region', () => {
            const layer = mockLayers[10]; // blur2
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

    describe('isPointNearQuadraticBezier', () => {
        test('should return true for point near curved path', () => {
            // Quadratic Bézier from (0,0) to (200,0) with control at (100,-50)
            const result = hitTestController.isPointNearQuadraticBezier(
                { x: 100, y: -23 },  // Near the apex of the curve
                0, 0,                 // start
                100, -50,             // control
                200, 0,               // end
                10                    // tolerance
            );
            expect(result).toBe(true);
        });

        test('should return false for point far from curved path', () => {
            const result = hitTestController.isPointNearQuadraticBezier(
                { x: 100, y: 50 },   // Far below the curve
                0, 0,
                100, -50,
                200, 0,
                10
            );
            expect(result).toBe(false);
        });

        test('should return true for point at start of curve', () => {
            const result = hitTestController.isPointNearQuadraticBezier(
                { x: 5, y: 2 },
                0, 0,
                100, -50,
                200, 0,
                10
            );
            expect(result).toBe(true);
        });

        test('should return true for point at end of curve', () => {
            const result = hitTestController.isPointNearQuadraticBezier(
                { x: 195, y: 2 },
                0, 0,
                100, -50,
                200, 0,
                10
            );
            expect(result).toBe(true);
        });

        test('should use default tolerance when not provided', () => {
            const result = hitTestController.isPointNearQuadraticBezier(
                { x: 100, y: -23 },
                0, 0,
                100, -50,
                200, 0
                // no tolerance - should default to 6
            );
            expect(result).toBe(true);
        });
    });

    describe('pointToQuadraticBezierDistance', () => {
        test('should return 0 for point exactly on curve', () => {
            // Point at the start of the curve
            const dist = hitTestController.pointToQuadraticBezierDistance(
                0, 0,          // point at start
                0, 0,          // start
                100, -50,      // control
                200, 0         // end
            );
            expect(dist).toBe(0);
        });

        test('should return small distance for point near curve', () => {
            // Point near the middle of a curve
            const dist = hitTestController.pointToQuadraticBezierDistance(
                100, -25,      // point near apex (apex is at ~-25)
                0, 0,
                100, -50,
                200, 0
            );
            expect(dist).toBeLessThan(5);
        });

        test('should return large distance for point far from curve', () => {
            const dist = hitTestController.pointToQuadraticBezierDistance(
                100, 100,      // point far below
                0, 0,
                100, -50,
                200, 0
            );
            expect(dist).toBeGreaterThan(100);
        });

        test('should handle S-curve (extreme control point)', () => {
            const dist = hitTestController.pointToQuadraticBezierDistance(
                50, 50,        // test point
                0, 0,          // start
                100, 100,      // control - makes curve bow outward
                200, 0         // end
            );
            expect(dist).toBeLessThan(20);
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

    describe('destroy', () => {
        test('should clean up manager reference', () => {
            expect(hitTestController.manager).not.toBeNull();
            hitTestController.destroy();
            expect(hitTestController.manager).toBeNull();
        });
    });

    describe('isPointInMarker', () => {
        test('should detect point inside marker circle', () => {
            const markerLayer = {
                id: 'marker1',
                type: 'marker',
                x: 100,
                y: 100,
                size: 30,
                visible: true
            };

            // Point at center
            expect(hitTestController.isPointInMarker({ x: 100, y: 100 }, markerLayer)).toBe(true);

            // Point just inside radius + tolerance (radius 15 + tolerance 5 = 20)
            expect(hitTestController.isPointInMarker({ x: 115, y: 100 }, markerLayer)).toBe(true);
        });

        test('should detect point outside marker circle', () => {
            const markerLayer = {
                id: 'marker1',
                type: 'marker',
                x: 100,
                y: 100,
                size: 30,
                visible: true
            };

            // Point clearly outside
            expect(hitTestController.isPointInMarker({ x: 200, y: 200 }, markerLayer)).toBe(false);
        });

        test('should use default size when not specified', () => {
            const markerLayer = {
                id: 'marker1',
                type: 'marker',
                x: 100,
                y: 100,
                visible: true
            };

            // Default size 24, radius 12 + tolerance 5 = 17
            expect(hitTestController.isPointInMarker({ x: 116, y: 100 }, markerLayer)).toBe(true);
        });

        test('should detect point near arrow line when marker has arrow', () => {
            const markerLayer = {
                id: 'marker1',
                type: 'marker',
                x: 100,
                y: 100,
                size: 30,
                hasArrow: true,
                arrowX: 200,
                arrowY: 100,
                visible: true
            };

            // Point on arrow line (between marker center and arrow endpoint)
            expect(hitTestController.isPointInMarker({ x: 150, y: 100 }, markerLayer)).toBe(true);
        });

        test('should not detect point far from arrow line', () => {
            const markerLayer = {
                id: 'marker1',
                type: 'marker',
                x: 100,
                y: 100,
                size: 30,
                hasArrow: true,
                arrowX: 200,
                arrowY: 100,
                visible: true
            };

            // Point far from both marker and arrow line
            expect(hitTestController.isPointInMarker({ x: 150, y: 50 }, markerLayer)).toBe(false);
        });
    });

    describe('isPointNearDimension', () => {
        test('should detect point near dimension line', () => {
            const dimensionLayer = {
                id: 'dim1',
                type: 'dimension',
                x1: 100,
                y1: 100,
                x2: 300,
                y2: 100,
                visible: true
            };

            // Point on the line
            expect(hitTestController.isPointNearDimension({ x: 200, y: 100 }, dimensionLayer)).toBe(true);

            // Point slightly above (within tolerance of 10)
            expect(hitTestController.isPointNearDimension({ x: 200, y: 105 }, dimensionLayer)).toBe(true);
        });

        test('should not detect point far from dimension line', () => {
            const dimensionLayer = {
                id: 'dim1',
                type: 'dimension',
                x1: 100,
                y1: 100,
                x2: 300,
                y2: 100,
                visible: true
            };

            // Point far from the line
            expect(hitTestController.isPointNearDimension({ x: 200, y: 150 }, dimensionLayer)).toBe(false);
        });

        test('should use default coordinates when not specified', () => {
            const dimensionLayer = {
                id: 'dim1',
                type: 'dimension',
                visible: true
            };

            // Point at origin (default coords are 0,0 to 0,0)
            expect(hitTestController.isPointNearDimension({ x: 0, y: 0 }, dimensionLayer)).toBe(true);
        });
    });

    describe('pointToLineDistance', () => {
        test('should calculate zero distance for point on line', () => {
            const distance = hitTestController.pointToLineDistance(50, 50, 0, 0, 100, 100);
            expect(distance).toBeCloseTo(0, 5);
        });

        test('should calculate perpendicular distance from point to line', () => {
            // Horizontal line from (0,0) to (100,0)
            // Point at (50, 10) should be 10 units away
            const distance = hitTestController.pointToLineDistance(50, 10, 0, 0, 100, 0);
            expect(distance).toBeCloseTo(10, 5);
        });

        test('should calculate distance to endpoint when projection is outside segment', () => {
            // Line from (0,0) to (100,0)
            // Point at (-10, 0) should be 10 units from start
            const distance = hitTestController.pointToLineDistance(-10, 0, 0, 0, 100, 0);
            expect(distance).toBeCloseTo(10, 5);
        });

        test('should handle zero-length line (point)', () => {
            // Both endpoints at same location
            const distance = hitTestController.pointToLineDistance(10, 10, 50, 50, 50, 50);
            // Distance should be to the point itself
            expect(distance).toBeGreaterThan(0);
        });

        test('should calculate distance for diagonal line', () => {
            // Line from (0,0) to (10,10), point at (0,10)
            // Perpendicular distance from (0,10) to diagonal line
            const distance = hitTestController.pointToLineDistance(0, 10, 0, 0, 10, 10);
            expect(distance).toBeCloseTo(Math.sqrt(50), 5); // ~7.07
        });
    });

    describe('isPointInLayer - marker and dimension', () => {
        test('should detect point inside marker via isPointInLayer', () => {
            const markerLayer = {
                id: 'marker1',
                type: 'marker',
                x: 100,
                y: 100,
                size: 30,
                visible: true
            };

            // Point at center
            expect(hitTestController.isPointInLayer({ x: 100, y: 100 }, markerLayer)).toBe(true);
        });

        test('should detect point outside marker via isPointInLayer', () => {
            const markerLayer = {
                id: 'marker1',
                type: 'marker',
                x: 100,
                y: 100,
                size: 30,
                visible: true
            };

            // Point far away
            expect(hitTestController.isPointInLayer({ x: 200, y: 200 }, markerLayer)).toBe(false);
        });

        test('should detect point on dimension via isPointInLayer', () => {
            const dimensionLayer = {
                id: 'dim1',
                type: 'dimension',
                x1: 100,
                y1: 100,
                x2: 200,
                y2: 100,
                visible: true
            };

            // Point on the line
            expect(hitTestController.isPointInLayer({ x: 150, y: 100 }, dimensionLayer)).toBe(true);
        });

        test('should detect point off dimension via isPointInLayer', () => {
            const dimensionLayer = {
                id: 'dim1',
                type: 'dimension',
                x1: 100,
                y1: 100,
                x2: 200,
                y2: 100,
                visible: true
            };

            // Point far from line
            expect(hitTestController.isPointInLayer({ x: 150, y: 200 }, dimensionLayer)).toBe(false);
        });
    });

    describe('HIGH-v29-1 regression: rotation-aware hit testing', () => {
        test('isPointInRectangleLayer handles 45° rotation', () => {
            const layer = {
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 100,
                height: 50,
                rotation: 45,
                visible: true,
                locked: false
            };
            // Center of rectangle (150, 125) should always hit
            expect(hitTestController.isPointInRectangleLayer({ x: 150, y: 125 }, layer)).toBe(true);

            // A point that would hit the unrotated rect but misses the rotated one
            // Top-left corner of unrotated rect is (100,100); after 45° rotation around center,
            // this corner moves. A point at (100, 100) is now outside the rotated bounds.
            // The un-rotation maps it back and tests against axis-aligned bounds.
            // Point at (100, 100) when un-rotated around (150,125):
            // dx=-50, dy=-25, rad=-45°, cos=0.707, sin=-0.707
            // unrotX = 150 + (-50*0.707 - (-25)*(-0.707)) = 150 + (-35.35 - 17.68) = 96.97
            // unrotY = 125 + (-50*(-0.707) + (-25)*0.707) = 125 + (35.35 - 17.68) = 142.67
            // unrotX=96.97 < 100 so it's OUTSIDE
            expect(hitTestController.isPointInRectangleLayer({ x: 100, y: 100 }, layer)).toBe(false);
        });

        test('isPointInRectangleLayer hits rotated corner correctly', () => {
            const layer = {
                type: 'rectangle',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                rotation: 45,
                visible: true,
                locked: false
            };
            // Center (50, 50) should hit
            expect(hitTestController.isPointInRectangleLayer({ x: 50, y: 50 }, layer)).toBe(true);

            // Point at top of diamond (after 45° rotation of 100x100 square centered at 50,50)
            // Top of diamond is at (50, 50 - 50*sqrt(2)) ≈ (50, -20.7) — just inside
            // Test a point clearly inside the rotated diamond
            expect(hitTestController.isPointInRectangleLayer({ x: 50, y: -15 }, layer)).toBe(true);
        });

        test('isPointInRectangleLayer with rotation=0 works normally', () => {
            const layer = {
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                rotation: 0,
                visible: true,
                locked: false
            };
            expect(hitTestController.isPointInRectangleLayer({ x: 200, y: 175 }, layer)).toBe(true);
            expect(hitTestController.isPointInRectangleLayer({ x: 50, y: 50 }, layer)).toBe(false);
        });

        test('isPointInCircle handles 90° rotation', () => {
            const layer = {
                type: 'circle',
                x: 200,
                y: 200,
                radius: 50,
                rotation: 90,
                visible: true,
                locked: false
            };
            // Circle is rotationally symmetric, so center should hit regardless
            expect(hitTestController.isPointInCircle({ x: 200, y: 200 }, layer)).toBe(true);
            // Point on edge
            expect(hitTestController.isPointInCircle({ x: 249, y: 200 }, layer)).toBe(true);
            // Point outside
            expect(hitTestController.isPointInCircle({ x: 260, y: 200 }, layer)).toBe(false);
        });

        test('isPointInEllipse handles 90° rotation', () => {
            const layer = {
                type: 'ellipse',
                x: 300,
                y: 300,
                radiusX: 100,
                radiusY: 30,
                rotation: 90,
                visible: true,
                locked: false
            };
            // Center should always hit
            expect(hitTestController.isPointInEllipse({ x: 300, y: 300 }, layer)).toBe(true);

            // With 90° rotation, the ellipse major axis (100) is now vertical.
            // So point at (300, 390) should be inside (within vertical radius 100)
            expect(hitTestController.isPointInEllipse({ x: 300, y: 390 }, layer)).toBe(true);

            // But point at (390, 300) should be outside (horizontal is now only 30)
            expect(hitTestController.isPointInEllipse({ x: 390, y: 300 }, layer)).toBe(false);

            // Point at (325, 300) should be inside (within the minor axis of 30)
            expect(hitTestController.isPointInEllipse({ x: 325, y: 300 }, layer)).toBe(true);
        });

        test('isPointInEllipse without rotation still works', () => {
            const layer = {
                type: 'ellipse',
                x: 300,
                y: 300,
                radiusX: 100,
                radiusY: 30
            };
            // Point within horizontal extent but outside vertical
            expect(hitTestController.isPointInEllipse({ x: 390, y: 300 }, layer)).toBe(true);
            expect(hitTestController.isPointInEllipse({ x: 300, y: 340 }, layer)).toBe(false);
        });
    });
});
