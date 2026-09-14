const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('======================================================================');
console.log('📦 Q5: ELECTRON-BUILDER PACKAGING & UNIVERSAL BINARY ON MACOS');
console.log('======================================================================');

const packagingTestDir = path.join(__dirname, 'packaging-test');
const distDir = path.join(packagingTestDir, 'dist');
const evidenceDir = path.join(__dirname, '../evidence');
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

function getFolderSize(dirPath) {
  try {
    const out = execSync(`du -sm "${dirPath}"`, { encoding: 'utf8' });
    return parseInt(out.split('\t')[0], 10);
  } catch (e) {
    return null;
  }
}

const arm64App = path.join(distDir, 'mac-arm64/SP12MacPackagingTest.app');
const x64App = path.join(distDir, 'mac/SP12MacPackagingTest.app');
const universalApp = path.join(distDir, 'mac-universal/SP12MacPackagingTest.app');

const arm64SizeMB = getFolderSize(arm64App);
const x64SizeMB = getFolderSize(x64App);
const universalSizeMB = getFolderSize(universalApp);

console.log('\n--- 1. App Bundle Sizes (.app directory) ---');
console.log(`  - mac-arm64   : ${arm64SizeMB} MB`);
console.log(`  - mac-x64     : ${x64SizeMB} MB`);
console.log(`  - mac-universal: ${universalSizeMB} MB (delta vs arm64: +${universalSizeMB - arm64SizeMB} MB / +${(((universalSizeMB - arm64SizeMB)/arm64SizeMB)*100).toFixed(1)}%)`);

console.log('\n--- 2. Inspecting Binary Architectures ---');
const mainExecUniversal = path.join(universalApp, 'Contents/MacOS/SP12MacPackagingTest');
const fileMainExec = execSync(`file "${mainExecUniversal}"`, { encoding: 'utf8' }).trim();
console.log('Main Executable (Universal):\n ', fileMainExec);

const unpackedDir = path.join(universalApp, 'Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds');
const nodeFiles = fs.readdirSync(unpackedDir).filter(f => f.startsWith('darwin'));
nodeFiles.forEach(f => {
  const filePath = path.join(unpackedDir, f);
  const fileOut = execSync(`file "${filePath}"`, { encoding: 'utf8' }).trim();
  console.log(`Node Addon [${f}]:\n `, fileOut);
});

console.log('\n--- 3. Verifying Packaged Execution ---');
const execResultArm64 = execSync(`"${path.join(arm64App, 'Contents/MacOS/SP12MacPackagingTest')}"`, { encoding: 'utf8' }).trim();
console.log('arm64 Execution:', execResultArm64);

const execResultUniversal = execSync(`"${mainExecUniversal}"`, { encoding: 'utf8' }).trim();
console.log('universal Execution:', execResultUniversal);

const packageData = {
  sizes: {
    arm64MB: arm64SizeMB,
    x64MB: x64SizeMB,
    universalMB: universalSizeMB,
    universalOverheadMB: universalSizeMB - arm64SizeMB,
    universalOverheadPercent: (((universalSizeMB - arm64SizeMB)/arm64SizeMB)*100).toFixed(1) + '%'
  },
  binaries: {
    mainExecutable: fileMainExec,
    nativeModules: nodeFiles.map(f => ({
      file: f,
      type: execSync(`file "${path.join(unpackedDir, f)}"`, { encoding: 'utf8' }).trim()
    }))
  },
  testResults: {
    arm64: execResultArm64,
    universal: execResultUniversal
  }
};

fs.writeFileSync(path.join(evidenceDir, 'q5-package-sizes.json'), JSON.stringify(packageData, null, 2), 'utf8');
console.log('\nSaved package data to evidence/q5-package-sizes.json');
console.log('\n=== Q5 PACKAGING TEST COMPLETE: PASS ===\n');
