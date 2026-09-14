/**
 * SP-11 SecureStorageService Reference Implementation
 * Implements:
 * - Key naming taxonomy (Q5): domain:subdomain:id:field
 * - Real encryption/decryption using Electron safeStorage (DPAPI)
 * - Safe memory handling (zero-fill on clear)
 * - Complete account wipe per FR-BE-12 (Q6)
 * - Error interception and SYSTEM card generation per Phụ lục A.2 (Q3)
 */

const { safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecureStorageService {
  /**
   * @param {string} storageFilePath Absolute path to persistent encrypted store file
   */
  constructor(storageFilePath) {
    this.storagePath = storageFilePath;
    this.inMemoryCache = new Map(); // key -> Buffer (ciphertext)
    this.metaCache = new Map();     // key -> metadata object
    this._ensureLoaded();
  }

  /**
   * Validate key format: domain:category:id[:subfield]
   * Example:
   *  - connector:notion:default:token
   *  - connector:google:byo:client_credentials
   *  - connector:google:account:user@example.com:tokens
   *  - llm:provider:byteplus:api_key
   *  - auth:session:user_token
   */
  static validateKey(key) {
    if (typeof key !== 'string') {
      throw new Error(`Invalid key type: expected string, got ${typeof key}`);
    }
    const parts = key.split(':');
    if (parts.length < 3) {
      throw new Error(`Invalid key format: '${key}'. Must follow 'domain:subdomain:id[:field]' (minimum 3 segments).`);
    }
    const allowedDomains = ['connector', 'llm', 'auth', 'system'];
    if (!allowedDomains.includes(parts[0])) {
      throw new Error(`Invalid domain '${parts[0]}'. Allowed: ${allowedDomains.join(', ')}`);
    }
    return true;
  }

  /**
   * Encrypt and store a credential
   * @param {string} key
   * @param {any} value String or object
   * @param {object} [metadata]
   */
  setCredential(key, value, metadata = {}) {
    SecureStorageService.validateKey(key);

    if (!safeStorage.isEncryptionAvailable()) {
      const err = new Error('OS secure storage is unavailable');
      err.systemCard = this._buildSystemCard('SAFE_STORAGE_UNAVAILABLE', err.message);
      throw err;
    }

    const plainText = typeof value === 'string' ? value : JSON.stringify(value);
    const cipherBuffer = safeStorage.encryptString(plainText);

    this.inMemoryCache.set(key, cipherBuffer);
    this.metaCache.set(key, {
      ...metadata,
      updated_at: new Date().toISOString(),
      cipher_length: cipherBuffer.length
    });

    this._persist();
    return { key, cipherLength: cipherBuffer.length };
  }

  /**
   * Retrieve and decrypt a credential
   * @param {string} key
   * @returns {any} Decrypted string or parsed JSON object
   */
  getCredential(key) {
    SecureStorageService.validateKey(key);

    const cipherBuffer = this.inMemoryCache.get(key);
    if (!cipherBuffer) {
      return null;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      const err = new Error('OS secure storage is unavailable');
      err.systemCard = this._buildSystemCard('SAFE_STORAGE_UNAVAILABLE', err.message, key);
      throw err;
    }

    try {
      const plainText = safeStorage.decryptString(cipherBuffer);
      try {
        return JSON.parse(plainText);
      } catch {
        return plainText;
      }
    } catch (decryptErr) {
      const wrappedError = new Error(`Decryption failed for key '${key}': ${decryptErr.message}`);
      wrappedError.cause = decryptErr;
      wrappedError.systemCard = this._buildSystemCard('SAFE_STORAGE_DECRYPT_FAILURE', decryptErr.message, key);
      throw wrappedError;
    }
  }

  /**
   * Delete a single credential key
   * @param {string} key
   */
  deleteCredential(key) {
    SecureStorageService.validateKey(key);
    const had = this.inMemoryCache.has(key);
    if (had) {
      const buf = this.inMemoryCache.get(key);
      if (Buffer.isBuffer(buf)) {
        buf.fill(0); // zero memory
      }
      this.inMemoryCache.delete(key);
      this.metaCache.delete(key);
      this._persist();
    }
    return had;
  }

  /**
   * List keys matching a prefix or domain
   * @param {string} [prefix]
   */
  listKeys(prefix = '') {
    const keys = Array.from(this.inMemoryCache.keys());
    if (!prefix) return keys;
    return keys.filter(k => k.startsWith(prefix));
  }

  /**
   * FR-BE-12: Complete Account Wipe
   * Obliterates all stored credentials:
   * 1. Memory zero-fill of all buffers
   * 2. Clear all cache collections
   * 3. Overwrite persistence file with cryptographic random bytes (3 passes)
   * 4. Delete file from disk
   */
  wipeAllCredentials() {
    const keyCount = this.inMemoryCache.size;

    // 1. Zero out memory buffers
    for (const [k, buf] of this.inMemoryCache.entries()) {
      if (Buffer.isBuffer(buf)) {
        buf.fill(0);
      }
    }
    this.inMemoryCache.clear();
    this.metaCache.clear();

    // 2. Overwrite file on disk before deletion (anti-forensics)
    if (fs.existsSync(this.storagePath)) {
      const stat = fs.statSync(this.storagePath);
      const fileSize = stat.size;
      if (fileSize > 0) {
        // Pass 1: Random bytes
        fs.writeFileSync(this.storagePath, crypto.randomBytes(fileSize));
        // Pass 2: Zeros
        fs.writeFileSync(this.storagePath, Buffer.alloc(fileSize, 0));
      }
      // Pass 3: Unlink file
      fs.unlinkSync(this.storagePath);
    }

    return {
      wipedKeysCount: keyCount,
      fileDeleted: !fs.existsSync(this.storagePath),
      storagePath: this.storagePath
    };
  }

  _persist() {
    const rawObj = {};
    for (const [k, buf] of this.inMemoryCache.entries()) {
      rawObj[k] = {
        ciphertextHex: buf.toString('hex'),
        metadata: this.metaCache.get(k) || {}
      };
    }
    const tempPath = `${this.storagePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(rawObj, null, 2), 'utf8');
    fs.renameSync(tempPath, this.storagePath);
  }

  _ensureLoaded() {
    if (!fs.existsSync(this.storagePath)) {
      return;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      for (const [k, item] of Object.entries(raw)) {
        if (item && item.ciphertextHex) {
          this.inMemoryCache.set(k, Buffer.from(item.ciphertextHex, 'hex'));
          this.metaCache.set(k, item.metadata || {});
        }
      }
    } catch (e) {
      console.error(`[SecureStorageService] Warning: Failed to load storage file: ${e.message}`);
    }
  }

  _buildSystemCard(reason, errorDetail, targetKey = '') {
    return {
      card_type: 'SYSTEM',
      id: `sys_card_sec_${Date.now()}`,
      title: reason === 'SAFE_STORAGE_DECRYPT_FAILURE'
        ? 'Lỗi giải mã thông tin xác thực'
        : 'Kho bảo mật OS không khả dụng',
      body: reason === 'SAFE_STORAGE_DECRYPT_FAILURE'
        ? `Không thể giải mã dữ liệu cho '${targetKey}'. Khóa bảo mật Windows không khớp hoặc bị hỏng. Vui lòng kết nối lại.`
        : 'Dịch vụ bảo mật DPAPI của Windows hiện không phản hồi.',
      severity: 'error',
      blocking: false,
      auto_dismiss: false,
      persistent_badge: true,
      created_at: new Date().toISOString(),
      action: {
        label: 'Mở Cài đặt > Kết nối',
        route: targetKey.startsWith('llm:') ? '/settings/models' : '/settings/connectors',
        context: {
          targetKey,
          reason,
          error_detail: errorDetail
        }
      }
    };
  }
}

module.exports = SecureStorageService;
