import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

export interface ContractDescriptor {
  contract: string;
  version: string;
  descriptorPath: string; // relative to repo root
  descriptorDir: string;  // absolute directory
  schemaFiles: string[];
  unsupportedFiles: string[];
  eligibleFiles: string[];
}

export interface ContractWinner {
  contract: string;
  version: string;
  descriptorPath: string;
  descriptorDir: string;
  eligibleFiles: string[];
  unsupportedFiles: string[];
  supersededDescriptors: string[];
}

export interface DiscoveryResult {
  winners: ContractWinner[];
  allDescriptors: ContractDescriptor[];
  totalContracts: number;
  eligibleContractsCount: number;
  counts: {
    jsonSchema: number;
    openApi: number;
    sql: number;
  };
}

export function parseSemver(v: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!match) {
    throw new Error(`Invalid semantic version format: "${v}"`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(a: string, b: string): number {
  const [majA, minA, patchA] = parseSemver(a);
  const [majB, minB, patchB] = parseSemver(b);
  if (majA !== majB) return majA - majB;
  if (minA !== minB) return minA - minB;
  return patchA - patchB;
}

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

export function isEligibleArtifact(fileName: string): boolean {
  return (
    fileName.endsWith('.schema.json') ||
    fileName.endsWith('.openapi.yaml') ||
    fileName.endsWith('.openapi.yml') ||
    fileName.endsWith('.sql')
  );
}

export function discoverContracts(repoRoot: string): DiscoveryResult {
  const specDir = path.resolve(repoRoot, 'docs/spec');
  if (!fs.existsSync(specDir)) {
    throw new Error(`Specification directory not found: ${specDir}`);
  }

  const allFiles = walkDir(specDir);
  const contractDirs = new Set<string>();
  const mdFiles: string[] = [];

  for (const file of allFiles) {
    if (file.includes(path.sep + 'contracts' + path.sep) || file.endsWith(path.sep + 'contracts')) {
      contractDirs.add(path.dirname(file));
      if (file.endsWith('.md')) {
        mdFiles.push(file);
      }
    }
  }

  const allDescriptors: ContractDescriptor[] = [];

  for (const md of mdFiles) {
    const content = fs.readFileSync(md, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (!match) continue;

    let parsed: unknown;
    try {
      parsed = yaml.parse(match[1] ?? '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Malformed YAML front matter in ${md}: ${msg}`, { cause: e });
    }

    if (!parsed || typeof parsed !== 'object') continue;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.contract !== 'string') continue;
    if (typeof rec.version !== 'string') {
      throw new Error(`Descriptor ${md} is missing valid version field.`);
    }
    const contract = rec.contract;
    const version = rec.version;

    // Validate semver
    parseSemver(version);

    const dir = path.dirname(md);
    const declaredFiles: string[] = Array.isArray(rec.schema_files)
      ? rec.schema_files.filter((x): x is string => typeof x === 'string')
      : [];

    const eligibleFiles: string[] = [];
    const unsupportedFiles: string[] = [];

    for (const df of declaredFiles) {
      const fullPath = path.join(dir, df);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Declared schema file not found: ${fullPath} (in ${md})`);
      }
      if (isEligibleArtifact(df)) {
        eligibleFiles.push(df);
      } else {
        unsupportedFiles.push(df);
      }
    }

    allDescriptors.push({
      contract,
      version,
      descriptorPath: path.relative(repoRoot, md).replace(/\\/g, '/'),
      descriptorDir: dir,
      schemaFiles: declaredFiles,
      eligibleFiles,
      unsupportedFiles,
    });
  }

  // Check for orphan machine files in all contract directories
  for (const dir of contractDirs) {
    const dirEntries = fs.readdirSync(dir);
    const declaredInDir = new Set<string>();
    const descriptorsInDir = allDescriptors.filter(d => d.descriptorDir === dir);
    for (const d of descriptorsInDir) {
      for (const sf of d.schemaFiles) {
        declaredInDir.add(sf);
      }
    }

    for (const entry of dirEntries) {
      if (isEligibleArtifact(entry)) {
        if (!declaredInDir.has(entry)) {
          throw new Error(
            `Orphan machine file detected: ${path.join(dir, entry)} is not owned by any descriptor in that directory.`
          );
        }
      }
    }
  }

  // Group by logical contract
  const byContract = new Map<string, ContractDescriptor[]>();
  for (const d of allDescriptors) {
    if (!byContract.has(d.contract)) {
      byContract.set(d.contract, []);
    }
    byContract.get(d.contract)!.push(d);
  }

  const winners: ContractWinner[] = [];
  let jsonSchemaCount = 0;
  let openApiCount = 0;
  let sqlCount = 0;

  for (const [contract, list] of byContract.entries()) {
    // Sort descending by semver
    list.sort((a, b) => compareSemver(b.version, a.version));

    const winner = list[0];
    if (!winner) {
      // A contract key exists only because something was pushed under it, so an empty list
      // means the grouping above is broken rather than that this contract has no versions.
      throw new Error(`Contract "${contract}" was grouped with no descriptors.`);
    }

    // Check for duplicate highest versions
    const runnerUp = list[1];
    if (runnerUp && compareSemver(winner.version, runnerUp.version) === 0) {
      throw new Error(
        `Duplicate winner versions detected for contract "${contract}" at version ${winner.version}: ${winner.descriptorPath} and ${runnerUp.descriptorPath}`
      );
    }

    const superseded = list.slice(1).map(d => `${d.version} (${d.descriptorPath})`);

    for (const f of winner.eligibleFiles) {
      if (f.endsWith('.schema.json')) jsonSchemaCount++;
      else if (f.endsWith('.openapi.yaml') || f.endsWith('.openapi.yml')) openApiCount++;
      else if (f.endsWith('.sql')) sqlCount++;
    }

    winners.push({
      contract: winner.contract,
      version: winner.version,
      descriptorPath: winner.descriptorPath,
      descriptorDir: winner.descriptorDir,
      eligibleFiles: winner.eligibleFiles,
      unsupportedFiles: winner.unsupportedFiles,
      supersededDescriptors: superseded,
    });
  }

  // Sort winners alphabetically by contract name
  winners.sort((a, b) => a.contract.localeCompare(b.contract));

  const eligibleContractsCount = winners.filter(w => w.eligibleFiles.length > 0).length;

  return {
    winners,
    allDescriptors,
    totalContracts: winners.length,
    eligibleContractsCount,
    counts: {
      jsonSchema: jsonSchemaCount,
      openApi: openApiCount,
      sql: sqlCount,
    },
  };
}
