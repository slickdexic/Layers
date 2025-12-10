/**
 * Test layers parameter detection and fallback logic
 */

// Include the setup to initialize mocks
require('./setup.js');

describe('Layers Parameter Detection', function() {
    let mockMwLayers;

    function createElementWithDataMw(dataMwContent) {
        const div = document.createElement('div');
        div.setAttribute('data-mw', JSON.stringify(dataMwContent));
        document.body.appendChild(div);
        return div;
    }

    beforeEach(function() {
        // Mock mw.layers with the essential methods
        mockMwLayers = {
            isAllowedLayersValue: function(v) {
                if (!v) return false;
                const val = String(v)
                    .replace(/^\s+|\s+$/g, '')
                    .replace(/^['"]|['"]$/g, '')
                    .toLowerCase();
                if (
                    val === 'on' ||
                    val === 'all' ||
                    val === 'true' ||
                    val === '1' ||
                    val === 'yes'
                ) {
                    return true;
                }
                if (/^id:\d+$/.test(val)) {
                    return true;
                }
                if (/^name:.+/.test(val)) {
                    return true;
                }
                if (/^(?:[0-9a-f]{2,8})(?:\s*,\s*[0-9a-f]{2,8})*$/i.test(val)) {
                    return true;
                }
                return false;
            },

            decodeHtmlEntities: function(s) {
                if (!s || typeof s !== 'string') {
                    return s;
                }
                let out = s.replace(/&amp;/g, '&');
                out = out.replace(/&amp;quot;/g, '"');
                out = out.replace(/&quot;/g, '"');
                out = out.replace(/&#34;/g, '"');
                out = out.replace(/&#x22;/gi, '"');
                return out;
            },

            detectLayersFromDataMw: function(el) {
                const searchValue = function(dmwRoot) {
                    let foundLocal = null;

                    const visit = function(v) {
                        if (foundLocal !== null || v === null) {
                            return;
                        }
                        const t = Object.prototype.toString.call(v);
                        if (t === '[object String]') {
                            const str = String(v);
                            const m2 = str.match(/(^|\b)layers\s*=\s*(.+)$/i);
                            if (m2) {
                                foundLocal = m2[2].trim().toLowerCase();
                            }
                            return;
                        }
                        if (t === '[object Array]') {
                            for (let j = 0; j < v.length; j++) {
                                visit(v[j]);
                                if (foundLocal !== null) {
                                    break;
                                }
                            }
                            return;
                        }
                        if (t === '[object Object]') {
                            if (typeof v.layers === 'string' && v.layers) {
                                foundLocal = v.layers.toLowerCase();
                                return;
                            }
                            if (typeof v.layer === 'string' && v.layer) {
                                foundLocal = v.layer.toLowerCase();
                                return;
                            }
                            for (const k in v) {
                                if (Object.prototype.hasOwnProperty.call(v, k)) {
                                    visit(v[k]);
                                    if (foundLocal !== null) {
                                        break;
                                    }
                                }
                            }
                        }
                    };

                    visit(dmwRoot);
                    return foundLocal;
                };

                try {
                    let node = el;
                    while (node && node.nodeType === 1) {
                        let raw = null;
                        if (node.getAttribute) {
                            raw = node.getAttribute('data-mw');
                        }
                        if (raw) {
                            try {
                                const decoded = this.decodeHtmlEntities(raw);
                                const dmw = JSON.parse(decoded);
                                if (dmw && typeof dmw === 'object') {
                                    const found = searchValue(dmw);
                                    if (found) {
                                        return found;
                                    }
                                }
                            } catch (e2) {
                                try {
                                    const rm = String(raw).match(/layers\s*=\s*([a-zA-Z0-9:,]+)/i);
                                    if (rm && rm[1]) {
                                        return rm[1].trim().toLowerCase();
                                    }
                                } catch (e2b) { /* ignore */ }
                            }
                        }
                        node = node.parentNode;
                    }
                } catch (e) {
                    // ignore
                }
                return null;
            }
        };
        
        // Clear DOM
        document.body.innerHTML = '';
    });

    describe('isAllowedLayersValue', function() {
        it('should accept standard positive values', function() {
            const positiveValues = ['on', 'all', 'true', '1', 'yes', 'ON', 'ALL', 'True'];
            positiveValues.forEach(function(val) {
                expect(mockMwLayers.isAllowedLayersValue(val)).toBe(true);
            });
        });

        it('should accept id: format', function() {
            expect(mockMwLayers.isAllowedLayersValue('id:123')).toBe(true);
            expect(mockMwLayers.isAllowedLayersValue('id:0')).toBe(true);
            expect(mockMwLayers.isAllowedLayersValue('ID:456')).toBe(true);
        });

        it('should accept name: format', function() {
            expect(mockMwLayers.isAllowedLayersValue('name:overlay1')).toBe(true);
            expect(mockMwLayers.isAllowedLayersValue('name:test layer')).toBe(true);
            expect(mockMwLayers.isAllowedLayersValue('NAME:something')).toBe(true);
        });

        it('should accept hex ID CSV format', function() {
            expect(mockMwLayers.isAllowedLayersValue('4bfa')).toBe(true);
            expect(mockMwLayers.isAllowedLayersValue('4bfa,77e5')).toBe(true);
            expect(mockMwLayers.isAllowedLayersValue('4bfa, 77e5, 0cf2')).toBe(true);
            expect(mockMwLayers.isAllowedLayersValue('ABCD1234')).toBe(true);
        });

        it('should reject negative or invalid values', function() {
            const negativeValues = ['off', 'none', 'false', '0', 'no', '', null, undefined];
            negativeValues.forEach(function(val) {
                expect(mockMwLayers.isAllowedLayersValue(val)).toBe(false);
            });
        });

        it('should reject malformed formats', function() {
            expect(mockMwLayers.isAllowedLayersValue('id:')).toBe(false); // no number
            expect(mockMwLayers.isAllowedLayersValue('id:abc')).toBe(false); // not a number
            expect(mockMwLayers.isAllowedLayersValue('name:')).toBe(false); // empty name
            expect(mockMwLayers.isAllowedLayersValue('xyz')).toBe(false); // invalid hex
            expect(mockMwLayers.isAllowedLayersValue('4bf,xyz')).toBe(false); // mixed valid/invalid hex
        });
    });

    describe('detectLayersFromDataMw', function() {
        it('should detect layers from object property', function() {
            const el = createElementWithDataMw({
                attrs: {
                    options: {
                        layers: 'all'
                    }
                }
            });
            
            expect(mockMwLayers.detectLayersFromDataMw(el)).toBe('all');
        });

        it('should detect layer (singular) from object property', function() {
            const el = createElementWithDataMw({
                attrs: {
                    options: {
                        layer: 'on'
                    }
                }
            });
            
            expect(mockMwLayers.detectLayersFromDataMw(el)).toBe('on');
        });

        it('should detect layers from array string', function() {
            const el = createElementWithDataMw({
                attrs: {
                    originalArgs: ['thumb', 'x500px', 'layers=all', 'caption text']
                }
            });
            
            expect(mockMwLayers.detectLayersFromDataMw(el)).toBe('all');
        });

        it('should detect layers with various formats in arrays', function() {
            const testCases = [
                { args: ['layers=id:123'], expected: 'id:123' },
                { args: ['layers=name:overlay'], expected: 'name:overlay' },
                { args: ['layers=4bfa,77e5'], expected: '4bfa,77e5' }
            ];
            
            testCases.forEach(function(testCase) {
                const el = createElementWithDataMw({
                    attrs: {
                        originalArgs: testCase.args
                    }
                });
                
                expect(mockMwLayers.detectLayersFromDataMw(el)).toBe(testCase.expected);
            });
        });

        it('should handle HTML entities in data-mw', function() {
            const div = document.createElement('div');
            // Simulate HTML-encoded JSON
            div.setAttribute('data-mw', '{"attrs":{"options":{"layers":"all"}}}');
            document.body.appendChild(div);
            
            expect(mockMwLayers.detectLayersFromDataMw(div)).toBe('all');
        });

        it('should traverse up the DOM tree', function() {
            const parent = createElementWithDataMw({
                attrs: {
                    options: {
                        layers: 'all'
                    }
                }
            });
            
            const child = document.createElement('img');
            parent.appendChild(child);
            
            expect(mockMwLayers.detectLayersFromDataMw(child)).toBe('all');
        });

        it('should fall back to regex if JSON parsing fails', function() {
            const div = document.createElement('div');
            // Malformed JSON but contains the pattern
            div.setAttribute('data-mw', 'malformed{layers=on}json');
            document.body.appendChild(div);
            
            expect(mockMwLayers.detectLayersFromDataMw(div)).toBe('on');
        });

        it('should return null if no layers parameter found', function() {
            const el = createElementWithDataMw({
                attrs: {
                    options: {
                        thumb: true,
                        width: '300px'
                    }
                }
            });
            
            expect(mockMwLayers.detectLayersFromDataMw(el)).toBe(null);
        });

        it('should handle deeply nested structures', function() {
            const el = createElementWithDataMw({
                body: {
                    attrs: {
                        nested: {
                            deep: {
                                layers: 'id:456'
                            }
                        }
                    }
                }
            });
            
            expect(mockMwLayers.detectLayersFromDataMw(el)).toBe('id:456');
        });
    });

    describe('HTML entity decoding', function() {
        it('should decode common HTML entities', function() {
            expect(mockMwLayers.decodeHtmlEntities('&amp;')).toBe('&');
            expect(mockMwLayers.decodeHtmlEntities('&quot;')).toBe('"');
            expect(mockMwLayers.decodeHtmlEntities('&#34;')).toBe('"');
            expect(mockMwLayers.decodeHtmlEntities('&#x22;')).toBe('"');
        });

        it('should handle multiple entities', function() {
            expect(mockMwLayers.decodeHtmlEntities('&quot;test&quot;')).toBe('"test"');
            expect(mockMwLayers.decodeHtmlEntities('&amp;amp;')).toBe('&amp;');
        });

        it('should pass through non-string values unchanged', function() {
            expect(mockMwLayers.decodeHtmlEntities(null)).toBe(null);
            expect(mockMwLayers.decodeHtmlEntities(undefined)).toBe(undefined);
            expect(mockMwLayers.decodeHtmlEntities(123)).toBe(123);
        });
    });

    describe('integration scenarios', function() {
        it('should handle typical MediaWiki image with layers parameter', function() {
            const parent = document.createElement('figure');
            parent.setAttribute('data-mw', JSON.stringify({
                attrs: {
                    originalArgs: ['thumb', '300px', 'layers=all', 'Example caption']
                }
            }));
            
            const img = document.createElement('img');
            img.setAttribute('src', '/w/images/thumb/Example.jpg/300px-Example.jpg');
            img.setAttribute('class', 'thumbimage');
            
            parent.appendChild(img);
            document.body.appendChild(parent);
            
            const detected = mockMwLayers.detectLayersFromDataMw(img);
            expect(detected).toBe('all');
            expect(mockMwLayers.isAllowedLayersValue(detected)).toBe(true);
        });

        it('should handle gallery context with specific layer set', function() {
            const galleryItem = document.createElement('li');
            galleryItem.setAttribute('data-mw', JSON.stringify({
                attrs: {
                    options: {
                        layers: 'name:annotations'
                    }
                }
            }));
            
            const img = document.createElement('img');
            img.setAttribute('class', 'gallery-image');
            
            galleryItem.appendChild(img);
            document.body.appendChild(galleryItem);
            
            const detected = mockMwLayers.detectLayersFromDataMw(img);
            expect(detected).toBe('name:annotations');
            expect(mockMwLayers.isAllowedLayersValue(detected)).toBe(true);
        });

        it('should prioritize first found layers parameter', function() {
            const el = createElementWithDataMw({
                attrs: {
                    originalArgs: ['layers=all', 'other=value', 'layers=specific'],
                    options: {
                        layers: 'fallback'
                    }
                }
            });
            
            // Should find the first 'layers=all' in the array
            expect(mockMwLayers.detectLayersFromDataMw(el)).toBe('all');
        });
    });
});
