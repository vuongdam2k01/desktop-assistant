import { describe, it, expect } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { CredentialStore } from '@desktop-assistant/credential-store';
import { DesktopContext } from '../main/context.js';
import { stubWindowIntegration } from './helpers/stub-window-integration.js';

/**
 * The services below are published into the context by boot and consumed by modules
 * registered later. Reading one before its module has run is a boot-order mistake, and
 * it has to say so rather than hand back `undefined` for a caller to trip over further
 * downstream.
 */
describe('DesktopContext service publication', () => {
  it('refuses to hand out a service that boot has not published yet', () => {
    const context = new DesktopContext();

    expect(() => context.windowIntegration).toThrow(/windowIntegration/);
    expect(() => context.cardWindow).toThrow(/cardWindow/);
    expect(() => context.credentialStore).toThrow(/credentialStore/);
  });

  it('reports whether a service has been published without throwing', () => {
    const context = new DesktopContext();

    expect(context.hasWindowIntegration).toBe(false);
    expect(context.hasCardWindow).toBe(false);
    expect(context.hasCredentialStore).toBe(false);

    context.windowIntegration = stubWindowIntegration();

    expect(context.hasWindowIntegration).toBe(true);
    expect(context.hasCardWindow).toBe(false);
  });

  it('returns each service once published', () => {
    const context = new DesktopContext();
    const integration = stubWindowIntegration();
    const card = { id: 'card' } as unknown as BrowserWindow;
    const store = { id: 'store' } as unknown as CredentialStore;

    context.windowIntegration = integration;
    context.cardWindow = card;
    context.credentialStore = store;

    expect(context.windowIntegration).toBe(integration);
    expect(context.cardWindow).toBe(card);
    expect(context.credentialStore).toBe(store);
  });

  it('keeps windows that legitimately may not exist as plain optional state', () => {
    const context = new DesktopContext();

    expect(context.petWindow).toBeUndefined();
    expect(context.appWindow).toBeUndefined();
    expect(context.petController).toBeUndefined();
    expect(context.tray).toBeUndefined();
  });
});
