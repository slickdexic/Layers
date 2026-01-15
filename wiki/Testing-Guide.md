# Testing Guide

Complete guide to running and writing tests for the Layers extension.

---

## Overview

Layers uses multiple testing frameworks:

| Framework | Language | Purpose | Coverage |
|-----------|----------|---------|----------|
| **Jest** | JavaScript | Unit tests | ~94.6% |
| **PHPUnit** | PHP | Integration tests | Backend |
| **Playwright** | JavaScript | E2E tests | Critical paths |

---

## Quick Start

```bash
# Run all linting and checks
npm test

# Run JavaScript unit tests
npm run test:js

# Run PHP tests
npm run test:php
```

---

## JavaScript Tests (Jest)

### Running Tests

```bash
# All JavaScript tests
npm run test:js

# Watch mode (re-runs on file changes)
npm run test:js -- --watch

# With coverage report
npm run test:js -- --coverage

# Specific test file
npm run test:js -- HistoryManager

# Specific test file by path
npm run test:js -- tests/jest/CanvasManager.test.js

# Tests matching a pattern
npm run test:js -- --testNamePattern="should handle"
```

### Test File Location

```
tests/jest/
├── *.test.js              # Component tests
├── unit/                  # Pure unit tests
├── canvas/                # Canvas controller tests
└── tools/                 # Tool handler tests
```

### Writing Tests

```javascript
/**
 * Tests for MyComponent
 */
'use strict';

// Import the module
const MyComponent = require( '../../resources/ext.layers.editor/MyComponent.js' );

describe( 'MyComponent', () => {
    let component;
    let mockDependency;
    
    // Setup before each test
    beforeEach( () => {
        mockDependency = {
            doThing: jest.fn( () => 'result' )
        };
        component = new MyComponent( { dependency: mockDependency } );
    } );
    
    // Cleanup after each test
    afterEach( () => {
        if ( component ) {
            component.destroy();
        }
    } );
    
    describe( 'constructor', () => {
        it( 'should initialize with default values', () => {
            expect( component.someProperty ).toBe( 'default' );
        } );
    } );
    
    describe( 'methodName', () => {
        it( 'should return expected result', () => {
            const result = component.methodName( 'input' );
            expect( result ).toBe( 'expected' );
        } );
        
        it( 'should call dependency', () => {
            component.methodThatUsesDependency();
            expect( mockDependency.doThing ).toHaveBeenCalled();
        } );
        
        it( 'should handle null input', () => {
            expect( () => component.methodName( null ) ).not.toThrow();
        } );
    } );
} );
```

### Common Mocking Patterns

#### Mock MediaWiki Objects

```javascript
beforeAll( () => {
    // Mock mw global
    global.mw = {
        config: {
            get: jest.fn( ( key ) => {
                if ( key === 'wgUserName' ) return 'TestUser';
                return null;
            } )
        },
        message: jest.fn( () => ( { text: () => 'Translated' } ) )
    };
} );
```

#### Mock Canvas Context

```javascript
const mockCtx = {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    clearRect: jest.fn(),
    drawImage: jest.fn(),
    getTransform: jest.fn( () => ( { a: 1, d: 1, e: 0, f: 0 } ) ),
    setTransform: jest.fn()
};

const mockCanvas = {
    getContext: jest.fn( () => mockCtx ),
    width: 800,
    height: 600
};
```

#### Mock DOM Elements

```javascript
const mockElement = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    querySelector: jest.fn(),
    style: {},
    getBoundingClientRect: jest.fn( () => ( {
        left: 0, top: 0, width: 800, height: 600
    } ) )
};
```

### Testing Async Code

```javascript
it( 'should handle async operations', async () => {
    const result = await component.asyncMethod();
    expect( result ).toBe( 'success' );
} );

it( 'should handle promises', () => {
    return component.promiseMethod().then( result => {
        expect( result ).toBe( 'success' );
    } );
} );
```

### Coverage Thresholds

Jest is configured with coverage thresholds:

```javascript
// jest.config.js
coverageThreshold: {
    global: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
    }
}
```

---

## PHP Tests (PHPUnit)

### Running Tests

```bash
# All PHP tests
npm run test:php

# Via MediaWiki
php tests/phpunit/phpunit.php extensions/Layers/

# Specific test file
php tests/phpunit/phpunit.php extensions/Layers/tests/phpunit/ApiLayersSaveTest.php
```

### Test File Location

```
tests/phpunit/
├── bootstrap.php              # Test bootstrap
├── Hooks/                     # Hook processor tests
│   └── Processors/
│       └── ImageLinkProcessorTest.php
└── unit/
    ├── Api/                   # API module tests
    │   ├── ApiLayersInfoTest.php
    │   ├── ApiLayersInfoBooleanPreservationTest.php
    │   ├── ApiLayersRenameValidationTest.php
    │   ├── ApiLayersSaveTest.php
    │   ├── ApiLayersSaveGuardsTest.php
    │   └── ForeignFileHelperTraitTest.php
    ├── Database/
    │   └── LayersDatabaseTest.php
    ├── Hooks/
    │   └── Processors/        # Hook processor unit tests
    ├── Logging/
    │   ├── LoggerAwareTraitTest.php
    │   └── StaticLoggerAwareTraitTest.php
    ├── Security/
    │   └── RateLimiterTest.php
    ├── Validation/            # Validation class tests
    │   ├── ColorValidatorTest.php
    │   ├── ServerSideLayerValidatorTest.php
    │   ├── SetNameSanitizerTest.php
    │   ├── TextSanitizerTest.php
    │   └── ValidationResultTest.php
    ├── HooksTest.php
    └── ThumbnailRendererTest.php
```

