/**
 * Card Queue & Priority Ordering (PRD Appendix A.4, FR-INT-15)
 * Rule: ASK = APPROVAL (FIFO between them) > ERROR > RESULT > ACK/PROGRESS
 */

const CARD_PRIORITY_TIER = {
  ASK: 1,
  APPROVAL: 1,
  ERROR: 2,
  RESULT: 3,
  PROGRESS: 4,
  ACK: 4
};

class CardQueue {
  constructor() {
    this.cards = [];
  }

  enqueue(card) {
    // A job has at most one active card in the queue (Appendix A.4.2)
    const existingIndex = this.cards.findIndex(c => c.jobId === card.jobId);
    if (existingIndex >= 0) {
      const existing = this.cards[existingIndex];
      // Blocking cards cannot be silently replaced unless resolved or cancelled
      if (this.isBlocking(existing.type) && !card.resolved) {
        // Keep existing blocking card
        return;
      }
      this.cards.splice(existingIndex, 1);
    }
    this.cards.push(card);
    this.sort();
  }

  isBlocking(type) {
    return type === 'ASK' || type === 'APPROVAL';
  }

  sort() {
    this.cards.sort((a, b) => {
      const tierA = CARD_PRIORITY_TIER[a.type] || 99;
      const tierB = CARD_PRIORITY_TIER[b.type] || 99;

      if (tierA !== tierB) {
        return tierA - tierB;
      }

      // Within the same tier (e.g. ASK vs APPROVAL tier 1), sort FIFO by createdAt
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });
  }

  getTopCard() {
    return this.cards.length > 0 ? this.cards[0] : null;
  }

  getAll() {
    return [...this.cards];
  }

  getBlockingCount() {
    return this.cards.filter(c => this.isBlocking(c.type)).length;
  }
}

module.exports = {
  CardQueue,
  CARD_PRIORITY_TIER
};
