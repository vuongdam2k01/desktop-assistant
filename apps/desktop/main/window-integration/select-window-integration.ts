import process from 'node:process';
import {
  type MacOSNativeBinding,
  type Win32NativeBinding,
  type WindowIntegration,
  type WindowIntegrationCapabilities,
} from './types.js';
import { Win32WindowIntegration } from './win32-window-integration.js';
import { MacOSWindowIntegration } from './macos-window-integration.js';
import { UnsupportedWindowIntegration } from './unsupported-window-integration.js';

export interface SelectWindowIntegrationOptions {
  platform?: string;
  win32Binding?: Win32NativeBinding;
  macosBinding?: MacOSNativeBinding;
  skipCapabilityValidation?: boolean;
}

const REQUIRED_WIN32_CAPABILITIES: readonly (keyof WindowIntegrationCapabilities)[] = [
  'presentWithoutActivating',
  'setPointerPassthrough',
  'setVisibleEverywhere',
  'setDockPresence',
  'setExcludedFromCapture',
];

const REQUIRED_MACOS_CAPABILITIES: readonly (keyof WindowIntegrationCapabilities)[] = [
  'presentWithoutActivating',
  'setPointerPassthrough',
  'setVisibleEverywhere',
  'restoreFocusTo',
  'setDockPresence',
  'setExcludedFromCapture',
];

function assertRequiredCapabilities(
  caps: Readonly<WindowIntegrationCapabilities>,
  required: readonly (keyof WindowIntegrationCapabilities)[]
): void {
  for (const cap of required) {
    if (caps[cap] === 'unavailable') {
      throw new Error(`WINDOW_INTEGRATION_REQUIRED_CAPABILITY_MISSING:${cap}`);
    }
  }
}

export function selectWindowIntegration(
  options?: SelectWindowIntegrationOptions
): WindowIntegration {
  const targetPlatform = options?.platform ?? process.platform;

  switch (targetPlatform) {
    case 'win32': {
      const integration = new Win32WindowIntegration(options?.win32Binding);
      if (!options?.skipCapabilityValidation) {
        assertRequiredCapabilities(integration.capabilities(), REQUIRED_WIN32_CAPABILITIES);
      }
      return integration;
    }
    case 'darwin': {
      const integration = new MacOSWindowIntegration(options?.macosBinding);
      if (!options?.skipCapabilityValidation) {
        assertRequiredCapabilities(integration.capabilities(), REQUIRED_MACOS_CAPABILITIES);
      }
      return integration;
    }
    default: {
      return new UnsupportedWindowIntegration();
    }
  }
}
