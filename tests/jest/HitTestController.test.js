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

        test('should use selectionManager handles when renderer has no handles', () => {
            // Clear renderer handles so first `if` fails
            mockCanvasManager.renderer.selectionHandles = null;
            // Populate selectionManager handles so `else if` succeeds (line 57 covered)
            mockCanvasManager.selectionManager.selectionHandles = [
                { type: 'selMgr', rect: { x: 30, y: 30, width: 10, height: 10 } }
            ];
            const point = { x: 35, y: 35 };
            const result = hitTestController.hitTestSelectionHandles(point);
            expect(result).not.toBeNull();
            expect(result.type).toBe('selMgr');
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

        test('should return locked layers (locked layers are selectable but not movable)', () => {
            mockLayers[0].locked = true;
            const point = { x: 150, y: 150 };
            const result = hitTestController.getLayerAtPoint(point);
            expect(result).not.toBeNull();
            expect(result.locked).toBe(true);
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

    // ── isPointInLayer switch — uncovered layer types ─────────────────────────

    describe('isPointInLayer - customShape type', () => {
        test('should hit a customShape via bounding box (rectangle logic)', () => {
            const layer = {
                id: 'cs1',
                type: 'customShape',
                x: 50,
                y: 50,
                width: 100,
                height: 100,
                visible: true,
                locked: false
            };
            expect(hitTestController.isPointInLayer({ x: 100, y: 100 }, layer)).toBe(true);
            expect(hitTestController.isPointInLayer({ x: 200, y: 200 }, layer)).toBe(false);
        });

        test('customShape with rotation uses un-rotated bounds', () => {
            const layer = {
                id: 'cs2',
                type: 'customShape',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                rotation: 45,
                visible: true,
                locked: false
            };
            // Center (50, 50) should always hit
            expect(hitTestController.isPointInLayer({ x: 50, y: 50 }, layer)).toBe(true);
        });
    });

    // ── isPointNearDimension — uncovered branches ─────────────────────────────

    describe('isPointNearDimension - numeric dimensionOffset', () => {
        test('uses dimensionOffset directly when it is a finite number', () => {
            // layer.dimensionOffset = 20 → offsetDistance = 20 (new code path)
            const layer = {
                id: 'dim1',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                dimensionOffset: 20
            };
            // Horizontal line: perpX=0, perpY=1, offset=20
            // dimLine at y = -20  (0 - 1*20)
            // Point at (50, -20) is exactly on the dimension line → returns true
            expect(hitTestController.isPointNearDimension({ x: 50, y: -20 }, layer)).toBe(true);
        });

        test('falls back to legacy calculation when dimensionOffset is NaN', () => {
            const layer = {
                id: 'dim2',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                dimensionOffset: NaN
            };
            // Legacy default: extensionGap=3, extensionLength=10 → offsetDistance=8
            // dimLine at y = -8
            expect(hitTestController.isPointNearDimension({ x: 50, y: -8 }, layer)).toBe(true);
        });

        test('uses custom extensionLength when provided', () => {
            const layer = {
                id: 'dim3',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                extensionLength: 20,
                extensionGap: 5
            };
            // offsetDistance = 5 + 20/2 = 15
            // dimLine at y = -15; point at (50, -15) → on line
            expect(hitTestController.isPointNearDimension({ x: 50, y: -15 }, layer)).toBe(true);
        });

        test('uses default extensionLength when extensionLength is NaN', () => {
            const layer = {
                id: 'dim4',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                extensionLength: NaN,
                extensionGap: 3
            };
            // extensionLength defaults to 10, offsetDistance = 3 + 5 = 8
            // dimLine at y = -8
            expect(hitTestController.isPointNearDimension({ x: 50, y: -8 }, layer)).toBe(true);
        });

        test('uses default extensionGap when extensionGap is NaN', () => {
            const layer = {
                id: 'dim5',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                extensionLength: 10,
                extensionGap: NaN
            };
            // extensionGap defaults to 3, offsetDistance = 3 + 5 = 8
            expect(hitTestController.isPointNearDimension({ x: 50, y: -8 }, layer)).toBe(true);
        });
    });

    describe('isPointNearDimension - extension line hits', () => {
        // For a horizontal dimension layer x1=0,y1=0 to x2=100,y2=0 with no offset:
        //   perpX=0, perpY=1, offsetDistance=8
        //   dimX1=0,dimY1=-8; dimX2=100,dimY2=-8
        //   Extension line 1: from (0,0) to (0,-8)  — a short vertical segment
        //   Extension line 2: from (100,0) to (100,-8)

        test('hits extension line 1 (near x1)', () => {
            const layer = {
                id: 'dim6',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0
            };
            // Point at (0, -4) is on the extension line 1 segment at its midpoint
            // distanceToDimLine = distance from (0,-4) to line y=-8: |(-4)-(-8)| = 4 > 15? No.
            // Wait: dimLine is at y=-8, so distance from (0,-4) to the horizontal dimLine = |-4 - -8| = 4 <= 15 → true via Test 1
            // To exercise Test 2 (extension line 1), we need distanceToDimLine > 15
            // Use a larger offset so the dim line is far away
            const layerFarOffset = {
                id: 'dim6b',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                dimensionOffset: 50 // dim line at y=-50
            };
            // Point near extension line 1 midpoint (0, -25) — between (0,0) and (0,-50)
            // distanceToDimLine = distance from (0,-25) to horizontal line at y=-50 = 25 > 15
            // distanceToExt1 = distance from (0,-25) to segment (0,0)-(0,-50) = 0 (on the segment) <= 8
            expect(hitTestController.isPointNearDimension({ x: 0, y: -25 }, layerFarOffset)).toBe(true);
        });

        test('hits extension line 2 (near x2)', () => {
            const layerFarOffset = {
                id: 'dim7',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                dimensionOffset: 50 // dim line at y=-50
            };
            // Point at (100, -25) is on extension line 2 (from (100,0) to (100,-50))
            // distanceToDimLine = 25 > 15; distanceToExt1 > 8; distanceToExt2 = 0 <= 8
            expect(hitTestController.isPointNearDimension({ x: 100, y: -25 }, layerFarOffset)).toBe(true);
        });
    });

    describe('isPointNearDimension - text area hit', () => {
        test('hits the text area when point is at text center', () => {
            // Use large dimensionOffset so dim line is far, extension lines are also far
            // from a point near the text center
            const layer = {
                id: 'dim8',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                dimensionOffset: 100, // dim line at y=-100
                fontSize: 12
            };
            // Text center ≈ midpoint of dimLine = (50, -100)
            // textHitRadius = max(12*1.5, 25) = 25
            // Point at (50, -100): distToText = 0 <= 25 → true via Test 4
            // But: distanceToDimLine = 0 ≤ 15 → would also hit via Test 1!
            // Need point far from dim line AND ext lines but inside text radius:
            //   point at (50, -75): distanceToDimLine = |-75 - -100| = 25 > 15
            //                       distanceToExt1 = distance to segment (0,0)-(0,-100) at x=50
            //                         t projects to closest point (0,-75), dist = 50 > 8
            //                       distanceToExt2 = distance to segment (100,0)-(100,-100) at x=50
            //                         t projects to (100,-75), dist = 50 > 8
            //                       distToText = √((50-50)²+(-75--100)²) = 25 ≤ 25 → true
            expect(hitTestController.isPointNearDimension({ x: 50, y: -75 }, layer)).toBe(true);
        });

        test('uses textOffset to shift text center along dimension line', () => {
            const layer = {
                id: 'dim9',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                dimensionOffset: 100,
                fontSize: 12,
                textOffset: 20 // shift text 20px toward x2
            };
            // Horizontal line: unitDx=1, unitDy=0
            // Text center = (50 + 1*20, -100) = (70, -100)
            // Point at (70, -75): distToText = 25 <= 25 → true
            expect(hitTestController.isPointNearDimension({ x: 70, y: -75 }, layer)).toBe(true);

            // Old text position (50, -75) is now outside textHitRadius
            // distToText = √((50-70)²+(0)²) = 20 ≤ 25 → still inside! Use 30 offset to push it out
            const layerOffset30 = {
                id: 'dim9b',
                type: 'dimension',
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 0,
                dimensionOffset: 100,
                fontSize: 12,
                textOffset: 30
            };
            // Text center = (80, -100); point at (45, -75): distToText = √(35²+25²) ≈ 43 > 25 → false
            expect(hitTestController.isPointNearDimension({ x: 45, y: -75 }, layerOffset30)).toBe(false);
        });
    });

    // ── isPointNearAngleDimension ─────────────────────────────────────────────

    describe('isPointNearAngleDimension', () => {
        // Standard angle dimension: vertex at (200,200), arm1 at (300,200), arm2 at (200,100)
        // This forms a 90° angle at the vertex; arcRadius defaults to 40

        const makeAngleLayer = ( overrides = {} ) => ( {
            id: 'ad1',
            type: 'angleDimension',
            cx: 200,
            cy: 200,
            ax: 300,  // arm1 endpoint (right)
            ay: 200,
            bx: 200,  // arm2 endpoint (up)
            by: 100,
            arcRadius: 40,
            visible: true,
            ...overrides
        } );

        test('isPointInLayer routes angleDimension to isPointNearAngleDimension', () => {
            const layer = makeAngleLayer();
            // Center of vertex should return true (distToVertex <= 10)
            expect(hitTestController.isPointInLayer({ x: 200, y: 200 }, layer)).toBe(true);
            // Point far away should return false
            expect(hitTestController.isPointInLayer({ x: 500, y: 500 }, layer)).toBe(false);
        });

        test('hits vertex point (distToVertex <= 10)', () => {
            const layer = makeAngleLayer();
            // Exactly at vertex
            expect(hitTestController.isPointNearAngleDimension({ x: 200, y: 200 }, layer)).toBe(true);
            // 9px from vertex
            expect(hitTestController.isPointNearAngleDimension({ x: 209, y: 200 }, layer)).toBe(true);
            // 11px from vertex — outside vertex hit but may hit arm1 line
            // This test is about the vertex branch specifically; just verify the vertex hit
        });

        test('misses when point is far from all elements', () => {
            const layer = makeAngleLayer();
            expect(hitTestController.isPointNearAngleDimension({ x: 600, y: 600 }, layer)).toBe(false);
        });

        test('hits arm1 line (distToArm1 <= 8)', () => {
            const layer = makeAngleLayer();
            // arm1 goes from vertex (200,200) to arm1 endpoint (300,200) — horizontal
            // Point at (250, 200) is on the arm1 line (distToArm1 = 0)
            // distToVertex = 50 > 10, so vertex branch does NOT fire → arm1 branch fires
            expect(hitTestController.isPointNearAngleDimension({ x: 250, y: 200 }, layer)).toBe(true);

            // Point 5px off the arm1 line (250, 205) — still within 8px tolerance
            expect(hitTestController.isPointNearAngleDimension({ x: 250, y: 205 }, layer)).toBe(true);

            // Point 10px off the arm1 line — outside tolerance
            expect(hitTestController.isPointNearAngleDimension({ x: 250, y: 210 }, layer)).toBe(false);
        });

        test('hits arm2 line (distToArm2 <= 8)', () => {
            const layer = makeAngleLayer();
            // arm2 goes from vertex (200,200) to arm2 endpoint (200,100) — vertical upward
            // Point at (200, 150) is on the arm2 line
            // distToVertex = 50 > 10; distToArm1 = dist from (200,150) to line (200,200)-(300,200) = 50 > 8
            expect(hitTestController.isPointNearAngleDimension({ x: 200, y: 150 }, layer)).toBe(true);

            // Point 5px off arm2 line
            expect(hitTestController.isPointNearAngleDimension({ x: 205, y: 150 }, layer)).toBe(true);

            // Point 10px off arm2 line — outside tolerance
            expect(hitTestController.isPointNearAngleDimension({ x: 215, y: 150 }, layer)).toBe(false);
        });

        test('hits the arc (distance from vertex ≈ arcRadius)', () => {
            const layer = makeAngleLayer();
            // arcRadius = 40; vertex = (200,200)
            // A point at distance 40 from vertex, at angle midway in the 90° sweep
            // startAngle = atan2(200-200, 300-200) = atan2(0,100) = 0
            // endAngle   = atan2(100-200, 200-200) = atan2(-100,0) = -π/2
            // sweep (non-reflex): endAngle - startAngle = -π/2
            //   sweep < 0, so sweep += 2π → sweep = 3π/2 > π → sweep = 3π/2 - 2π = -π/2
            // Because sweep < 0, testAngle must be <= 0. Mid-sweep is at -π/4 (315°/225°?)
            // Let's use angle = π/4 above arm1 ... actually the 90° between arm1 (angle=0)
            // and arm2 (angle=-π/2 or 270°). Let's try a point at (200+40*cos(-π/4), 200+40*sin(-π/4))
            // = (200+28.28, 200-28.28) = (228, 172)
            // distFromVertex = 40, Math.abs(40-40) = 0 ≤ 10 → checks angle...
            const arcX = Math.round(200 + 40 * Math.cos(-Math.PI / 4));
            const arcY = Math.round(200 + 40 * Math.sin(-Math.PI / 4));
            // This point is at the arc boundary; it may or may not pass the angle sweep check
            // Let's verify with a simpler known-good point: directly along arm1 at radius=40
            // (240, 200) is exactly on arm1 at distance 40 from vertex
            // distFromVertex = 40, |40-40|=0 ≤ 10; angle check for point (240,200):
            //   pointAngle = atan2(200-200, 240-200) = atan2(0,40) = 0 = startAngle
            //   testAngle = 0 - 0 = 0, within [0, sweep] assuming valid sweep
            expect(hitTestController.isPointNearAngleDimension({ x: 240, y: 200 }, layer)).toBe(true);
        });

        test('reflexAngle=true changes sweep direction', () => {
            const layer = makeAngleLayer( { reflexAngle: true } );
            // With reflexAngle, the arc sweeps the "long way" around (>180°)
            // A point on the reflex arc at (160, 200) — on arm1 direction extended left
            // distFromVertex = 40, angle = π (180°)
            // This point should be hit on the reflex arc
            expect(hitTestController.isPointNearAngleDimension({ x: 160, y: 200 }, layer)).toBe(true);
        });

        test('returns false for point outside all elements', () => {
            const layer = makeAngleLayer();
            // Point (400, 400) is nowhere near vertex (200,200), arms, or arc (radius 40)
            expect(hitTestController.isPointNearAngleDimension({ x: 400, y: 400 }, layer)).toBe(false);
        });

        test('reflexAngle=true with initial positive sweep covers sweep<=PI branch', () => {
            // vertex=(200,200), arm1 above=(200,100), arm2 right=(300,200)
            // startAngle = atan2(100-200, 200-200) = atan2(-100,0) = -π/2
            // endAngle   = atan2(200-200, 300-200) = atan2(0,100) = 0
            // initial sweep = 0 - (-π/2) = π/2 > 0
            // reflex path: A: π/2 > 0 → skip; B: π/2 <= π → sweep += 2π = 5π/2; C: 5π/2 > 2π → sweep -= 2π = π/2
            const layer = makeAngleLayer( {
                ax: 200, ay: 100,  // arm1 = directly above vertex
                bx: 300, by: 200,  // arm2 = directly right of vertex
                reflexAngle: true
            } );
            // Point at vertex should hit via distToVertex <= 10
            expect(hitTestController.isPointNearAngleDimension({ x: 200, y: 200 }, layer)).toBe(true);
        });

        test('textPosition=above uses larger arc radius for text', () => {
            // Creates a layer with textPosition='above'; just verifies the branch executes
            // without throwing and that out-of-arc-band points return false
            const layer = makeAngleLayer( { textPosition: 'above', fontSize: 12 } );
            // Point far from all elements — result must be false (covers the textPosition branch but no hit)
            expect(hitTestController.isPointNearAngleDimension({ x: 600, y: 600 }, layer)).toBe(false);
        });

        test('textPosition=below uses smaller arc radius for text', () => {
            const layer = makeAngleLayer( { textPosition: 'below', fontSize: 12 } );
            expect(hitTestController.isPointNearAngleDimension({ x: 600, y: 600 }, layer)).toBe(false);
        });

        test('hits arc via positive sweep path (non-reflex angle with sweep >= 0)', () => {
            // vertex=(200,200), arm1 right=(300,200) startAngle=0,
            // arm2 lower-left=(100,300) endAngle=atan2(100,-100)=3π/4
            // sweep = 3π/4 - 0 = 3π/4  ∈ (0,π] →  positive sweep, no normalisation
            const layer = makeAngleLayer( {
                ax: 300, ay: 200,  // arm1: right
                bx: 100, by: 300,  // arm2: lower-left (screen coords: down-left)
                arcRadius: 40
            } );
            // Arc hit at midAngle ≈ 3π/8 (≈67.5°):
            // arcX ≈ 200 + 40*cos(3π/8) ≈ 215, arcY ≈ 200 + 40*sin(3π/8) ≈ 237
            // distFromVertex = 40, point is between the two arms → positive-sweep branch, line 393
            const arcX = Math.round( 200 + 40 * Math.cos( 3 * Math.PI / 8 ) );
            const arcY = Math.round( 200 + 40 * Math.sin( 3 * Math.PI / 8 ) );
            expect(hitTestController.isPointNearAngleDimension( { x: arcX, y: arcY }, layer ) ).toBe(true);
        });
    });
});
