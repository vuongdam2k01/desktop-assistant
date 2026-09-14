import type { TypedLedgerRecord } from './types.js';

/**
 * Deterministic English, data-only summary of a ledger record.
 * Used for human presentation and text filtering.
 * Never includes credentials or raw secrets.
 */
export function renderRecordSummary(record: TypedLedgerRecord): string {
  switch (record.type) {
    case 'intent': {
      const target =
        record.content.before.captured && record.content.before.target
          ? ` on target ${record.content.before.target}`
          : '';
      const reversibility =
        record.content.reversibility.kind === 'reversible'
          ? 'reversible'
          : `irreversible (${record.content.reversibility.reason})`;
      return `Intent: Execute ${record.content.connector}:${record.content.tool}${target} [${reversibility}].`;
    }
    case 'result': {
      const outcome = record.content.outcome === 'succeeded' ? 'succeeded' : 'failed';
      const established = `established by ${record.content.establishedBy}`;
      const comp = record.content.compensatingAction
        ? ` with compensating action ${record.content.compensatingAction.connector}:${record.content.compensatingAction.tool}`
        : '';
      const fail = record.content.failure ? ` (${record.content.failure.code}: ${record.content.failure.message})` : '';
      return `Result: Operation ${outcome} (${established})${comp}${fail}.`;
    }
    case 'decision': {
      const reason = record.content.reason ? ` - ${record.content.reason}` : '';
      return `Decision: ${record.content.decision} by ${record.content.decidedBy}${reason}.`;
    }
    case 'error': {
      const interrupted = record.content.interrupted ? ' (interrupted)' : '';
      return `Error [${record.content.code}]: ${record.content.message}${interrupted}.`;
    }
    case 'information': {
      return `Information: ${record.content.summary}.`;
    }
    case 'removal_announcement': {
      const { reason, requestedBy, range } = record.content;
      return `Removal Announcement: ${reason} requested by ${requestedBy} for ${range.recordCount} records (${range.fromRecordedAt} to ${range.toRecordedAt}).`;
    }
    case 'superseded_version': {
      return `Superseded Version: Record ${record.content.supersededRecord} superseded by ${record.content.supersedingRecord} from device ${record.content.supersededDevice}.`;
    }
    default: {
      const exhaustiveCheck: never = record;
      return `Record: unknown type ${(exhaustiveCheck as { type: string }).type}`;
    }
  }
}
