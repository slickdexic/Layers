<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use ApiResult;
use MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;

/**
 * API module for listing slides.
 *
 * This module provides the backend for Special:Slides, returning a paginated
 * list of all slides on the wiki with metadata.
 *
 * USAGE:
 *   api.get({
 *     action: 'layerslist',
 *     prefix: 'Process',      // optional - filter by name prefix
 *     limit: 20,              // optional - results per page (default 50, max 500)
 *     offset: 0,              // optional - pagination offset
 *     sort: 'name'            // optional - sort by: name, created, modified
 *   });
 *
 * RESPONSE:
 *   {
 *     "layerslist": {
 *       "slides": [
 *         {
 *           "name": "ProcessDiagram",
 *           "canvasWidth": 800,
 *           "canvasHeight": 600,
 *           "backgroundColor": "#ffffff",
 *           "layerCount": 12,
 *           "revisionCount": 5,
 *           "created": "2026-01-15T10:00:00Z",
 *           "modified": "2026-01-20T14:30:00Z",
 *           "createdBy": "AdminUser",
 *           "createdById": 1,
 *           "modifiedBy": "EditorUser",
 *           "modifiedById": 2
 *         }
 *       ],
 *       "total": 42,
 *       "continue": 50
 *     }
 *   }
 */
class ApiLayersList extends ApiBase {
	use LayersContinuationTrait;

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger = null;

	/**
	 * Execute the API request.
	 */
	public function execute() {
		// P1.2 FIX: Require read permission to prevent anonymous slide enumeration
		$this->checkUserRightsAny( 'read' );

		// P2.8 FIX: Rate limit slide listing to prevent abuse
		$user = $this->getUser();
		if ( $user->pingLimiter( 'editlayers-list' ) ) {
			$this->dieWithError( LayersConstants::ERROR_RATE_LIMITED, 'ratelimited' );
		}

		$params = $this->extractRequestParams();

		// Parse parameters
		$prefix = $params['prefix'] ?? '';
		$limit = isset( $params['limit'] ) ? (int)$params['limit'] : LayersConstants::API_LIST_DEFAULT_LIMIT;
		$limit = max( LayersConstants::API_LIST_MIN_LIMIT, min( $limit, LayersConstants::API_LIST_MAX_LIMIT ) );
		$offset = isset( $params['offset'] ) ? (int)$params['offset'] : 0;
		$offset = max( 0, $offset );
		$sort = $params['sort'] ?? 'name';

		// Handle continue parameter
		if ( isset( $params['continue'] ) && $params['continue'] !== '' ) {
			$offset = max( $offset, $this->parseContinueParameter( (string)$params['continue'] ) );
		}

		$db = $this->getLayersDatabase();

		// Verify database schema exists
		if ( !$db->isSchemaReady() ) {
			$this->dieWithError(
				[ LayersConstants::ERROR_DB, 'Layer tables missing. Please run maintenance/update.php' ],
				'dbschema-missing'
			);
		}

		// Get slides from database
		try {
			$slides = $db->listSlides( $prefix, $limit, $offset, $sort );
			$total = $db->countSlides( $prefix );
		} catch ( \Exception $e ) {
			$this->getLogger()->error(
				'Failed to list slides: {error}',
				[ 'error' => $e->getMessage() ]
			);
			$this->dieWithError(
				[ LayersConstants::ERROR_DB, $e->getMessage() ],
				'db-error'
			);
		}

		// Enrich with user names
		$slides = $this->enrichWithUserNames( $slides );

		// Build result
		$result = [
			'slides' => $slides,
			'total' => $total,
		];

		// Add continue token if there are more results
		if ( $offset + $limit < $total ) {
			$result['continue'] = $offset + $limit;
		}

		$this->getResult()->addValue( null, $this->getModuleName(), $result, ApiResult::NO_SIZE_CHECK );
	}

	/**
	 * Enrich slides with user names from user IDs.
	 *
	 * @param array $slides Array of slide data
	 * @return array Slides with user names added
	 */
	private function enrichWithUserNames( array $slides ): array {
		if ( empty( $slides ) ) {
			return $slides;
		}

		// Collect unique user IDs
		$userIds = [];
		foreach ( $slides as $slide ) {
			if ( isset( $slide['createdById'] ) && $slide['createdById'] > 0 ) {
				$userIds[$slide['createdById']] = true;
			}
			if ( isset( $slide['modifiedById'] ) && $slide['modifiedById'] > 0 ) {
				$userIds[$slide['modifiedById']] = true;
			}
		}

		if ( empty( $userIds ) ) {
			return $slides;
		}

		// Batch fetch user names
		$userFactory = MediaWikiServices::getInstance()->getUserFactory();
		$userNames = [];
		foreach ( array_keys( $userIds ) as $userId ) {
			$user = $userFactory->newFromId( $userId );
			if ( $user ) {
				$userNames[$userId] = $user->getName();
			}
		}

		// Enrich slides
		foreach ( $slides as &$slide ) {
			if ( isset( $slide['createdById'] ) && isset( $userNames[$slide['createdById']] ) ) {
				$slide['createdBy'] = $userNames[$slide['createdById']];
			}
			if ( isset( $slide['modifiedById'] ) && isset( $userNames[$slide['modifiedById']] ) ) {
				$slide['modifiedBy'] = $userNames[$slide['modifiedById']];
			}
		}

		return $slides;
	}

	/**
	 * Get the LayersDatabase service.
	 *
	 * @return \MediaWiki\Extension\Layers\Database\LayersDatabase
	 */
	private function getLayersDatabase() {
		return MediaWikiServices::getInstance()->get( 'LayersDatabase' );
	}

	/**
	 * Get logger instance.
	 *
	 * @return LoggerInterface
	 */
	private function getLogger(): LoggerInterface {
		if ( !$this->logger ) {
			$this->logger = MediaWikiServices::getInstance()->get( 'LayersLogger' );
		}
		return $this->logger;
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'prefix' => [
				self::PARAM_TYPE => 'string',
				self::PARAM_DFLT => '',
			],
			'limit' => [
				self::PARAM_TYPE => 'limit',
				self::PARAM_DFLT => LayersConstants::API_LIST_DEFAULT_LIMIT,
				self::PARAM_MIN => LayersConstants::API_LIST_MIN_LIMIT,
				self::PARAM_MAX => LayersConstants::API_LIST_MAX_LIMIT,
				self::PARAM_MAX2 => LayersConstants::API_LIST_MAX_LIMIT,
			],
			'offset' => [
				self::PARAM_TYPE => 'integer',
				self::PARAM_DFLT => 0,
				self::PARAM_MIN => 0,
			],
			'sort' => [
				self::PARAM_TYPE => [ 'name', 'created', 'modified' ],
				self::PARAM_DFLT => 'name',
			],
			'continue' => [
				self::PARAM_TYPE => 'string',
				self::PARAM_HELP_MSG => 'api-help-param-continue',
			],
		];
	}

	/**
	 * @inheritDoc
	 */
	protected function getExamplesMessages() {
		return [
			'action=layerslist'
				=> 'apihelp-layerslist-example-list',
			'action=layerslist&prefix=Process&limit=10'
				=> 'apihelp-layerslist-example-search',
			'action=layerslist&sort=modified&limit=20'
				=> 'apihelp-layerslist-example-recent',
		];
	}

	/**
	 * @inheritDoc
	 */
	public function getHelpUrls() {
		return 'https://www.mediawiki.org/wiki/Extension:Layers/API#layerslist';
	}
}
