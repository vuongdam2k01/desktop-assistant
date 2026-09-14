import type { DesktopContext } from '../context.js';
import { selectWindowIntegration } from './select-window-integration.js';

export async function registerWindowIntegrationModule(
  context: DesktopContext
): Promise<void> {
  const integration = selectWindowIntegration();
  context.windowIntegration = integration;

  // Set initial activation policy to accessory (background presence)
  integration.setActivationPolicy('accessory');

  // Pre-warm the reusable card window (340x220 geometry loading about:blank)
  const card = await integration.prewarmCardWindow();
  context.cardWindow = card;
}
