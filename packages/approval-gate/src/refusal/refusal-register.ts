import type { RefusalNotice } from '../types.js';

/**
 * Tracks refused or held operations per job and handles disclosure presentation
 * on subsequent agent questions (FR-AP-03, Scenario A-14 mitigation).
 */
export class RefusalRegister {
  readonly #noticesByJob = new Map<string, RefusalNotice[]>();

  /**
   * Records that an operation in a job was refused or held.
   */
  addNotice(notice: RefusalNotice): void {
    const list = this.#noticesByJob.get(notice.jobId) ?? [];
    // Deduplicate by tool + ruleId + object id
    const exists = list.some(
      (n) =>
        n.tool === notice.tool &&
        n.ruleId === notice.ruleId &&
        n.object?.id === notice.object?.id
    );
    if (!exists) {
      list.push(notice);
      this.#noticesByJob.set(notice.jobId, list);
    }
  }

  /**
   * Retrieves all recorded notices for a job.
   */
  getNoticesForJob(jobId: string): readonly RefusalNotice[] {
    return this.#noticesByJob.get(jobId) ?? [];
  }

  /**
   * Formats an agent question with disclosures for stopped operations in this job.
   * If no operation was refused/held, returns the question unmodified.
   */
  formatDisclosureForQuestion(jobId: string, question: string): string {
    const notices = this.getNoticesForJob(jobId);
    if (notices.length === 0) {
      return question;
    }

    const disclosureLines: string[] = [
      '---',
      '⚠️ [DISCLOSURE: The gate previously stopped one or more operations in this job]',
    ];

    for (const notice of notices) {
      const objDesc = notice.object
        ? `${notice.object.type}/${notice.object.id}`
        : 'unspecified target';
      disclosureLines.push(
        `- Operation: '${notice.tool}' on ${objDesc} stopped by rule '${notice.ruleName}' (${notice.ruleId}). Reason: ${notice.reason}`
      );
    }
    disclosureLines.push('---', '');
    disclosureLines.push(question);

    return disclosureLines.join('\n');
  }

  /**
   * Cleans up notices when a job terminates.
   */
  clearJob(jobId: string): void {
    this.#noticesByJob.delete(jobId);
  }

  /**
   * Clears all notices across all jobs.
   */
  clear(): void {
    this.#noticesByJob.clear();
  }
}
