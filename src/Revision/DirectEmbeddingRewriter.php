<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** Conservative raw-source subset, not a general MediaWiki parser. No expansion or writes. */
class DirectEmbeddingRewriter {
	/** Used when no native tag list is supplied (unit tests, pure helpers). */
	public const DEFAULT_EXTENSION_TAGS = [ 'nowiki', 'pre', 'source', 'syntaxhighlight', 'math', 'ref', 'gallery' ];

	/** @var array<string,true> Lowercase tag names whose bodies are not ordinary page wikitext */
	private array $opaqueTags = [];

	/**
	 * @param string[]|null $extensionTags Registered parser tags, e.g. Parser::getTags()
	 */
	public function __construct( ?array $extensionTags = null ) {
		// Content inside <includeonly> is never rendered on the page itself.
		foreach ( array_merge( $extensionTags ?? self::DEFAULT_EXTENSION_TAGS, [ 'includeonly' ] ) as $tag ) {
			if ( is_string( $tag ) && $tag !== '' ) {
				$this->opaqueTags[strtolower( $tag )] = true;
			}
		}
	}

	/**
	 * Find complete top-level literal embeds; all offsets are UTF-8 byte offsets.
	 * Resolver must use native Title namespace rules and return canonical File: DB-key text,
	 * or null for a non-file target. No filename occurrence queues are used.
	 * @param string $text Exact base-revision main text
	 * @param callable $resolveFile Trusted native namespace normalizer
	 * @return array
	 */
	public function scan( string $text, callable $resolveFile ): array {
		if ( preg_match( '/[\x00-\x08\x0b\x0e-\x1f\x7f]/', $text ) ) {
			$this->reject();
		}
		$result = [];
		$length = strlen( $text );
		for ( $i = 0; $i < $length; ) {
			if ( substr( $text, $i, 1 ) === '<' ) {
				$i = $this->skipLiteral( $text, $i );
				continue;
			}
			$open = $this->opener( $text, $i );
			if ( $open === null ) {
				// Single brackets (external links, prose) and stray closers are plain text to the preprocessor.
				$i++;
				continue;
			}
			$end = $this->balancedEnd( $text, $i, $open, 0 );
			$raw = substr( $text, $i, $end - $i );
			$body = substr( $raw, strlen( $open ), -strlen( $open ) );
			// Nested links/templates, comments and tags require a native source adapter.
			if ( $open !== '{{{' && !preg_match( '/[\[\]{}<>]/', $body ) ) {
				$parts = explode( '|', $body );
				$head = trim( array_shift( $parts ) );
				$kind = null;
				$target = null;
				if ( $open === '[[' && $head !== '' && $head[0] !== ':' ) {
					$target = $resolveFile( $head );
					$kind = $target !== null ? 'file' : null;
				} elseif ( $open === '{{' && preg_match( '/\A#slide\s*:(.+)\z/iD', $head, $match ) ) {
					$target = trim( $match[1] );
					$kind = $target !== '' ? 'slide' : null;
				}
				if ( $kind !== null ) {
					$result[] = [ 'start' => $i, 'length' => $end - $i, 'raw' => $raw,
						'kind' => $kind, 'target' => $target, 'options' => $parts ];
				}
			}
			$i = $end;
		}
		return $result;
	}

