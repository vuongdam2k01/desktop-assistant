import { Menu, Tray, app, nativeImage } from 'electron';
import { RESOURCES } from '../../i18n/resources.js';
import type { DesktopContext } from '../context.js';

// 16x16 placeholder icon PNG data URL
const ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAUSURBVDhPY/wPBAwUACMYNWDUAAAE3AEBP+pUbgAAAABJRU5ErkJggg==';

export async function registerTrayModule(context: DesktopContext): Promise<void> {
  const icon = nativeImage.createFromDataURL(ICON_DATA_URL);
  const tray = new Tray(icon);
  tray.setToolTip('Desktop Assistant');

  function openApp(): void {
    if (context.appWindow && !context.appWindow.isDestroyed()) {
      context.appWindow.show();
      context.appWindow.focus();
    }
  }

  function togglePet(): void {
    if (context.petController) {
      if (context.petController.isVisible()) {
        context.petController.hide();
      } else {
        context.petController.show();
      }
    } else if (context.petWindow && !context.petWindow.isDestroyed()) {
      if (context.petWindow.isVisible()) {
        context.petWindow.hide();
      } else {
        context.petWindow.showInactive();
      }
    }
  }

  function updateMenu(): void {
    const r = RESOURCES[context.locale];
    const isPetVisible = context.petController
      ? context.petController.isVisible()
      : Boolean(context.petWindow && !context.petWindow.isDestroyed() && context.petWindow.isVisible());

    const contextMenu = Menu.buildFromTemplate([
      {
        label: r.trayOpen,
        click: () => openApp(),
      },
      {
        label: isPetVisible ? r.trayHidePet : r.trayShowPet,
        click: () => togglePet(),
      },
      { type: 'separator' },
      {
        label: r.trayQuit,
        click: () => {
          context.isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);
  }

  updateMenu();

  tray.on('click', () => {
    openApp();
  });

  tray.on('double-click', () => {
    openApp();
  });

  context.onLocaleChange(() => {
    updateMenu();
  });

  context.petController?.onVisibilityChange(() => {
    updateMenu();
  });

  context.tray = tray;
}
