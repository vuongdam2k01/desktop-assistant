import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import { compile } from 'json-schema-to-typescript';
import yaml from 'yaml';
import { discoverContracts, type ContractWinner, type DiscoveryResult } from './discover-contracts.js';

function toPascalCase(str: string): string {
  return str
    .replace(/[_-]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, c => c.toUpperCase());
}

function toConstantCase(str: string): string {
  return str
    .replace(/[-.]/g, '_')
    .toUpperCase();
}

function mapSqlTypeToTs(rawType: string): string {
  const t = rawType.toUpperCase().replace(/\(.*\)/, '').trim();
  switch (t) {
    case 'TEXT':
    case 'VARCHAR':
    case 'CHAR':
    case 'TIMESTAMPTZ':
    case 'TIMESTAMP':
    case 'UUID':
    case 'DATE':
    case 'TIME':
    case 'INTERVAL':
      return 'string';
    case 'INTEGER':
    case 'INT':
    case 'SMALLINT':
    case 'REAL':
    case 'FLOAT':
    case 'DOUBLE':
    case 'DOUBLE PRECISION':
    case 'NUMERIC':
    case 'DECIMAL':
      return 'number';
    case 'BIGINT':
    case 'BIGSERIAL':
    case 'SERIAL':
      return 'string';
    case 'BOOLEAN':
    case 'BOOL':
      return 'boolean';
    case 'JSON':
    case 'JSONB':
      return 'unknown';
    case 'BLOB':
    case 'BYTEA':
      return 'Uint8Array';
    default:
      throw new Error(`Unrecognized SQL type: "${rawType}" (normalized: "${t}")`);
  }
}

interface SqlColumnDef {
  colName: string;
  tsType: string;
  isNotNull: boolean;
}

interface SqlTableDef {
  tableName: string;
  interfaceName: string;
  columns: SqlColumnDef[];
}

