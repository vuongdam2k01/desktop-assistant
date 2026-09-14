export interface RestorationRequest {
  key: string;
  classId: string;
  restorationRoute: 'replication' | 'account_sign_in';
}

export type RestorationHook = (request: RestorationRequest) => void;

export class RestorationCoordinator {
  constructor(private readonly hook?: RestorationHook | undefined) {}

  notify(request: RestorationRequest): void {
    if (!this.hook) {
      return;
    }

    try {
      this.hook({
        key: request.key,
        classId: request.classId,
        restorationRoute: request.restorationRoute,
      });
    } catch {
      // Hook failures must not replace the caller-visible CREDENTIAL_UNREADABLE outcome
    }
  }
}
