<?php
/**
 * Quick test of database connectivity
 */
require_once __DIR__ . '/../../maintenance/Maintenance.php';

class QuickDBTest extends Maintenance {
	public function execute() {
		try {
			$this->output( "Testing database connection...\n" );
			$db = new \MediaWiki\Extension\Layers\Database\LayersDatabase();
			$this->output( "SUCCESS: Database connection established!\n" );
		} catch ( Exception $e ) {
			$this->output( "ERROR: " . $e->getMessage() . "\n" );
			$this->output( "Class: " . get_class( $e ) . "\n" );
			$this->output( "File: " . $e->getFile() . ":" . $e->getLine() . "\n" );
		}
	}
}

$maintClass = QuickDBTest::class;
require_once RUN_MAINTENANCE_IF_MAIN;
