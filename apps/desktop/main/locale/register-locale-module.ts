import { app, ipcMain } from 'electron';
import { normalizeLocale, type Locale } from '../../i18n/resources.js';
import type { DesktopContext } from '../context.js';

export async function registerLocaleModule(context: DesktopContext): Promise<void> {
  const initialLocale = normalizeLocale(app.getLocale());
  context.setLocale(initialLocale);

  ipcMain.handle('locale:get', () => {
    return context.locale;
  });

  ipcMain.handle('locale:set', (_event, requestedLocale: unknown) => {
    if (requestedLocale !== 'vi' && requestedLocale !== 'en') {
      throw new Error(`Invalid locale requested: "${String(requestedLocale)}". Must be "vi" or "en".`);
    }

    context.setLocale(requestedLocale as Locale);

    // Notify open windows
    if (context.appWindow && !context.appWindow.isDestroyed()) {
      context.appWindow.webContents.send('locale:changed', requestedLocale);
    }
    if (context.petWindow && !context.petWindow.isDestroyed()) {
      context.petWindow.webContents.send('locale:changed', requestedLocale);
    }

    return context.locale;
  });
}
