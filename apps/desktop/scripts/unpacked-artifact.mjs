/**
 * Chooses which unpacked release directory the packaging check verifies.
 *
 * The release directory accumulates output from every platform that has ever packaged in
 * the same working copy, and the filesystem lists those entries in its own order rather
 * than by recency. Taking the first one means a macOS build in a tree that still holds a
 * Linux one verifies the Linux artifact, finds no macOS native binary to complain about,
 * and reports success for a package it never looked at.
 */
const EXPECTED = {
  linux: arch => (arch === 'x64' ? ['linux-unpacked'] : [`linux-${arch}-unpacked`]),
  win32: arch => (arch === 'x64' ? ['win-unpacked'] : [`win-${arch}-unpacked`]),
  // electron-builder names the Intel output `mac` and every other architecture `mac-<arch>`.
  darwin: arch => (arch === 'x64' ? ['mac'] : [`mac-${arch}`]),
};

export function selectUnpackedDirectory(names, platform, arch) {
  const expectedFor = EXPECTED[platform];
  if (!expectedFor) {
    throw new Error(`No unpacked directory naming is known for platform ${platform}.`);
  }

  const wanted = expectedFor(arch);
  const match = names.find(name => wanted.includes(name));
  if (!match) {
    throw new Error(
      `No unpacked directory for ${platform}/${arch} in [${names.join(', ')}]. Expected one of ` +
        `[${wanted.join(', ')}]. Verifying another platform's output would report success for a ` +
        'package this run never produced.'
    );
  }

  return match;
}
