<?php

/**
 * API module for retrieving layer information
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use ApiMain;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\MediaWikiServices;

class ApiLayersInfo extends ApiBase
{
    /**
     * Constructor
     *
     * @param ApiMain $main The main API instance
     * @param string $action The action name for this module
     */
    public function __construct(ApiMain $main, $action)
    {
        parent::__construct($main, $action);
    }

    /**
     * Execute the API request
     *
     * @throws \ApiUsageException When file is not found or other errors occur
     */
    public function execute()
    {
        // Get parameters
        $params = $this->extractRequestParams();
        $filename = $params['filename'];
        $layerSetId = $params['layersetid'] ?? null;

        // Get file information
        $repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
        $file = $repoGroup->findFile($filename);
        if (!$file || !$file->exists()) {
            $this->dieWithError('layers-file-not-found', 'filenotfound');
        }

        // Capture original image dimensions for client-side scaling
        $origWidth = method_exists($file, 'getWidth') ? (int)$file->getWidth() : null;
        $origHeight = method_exists($file, 'getHeight') ? (int)$file->getHeight() : null;

        $db = new LayersDatabase();

        if ($layerSetId) {
            // Get specific layer set
            $layerSet = $db->getLayerSet($layerSetId);
            if (!$layerSet) {
                $this->dieWithError($this->msg('layers-layerset-not-found'), 'layersetnotfound');
            }

            // Enrich with base dimensions to allow correct scaling by clients
            if (is_array($layerSet)) {
                $layerSet['baseWidth'] = $origWidth;
                $layerSet['baseHeight'] = $origHeight;
            }

            $result = [
                'layerset' => $layerSet
            ];
        } else {
            // Get latest layer set for this file
            $layerSet = $db->getLatestLayerSet($file->getName(), $file->getSha1());

            if (!$layerSet) {
                $result = [
                    'layerset' => null,
                    'message' => $this->msg('layers-no-layers')->text()
                ];
            } else {
                // Enrich with base dimensions to allow correct scaling by clients
                if (is_array($layerSet)) {
                    $layerSet['baseWidth'] = $origWidth;
                    $layerSet['baseHeight'] = $origHeight;
                }
                $result = [
                    'layerset' => $layerSet
                ];
            }

            // Also get list of all layer sets for this file
            $allLayerSets = $db->getLayerSetsForImage($file->getName(), $file->getSha1());
            // Enrich with user names for display convenience - batch lookup to avoid N+1 queries
            try {
                $userFactory = MediaWikiServices::getInstance()->getUserFactory();

                // Collect all unique user IDs
                $userIds = [];
                foreach ($allLayerSets as $row) {
                    $userId = (int)( $row['ls_user_id'] ?? 0 );
                    if ($userId > 0) {
                        $userIds[] = $userId;
                    }
                }

                // Batch load users
                $users = [];
                if (!empty($userIds)) {
                    $userIds = array_unique($userIds);
                    $loadedUsers = $userFactory->newFromIds($userIds);
                    foreach ($loadedUsers as $user) {
                        if ($user && $user->getId() > 0) {
                            $users[$user->getId()] = $user->getName();
                        }
                    }
                }

                // Apply user names to layer sets
                foreach ($allLayerSets as &$row) {
                    $userId = (int)( $row['ls_user_id'] ?? 0 );
                    $row['ls_user_name'] = $users[$userId] ?? 'Anonymous';
                }
                unset($row);
            } catch (\Throwable $e) {
                // If user lookup fails in some environments, proceed without names
                // Log the error for debugging
                if (class_exists('\\MediaWiki\\Logger\\LoggerFactory')) {
                    $logger = \call_user_func([ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers');
                    $logger->warning('Failed to batch load user names for layer sets: ' . $e->getMessage());
                }
            }
            $result['all_layersets'] = $allLayerSets;
        }

        $this->getResult()->addValue(null, $this->getModuleName(), $result);
    }

    /**
     * Get allowed parameters for this API module
     *
     * @return array Array of parameter definitions for filename and layersetid
     */
    public function getAllowedParams()
    {
        return [
            'filename' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => true,
            ],
            'layersetid' => [
                ApiBase::PARAM_TYPE => 'integer',
                ApiBase::PARAM_REQUIRED => false,
            ],
        ];
    }

    /**
     * Get example messages for this API module
     *
     * @return array Array of example API calls with message keys
     */
    public function getExamplesMessages()
    {
        return [
            'action=layersinfo&filename=Example.jpg'
                => 'apihelp-layersinfo-example-1',
            'action=layersinfo&filename=Example.jpg&layersetid=123'
                => 'apihelp-layersinfo-example-2',
        ];
    }
}
