<?php

declare( strict_types=1 );

// Deterministic original test assets. No external libraries or downloaded content.
// Run with --check to verify committed bytes without writing files.
$chunk = static function ( string $type, string $data ): string {
	return pack( 'N', strlen( $data ) ) . $type . $data . pack( 'N', crc32( $type . $data ) );
};
$png = static function ( string $pixel ) use ( $chunk ): string {
	$scanline = "\0" . $pixel;
	// One uncompressed DEFLATE block inside a zlib stream; stable across zlib versions.
	$compressed = "\x78\x01\x01" . pack( 'vv', strlen( $scanline ), 65535 - strlen( $scanline ) ) .
		$scanline . hash( 'adler32', $scanline, true );
	return "\x89PNG\r\n\x1a\n" .
		$chunk( 'IHDR', pack( 'NNCCCCC', 1, 1, 8, 2, 0, 0, 0 ) ) .
		$chunk( 'IDAT', $compressed ) . $chunk( 'IEND', '' );
};
$pdf = static function ( array $pages ): string {
	$pageCount = count( $pages );
	$kids = [];
	for ( $i = 0; $i < $pageCount; $i++ ) {
		$kids[] = ( $i + 3 ) . ' 0 R';
	}
	$fontObjNum = $pageCount + 3;
	$objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [' . implode( ' ', $kids ) . '] /Count ' . $pageCount . ' >>',
	];
	foreach ( $pages as $i => $page ) {
		$contentObjNum = $fontObjNum + 1 + $i;
		$w = $page['width'];
		$h = $page['height'];
		$objects[] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . $w . ' ' . $h . '] ' .
			'/Resources << /Font << /F1 ' . $fontObjNum . ' 0 R >> >> /Contents ' . $contentObjNum . ' 0 R >>';
	}
	$objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
	foreach ( $pages as $page ) {
		$label = $page['label'];
		$stream = "BT /F1 12 Tf 10 40 Td ($label) Tj ET\n";
		$objects[] = '<< /Length ' . strlen( $stream ) . ">>\nstream\n" . $stream . 'endstream';
	}
	$result = "%PDF-1.4\n";
	$offsets = [];
	foreach ( $objects as $index => $object ) {
		$offsets[] = strlen( $result );
		$result .= ( $index + 1 ) . " 0 obj\n" . $object . "\nendobj\n";
	}
	$xref = strlen( $result );
	$size = count( $objects ) + 1;
	$result .= "xref\n0 $size\n0000000000 65535 f \n";
	foreach ( $offsets as $offset ) {
		$result .= sprintf( "%010d 00000 n \n", $offset );
	}
	return $result . "trailer\n<< /Size $size /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n";
};
$fixtures = [
	'test-image.png' => $png( "\x20\x60\xc0" ),
	'test-image-replacement.png' => $png( "\xc0\x60\x20" ),
	'test-multipage.pdf' => $pdf( [
		[ 'width' => 200, 'height' => 100, 'label' => 'Page one' ],
		[ 'width' => 100, 'height' => 200, 'label' => 'Page two' ]
	] ),
	'test-multipage-replacement.pdf' => $pdf( [
		[ 'width' => 300, 'height' => 150, 'label' => 'Replacement page one' ]
	] )
];
$check = in_array( '--check', $argv, true );
foreach ( $fixtures as $name => $bytes ) {
	$path = __DIR__ . '/' . $name;
	if ( $check ) {
		if ( !is_file( $path ) || file_get_contents( $path ) !== $bytes ) {
			fwrite( STDERR, "Fixture differs: $name\n" );
			exit( 1 );
		}
	} else {
		file_put_contents( $path, $bytes );
	}
	echo $name . ': ' . strlen( $bytes ) . " bytes\n";
}
