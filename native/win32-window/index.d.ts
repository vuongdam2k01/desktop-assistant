import type { WindowPlacementOptions } from '@desktop-assistant/contracts/native-window-manager';

export function capabilities(): Record<string, string>;
export function apply_no_activate_topmost(handle: Buffer): void;
export function move_without_activate(handle: Buffer, placement: WindowPlacementOptions): void;
export function enable_pixel_hit_test(handle: Buffer, width: number, height: number, alpha: Buffer): void;
export function disable_pixel_hit_test(handle: Buffer): void;
