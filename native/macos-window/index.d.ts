export type ActivationPolicy = 'accessory' | 'regular';

export function capabilities(): Record<string, string>;
export function applyNoActivateTopmost(handle: Buffer): void;
export function enablePixelHitTest(handle: Buffer, width: number, height: number, alpha: Buffer): void;
export function disablePixelHitTest(handle: Buffer): void;
export function rememberPreviousFocus(): boolean;
export function restorePreviousFocus(): boolean;
export function setActivationPolicy(mode: ActivationPolicy): boolean;
export function excludeFromCapture(handle: Buffer, excluded: boolean): boolean;
