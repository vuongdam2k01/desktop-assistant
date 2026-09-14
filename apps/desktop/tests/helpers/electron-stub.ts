/**
 * Stands in for the `electron` module in unit tests.
 *
 * Main-process modules import `app`, `screen` and friends as values, so merely importing
 * one of them in a plain Node process runs the npm package's shim, which goes looking for
 * an Electron binary and prints "Downloading Electron binary...". Two test workers doing
 * that at once raced each other on macOS and one of them failed outright with a file that
 * already existed.
 *
 * Unit tests here drive their subjects through injected fakes and never need a real
 * Electron. The end-to-end suites launch the real application and are unaffected by this.
 */

const notAvailable = (name: string) => () => {
  throw new Error(
    `${name} was called in a unit test. Pass a fake in through the subject's constructor instead of reaching for Electron.`
  );
};

export const app = {
  getPath: notAvailable('app.getPath'),
  getAppPath: () => process.cwd(),
  getName: () => 'DesktopAssistant',
  setName: () => {},
  setPath: () => {},
  isPackaged: false,
  on: () => {},
  once: () => {},
  removeListener: () => {},
  whenReady: async () => {},
  quit: () => {},
  exit: () => {},
  requestSingleInstanceLock: () => true,
  disableHardwareAcceleration: () => {},
};

export const screen = {
  getAllDisplays: notAvailable('screen.getAllDisplays'),
  getPrimaryDisplay: notAvailable('screen.getPrimaryDisplay'),
  getDisplayMatching: notAvailable('screen.getDisplayMatching'),
  on: () => {},
  removeListener: () => {},
};

export const ipcMain = {
  handle: () => {},
  on: () => {},
  removeHandler: () => {},
  removeListener: () => {},
};

export class BrowserWindow {
  constructor() {
    throw new Error(
      'BrowserWindow was constructed in a unit test. Drive the subject with a fake window instead.'
    );
  }
  static getAllWindows(): unknown[] {
    return [];
  }
}

export class MessageChannelMain {
  port1 = { on: () => {}, start: () => {}, close: () => {}, postMessage: () => {} };
  port2 = {};
}

export class Tray {
  constructor() {
    throw new Error('Tray was constructed in a unit test.');
  }
}

export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: notAvailable('safeStorage.encryptString'),
  decryptString: notAvailable('safeStorage.decryptString'),
};

export default {
  app,
  screen,
  ipcMain,
  BrowserWindow,
  MessageChannelMain,
  Tray,
  safeStorage,
};
