/**
 * Test filename inference logic from various DOM structures
 */

// Include the setup to initialize mocks
require('./setup.js');

describe('Filename Inference', function() {
    var mockMwLayers;

    beforeEach(function() {
        // Mock mw.layers with the essential methods
        mockMwLayers = {
            escRe: function(s) {
                return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }
        };
        
        // Create a container for our test DOM elements
        document.body.innerHTML = '';
    });

    function createTestImage(anchorAttrs, imgAttrs) {
        var container = document.createElement('div');
        var anchor = document.createElement('a');
        var img = document.createElement('img');
        
        // Set anchor attributes
        if (anchorAttrs) {
            Object.keys(anchorAttrs).forEach(function(key) {
                anchor.setAttribute(key, anchorAttrs[key]);
            });
        }
        
        // Set image attributes
        if (imgAttrs) {
            Object.keys(imgAttrs).forEach(function(key) {
                img.setAttribute(key, imgAttrs[key]);
            });
        }
        
        anchor.appendChild(img);
        container.appendChild(anchor);
        document.body.appendChild(container);
        
        return img;
    }

    function inferFilename(imgEl, fileNamespace) {
        var filename = null;
        var a = imgEl.closest('a');
        if (a && a.getAttribute('href')) {
            var href = a.getAttribute('href');
            try {
                var decodedHref = href;
                // Prefer query param title=<FileNs>:
                var reTitle = new RegExp('[?&]title=' + mockMwLayers.escRe(fileNamespace) + ':([^&#]+)', 'i');
                var mTitle = decodedHref.match(reTitle);
                if (mTitle && mTitle[1]) {
                    filename = decodeURIComponent(mTitle[1]).replace(/_/g, ' ');
                } else {
                    // Path-style /wiki/<FileNs>:... or /index.php/<FileNs>:... or /<FileNs>:...
                    var rePath = new RegExp('\\/(?:wiki\\/|index\\.php\\/)?' + mockMwLayers.escRe(fileNamespace) + ':([^?#]+)', 'i');
                    var mPath = decodedHref.match(rePath);
                    if (mPath && mPath[1]) {
                        filename = decodeURIComponent(mPath[1]).replace(/_/g, ' ');
                    }
                }
            } catch (e) { /* ignore */ }
        }

        // Some skins put the title in the anchor title attribute
        if (!filename && a && a.getAttribute('title')) {
            var aTitle = a.getAttribute('title');
            try {
                var rePrefix = new RegExp('^' + mockMwLayers.escRe(fileNamespace) + ':', 'i');
                if (rePrefix.test(aTitle)) {
                    filename = aTitle.replace(rePrefix, '').replace(/_/g, ' ');
                }
            } catch (eT) { /* ignore */ }
        }

        // Try common data attributes on the image or its parent containers
        if (!filename) {
            var dataFile = imgEl.getAttribute('data-file') || (a && a.getAttribute('data-file'));
            if (dataFile) {
                filename = String(dataFile).replace(/_/g, ' ');
            }
        }
        if (!filename) {
            var dataImageName = imgEl.getAttribute('data-image-name') || (a && a.getAttribute('data-image-name'));
            if (dataImageName) {
                filename = String(dataImageName).replace(/_/g, ' ');
            }
        }

        // Parse from image src path (thumbnail/original)
        if (!filename) {
            var src = imgEl.getAttribute('src') || '';
            try {
                var rx = /\/(?:w\/)?images\/(?:thumb\/[^\/]+\/[^\/]+\/)?([A-Za-z0-9][A-Za-z0-9%_. -]*\.(?:png|jpe?g|gif|svg|webp|tiff?))(?:[/?#]|$)/i;
                var mSrc = src.match(rx);
                if (mSrc && mSrc[1]) {
                    filename = decodeURIComponent(mSrc[1]).replace(/_/g, ' ');
                }
            } catch (eS) { /* ignore */ }
        }

        return filename;
    }

    describe('href query parameter inference', function() {
        it('should extract filename from title parameter', function() {
            var img = createTestImage({
                href: '/w/index.php?title=File:Example.jpg&action=view'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should extract filename from title parameter with spaces', function() {
            var img = createTestImage({
                href: '/w/index.php?title=File:My%20Example%20Image.png'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('My Example Image.png');
        });

        it('should extract filename from title parameter with underscores', function() {
            var img = createTestImage({
                href: '/w/index.php?title=File:My_Example_Image.png'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('My Example Image.png');
        });

        it('should handle localized File namespace', function() {
            var img = createTestImage({
                href: '/w/index.php?title=Datei:Beispiel.jpg'
            });
            
            var filename = inferFilename(img, 'Datei');
            expect(filename).toBe('Beispiel.jpg');
        });
    });

    describe('href path inference', function() {
        it('should extract filename from wiki path', function() {
            var img = createTestImage({
                href: '/wiki/File:Example.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should extract filename from index.php path', function() {
            var img = createTestImage({
                href: '/index.php/File:Example.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should extract filename from direct path', function() {
            var img = createTestImage({
                href: '/File:Example.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should handle URL encoding in paths', function() {
            var img = createTestImage({
                href: '/wiki/File:My%20Example%20Image.png'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('My Example Image.png');
        });
    });

    describe('anchor title inference', function() {
        it('should extract filename from anchor title attribute', function() {
            var img = createTestImage({
                href: '/some/other/path',
                title: 'File:Example.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should handle underscores in anchor title', function() {
            var img = createTestImage({
                href: '/some/other/path',
                title: 'File:My_Example_Image.png'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('My Example Image.png');
        });
    });

    describe('data attribute inference', function() {
        it('should extract filename from data-file attribute on image', function() {
            var img = createTestImage({
                href: '/some/path'
            }, {
                'data-file': 'Example.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should extract filename from data-file attribute on anchor', function() {
            var img = createTestImage({
                href: '/some/path',
                'data-file': 'Example.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should extract filename from data-image-name attribute', function() {
            var img = createTestImage({
                href: '/some/path'
            }, {
                'data-image-name': 'My_Example_Image.png'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('My Example Image.png');
        });
    });

    describe('src attribute inference', function() {
        it('should extract filename from image src with thumbnail path', function() {
            var img = createTestImage({
                href: '/some/path'
            }, {
                src: '/w/images/thumb/a/ab/Example.jpg/300px-Example.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should extract filename from direct image src', function() {
            var img = createTestImage({
                href: '/some/path'
            }, {
                src: '/w/images/Example.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });

        it('should handle various image formats', function() {
            var formats = ['png', 'jpeg', 'jpg', 'gif', 'svg', 'webp', 'tiff'];
            
            formats.forEach(function(format) {
                var img = createTestImage({
                    href: '/some/path'
                }, {
                    src: '/w/images/Example.' + format
                });
                
                var filename = inferFilename(img, 'File');
                expect(filename).toBe('Example.' + format);
            });
        });

        it('should handle URL encoded filenames in src', function() {
            var img = createTestImage({
                href: '/some/path'
            }, {
                src: '/w/images/My%20Example%20Image.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('My Example Image.jpg');
        });
    });

    describe('inference priority', function() {
        it('should prefer title parameter over path', function() {
            var img = createTestImage({
                href: '/wiki/File:WrongFile.jpg?title=File:CorrectFile.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('CorrectFile.jpg');
        });

        it('should prefer path over anchor title', function() {
            var img = createTestImage({
                href: '/wiki/File:CorrectFile.jpg',
                title: 'File:WrongFile.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('CorrectFile.jpg');
        });

        it('should prefer anchor title over data attributes', function() {
            var img = createTestImage({
                href: '/some/path',
                title: 'File:CorrectFile.jpg',
                'data-file': 'WrongFile.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('CorrectFile.jpg');
        });

        it('should prefer data attributes over src parsing', function() {
            var img = createTestImage({
                href: '/some/path',
                'data-file': 'CorrectFile.jpg'
            }, {
                src: '/w/images/WrongFile.jpg'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('CorrectFile.jpg');
        });
    });

    describe('edge cases', function() {
        it('should return null for image with no usable attributes', function() {
            var img = createTestImage({
                href: '/some/random/path'
            }, {
                src: '/static/nonfile.png'  // This won't match the file pattern
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBeNull();
        });

        it('should handle malformed URLs gracefully', function() {
            var img = createTestImage({
                href: 'not-a-url'
            });
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBeNull();
        });

        it('should handle missing anchor element', function() {
            var img = document.createElement('img');
            img.setAttribute('src', '/w/images/Example.jpg');
            document.body.appendChild(img);
            
            var filename = inferFilename(img, 'File');
            expect(filename).toBe('Example.jpg');
        });
    });
});
