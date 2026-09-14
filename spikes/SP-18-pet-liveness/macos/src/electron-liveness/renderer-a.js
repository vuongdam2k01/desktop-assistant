const canvas = document.getElementById('rive-canvas-a');

let rInstance = null;
let stateMachineInputs = [];
let workStatusInput = null;
let locomotionInput = null;

let currentWorkStatus = 0; // 0=idle, 1=receiving_order, 2=working, 3=waiting_approval, 4=has_result
let currentLocomotion = 'standing'; // 'standing', 'walking', 'dragged', 'falling'

// FPS tracking
let frameTimes = [];
let lastFrameTime = performance.now();
let framesRendered = 0;
let lastMetricsEmit = performance.now();

function updateMetrics() {
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;
  framesRendered++;

  if (delta > 0) {
    const fps = 1000 / delta;
    frameTimes.push(fps);
    if (frameTimes.length > 60) frameTimes.shift();
  }

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
        arch: 'arch-a'
      });
    }
  }

  requestAnimationFrame(updateMetrics);
}

requestAnimationFrame(updateMetrics);

// Initialize Rive
try {
  rInstance = new rive.Rive({
    src: './assets/skills.riv',
    canvas: canvas,
    autoplay: true,
    stateMachines: 'State Machine 1',
    onLoad: () => {
      console.log('Rive loaded successfully in Arch A');
      const inputs = rInstance.stateMachineInputs('State Machine 1');
      if (inputs && inputs.length > 0) {
        stateMachineInputs = inputs;
        workStatusInput = inputs.find(i => i.name === 'Level' || i.name === 'status' || i.name === 'state');
        if (!workStatusInput) workStatusInput = inputs[0];
      }
    },
    onError: (err) => {
      console.warn('Rive error, falling back to 2D canvas drawing:', err);
      startFallback2DRendering();
    }
  });
} catch (e) {
  console.warn('Rive init caught exception, using fallback 2D canvas:', e);
  startFallback2DRendering();
}

function startFallback2DRendering() {
  const ctx = canvas.getContext('2d');
  let angle = 0;
  function draw() {
    ctx.clearRect(0, 0, 200, 200);
    angle += 0.05;
    // Draw an adorable 2D pet
    ctx.save();
    ctx.translate(100, 100);
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
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// Mouse events for pixel click-through & dragging
canvas.addEventListener('mouseenter', () => {
  window.electronAPI.setIgnoreMouseEvents(false);
});

canvas.addEventListener('mouseleave', () => {
  window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
});

canvas.addEventListener('click', () => {
  window.electronAPI.petClick();
});

// Listen for state changes from Main process
window.electronAPI.onStateUpdate((data) => {
  if (data.workStatus !== undefined) {
    currentWorkStatus = data.workStatus;
    if (workStatusInput) {
      workStatusInput.value = data.workStatus;
    }
  }
  if (data.locomotion) {
    currentLocomotion = data.locomotion;
  }
});