### Writing Tests

```php
<?php

namespace MediaWiki\Extension\Layers\Tests;

use MediaWikiIntegrationTestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 * @group Layers
 * @group Database
 */
class ApiLayersSaveTest extends MediaWikiIntegrationTestCase {
    
    protected function setUp(): void {
        parent::setUp();
        // Setup code
    }
    
    public function testSaveLayerSet(): void {
        // Arrange
        $filename = 'Test.png';
        $data = json_encode( [ [ 'id' => '1', 'type' => 'rectangle' ] ] );
        
        // Act
        $result = $this->doApiRequestWithToken( [
            'action' => 'layerssave',
            'filename' => "File:$filename",
            'data' => $data
        ] );
        
        // Assert
        $this->assertArrayHasKey( 'layerssave', $result[0] );
        $this->assertEquals( 1, $result[0]['layerssave']['success'] );
    }
    
    public function testSaveWithInvalidData(): void {
        $this->expectException( \ApiUsageException::class );
        
        $this->doApiRequestWithToken( [
            'action' => 'layerssave',
            'filename' => 'File:Test.png',
            'data' => 'not valid json'
        ] );
    }
}
```

---

## End-to-End Tests (Playwright)

### Running Tests

```bash
# Run E2E tests
npx playwright test

# With UI mode
npx playwright test --ui

# Specific browser
npx playwright test --project=chromium
```

### Test File Location

```
tests/e2e/
├── editor.spec.js
└── viewer.spec.js
```

### Writing Tests

```javascript
const { test, expect } = require( '@playwright/test' );

test.describe( 'Layers Editor', () => {
    test.beforeEach( async ( { page } ) => {
        await page.goto( '/wiki/File:TestImage.png' );
        await page.click( 'text=Edit Layers' );
    } );
    
    test( 'should load editor', async ( { page } ) => {
        await expect( page.locator( '.layers-editor' ) ).toBeVisible();
    } );
    
    test( 'should draw rectangle', async ( { page } ) => {
        // Select rectangle tool
        await page.click( '[data-tool="rectangle"]' );
        
        // Draw on canvas
        const canvas = page.locator( '.layers-canvas' );
        await canvas.click( { position: { x: 100, y: 100 } } );
        await canvas.click( { position: { x: 200, y: 200 } } );
        
        // Verify layer created
        await expect( page.locator( '.layer-item' ) ).toHaveCount( 1 );
    } );
} );
```

---

## Linting

### JavaScript Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

### CSS Linting

```bash
# Run Stylelint
npm run lint:css
```

### PHP Linting

```bash
# Run PHPCS
npm run test:php

# Auto-fix PHP issues
npm run fix:php
```

---

## Test Utilities

### Mocking with Jest

```javascript
// Mock a module
jest.mock( '../../resources/ext.layers.editor/SomeModule.js', () => {
    return jest.fn().mockImplementation( () => ( {
        method: jest.fn()
    } ) );
} );

// Mock specific methods
jest.spyOn( component, 'method' ).mockReturnValue( 'mocked' );

// Reset mocks between tests
beforeEach( () => {
    jest.clearAllMocks();
} );
```

### Creating Test Fixtures

```javascript
// tests/jest/fixtures/layers.js
module.exports = {
    rectangleLayer: {
        id: 'rect_1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        stroke: '#ff0000',
        strokeWidth: 2
    },
    
    textLayer: {
        id: 'text_1',
        type: 'text',
        x: 50,
        y: 50,
        text: 'Test Label',
        fontSize: 16
    }
};
```

---

## CI Integration

Tests run automatically on:
- Pull requests
- Pushes to `main` and `REL1_39`

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:js -- --coverage
```

---

## Debugging Tests

### Jest Debugging

```bash
# Run with debugger
node --inspect-brk node_modules/.bin/jest --runInBand tests/jest/MyTest.test.js
```

Then attach VS Code debugger.

### Console Output

```javascript
it( 'should debug something', () => {
    console.log( 'Debug value:', component.getValue() );
    expect( true ).toBe( true );
} );
```

### Test Isolation

If tests affect each other:

```javascript
describe( 'Component', () => {
    beforeEach( () => {
        // Fresh setup for each test
        component = new Component();
    } );
    
    afterEach( () => {
        // Clean up after each test
        component.destroy();
        component = null;
    } );
} );
```

---

## Best Practices

### Test Naming

```javascript
// Good: Describes behavior
it( 'should return null when input is undefined' );
it( 'should emit change event after update' );

// Bad: Describes implementation
it( 'calls handleNull' );
it( 'uses EventEmitter' );
```

### Arrange-Act-Assert

```javascript
it( 'should calculate area correctly', () => {
    // Arrange
    const layer = { width: 100, height: 50 };
    
    // Act
    const area = component.calculateArea( layer );
    
    // Assert
    expect( area ).toBe( 5000 );
} );
```

### Test One Thing

```javascript
// Good: One assertion per behavior
it( 'should set width', () => {
    component.resize( 200, 100 );
    expect( component.width ).toBe( 200 );
} );

it( 'should set height', () => {
    component.resize( 200, 100 );
    expect( component.height ).toBe( 100 );
} );

// Bad: Multiple unrelated assertions
it( 'should resize', () => {
    component.resize( 200, 100 );
    expect( component.width ).toBe( 200 );
    expect( component.height ).toBe( 100 );
    expect( component.dirty ).toBe( true );
    expect( events.fired ).toBe( true );
} );
```

---

## See Also

- [[Contributing Guide]] — How to contribute
- [[Architecture Overview]] — System design