	/**
	 * Make one scanner-verified candidate name a drawing of the page, retaining all other bytes:
	 * a file embed's set selector becomes `layerset=<pageId>:<name>`, a slide embed's target
	 * becomes `<pageId>:<name>` and loses its set selector.
	 * Does not prove selected legacy row/source identity; the adoption caller must do that.
	 * @param string $text
	 * @param int $start
	 * @param string $expected Original complete embedding bytes from the same base
	 * @param int $pageId Owner page
	 * @param string $name The drawing's final, canonical name
	 * @param callable $resolveFile
	 * @param bool $emitBareNames Emit a verified bare name instead of the explicit owner reference
	 * @return string
	 */
	public function rewrite( string $text, int $start, string $expected, int $pageId, string $name,
		callable $resolveFile, bool $emitBareNames = false
	): string {
		$reference = $pageId . ':' . $name;
		try {
			$valid = DrawingName::normalize( $name ) === $name &&
				PageOwnedBinding::parseNamed( $reference ) === [ 'pageId' => $pageId, 'name' => $name ];
		} catch ( \InvalidArgumentException $e ) {
			$valid = false;
		}
		if ( !$valid ) {
			$this->reject();
		}
		if ( $emitBareNames ) {
			$reference = $name;
		}
		foreach ( $this->scan( $text, $resolveFile ) as $candidate ) {
			if ( $candidate['start'] !== $start || $candidate['raw'] !== $expected ) {
				continue;
			}
			$file = $candidate['kind'] === 'file';
			$parts = explode( '|', substr( $expected, 2, -2 ) );
			$head = array_shift( $parts );
			$kept = [];
			$selectors = 0;
			foreach ( $parts as $part ) {
				$key = strtolower( trim( explode( '=', $part, 2 )[0], " \t\r\n\f" ) );
				if ( $key === 'layersbinding' ) {
					$this->reject();
				}
				if ( in_array( $key, [ 'layerset', 'layers', 'layer', 'layersetid' ], true ) ) {
					if ( ++$selectors > 1 ) {
						$this->reject();
					}
					if ( $file ) {
						$kept[] = 'layerset=' . $reference;
					}
				} else {
					$kept[] = $part;
				}
			}
			if ( $file && !$selectors ) {
				$kept[] = 'layerset=' . $reference;
			}
			if ( !$file ) {
				$pattern = $emitBareNames ? '/\A(\s*#slide\s*:\s*).*?(\s*)\z/isD' :
					'/\A(#slide\s*:\s*).*?(\s*)\z/isD';
				$head = preg_replace_callback( $pattern,
					static fn ( $m ) => $m[1] . $reference . $m[2], $head );
			}
			$target = $file ? $candidate['target'] : trim( substr( $head, strpos( $head, ':' ) + 1 ) );
			if ( !$emitBareNames && ( PageOwnedBindingOptions::extract( $kept ) !== null ||
				PageOwnedBindingOptions::named( $kept, $candidate['kind'], $target ) !==
					[ 'pageId' => $pageId, 'name' => $name ]
			) ) {
				$this->reject();
			}
			$replacement = substr( $expected, 0, 2 ) . $head . ( $kept ? '|' . implode( '|', $kept ) : '' ) .
				substr( $expected, -2 );
			if ( $emitBareNames ) {
				$this->assertBareReplacement( $replacement, $candidate, $pageId, $name, $resolveFile );
			}
			return substr( $text, 0, $start ) . $replacement . substr( $text, $start + strlen( $expected ) );
		}
		$this->reject();
	}

