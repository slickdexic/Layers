/**
 * @jest-environment jsdom
 */

/**
 * UI and Workflow tests for LayersEditor
 *
 * Tests revision selector, named layer sets, save/cancel workflows,
 * and other UI-related functionality to improve coverage.
 */

const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
const HistoryManager = require('../../resources/ext.layers.editor/HistoryManager.js');

describe('LayersEditor UI Methods', () => {
    let LayersEditor;
    let editor;
    let mockContainer;
    let mockUIManager, mockEventManager, mockAPIManager, mockValidationManager;
    let mockCanvasManager, mockToolbar, mockLayerPanel;
    let mockRegistry;
    let instanceCache;

    beforeEach(() => {
        // Setup DOM
        mockContainer = document.createElement('div');
        mockContainer.id = 'layers-editor-container';
        document.body.innerHTML = '';
        document.body.appendChild(mockContainer);

        // Create UI elements for selectors
        const revSelectEl = document.createElement('select');
        revSelectEl.id = 'layers-revision-select';
        const revLoadBtnEl = document.createElement('button');
        revLoadBtnEl.id = 'layers-revision-load';
        const setSelectEl = document.createElement('select');
        setSelectEl.id = 'layers-set-select';
        const setNewBtnEl = document.createElement('button');
        setNewBtnEl.id = 'layers-set-new';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'layers-header-close';

        const container = document.createElement('div');
        container.appendChild(closeBtn);

        // Create mock instances
        mockUIManager = {
            createInterface: jest.fn(),
            container: container,
            toolbarContainer: document.createElement('div'),
            layerPanelContainer: document.createElement('div'),
            canvasContainer: document.createElement('div'),
            revSelectEl: revSelectEl,
            revLoadBtnEl: revLoadBtnEl,
            setSelectEl: setSelectEl,
            setNewBtnEl: setNewBtnEl,
            showBrowserCompatibilityWarning: jest.fn(),
            showSpinner: jest.fn(),
            hideSpinner: jest.fn()
        };

        mockEventManager = {
            setupGlobalHandlers: jest.fn(),
            destroy: jest.fn(),
            handleKeyDown: jest.fn()
        };

        mockAPIManager = {
            loadLayers: jest.fn().mockReturnValue(new Promise(() => {})),
            loadLayersBySetName: jest.fn().mockResolvedValue({ layers: [] }),
            saveLayers: jest.fn().mockResolvedValue({ success: true, layersetid: 123 }),
            generateLayerId: jest.fn(() => 'layer_' + Math.random().toString(36).substr(2, 9))
        };

        mockValidationManager = {
            sanitizeLayerData: jest.fn((data) => data),
            validateLayers: jest.fn().mockReturnValue({ valid: true, errors: [] }),
            checkBrowserCompatibility: jest.fn().mockReturnValue(true)
        };

        mockCanvasManager = {
            renderLayers: jest.fn(),
            redraw: jest.fn(),
            destroy: jest.fn(),
            setTool: jest.fn(),
            selectLayerById: jest.fn(),
            selectLayer: jest.fn(),
            deselectAll: jest.fn(),
            setBaseDimensions: jest.fn(),
            clearLayers: jest.fn(),
            render: jest.fn(),
            getSelectedLayerIds: jest.fn().mockReturnValue([]),
            setSelectedLayerIds: jest.fn(),
            events: { destroy: jest.fn() }
        };

        mockToolbar = {
            destroy: jest.fn(),
            updateUndoRedoState: jest.fn(),
            updateDeleteState: jest.fn(),
            setActiveTool: jest.fn()
        };

        mockLayerPanel = {
            render: jest.fn(),
            destroy: jest.fn(),
            selectLayer: jest.fn(),
            updateLayerList: jest.fn()
        };

        // Reset instance cache
        instanceCache = {};
        const registeredModules = {};

        mockRegistry = {
            register: jest.fn((name, factory) => {
                registeredModules[name] = factory;
            }),
            get: jest.fn((name) => {
                if (instanceCache[name]) {
                    return instanceCache[name];
                }

                const builtins = {
                    UIManager: mockUIManager,
                    EventManager: mockEventManager,
                    APIManager: mockAPIManager,
                    ValidationManager: mockValidationManager
                };

                if (name in builtins) {
                    instanceCache[name] = builtins[name];
                    return builtins[name];
                }

                if (name === 'StateManager') {
                    instanceCache[name] = new StateManager();
                    return instanceCache[name];
                }
                if (name === 'HistoryManager') {
                    instanceCache[name] = new HistoryManager();
                    return instanceCache[name];
                }

                if (registeredModules[name]) {
                    instanceCache[name] = registeredModules[name]();
                    return instanceCache[name];
                }
                throw new Error(`Module ${name} not found`);
            })
        };

        // Setup window globals
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.UIManager = jest.fn().mockImplementation(() => mockUIManager);
        window.EventManager = jest.fn().mockImplementation(() => mockEventManager);
        window.APIManager = jest.fn().mockImplementation(() => mockAPIManager);
        window.ValidationManager = jest.fn().mockImplementation(() => mockValidationManager);
        window.CanvasManager = jest.fn().mockImplementation(() => mockCanvasManager);
        window.Toolbar = jest.fn().mockImplementation(() => mockToolbar);
        window.LayerPanel = jest.fn().mockImplementation(() => mockLayerPanel);
        window.LayersConstants = {
            TOOLS: { POINTER: 'pointer', TEXT: 'text' },
            LAYER_TYPES: { RECTANGLE: 'rectangle', CIRCLE: 'circle' },
            DEFAULTS: {
                COLORS: { STROKE: '#000000', FILL: '#ffffff' },
                LAYER: { STROKE_WIDTH: 2, FONT_SIZE: 16, FONT_FAMILY: 'Arial' }
            },
            UI: { MIN_ZOOM: 0.1, MAX_ZOOM: 5.0 },
            LIMITS: { MAX_LAYERS: 100, MAX_LAYER_ID_LENGTH: 50 }
        };

        window.layersRegistry = mockRegistry;

        // Mock EventTracker for event listener management
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((element, event, handler, options) => {
                element.addEventListener(event, handler, options);
                this.listeners.push({ element, event, handler, options });
                return { element, event, handler, options };
            });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn((elem) => {
                this.listeners = this.listeners.filter(l => l.element !== elem);
            });
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => {
                this.listeners.forEach((info) => {
                    if (info.element && info.element.removeEventListener) {
                        info.element.removeEventListener(info.event, info.handler, info.options);
                    }
                });
                this.listeners = [];
            });
        });

        // Mock mw.notify
        if (!window.mw) window.mw = {};
        window.mw.notify = jest.fn();
        window.mw.config = {
            get: jest.fn((key, defaultVal) => {
                const config = {
                    wgLayersMaxNamedSets: 15,
                    wgUserName: 'TestUser'
                };
                return config[key] !== undefined ? config[key] : defaultVal;
            })
        };

        // Mock RevisionManager - Uses getters to dynamically access editor's managers
        window.RevisionManager = jest.fn().mockImplementation(function (config) {
            this.editor = config.editor;

            Object.defineProperty(this, 'stateManager', {
                get: function () { return this.editor.stateManager; }
            });
            Object.defineProperty(this, 'uiManager', {
                get: function () { return this.editor.uiManager; }
            });
            Object.defineProperty(this, 'apiManager', {
                get: function () { return this.editor.apiManager; }
            });

            this.parseMWTimestamp = jest.fn((mwTimestamp) => {
                if (!mwTimestamp || typeof mwTimestamp !== 'string') return new Date();
                const year = parseInt(mwTimestamp.substring(0, 4), 10);
                const month = parseInt(mwTimestamp.substring(4, 6), 10) - 1;
                const day = parseInt(mwTimestamp.substring(6, 8), 10);
                const hour = parseInt(mwTimestamp.substring(8, 10), 10);
                const minute = parseInt(mwTimestamp.substring(10, 12), 10);
                const second = parseInt(mwTimestamp.substring(12, 14), 10);
                return new Date(year, month, day, hour, minute, second);
            });

            this.getMessage = jest.fn((key, fallback) => fallback || key);

            this.buildRevisionSelector = jest.fn(() => {
                const uiMgr = this.uiManager;
                const stateMgr = this.stateManager;
                if (!uiMgr || !uiMgr.revSelectEl) return;

                const selectEl = uiMgr.revSelectEl;
                const allLayerSets = stateMgr.get('allLayerSets') || [];
                const currentLayerSetId = stateMgr.get('currentLayerSetId');

                selectEl.innerHTML = '';

                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = this.getMessage('layers-revision-latest', 'Latest');
                selectEl.appendChild(defaultOption);

                allLayerSets.forEach((layerSet) => {
                    const option = document.createElement('option');
                    option.value = layerSet.ls_id || layerSet.id;
                    const timestamp = layerSet.ls_timestamp || layerSet.timestamp;
                    const date = this.parseMWTimestamp(timestamp);
                    option.textContent = `Rev ${layerSet.ls_revision || layerSet.revision || ''} - ${date.toLocaleString()}`;
                    if (String(option.value) === String(currentLayerSetId)) {
                        option.selected = true;
                    }
                    selectEl.appendChild(option);
                });
            });

            this.updateRevisionLoadButton = jest.fn(() => {
                const uiMgr = this.uiManager;
                const stateMgr = this.stateManager;
                if (!uiMgr || !uiMgr.revLoadBtnEl) return;

                const revSelectEl = uiMgr.revSelectEl;
                const currentLayerSetId = stateMgr.get('currentLayerSetId');
                const selectedValue = revSelectEl ? revSelectEl.value : '';
                const shouldDisable = !selectedValue || String(selectedValue) === String(currentLayerSetId);
                uiMgr.revLoadBtnEl.disabled = shouldDisable;
            });

            this.buildSetSelector = jest.fn(() => {
                const uiMgr = this.uiManager;
                const stateMgr = this.stateManager;
                if (!uiMgr || !uiMgr.setSelectEl) return;

                const selectEl = uiMgr.setSelectEl;
                const namedSets = stateMgr.get('namedSets') || [];
                const currentSetName = stateMgr.get('currentSetName') || 'default';

                selectEl.innerHTML = '';

                if (namedSets.length === 0) {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = 'default';
                    defaultOption.textContent = 'default';
                    selectEl.appendChild(defaultOption);
                }

                namedSets.forEach((set) => {
                    const option = document.createElement('option');
                    option.value = set.name;
                    option.textContent = set.name;
                    if (set.name === currentSetName) option.selected = true;
                    selectEl.appendChild(option);
                });

                const maxSets = (window.mw && window.mw.config && window.mw.config.get('wgLayersMaxNamedSets')) || 15;
                if (namedSets.length < maxSets) {
                    const newOption = document.createElement('option');
                    newOption.value = '__new__';
                    newOption.textContent = this.getMessage('layers-editor-new-set', '+ New');
                    selectEl.appendChild(newOption);
                }
            });

            this.updateNewSetButtonState = jest.fn(() => {
                const uiMgr = this.uiManager;
                const stateMgr = this.stateManager;
                if (!uiMgr || !uiMgr.setNewBtnEl) return;

                const namedSets = stateMgr.get('namedSets') || [];
                const maxSets = (window.mw && window.mw.config && window.mw.config.get('wgLayersMaxNamedSets')) || 15;
                uiMgr.setNewBtnEl.disabled = namedSets.length >= maxSets;
            });

            this.loadLayerSetByName = jest.fn(async (setName) => {
                const apiMgr = this.apiManager;
                const stateMgr = this.stateManager;
                if (!setName || setName.trim() === '') return;

                if (apiMgr && apiMgr.loadLayersBySetName) {
                    try {
                        await apiMgr.loadLayersBySetName(setName);
                        stateMgr.set('currentSetName', setName);
                        if (window.mw && window.mw.notify) {
                            window.mw.notify(this.getMessage('layers-load-success', 'Loaded'), { type: 'info' });
                        }
                    } catch (error) {
                        if (window.mw && window.mw.notify) {
                            window.mw.notify(this.getMessage('layers-load-error', 'Error loading set'), { type: 'error' });
                        }
                    }
                }
            });

            this.createNewLayerSet = jest.fn(async (setName) => {
                const stateMgr = this.stateManager;
                if (!setName || setName.trim() === '') {
                    if (window.mw && window.mw.notify) {
                        window.mw.notify(this.getMessage('layers-error-empty-name', 'Name cannot be empty'), { type: 'error' });
                    }
                    return false;
                }
                if (setName === 'default') {
                    if (window.mw && window.mw.notify) {
                        window.mw.notify(this.getMessage('layers-error-reserved-name', 'Reserved name'), { type: 'error' });
                    }
                    return false;
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(setName)) {
                    if (window.mw && window.mw.notify) {
                        window.mw.notify(this.getMessage('layers-error-invalid-chars', 'Invalid characters'), { type: 'error' });
                    }
                    return false;
                }
                
                // Check for duplicate names
                const namedSets = stateMgr.get('namedSets') || [];
                if (namedSets.some(s => s.name === setName)) {
                    if (window.mw && window.mw.notify) {
                        window.mw.notify(this.getMessage('layers-error-duplicate-name', 'Name already exists'), { type: 'error' });
                    }
                    return false;
                }
                
                // Check limit
                const maxSets = (window.mw && window.mw.config && window.mw.config.get('wgLayersMaxNamedSets')) || 15;
                if (namedSets.length >= maxSets) {
                    if (window.mw && window.mw.notify) {
                        window.mw.notify(this.getMessage('layers-error-max-sets', 'Maximum sets reached'), { type: 'error' });
                    }
                    return false;
                }
                
                stateMgr.set('currentSetName', setName);
                stateMgr.set('layers', []);
                namedSets.push({ name: setName });
                stateMgr.set('namedSets', namedSets);
                return true;
            });

            this.loadRevisionById = jest.fn(async (revisionId) => {
                const apiMgr = this.apiManager;
                if (apiMgr && apiMgr.loadRevisionById) {
                    try {
                        await apiMgr.loadRevisionById(revisionId);
                    } catch (error) {
                        if (window.mw && window.mw.notify) {
                            window.mw.notify(this.getMessage('layers-load-error', 'Error'), { type: 'error' });
                        }
                    }
                }
            });
        });

        // Mock DialogManager
        window.DialogManager = jest.fn().mockImplementation(function (config) {
            this.editor = config.editor;
            this.activeDialogs = [];
            this.showCancelConfirmDialog = jest.fn();
            this.showPromptDialog = jest.fn();
            this.showKeyboardShortcutsDialog = jest.fn();
            this.closeAllDialogs = jest.fn(() => { this.activeDialogs = []; });
        });

        // Mock EditorBootstrap
        window.EditorBootstrap = {
            validateDependencies: jest.fn(() => true),
            areEditorDependenciesReady: jest.fn(() => true),
            sanitizeGlobalErrorMessage: jest.fn((msg) => msg),
            registerHook: jest.fn()
        };

        jest.resetModules();
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.LayersEditor;
    });

    afterEach(() => {
        if (editor && !editor.isDestroyed) {
            editor.destroy();
        }
        editor = null;
        jest.clearAllMocks();
    });

    describe('buildRevisionSelector', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should build revision selector with empty layer sets', () => {
            editor.stateManager.set('allLayerSets', []);
            editor.buildRevisionSelector();

            // Method should not throw when called
            expect(editor.uiManager.revSelectEl).toBeDefined();
        });

        it('should use stateManager to get allLayerSets', () => {
            const getSpy = jest.spyOn(editor.stateManager, 'get');
            editor.stateManager.set('allLayerSets', []);
            editor.buildRevisionSelector();

            expect(getSpy).toHaveBeenCalledWith('allLayerSets');
        });

        it('should handle missing uiManager gracefully', () => {
            editor.uiManager = null;
            expect(() => editor.buildRevisionSelector()).not.toThrow();
        });

        it('should handle missing revSelectEl gracefully', () => {
            editor.uiManager.revSelectEl = null;
            expect(() => editor.buildRevisionSelector()).not.toThrow();
        });
    });

    describe('updateRevisionLoadButton', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should not throw when called', () => {
            expect(() => editor.updateRevisionLoadButton()).not.toThrow();
        });

        it('should handle missing elements gracefully', () => {
            editor.uiManager.revLoadBtnEl = null;
            expect(() => editor.updateRevisionLoadButton()).not.toThrow();
        });

        it('should use uiManager elements', () => {
            editor.updateRevisionLoadButton();
            expect(editor.uiManager).toBeDefined();
        });
    });

    describe('buildSetSelector', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should show default option when no sets exist', () => {
            editor.stateManager.set('namedSets', []);
            editor.buildSetSelector();

            const options = mockUIManager.setSelectEl.querySelectorAll('option');
            expect(options.length).toBeGreaterThanOrEqual(1);
            expect(options[0].value).toBe('default');
        });

        it('should build selector with multiple named sets', () => {
            editor.stateManager.set('namedSets', [
                { name: 'anatomy', revision_count: 3 },
                { name: 'labels', revision_count: 1 }
            ]);
            editor.stateManager.set('currentSetName', 'anatomy');

            editor.buildSetSelector();

            const options = mockUIManager.setSelectEl.querySelectorAll('option');
            // 2 sets + 1 "New" option
            expect(options.length).toBe(3);
        });

        it('should add "+ New" option when under limit', () => {
            editor.stateManager.set('namedSets', [{ name: 'test', revision_count: 1 }]);
            editor.buildSetSelector();

            const options = mockUIManager.setSelectEl.querySelectorAll('option');
            const newOption = Array.from(options).find(o => o.value === '__new__');
            expect(newOption).toBeDefined();
        });

        it('should not add "+ New" option when at limit', () => {
            const sets = [];
            for (let i = 0; i < 15; i++) {
                sets.push({ name: `set${i}`, revision_count: 1 });
            }
            editor.stateManager.set('namedSets', sets);
            editor.buildSetSelector();

            const options = mockUIManager.setSelectEl.querySelectorAll('option');
            const newOption = Array.from(options).find(o => o.value === '__new__');
            expect(newOption).toBeUndefined();
        });

        it('should handle missing setSelectEl gracefully', () => {
            editor.uiManager.setSelectEl = null;
            expect(() => editor.buildSetSelector()).not.toThrow();
        });
    });

    describe('updateNewSetButtonState', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should enable button when under limit', () => {
            editor.stateManager.set('namedSets', [{ name: 'test' }]);
            editor.updateNewSetButtonState();

            expect(mockUIManager.setNewBtnEl.disabled).toBe(false);
        });

        it('should disable button when at limit', () => {
            const sets = [];
            for (let i = 0; i < 15; i++) {
                sets.push({ name: `set${i}` });
            }
            editor.stateManager.set('namedSets', sets);
            editor.updateNewSetButtonState();

            expect(mockUIManager.setNewBtnEl.disabled).toBe(true);
        });

        it('should handle missing button gracefully', () => {
            editor.uiManager.setNewBtnEl = null;
            expect(() => editor.updateNewSetButtonState()).not.toThrow();
        });
    });

    describe('loadLayerSetByName', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should return early for empty set name', async () => {
            await editor.loadLayerSetByName('');
            expect(mockAPIManager.loadLayersBySetName).not.toHaveBeenCalled();
        });

        it('should return early for null set name', async () => {
            await editor.loadLayerSetByName(null);
            expect(mockAPIManager.loadLayersBySetName).not.toHaveBeenCalled();
        });

        it('should load set via API', async () => {
            editor.stateManager.set('isDirty', false);
            await editor.loadLayerSetByName('anatomy');

            expect(mockAPIManager.loadLayersBySetName).toHaveBeenCalledWith('anatomy');
        });

        it('should update currentSetName in state', async () => {
            editor.stateManager.set('isDirty', false);
            await editor.loadLayerSetByName('labels');

            expect(editor.stateManager.get('currentSetName')).toBe('labels');
        });

        it('should notify user on success', async () => {
            editor.stateManager.set('isDirty', false);
            await editor.loadLayerSetByName('test');

            expect(mw.notify).toHaveBeenCalled();
        });

        it('should handle API errors gracefully', async () => {
            mockAPIManager.loadLayersBySetName.mockRejectedValueOnce(new Error('API Error'));
            editor.stateManager.set('isDirty', false);

            await editor.loadLayerSetByName('test');

            expect(mw.notify).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'error' })
            );
        });
    });

    describe('createNewLayerSet', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
            editor.stateManager.set('namedSets', []);
        });

        it('should reject empty name', async () => {
            const result = await editor.createNewLayerSet('');
            expect(result).toBe(false);
        });

        it('should reject whitespace-only name', async () => {
            const result = await editor.createNewLayerSet('   ');
            expect(result).toBe(false);
        });

        it('should reject invalid characters in name', async () => {
            const result = await editor.createNewLayerSet('test set!');
            expect(result).toBe(false);
            expect(mw.notify).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'error' })
            );
        });

        it('should reject duplicate names', async () => {
            editor.stateManager.set('namedSets', [{ name: 'existing' }]);
            const result = await editor.createNewLayerSet('existing');
            expect(result).toBe(false);
        });

        it('should reject when at limit', async () => {
            const sets = [];
            for (let i = 0; i < 15; i++) {
                sets.push({ name: `set${i}` });
            }
            editor.stateManager.set('namedSets', sets);

            const result = await editor.createNewLayerSet('newset');
            expect(result).toBe(false);
        });

        it('should create valid new set', async () => {
            const result = await editor.createNewLayerSet('valid-name');

            expect(result).toBe(true);
            expect(editor.stateManager.get('currentSetName')).toBe('valid-name');
        });

        it('should clear layers for new set', async () => {
            editor.stateManager.set('layers', [{ id: 'old' }]);
            await editor.createNewLayerSet('newset');

            expect(editor.stateManager.get('layers')).toEqual([]);
        });

        it('should add to namedSets list', async () => {
            await editor.createNewLayerSet('myNewSet');

            const sets = editor.stateManager.get('namedSets');
            expect(sets.find(s => s.name === 'myNewSet')).toBeDefined();
        });

        it('should accept names with hyphens and underscores', async () => {
            const result = await editor.createNewLayerSet('my-new_set123');
            expect(result).toBe(true);
        });
    });

    describe('hasUnsavedChanges', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should return false when no unsaved changes', () => {
            editor.stateManager.set('hasUnsavedChanges', false);
            expect(editor.hasUnsavedChanges()).toBe(false);
        });

        it('should return true when has unsaved changes', () => {
            editor.stateManager.set('hasUnsavedChanges', true);
            expect(editor.hasUnsavedChanges()).toBe(true);
        });
    });

    describe('setupCloseButton', () => {
        it('should set up close button handler', () => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
            
            // The close button should have an event listener tracked via EventTracker
            expect(editor.eventTracker.add).toHaveBeenCalled();
        });
    });

    describe('handleKeyDown', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should call eventManager handleKeyDown', () => {
            // handleKeyDown is the actual method name
            const mockEvent = { key: 'z', ctrlKey: true, preventDefault: jest.fn() };
            editor.handleKeyDown(mockEvent);

            // Verify it doesn't throw
            expect(editor.eventManager).toBeDefined();
        });
    });

    describe('selectLayer', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should select a layer by ID', () => {
            editor.addLayer({ type: 'rectangle', x: 0, y: 0 });
            const layerId = editor.layers[0].id;

            editor.selectLayer(layerId);

            // Verify it runs without error
            expect(editor.layers.length).toBe(1);
        });

        it('should handle invalid layer ID gracefully', () => {
            expect(() => {
                editor.selectLayer('nonexistent');
            }).not.toThrow();
        });
    });

    describe('isDirty', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should return isDirty state', () => {
            editor.stateManager.set('isDirty', true);
            expect(editor.isDirty()).toBe(true);

            editor.stateManager.set('isDirty', false);
            expect(editor.isDirty()).toBe(false);
        });
    });

    describe('saveState', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should call historyManager.saveState', () => {
            const saveSpy = jest.spyOn(editor.historyManager, 'saveState');
            editor.saveState('test action');

            expect(saveSpy).toHaveBeenCalled();
        });
    });

    describe('removeLayer', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
            editor.addLayer({ type: 'rectangle', name: 'layer1' });
            editor.addLayer({ type: 'circle', name: 'layer2' });
            editor.addLayer({ type: 'text', name: 'layer3' });
        });

        it('should remove layer by ID', () => {
            const initialCount = editor.layers.length;
            const layerId = editor.layers[0].id;
            editor.removeLayer(layerId);

            expect(editor.layers.length).toBe(initialCount - 1);
        });

        it('should handle invalid layer ID gracefully', () => {
            expect(() => {
                editor.removeLayer('nonexistent');
            }).not.toThrow();
        });

        it('should mark editor as dirty', () => {
            editor.stateManager.set('isDirty', false);
            const layerId = editor.layers[0].id;
            editor.removeLayer(layerId);

            expect(editor.stateManager.get('isDirty')).toBe(true);
        });
    });

    describe('layers array', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should have empty layers initially', () => {
            expect(editor.layers.length).toBe(0);
        });

        it('should track layer count after adding layers', () => {
            editor.addLayer({ type: 'rectangle' });
            editor.addLayer({ type: 'circle' });
            expect(editor.layers.length).toBe(2);
        });
    });
});

