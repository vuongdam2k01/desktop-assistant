import { BrowserWindow, MessageChannelMain, app, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  CONTRACT_VERSION,
  DEFAULT_PACK_ID,
  SHIPPED_PET_DESCRIPTOR,
  deriveWorkStatus,
  sanitizeSetStatePayload,
  type PetActivationResult,
  type PetAssetDescriptor,
  type PetJobStateSnapshot,
  type PetPackState,
  type SetPetStatePayload,
} from './pet-protocol.js';
import type { WindowIntegration } from '../window-integration/types.js';
import { resolvePetAssetOverride } from '../development-overrides.js';
import {
  createPointerAlphaProvider,
  hasOpaquePixels,
  resolveBitmapDimensions,
} from './pet-pointer-mask.js';
import {
  PET_WINDOW_HEIGHT,
  PET_WINDOW_WIDTH,
  PetBoundsStore,
  computeNormalizedFraction,
  computePrimaryBottomRight,
  reconcilePetBounds,
  type DisplayProvider,
  type DisplaySnapshot,
} from './pet-bounds-topology.js';

/** How long to wait for the renderer to paint before giving up on a mask refresh. */
const PAINT_WAIT_MS = 2000;

export interface PetWindowController {
  setState: (partial: SetPetStatePayload) => void;
  applyJobSnapshot: (snapshot: PetJobStateSnapshot) => void;
  activatePack: (
    trustedPath: string,
    metadata?: {
      packId?: string;
      contractVersion?: string;
      descriptor?: PetAssetDescriptor;
      capabilities?: string[];
    }
  ) => Promise<PetActivationResult>;
  reloadActivePack: () => Promise<PetActivationResult>;
  getPackState: () => Promise<PetPackState>;
  markActivity: () => void;
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
  onVisibilityChange: (listener: (visible: boolean) => void) => () => void;
  refreshPointerMask: () => Promise<void>;
}

export function resolveDefaultAssetPath(): string {
  const isPackaged = Boolean(app && app.isPackaged);

  const requestedAsset = resolvePetAssetOverride(process.env, isPackaged);
  if (requestedAsset && fs.existsSync(requestedAsset)) {
    return requestedAsset;
  }

  if (isPackaged) {
    return path.join(process.resourcesPath, 'assets/pet.riv');
  }

  const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd();
  return path.join(appPath, 'renderer-pet/assets/pet.riv');
}

export class PetWindowControllerImpl implements PetWindowController {
  private cachedWorkStatus: 0 | 1 | 2 | 3 | 4 = 0;
  private cachedLocomotion: 0 | 1 | 2 | 3 = 0;
  private cachedVisibility = true;
  private activePackId = DEFAULT_PACK_ID;
  private activePackPath: string;
  private activeDescriptor: PetAssetDescriptor = SHIPPED_PET_DESCRIPTOR;
  private activeCapabilities: string[] = ['workStatus', 'locomotion'];
  private isRendererReady = false;
  private currentDisplayId = 1;
  private readonly visibilityListeners = new Set<(visible: boolean) => void>();
  private readonly boundsStore: PetBoundsStore;
  private readonly displayProvider: DisplayProvider;
  constructor(
    private readonly win: BrowserWindow,
    private readonly windowIntegration: WindowIntegration,
    userDataPath: string = app.getPath('userData'),
    customDisplayProvider?: DisplayProvider
  ) {
    this.activePackPath = resolveDefaultAssetPath();
    this.boundsStore = new PetBoundsStore(path.join(userDataPath, 'pet-window-state.json'));

    this.displayProvider = customDisplayProvider ?? {
      getAllDisplays: (): DisplaySnapshot[] => {
        return screen.getAllDisplays().map(d => ({
          id: d.id,
          bounds: d.bounds,
          workArea: d.workArea,
          scaleFactor: d.scaleFactor,
        }));
      },
      getPrimaryDisplay: (): DisplaySnapshot => {
        const d = screen.getPrimaryDisplay();
        return {
          id: d.id,
          bounds: d.bounds,
          workArea: d.workArea,
          scaleFactor: d.scaleFactor,
        };
      },
      getDisplayMatching: (rect): DisplaySnapshot => {
        const d = screen.getDisplayMatching(rect);
        return {
          id: d.id,
          bounds: d.bounds,
          workArea: d.workArea,
          scaleFactor: d.scaleFactor,
        };
      },
    };

    this.initWindowBounds();
    this.setupWindowListeners();
  }

