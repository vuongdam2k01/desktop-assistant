import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateContracts } from './generate.js';

function walkDir(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export async function checkContractsDrift(repoRoot: string): Promise<boolean> {
  const actualSrcDir = path.resolve(repoRoot, 'packages/contracts/src');
  const actualReadme = path.resolve(repoRoot, 'packages/contracts/README.md');

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'da-contracts-check-'));
  const tmpSrcDir = path.join(tmpBase, 'src');
  const tmpReadme = path.join(tmpBase, 'README.md');

  // Copy actual README to temp so table can be rendered into it
  if (fs.existsSync(actualReadme)) {
    fs.copyFileSync(actualReadme, tmpReadme);
  }

  try {
    await generateContracts({
      repoRoot,
      outputDir: tmpSrcDir,
      readmePath: tmpReadme,
    });

    const drifted: string[] = [];

    const actualFiles = walkDir(actualSrcDir).map(p => path.relative(actualSrcDir, p).replace(/\\/g, '/'));
    const tmpFiles = walkDir(tmpSrcDir).map(p => path.relative(tmpSrcDir, p).replace(/\\/g, '/'));

    const allFileSet = new Set([...actualFiles, ...tmpFiles]);

    for (const rel of allFileSet) {
      const actPath = path.join(actualSrcDir, rel);
      const tmpPath = path.join(tmpSrcDir, rel);

      if (!fs.existsSync(actPath)) {
        drifted.push(`Missing in contracts/src: ${rel}`);
        continue;
      }
      if (!fs.existsSync(tmpPath)) {
        drifted.push(`Superfluous in contracts/src: ${rel}`);
        continue;
      }

      const actBuf = fs.readFileSync(actPath);
      const tmpBuf = fs.readFileSync(tmpPath);

      if (!actBuf.equals(tmpBuf)) {
        drifted.push(`Content mismatch: ${rel}`);
      }
    }

    // Compare README
    if (fs.existsSync(actualReadme) && fs.existsSync(tmpReadme)) {
      const actReadmeContent = fs.readFileSync(actualReadme, 'utf8');
      const tmpReadmeContent = fs.readFileSync(tmpReadme, 'utf8');
      if (actReadmeContent !== tmpReadmeContent) {
        drifted.push('README.md contracts table mismatch');
      }
    }

    if (drifted.length > 0) {
      console.error('CONTRACT_DRIFT_DETECTED: Generated contracts are not in sync with docs/spec:');
      for (const d of drifted) {
        console.error(`  - ${d}`);
      }
      console.error('Run "pnpm contracts:generate" to regenerate contracts.');
      return false;
    }

    console.log('CONTRACT_CHECK_PASSED: Contracts are in sync with docs/spec.');
    return true;
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isDirectRun) {
  const repoRoot = path.resolve(import.meta.dirname, '../../..');
  checkContractsDrift(repoRoot)
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(err => {
      console.error('Contract check failed with error:', err);
      process.exit(1);
    });
}
