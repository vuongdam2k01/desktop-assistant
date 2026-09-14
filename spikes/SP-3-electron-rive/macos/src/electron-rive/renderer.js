const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// State mapping according to FR-PET-02
const STATE_ANIMATIONS = {
  idle: 'Beginner_idle',
  receiving_order: 'Intermediate_hover',
  working: 'Intermediate_idle',
  waiting_approval: 'Beginner_hover',
  has_result: 'Expert_idle'
};

let riveInstance = null;
let currentState = 'idle';
let currentAnimation = STATE_ANIMATIONS.idle;
let currentRivPath = path.join(__dirname, 'assets', 'skills.riv');

// Elements
const canvas = document.getElementById('rive-canvas');
const stateBadge = document.getElementById('state-badge');
const fpsVal = document.getElementById('fps-val');
const hud = document.getElementById('hud');

// High precision FPS counter
let frameCount = 0;
let lastFpsUpdate = performance.now();
let recentFpsList = []; // store 1-second rolling FPS readings
let isAnimationActive = true;
let totalFramesRendered = 0;

function updateFps(now) {
  frameCount++;
  totalFramesRendered++;
  const delta = now - lastFpsUpdate;

  if (delta >= 1000) {
    const fps = Math.round((frameCount * 1000) / delta);
    fpsVal.textContent = fps;
    recentFpsList.push(fps);
    if (recentFpsList.length > 300) recentFpsList.shift();

    frameCount = 0;
    lastFpsUpdate = now;

    // Send metrics to main process
    sendMetrics(fps);
  }

  requestAnimationFrame(updateFps);
}

function sendMetrics(currentFps) {
  if (recentFpsList.length === 0) return;

  const sorted = [...recentFpsList].sort((a, b) => a - b);
  const minFps = sorted[0];
  const maxFps = sorted[sorted.length - 1];
  const avgFps = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p95Fps = sorted[p95Index] || sorted[sorted.length - 1];

  ipcRenderer.send('update-metrics', {
    currentFps,
    avgFps,
    minFps,
    maxFps,
    p95Fps,
    sampleCount: recentFpsList.length,
    activeState: currentState,
    totalFramesRendered,
    fpsHistory: recentFpsList.slice(-30) // last 30 seconds
  });
}

function initRive(customPath) {
  try {
    const rivPath = customPath || currentRivPath;
    currentRivPath = rivPath;
    const buf = fs.readFileSync(rivPath);

    if (riveInstance) {
      try { riveInstance.cleanup(); } catch (e) {}
    }

    riveInstance = new rive.Rive({
      buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      canvas: canvas,
      autoplay: true,
      animations: [currentAnimation],
      layout: new rive.Layout({
        fit: rive.Fit.Contain,
        alignment: rive.Alignment.Center
      }),
      locateFile: (file) => path.join(__dirname, 'assets', file),
      onLoad: () => {
        console.log('[Rive] Loaded successfully from:', rivPath, 'with animation:', currentAnimation);
      },
      onLoadError: (err) => {
        console.error('[Rive] Load error:', err);
      }
    });

  } catch (err) {
    console.error('[Rive] Init error:', err);
  }
}

function changeState(targetState) {
  if (!STATE_ANIMATIONS[targetState]) {
    console.warn('Unknown state:', targetState);
    return;
  }

  const startTime = performance.now();
  const animName = STATE_ANIMATIONS[targetState];

  if (riveInstance) {
    riveInstance.stop(currentAnimation);
    riveInstance.play(animName);
    currentAnimation = animName;
  }

  currentState = targetState;
  stateBadge.textContent = targetState.replace('_', ' ');
  stateBadge.className = 'badge badge-' + targetState;

  // Wait for next RAF to guarantee frame rendered
  requestAnimationFrame(() => {
    const latencyMs = parseFloat((performance.now() - startTime).toFixed(2));
    console.log(`[State Transition] Changed to ${targetState} in ${latencyMs}ms`);

    ipcRenderer.send('state-transition-done', {
      state: targetState,
      animation: animName,
      latencyMs: latencyMs,
      timestamp: Date.now()
    });
  });
}

// Inspect WebGL Context for GPU verification
function getWebGLInfo() {
  try {
    const offscreen = document.createElement('canvas');
    const gl = offscreen.getContext('webgl2') || offscreen.getContext('webgl');
    if (!gl) return { error: 'No WebGL context found' };

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'N/A',
      unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'N/A',
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      version: gl.getParameter(gl.VERSION)
    };
  } catch (e) {
    return { error: e.message };
  }
}

// IPC Listeners
ipcRenderer.on('change-state', (event, newState) => {
  changeState(newState);
});

ipcRenderer.on('reset-fps', () => {
  frameCount = 0;
  lastFpsUpdate = performance.now();
  recentFpsList = [];
  console.log('[FPS] Reset counter');
});

ipcRenderer.on('toggle-hud', (event, show) => {
  if (show === false) {
    hud.classList.add('hidden');
  } else {
    hud.classList.remove('hidden');
  }
});

ipcRenderer.on('load-asset', (event, assetName) => {
  const newPath = path.join(__dirname, 'assets', assetName);
  console.log('[Rive] Dynamic asset loading requested:', newPath);
  initRive(newPath);
  ipcRenderer.send('asset-loaded', { asset: assetName, path: newPath, status: 'ok' });
});

ipcRenderer.on('get-renderer-gpu-info', (event) => {
  const info = getWebGLInfo();
  ipcRenderer.send('renderer-gpu-info-reply', info);
});

// Start Rive and FPS loop
initRive();
requestAnimationFrame(updateFps);