	/**
	 * Point every direct embed that names a renamed drawing of the page at its new name.
	 * @param string $text
	 * @param int $pageId Owner page
	 * @param string[] $renames New canonical names, keyed by DrawingName::key() of the old ones
	 * @param callable $resolveFile
	 * @param bool $bareNames Bare names mean the page's own drawings (after the migration); they become named
	 * @return string
	 * @throws \InvalidArgumentException When the scanner refuses the text
	 */
	public function renameReferences( string $text, int $pageId, array $renames, callable $resolveFile,
		bool $bareNames = false
	): string {
		$edits = [];
		foreach ( $this->scan( $text, $resolveFile ) as $candidate ) {
			try {
				$explicit = PageOwnedBindingOptions::named( $candidate['options'], $candidate['kind'],
					$candidate['target'] );
				$named = $explicit ?? ( $bareNames ? PageOwnedBindingOptions::named( $candidate['options'],
					$candidate['kind'], $candidate['target'], $pageId ) : null );
			} catch ( \InvalidArgumentException $e ) {
				continue;
			}
			$new = $named && $named['pageId'] === $pageId ? $renames[DrawingName::key( $named['name'] )] ?? null : null;
			if ( $new === null ) {
				continue;
			}
			$reference = $pageId . ':' . $new;
			$parts = explode( '|', substr( $candidate['raw'], 2, -2 ) );
			$head = array_shift( $parts );
			if ( $candidate['kind'] === 'slide' ) {
				$head = preg_replace_callback( '/\A(#slide\s*:\s*).*?(\s*)\z/isD',
					static fn ( $m ) => $m[1] . $reference . $m[2], $head );
			} else {
				foreach ( $parts as $i => $part ) {
					$equalsPos = strpos( $part, '=' );
					$key = $equalsPos === false ? '' :
						strtolower( trim( substr( $part, 0, $equalsPos ), " \t\r\n\f" ) );
					if ( in_array( $key, [ 'layerset', 'layers' ], true ) && ( $explicit === null ||
						preg_match( '/\A\s*[0-9]+:/', substr( $part, $equalsPos + 1 ) ) )
					) {
						$parts[$i] = substr( $part, 0, $equalsPos + 1 ) . $reference;
						if ( $explicit === null ) {
							break;
						}
					}
				}
			}
			$edits[] = [ $candidate['start'], $candidate['length'], substr( $candidate['raw'], 0, 2 ) . $head .
				( $parts ? '|' . implode( '|', $parts ) : '' ) . substr( $candidate['raw'], -2 ) ];
		}
		foreach ( array_reverse( $edits ) as [ $start, $length, $replacement ] ) {
			$text = substr( $text, 0, $start ) . $replacement . substr( $text, $start + $length );
		}
		return $text;
	}

