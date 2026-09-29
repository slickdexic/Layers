<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use ReflectionProperty;
use RequestContext;
use TestLogger;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Native request, denial, cache-header, and exception-shielding tests
 * for the guarded SpecialEditLayersPage entry point.
 *
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage
 * @group Database
 */
class SpecialEditLayersPageTest extends \MediaWiki\Tests\Api\ApiTestCase {
	public function testMalformedBoundRequestCannotFallBackToOwnerRoute(): void {
		$pilot = $this->createMock( PageOwnedPilot::class );
		$pilot->expects( $this->never() )->method( 'prepareBoundEditor' );
		$pilot->expects( $this->never() )->method( 'prepareEditor' );
		$pilot->expects( $this->never() )->method( 'prepareCurrentEditor' );
		$valid = [ 'pageid' => '1', 'revid' => '12', 'start' => '0', 'expected' => '{{#Slide:A}}' ];
		$cases = [
			[ 'pageid' => '01' ], [ 'pageid' => [ '1' ] ], [ 'pageid' => '2147483648' ],
			[ 'revid' => 'current' ], [ 'revid' => '12junk' ], [ 'revid' => [ '12' ] ],
			[ 'start' => '-1' ], [ 'start' => '00' ], [ 'start' => '1.5' ], [ 'start' => [ '0' ] ],
			[ 'expected' => '' ], [ 'expected' => [ 'source' ] ],
			[ 'owner' => 'Owner' ], [ 'surface' => 'presentation' ]
		];
		foreach ( $cases as $changes ) {
			$context = $this->newPageContext( $this->getTestUser()->getUser(), array_replace( $valid, $changes ) );
			$entry = new SpecialEditLayersPage( $pilot );
			$entry->setContext( $context );
			$entry->execute( null );
			$this->assertArrayNotHasKey( 'wgLayersEditorInit', $context->getOutput()->getJsConfigVars() );
			$this->assertNotContains( 'ext.layers.editor', $context->getOutput()->getModules() );
		}
	}

