import {
  CONTRACT_VERSION,
  type PetAssetDescriptor,
  type SetPetStatePayload,
} from '@desktop-assistant/contracts/rive-state-machine';

export { CONTRACT_VERSION, type PetAssetDescriptor, type SetPetStatePayload };

export const DEFAULT_PACK_ID = 'default-pet';

export const SHIPPED_PET_DESCRIPTOR = {
  artboardName: 'Pet',
  stateMachineName: 'PetStateMachine',
  inputs: {
    workStatus: {
      type: 'Number',
      name: 'workStatus',
      default: 0,
    },
    locomotion: {
      type: 'Number',
      name: 'locomotion',
      default: 0,
    },
  },
  transitionBlendDurationMs: 200,
} as const satisfies PetAssetDescriptor;

export interface PetJobStateSnapshot {
  receivingOrder: boolean;
  activeJobCount: number;
  waitingApprovalCount: number;
  unacknowledgedResultCount: number;
}

export function deriveWorkStatus(snapshot: PetJobStateSnapshot): 0 | 1 | 2 | 3 | 4 {
  if (snapshot.waitingApprovalCount > 0) {
    return 3;
  }
  if (snapshot.receivingOrder) {
    return 1;
  }
  if (snapshot.activeJobCount > 0) {
    return 2;
  }
  if (snapshot.unacknowledgedResultCount > 0) {
    return 4;
  }
  return 0;
}

export function sanitizeSetStatePayload(payload: unknown): SetPetStatePayload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const raw = payload as Record<string, unknown>;
  const result: SetPetStatePayload = {};
  let hasValidField = false;

  if (typeof raw.workStatus === 'number' && Number.isInteger(raw.workStatus)) {
    if (raw.workStatus >= 0 && raw.workStatus <= 4) {
      result.workStatus = raw.workStatus as 0 | 1 | 2 | 3 | 4;
      hasValidField = true;
    }
  }

  if (typeof raw.locomotion === 'number' && Number.isInteger(raw.locomotion)) {
    if (raw.locomotion >= 0 && raw.locomotion <= 3) {
      result.locomotion = raw.locomotion as 0 | 1 | 2 | 3;
      hasValidField = true;
    }
  }

  return hasValidField ? result : null;
}

export type PetActivationErrorCode =
  | 'INVALID_ASSET_BUFFER'
  | 'ARTBOARD_NOT_FOUND'
  | 'STATE_MACHINE_NOT_FOUND'
  | 'INCOMPATIBLE_REVISION'
  | 'BLEND_DURATION_OUT_OF_RANGE'
  | 'ACTIVATION_TIMEOUT'
  | 'RENDERER_UNAVAILABLE';

export interface PetActivationPackage {
  packId: string;
  contractVersion: string;
  descriptor: PetAssetDescriptor;
  capabilities: string[];
  buffer: Uint8Array;
}

export interface PetActivationResult {
  activated: boolean;
  packId?: string;
  error?: PetActivationErrorCode | string;
}

export interface PetPackState {
  activePack: string;
  contractVersion: string;
  capabilities: string[];
  workStatus: number;
  locomotion: number;
}