  private initWindowBounds(): void {
    const saved = this.boundsStore.load();
    const reconciled = reconcilePetBounds(
      saved,
      this.displayProvider,
      PET_WINDOW_WIDTH,
      PET_WINDOW_HEIGHT
    );
    this.win.setBounds(reconciled.bounds);
    this.currentDisplayId = reconciled.displayId;
  }
  private setupWindowListeners(): void {
    this.win.on('move', () => {
      this.markActivity();
      this.persistCurrentBounds();
    });

    this.win.on('close', () => {
      this.boundsStore.saveImmediate();
    });

    if (typeof screen?.on === 'function') {
      const onDisplayRemoved = (_event: unknown, oldDisplay: DisplaySnapshot) => {
        if (this.win.isDestroyed()) return;
        if (this.currentDisplayId === oldDisplay.id) {
          // Detached display holding pet -> move to primary bottom-right
          const primary = this.displayProvider.getPrimaryDisplay();
          const fallback = computePrimaryBottomRight(primary.workArea, PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT);
          this.win.setBounds(fallback);
          this.currentDisplayId = primary.id;
          this.persistCurrentBounds();
        }
      };

      const onDisplayMetrics = (_event: unknown, display: DisplaySnapshot, changedMetrics: string[]) => {
        if (this.win.isDestroyed()) return;
        if (changedMetrics.includes('workArea') || changedMetrics.includes('scaleFactor')) {
          const currentBounds = this.win.getBounds();
          const matching = this.displayProvider.getDisplayMatching(currentBounds);
          if (matching.id === display.id) {
            const fraction = computeNormalizedFraction(currentBounds, display.workArea);
            const reconciled = reconcilePetBounds(
              {
                version: 1,
                bounds: currentBounds,
                displayId: display.id,
                workArea: display.workArea,
                scaleFactor: display.scaleFactor,
                normalizedFraction: fraction,
              },
              this.displayProvider,
              PET_WINDOW_WIDTH,
              PET_WINDOW_HEIGHT
            );
            this.win.setBounds(reconciled.bounds);
            this.currentDisplayId = display.id;
            this.persistCurrentBounds();
          }
        }
      };

      screen.on('display-removed', onDisplayRemoved as unknown as (event: unknown, d: unknown) => void);
      screen.on('display-metrics-changed', onDisplayMetrics as unknown as (event: unknown, d: unknown, m: unknown) => void);

      this.win.on('closed', () => {
        if (typeof screen?.removeListener === 'function') {
          screen.removeListener('display-removed', onDisplayRemoved as unknown as (event: unknown, d: unknown) => void);
          screen.removeListener('display-metrics-changed', onDisplayMetrics as unknown as (event: unknown, d: unknown, m: unknown) => void);
        }
      });
    }
  }

  private persistCurrentBounds(): void {
    if (this.win.isDestroyed()) return;
    const bounds = this.win.getBounds();
    const currentDisplay = this.displayProvider.getDisplayMatching(bounds);
    this.currentDisplayId = currentDisplay.id;
    const fraction = computeNormalizedFraction(bounds, currentDisplay.workArea);

    this.boundsStore.saveDebounced({
      version: 1,
      bounds,
      displayId: currentDisplay.id,
      workArea: currentDisplay.workArea,
      scaleFactor: currentDisplay.scaleFactor,
      normalizedFraction: fraction,
    });
  }

  handleRendererReady(): void {
    this.isRendererReady = true;

    // Send initial pack activation if needed
    void this.activatePack(this.activePackPath, {
      packId: this.activePackId,
      contractVersion: CONTRACT_VERSION,
      descriptor: this.activeDescriptor,
      capabilities: this.activeCapabilities,
    })
      .then(result => {
        if (this.win.isDestroyed()) return;

        if (result.activated) {
          // Reveal window inactive after default asset activates
          if (this.cachedVisibility) {
            this.win.showInactive();
            this.reassertAlwaysOnTop();
            void this.refreshPointerMask();
          }

          // Replay visibility and cached state
          this.win.webContents.send('pet:visibilityChanged', this.cachedVisibility);
          this.win.webContents.send('pet:setState', {
            workStatus: this.cachedWorkStatus,
            locomotion: this.cachedLocomotion,
          });
        } else {
          console.error('[PetController] Default pack activation failed:', result.error);
        }
      })
      .catch(err => {
        console.error('[PetController] Initial activation error:', err);
      });
  }