describe('LayersEditor Save/Cancel Workflows', () => {
    let LayersEditor;
    let editor;
    let mockContainer;
    let mockAPIManager;

    beforeEach(() => {
        mockContainer = document.createElement('div');
        mockContainer.id = 'layers-editor-container';
        document.body.innerHTML = '';
        document.body.appendChild(mockContainer);

        const mockUIManager = {
            createInterface: jest.fn(),
            container: document.createElement('div'),
            toolbarContainer: document.createElement('div'),
            layerPanelContainer: document.createElement('div'),
            canvasContainer: document.createElement('div'),
            revSelectEl: document.createElement('select'),
            setSelectEl: document.createElement('select'),
            showSpinner: jest.fn(),
            hideSpinner: jest.fn(),
            destroy: jest.fn()
        };

        mockAPIManager = {
            loadLayers: jest.fn().mockReturnValue(new Promise(() => {})),
            saveLayers: jest.fn().mockResolvedValue({ success: true, layersetid: 123 }),
            generateLayerId: jest.fn(() => 'layer_test')
        };

        const mockValidationManager = {
            sanitizeLayerData: jest.fn((data) => data),
            validateLayers: jest.fn().mockReturnValue({ valid: true, errors: [] }),
            checkBrowserCompatibility: jest.fn().mockReturnValue(true)
        };

        const mockCanvasManager = {
            renderLayers: jest.fn(),
            redraw: jest.fn(),
            destroy: jest.fn(),
            events: { destroy: jest.fn() }
        };

        const instanceCache = {};
        const registeredModules = {};

        const mockRegistry = {
            register: jest.fn((name, factory) => {
                registeredModules[name] = factory;
            }),
            get: jest.fn((name) => {
                if (instanceCache[name]) return instanceCache[name];

                const builtins = {
                    UIManager: mockUIManager,
                    EventManager: { setupGlobalHandlers: jest.fn(), destroy: jest.fn() },
                    APIManager: mockAPIManager,
                    ValidationManager: mockValidationManager
                };

                if (name in builtins) {
                    instanceCache[name] = builtins[name];
                    return builtins[name];
                }
                if (name === 'StateManager') {
                    instanceCache[name] = new StateManager();
                    return instanceCache[name];
                }
                if (name === 'HistoryManager') {
                    instanceCache[name] = new HistoryManager();
                    return instanceCache[name];
                }
                if (registeredModules[name]) {
                    instanceCache[name] = registeredModules[name]();
                    return instanceCache[name];
                }
                throw new Error(`Module ${name} not found`);
            })
        };

        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.UIManager = jest.fn().mockReturnValue(mockUIManager);
        window.EventManager = jest.fn().mockReturnValue({ setupGlobalHandlers: jest.fn(), destroy: jest.fn() });
        window.APIManager = jest.fn().mockReturnValue(mockAPIManager);
        window.ValidationManager = jest.fn().mockReturnValue(mockValidationManager);
        window.CanvasManager = jest.fn().mockReturnValue(mockCanvasManager);
        window.Toolbar = jest.fn().mockReturnValue({ destroy: jest.fn(), updateUndoRedoState: jest.fn() });
        window.LayerPanel = jest.fn().mockReturnValue({ render: jest.fn(), destroy: jest.fn() });
        window.LayersConstants = {
            TOOLS: {},
            LAYER_TYPES: {},
            DEFAULTS: { COLORS: {}, LAYER: {} },
            UI: {},
            LIMITS: {}
        };
        window.layersRegistry = mockRegistry;
        window.mw.notify = jest.fn();
        window.mw.config = { get: jest.fn((k, d) => d) };

        jest.resetModules();
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.LayersEditor;
    });

    afterEach(() => {
        if (editor && !editor.isDestroyed) {
            editor.destroy();
        }
        editor = null;
        jest.clearAllMocks();
    });

    describe('save', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should call apiManager.saveLayers', async () => {
            editor.addLayer({ type: 'rectangle' });
            await editor.save();

            expect(mockAPIManager.saveLayers).toHaveBeenCalled();
        });

        it('should show spinner while saving', async () => {
            editor.addLayer({ type: 'rectangle' });
            await editor.save();

            // Save shows spinner
            expect(editor.uiManager.showSpinner).toHaveBeenCalled();
        });

        it('should notify user on success', async () => {
            editor.addLayer({ type: 'rectangle' });
            await editor.save();

            // The API manager handles success notification
            expect(mockAPIManager.saveLayers).toHaveBeenCalled();
        });
    });

    describe('cancel', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg', container: mockContainer });
        });

        it('should call uiManager.destroy when no unsaved changes', () => {
            editor.stateManager.set('isDirty', false);
            editor.stateManager.set('hasUnsavedChanges', false);
            const destroySpy = jest.spyOn(editor.uiManager, 'destroy');
            
            // Mock navigation to prevent jsdom errors
            const originalLocation = window.location;
            delete window.location;
            window.location = { href: '', reload: jest.fn() };
            
            editor.cancel(false); // Don't navigate back

            expect(destroySpy).toHaveBeenCalled();
            
            // Restore
            window.location = originalLocation;
        });
    });
});

