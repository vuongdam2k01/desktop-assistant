import type { ElectronApplication, Page } from '@playwright/test';

const PET_RENDERER_URL_MARKER = 'renderer-pet';
const POLL_INTERVAL_MS = 100;

/**
 * Resolves the pet window by its renderer identity rather than by creation order.
 * The application opens a hidden card window before the pet window, so the first
 * window an Electron application reports is not the pet.
 */
export async function resolvePetWindow(
  electronApp: ElectronApplication,
  timeoutMs = 20_000
): Promise<Page> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const page of electronApp.windows()) {
      if (page.url().includes(PET_RENDERER_URL_MARKER)) {
        return page;
      }
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const seen = electronApp
    .windows()
    .map(page => page.url())
    .join(', ');
  throw new Error(`Pet window did not open within ${timeoutMs}ms. Windows seen: [${seen}]`);
}
