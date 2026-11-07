<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IExpression;
use Wikimedia\Rdbms\LikeValue;

/** Bounded discovery of pages whose recorded legacy embeds reference a file. */
final class LegacySourceScan {
	public function __construct( private IConnectionProvider $connections ) {
	}

	/**
	 * Scan recorded shown-set properties on the primary database in page-ID order.
	 * The file description page is not included unless it also has a matching property.
	 * @param Title $file Canonical file title
	 * @param int $after Exclusive page-ID cursor
	 * @param int $limit Maximum property rows to inspect, 1–500
	 * @return array{pageIds:int[],next:?int}
	 */
	public function scan( Title $file, int $after, int $limit ): array {
		if ( $file->getNamespace() !== NS_FILE || !$file->canExist() || $file->hasFragment() ||
			$after < 0 || $limit < 1 || $limit > 500 ) {
			throw new \InvalidArgumentException( 'Invalid legacy source scan request' );
		}
		$db = $this->connections->getPrimaryDatabase();
		$name = $file->getDBkey();
		$rows = $db->newSelectQueryBuilder()->select( [ 'pp_page', 'pp_value' ] )->from( 'page_props' )
			->where( [ 'pp_propname' => ShownLayerSets::PROPERTY, $db->expr( 'pp_page', '>', $after ),
				$db->expr( 'pp_value', IExpression::LIKE, new LikeValue( $db->anyString(),
					ShownLayerSets::fragment( ShownLayerSets::FILE, $name ), $db->anyString() ) ) ] )
			->orderBy( 'pp_page' )->limit( $limit )->caller( __METHOD__ )->fetchResultSet();
		$matches = [];
		$last = null;
		$count = 0;
		foreach ( $rows as $row ) {
			$count++;
			$last = (int)$row->pp_page;
			foreach ( ShownLayerSets::decode( $row->pp_value ) as $entry ) {
				if ( $entry[0] === ShownLayerSets::FILE && $entry[1] === $name ) {
					$matches[] = $last;
					break;
				}
			}
		}
		return [ 'pageIds' => $matches, 'next' => $count === $limit ? $last : null ];
	}
}