	/**
	 * Rename only the specified file/slide layer-set identities in direct literal embeds.
	 * @param string $text Original main-slot source
	 * @param int $pageId Owner page
	 * @param array $renames List of kind, fileTitle, oldName and canonical newName records
	 * @param callable $resolveFile Native canonical file-title resolver
	 * @param bool $bareNames Whether bare selectors mean this page's own layer sets
	 * @param bool $emitBareNames Emit verified bare names without changing input eligibility
	 * @return string
	 * @throws \InvalidArgumentException For invalid instructions or unsupported source
	 */
	public function renameScopedReferences( string $text, int $pageId, array $renames, callable $resolveFile,
		bool $bareNames = false, bool $emitBareNames = false
	): string {
		if ( $pageId < 1 || $pageId > 2147483647 || !array_is_list( $renames ) ) {
			$this->reject();
		}
		$scopes = [];
		$instructions = [];
		foreach ( $renames as $rename ) {
			if ( !is_array( $rename ) || count( $rename ) !== 4 ||
				!isset( $rename['kind'] ) || !isset( $rename['oldName'] ) || !isset( $rename['newName'] ) ||
				!array_key_exists( 'fileTitle', $rename ) ||
				!in_array( $rename['kind'], [ 'file', 'slide' ], true ) ||
				!is_string( $rename['oldName'] ) || !is_string( $rename['newName'] ) ||
				DrawingName::normalize( $rename['newName'] ) !== $rename['newName']
			) {
				$this->reject();
			}
			$fileTitle = $rename['fileTitle'];
			if ( $rename['kind'] === 'file' ) {
				if ( !is_string( $fileTitle ) || !str_starts_with( $fileTitle, 'File:' ) ) {
					$this->reject();
				}
				try {
					$canonical = $resolveFile( $fileTitle );
				} catch ( \InvalidArgumentException $exception ) {
					$this->reject();
				}
				if ( $canonical !== $fileTitle ) {
					$this->reject();
				}
			} elseif ( $fileTitle !== null ) {
				$this->reject();
			}
			// Impossible old names must not select valid names such as "_" whose key is empty.
			// Noncanonical but usable old spacing/case remains valid comparison input.
			$matchable = DrawingName::normalize( $rename['oldName'] ) !== null;
			$oldKey = DrawingName::key( $rename['oldName'] );
			$previous = $instructions[$rename['kind']][$fileTitle ?? ''][(int)$matchable][$oldKey] ?? null;
			if ( $previous !== null && $previous !== $rename['newName'] ) {
				$this->reject();
			}
			$instructions[$rename['kind']][$fileTitle ?? ''][(int)$matchable][$oldKey] = $rename['newName'];
			if ( $matchable ) {
				$scopes[$rename['kind']][$fileTitle ?? ''][$oldKey] = $rename['newName'];
			}
		}

		$edits = [];
		foreach ( $this->scan( $text, $resolveFile ) as $candidate ) {
			$selectors = 0;
			$selectorIndex = null;
			foreach ( $candidate['options'] as $index => $option ) {
				$key = strtolower( trim( explode( '=', $option, 2 )[0], " \t\r\n\f" ) );
				if ( $key === 'layersbinding' ) {
					continue 2;
				}
				if ( in_array( $key, [ 'layerset', 'layers', 'layer', 'layersetid' ], true ) ) {
					$selectors++;
					$selectorIndex = $index;
				}
			}
			if ( $candidate['kind'] === 'file' && $selectors !== 1 ) {
				continue;
			}
			try {
				$named = PageOwnedBindingOptions::named( $candidate['options'], $candidate['kind'],
					$candidate['target'], $bareNames ? $pageId : null );
			} catch ( \InvalidArgumentException $exception ) {
				continue;
			}
			if ( $named === null || $named['pageId'] !== $pageId ) {
				continue;
			}
			$fileTitle = $candidate['kind'] === 'file' ? $candidate['target'] : '';
			$newName = $scopes[$candidate['kind']][$fileTitle][DrawingName::key( $named['name'] )] ?? null;
			if ( $newName === null ) {
				continue;
			}
			$reference = $emitBareNames ? $newName : $pageId . ':' . $newName;
			$parts = explode( '|', substr( $candidate['raw'], 2, -2 ) );
			$head = array_shift( $parts );
			if ( $candidate['kind'] === 'slide' ) {
				$head = preg_replace_callback( '/\A(\s*#slide\s*:\s*).*?(\s*)\z/isD',
					static fn ( $match ) => $match[1] . $reference . $match[2], $head );
			} else {
				$equalsPos = strpos( $parts[$selectorIndex], '=' );
				$parts[$selectorIndex] = substr( $parts[$selectorIndex], 0, $equalsPos + 1 ) . $reference;
			}
			$replacement = substr( $candidate['raw'], 0, 2 ) . $head .
				( $parts ? '|' . implode( '|', $parts ) : '' ) . substr( $candidate['raw'], -2 );
			if ( $emitBareNames ) {
				$this->assertBareReplacement( $replacement, $candidate, $pageId, $newName, $resolveFile );
			}
			$edits[] = [ $candidate['start'], $candidate['length'], $replacement ];
		}
		foreach ( array_reverse( $edits ) as [ $start, $length, $replacement ] ) {
			$text = substr( $text, 0, $start ) . $replacement . substr( $text, $start + $length );
		}
		return $text;
	}

	/**
	 * @param string $replacement Actual complete replacement bytes
	 * @param array $original Original scanner candidate
	 * @param int $pageId Intended owner
	 * @param string $name Requested canonical bare spelling
	 * @param callable $resolveFile Native canonical file-title resolver
	 */
	private function assertBareReplacement( string $replacement, array $original, int $pageId, string $name,
		callable $resolveFile
	): void {
		try {
			$found = $this->scan( $replacement, $resolveFile );
			if ( count( $found ) !== 1 || $found[0]['start'] !== 0 || $found[0]['raw'] !== $replacement ||
				$found[0]['length'] !== strlen( $replacement ) || $found[0]['kind'] !== $original['kind']
			) {
				$this->reject();
			}
			$candidate = $found[0];
			if ( $candidate['kind'] === 'slide' ) {
				$bare = $candidate['target'] === $name;
			} else {
				$values = [];
				foreach ( $candidate['options'] as $option ) {
					$equalsPos = strpos( $option, '=' );
					$key = $equalsPos === false ? '' : strtolower( trim( substr( $option, 0, $equalsPos ) ) );
					if ( in_array( $key, [ 'layerset', 'layers' ], true ) ) {
						$values[] = trim( substr( $option, $equalsPos + 1 ), " \t\r\n\f" );
					}
				}
				$bare = $candidate['target'] === $original['target'] && $values === [ $name ];
			}
			if ( !$bare || PageOwnedBindingOptions::extract( $candidate['options'] ) !== null ||
				PageOwnedBindingOptions::named( $candidate['options'], $candidate['kind'], $candidate['target'],
					$pageId ) !== [ 'pageId' => $pageId, 'name' => $name ]
			) {
				$this->reject();
			}
		} catch ( \InvalidArgumentException $exception ) {
			$this->reject();
		}
	}

