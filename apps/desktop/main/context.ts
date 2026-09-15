import type { BrowserWindow, Tray } from 'electron';
import type { CredentialStore } from '@desktop-assistant/credential-store';
import type { LedgerStore } from '@desktop-assistant/ledger-store';
import type { JobManager } from '@desktop-assistant/job-manager';
import type { ModelRoutingModule } from '@desktop-assistant/model-routing';
import type { Locale } from '../i18n/resources.js';
import type { PetWindowController } from './pet-window/pet-controller.js';
import type { WindowIntegration } from './window-integration/types.js';

export type LocaleChangeListener = (locale: Locale) => void;

function published<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(
      `${name} was read before the module that publishes it had registered. Check the registration order in the main entry point.`
    );
  }
  return value;
}

/**
 * State shared by the modules the main entry point registers, in the order it registers
 * them.
 *
 * Services that boot always publishes — the platform window integration, the pre-warmed
 * card window, the credential store — are exposed through accessors that fail loudly when
 * read too early. Returning `undefined` there would let a boot-order mistake travel into a
 * caller that has no way of telling a missing service from an absent one.
 *
 * Windows and the tray stay plain optional fields, because whether they exist is a genuine
 * question a caller may ask at any time.
 */
export class DesktopContext {
  #windowIntegration?: WindowIntegration;
  #cardWindow?: BrowserWindow;
  #credentialStore?: CredentialStore;
  #ledgerStore?: LedgerStore;
  #jobManager?: JobManager;
  #modelRoutingModule?: ModelRoutingModule;

  petWindow?: BrowserWindow;
  appWindow?: BrowserWindow;
  petController?: PetWindowController;
  /** Also the only strong reference to the tray icon, which is destroyed if it is collected. */
  tray?: Tray;
  isQuitting = false;
  locale: Locale = 'en';

  private readonly listeners = new Set<LocaleChangeListener>();

  get windowIntegration(): WindowIntegration {
    return published(this.#windowIntegration, 'windowIntegration');
  }

  set windowIntegration(value: WindowIntegration) {
    this.#windowIntegration = value;
  }

  get hasWindowIntegration(): boolean {
    return this.#windowIntegration !== undefined;
  }

  get cardWindow(): BrowserWindow {
    return published(this.#cardWindow, 'cardWindow');
  }

  set cardWindow(value: BrowserWindow) {
    this.#cardWindow = value;
  }

  get hasCardWindow(): boolean {
    return this.#cardWindow !== undefined;
  }

  get credentialStore(): CredentialStore {
    return published(this.#credentialStore, 'credentialStore');
  }

  set credentialStore(value: CredentialStore) {
    this.#credentialStore = value;
  }

  get hasCredentialStore(): boolean {
    return this.#credentialStore !== undefined;
  }

  get ledgerStore(): LedgerStore {
    return published(this.#ledgerStore, 'ledgerStore');
  }

  set ledgerStore(value: LedgerStore) {
    this.#ledgerStore = value;
  }

  get hasLedgerStore(): boolean {
    return this.#ledgerStore !== undefined;
  }

  get jobManager(): JobManager {
    return published(this.#jobManager, 'jobManager');
  }

  set jobManager(value: JobManager) {
    this.#jobManager = value;
  }

  get hasJobManager(): boolean {
    return this.#jobManager !== undefined;
  }

  get modelRoutingModule(): ModelRoutingModule {
    return published(this.#modelRoutingModule, 'modelRoutingModule');
  }

  set modelRoutingModule(value: ModelRoutingModule) {
    this.#modelRoutingModule = value;
  }

  get hasModelRoutingModule(): boolean {
    return this.#modelRoutingModule !== undefined;
  }

  setLocale(newLocale: Locale): void {
    if (this.locale === newLocale) return;
    this.locale = newLocale;
    for (const listener of this.listeners) {
      try {
        listener(newLocale);
      } catch (err) {
        console.error('Error in locale change listener:', err);
      }
    }
  }

  onLocaleChange(listener: LocaleChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
