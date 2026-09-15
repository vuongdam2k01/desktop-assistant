import type {
  IntentRecord,
  LedgerStore,
  ResultRecord,
  TypedLedgerRecord,
} from '@desktop-assistant/ledger-store';
import type { CompletedOperation, FailureExplanation, Job } from './types.js';

/**
 * Builds human-readable failure explanations and extracts completed operations for undo
 * per capabilities/job/spec.md (Requirement: A failed job explains itself and offers undo).
 */
export class FailureReporter {
  readonly #ledgerStore: LedgerStore;

  constructor(ledgerStore: LedgerStore) {
    this.#ledgerStore = ledgerStore;
  }

  /**
   * Constructs a comprehensive explanation of a failed job, extracting completed steps
   * from the action ledger and checking if any reversible steps can be compensated.
   */
  async explainFailure(
    job: Job,
    reason: string,
    failureCode?: string,
    heldByJobId?: string
  ): Promise<FailureExplanation> {
    const records = await this.#ledgerStore.readJob(job.id);
    const completedOperations = this.#extractCompletedOperations(records);
    const canUndo = completedOperations.some((op) => op.isReversible);

    return {
      jobId: job.id,
      reason,
      completedOperations,
      canUndo,
      failureCode,
      heldByJobId,
    };
  }

  #extractCompletedOperations(records: TypedLedgerRecord[]): CompletedOperation[] {
    const completed: CompletedOperation[] = [];
    const resultsByCorrelation = new Map<string, ResultRecord>();

    for (const rec of records) {
      if (rec.type === 'result' && rec.correlationId) {
        resultsByCorrelation.set(rec.correlationId, rec);
      }
    }

    for (const rec of records) {
      if (rec.type === 'intent' && rec.correlationId) {
        const intent = rec as IntentRecord;
        const result = resultsByCorrelation.get(rec.correlationId);

        if (result && result.content.outcome === 'succeeded') {
          const isReversible = intent.content.reversibility?.kind === 'reversible';
          completed.push({
            recordId: rec.recordId,
            position: rec.position,
            tool: intent.content.tool,
            connector: intent.content.connector,
            outcome: 'succeeded',
            isReversible,
            recordedAt: rec.recordedAt,
          });
        }
      }
    }

    return completed;
  }
}
