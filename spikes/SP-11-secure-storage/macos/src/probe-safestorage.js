const { app, safeStorage } = require('electron');

console.log('--- BEFORE app.whenReady() ---');
let beforeReadyAvailable = false;
try {
  beforeReadyAvailable = safeStorage.isEncryptionAvailable();
  console.log('isEncryptionAvailable() before ready:', beforeReadyAvailable);
} catch (err) {
  console.log('isEncryptionAvailable() before ready threw error:', err.message);
}

app.setName('DesktopAssistant-Spike');

app.whenReady().then(async () => {
  console.log('--- AFTER app.whenReady() ---');
  const afterReadyAvailable = safeStorage.isEncryptionAvailable();
  console.log('isEncryptionAvailable() after ready:', afterReadyAvailable);

  if (!afterReadyAvailable) {
    console.error('Encryption not available!');
    app.quit();
    return;
  }

  const plain = 'Hello Desktop Assistant macOS Keychain Spike!';
  console.log('Original plaintext:', plain);

  const encrypted = safeStorage.encryptString(plain);
  console.log('Encrypted buffer length:', encrypted.length);
  console.log('Encrypted buffer hex:', encrypted.toString('hex'));
  console.log('Encrypted header (ascii 3 chars):', encrypted.slice(0, 3).toString('utf8'));

  const decrypted = safeStorage.decryptString(encrypted);
  console.log('Decrypted plaintext:', decrypted);
  console.log('Match:', decrypted === plain);

  app.quit();
});
