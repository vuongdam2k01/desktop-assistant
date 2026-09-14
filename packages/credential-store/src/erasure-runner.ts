import { CredentialStoreError } from './errors.js';
import type { EntryTable } from './entry-table.js';

export type ErasureTrigger =
  | 'connector_disconnect'
  | 'sign_out'
  | 'device_revocation'
  | 'account_deletion'
  | 'uninstall';

export interface ErasureState {
  trigger: ErasureTrigger;
  scope: string | '*';
  startedAt: string;
}

export interface ErasureOutcome {
  trigger: ErasureTrigger;
  scope: string | '*';
  entriesErased: number;
  completed: boolean;
}

export type EligibleClassesProvider = (
  trigger: ErasureTrigger
) => readonly string[] | undefined;

export class ErasureRunner {
  constructor(
    private readonly entryTable: EntryTable,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly eligibleClassesProvider?: EligibleClassesProvider | undefined
  ) {}

  getPendingErasure(): ErasureState | null {
    const row = this.entryTable.getPendingErasure();
    if (!row) {
      return null;
    }
    return {
      trigger: row.trigger as ErasureTrigger,
      scope: row.scope,
      startedAt: row.started_at,
    };
  }

  resumeIfPending(): void {
    const pending = this.entryTable.getPendingErasure();
    if (!pending) {
      return;
    }

    try {
      const trigger = pending.trigger as ErasureTrigger;

      // The classes this erasure was allowed to reach were decided when it began. A launch
      // that registers a different set of classes is not entitled to narrow them, so the
      // recorded list wins and the live registry is consulted only for a marker written
      // before the list was recorded.
      let allowedClasses: readonly string[] | undefined;
      if (pending.allowed_classes) {
        allowedClasses = JSON.parse(pending.allowed_classes) as string[];
      } else if (trigger === 'connector_disconnect' && this.eligibleClassesProvider) {
        allowedClasses = this.eligibleClassesProvider('connector_disconnect');
      }

      // An allowlist that resolves to nothing erases nothing. Completing on that basis would
      // clear the marker and report a credential destroyed while it is still readable, so the
      // obligation is kept instead and the store refuses to open.
      if (trigger === 'connector_disconnect' && (!allowedClasses || allowedClasses.length === 0)) {
        throw new CredentialStoreError({ code: 'ERASURE_INCOMPLETE' });
      }

      this.executeErasureSteps(trigger, pending.scope, true, allowedClasses);
    } catch (err) {
      if (err instanceof CredentialStoreError && err.code === 'ERASURE_INCOMPLETE') {
        throw err;
      }
      throw new CredentialStoreError({
        code: 'ERASURE_INCOMPLETE',
      });
    }
  }

  runErasure(
    trigger: ErasureTrigger,
    scope: string | '*',
    allowedClasses?: readonly string[]
  ): ErasureOutcome {
    const startedAt = this.now();

    try {
      // 1. Commit/join pending_erasure marker in its own transaction first
      let requestedClasses = allowedClasses;
      if (
        trigger === 'connector_disconnect' &&
        requestedClasses === undefined &&
        this.eligibleClassesProvider
      ) {
        requestedClasses = this.eligibleClassesProvider('connector_disconnect');
      }

      const effective = this.entryTable.setPendingErasure(
        trigger,
        scope,
        startedAt,
        requestedClasses
      );
      const effectiveTrigger = effective.trigger as ErasureTrigger;
      const effectiveScope = effective.scope;
      const effectiveAllowedClasses = effective.allowedClasses ?? requestedClasses;

      // 2. Execute the actual effective erasure steps
      const entriesErased = this.executeErasureSteps(
        effectiveTrigger,
        effectiveScope,
        false,
        effectiveAllowedClasses
      );

      return {
        trigger: effectiveTrigger,
        scope: effectiveScope,
        entriesErased,
        completed: true,
      };
    } catch (err) {
      if (err instanceof CredentialStoreError && err.code === 'ERASURE_INCOMPLETE') {
        throw err;
      }
      // Leave marker in place
      throw new CredentialStoreError({
        code: 'ERASURE_INCOMPLETE',
      });
    }
  }

  private executeErasureSteps(
    trigger: ErasureTrigger,
    scope: string | '*',
    isResumption: boolean,
    allowedClasses?: readonly string[]
  ): number {
    const isDestructive = trigger === 'account_deletion' || trigger === 'uninstall';

    // Overwrite with random blobs, clear metadata, mark unreadable, and delete
    const entriesErased = this.entryTable.overwriteAndDeleteEntriesByScope(
      scope,
      allowedClasses
    );

    // Vacuum and truncate checkpoint while marker still exists
    this.entryTable.vacuum();
    this.entryTable.checkpoint();

    if (isDestructive) {
      // Remove database and sidecar files; store becomes closed
      this.entryTable.deleteDatabaseFiles();

      if (isResumption) {
        // If resuming on startup, reopen a fresh empty database for application use
        this.entryTable.open();
        const check = this.entryTable.getPendingErasure();
        if (check) {
          throw new CredentialStoreError({
            code: 'ERASURE_INCOMPLETE',
          });
        }
      }
    } else {
      // Clear pending marker and checkpoint again
      this.entryTable.clearPendingErasure();
      this.entryTable.checkpoint();
    }

    return entriesErased;
  }
}
