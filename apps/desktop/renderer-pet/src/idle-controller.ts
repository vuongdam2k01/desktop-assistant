import type { Rive } from '@rive-app/canvas';

export const IDLE_TIMEOUT_MS = 60_000;

export class PetIdleController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private isVisible = true;
  private activeRive: Rive | null = null;
  private lastActivityTime = 0;
  private readonly listeners: Array<() => void> = [];

  constructor(timeoutMs: number = IDLE_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
    this.setupWindowListeners();
    this.startTimer();
  }

  private readonly timeoutMs: number;

  private setupWindowListeners(): void {
    if (typeof window === 'undefined') return;

    const onActivity = (): void => {
      this.markActivity();
    };

    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('pointerup', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    this.listeners.push(() => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('pointerup', onActivity);
      window.removeEventListener('keydown', onActivity);
    });
  }

  setActiveRive(instance: Rive | null): void {
    this.activeRive = instance;
    if (this.paused && this.isVisible && this.activeRive) {
      this.resume();
    }
    if (this.isVisible) {
      this.resetTimer();
    }
  }

  markActivity(): void {
    if (!this.isVisible) return;

    if (this.paused) {
      this.resume();
    }
    const now = Date.now();
    if (now - this.lastActivityTime > 250) {
      this.lastActivityTime = now;
      this.resetTimer();
    }
  }

  handleVisibilityChanged(visible: boolean): void {
    this.isVisible = visible;
    if (!visible) {
      this.pause();
      this.clearTimer();
    } else {
      this.resume();
      this.resetTimer();
    }
  }

  private pause(): void {
    if (!this.paused) {
      this.paused = true;
      if (this.activeRive) {
        try {
          this.activeRive.pause();
        } catch (err) {
          console.warn('[PetIdleController] Error pausing Rive instance:', err);
        }
      }
    }
  }

  private resume(): void {
    if (this.paused) {
      this.paused = false;
      if (this.activeRive && this.isVisible) {
        try {
          // Play without stop, preserving state machine input values
          this.activeRive.play();
        } catch (err) {
          console.warn('[PetIdleController] Error resuming Rive instance:', err);
        }
      }
    }
  }

  private startTimer(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.pause();
    }, this.timeoutMs);
  }

  private resetTimer(): void {
    this.startTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  dispose(): void {
    this.clearTimer();
    for (const remove of this.listeners) {
      remove();
    }
    this.listeners.length = 0;
    this.activeRive = null;
  }
}
