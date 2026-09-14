const path = require('node:path');

const DEGRADED_CAPABILITIES = Object.freeze({
  presentWithoutActivating: 'unavailable',
  setPointerPassthrough: 'unavailable',
  setVisibleEverywhere: 'framework',
  restoreFocusTo: 'unavailable',
  setDockPresence: 'framework',
  setExcludedFromCapture: 'framework',
});

let binding = null;
let loadAttempted = false;

function loadBinding() {
  if (loadAttempted) return binding;
  loadAttempted = true;

  if (process.platform !== 'win32') {
    return null;
  }

  const candidateNames = [
    `win32-window-${process.arch}.node`,
    'win32-window.node',
  ];

  for (const name of candidateNames) {
    const fullPath = path.join(__dirname, 'dist', name);
    try {
      binding = require(fullPath);
      return binding;
    } catch {
      // try next candidate
    }
  }

  return null;
}

function ensureBinding() {
  const b = loadBinding();
  if (!b) {
    throw new Error('NATIVE_MODULE_UNAVAILABLE');
  }
  return b;
}

module.exports = {
  capabilities() {
    try {
      const b = loadBinding();
      if (b && typeof b.capabilities === 'function') {
        return b.capabilities();
      }
    } catch {
      // degraded on failure
    }
    return { ...DEGRADED_CAPABILITIES };
  },
  apply_no_activate_topmost(handle) {
    return ensureBinding().apply_no_activate_topmost(handle);
  },
  move_without_activate(handle, placement) {
    return ensureBinding().move_without_activate(handle, placement);
  },
  enable_pixel_hit_test(handle, width, height, alpha) {
    return ensureBinding().enable_pixel_hit_test(handle, width, height, alpha);
  },
  disable_pixel_hit_test(handle) {
    return ensureBinding().disable_pixel_hit_test(handle);
  },
};
