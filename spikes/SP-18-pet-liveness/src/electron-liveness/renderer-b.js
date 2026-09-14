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

const petContainer = document.getElementById('pet-container-b');
const inlineCard = document.getElementById('inline-card-b');
const canvas = document.getElementById('rive-canvas');
const fallback = document.getElementById('pet-fallback');
const stateBadge = document.getElementById('state-badge');
const fpsVal = document.getElementById('fps-val');

let petX = 100;
let petY = 100;
let cardVisible = false;
let cardOrientation = 'bottom-right';

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
        locomotion: currentLocomotion,
        petX,
        petY,
        cardOrientation
      });
    }
  }
  requestAnimationFrame(updateFps);
}

function initRive() {
  try {
    if (typeof rive === 'undefined') throw new Error('Rive not available');
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
        console.log('[ArchB] Rive loaded');
        requestAnimationFrame(updateFps);
      },
      onLoadError: (e) => {
        console.warn('[ArchB] Rive load error, using fallback avatar', e);
        showFallback();
      }
    });
  } catch (err) {
    console.warn('[ArchB] Init error:', err);
    showFallback();
  }
}

function showFallback() {
  canvas.style.display = 'none';
  fallback.style.display = 'flex';
  requestAnimationFrame(updateFps);
}

function updatePetPosition(x, y) {
  petX = x;
  petY = y;
  petContainer.style.transform = 	ranslate3d(px, px, 0);

  if (cardVisible) {
    updateCardPosition();
  }
}

function updateCardPosition() {
  const cardW = 320;
  const cardH = 140;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  let cx = petX + 210;
  let cy = petY;
  let orient = 'right';

  // Adaptive edge orientation (E1)
  if (cx + cardW > screenW - 20) {
    cx = petX - cardW - 10;
    orient = 'left';
  }
  if (cy + cardH > screenH - 50) {
    cy = screenH - cardH - 50;
  }
  if (cx < 10) {
    cx = 10;
  }
  if (cy < 10) {
    cy = 10;
  }

  cardOrientation = orient;
  inlineCard.style.transform = 	ranslate3d(px, px, 0);
}

// Mouse ignore switching for full-screen overlay click-through
let mouseOverPet = false;
window.addEventListener('mousemove', (e) => {
  const rect = petContainer.getBoundingClientRect();
  const cardRect = cardVisible ? inlineCard.getBoundingClientRect() : { left: -1, right: -1, top: -1, bottom: -1 };

  const inPet = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
  const inCard = cardVisible && (e.clientX >= cardRect.left && e.clientX <= cardRect.right && e.clientY >= cardRect.top && e.clientY <= cardRect.bottom);

  const shouldCapture = inPet || inCard;

  if (shouldCapture !== mouseOverPet) {
    mouseOverPet = shouldCapture;
    if (window.api) {
      window.api.setMouseIgnore(!mouseOverPet);
    }
  }
});

// Dragging
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

petContainer.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  dragOffset.x = e.clientX - petX;
  dragOffset.y = e.clientY - petY;
  petContainer.style.transform = 	ranslate3d(px, px, 0) scale(1.08) rotate(5deg);
  if (window.api) {
    window.api.dragStart({ screenX: e.screenX, screenY: e.screenY, x: petX, y: petY });
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const newX = e.clientX - dragOffset.x;
  const newY = e.clientY - dragOffset.y;
  updatePetPosition(newX, newY);
  if (window.api) {
    window.api.dragMove({ screenX: e.screenX, screenY: e.screenY, x: newX, y: newY });
  }
});

window.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  isDragging = false;
  petContainer.style.transform = 	ranslate3d(px, px, 0);
  if (window.api) {
    window.api.dragEnd({ screenX: e.screenX, screenY: e.screenY, x: petX, y: petY });
  }
});

if (window.api) {
  window.api.onMotionUpdate((data) => {
    if (data.x !== undefined && data.y !== undefined) {
      updatePetPosition(data.x, data.y);
    }
  });

  window.api.onStateChange((data) => {
    if (data.state && STATE_ANIMATIONS[data.state]) {
      currentState = data.state;
      stateBadge.textContent = data.state.toUpperCase().replace('_', ' ');
      if (riveInstance) {
        riveInstance.stop();
        riveInstance.play(STATE_ANIMATIONS[data.state]);
      }
    }
  });

  window.api.onCardShow((data) => {
    cardVisible = true;
    inlineCard.style.display = 'block';
    if (data.type) document.getElementById('card-type').textContent = data.type;
    if (data.text) document.getElementById('card-text').textContent = data.text;
    updateCardPosition();
  });

  window.api.onCardHide(() => {
    cardVisible = false;
    inlineCard.style.display = 'none';
  });
}

initRive();
updatePetPosition(100, 100);
