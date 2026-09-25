<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/**
 * Service-instance state manager for single-use publication admission scopes.
 * Not a global static flag, client parameter, persisted token or user preference.
 */
class PublicationAdmissionContext {
	private ?PublicationAdmissionIntent $activeIntent = null;
	private bool $consumed = false;

	/**
	 * Execute a callback within an exclusive, single-use admission scope.
	 * Explicitly rejects nested scopes. Guarantees cleanup in finally.
	 *
	 * @template T
	 * @param PublicationAdmissionIntent $intent
	 * @param callable():T $operation
	 * @return T
	 * @throws \LogicException On nested scope entry
	 */
	public function executeInScope( PublicationAdmissionIntent $intent, callable $operation ) {
		if ( $this->activeIntent !== null ) {
			throw new \LogicException( 'Nested publication scopes are rejected.' );
		}

		$this->activeIntent = $intent;
		$this->consumed = false;
		try {
			return $operation();
		} finally {
			$this->activeIntent = null;
			$this->consumed = false;
		}
	}

	/**
	 * Check whether an active, unconsumed admission scope exists.
	 *
	 * @return bool
	 */
	public function hasActiveScope(): bool {
		return $this->activeIntent !== null && !$this->consumed;
	}

	/**
	 * Retrieve the active intent if one is present and unconsumed.
	 *
	 * @return ?PublicationAdmissionIntent
	 */
	public function getActiveIntent(): ?PublicationAdmissionIntent {
		return $this->hasActiveScope() ? $this->activeIntent : null;
	}

	/**
	 * Mark the active admission scope as consumed.
	 * Subsequent saves within the same scope are rejected.
	 */
	public function consume(): void {
		$this->consumed = true;
	}

	/**
	 * Whether the current scope has been consumed.
	 *
	 * @return bool
	 */
	public function isConsumed(): bool {
		return $this->consumed;
	}
}
