import process from 'node:process';
import { CredentialStoreError } from './errors.js';

export interface CipherGateway {
  isAvailable(): boolean;
  encrypt(value: string): Buffer;
  decrypt(ciphertext: Buffer): string;
}

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
  getSelectedStorageBackend?(): string;
}

export class ElectronSafeStorageCipherGateway implements CipherGateway {
  constructor(
    private readonly safeStorage: SafeStorageLike,
    private readonly platform: NodeJS.Platform = process.platform
  ) {}

  isAvailable(): boolean {
    try {
      if (!this.safeStorage.isEncryptionAvailable()) {
        return false;
      }

      if (this.platform === 'linux') {
        const backend = this.safeStorage.getSelectedStorageBackend?.();
        if (!backend || backend === 'basic_text' || backend === 'unknown') {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  encrypt(value: string): Buffer {
    if (!this.isAvailable()) {
      throw new CredentialStoreError({
        code: 'SECURE_STORAGE_UNAVAILABLE',
      });
    }

    try {
      const ciphertext = this.safeStorage.encryptString(value);
      if (!Buffer.isBuffer(ciphertext) || ciphertext.length === 0) {
        throw new Error();
      }
      return ciphertext;
    } catch (err) {
      if (err instanceof CredentialStoreError) {
        throw err;
      }
      // Never leak native error message or plain text
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  decrypt(ciphertext: Buffer): string {
    if (!this.isAvailable()) {
      throw new CredentialStoreError({
        code: 'SECURE_STORAGE_UNAVAILABLE',
      });
    }

    try {
      const plaintext = this.safeStorage.decryptString(ciphertext);
      if (typeof plaintext !== 'string' || plaintext.length === 0) {
        throw new Error();
      }
      return plaintext;
    } catch (err) {
      if (err instanceof CredentialStoreError) {
        throw err;
      }
      // Never leak native error message or ciphertext
      throw new CredentialStoreError({
        code: 'CREDENTIAL_UNREADABLE',
      });
    }
  }
}
