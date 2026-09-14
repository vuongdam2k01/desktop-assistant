const path = require('node:path');

const DEGRADED_CAPABILITIES = Object.freeze({
  presentWithoutActivating: 'framework',
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

  if (process.platform !== 'darwin') {
    return null;
  }

  const candidateNames = [
    `macos-window-${process.arch}.node`,
    'macos-window.node',
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
  applyNoActivateTopmost(handle) {
    return ensureBinding().applyNoActivateTopmost(handle);
  },
  enablePixelHitTest(handle, width, height, alpha) {
    return ensureBinding().enablePixelHitTest(handle, width, height, alpha);
  },
  disablePixelHitTest(handle) {
    return ensureBinding().disablePixelHitTest(handle);
  },
  rememberPreviousFocus() {
    return ensureBinding().rememberPreviousFocus();
  },
  restorePreviousFocus() {
    return ensureBinding().restorePreviousFocus();
  },
  setActivationPolicy(mode) {
    return ensureBinding().setActivationPolicy(mode);
  },
  excludeFromCapture(handle, excluded) {
    return ensureBinding().excludeFromCapture(handle, excluded);
  },
};
