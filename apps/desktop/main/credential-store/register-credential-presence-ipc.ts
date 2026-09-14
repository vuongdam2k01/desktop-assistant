import type {
  CredentialStore,
  RendererCredentialPresence,
} from '@desktop-assistant/credential-store';
import { CredentialStoreError } from '@desktop-assistant/credential-store';

export interface IpcHandlerRegistrar {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
  ): void;
}

export function registerCredentialPresenceIpc(
  ipc: IpcHandlerRegistrar,
  store: CredentialStore
): void {
  ipc.handle(
    'credentials:presence',
    async (
      _event: unknown,
      key: unknown
    ): Promise<RendererCredentialPresence> => {
      if (typeof key !== 'string') {
        throw new CredentialStoreError({
          code: 'KEY_MALFORMED',
        });
      }
      return store.presence(key);
    }
  );
}
