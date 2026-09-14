import { describe, it, expect } from 'vitest';
import {
  resolveUserDataOverride,
  resolveDevServerUrl,
  resolvePetAssetOverride,
} from '../main/development-overrides.js';

/**
 * Everything in this module answers one question: may this run honour a directory, a URL
 * or a file path handed to it by the environment? An installed application must always
 * answer no. Anything that can set an environment variable in the user's session — an
 * installer, a shortcut, a shell profile, a compromised launcher — would otherwise choose
 * where the profile lives, what the renderer loads, and which file the animation parser
 * reads, on a build the user trusts because they installed it.
 */
describe('overrides the environment may supply', () => {
  describe('profile directory', () => {
    it('is honoured before the application is packaged', () => {
      expect(
        resolveUserDataOverride({ DESKTOP_ASSISTANT_USER_DATA: '/tmp/profile-a' }, false)
      ).toBe('/tmp/profile-a');
    });

    it('is refused once the application is packaged', () => {
      expect(
        resolveUserDataOverride({ DESKTOP_ASSISTANT_USER_DATA: '/tmp/profile-a' }, true)
      ).toBeUndefined();
    });

    it('treats an absent or blank value as no request', () => {
      expect(resolveUserDataOverride({}, false)).toBeUndefined();
      expect(resolveUserDataOverride({ DESKTOP_ASSISTANT_USER_DATA: '' }, false)).toBeUndefined();
      expect(resolveUserDataOverride({ DESKTOP_ASSISTANT_USER_DATA: '   ' }, false)).toBeUndefined();
    });
  });

  describe('renderer development server', () => {
    it('is honoured before the application is packaged', () => {
      expect(
        resolveDevServerUrl({ VITE_DEV_SERVER_URL_PET: 'http://127.0.0.1:5173' }, 'VITE_DEV_SERVER_URL_PET', false)
      ).toBe('http://127.0.0.1:5173');
    });

    // The preload bridge attaches per window, not per origin, so a renderer loaded from a
    // remote URL would hold the same credential-presence and pet surfaces as the real one.
    it('is refused once the application is packaged', () => {
      expect(
        resolveDevServerUrl({ VITE_DEV_SERVER_URL_PET: 'https://elsewhere.example' }, 'VITE_DEV_SERVER_URL_PET', true)
      ).toBeUndefined();
      expect(
        resolveDevServerUrl({ VITE_DEV_SERVER_URL_APP: 'https://elsewhere.example' }, 'VITE_DEV_SERVER_URL_APP', true)
      ).toBeUndefined();
    });

    it('treats an absent or blank value as no request', () => {
      expect(resolveDevServerUrl({}, 'VITE_DEV_SERVER_URL_PET', false)).toBeUndefined();
      expect(resolveDevServerUrl({ VITE_DEV_SERVER_URL_PET: '  ' }, 'VITE_DEV_SERVER_URL_PET', false)).toBeUndefined();
    });
  });

  describe('pet asset path', () => {
    it('is honoured before the application is packaged when the end-to-end flag is set', () => {
      expect(
        resolvePetAssetOverride(
          { DESKTOP_ASSISTANT_E2E: '1', DESKTOP_ASSISTANT_TEST_PET_ASSET_PATH: '/tmp/pet.riv' },
          false
        )
      ).toBe('/tmp/pet.riv');
    });

    // The path is read in the main process and its bytes are handed to the renderer's
    // animation parser, so honouring it in an installed build is both an arbitrary file
    // read and attacker-chosen input to that parser.
    it('is refused once the application is packaged, flag or no flag', () => {
      expect(
        resolvePetAssetOverride(
          { DESKTOP_ASSISTANT_E2E: '1', DESKTOP_ASSISTANT_TEST_PET_ASSET_PATH: '/tmp/pet.riv' },
          true
        )
      ).toBeUndefined();
    });

    it('requires the end-to-end flag even before packaging', () => {
      expect(
        resolvePetAssetOverride({ DESKTOP_ASSISTANT_TEST_PET_ASSET_PATH: '/tmp/pet.riv' }, false)
      ).toBeUndefined();
    });
  });
});
