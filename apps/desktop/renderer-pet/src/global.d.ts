/// <reference types="vite/client" />
import type { DesktopApi } from '../../preload/index.js';

declare module '*.wasm?url' {
  const url: string;
  export default url;
}

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}
