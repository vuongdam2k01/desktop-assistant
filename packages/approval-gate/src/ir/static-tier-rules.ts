import type { SystemRule } from '../types.js';

/**
 * Built-in Tier 1 Static Patterns for Smart Approval Mode (FR-AP-01b).
 * Evaluated before invoking any external Tier 2 model judge.
 * If any pattern matches, the operation is held for human approval without calling Tier 2.
 */
export const STATIC_TIER_RULES: readonly SystemRule[] = [
  {
    id: 'STATIC-01-IRREVERSIBLE',
    name: 'Hold Irreversible Operations or Unreadable Snapshots',
    description:
      'Operations flagged irreversible in their connector manifest, or whose before-state could not be snapshotted, require approval in smart mode.',
    origin: 'static',
    verdict: 'hold',
    condition: {
      kind: 'irreversible',
      is: true,
    },
  },
  {
    id: 'STATIC-02-DELETION-ARCHIVAL',
    name: 'Hold Deletion and Archival Operations',
    description:
      'Any tool performing page/block deletion, archival, or schema property removal requires approval in smart mode.',
    origin: 'static',
    verdict: 'hold',
    condition: {
      kind: 'any',
      of: [
        {
          kind: 'tool',
          tool: [
            'archive_page',
            'delete_block',
            'delete_page',
            'delete_file',
            'trash_page',
            'trash_item',
          ],
        },
        {
          kind: 'field',
          removes: true,
        },
      ],
    },
  },
  {
    id: 'STATIC-03-BULK-OPERATIONS',
    name: 'Hold Bulk Operations Exceeding 5 Objects',
    description:
      'Operations affecting more than 5 objects require approval in smart mode.',
    origin: 'static',
    verdict: 'hold',
    condition: {
      kind: 'count',
      metric: 'distinctObjects',
      boundary: 'job',
      operator: 'gt',
      value: 5,
    },
  },
  {
    id: 'STATIC-04-PERMISSION-CHANGE',
    name: 'Hold Permission or Sharing Modifications',
    description:
      'Operations that alter permissions, access levels, or sharing settings require approval in smart mode.',
    origin: 'static',
    verdict: 'hold',
    condition: {
      kind: 'permission',
      changes: true,
    },
  },
  {
    id: 'STATIC-05-FOREIGN-OWNERSHIP',
    name: 'Hold Operations on Objects Created by Others',
    description:
      'Modifying or deleting objects not created by the current user requires approval in smart mode.',
    origin: 'static',
    verdict: 'hold',
    condition: {
      kind: 'ownership',
      createdBy: {
        notIn: ['current_user', 'user_self', 'currentUser'],
      },
    },
  },
];
