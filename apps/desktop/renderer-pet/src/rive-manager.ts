import {
  Alignment,
  Fit,
  Layout,
  Rive,
  RuntimeLoader,
  StateMachineInputType,
  type StateMachineInput,
} from '@rive-app/canvas';
import riveWasmUrl from '@rive-app/canvas/rive.wasm?url';
import type {
  PetActivationResult,
  PetAssetDescriptor,
  PetPackState,
  SetPetStatePayload,
} from '../../main/pet-window/pet-protocol.js';
import type { PetIdleController } from './idle-controller.js';

export interface RiveManagerOptions {
  stage: HTMLElement;
  primaryCanvas: HTMLCanvasElement;
  secondaryCanvas: HTMLCanvasElement;
  idleController: PetIdleController;
}

export class RiveManager {
  private activeSlot: 'primary' | 'secondary' = 'primary';
  private activeInstance: Rive | null = null;
  private activeWorkInput: StateMachineInput | null = null;
  private activeLocoInput: StateMachineInput | null = null;

  private currentWorkStatus: 0 | 1 | 2 | 3 | 4 = 0;
  private currentLocomotion: 0 | 1 | 2 | 3 = 0;
  private activePackId = '';
  private activeContractVersion = '2.0.0';
  private activeCapabilities: string[] = ['workStatus', 'locomotion'];

  private activationGeneration = 0;
  private wasmInitialized = false;

  private frameCount = 0;
  private lastFpsTimestamp = performance.now();
  private fpsInterval: number | null = null;
  private readonly cleanupCallbacks: Array<() => void> = [];

  constructor(private readonly options: RiveManagerOptions) {
    this.setupResizeListeners();
    this.setupFpsReporting();
  }

  async initWasm(): Promise<void> {
    if (this.wasmInitialized) return;
    RuntimeLoader.setWasmUrl(riveWasmUrl);
    RuntimeLoader.setWasmFallbackUrl(null);
    await RuntimeLoader.awaitInstance();
    this.wasmInitialized = true;
  }

  private setupResizeListeners(): void {
    const onResize = (): void => {
      this.resizeSurfaces();
    };

    window.addEventListener('resize', onResize, { passive: true });
    this.cleanupCallbacks.push(() => {
      window.removeEventListener('resize', onResize);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        this.resizeSurfaces();
      });
      observer.observe(this.options.stage);
      this.cleanupCallbacks.push(() => {
        observer.disconnect();
      });
    }

