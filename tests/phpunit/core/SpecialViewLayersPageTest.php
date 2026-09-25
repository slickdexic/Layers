<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\SpecialPages\SpecialViewLayersPage;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use ReflectionProperty;
use RequestContext;
use TestLogger;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Native request, denial, cache-header, and exception-shielding tests
 * for the guarded SpecialViewLayersPage entry point.
 *
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialViewLayersPage
 * @group Database
 */
class SpecialViewLayersPageTest extends \MediaWiki\Tests\Api\ApiTestCase {

	public function testRegisteredEntryResolvesCanonicalAliasAndRetainsRestrictedAuthority(): void {
		$factory = $this->getServiceContainer()->getSpecialPageFactory();
		$entry = $factory->getPage( 'ViewLayersPage' );
		$this->assertInstanceOf( SpecialViewLayersPage::class, $entry );
		$this->assertSame( 'Special:ViewLayersPage', $entry->getPageTitle()->getPrefixedDBkey() );

		// Canonical alias resolution
		$resolved = $factory->resolveAlias( 'ViewLayersPage' );
		$this->assertSame( 'ViewLayersPage', $resolved[0] );
		$this->assertSame(
			'Special:ViewLayersPage',
			$factory->getTitleForAlias( 'ViewLayersPage' )->getPrefixedDBkey()
		);

		// Authority spy: verify original Authority is forwarded directly to prepareViewer
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->getTestUser()->getUser() );
		$pilot = $this->createMock( PageOwnedPilot::class );
		$pilot->expects( $this->once() )->method( 'prepareViewer' )
			->with( 'Owner', 12, 'presentation', $this->identicalTo( $authority ) )
			->willThrowException( new \DomainException( 'layers-revision-unavailable' ) );

		$page = new SpecialViewLayersPage( $pilot );
		$context = $this->newPageContext( $authority, [
			'owner' => 'Owner',
			'revid' => '12',
			'surface' => 'presentation',
		] );
		$page->setContext( $context );
		$page->execute( null );

