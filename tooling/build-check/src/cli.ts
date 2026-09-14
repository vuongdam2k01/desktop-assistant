import path from 'node:path';
import process from 'node:process';
import { checkHarnessPin } from './checks/harness.js';
import { checkSqliteBinding } from './checks/sqlite.js';
import { checkPackaging } from './checks/packaging.js';
import { checkBom } from './checks/bom.js';
import { pathToFileURL } from 'node:url';

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = argv;
  const command = args[0] ?? 'all';

  let repoRoot = process.cwd();
  let artifactPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo-root' && args[i + 1]) {
      repoRoot = path.resolve(args[i + 1]!);
      i++;
    } else if (args[i] === '--artifact' && args[i + 1]) {
      artifactPath = path.resolve(args[i + 1]!);
      i++;
    }
  }

  try {
    switch (command) {
      case 'harness':
        checkHarnessPin(repoRoot);
        console.log('BUILD_CHECK_PASSED: harness pin verified.');
        break;

      case 'sqlite':
        checkSqliteBinding(repoRoot);
        console.log('BUILD_CHECK_PASSED: sqlite binding verified.');
        break;

      case 'packaging':
        checkPackaging(repoRoot, artifactPath);
        console.log(
          `BUILD_CHECK_PASSED: packaging verified${artifactPath ? ' (artifact mode)' : ' (static mode)'}.`
        );
        break;

      case 'bom':
        checkBom(repoRoot);
        console.log('BUILD_CHECK_PASSED: no BOM in configuration files.');
        break;

      case 'all':
        checkHarnessPin(repoRoot);
        checkSqliteBinding(repoRoot);
        checkPackaging(repoRoot, artifactPath);
        checkBom(repoRoot);
        console.log(
          `BUILD_CHECK_PASSED: all checks passed${artifactPath ? ' (artifact mode)' : ''}.`
        );
        break;

      default:
        console.error(`Unknown build-check command: ${command}`);
        console.error('Usage: build-check <harness|sqlite|packaging|bom|all> [--repo-root <dir>] [--artifact <dir>]');
        process.exit(1);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  }
}

// Direct run
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run().catch(err => {
    console.error('Unexpected fatal error in build-check:', err);
    process.exit(1);
  });
}
