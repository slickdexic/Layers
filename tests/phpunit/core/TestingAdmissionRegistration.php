<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler;
use MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWikiIntegrationTestCase;

/**
 * Isolated test-only registration helper for core integration tests.
 *
 * Installs custom content model, slot role, single-use admission context,
 * and MultiContentSave admission hook into the isolated test container.
 * Teardown is automatically managed by MediaWikiIntegrationTestCase.
 */
class TestingAdmissionRegistration {

	/**
	 * Install admission components in the isolated test environment.
	 *
	 * @param MediaWikiIntegrationTestCase $testCase
	 * @param ?PublicationAdmissionContext $context
	 * @param ?SourceVersionResolver $sources
	 * @return array
	 */
	public static function install(
		MediaWikiIntegrationTestCase $testCase,
		?PublicationAdmissionContext $context = null,
		?SourceVersionResolver $sources = null
	): array {
		$installer = \Closure::bind(
			static function (
				MediaWikiIntegrationTestCase $tc,
				?PublicationAdmissionContext $ctx,
				?SourceVersionResolver $src
			): array {
				$services = $tc->getServiceContainer();

				if ( !$services->getContentHandlerFactory()->isDefinedModel( LayersDocumentContent::MODEL ) ) {
					$services->getContentHandlerFactory()->defineContentHandler(
						LayersDocumentContent::MODEL,
						LayersDocumentContentHandler::class
					);
				}

				if ( !$services->getSlotRoleRegistry()->isDefinedRole( PageRevisionWriter::SLOT ) ) {
					$services->getSlotRoleRegistry()->defineRoleWithModel(
						PageRevisionWriter::SLOT,
						LayersDocumentContent::MODEL,
						[ 'display' => 'none' ],
						false
					);
				}

				$ctx = $ctx ?? new PublicationAdmissionContext();
				$hooks = new PageOwnedAdmissionHooks( $ctx, $services->getRevisionLookup() );

				$tc->setTemporaryHook( 'MultiContentSave', $hooks, true );

				$resolver = $src ?? new SourceVersionResolver(
					$services->getRepoGroup()->getLocalRepo(),
					$services->getTitleFactory()
				);

				$publisher = new PagePublicationService(
					$services->getWikiPageFactory(),
					new PageHistoryAccess( $services->getRevisionLookup() ),
					$resolver,
					new PageRevisionWriter(),
					$ctx
				);

				return [
					'context' => $ctx,
					'hooks' => $hooks,
					'publisher' => $publisher,
				];
			},
			null,
			MediaWikiIntegrationTestCase::class
		);

		return $installer( $testCase, $context, $sources );
	}
}
