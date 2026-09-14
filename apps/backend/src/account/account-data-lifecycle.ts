export interface ProviderRevocationItem {
  providerId: string;
  revocationToken: string;
}

export interface AccountDataLifecycle {
  visitProviderAuthorisations(
    accountId: string,
    visitor: (item: ProviderRevocationItem) => Promise<void>
  ): Promise<void>;
  destroyReplicatedAccount(accountId: string): Promise<void>;
}

export class EmptyAccountDataLifecycle implements AccountDataLifecycle {
  async visitProviderAuthorisations(
    _accountId: string,
    _visitor: (item: ProviderRevocationItem) => Promise<void>
  ): Promise<void> {
    // No replicated authorizations exist when replication is disabled
  }

  async destroyReplicatedAccount(_accountId: string): Promise<void> {
    // No replicated data exists when replication is disabled
  }
}
