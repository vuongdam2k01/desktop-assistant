const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const SecureStorageService = require('./secure-storage-service');

app.setName('DesktopAssistant');

const evidenceDir = path.join(__dirname, '../evidence');
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

app.whenReady().then(async () => {
  console.log('=== Starting SecureStorageService macOS Test Suite ===');
  const storePath = path.join(__dirname, '../evidence/test-store.json');
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);

  const service = new SecureStorageService(storePath, 'DesktopAssistant');
  const suiteResults = {
    timestamp: new Date().toISOString(),
    taxonomyTests: [],
    tamperTests: [],
    wipeTests: {}
  };

  // 1. Taxonomy & Real Credential Storage Test (Q5)
  console.log('\n--- 1. Testing Key Taxonomy & Storage ---');
  const credentialsToTest = [
    {
      key: 'connector:notion:default:token',
      value: { token: 'secret_' + 'a'.repeat(48), workspace_name: 'Engineering Team', workspace_id: 'ws_123' },
      metadata: { description: 'Notion OAuth access token' }
    },
    {
      key: 'connector:google:byo:client_credentials',
      value: {
        installed: {
          client_id: '123456789.apps.googleusercontent.com',
          client_secret: 'GOCSPX-SecretKey123456789',
          project_id: 'da-desktop-prod'
        }
      },
      metadata: { description: 'BYO OAuth Client JSON (FR-CF-11)' }
    },
    {
      key: 'connector:google:account:user@example.com:tokens',
      value: {
        access_token: 'ya29.' + 'b'.repeat(80),
        refresh_token: '1//04' + 'c'.repeat(80),
        expires_at: Date.now() + 3600000
      },
      metadata: { description: 'Google user session tokens' }
    },
    {
      key: 'llm:provider:byteplus:api_key',
      value: 'bp-api-key-' + 'd'.repeat(32),
      metadata: { provider: 'byteplus', model: 'doubao-pro-128k' }
    },
    {
      key: 'auth:session:main',
      value: {
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'e'.repeat(64),
        userId: 'usr_mac_test_001',
        email: 'user@example.com'
      },
      metadata: { description: 'App User Session (FR-BE-01)' }
    }
  ];

  for (const item of credentialsToTest) {
    const storeRes = service.setCredential(item.key, item.value, item.metadata);
    const retrieved = service.getCredential(item.key);
    const match = JSON.stringify(retrieved) === JSON.stringify(item.value);
    console.log(`[TAXONOMY] ${item.key} -> stored ${storeRes.cipherLength} B, match = ${match}`);
    suiteResults.taxonomyTests.push({
      key: item.key,
      cipherLength: storeRes.cipherLength,
      match
    });
  }

  // Verify prefix search
  const connectorKeys = service.listKeys('connector:');
  console.log(`Found ${connectorKeys.length} connector keys:`, connectorKeys);

  // 2. Tamper & Error Handling Tests (Q4, Phụ lục A.2)
  console.log('\n--- 2. Testing Tamper & SYSTEM Card Generation ---');
  const testKey = 'connector:notion:default:token';
  const rawCipher = service.inMemoryCache.get(testKey);

  // Tamper Case A: Flip a byte in the ciphertext
  const tamperedCipher = Buffer.from(rawCipher);
  tamperedCipher[tamperedCipher.length - 2] ^= 0xFF; // flip bit near end
  service.inMemoryCache.set(testKey, tamperedCipher);

  try {
    service.getCredential(testKey);
    console.error('Tamper test A FAILED: expected error but got success!');
  } catch (err) {
    console.log('[TAMPER A] Successfully intercepted corrupted ciphertext error:', err.message);
    console.log('[TAMPER A] Generated SYSTEM Card:', JSON.stringify(err.systemCard, null, 2));
    suiteResults.tamperTests.push({
      case: 'Flipped byte in ciphertext',
      errorMessage: err.message,
      systemCard: err.systemCard
    });
  }

  // Tamper Case B: Corrupt header (change v10 to v99)
  const headerCorruptCipher = Buffer.from(rawCipher);
  headerCorruptCipher[1] = 0x39; // '9'
  headerCorruptCipher[2] = 0x39; // '9'
  service.inMemoryCache.set(testKey, headerCorruptCipher);

  try {
    service.getCredential(testKey);
    console.error('Tamper test B FAILED: expected error but got success!');
  } catch (err) {
    console.log('[TAMPER B] Successfully intercepted header corruption error:', err.message);
    console.log('[TAMPER B] Generated SYSTEM Card:', JSON.stringify(err.systemCard, null, 2));
    suiteResults.tamperTests.push({
      case: 'Corrupted header prefix',
      errorMessage: err.message,
      systemCard: err.systemCard
    });
  }

  // Restore original
  service.inMemoryCache.set(testKey, rawCipher);

  // 3. FR-BE-12 Account Wipe Test (Q6)
  console.log('\n--- 3. Testing FR-BE-12 Complete Account Wipe ---');
  const preWipeKeyCount = service.listKeys().length;
  console.log(`Pre-wipe key count: ${preWipeKeyCount}`);
  console.log(`Pre-wipe store file exists: ${fs.existsSync(storePath)}`);

  const wipeResult = service.wipeAllCredentials(true);
  console.log('Wipe execution result:', wipeResult);

  const postWipeKeyCount = service.listKeys().length;
  const postWipeFileExists = fs.existsSync(storePath);
  console.log(`Post-wipe key count: ${postWipeKeyCount}`);
  console.log(`Post-wipe file exists: ${postWipeFileExists}`);

  // Verify OS Keychain clean
  let keychainCheckOutput = '';
  try {
    keychainCheckOutput = execSync('security find-generic-password -s "DesktopAssistant Safe Storage" 2>&1 || true').toString();
  } catch (e) {
    keychainCheckOutput = e.message;
  }
  const isKeychainClean = keychainCheckOutput.includes('The specified item could not be found in the keychain') || keychainCheckOutput.includes('SecKeychainSearchCopyNext: The specified item could not be found');
  console.log(`Keychain item removed cleanly: ${isKeychainClean} (output: ${keychainCheckOutput.trim()})`);

  suiteResults.wipeTests = {
    preWipeKeyCount,
    postWipeKeyCount,
    postWipeFileExists,
    wipeResult,
    isKeychainClean,
    keychainCheckOutput: keychainCheckOutput.trim()
  };

  const outPath = path.join(evidenceDir, 'q5-q6-service-suite-results.json');
  fs.writeFileSync(outPath, JSON.stringify(suiteResults, null, 2));
  console.log(`\nSuite finished. Results written to ${outPath}`);

  app.quit();
});
