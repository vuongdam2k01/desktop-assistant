import process from 'node:process';

/**
 * Everything an unpackaged run may take from its environment, and an installed one may not.
 *
 * Each of these hands the application a directory, a URL or a file path chosen by whoever
 * set the variable. That is exactly what a development run needs and exactly what a shipped
 * build must refuse: anything able to set a variable in the user's session — an installer, a
 * shortcut, a shell profile, a launcher that has been tampered with — would otherwise decide
 * where the profile lives, what the renderer loads, and which file the animation parser
 * reads, on a build the user trusts because they installed it.
 *
 * The decision therefore belongs here, once, rather than at each place a variable is read.
 */
function requested(env: NodeJS.ProcessEnv, name: string, isPackaged: boolean): string | undefined {
  if (isPackaged) {
    return undefined;
  }

  const value = env[name];
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

/**
 * The profile directory for this run.
 *
 * The profile holds the local database that is the authoritative working copy on this
 * device. An installed application must always use the directory the operating system
 * assigns it; otherwise the user would reconnect their accounts into a directory someone
 * else chose, with no sign that the profile had moved.
 */
export function resolveUserDataOverride(
  env: NodeJS.ProcessEnv = process.env,
  isPackaged = true
): string | undefined {
  return requested(env, 'DESKTOP_ASSISTANT_USER_DATA', isPackaged);
}

/**
 * The address a renderer is loaded from while a development server is running.
 *
 * The preload bridge attaches to a window, not to an origin, so a renderer loaded from a
 * remote address would hold the same credential-presence and pet surfaces as the real one.
 * The navigation guards do not help here, because they cover navigation the renderer starts,
 * not a load the main process performs itself.
 */
export function resolveDevServerUrl(
  env: NodeJS.ProcessEnv,
  name: 'VITE_DEV_SERVER_URL_PET' | 'VITE_DEV_SERVER_URL_APP',
  isPackaged = true
): string | undefined {
  return requested(env, name, isPackaged);
}

/**
 * The animation file the pet is built from.
 *
 * The path is read in the main process and its bytes are handed to the renderer's animation
 * parser, so honouring it in an installed build would be both an arbitrary file read and
 * attacker-chosen input to that parser. The end-to-end flag stays as a second condition so
 * an ordinary development run still uses the packaged asset.
 */
export function resolvePetAssetOverride(
  env: NodeJS.ProcessEnv = process.env,
  isPackaged = true
): string | undefined {
  if (env.DESKTOP_ASSISTANT_E2E !== '1') {
    return undefined;
  }

  return requested(env, 'DESKTOP_ASSISTANT_TEST_PET_ASSET_PATH', isPackaged);
}