	/** @param string $text @param int $offset @return string|null */
	private function opener( string $text, int $offset ): ?string {
		foreach ( [ '{{{', '{{', '[[' ] as $open ) {
			if ( substr( $text, $offset, strlen( $open ) ) === $open ) {
				return $open;
			}
		}
		return null;
	}

	/** @param string $text @param int $start @param string $open @param int $depth @return int */
	private function balancedEnd( string $text, int $start, string $open, int $depth ): int {
		if ( $depth > 64 ) {
			$this->reject();
		}
		$close = $open === '[[' ? ']]' : str_repeat( '}', strlen( $open ) );
		for ( $i = $start + strlen( $open ), $length = strlen( $text ); $i < $length; ) {
			$nested = $this->opener( $text, $i );
			if ( substr( $text, $i, strlen( $close ) ) === $close ) {
				return $i + strlen( $close );
			}
			if ( $text[$i] === '<' ) {
				$i = $this->skipLiteral( $text, $i );
			} elseif ( $nested !== null ) {
				$i = $this->balancedEnd( $text, $i, $nested, $depth + 1 );
			} elseif ( substr( $text, $i, 2 ) === '}}' || substr( $text, $i, 2 ) === ']]' ) {
				$this->reject();
			} else {
				$i++;
			}
		}
		$this->reject();
	}

	/** @param string $text @param int $offset @return int */
	private function skipLiteral( string $text, int $offset ): int {
		if ( substr( $text, $offset, 4 ) === '<!--' ) {
			$end = strpos( $text, '-->', $offset + 4 );
			if ( $end === false ) {
				$this->reject();
			}
			return $end + 3;
		}
		if ( !preg_match( '/\G<\/?([A-Za-z][A-Za-z0-9_:.-]*)/', $text, $name, 0, $offset ) ) {
			return $offset + 1;
		}
		$tag = strtolower( $name[1] );
		if ( in_array( $tag, [ 'noinclude', 'onlyinclude' ], true ) ||
			( $tag === 'includeonly' && $name[0][1] === '/' ) ) {
			// Transclusion markers: their content is rendered on the page itself.
			$close = strpos( $text, '>', $offset );
			return $close === false ? $offset + 1 : $close + 1;
		}
		if ( $name[0][1] === '/' || !isset( $this->opaqueTags[$tag] ) ) {
			// Ordinary HTML such as <br>, <div> or <span> is plain text to the preprocessor.
			return $offset + 1;
		}
		if ( !preg_match( '/\G<' . preg_quote( $name[1], '/' ) . '(?=[ \t\r\n\f\/>])' .
			'(?:[^<>"\']|"[^"]*"|\'[^\']*\')*>/i', $text, $match, 0, $offset ) ) {
			return $offset + 1;
		}
		$after = $offset + strlen( $match[0] );
		if ( preg_match( '/\/\s*>\z/', $match[0] ) ) {
			return $after;
		}
		$quoted = preg_quote( $name[1], '/' );
		if ( !preg_match( '/<\/' . $quoted . '\s*>/i', $text, $close, PREG_OFFSET_CAPTURE, $after ) ) {
			$this->reject();
		}
		$end = $close[0][1];
		if ( preg_match( '/<' . $quoted . '(?=[ \t\r\n\f\/>])/i', substr( $text, $after, $end - $after ) ) ) {
			$this->reject();
		}
		return $end + strlen( $close[0][0] );
	}

	/** @return never */
	private function reject(): void {
		throw new \InvalidArgumentException( 'layers-embedding-source-unavailable' );
	}
}