    const listenToDpr = (): void => {
      const media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener(
        'change',
        () => {
          this.resizeSurfaces();
          listenToDpr();
        },
        { once: true }
      );
    };
    listenToDpr();
  }

  private setupFpsReporting(): void {
    this.fpsInterval = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - this.lastFpsTimestamp) / 1000;
      if (elapsed > 0) {
        const fps = Math.round(this.frameCount / elapsed);
        this.options.stage.setAttribute('data-fps', String(fps));
      }
      this.frameCount = 0;
      this.lastFpsTimestamp = now;
    }, 1000);
  }

  resizeSurfaces(): void {
    if (this.activeInstance) {
      try {
        this.activeInstance.resizeDrawingSurfaceToCanvas();
      } catch (err) {
        console.warn('[RiveManager] Error resizing active surface:', err);
      }
    }
  }

  async activatePack(
    packId: string,
    contractVersion: string,
    descriptor: PetAssetDescriptor,
    capabilities: string[],
    buffer: Uint8Array
  ): Promise<PetActivationResult> {
    const generation = ++this.activationGeneration;

    // Validate major revision
    if (!contractVersion.startsWith('2.')) {
      return { activated: false, error: 'INCOMPATIBLE_REVISION' };
    }

    // Validate blend duration
    const blend = descriptor.transitionBlendDurationMs;
    if (typeof blend !== 'number' || blend < 150 || blend > 250) {
      return { activated: false, error: 'BLEND_DURATION_OUT_OF_RANGE' };
    }

    await this.initWasm();

    const candidateSlot = this.activeSlot === 'primary' ? 'secondary' : 'primary';
    const candidateCanvas =
      candidateSlot === 'primary' ? this.options.primaryCanvas : this.options.secondaryCanvas;
    const currentCanvas =
      this.activeSlot === 'primary' ? this.options.primaryCanvas : this.options.secondaryCanvas;

    const arrayBuffer: ArrayBuffer = (
      buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength
        ? buffer.buffer
        : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    ) as ArrayBuffer;

    let candidateInstance: Rive;
    try {
      candidateInstance = await new Promise<Rive>((resolve, reject) => {
        let loaded = false;
        let loadTimer: ReturnType<typeof setTimeout> | null = null;

        const instance = new Rive({
          canvas: candidateCanvas,
          buffer: arrayBuffer,
          artboard: descriptor.artboardName,
          stateMachine: descriptor.stateMachineName,
          autoplay: true,
          layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
          enableRiveAssetCDN: false,
          shouldDisableRiveListeners: true,
          onAdvance: () => {
            this.frameCount++;
          },
          onLoad: () => {
            loaded = true;
            if (loadTimer !== null) clearTimeout(loadTimer);
            resolve(instance);
          },
          onLoadError: err => {
            if (loadTimer !== null) clearTimeout(loadTimer);
            reject(err);
          },
        });

        loadTimer = setTimeout(() => {
          if (!loaded) {
            reject(new Error('INVALID_ASSET_BUFFER'));
          }
        }, 5000);
      });
    } catch (err) {
      console.error('[RiveManager] Candidate load failure:', err);
      return { activated: false, error: 'INVALID_ASSET_BUFFER' };
    }

    if (generation !== this.activationGeneration) {
      candidateInstance.cleanup();
      return { activated: false, error: 'ACTIVATION_SUPERSEDED' };
    }

    // Verify artboard name
    if (candidateInstance.activeArtboard !== descriptor.artboardName) {
      candidateInstance.cleanup();
      return { activated: false, error: 'ARTBOARD_NOT_FOUND' };
    }

    // Verify state machine name
    if (!candidateInstance.stateMachineNames.includes(descriptor.stateMachineName)) {
      candidateInstance.cleanup();
      return { activated: false, error: 'STATE_MACHINE_NOT_FOUND' };
    }

    // Inspect inputs
    let inputs: StateMachineInput[] | undefined;
    try {
      inputs = candidateInstance.stateMachineInputs(descriptor.stateMachineName);
    } catch (err) {
      console.warn('[RiveManager] Error querying stateMachineInputs:', err);
    }

    if (!inputs) {
      candidateInstance.cleanup();
      return { activated: false, error: 'STATE_MACHINE_NOT_FOUND' };
    }

    const workInput = inputs.find(
      i => i.name === descriptor.inputs.workStatus.name && i.type === StateMachineInputType.Number
    );
    const locoInput = inputs.find(
      i => i.name === descriptor.inputs.locomotion?.name && i.type === StateMachineInputType.Number
    );

    if (!workInput || !locoInput) {
      candidateInstance.cleanup();
      return {
        activated: false,
        error: 'STATE_MACHINE_NOT_FOUND',
      };
    }

    // Bind current cached values to candidate
    workInput.value = this.currentWorkStatus;
    locoInput.value = this.currentLocomotion;

    // Swap canvases on next animation frame
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        if (generation !== this.activationGeneration) {
          candidateInstance.cleanup();
          resolve();
          return;
        }

        candidateCanvas.style.opacity = '1';
        currentCanvas.style.opacity = '0';

        const oldInstance = this.activeInstance;
        this.activeInstance = candidateInstance;
        this.activeSlot = candidateSlot;
        this.activeWorkInput = workInput;
        this.activeLocoInput = locoInput;

        this.activePackId = packId;
        this.activeContractVersion = contractVersion;
        this.activeCapabilities = capabilities;

        // Stage diagnostics
        this.options.stage.setAttribute('data-contract-version', contractVersion);
        this.options.stage.setAttribute('data-render-status', 'ready');
        this.options.stage.setAttribute('data-active-pack', packId);
        this.options.stage.setAttribute('data-work-status', String(this.currentWorkStatus));
        this.options.stage.setAttribute('data-locomotion', String(this.currentLocomotion));

        this.options.idleController.setActiveRive(this.activeInstance);
        this.resizeSurfaces();

        if (oldInstance) {
          try {
            oldInstance.cleanup();
          } catch (cleanErr) {
            console.warn('[RiveManager] Error cleaning up old instance:', cleanErr);
          }
        }
        resolve();
      });
    });

    return { activated: true, packId };
  }

  setLayerState(payload: SetPetStatePayload): void {
    if (payload.workStatus !== undefined) {
      this.currentWorkStatus = payload.workStatus;
      if (this.activeWorkInput) {
        this.activeWorkInput.value = this.currentWorkStatus;
      }
      this.options.stage.setAttribute('data-work-status', String(this.currentWorkStatus));
    }

    if (payload.locomotion !== undefined) {
      this.currentLocomotion = payload.locomotion;
      if (this.activeLocoInput) {
        this.activeLocoInput.value = this.currentLocomotion;
      }
      this.options.stage.setAttribute('data-locomotion', String(this.currentLocomotion));
    }

    this.options.idleController.markActivity();
  }

  getPackState(): PetPackState {
    return {
      activePack: this.activePackId,
      contractVersion: this.activeContractVersion,
      capabilities: this.activeCapabilities,
      workStatus: this.currentWorkStatus,
      locomotion: this.currentLocomotion,
    };
  }

  cleanup(): void {
    if (this.fpsInterval !== null) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
    for (const remove of this.cleanupCallbacks) {
      remove();
    }
    this.cleanupCallbacks.length = 0;

    if (this.activeInstance) {
      try {
        this.activeInstance.cleanup();
      } catch (err) {
        void err;
      }
      this.activeInstance = null;
    }
  }
}