	public function testCurrentEntryFollowsNewSavesButNumericEntryRemainsExact(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
		$snapshot = json_decode(
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$revision = 0;
		$first = null;
		foreach ( [ 'First drawing', 'Second drawing' ] as $text ) {
			$snapshot['surfaces'][0]['layers'][0]['text'] = $text;
			$result = $this->doApiRequestWithToken( [
				'action' => 'layerspublish', 'owner' => $title->getPrefixedText(),
				'baserevid' => $revision, 'data' => json_encode( $snapshot ), 'maintext' => 'Current entry test'
			], null, $actor );
			$revision = $result[0]['layerspublish']['revid'];
			$first ??= $revision;
			$entry = new SpecialEditLayersPage( $pilot );
			$context = $this->newPageContext( $actor, [
				'owner' => $title->getPrefixedText(), 'surface' => 'presentation', 'revid' => 'current'
			] );
			$entry->setContext( $context );
			$entry->execute( null );
			$init = $context->getOutput()->getJsConfigVars()['wgLayersEditorInit'];
			$this->assertSame( $revision, $init['pageOwned']['revisionId'] );
		}
		$context = $this->newPageContext( $actor, [
			'owner' => $title->getPrefixedText(), 'surface' => 'presentation', 'revid' => (string)$first
		] );
		$entry->setContext( $context );
		$entry->execute( null );
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $context->getOutput()->getJsConfigVars() );
		$this->overrideUserPermissions( $actor, [ 'read' ] );
		$context = $this->newPageContext( $actor, [
			'owner' => $title->getPrefixedText(), 'surface' => 'presentation', 'revid' => 'current'
		] );
		$entry->setContext( $context );
		$entry->execute( null );
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $context->getOutput()->getJsConfigVars() );
	}

	public function testRegisteredEntryRetainsRestrictedRequestAuthority(): void {
		$entry = $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'EditLayersPage' );
		$this->assertInstanceOf( SpecialEditLayersPage::class, $entry );
		$this->assertSame( 'Special:EditLayersPage', $entry->getPageTitle()->getPrefixedDBkey() );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->getTestUser()->getUser() );
		$pilot = $this->createMock( PageOwnedPilot::class );
		$pilot->expects( $this->once() )->method( 'prepareEditor' )
			->with( 'Owner', 12, 'presentation', $this->identicalTo( $authority ) )
			->willThrowException( new \DomainException( 'denied' ) );
		$entry = new SpecialEditLayersPage( $pilot );
		$context = $this->newPageContext( $authority,
			[ 'owner' => 'Owner', 'revid' => '12', 'surface' => 'presentation' ] );
		$entry->setContext( $context );
		$entry->execute( null );
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $context->getOutput()->getJsConfigVars() );
	}

	private function configure( bool $enabled, array $keys ): PageOwnedPilot {
		// Only the listed titles may start drawings; pages that own drawings always take part (D2).
		$this->setService( 'LayersPageOwnedPilot',
			static fn ( $services ) => new PageOwnedPilot( $services, $enabled ? $keys : [] ) );
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

	private function newPageContext( Authority $user, array $params ): RequestContext {
		$context = new RequestContext();
		$context->setAuthority( $user );
		$context->setTitle(
			$this->getServiceContainer()->getTitleFactory()->newFromText( 'Special:EditLayersPage' )
		);
		$context->setRequest( new FauxRequest( $params, false ) );
		return $context;
	}

	public function testRequestRejectionAndInjectionProtection(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Injection protection test',
		];
		$validRevId = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];

		$xssOwner = '<script>alert("xss-owner")</script>';
		$xssSurface = '<img src=x onerror=alert("xss-surface")>';

		$rejectionCases = [
			'missing-owner' => [
				'params' => [ 'revid' => (string)$validRevId, 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => null,
			],
			'raw-array-owner' => [
				'params' => [
					'owner' => [ 'evil', 'array' ],
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => null,
				'malformed' => null,
			],
			'xss-markup-owner' => [
				'params' => [ 'owner' => $xssOwner, 'revid' => (string)$validRevId, 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => $xssOwner,
			],
			'fragment-owner' => [
				'params' => [
					'owner' => $title->getPrefixedText() . '#frag',
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => null,
				'malformed' => '#frag',
			],
			'invalid-bracket-owner' => [
				'params' => [
					'owner' => 'Invalid[]Title',
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => null,
				'malformed' => 'Invalid[]Title',
			],
			'missing-surface' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => (string)$validRevId ],
				'subPage' => null,
				'malformed' => null,
			],
			'raw-array-surface' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => [ 'nested', 'surface' ],
				],
				'subPage' => null,
				'malformed' => null,
			],
			'empty-surface' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => (string)$validRevId, 'surface' => '' ],
				'subPage' => null,
				'malformed' => null,
			],
			'xss-markup-surface' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => $xssSurface,
				],
				'subPage' => null,
				'malformed' => $xssSurface,
			],
			'missing-revid' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => null,
			],
			'raw-array-revid' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => [ 123 ],
					'surface' => 'presentation',
				],
				'subPage' => null,
				'malformed' => null,
			],
			'revid-coercion-zero' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '0', 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => null,
			],
			'revid-coercion-leading-zero' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '01', 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => null,
			],
			'revid-coercion-negative' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '-1', 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => null,
			],
			'revid-coercion-trailing-garbage' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '12junk', 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => null,
			],
			'revid-coercion-float' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '1.5', 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => null,
			],
			'revid-coercion-oversized' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => '2147483648',
					'surface' => 'presentation',
				],
				'subPage' => null,
				'malformed' => null,
			],
			'revid-coercion-empty' => [
				'params' => [ 'owner' => $title->getPrefixedText(), 'revid' => '', 'surface' => 'presentation' ],
				'subPage' => null,
				'malformed' => null,
			],
			'unsupported-subpath-simple' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => 'subpath',
				'malformed' => null,
			],
			'unsupported-subpath-nested' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => 'unsupported/nested',
				'malformed' => null,
			],
			'pilot-unrelated-owner' => [
				'params' => [
					'owner' => $this->getNonexistingTestPage()->getTitle()->getPrefixedText(),
					'revid' => (string)$validRevId,
					'surface' => 'presentation',
				],
				'subPage' => null,
				'malformed' => null,
			],
		];

		foreach ( $rejectionCases as $caseName => $caseData ) {
			$context = $this->newPageContext( $actor, $caseData['params'] );
			$entry = new SpecialEditLayersPage( $pilot );
			$entry->setContext( $context );
			$entry->execute( $caseData['subPage'] );

			$out = $context->getOutput();
			$this->assertArrayNotHasKey(
				'wgLayersEditorInit',
				$out->getJsConfigVars(),
				"Rejection case [{$caseName}] must not emit wgLayersEditorInit"
			);
			$this->assertNotContains(
				'ext.layers.editor',
				$out->getModules(),
				"Rejection case [{$caseName}] must not add ext.layers.editor module"
			);
			$this->assertStringNotContainsString(
				'layers-editor-container',
				$out->getHTML(),
				"Rejection case [{$caseName}] must not emit layers-editor-container"
			);

			if ( $caseData['malformed'] !== null ) {
				$this->assertStringNotContainsString(
					$caseData['malformed'],
					$out->getHTML(),
					"Rejection case [{$caseName}] must not reflect literal malformed/markup string in HTML"
				);
				$this->assertStringNotContainsString(
					$caseData['malformed'],
					json_encode( $out->getJsConfigVars() ),
					"Rejection case [{$caseName}] must not reflect literal malformed/markup string in config"
				);
			}

			$this->assertStringContainsString(
				$entry->msg( 'layers-editor-unavailable' )->text(),
				$out->getHTML(),
				"Rejection case [{$caseName}] must present fixed layers-editor-unavailable message"
			);
		}

		// A page that owns drawings still opens where no page may start new ones (D2).
		$emptyPilot = new PageOwnedPilot( $this->getServiceContainer(), [] );
		$contextEmpty = $this->newPageContext( $actor, [
			'owner' => $title->getPrefixedText(),
			'revid' => (string)$validRevId,
			'surface' => 'presentation',
		] );
		$entryEmpty = new SpecialEditLayersPage( $emptyPilot );
		$entryEmpty->setContext( $contextEmpty );
		$entryEmpty->execute( null );
		$outEmpty = $contextEmpty->getOutput();
		$this->assertArrayHasKey( 'wgLayersEditorInit', $outEmpty->getJsConfigVars() );
		$this->assertContains( 'ext.layers.editor', $outEmpty->getModules() );

		// Stale revision rejection: advance current page revision
		$params['baserevid'] = $validRevId;
		$params['maintext'] = 'Advanced text for stale revision test';
		$newerRevId = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $validRevId, $newerRevId );

		$contextStale = $this->newPageContext( $actor, [
			'owner' => $title->getPrefixedText(),
			'revid' => (string)$validRevId,
			'surface' => 'presentation',
		] );
		$entryStale = new SpecialEditLayersPage( $pilot );
		$entryStale->setContext( $contextStale );
		$entryStale->execute( null );
		$outStale = $contextStale->getOutput();
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $outStale->getJsConfigVars() );
		$this->assertNotContains( 'ext.layers.editor', $outStale->getModules() );
		$this->assertStringNotContainsString( 'layers-editor-container', $outStale->getHTML() );
	}

	public function testSuccessfulRequestAndPermissionDeniedNonMutation(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$author = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $author, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Success and non-mutation test content',
		];
		$revId = $this->doApiRequestWithToken( $params, null, $author )[0]['layerspublish']['revid'];

		$dbr = $this->getDb();
		$prePageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$preRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$layerSetsExists = $dbr->tableExists( 'layer_sets' );
		$preLayerSetsCount = $layerSetsExists ?
			(int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField() : 0;

		// 1. Successful request with authorized user
		$context = $this->newPageContext( $author, [
			'owner' => $title->getPrefixedText(),
			'revid' => (string)$revId,
			'surface' => 'presentation',
		] );
		$entry = new SpecialEditLayersPage( $pilot );
		$entry->setContext( $context );
		$entry->execute( null );

		$out = $context->getOutput();
		$expectedInit = $pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $author );
		$this->assertSame(
			$expectedInit,
			$out->getJsConfigVars()['wgLayersEditorInit'],
			'Successful request must forward authorized prepareEditor configuration'
		);
		$this->assertContains(
			'ext.layers.editor',
			$out->getModules(),
			'Successful request must add ext.layers.editor module'
		);
		$this->assertContains( 'ext.layers.editor.pageOwned', $out->getModules(),
			'Page-owned editing code ships only with the page-owned route' );
		$this->assertStringContainsString(
			'<div id="layers-editor-container"></div>',
			$out->getHTML(),
			'Successful request must emit editor container div'
		);
		$this->assertSame(
			$entry->getDescription()->text(),
			$out->getPageTitle(),
			'Successful request must set page title from description'
		);

		// Verify GET did not change row totals (not a full value-mutation audit).
		$postPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$postRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $prePageCount, $postPageCount, 'GET must not insert or delete page rows' );
		$this->assertSame( $preRevCount, $postRevCount, 'GET must not insert or delete revision rows' );
		if ( $layerSetsExists ) {
			$postLayerSetsCount = (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField();
			$this->assertSame( $preLayerSetsCount, $postLayerSetsCount, 'GET must not touch layer_sets table' );
		}

		// 2. Permission-denied request with user lacking editlayers
		$deniedActor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $deniedActor, [ 'read', 'edit', 'createpage' ] );

		$contextDenied = $this->newPageContext( $deniedActor, [
			'owner' => $title->getPrefixedText(),
			'revid' => (string)$revId,
			'surface' => 'presentation',
		] );
		$entryDenied = new SpecialEditLayersPage( $pilot );
		$entryDenied->setContext( $contextDenied );
		$entryDenied->execute( null );

		$outDenied = $contextDenied->getOutput();
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $outDenied->getJsConfigVars() );
		$this->assertNotContains( 'ext.layers.editor', $outDenied->getModules() );
		$this->assertStringContainsString(
			$entryDenied->msg( 'layers-editor-unavailable' )->text(),
			$outDenied->getHTML()
		);

		// Verify denial did not change page/revision row totals.
		$deniedPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$deniedRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $prePageCount, $deniedPageCount, 'Denied request must not mutate page rows' );
		$this->assertSame( $preRevCount, $deniedRevCount, 'Denied request must not mutate revision rows' );
	}

	public function testOutputPageCacheHeadersAndRobotPolicy(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Cache headers test',
		];
		$revId = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];

		// Drive native OutputPage cache-header generation for:
		// (A) Successful request
		// (B) Denied request
		$testScenarios = [
			'success' => [
				'params' => [
					'owner' => $title->getPrefixedText(),
					'revid' => (string)$revId,
					'surface' => 'presentation',
				],
			],
			'denial' => [
				'params' => [
					'owner' => 'Denied_Out_Of_Scope_Owner',
					'revid' => (string)$revId,
					'surface' => 'presentation',
				],
			],
		];

		foreach ( $testScenarios as $scenario => $scenarioData ) {
			$context = $this->newPageContext( $actor, $scenarioData['params'] );
			$entry = new SpecialEditLayersPage( $pilot );
			$entry->setContext( $context );
			$entry->execute( null );

			$out = $context->getOutput();

			// Native output generation: drive core sendCacheControl()
			$out->sendCacheControl();
			$headers = $context->getRequest()->response()->getheaders();

			$cacheControl = $headers['CACHE-CONTROL'] ?? '';
			$this->assertStringContainsString(
				'no-cache',
				$cacheControl,
				"Scenario [{$scenario}] must include no-cache in Cache-Control"
			);
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

			// Inspect CDN maxage on OutputPage
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
		$actor = $this->getTestUser()->getUser();
		$validParams = [
			'owner' => 'Test_Fault_Injection_Owner',
			'revid' => '1',
			'surface' => 'presentation',
		];

		// 1. DomainException with diagnostic sentinel text
		$domainSentinel = 'DIAGNOSTIC_DOMAIN_SENTINEL_' . wfRandomString( 8 );
		$pilotDomain = $this->createMock( PageOwnedPilot::class );
		$pilotDomain->method( 'prepareEditor' )
			->willThrowException( new \DomainException( $domainSentinel ) );

		$contextDomain = $this->newPageContext( $actor, $validParams );
		$entryDomain = new SpecialEditLayersPage( $pilotDomain );
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
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $outDomain->getJsConfigVars() );
		$this->assertNotContains( 'ext.layers.editor', $outDomain->getModules() );
		$this->assertStringNotContainsString( 'layers-editor-container', $outDomain->getHTML() );
		$this->assertStringContainsString(
			$entryDomain->msg( 'layers-editor-unavailable' )->text(),
			$outDomain->getHTML()
		);

		// 2. Unexpected RuntimeException with distinct diagnostic sentinel text and log capture
		$unexpectedSentinel = 'DIAGNOSTIC_UNEXPECTED_SENTINEL_' . wfRandomString( 8 );
		$unexpectedException = new \RuntimeException( $unexpectedSentinel );
		$pilotUnexpected = $this->createMock( PageOwnedPilot::class );
		$pilotUnexpected->method( 'prepareEditor' )
			->willThrowException( $unexpectedException );

		$logger = new TestLogger( true, null, true );
		$this->setLogger( 'Layers', $logger );

		$contextUnexpected = $this->newPageContext( $actor, $validParams );
		$entryUnexpected = new SpecialEditLayersPage( $pilotUnexpected );
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
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $outUnexpected->getJsConfigVars() );
		$this->assertNotContains( 'ext.layers.editor', $outUnexpected->getModules() );
		$this->assertStringNotContainsString( 'layers-editor-container', $outUnexpected->getHTML() );
		$this->assertStringContainsString(
			$entryUnexpected->msg( 'layers-editor-unavailable' )->text(),
			$outUnexpected->getHTML()
		);

		// Assert server-side error logging captured the unexpected exception
		$buffer = $logger->getBuffer();
		$foundLog = false;
		foreach ( $buffer as [ $level, $message, $context ] ) {
			if ( $level === 'error' &&
				$message === 'Page-owned editor initialization failed.' &&
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
}