  setState(partial: SetPetStatePayload): void {
    const sanitized = sanitizeSetStatePayload(partial);
    if (!sanitized) return;

    if (sanitized.workStatus !== undefined) {
      this.cachedWorkStatus = sanitized.workStatus;
    }
    if (sanitized.locomotion !== undefined) {
      this.cachedLocomotion = sanitized.locomotion;
    }

    if (!this.win.isDestroyed() && this.isRendererReady) {
      this.win.webContents.send('pet:setState', sanitized);
    }
    this.markActivity();
  }

  applyJobSnapshot(snapshot: PetJobStateSnapshot): void {
    const nextWork = deriveWorkStatus(snapshot);
    if (nextWork !== this.cachedWorkStatus) {
      this.setState({ workStatus: nextWork });
    }
  }

  async activatePack(
    trustedPath: string,
    metadata?: {
      packId?: string;
      contractVersion?: string;
      descriptor?: PetAssetDescriptor;
      capabilities?: string[];
    }
  ): Promise<PetActivationResult> {
    if (this.win.isDestroyed()) {
      return { activated: false, error: 'RENDERER_UNAVAILABLE' };
    }

    const packId = metadata?.packId ?? DEFAULT_PACK_ID;
    const contractVersion = metadata?.contractVersion ?? CONTRACT_VERSION;
    const descriptor = metadata?.descriptor ?? SHIPPED_PET_DESCRIPTOR;
    const capabilities = metadata?.capabilities ?? ['workStatus', 'locomotion'];

    // 1. Contract major validation: must match 2.x
    if (!contractVersion.startsWith('2.')) {
      return { activated: false, error: 'INCOMPATIBLE_REVISION' };
    }

    // 2. Blend duration validation: 150 - 250 ms
    const blend = descriptor.transitionBlendDurationMs;
    if (typeof blend !== 'number' || blend < 150 || blend > 250) {
      return { activated: false, error: 'BLEND_DURATION_OUT_OF_RANGE' };
    }

    // 3. Read trusted asset path
    let buffer: Uint8Array;
    try {
      buffer = await fs.promises.readFile(trustedPath);
    } catch (err) {
      console.error('[PetWindowController] Failed to read asset buffer:', err);
      return { activated: false, error: 'INVALID_ASSET_BUFFER' };
    }

    // 4. Send over MessageChannelMain
    const { port1, port2 } = new MessageChannelMain();

    return new Promise<PetActivationResult>(resolve => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            port1.close();
          } catch (closeErr) {
            void closeErr;
          }
          resolve({ activated: false, error: 'ACTIVATION_TIMEOUT' });
        }
      }, 10_000);

      port1.on('message', event => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const data = event.data as PetActivationResult;
        try {
          port1.close();
        } catch (closeErr) {
          void closeErr;
        }
        if (data.activated) {
          this.activePackId = packId;
          this.activePackPath = trustedPath;
          this.activeDescriptor = descriptor;
          this.activeCapabilities = capabilities;

          // Re-send latest cached state to newly activated asset
          if (!this.win.isDestroyed()) {
            this.win.webContents.send('pet:setState', {
              workStatus: this.cachedWorkStatus,
              locomotion: this.cachedLocomotion,
            });
          }

          // A different character has a different silhouette
          void this.refreshPointerMask();
        }
        resolve(data);
      });

      port1.start();

      // Post port2 to renderer with manifest/metadata
      this.win.webContents.postMessage(
        'pet:activatePack',
        {
          packId,
          contractVersion,
          descriptor,
          capabilities,
        },
        [port2]
      );

      // Post buffer through port1
      port1.postMessage({ buffer });
    });
  }

  async reloadActivePack(): Promise<PetActivationResult> {
    return this.activatePack(this.activePackPath, {
      packId: this.activePackId,
      contractVersion: CONTRACT_VERSION,
      descriptor: this.activeDescriptor,
      capabilities: this.activeCapabilities,
    });
  }

  async getPackState(): Promise<PetPackState> {
    return {
      activePack: this.activePackId,
      contractVersion: CONTRACT_VERSION,
      capabilities: this.activeCapabilities,
      workStatus: this.cachedWorkStatus,
      locomotion: this.cachedLocomotion,
    };
  }

  markActivity(): void {
    if (!this.win.isDestroyed() && this.isRendererReady) {
      this.win.webContents.send('pet:activity', { type: 'move' });
    }
  }

  show(): void {
    if (this.win.isDestroyed()) return;
    this.cachedVisibility = true;
    this.win.showInactive();
    this.reassertAlwaysOnTop();
    void this.refreshPointerMask();
    this.win.webContents.send('pet:visibilityChanged', true);
    this.emitVisibilityChange(true);
  }

  hide(): void {
    if (this.win.isDestroyed()) return;
    this.cachedVisibility = false;
    this.win.webContents.send('pet:visibilityChanged', false);
    this.win.hide();
    this.emitVisibilityChange(false);
  }

  isVisible(): boolean {
    return this.cachedVisibility && !this.win.isDestroyed() && this.win.isVisible();
  }

  onVisibilityChange(listener: (visible: boolean) => void): () => void {
    this.visibilityListeners.add(listener);
    return () => {
      this.visibilityListeners.delete(listener);
    };
  }

  private emitVisibilityChange(visible: boolean): void {
    for (const listener of this.visibilityListeners) {
      try {
        listener(visible);
      } catch (err) {
        console.error('[PetWindowController] Error in visibility change listener:', err);
      }
    }
  }

  reassertAlwaysOnTop(): void {
    if (this.win.isDestroyed()) return;
    // The platform facade owns this: on Windows and macOS it reasserts the native
    // no-activate topmost styling, and elsewhere it performs the same two Electron
    // calls this method used to make itself.
    this.windowIntegration.applyNoActivateTopmost(this.win);
  }

  /**
   * Hands the native window integration the pet's current silhouette, so a click on a
   * transparent pixel reaches the application underneath instead of the pet. The captured
   * frame is the only source of the character's alpha available in this process, and the
   * native layer rescales the mask to the window, so it is used at whatever size it arrives.
   */
  async refreshPointerMask(): Promise<void> {
    if (this.win.isDestroyed()) return;
    if (this.windowIntegration.capabilities().setPointerPassthrough === 'unavailable') {
      return;
    }

    // A window that is not on screen does not paint, so there is nothing to capture and
    // nothing to wait for.
    if (!this.win.isVisible()) return;

    try {
      // A capture taken before the character has been painted comes back fully
      // transparent, and a fully transparent mask makes every click pass through the pet.
      // The wait has a deadline: an occluded or closing renderer runs no animation frame,
      // and waiting on one indefinitely kept the renderer busy and stopped the application
      // from closing.
      const painted = await Promise.race([
        this.win.webContents
          .executeJavaScript(
            'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))'
          )
          .then(() => true)
          .catch(() => false),
        new Promise<boolean>(resolve => {
          setTimeout(() => resolve(false), PAINT_WAIT_MS).unref?.();
        }),
      ]);
      if (!painted) return;
      if (this.win.isDestroyed()) return;

      const image = await this.win.capturePage();
      if (this.win.isDestroyed()) return;

      const bitmap = image.toBitmap();
      const { width, height } = image.getSize();
      const dimensions = resolveBitmapDimensions(bitmap.length, width, height);
      if (!dimensions) {
        console.warn(
          `[PetController] A capture of ${bitmap.length} bytes does not match a ${width}x${height} window at any supported scale factor; keeping the previous pointer mask.`
        );
        return;
      }

      const provider = createPointerAlphaProvider(bitmap, dimensions.width, dimensions.height);
      if (!hasOpaquePixels(provider)) {
        console.warn(
          '[PetController] A capture contained no opaque pixels; keeping the previous pointer mask rather than making the pet unclickable.'
        );
        return;
      }

      this.windowIntegration.enablePixelHitTest(this.win, provider);
    } catch (err) {
      console.error('[PetController] Could not refresh the pointer mask:', err);
    }
  }
}
