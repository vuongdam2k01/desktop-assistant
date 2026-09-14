/**
 * Normative shape of the request that starts an undo, for undo/contracts/undo-pipeline@1.0.0. It carries only what the user confirmed: the job being undone and the sequence positions they ticked in the preview. It deliberately carries no compensating operation, no arguments and no ordering - those are derived again from the ledger at execution time, so a window cannot ask for a compensating action the ledger does not justify, and a stale preview cannot replay yesterday's plan against today's state.
 */
export interface ExecuteUndoRequest {
  /**
   * The job being undone. The undo runs as a job of its own referencing this one, so undoing an undo is the same operation applied again (INV-UD-02).
   */
  jobId: string;
  /**
   * The sequence positions the user ticked, as the preview stated them. Non-empty: an undo of nothing is refused here rather than started as an empty job. Duplicates are refused because a position confirmed twice would be compensated twice.
   *
   * @minItems 1
   */
  confirmedSequences: [number, ...number[]];
}


export const UNDO_PIPELINE_EXECUTE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/undo/undo-pipeline/execute/1.0.0.json",
  "title": "ExecuteUndoRequest",
  "description": "Normative shape of the request that starts an undo, for undo/contracts/undo-pipeline@1.0.0. It carries only what the user confirmed: the job being undone and the sequence positions they ticked in the preview. It deliberately carries no compensating operation, no arguments and no ordering - those are derived again from the ledger at execution time, so a window cannot ask for a compensating action the ledger does not justify, and a stale preview cannot replay yesterday's plan against today's state.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "jobId",
    "confirmedSequences"
  ],
  "properties": {
    "jobId": {
      "type": "string",
      "minLength": 1,
      "description": "The job being undone. The undo runs as a job of its own referencing this one, so undoing an undo is the same operation applied again (INV-UD-02)."
    },
    "confirmedSequences": {
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "description": "The sequence positions the user ticked, as the preview stated them. Non-empty: an undo of nothing is refused here rather than started as an empty job. Duplicates are refused because a position confirmed twice would be compensated twice.",
      "items": {
        "type": "integer",
        "minimum": 0
      }
    }
  }
} as const;
