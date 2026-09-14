import { describe, it, expect } from 'vitest';
import { selectSoakMemory } from '../scripts/soak-metrics.mjs';

/**
 * An endurance run exists to show whether the pet renderer grows over hours. The
 * application opens a hidden card window before the pet, so the first renderer the
 * framework reports is a blank page that does nothing: measuring it would report a
 * flat, leak-free result no matter what the pet did.
 */
describe('which process an endurance run measures', () => {
  const metrics = [
    { pid: 100, type: 'Browser', workingSetSize: 210_000 },
    { pid: 201, type: 'Tab', workingSetSize: 40_000 },
    { pid: 202, type: 'Tab', workingSetSize: 380_000 },
    { pid: 300, type: 'GPU', workingSetSize: 90_000 },
  ];

  it('measures the pet renderer, not the first renderer reported', () => {
    expect(selectSoakMemory(metrics, 202)).toEqual({ mainRss: 210_000, rendererRss: 380_000 });
  });

  it('refuses rather than reporting zero when the pet process is absent', () => {
    expect(() => selectSoakMemory(metrics, 999)).toThrow(/999/);
  });

  it('refuses when the main process is absent', () => {
    expect(() => selectSoakMemory([{ pid: 202, type: 'Tab', workingSetSize: 1 }], 202)).toThrow(
      /main process/i
    );
  });
});
