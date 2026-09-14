const canvas = document.getElementById('rive-canvas-b');
const ctx = canvas.getContext('2d');
const proxy = document.getElementById('pet-b-proxy');

let petPos = { x: 300, y: 300 };
let currentWorkStatus = 0;
let currentLocomotion = 'standing';

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// FPS tracking for Fullscreen Overlay
let frameTimes = [];
let lastFrameTime = performance.now();
let framesRendered = 0;
let lastMetricsEmit = performance.now();
let angle = 0;

function render() {
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;
  framesRendered++;

  if (delta > 0) {
    const fps = 1000 / delta;
    frameTimes.push(fps);
    if (frameTimes.length > 60) frameTimes.shift();
  }

  // Clear full 1920x1080 canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  angle += 0.05;
  // Draw pet at (petPos.x + 100, petPos.y + 100)
  ctx.save();
  ctx.translate(petPos.x + 100, petPos.y + 100);
  if (currentLocomotion === 'walking') {
    ctx.translate(0, Math.sin(angle * 4) * 4);
  }

  // Body
  ctx.beginPath();
  ctx.arc(0, 0, 45, 0, Math.PI * 2);
  ctx.fillStyle = currentWorkStatus === 2 ? '#8b5cf6' : (currentWorkStatus === 1 ? '#eab308' : '#3b82f6');
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1e293b';
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-15, -8, 12, 0, Math.PI * 2);
  ctx.arc(15, -8, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-13, -8, 6, 0, Math.PI * 2);
  ctx.arc(17, -8, 6, 0, Math.PI * 2);
  ctx.fill();

  // Smile / Mouth
  ctx.beginPath();
  ctx.arc(0, 10, 10, 0, Math.PI);
  ctx.stroke();

  ctx.restore();

  // Position proxy
  proxy.style.left = `${petPos.x}px`;
  proxy.style.top = `${petPos.y}px`;

  if (now - lastMetricsEmit > 500) {
    lastMetricsEmit = now;
    if (frameTimes.length > 0) {
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const avgFps = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
      const minFps = Math.round(sorted[0]);
      const maxFps = Math.round(sorted[sorted.length - 1]);
      const p95Fps = Math.round(sorted[Math.floor(sorted.length * 0.95)] || maxFps);

      window.electronAPI.sendMetrics({
        fps: avgFps,
        avgFps,
        minFps,
        maxFps,
        p95Fps,
        framesRendered,
        arch: 'arch-b'
      });
    }
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

// Mouse hit-testing on Fullscreen Overlay
let isHoveringPet = false;

window.addEventListener('mousemove', (e) => {
  const mx = e.clientX;
  const my = e.clientY;
  const inPet = (mx >= petPos.x && mx <= petPos.x + 200 && my >= petPos.y && my <= petPos.y + 200);

  if (inPet && !isHoveringPet) {
    isHoveringPet = true;
    window.electronAPI.setIgnoreMouseEvents(false);
  } else if (!inPet && isHoveringPet) {
    isHoveringPet = false;
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  }
});

proxy.addEventListener('click', () => {
  window.electronAPI.petClick();
});

// Receive motion updates
window.electronAPI.onMotionUpdate((data) => {
  if (data && data.x !== undefined && data.y !== undefined) {
    petPos.x = data.x;
    petPos.y = data.y;
  }
});

// Receive state updates
window.electronAPI.onStateUpdate((data) => {
  if (data.workStatus !== undefined) currentWorkStatus = data.workStatus;
  if (data.locomotion) currentLocomotion = data.locomotion;
});
