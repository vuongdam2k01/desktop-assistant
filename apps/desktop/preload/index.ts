import { contextBridge, ipcRenderer } from 'electron';
import type { Locale } from '../i18n/resources.js';
import type {
  PetActivationResult,
  PetAssetDescriptor,
  PetPackState,
  SetPetStatePayload,
} from '../main/pet-window/pet-protocol.js';

export interface PetActivationData {
  packId: string;
  contractVersion: string;
  descriptor: PetAssetDescriptor;
  capabilities: string[];
  buffer: Uint8Array;
}

export interface DesktopPetApi {
  notifyReady: () => void;
  reloadPack: () => void;
  getPackState: () => Promise<PetPackState>;
  onSetState: (callback: (payload: SetPetStatePayload) => void) => () => void;
  onActivatePack: (
    handler: (data: PetActivationData) => Promise<PetActivationResult>
  ) => () => void;
  onVisibilityChanged: (callback: (visible: boolean) => void) => () => void;
  onActivity: (callback: (data: { type: string }) => void) => () => void;
}

export interface DesktopApi {
  locale: {
    get: () => Promise<Locale>;
    set: (locale: Locale) => Promise<Locale>;
    onChanged: (callback: (locale: Locale) => void) => () => void;
  };
  credentials: {
    presence: (key: string) => Promise<{ present: boolean; lastUpdated: string | null }>;
  };
  pet: DesktopPetApi;
}
const desktopApi: DesktopApi = {
  locale: {
    get: async (): Promise<Locale> => {
      return (await ipcRenderer.invoke('locale:get')) as Locale;
    },
    set: async (newLocale: Locale): Promise<Locale> => {
      return (await ipcRenderer.invoke('locale:set', newLocale)) as Locale;
    },
    onChanged: (callback: (locale: Locale) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, loc: unknown) => {
        if (loc === 'vi' || loc === 'en') {
          callback(loc);
        }
      };
      ipcRenderer.on('locale:changed', handler);
      return () => {
        ipcRenderer.removeListener('locale:changed', handler);
      };
    },
  },
  credentials: {
    presence: async (key: string): Promise<{ present: boolean; lastUpdated: string | null }> => {
      return (await ipcRenderer.invoke('credentials:presence', key)) as {
        present: boolean;
        lastUpdated: string | null;
      };
    },
  },
  pet: {
    notifyReady: (): void => {
      ipcRenderer.send('pet:ready');
    },
    reloadPack: (): void => {
      ipcRenderer.send('pet:reloadPack');
    },
    getPackState: async (): Promise<PetPackState> => {
      return (await ipcRenderer.invoke('pet:packState')) as PetPackState;
    },
    onSetState: (callback: (payload: SetPetStatePayload) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        if (payload && typeof payload === 'object') {
          callback(payload as SetPetStatePayload);
        }
      };
      ipcRenderer.on('pet:setState', handler);
      return () => {
        ipcRenderer.removeListener('pet:setState', handler);
      };
    },
    onActivatePack: (
      handler: (data: PetActivationData) => Promise<PetActivationResult>
    ): (() => void) => {
      const ipcHandler = (
        event: Electron.IpcRendererEvent,
        meta: {
          packId: string;
          contractVersion: string;
          descriptor: PetAssetDescriptor;
          capabilities: string[];
        }
      ) => {
        const port = event.ports[0];
        if (!port) return;

        port.onmessage = async (msgEvent: MessageEvent<{ buffer: Uint8Array }>) => {
          const buffer = msgEvent.data.buffer;
          try {
            const result = await handler({
              packId: meta.packId,
              contractVersion: meta.contractVersion,
              descriptor: meta.descriptor,
              capabilities: meta.capabilities,
              buffer,
            });
            port.postMessage(result);
          } catch (err) {
            port.postMessage({
              activated: false,
              error: err instanceof Error ? err.message : String(err),
            });
          } finally {
            port.close();
          }
        };
        port.start();
      };

      ipcRenderer.on('pet:activatePack', ipcHandler);
      return () => {
        ipcRenderer.removeListener('pet:activatePack', ipcHandler);
      };
    },
    onVisibilityChanged: (callback: (visible: boolean) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, visible: unknown) => {
        callback(Boolean(visible));
      };
      ipcRenderer.on('pet:visibilityChanged', handler);
      return () => {
        ipcRenderer.removeListener('pet:visibilityChanged', handler);
      };
    },
    onActivity: (callback: (data: { type: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
        if (data && typeof data === 'object') {
          callback(data as { type: string });
        }
      };
      ipcRenderer.on('pet:activity', handler);
      return () => {
        ipcRenderer.removeListener('pet:activity', handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('desktopApi', desktopApi);
