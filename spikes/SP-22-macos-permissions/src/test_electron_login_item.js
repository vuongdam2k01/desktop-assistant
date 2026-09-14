const { app } = require('electron');

app.whenReady().then(() => {
  console.log('=== Testing Electron Login Item Settings ===');
  const initial = app.getLoginItemSettings();
  console.log('Initial settings:', JSON.stringify(initial, null, 2));

  // Test setLoginItemSettings
  console.log('\nSetting openAtLogin = true...');
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false
  });

  const updated = app.getLoginItemSettings();
  console.log('Updated settings:', JSON.stringify(updated, null, 2));

  // Cleanup: reset back to false
  console.log('\nResetting openAtLogin = false...');
  app.setLoginItemSettings({
    openAtLogin: false
  });

  const cleaned = app.getLoginItemSettings();
  console.log('Cleaned settings:', JSON.stringify(cleaned, null, 2));

  app.quit();
});