		$this->assertArrayNotHasKey( 'wgLayersRevisionView', $context->getOutput()->getJsConfigVars() );
		$this->assertStringContainsString(
			$page->msg( 'layers-revision-unavailable' )->text(),
			$context->getOutput()->getHTML()
		);
	}

	public function testAuthorizedHistoricalRevisionViewingAndMetadataShape(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$author = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $author, [ 'read', 'edit', 'editlayers', 'createpage' ] );

		$doc1 = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Historical Slide 1',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1,
					],
					'layers' => [
						[
							'id' => 'text-1',
							'type' => 'text',
							'x' => 10,
							'y' => 20,
							'text' => 'First historical slide text',
						],
					],
					'readingOrder' => [ 'text-1' ],
				],
			],
		];
		$doc2 = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Updated Slide 2',
					'canvas' => [
						'width' => 1024,
						'height' => 768,
						'backgroundColor' => '#204060',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1,
					],
					'layers' => [
						[
							'id' => 'text-1',
							'type' => 'text',
							'x' => 15,
							'y' => 25,
							'text' => 'Second revised slide text',
						],
					],
					'readingOrder' => [ 'text-1' ],
				],
			],
		];

		$params1 = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => json_encode( $doc1 ),
			'maintext' => 'Initial wikitext content',
			'summary' => 'Publish revision 1',
		];
		$rev1 = $this->doApiRequestWithToken( $params1, null, $author )[0]['layerspublish']['revid'];

		$params2 = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => $rev1,
			'data' => json_encode( $doc2 ),
			'maintext' => 'Updated wikitext content',
			'summary' => 'Publish revision 2',
		];
		$rev2 = $this->doApiRequestWithToken( $params2, null, $author )[0]['layerspublish']['revid'];

		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$r1Before = $lookup->getRevisionById( $rev1 );
		$r2Before = $lookup->getRevisionById( $rev2 );
		$this->assertNotNull( $r1Before );
		$this->assertNotNull( $r2Before );

		// Create a registered reader user with only 'read' right (lacking 'edit' and 'editlayers')
		$reader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$this->assertFalse( $reader->isAllowed( 'edit' ) );
		$this->assertFalse( $reader->isAllowed( 'editlayers' ) );

		$entry = $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'ViewLayersPage' );
		$this->assertInstanceOf( SpecialViewLayersPage::class, $entry );

		$context = $this->newPageContext( $reader, [
			'owner' => $title->getPrefixedText(),
			'revid' => (string)$rev1,
			'surface' => 'presentation',
		] );
		$entry->setContext( $context );
		$entry->execute( null );

		$out = $context->getOutput();

		// Page title
		$this->assertSame( $entry->msg( 'layers-page-history-title' )->text(), $out->getPageTitle() );

		// Config vars: wgLayersRevisionView
		$configVars = $out->getJsConfigVars();
		$this->assertArrayHasKey( 'wgLayersRevisionView', $configVars );
		$viewData = $configVars['wgLayersRevisionView'];
		$this->assertSame( [ 'owner', 'revisionId', 'surface' ], array_keys( $viewData ) );
		$this->assertSame( $title->getPrefixedDBkey(), $viewData['owner'] );
		$this->assertSame( $rev1, $viewData['revisionId'] );
		$this->assertSame( 'presentation', $viewData['surface']['id'] );
		$this->assertSame( 'First historical slide text', $viewData['surface']['layers'][0]['text'] );
		$this->assertNotSame( 'Second revised slide text', $viewData['surface']['layers'][0]['text'] );

		// Strict omission of editor config and draft metadata
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $configVars );
		$this->assertArrayNotHasKey( 'draftScope', $viewData );
		$this->assertArrayNotHasKey( 'readOnly', $viewData );
		$this->assertArrayNotHasKey( 'autoCreate', $viewData );
		$this->assertArrayNotHasKey( 'canvasWidth', $viewData );
		$this->assertArrayNotHasKey( 'sourceUrl', $viewData );
		$this->assertArrayNotHasKey( 'token', $viewData );

		// Modules
		$this->assertContains( 'ext.layers.history', $out->getModules() );
		$this->assertNotContains( 'ext.layers.editor', $out->getModules() );

		// HTML container
		$this->assertStringContainsString( 'id="layers-history-container"', $out->getHTML() );
		$this->assertStringNotContainsString( 'layers-editor-container', $out->getHTML() );

		// History invariance: GET did not alter page revisions or snapshot contents
		$r1After = $lookup->getRevisionById( $rev1 );
		$r2After = $lookup->getRevisionById( $rev2 );
		$this->assertSame( $r1Before->getId(), $r1After->getId() );
		$this->assertSame( $r1Before->getTimestamp(), $r1After->getTimestamp() );
		$this->assertSame( $r2Before->getId(), $r2After->getId() );
		$this->assertSame( $r2Before->getTimestamp(), $r2After->getTimestamp() );
	}

	public function testRequestRejectionBoundariesAndParameterValidation(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$foreignTitle = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey(), $foreignTitle->getPrefixedDBkey() ] );
		$author = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $author, [ 'read', 'edit', 'editlayers', 'createpage' ] );

		$fixtureJson = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$paramsValid = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Historical viewer page content',
		];
		$validRevId = $this->doApiRequestWithToken( $paramsValid, null, $author )[0]['layerspublish']['revid'];

		$paramsForeign = [
			'action' => 'layerspublish',
			'owner' => $foreignTitle->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Foreign page content',
		];
		$foreignRevId = $this->doApiRequestWithToken( $paramsForeign, null, $author )[0]['layerspublish']['revid'];

		$reader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );

		$xssOwner = '<script>alert("xss-owner")</script>';
		$xssSurface = '<img src=x onerror=alert("xss-surface")>';

		$rejectionCases = [
			'missing-owner' => [
				'params' => [ 'revid' => (string)$validRevId, 'surface' => 'presentation' ],
				'subPage' => null,
				'payload' => null,
			],
			'raw-array-owner' => [
				'params' => [
					'owner' => [ 'bad', 'owner' ],
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => null,
				'payload' => null,
			],
			'xss-markup-owner' => [
				'params' => [ 'owner' => $xssOwner, 'revid' => (string)$validRevId, 'surface' => 'presentation' ],
				'subPage' => null,
				'payload' => $xssOwner,
			],
			'missing-surface' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => (string)$validRevId ],
				'subPage' => null,
				'payload' => null,
			],
			'raw-array-surface' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => [ 'bad', 'surface' ],
				],
				'subPage' => null,
				'payload' => null,
			],
			'xss-markup-surface' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => $xssSurface,
				],
				'subPage' => null,
				'payload' => $xssSurface,
			],
			'missing-surface-id' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => 'nonexistent_surface',
				],
				'subPage' => null,
				'payload' => null,
			],
			'missing-revid' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'surface' => 'presentation' ],
				'subPage' => null,
				'payload' => null,
			],
			'raw-array-revid' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => [ '1' ],
					'surface' => 'presentation',
				],
				'subPage' => null,
				'payload' => null,
			],
			'revid-coercion-zero' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '0', 'surface' => 'presentation' ],
				'subPage' => null,
				'payload' => null,
			],
			'revid-coercion-negative' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '-1', 'surface' => 'presentation' ],
				'subPage' => null,
				'payload' => null,
			],
			'revid-coercion-float' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '1.5', 'surface' => 'presentation' ],
				'subPage' => null,
				'payload' => null,
			],
			'revid-coercion-trailing-chars' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '12junk', 'surface' => 'presentation' ],
				'subPage' => null,
				'payload' => null,
			],
			'revid-coercion-oversized' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => '2147483648',
					'surface' => 'presentation',
				],
				'subPage' => null,
				'payload' => null,
			],
			'revid-coercion-empty' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '', 'surface' => 'presentation' ],
				'subPage' => null,
				'payload' => null,
			],
			'unsupported-subpage' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => 'subpath',
				'payload' => null,
			],
			'out-of-scope-owner' => [
				'params' => [
					'owner' => $this->getNonexistingTestPage()->getTitle()->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => null,
				'payload' => null,
			],
			'foreign-revision' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$foreignRevId,
					'surface' => 'presentation',
				],
				'subPage' => null,
				'payload' => null,
			],
		];

		foreach ( $rejectionCases as $caseName => $caseData ) {
			$context = $this->newPageContext( $reader, $caseData['params'] );
			$entry = new SpecialViewLayersPage( $pilot );
			$entry->setContext( $context );
			$entry->execute( $caseData['subPage'] );

			$out = $context->getOutput();
			$this->assertArrayNotHasKey(
				'wgLayersRevisionView',
				$out->getJsConfigVars(),
				"Rejection case [{$caseName}] must not emit wgLayersRevisionView"
			);
			$this->assertArrayNotHasKey(
				'wgLayersEditorInit',
				$out->getJsConfigVars(),
				"Rejection case [{$caseName}] must not emit wgLayersEditorInit"
			);
			$this->assertNotContains(
				'ext.layers.history',
				$out->getModules(),
				"Rejection case [{$caseName}] must not add ext.layers.history module"
			);
			$this->assertNotContains(
				'ext.layers.editor',
				$out->getModules(),
				"Rejection case [{$caseName}] must not add ext.layers.editor module"
			);
			$this->assertStringNotContainsString(
				'layers-history-container',
				$out->getHTML(),
				"Rejection case [{$caseName}] must not emit layers-history-container"
			);
			$this->assertStringNotContainsString(
				'layers-editor-container',
				$out->getHTML(),
				"Rejection case [{$caseName}] must not emit layers-editor-container"
			);

			if ( $caseData['payload'] !== null ) {
				$this->assertStringNotContainsString(
					$caseData['payload'],
					$out->getHTML(),
					"Rejection case [{$caseName}] must not reflect literal injection payload in HTML"
				);
				$this->assertStringNotContainsString(
					$caseData['payload'],
					json_encode( $out->getJsConfigVars() ),
					"Rejection case [{$caseName}] must not reflect literal injection payload in config"
				);
			}

			$this->assertStringContainsString(
				$entry->msg( 'layers-revision-unavailable' )->text(),
				$out->getHTML(),
				"Rejection case [{$caseName}] must display fixed layers-revision-unavailable message"
			);
		}

		// Additional rejection cases: disabled pilot
		$disabledPilot = new PageOwnedPilot( $this->getServiceContainer(), false, [ $title->getPrefixedDBkey() ] );
		$contextDisabled = $this->newPageContext( $reader, [
			'owner' => $title->getPrefixedText(),
			'revid' => (string)$validRevId,
			'surface' => 'presentation',
		] );
		$entryDisabled = new SpecialViewLayersPage( $disabledPilot );
		$entryDisabled->setContext( $contextDisabled );
		$entryDisabled->execute( null );
		$outDisabled = $contextDisabled->getOutput();
		$this->assertArrayNotHasKey( 'wgLayersRevisionView', $outDisabled->getJsConfigVars() );
		$this->assertStringContainsString(
			$entryDisabled->msg( 'layers-revision-unavailable' )->text(),
			$outDisabled->getHTML()
		);

		// Additional rejection case: denied page read permission
		$this->overrideConfigValue( 'GroupPermissions', [ '*' => [ 'read' => false ] ] );
		$deniedReader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $deniedReader, [] );
		$contextDenied = $this->newPageContext( $deniedReader, [
			'owner' => $title->getPrefixedText(),
			'revid' => (string)$validRevId,
			'surface' => 'presentation',
		] );
		$entryDenied = new SpecialViewLayersPage( $pilot );
		$entryDenied->setContext( $contextDenied );
		$entryDenied->execute( null );
		$outDenied = $contextDenied->getOutput();
		$this->assertArrayNotHasKey( 'wgLayersRevisionView', $outDenied->getJsConfigVars() );
		$this->assertStringContainsString(
			$entryDenied->msg( 'layers-revision-unavailable' )->text(),
			$outDenied->getHTML()
		);

		// Additional rejection case: hidden revision text (DELETED_TEXT without deletedtext permission)
		$this->assertFalse( $reader->isAllowed( 'deletedtext' ) );
		$dbr = $this->getDb();
		$dbr->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $validRevId ] )
			->caller( __METHOD__ )->execute();

		$contextHidden = $this->newPageContext( $reader, [
			'owner' => $title->getPrefixedText(),
			'revid' => (string)$validRevId,
			'surface' => 'presentation',
		] );
		$entryHidden = new SpecialViewLayersPage( $pilot );
		$entryHidden->setContext( $contextHidden );
		$entryHidden->execute( null );
		$outHidden = $contextHidden->getOutput();
		$this->assertArrayNotHasKey( 'wgLayersRevisionView', $outHidden->getJsConfigVars() );
		$this->assertStringContainsString(
			$entryHidden->msg( 'layers-revision-unavailable' )->text(),
			$outHidden->getHTML()
		);

		// Restore revision visibility
		$dbr->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $validRevId ] )
			->caller( __METHOD__ )->execute();
	}

	public function testCacheControlAndRobotPolicyOnSuccessAndDenial(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$author = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $author, [ 'read', 'edit', 'editlayers', 'createpage' ] );

		$fixtureJson = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Cache control test page',
		];
		$validRevId = $this->doApiRequestWithToken( $params, null, $author )[0]['layerspublish']['revid'];

		$reader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );

		$scenarios = [
			'success' => [
				'owner' => $title->getPrefixedText(),
				'revid' => (string)$validRevId,
				'surface' => 'presentation',
			],
			'denial-invalid-rev' => [
				'owner' => $title->getPrefixedText(),
				'revid' => '0',
				'surface' => 'presentation',
			],
			'denial-out-of-scope' => [
				'owner' => 'Unconfigured_Page',
				'revid' => (string)$validRevId,
				'surface' => 'presentation',
			],
		];

		foreach ( $scenarios as $scenario => $paramsToTest ) {
			$context = $this->newPageContext( $reader, $paramsToTest );
			$entry = new SpecialViewLayersPage( $pilot );
			$entry->setContext( $context );
			$entry->execute( null );

			$out = $context->getOutput();
			$out->sendCacheControl();

			$headers = $context->getRequest()->response()->getHeaders();
			$cacheControl = $headers['CACHE-CONTROL'] ?? '';
			$this->assertStringContainsString(
				'no-store',
				$cacheControl,
				"Scenario [{$scenario}] must include no-store in Cache-Control"
			);
			$this->assertStringContainsString(
				'max-age=0',
				$cacheControl,
				"Scenario [{$scenario}] must include max-age=0 in Cache-Control"
			);

			$expires = $headers['EXPIRES'] ?? '';
			$this->assertSame(
				'Thu, 01 Jan 1970 00:00:00 GMT',
				$expires,
				"Scenario [{$scenario}] must send zero-epoch Expires header"
			);

			// Inspect CDN maxage
			$cdnProp = new ReflectionProperty( $out, 'mCdnMaxage' );
			$this->assertSame(
				0,
				$cdnProp->getValue( $out ),
				"Scenario [{$scenario}] must set mCdnMaxage to 0"
			);

			// Inspect robot policy
			$this->assertSame(
				'noindex,nofollow',
				$out->getRobotPolicy(),
				"Scenario [{$scenario}] getRobotPolicy must return noindex,nofollow"
			);

			$headLinks = $out->getHeadLinksArray();
			$this->assertArrayHasKey(
				'meta-robots',
				$headLinks,
				"Scenario [{$scenario}] must contain meta-robots in head links"
			);
			$this->assertStringContainsString(
				'noindex,nofollow',
				$headLinks['meta-robots'],
				"Scenario [{$scenario}] meta-robots must contain noindex,nofollow"
			);
		}
	}

	public function testFaultInjectionAndExceptionShielding(): void {
		$reader = $this->getTestUser()->getUser();
		$validParams = [
			'owner' => 'Test_Fault_Injection_Owner',
			'revid' => '1',
			'surface' => 'presentation',
		];

		// 1. DomainException with diagnostic sentinel text
		$domainSentinel = 'DIAGNOSTIC_DOMAIN_VIEWER_' . wfRandomString( 8 );
		$pilotDomain = $this->createMock( PageOwnedPilot::class );
		$pilotDomain->method( 'prepareViewer' )
			->willThrowException( new \DomainException( $domainSentinel ) );

		$contextDomain = $this->newPageContext( $reader, $validParams );
		$entryDomain = new SpecialViewLayersPage( $pilotDomain );
		$entryDomain->setContext( $contextDomain );
		$entryDomain->execute( null );

		$outDomain = $contextDomain->getOutput();
		$this->assertStringNotContainsString(
			$domainSentinel,
			$outDomain->getHTML(),
			'DomainException diagnostic sentinel must not leak into HTML'
		);
		$this->assertStringNotContainsString(
			$domainSentinel,
			json_encode( $outDomain->getJsConfigVars() ),
			'DomainException diagnostic sentinel must not leak into config'
		);
		$this->assertArrayNotHasKey( 'wgLayersRevisionView', $outDomain->getJsConfigVars() );
		$this->assertNotContains( 'ext.layers.history', $outDomain->getModules() );
		$this->assertStringNotContainsString( 'layers-history-container', $outDomain->getHTML() );
		$this->assertStringContainsString(
			$entryDomain->msg( 'layers-revision-unavailable' )->text(),
			$outDomain->getHTML()
		);

		// 2. Unexpected RuntimeException with diagnostic sentinel text and log capture
		$unexpectedSentinel = 'DIAGNOSTIC_UNEXPECTED_VIEWER_' . wfRandomString( 8 );
		$unexpectedException = new \RuntimeException( $unexpectedSentinel );
		$pilotUnexpected = $this->createMock( PageOwnedPilot::class );
		$pilotUnexpected->method( 'prepareViewer' )
			->willThrowException( $unexpectedException );

		$logger = new TestLogger( true, null, true );
		$this->setLogger( 'Layers', $logger );

		$contextUnexpected = $this->newPageContext( $reader, $validParams );
		$entryUnexpected = new SpecialViewLayersPage( $pilotUnexpected );
		$entryUnexpected->setContext( $contextUnexpected );
		$entryUnexpected->execute( null );

		$outUnexpected = $contextUnexpected->getOutput();
		$this->assertStringNotContainsString(
			$unexpectedSentinel,
			$outUnexpected->getHTML(),
			'Unexpected exception sentinel must not leak into HTML'
		);
		$this->assertStringNotContainsString(
			$unexpectedSentinel,
			json_encode( $outUnexpected->getJsConfigVars() ),
			'Unexpected exception sentinel must not leak into config'
		);
		$this->assertArrayNotHasKey( 'wgLayersRevisionView', $outUnexpected->getJsConfigVars() );
		$this->assertNotContains( 'ext.layers.history', $outUnexpected->getModules() );
		$this->assertStringNotContainsString( 'layers-history-container', $outUnexpected->getHTML() );
		$this->assertStringContainsString(
			$entryUnexpected->msg( 'layers-revision-unavailable' )->text(),
			$outUnexpected->getHTML()
		);

		// Assert server-side error logging captured the unexpected exception
		$buffer = $logger->getBuffer();
		$foundLog = false;
		foreach ( $buffer as [ $level, $message, $context ] ) {
			if ( $level === 'error' &&
				$message === 'Page-owned historical view initialization failed.' &&
				isset( $context['exception'] ) &&
				$context['exception'] === $unexpectedException
			) {
				$foundLog = true;
				break;
			}
		}
		$this->assertTrue(
			$foundLog,
			'Unexpected exception must be logged to Layers channel with error level and exception context'
		);
	}

	private function configure( bool $enabled, array $keys ): PageOwnedPilot {
		$this->overrideConfigValues( [
			'LayersPageOwnedPilotEnabled' => $enabled,
			'LayersPageOwnedPilotOwners' => $keys,
		] );
		$s = $this->getServiceContainer();
		$pilot = null;
		$this->overrideConfigValue( 'APIModules', $s->getMainConfig()->get( 'APIModules' ) + [
			'layerspublish' => [
				'class' => ApiLayersPublish::class,
				'factory' => static function ( $main, $name ) use ( &$pilot ) {
					return $pilot->newPublishApi( $main, $name );
				},
			],
			'layersread' => [
				'class' => ApiLayersRead::class,
				'factory' => static function ( $main, $name ) use ( &$pilot ) {
					return $pilot->newReadApi( $main, $name );
				},
			],
		] );
		TestingAdmissionRegistration::install( $this );
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->setTemporaryHook( 'MultiContentSave', $pilot->newAdmissionHooks(), true );
		return $pilot;
	}

	private function newPageContext( Authority $authority, array $params ): RequestContext {
		$context = new RequestContext();
		$context->setAuthority( $authority );
		$context->setTitle(
			$this->getServiceContainer()->getTitleFactory()->newFromText( 'Special:ViewLayersPage' )
		);
		$context->setRequest( new FauxRequest( $params, false ) );
		return $context;
	}
}
