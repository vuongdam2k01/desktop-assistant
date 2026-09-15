import path from 'node:path';
import { app, ipcMain } from 'electron';
import { openLedgerStore } from '@desktop-assistant/ledger-store';
import { JobManager } from '@desktop-assistant/job-manager';
import type { DesktopContext } from '../context.js';

export async function registerJobManagerModule(context: DesktopContext): Promise<void> {
  const databasePath = path.join(app.getPath('userData'), 'desktop-assistant.db');

  // Open or reuse LedgerStore
  const ledgerStore = context.hasLedgerStore
    ? context.ledgerStore
    : await openLedgerStore({
        path: databasePath,
        deviceId: 'local-desktop',
      });

  context.ledgerStore = ledgerStore;

  const jobManager = new JobManager({
    ledgerStore,
    currentDeviceId: 'local-desktop',
  });

  // Phase 1 Crash Recovery: runs synchronously/offline before windows appear (capabilities/platform/spec.md)
  await jobManager.performStartupRecovery();

  context.jobManager = jobManager;

  // Register scoped IPC channels for renderer processes with input validation
  ipcMain.handle('job:get', async (_event, jobId: unknown) => {
    if (typeof jobId !== 'string' || jobId.trim().length === 0) {
      throw new Error('Invalid jobId parameter: expected non-empty string.');
    }
    return await jobManager.getJob(jobId);
  });

  ipcMain.handle('job:list-active', async () => {
    return await jobManager.listActiveJobs();
  });

  ipcMain.handle('job:cancel', async (_event, jobId: unknown, reason?: unknown) => {
    if (typeof jobId !== 'string' || jobId.trim().length === 0) {
      throw new Error('Invalid jobId parameter: expected non-empty string.');
    }
    const cleanReason = typeof reason === 'string' ? reason : undefined;
    return await jobManager.cancelJob(jobId, cleanReason);
  });

  /**
   * Resumes a job that was paused waiting for user input or suspended.
   * Explicitly forbidden for 'waiting_approval' (must go through Approval Gate F4)
   * and 'recovering' (must go through RecoveryManager F2).
   */
  ipcMain.handle('job:resume-input', async (_event, jobId: unknown) => {
    if (typeof jobId !== 'string' || jobId.trim().length === 0) {
      throw new Error('Invalid jobId parameter: expected non-empty string.');
    }
    const job = await jobManager.getJob(jobId);
    if (!job) {
      throw new Error(`Job "${jobId}" not found.`);
    }
    if (job.state !== 'waiting_input' && job.state !== 'suspended') {
      throw new Error(
        `Job "${jobId}" is in state "${job.state}" and cannot be resumed via user input. Only waiting_input or suspended jobs accept input resumption.`
      );
    }
    return await jobManager.resumeJob(jobId);
  });

  /**
   * Confirms user outcome for a job in waiting_user_confirmation after an ambiguous recovery.
   */
  ipcMain.handle(
    'job:confirm-outcome',
    async (_event, jobId: unknown, correlationId: unknown, confirmedPerformed: unknown) => {
      if (typeof jobId !== 'string' || typeof correlationId !== 'string' || typeof confirmedPerformed !== 'boolean') {
        throw new Error('Invalid parameters for job:confirm-outcome: expected (jobId: string, correlationId: string, confirmedPerformed: boolean).');
      }
      const job = await jobManager.getJob(jobId);
      if (!job) {
        throw new Error(`Job "${jobId}" not found.`);
      }
      if (job.state !== 'waiting_user_confirmation') {
        throw new Error(
          `Job "${jobId}" is in state "${job.state}" and cannot accept user confirmation. Only waiting_user_confirmation jobs accept confirmation.`
        );
      }
      return await jobManager.confirmUserOutcome(jobId, correlationId, confirmedPerformed);
    }
  );

  // Forward job manager events to renderer windows
  jobManager.on('job:state_changed', (payload) => {
    if (context.petWindow && !context.petWindow.isDestroyed()) {
      context.petWindow.webContents.send('job:state_changed', payload);
    }
    if (context.appWindow && !context.appWindow.isDestroyed()) {
      context.appWindow.webContents.send('job:state_changed', payload);
    }
  });

  jobManager.on('job:progress', (payload) => {
    if (context.petWindow && !context.petWindow.isDestroyed()) {
      context.petWindow.webContents.send('job:progress', payload);
    }
  });

  app.on('will-quit', () => {
    // Cleanup if needed
  });
}
