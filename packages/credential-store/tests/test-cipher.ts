import crypto from 'node:crypto';
import type { CipherGateway } from '../src/cipher-gateway.js';
import { CredentialStoreError } from '../src/errors.js';

export class TestBindingCipherGateway implements CipherGateway {
  private available = true;

  constructor(public bindingKey: string) {}

  setAvailable(available: boolean): void {
    this.available = available;
  }

  isAvailable(): boolean {
    return this.available;
  }

  encrypt(value: string): Buffer {
    if (!this.available) {
      throw new CredentialStoreError({
        code: 'SECURE_STORAGE_UNAVAILABLE',
      });
    }

    const key = crypto.createHash('sha256').update(this.bindingKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // 3 bytes prefix ('ENC'), 12 bytes IV, 16 bytes tag, followed by ciphertext body
    const prefix = Buffer.from('ENC');
    return Buffer.concat([prefix, iv, tag, ciphertext]);
  }

  decrypt(ciphertext: Buffer): string {
    if (!this.available) {
      throw new CredentialStoreError({
        code: 'SECURE_STORAGE_UNAVAILABLE',
      });
    }

    if (ciphertext.length < 3 + 12 + 16) {
      throw new CredentialStoreError({
        code: 'CREDENTIAL_UNREADABLE',
      });
    }

    const prefix = ciphertext.subarray(0, 3).toString('utf8');
    if (prefix !== 'ENC') {
      throw new CredentialStoreError({
        code: 'CREDENTIAL_UNREADABLE',
      });
    }

    const iv = ciphertext.subarray(3, 15);
    const tag = ciphertext.subarray(15, 31);
    const encryptedBody = ciphertext.subarray(31);

    const key = crypto.createHash('sha256').update(this.bindingKey).digest();

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(encryptedBody),
        decipher.final(),
      ]).toString('utf8');

      if (plaintext.length === 0) {
        throw new Error();
      }
      return plaintext;
    } catch {
      throw new CredentialStoreError({
        code: 'CREDENTIAL_UNREADABLE',
      });
    }
  }
}
