import type { FailureNotice } from '@desktop-assistant/contracts/provider-failure';
import type { FailureCause } from './types.js';

export type NoticeRaisedListener = (notice: FailureNotice) => void;
export type NoticeWithdrawnListener = (payload: { dedupeKey: string }) => void;

export class FailureRegistry {
  private readonly notices = new Map<string, FailureNotice>();
  private readonly raisedListeners = new Set<NoticeRaisedListener>();
  private readonly withdrawnListeners = new Set<NoticeWithdrawnListener>();

  async raise(notice: FailureNotice): Promise<void> {
    const existing = this.notices.get(notice.dedupeKey);
    let finalNotice: FailureNotice;

    if (existing) {
      // Merge roles and update observedAt
      const mergedRoles = [...existing.roles];
      for (const r of notice.roles) {
        if (!mergedRoles.includes(r)) {
          mergedRoles.push(r);
        }
      }

      const providerDetail = notice.providerDetail ?? existing.providerDetail;
      finalNotice = {
        ...existing,
        roles: mergedRoles as FailureNotice['roles'],
        observedAt: notice.observedAt,
        ...(providerDetail !== undefined ? { providerDetail } : {}),
      };
    } else {
      finalNotice = { ...notice };
    }

    this.notices.set(finalNotice.dedupeKey, finalNotice);

    for (const listener of this.raisedListeners) {
      try {
        listener(finalNotice);
      } catch (err) {
        console.error('Error in FailureRegistry raisedListener:', err);
      }
    }
  }

  async withdraw(dedupeKey: string): Promise<void> {
    if (this.notices.has(dedupeKey)) {
      this.notices.delete(dedupeKey);
      for (const listener of this.withdrawnListeners) {
        try {
          listener({ dedupeKey });
        } catch (err) {
          console.error('Error in FailureRegistry withdrawnListener:', err);
        }
      }
    }
  }

  async withdrawForProfileAndCause(profileId: string, cause: FailureCause): Promise<void> {
    const dedupeKey = `${profileId}:${cause}`;
    await this.withdraw(dedupeKey);
  }

  async withdrawForProfile(profileId: string): Promise<void> {
    const keysToWithdraw: string[] = [];
    for (const [key, notice] of this.notices.entries()) {
      if (notice.profileId === profileId) {
        keysToWithdraw.push(key);
      }
    }
    for (const key of keysToWithdraw) {
      await this.withdraw(key);
    }
  }

  async standing(): Promise<FailureNotice[]> {
    return Array.from(this.notices.values());
  }

  onRaised(listener: NoticeRaisedListener): () => void {
    this.raisedListeners.add(listener);
    return () => {
      this.raisedListeners.delete(listener);
    };
  }

  onWithdrawn(listener: NoticeWithdrawnListener): () => void {
    this.withdrawnListeners.add(listener);
    return () => {
      this.withdrawnListeners.delete(listener);
    };
  }

  clear(): void {
    this.notices.clear();
  }
}
