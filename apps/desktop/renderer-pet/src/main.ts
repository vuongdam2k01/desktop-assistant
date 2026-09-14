import { PetIdleController } from './idle-controller.js';
import { RiveManager } from './rive-manager.js';

function bootstrap(): void {
  const stage = document.getElementById('pet-stage');
  const primaryCanvas = document.getElementById('pet-canvas-primary') as HTMLCanvasElement | null;
  const secondaryCanvas = document.getElementById('pet-canvas-secondary') as HTMLCanvasElement | null;

  if (!stage || !primaryCanvas || !secondaryCanvas) {
    console.error('[PetRenderer] DOM elements missing for pet stage');
    return;
  }

  const idleController = new PetIdleController();
  const riveManager = new RiveManager({
    stage,
    primaryCanvas,
    secondaryCanvas,
    idleController,
  });

  const api = window.desktopApi?.pet;
  if (!api) {
    console.warn('[PetRenderer] desktopApi.pet bridge unavailable');
    return;
  }

  api.onActivatePack(async data => {
    return riveManager.activatePack(
      data.packId,
      data.contractVersion,
      data.descriptor,
      data.capabilities,
      data.buffer
    );
  });

  api.onSetState(payload => {
    riveManager.setLayerState(payload);
  });

  api.onVisibilityChanged(visible => {
    idleController.handleVisibilityChanged(visible);
  });

  api.onActivity(() => {
    idleController.markActivity();
  });

  // Notify main process of readiness
  api.notifyReady();

  window.addEventListener('beforeunload', () => {
    idleController.dispose();
    riveManager.cleanup();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
