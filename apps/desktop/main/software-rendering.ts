import process from 'node:process';

export function shouldDisableHardwareAcceleration(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): boolean {
  // 1. Explicit variable override
  if (env.DESKTOP_ASSISTANT_SOFTWARE_RENDERING === '1') {
    return true;
  }

  // 2. Any CI session
  if (env.CI === 'true' || env.CI === '1' || env.GITHUB_ACTIONS === 'true') {
    return true;
  }

  // 3. Linux without DISPLAY / Wayland
  if (platform === 'linux') {
    const hasDisplay = Boolean(env.DISPLAY && env.DISPLAY.trim().length > 0);
    const hasWayland = Boolean(env.WAYLAND_DISPLAY && env.WAYLAND_DISPLAY.trim().length > 0);
    if (!hasDisplay && !hasWayland) {
      return true;
    }
  }

  // 4. Windows RDP / ICA session
  if (platform === 'win32') {
    const sessionName = env.SESSIONNAME?.toLowerCase() || '';
    if (sessionName.startsWith('rdp-') || sessionName.startsWith('ica-')) {
      return true;
    }
    if (env.CLIENTNAME && env.CLIENTNAME.trim().length > 0) {
      return true;
    }
  }

  // 5. Explicit container / hypervisor environment hints
  if (
    Boolean(env.container) ||
    Boolean(env.DOCKER_CONTAINER) ||
    Boolean(env.KUBERNETES_SERVICE_HOST) ||
    Boolean(env.VBOX_MSI_INSTALL_PATH) ||
    Boolean(env.VMWARE_INSTALL_PATH) ||
    Boolean(env.QEMU_AUDIO_DRV) ||
    Boolean(env.WSL_DISTRO_NAME)
  ) {
    return true;
  }

  // Ordinary local sessions keep hardware acceleration
  return false;
}
