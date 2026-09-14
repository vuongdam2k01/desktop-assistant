/**
 * Append-Only Ledger Repository (FR-LG-01, FR-LG-02)
 */
class LedgerRepository {
  constructor(db) {
    this.db = db;
    this.insertStmt = this.db.prepare(`
      INSERT INTO action_records (
        job_id, seq, type, tool, args, result,
        snapshot_before, snapshot_after, is_reversible,
        compensating_action, correlation_id, timestamp
      ) VALUES (
        @jobId, @seq, @type, @tool, @args, @result,
        @snapshotBefore, @snapshotAfter, @isReversible,
        @compensatingAction, @correlationId, @timestamp
      )
    `);

    this.byJobStmt = this.db.prepare(`
      SELECT * FROM action_records WHERE job_id = ? ORDER BY seq ASC
    `);

    this.lastRecordStmt = this.db.prepare(`
      SELECT * FROM action_records WHERE job_id = ? ORDER BY seq DESC LIMIT 1
    `);

    this.maxSeqStmt = this.db.prepare(`
      SELECT COALESCE(MAX(seq), 0) AS max_seq FROM action_records WHERE job_id = ?
    `);

    this.unmatchedIntentsStmt = this.db.prepare(`
      SELECT intent.*
      FROM action_records intent
      WHERE intent.type = 'tool_intent'
        AND NOT EXISTS (
          SELECT 1 FROM action_records res
          WHERE res.type = 'tool_result'
            AND res.correlation_id = intent.correlation_id
        )
      ORDER BY intent.timestamp ASC
    `);
  }

  getNextSeq(jobId) {
    const row = this.maxSeqStmt.get(jobId);
    return (row ? row.max_seq : 0) + 1;
  }

  appendRecord({
    jobId,
    seq,
    type,
    tool = null,
    args = null,
    result = null,
    snapshotBefore = null,
    snapshotAfter = null,
    isReversible = 0,
    compensatingAction = null,
    correlationId = null,
    timestamp = new Date().toISOString()
  }) {
    if (!jobId || !type) {
      throw new Error('jobId and type are required for ActionRecord');
    }

    const currentSeq = seq !== undefined ? seq : this.getNextSeq(jobId);

    const info = this.insertStmt.run({
      jobId,
      seq: currentSeq,
      type,
      tool,
      args: args ? (typeof args === 'string' ? args : JSON.stringify(args)) : null,
      result: result ? (typeof result === 'string' ? result : JSON.stringify(result)) : null,
      snapshotBefore: snapshotBefore ? (typeof snapshotBefore === 'string' ? snapshotBefore : JSON.stringify(snapshotBefore)) : null,
      snapshotAfter: snapshotAfter ? (typeof snapshotAfter === 'string' ? snapshotAfter : JSON.stringify(snapshotAfter)) : null,
      isReversible: isReversible ? 1 : 0,
      compensatingAction: compensatingAction ? (typeof compensatingAction === 'string' ? compensatingAction : JSON.stringify(compensatingAction)) : null,
      correlationId,
      timestamp
    });

    return {
      id: Number(info.lastInsertRowid),
      jobId,
      seq: currentSeq,
      type,
      correlationId,
      timestamp
    };
  }

  getRecordsByJobId(jobId) {
    return this.byJobStmt.all(jobId).map(this._parseRow);
  }

  getLastRecord(jobId) {
    const row = this.lastRecordStmt.get(jobId);
    return row ? this._parseRow(row) : null;
  }

  getUnmatchedIntents() {
    return this.unmatchedIntentsStmt.all().map(this._parseRow);
  }

  _parseRow(row) {
    return {
      ...row,
      args: row.args ? JSON.parse(row.args) : null,
      result: row.result ? JSON.parse(row.result) : null,
      snapshot_before: row.snapshot_before ? JSON.parse(row.snapshot_before) : null,
      snapshot_after: row.snapshot_after ? JSON.parse(row.snapshot_after) : null,
      compensating_action: row.compensating_action ? JSON.parse(row.compensating_action) : null
    };
  }
}

module.exports = {
  LedgerRepository
};
