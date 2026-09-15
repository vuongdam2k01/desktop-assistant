import Database from 'better-sqlite3';
import type { CredentialStore } from '@desktop-assistant/credential-store';
import { initializeDatabase } from './schema.js';
import { ProfileStore } from './profile-store.js';
import { RoutingRegistry } from './routing-registry.js';
import { FailureClassifier } from './failure-classifier.js';
import { FailureRegistry } from './failure-registry.js';
import { UsageAccounting } from './usage-accounting.js';
import {
  ModelRequestDispatcher,
  type ProviderRunner,
} from './dispatcher.js';

export interface ModelRoutingModuleOptions {
  databasePath?: string | undefined;
  db?: Database.Database | undefined;
  credentialStore?: CredentialStore | undefined;
  runner?: ProviderRunner | undefined;
  now?: () => string;
}

export class ModelRoutingModule {
  readonly db: Database.Database;
  readonly profileStore: ProfileStore;
  readonly routingRegistry: RoutingRegistry;
  readonly failureClassifier: FailureClassifier;
  readonly failureRegistry: FailureRegistry;
  readonly usageAccounting: UsageAccounting;
  readonly dispatcher: ModelRequestDispatcher;
  private readonly ownsDb: boolean;

  constructor(options: ModelRoutingModuleOptions = {}) {
    if (options.db) {
      this.db = options.db;
      this.ownsDb = false;
    } else {
      const dbPath = options.databasePath ?? ':memory:';
      this.db = new Database(dbPath);
      this.ownsDb = true;
    }

    initializeDatabase(this.db);

    const now = options.now;
    this.failureClassifier = new FailureClassifier(now);
    this.failureRegistry = new FailureRegistry();

    this.profileStore = new ProfileStore({
      db: this.db,
      credentialStore: options.credentialStore,
      now,
    });

    this.routingRegistry = new RoutingRegistry({
      db: this.db,
      profileStore: this.profileStore,
      credentialStore: options.credentialStore,
      failureRegistry: this.failureRegistry,
      now,
    });
    this.usageAccounting = new UsageAccounting({
      db: this.db,
      profileStore: this.profileStore,
      now,
    });

    this.dispatcher = new ModelRequestDispatcher({
      routingRegistry: this.routingRegistry,
      failureClassifier: this.failureClassifier,
      failureRegistry: this.failureRegistry,
      usageAccounting: this.usageAccounting,
      credentialStore: options.credentialStore,
      runner: options.runner,
      now,
    });
  }

  close(): void {
    if (this.ownsDb && this.db.open) {
      this.db.close();
    }
  }
}
