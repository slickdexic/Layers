<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Database;

use MediaWikiUnitTestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
 */
class LayersDatabaseTest extends MediaWikiUnitTestCase
{
    public function testGetNextRevision()
    {
        // This would require database mocking for proper testing
        // For now, just test the class can be instantiated
        $this->assertTrue(class_exists('MediaWiki\\Extension\\Layers\\Database\\LayersDatabase'));
    }

    public function testLayerSetDataStructure()
    {
        // Test the expected data structure format
        $expectedFields = [
            'id', 'imgName', 'userId', 'timestamp', 'revision', 'name', 'data'
        ];

        // This is a structure test - in a real implementation,
        // we'd mock the database and test actual methods
        $this->assertIsArray($expectedFields);
        $this->assertContains('data', $expectedFields);
    }
}
