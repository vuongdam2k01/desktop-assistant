/**
 * Picks the two process measurements an endurance run reports.
 *
 * The choice has to be made by process identity. The application opens a hidden card
 * window before the pet window, so the first renderer the framework lists is a blank page
 * that never draws anything; a run that measured it would report a flat, leak-free result
 * however the pet behaved, which is the one conclusion the run exists to test.
 */
export function selectSoakMemory(metrics, petProcessId) {
  const mainProcess = metrics.find(entry => entry.type === 'Browser');
  if (!mainProcess) {
    throw new Error('No metrics for the main process; there is nothing to measure against.');
  }

  const petRenderer = metrics.find(entry => entry.pid === petProcessId);
  if (!petRenderer) {
    throw new Error(
      `No metrics for the pet renderer process ${petProcessId}. Reporting zero here would ` +
        'read as a renderer that uses no memory rather than one that was never found.'
    );
  }

  return {
    mainRss: mainProcess.workingSetSize,
    rendererRss: petRenderer.workingSetSize,
  };
}
