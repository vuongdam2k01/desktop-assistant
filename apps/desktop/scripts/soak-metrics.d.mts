export interface ProcessMemorySample {
  readonly pid: number;
  readonly type: string;
  readonly workingSetSize: number;
}

export declare function selectSoakMemory(
  metrics: readonly ProcessMemorySample[],
  petProcessId: number
): { mainRss: number; rendererRss: number };