export function parseSqlTables(sqlContent: string): SqlTableDef[] {
  let cleanSql = sqlContent.replace(/--.*$/gm, '');
  cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, '');

  const tables: SqlTableDef[] = [];
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = createTableRegex.exec(cleanSql)) !== null) {
    const tableName = match[1];
    if (!tableName) continue;

    const startIndex = match.index + match[0].length;
    let depth = 1;
    let endIndex = -1;

    for (let i = startIndex; i < cleanSql.length; i++) {
      const char = cleanSql[i];
      if (char === '(') depth++;
      else if (char === ')') {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex === -1) {
      throw new Error(`Unbalanced parentheses in CREATE TABLE ${tableName}`);
    }

    const body = cleanSql.slice(startIndex, endIndex);
    const items: string[] = [];
    let cur = '';
    let curDepth = 0;

    for (let i = 0; i < body.length; i++) {
      const char = body[i];
      if (char === '(') curDepth++;
      else if (char === ')') curDepth--;

      if (char === ',' && curDepth === 0) {
        if (cur.trim()) items.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    if (cur.trim()) items.push(cur.trim());

    const tableLevelPks = new Set<string>();
    const columnDefs: SqlColumnDef[] = [];

    for (const item of items) {
      const upper = item.toUpperCase();
      if (
        upper.startsWith('CONSTRAINT') ||
        upper.startsWith('PRIMARY KEY') ||
        upper.startsWith('UNIQUE') ||
        upper.startsWith('FOREIGN KEY') ||
        upper.startsWith('CHECK')
      ) {
        const pkMatch = /(?:CONSTRAINT\s+[a-zA-Z0-9_]+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(item);
        if (pkMatch && pkMatch[1]) {
          const cols = pkMatch[1].split(',').map(c => c.trim().replace(/["`]/g, ''));
          for (const c of cols) tableLevelPks.add(c);
        }
        continue;
      }

      const parts = item.split(/\s+/);
      const colName = parts[0]?.replace(/["`]/g, '') ?? '';
      let rawType = parts[1] ?? '';
      if (parts[2] && parts[2].toUpperCase() === 'PRECISION') {
        rawType += ' ' + parts[2];
      }
      const restUpper = upper;

      const isPk = tableLevelPks.has(colName) || restUpper.includes('PRIMARY KEY');
      const isNotNull = isPk || restUpper.includes('NOT NULL');
      const tsType = mapSqlTypeToTs(rawType);

      columnDefs.push({
        colName,
        tsType,
        isNotNull,
      });
    }

    for (const col of columnDefs) {
      if (tableLevelPks.has(col.colName)) {
        col.isNotNull = true;
      }
    }

    tables.push({
      tableName,
      interfaceName: `${toPascalCase(tableName)}Row`,
      columns: columnDefs,
    });
  }

  return tables;
}

function buildReadmeTable(winners: ContractWinner[]): string {
  const rows: string[] = [
    '| Contract | Version | Descriptor Source | Eligible Artifacts | Superseded Versions |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const w of winners) {
    const artifacts = w.eligibleFiles.length > 0 ? w.eligibleFiles.join(', ') : '*(None - code-level only)*';
    const superseded = w.supersededDescriptors.length > 0 ? w.supersededDescriptors.join('; ') : '*(None)*';
    rows.push(
      `| \`${w.contract}\` | \`${w.version}\` | \`${w.descriptorPath}\` | ${artifacts} | ${superseded} |`
    );
  }

  return rows.join('\n');
}

export async function generateContracts(options: {
  repoRoot: string;
  outputDir: string;
  readmePath?: string;
}): Promise<DiscoveryResult> {
  const { repoRoot, outputDir, readmePath } = options;
  const discovery = discoverContracts(repoRoot);

  // Build schema index for json-schema-to-typescript resolver
  const specDir = path.resolve(repoRoot, 'docs/spec');
  const schemaMap = new Map<string, unknown>();

  function walkFiles(dir: string): string[] {
    let res: string[] = [];
    if (!fs.existsSync(dir)) return res;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) res = res.concat(walkFiles(full));
      else res.push(full);
    }
    return res;
  }

  const allFiles = walkFiles(specDir);
  for (const file of allFiles) {
    if (file.endsWith('.schema.json')) {
      try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (parsed && typeof parsed === 'object' && '$id' in parsed) {
          const idVal = parsed.$id;
          if (typeof idVal === 'string') {
            schemaMap.set(idVal, parsed);
          }
        }
        schemaMap.set(file, parsed);
        schemaMap.set(pathToFileURL(file).href, parsed);
      } catch {
        // ignore invalid temporary files if any
      }
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // Generate each winning contract
  for (const winner of discovery.winners) {
    const contractDir = path.join(outputDir, winner.contract);
    fs.mkdirSync(contractDir, { recursive: true });

    const exportsList: string[] = [];

    if (winner.eligibleFiles.length === 0) {
      // Contract without eligible machine files (e.g. window-integration-module, gate-evaluation)
      const content = `// Generated for contract: ${winner.contract}@${winner.version}
// Source descriptor: ${winner.descriptorPath}
// Note: This contract has no schema, openapi, or sql artifacts.

export const CONTRACT_NAME = '${winner.contract}' as const;
export const CONTRACT_VERSION = '${winner.version}' as const;
`;
      fs.writeFileSync(path.join(contractDir, 'index.ts'), content, 'utf8');
      continue;
    }
    for (const file of winner.eligibleFiles) {
      const fullPath = path.join(winner.descriptorDir, file);

      if (file.endsWith('.schema.json')) {
        const schemaRaw = fs.readFileSync(fullPath, 'utf8');
        const schemaObj = JSON.parse(schemaRaw);
        const baseName = path.basename(file, '.schema.json');
        const tsName = toPascalCase(baseName);
        const constName = `${toConstantCase(baseName)}_SCHEMA`;

        const isTurnSchema = baseName === 'rule-elicitation.turn';
        const jsttOptions = {
          cwd: winner.descriptorDir,
          bannerComment: '',
          declareExternallyReferenced: !isTurnSchema,
          $refOptions: {
            resolve: {
              custom: {
                order: 1,
                canRead(f: { url: string }) {
                  return schemaMap.has(f.url);
                },
                read(f: { url: string }) {
                  return schemaMap.get(f.url);
                },
              },
            },
          },
        };

        let generatedTypes = await compile(schemaObj, tsName, jsttOptions);
        if (isTurnSchema) {
          generatedTypes = `import type { RuleSummaryTable } from './rule-elicitation.schema.js';\n\n${generatedTypes}`;
        }
        const schemaConst = `\nexport const ${constName} = ${JSON.stringify(schemaObj, null, 2)} as const;\n`;

        const targetFile = `${baseName}.schema.ts`;
        fs.writeFileSync(path.join(contractDir, targetFile), `${generatedTypes}\n${schemaConst}`, 'utf8');
        exportsList.push(`export * from './${baseName}.schema.js';`);
      } else if (file.endsWith('.openapi.yaml') || file.endsWith('.openapi.yml')) {
        const yamlRaw = fs.readFileSync(fullPath, 'utf8');
        const openApiDoc = yaml.parse(yamlRaw);
        const baseName = path.basename(file).replace(/\.openapi\.ya?ml$/, '');
        const constName = `${toConstantCase(baseName)}_OPENAPI`;

        const fileUrl = pathToFileURL(fullPath);
        const ast = await openapiTS(fileUrl);
        const generatedTypes = astToString(ast);
        const docConst = `\nexport const ${constName} = ${JSON.stringify(openApiDoc, null, 2)} as const;\n`;

        const targetFile = `${baseName}.openapi.ts`;
        fs.writeFileSync(path.join(contractDir, targetFile), `${generatedTypes}\n${docConst}`, 'utf8');
        exportsList.push(`export * from './${baseName}.openapi.js';`);
      } else if (file.endsWith('.sql')) {
        const sqlRaw = fs.readFileSync(fullPath, 'utf8');
        const tables = parseSqlTables(sqlRaw);
        const baseName = path.basename(file, '.sql');

        let tsCode = `// Generated from ${file}\n`;
        for (const t of tables) {
          tsCode += `\nexport interface ${t.interfaceName} {\n`;
          for (const c of t.columns) {
            tsCode += `  ${c.colName}: ${c.tsType}${c.isNotNull ? '' : ' | null'};\n`;
          }
          tsCode += `}\n`;
        }

        const targetFile = `${baseName}.sql.ts`;
        fs.writeFileSync(path.join(contractDir, targetFile), tsCode, 'utf8');
        exportsList.push(`export * from './${baseName}.sql.js';`);
      }
    }

    const indexContent = `// Generated exports for contract: ${winner.contract}@${winner.version}
export const CONTRACT_NAME = '${winner.contract}' as const;
export const CONTRACT_VERSION = '${winner.version}' as const;

${exportsList.join('\n')}
`;
    fs.writeFileSync(path.join(contractDir, 'index.ts'), indexContent, 'utf8');
  }

  // Generate catalog.ts
  const catalogEntries = discovery.winners.map(w => ({
    contract: w.contract,
    version: w.version,
    descriptorPath: w.descriptorPath,
    artifactPaths: w.eligibleFiles.map(f => `${w.descriptorPath.replace(/[^/]+$/, '')}${f}`),
    supersededDescriptors: w.supersededDescriptors,
    unsupportedArtifacts: w.unsupportedFiles,
  }));

  const catalogContent = `// Auto-generated contract catalog from specification corpus
export interface ContractCatalogEntry {
  contract: string;
  version: string;
  descriptorPath: string;
  artifactPaths: string[];
  supersededDescriptors: string[];
  unsupportedArtifacts?: string[];
}

export const CONTRACT_CATALOG: readonly ContractCatalogEntry[] = ${JSON.stringify(catalogEntries, null, 2)} as const;
`;
  fs.writeFileSync(path.join(outputDir, 'catalog.ts'), catalogContent, 'utf8');

  // Generate root index.ts
  const rootIndexContent = `export * from './catalog.js';\n`;
  fs.writeFileSync(path.join(outputDir, 'index.ts'), rootIndexContent, 'utf8');

  // Update README.md if path provided
  if (readmePath && fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    const table = buildReadmeTable(discovery.winners);
    const startTag = '<!-- CONTRACTS_TABLE_START -->';
    const endTag = '<!-- CONTRACTS_TABLE_END -->';

    const startIndex = readmeContent.indexOf(startTag);
    const endIndex = readmeContent.indexOf(endTag);

    if (startIndex !== -1 && endIndex !== -1) {
      const updatedReadme =
        readmeContent.slice(0, startIndex + startTag.length) +
        '\n' +
        table +
        '\n' +
        readmeContent.slice(endIndex);
      fs.writeFileSync(readmePath, updatedReadme, 'utf8');
    }
  }

  return discovery;
}

// CLI entry point
const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isDirectRun) {
  const repoRoot = path.resolve(import.meta.dirname, '../../..');
  const outputDir = path.resolve(import.meta.dirname, '../src');
  const readmePath = path.resolve(import.meta.dirname, '../README.md');

  console.log(`Generating contracts from ${repoRoot}/docs/spec into ${outputDir}...`);
  generateContracts({ repoRoot, outputDir, readmePath })
    .then(res => {
      console.log(`Successfully generated ${res.totalContracts} contracts!`);
      console.log(`Eligible: ${res.eligibleContractsCount} contracts (${res.counts.jsonSchema} JSON Schema, ${res.counts.openApi} OpenAPI, ${res.counts.sql} SQL).`);
    })
    .catch(err => {
      console.error('Contract generation failed:', err);
      process.exit(1);
    });
}
