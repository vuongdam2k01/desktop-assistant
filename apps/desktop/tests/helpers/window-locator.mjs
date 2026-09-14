/**
 * Resolves a window by a marker in the document it loaded, rather than by creation
 * order. The application pre-warms a hidden card window before it creates the pet
 * window, so the first window an Electron application reports is not the pet.
 *
 * The typed counterpart used by the Playwright specs lives in `pet-window.ts`; the
 * two cannot share one module because the scripts are plain ESM outside the
 * TypeScript program.
 */
export async function resolveWindowByUrlMarker(app, marker, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const page of app.windows()) {
      if (page.url().includes(marker)) {
        return page;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const seen = app
    .windows()
    .map(page => page.url())
    .join(', ');
  throw new Error(`Window matching "${marker}" did not open within ${timeoutMs}ms. Seen: [${seen}]`);
}

export const PET_RENDERER_URL_MARKER = 'renderer-pet';
