import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

interface ScanRule {
  name: string;
  pattern: RegExp;
}

const RULES: ScanRule[] = [
  {
    name: 'PRIVATE_KEY',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    pattern: /GOCSPX-[a-zA-Z0-9_-]{28}/,
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    pattern: /[0-9]{12}-[a-z0-9]{32}\.apps\.googleusercontent\.com/,
  },
  {
    name: 'RAW_JWT_TOKEN',
    pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
  },
  {
    name: 'BEARER_TOKEN_ASSIGNMENT',
    pattern: /Bearer\s+ey[a-zA-Z0-9_-]{20,}/,
  },
];

export interface ScanFinding {
  filePath: string;
  line: number;
  ruleName: string;
}

export function scanFile(filePath: string, canary?: string | undefined): ScanFinding[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const findings: ScanFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({
          filePath,
          line: lineNum,
          ruleName: rule.name,
        });
      }
    }

    if (canary && canary.length > 8 && line.includes(canary)) {
      findings.push({
        filePath,
        line: lineNum,
        ruleName: 'TEST_CANARY_DETECTED',
      });
    }
  }

  return findings;
}

export function scanDirectory(
  dirPath: string,
  options: {
    canary?: string | undefined;
    excludeFiles?: string[] | undefined;
  } = {}
): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const excludes = new Set(options.excludeFiles || []);

  function walk(currentDir: string): void {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const rel = path.relative(process.cwd(), fullPath);
        if (excludes.has(rel) || excludes.has(entry.name) || rel.includes('scan-secrets.ts')) {
          continue;
        }
        const fileFindings = scanFile(fullPath, options.canary);
        findings.push(...fileFindings);
      }
    }
  }

  walk(dirPath);
  return findings;
}

export function runSecretScan(baseDir: string = process.cwd()): ScanFinding[] {
  const canary = process.env.SECRET_SCAN_CANARY;
  // `backups` is listed so a dump that ever lands in the tree is caught here rather than
  // in a commit; `resolveBackupDirectory` refuses to write one there in the first place.
  const targets = ['src', 'config', 'dist', 'logs', 'backups'];
  const allFindings: ScanFinding[] = [];

  for (const target of targets) {
    const targetPath = path.resolve(baseDir, target);
    if (fs.existsSync(targetPath)) {
      const findings = scanDirectory(targetPath, { canary });
      allFindings.push(...findings);
    }
  }

  return allFindings;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const findings = runSecretScan();
  if (findings.length > 0) {
    process.stderr.write(`SECRET SCAN FAILED: Found ${findings.length} violation(s):\n`);
    for (const f of findings) {
      process.stderr.write(`  ${f.filePath}:${f.line} [${f.ruleName}]\n`);
    }
    process.exit(1);
  } else {
    process.stdout.write('Secret scan clean: 0 violations found.\n');
    process.exit(0);
  }
}
