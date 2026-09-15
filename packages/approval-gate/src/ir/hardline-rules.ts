import type { SystemRule } from '../types.js';

/**
 * Normative Hardline Blocklist (FR-AP-10, Constitution Principle II).
 * Built into the application binaries. Never stored in editable database,
 * evaluated before any mode checks, strictly unappealable.
 */
export const HARDLINE_RULES: readonly SystemRule[] = [
  {
    id: 'HL-01-DATABASE-DELETION',
    name: 'Block Whole Database / Workspace Root Deletion or Archival',
    description:
      'Bulk deletion or archival at the level of a whole database or a root workspace is refused in every mode.',
    origin: 'hardline',
    verdict: 'refuse',
    unappealable: true,
    condition: {
      kind: 'any',
      of: [
        // Direct database archive / deletion tools
        {
          kind: 'tool',
          tool: ['archive_database', 'delete_database', 'delete_workspace', 'archive_workspace'],
        },
        // Database update with archived = true
        {
          kind: 'all',
          of: [
            {
              kind: 'tool',
              tool: ['update_database', 'modify_database'],
            },
            {
              kind: 'field',
              becomes: {
                field: 'archived',
                equals: true,
              },
            },
          ],
        },
      ],
    },
  },
  {
    id: 'HL-02-LEDGER-CONFIG-TAMPERING',
    name: 'Block Approval Configuration and Ledger Tampering',
    description:
      'Operations against the products own approval configuration, rule storage, or ledger records are refused in every mode.',
    origin: 'hardline',
    verdict: 'refuse',
    unappealable: true,
    condition: {
      kind: 'any',
      of: [
        {
          kind: 'tool',
          tool: [
            'modify_approval_config',
            'clear_ledger',
            'modify_rules',
            'delete_rules',
            'tamper_ledger',
            'delete_ledger',
            'drop_table',
          ],
        },
        {
          kind: 'tool',
          connector: ['system', 'approval_gate', 'ledger_store'],
        },
      ],
    },
  },
  {
    id: 'HL-03-OUT-OF-SCOPE-OPERATIONS',
    name: 'Block Out-of-Scope Operations',
    description:
      'Operations outside granted connector workspace scopes or targeting reserved system boundaries are refused in every mode.',
    origin: 'hardline',
    verdict: 'refuse',
    unappealable: true,
    condition: {
      kind: 'any',
      of: [
        {
          kind: 'scope',
          objectType: ['unauthorized_workspace', 'system_root'],
        },
        {
          kind: 'scope',
          objectId: { in: ['out-of-scope-workspace', 'forbidden-root'] },
        },
      ],
    },
  },
];
