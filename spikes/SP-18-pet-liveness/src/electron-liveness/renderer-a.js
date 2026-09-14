const STATE_ANIMATIONS = {
  idle: 'Beginner_idle',
  receiving_order: 'Intermediate_hover',
  working: 'Intermediate_idle',
  waiting_approval: 'Beginner_hover',
  has_result: 'Expert_idle'
};

let riveInstance = null;
let currentState = 'idle';
let currentLocomotion = 'standing';

const canvas = document.getElementById('rive-canvas');
const fallback = document.getElementById('pet-fallback');
const stateBadge = document.getElementById('state-badge');
const fpsVal = document.getElementById('fps-val');
const container = document.getElementById('pet-container-a');

let frameCount = 0;
let lastFpsTime = performance.now();
let recentFps = [];

function updateFps(now) {
  frameCount++;
  const delta = now - lastFpsTime;
  if (delta >= 1000) {
    const fps = Math.round((frameCount * 1000) / delta);
    fpsVal.textContent = fps;
    recentFps.push(fps);
    if (recentFps.length > 60) recentFps.shift();
    frameCount = 0;
    lastFpsTime = now;

    if (window.api) {
      window.api.sendMetrics({
        fps,
        state: currentState,
        locomotion: currentLocomotion
      });
    }
  }
  requestAnimationFrame(updateFps);
}

function initRive() {
  try {
    if (typeof rive === 'undefined') {
      throw new Error('Rive runtime not loaded');
    }
    riveInstance = new rive.Rive({
      src: 'assets/skills.riv',
      canvas: canvas,
      autoplay: true,
      animations: [STATE_ANIMATIONS.idle],
      layout: new rive.Layout({
        fit: rive.Fit.Contain,
        alignment: rive.Alignment.Center
      }),
      onLoad: () => {
        console.log('[ArchA] Rive loaded');
        requestAnimationFrame(updateFps);
      },
      onLoadError: (e) => {
        console.warn('[ArchA] Rive load error, using fallback avatar', e);
        showFallback();
      }
    });
  } catch (err) {
    console.warn('[ArchA] Init Rive catch error:', err);
    showFallback();
  }
}

function showFallback() {
  canvas.style.display = 'none';
  fallback.style.display = 'flex';
  requestAnimationFrame(updateFps);
}

function setState(state) {
  if (!STATE_ANIMATIONS[state]) return;
  currentState = state;
  stateBadge.textContent = state.toUpperCase().replace('_', ' ');

  if (riveInstance) {
    try {
      riveInstance.stop();
      riveInstance.play(STATE_ANIMATIONS[state]);
    } catch (e) {
      console.error('Failed to change animation', e);
    }
  }
}

function setLocomotion(loco) {
  currentLocomotion = loco;
  if (loco === 'walking') {
    container.style.animation = 'petBob 0.4s infinite alternate ease-in-out';
  } else if (loco === 'dragged') {
    container.style.animation = 'none';
    container.style.transform = 'scale(1.08) rotate(5deg)';
  } else if (loco === 'falling') {
    container.style.animation = 'none';
    container.style.transform = 'scale(0.95) rotate(-8deg)';
  } else {
    container.style.animation = 'none';
    container.style.transform = 'none';
  }
}

// Dragging
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

container.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  setLocomotion('dragged');
  if (window.api) {
    window.api.dragStart({ screenX: e.screenX, screenY: e.screenY });
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  if (window.api) {
    window.api.dragMove({ screenX: e.screenX, screenY: e.screenY });
  }
});

window.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  isDragging = false;
  setLocomotion('standing');
  if (window.api) {
    window.api.dragEnd({ screenX: e.screenX, screenY: e.screenY });
  }
});

if (window.api) {
  window.api.onStateChange((data) => {
    if (data.state) setState(data.state);
    if (data.locomotion) setLocomotion(data.locomotion);
  });
}

initRive();