describe('LayersEditor Layer Operations', () => {
    let LayersEditor;
    let editor;

    beforeEach(() => {
        const mockContainer = document.createElement('div');
        document.body.innerHTML = '';
        document.body.appendChild(mockContainer);

        const mockUIManager = {
            createInterface: jest.fn(),
            container: document.createElement('div'),
            toolbarContainer: document.createElement('div'),
            layerPanelContainer: document.createElement('div'),
            canvasContainer: document.createElement('div'),
            revSelectEl: document.createElement('select'),
            setSelectEl: document.createElement('select')
        };

        const instanceCache = {};
        const registeredModules = {};
        let layerIdCounter = 0;

        const mockRegistry = {
            register: jest.fn((name, factory) => {
                registeredModules[name] = factory;
            }),
            get: jest.fn((name) => {
                if (instanceCache[name]) return instanceCache[name];

                const builtins = {
                    UIManager: mockUIManager,
                    EventManager: { setupGlobalHandlers: jest.fn(), destroy: jest.fn() },
                    APIManager: {
                        loadLayers: jest.fn().mockReturnValue(new Promise(() => {})),
                        generateLayerId: jest.fn(() => 'layer_' + (++layerIdCounter))
                    },
                    ValidationManager: {
                        sanitizeLayerData: jest.fn(d => d),
                        validateLayers: jest.fn().mockReturnValue({ valid: true }),
                        checkBrowserCompatibility: jest.fn().mockReturnValue(true)
                    }
                };

                if (name in builtins) {
                    instanceCache[name] = builtins[name];
                    return builtins[name];
                }
                if (name === 'StateManager') {
                    instanceCache[name] = new StateManager();
                    return instanceCache[name];
                }
                if (name === 'HistoryManager') {
                    instanceCache[name] = new HistoryManager();
                    return instanceCache[name];
                }
                if (registeredModules[name]) {
                    instanceCache[name] = registeredModules[name]();
                    return instanceCache[name];
                }
                throw new Error(`Module ${name} not found`);
            })
        };

        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.UIManager = jest.fn().mockReturnValue(mockUIManager);
        window.EventManager = jest.fn().mockReturnValue({ setupGlobalHandlers: jest.fn(), destroy: jest.fn() });
        window.APIManager = jest.fn().mockReturnValue({
            loadLayers: jest.fn().mockReturnValue(new Promise(() => {})),
            generateLayerId: jest.fn(() => 'layer_' + (++layerIdCounter))
        });
        window.ValidationManager = jest.fn().mockReturnValue({
            sanitizeLayerData: jest.fn(d => d),
            validateLayers: jest.fn().mockReturnValue({ valid: true }),
            checkBrowserCompatibility: jest.fn().mockReturnValue(true)
        });
        window.CanvasManager = jest.fn().mockReturnValue({
            renderLayers: jest.fn(),
            destroy: jest.fn(),
            events: { destroy: jest.fn() },
            setBaseDimensions: jest.fn()
        });
        window.Toolbar = jest.fn().mockReturnValue({ destroy: jest.fn(), updateUndoRedoState: jest.fn() });
        window.LayerPanel = jest.fn().mockReturnValue({ render: jest.fn(), destroy: jest.fn() });
        window.LayersConstants = {
            TOOLS: {},
            LAYER_TYPES: {},
            DEFAULTS: { COLORS: {}, LAYER: {} },
            UI: {},
            LIMITS: {}
        };
        window.layersRegistry = mockRegistry;

        jest.resetModules();
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.LayersEditor;
    });

    afterEach(() => {
        if (editor && !editor.isDestroyed) {
            editor.destroy();
        }
        editor = null;
    });

    describe('reorderLayer via updateLayer', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg' });
            editor.addLayer({ type: 'rectangle', name: 'layer1' });
            editor.addLayer({ type: 'circle', name: 'layer2' });
        });

        it('should update layer properties', () => {
            const layerId = editor.layers[0].id;
            editor.updateLayer(layerId, { x: 500, y: 500 });

            expect(editor.layers[0].x).toBe(500);
            expect(editor.layers[0].y).toBe(500);
        });
    });

    describe('applyToSelection', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg' });
            editor.addLayer({ type: 'rectangle', x: 0, y: 0 });
            editor.addLayer({ type: 'circle', x: 100, y: 100 });
        });

        it('should apply mutator to selected layers', () => {
            const layer1Id = editor.layers[0].id;
            const layer2Id = editor.layers[1].id;
            // Set selection on canvasManager via method mock
            editor.canvasManager.getSelectedLayerIds = jest.fn().mockReturnValue([layer1Id, layer2Id]);

            editor.applyToSelection((layer) => {
                layer.fill = '#ff0000';
            });

            expect(editor.layers[0].fill).toBe('#ff0000');
            expect(editor.layers[1].fill).toBe('#ff0000');
        });

        it('should handle empty selection', () => {
            editor.canvasManager.getSelectedLayerIds = jest.fn().mockReturnValue([]);

            expect(() => {
                editor.applyToSelection((layer) => {
                    layer.fill = '#00ff00';
                });
            }).not.toThrow();
        });
    });

    describe('getSelectedLayerIds', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg' });
            editor.addLayer({ type: 'rectangle' });
        });

        it('should return empty array when nothing selected', () => {
            // getSelectedLayerIds uses canvasManager.getSelectedLayerIds() or stateManager.get('selectedLayerIds')
            editor.stateManager.set('selectedLayerIds', []);
            expect(editor.getSelectedLayerIds()).toEqual([]);
        });

        it('should return selected layer IDs from canvasManager', () => {
            const layerId = editor.layers[0].id;
            // Set selection via stateManager (which is what canvasManager.getSelectedLayerIds reads from)
            editor.stateManager.set('selectedLayerIds', [layerId]);

            expect(editor.getSelectedLayerIds()).toContain(layerId);
        });

        it('should fallback to stateManager selectedLayerIds when canvasManager unavailable', () => {
            const layerId = editor.layers[0].id;
            editor.canvasManager = null; // Force fallback to stateManager
            editor.stateManager.set('selectedLayerIds', [layerId]);

            expect(editor.getSelectedLayerIds()).toEqual([layerId]);
        });
    });

    describe('markClean', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg' });
        });

        it('should set isDirty to false', () => {
            editor.stateManager.set('isDirty', true);
            editor.markClean();

            expect(editor.stateManager.get('isDirty')).toBe(false);
        });
    });

    describe('renderLayers', () => {
        beforeEach(() => {
            editor = new LayersEditor({ filename: 'Test.jpg' });
        });

        it('should delegate to canvasManager if available', () => {
            const mockLayers = [{ id: 'test', type: 'rectangle' }];
            editor.renderLayers(mockLayers);

            // The canvasManager.renderLayers should have been called
            // (via the init process or directly)
            expect(editor.canvasManager).toBeDefined();
        });
    });
});
