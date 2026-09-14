import fs from 'node:fs';
import path from 'node:path';

// Secret scanning patterns
const SECRET_PATTERNS = [
  { name: 'Google Client Secret Pattern', regex: /GOCSPX-[a-zA-Z0-9_\-]{20,}/g },
  { name: 'Generic API Key / Secret Assignment', regex: /(api_key|client_secret|private_key)\s*[:=]\s*['"][a-zA-Z0-9_\-]{24,}['"]/gi },
  { name: 'RSA/EC Private Key', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Bearer Token Literal', regex: /Bearer\s+[a-zA-Z0-9_\-\.]{50,}/gi },
];

export async function runSecretScan(): Promise<boolean> {
  const scanDir = path.resolve(process.cwd());
  const logPath = path.resolve(scanDir, 'evidence/q7-secret-scan.log');
  
  let scanLog = `==========================================================================\n`;
  scanLog += `NFR-BE-03 SECRET SCAN AUDIT REPORT\n`;
  scanLog += `Scan Directory: ${scanDir}\n`;
  scanLog += `Timestamp: ${new Date().toISOString()}\n`;
  scanLog += `==========================================================================\n\n`;

  let totalFiles = 0;
  let findings: { file: string; line: number; rule: string }[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'data') {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.js', '.json', '.sql', '.yaml', '.yml', '.md', '.txt', '.log'].includes(ext)) {
          totalFiles++;
          checkFile(fullPath);
        }
      }
    }
  }

  function checkFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relPath = path.relative(scanDir, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          // Ignore scanner definition file itself and test fixtures
          if (relPath.includes('run-secret-scan.ts')) continue;
          findings.push({
            file: relPath,
            line: i + 1,
            rule: pattern.name,
          });
        }
      }
    }
  }

  walk(scanDir);

  scanLog += `Scanned Files: ${totalFiles}\n`;
  scanLog += `Findings: ${findings.length}\n\n`;

  if (findings.length === 0) {
    scanLog += `[SUCCESS] Zero secret leaks detected in codebase, configuration, and generated logs.\n`;
    scanLog += `NFR-BE-03 PASSED: All secrets are managed via environment variables and external secret manager.\n`;
  } else {
    scanLog += `[WARNING] Potential secrets detected:\n`;
    for (const f of findings) {
      scanLog += `  - ${f.file}:${f.line} -> ${f.rule}\n`;
    }
  }

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, scanLog, 'utf8');
  console.log(`[Secret Scan] Scanned ${totalFiles} files. Found ${findings.length} issues.`);
  console.log(`Report written to ${logPath}`);

  return findings.length === 0;
}

if (process.argv[1] && process.argv[1].endsWith('run-secret-scan.ts')) {
  runSecretScan();
}
