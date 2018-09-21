import { app, BrowserWindow, Menu, dialog, webContents, ipcMain, IpcMessageEvent, globalShortcut } from "electron";
import * as path from "path";
import { format as formatUrl, parse as parseUrl } from 'url'
import * as log from "electron-log";
import { autoUpdater, UpdateCheckResult } from "electron-updater"
import Config from "./config";
import { getConfigPath } from "./utils";

const isDevelopment = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const config: Config = getConfig();
//-------------------------------------------------------------------
// Logging
//
// THIS SECTION IS NOT REQUIRED
//
// This logging setup is not required for auto-updates to work,
// but it sure makes debugging easier :)
//-------------------------------------------------------------------
autoUpdater.logger = log;
log.transports.file.level = 'info';
log.info('App starting...', isDevelopment);

const showErrorBox = (message: string, title = '错误', callBack: Function = null, win: BrowserWindow = null) => {
  function cb(reponse: number, checkBoxChecked: boolean) {
    if (callBack) {
      callBack(reponse, checkBoxChecked);
    }
  }
  return win != null ? dialog.showMessageBox(win, {
    title: title,
    message: message,
    type: 'error'
  }, cb) : dialog.showMessageBox({
    title: title,
    message: message,
    type: 'error'
  }, cb);
}

const checkUrlCanOpen = (url: string, whiteList: string[]) => {
  //if (!config.OpenNewWindow.canOpenNewWindow) return false;
  if (!whiteList || whiteList.length < 1) return true;
  const Url = parseUrl(url);
  const domain = whiteList
    .map(value => value.trim())
    .filter((value) => {
      if (!value || value.length < 1)
        return false;
      if (value.split('.').length < 2)
        return false;
      return true;
    })
    .find((value) => {
      const d1 = Url.hostname.split('.').reverse();
      const d2 = value.split('.').reverse();
      if (d2.length > d1.length)
        return false;
      for (let i = 0; i < d2.length; i++) {
        if (d1[i].toLocaleLowerCase() != d2[i].toLocaleLowerCase())
          return false;
      }
      return true;
    });
  return !!domain;
}
function getConfig() {
  if (!isMac && !isWin) {
    dialog.showErrorBox('系统错误', '不支持此操作系统');
    app.quit();
  }
  const configPath = getConfigPath(isDevelopment);
  log.info(`configPath=${configPath}`);
  let t = Config.load(configPath);
  if (t == null) {
    t = new Config();
    t.save(configPath);
  }
  console.log(t);
  return t;
}
autoUpdater.autoDownload = config.Update.autoDownload;
autoUpdater.autoInstallOnAppQuit = false;

//-------------------------------------------------------------------
// Define the menu
//
// THIS SECTION IS NOT REQUIRED
//-------------------------------------------------------------------
let template: any[] = []

if (process.platform === 'darwin') {
  // OS X
  const name = app.getName();
  template.unshift({
    label: name,
    submenu: [{
      label: '更新',
      click() {
        autoUpdater.checkForUpdatesAndNotify();
      }
    },
    {
      label: 'About ' + name,
      role: 'about'
    },
    {
      label: 'Quit',
      accelerator: 'Command+Q',
      click() { app.quit(); }
    },
    ]
  })
}

let mainWindow: Electron.BrowserWindow;

function sendStatusToWindow(text: string) {
  log.info(text);
  mainWindow.webContents.send('message', text);
}

function createDefaultWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: config.FullScreen,
    frame: !config.FullScreen,
    // alwaysOnTop: config.AlwaysOnTop,
    alwaysOnTop: true,
    fullscreenWindowTitle: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      nativeWindowOpen: true,
      preload: path.join(__dirname, "../renderer/preload.js"),
    }
  });
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  let uriToOpen = formatUrl({
    protocol: 'file',
    pathname: path.join(__dirname, "../renderer/version.html"),
    hash: `v${app.getVersion()}`
  });
  if (config.Url) {
    const uri = parseUrl(config.Url);
    if (uri.protocol == null || uri.protocol == 'file') {
      uriToOpen = formatUrl({
        protocol: 'file',
        pathname: path.join(__dirname, config.Url),
      });
    } else if (uri.protocol == 'http' || uri.protocol == 'https') {
      uriToOpen = formatUrl({
        protocol: 'file',
        pathname: path.join(__dirname, "../renderer/website.html"),
        hash: encodeURI(config.Url)
      });
    }
  }
  mainWindow.loadURL(uriToOpen);

  mainWindow.webContents.session.on('will-download', (event, item) => {
    event.preventDefault();
    showErrorBox('禁止下载文件', '错误', null, mainWindow);
  })
  mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    event.preventDefault();
    if (!config.OpenNewWindow.canOpenNewWindow) {
      showErrorBox(config.OpenNewWindow.message, '错误', null, mainWindow);
      return;
    }
    if (checkUrlCanOpen(url, config.OpenNewWindow.whiteList)) {
      // createClientWindow(url);
      mainWindow.webContents.send('open-inner-window', url);
    } else {
      showErrorBox(config.OpenNewWindow.message, '错误', null, mainWindow);
    }
  })
  return mainWindow;
}
ipcMain.on('close-window', (event: IpcMessageEvent, winId: number) => {
  const win = BrowserWindow.fromId(winId);
  if (win) {
    win.close();
  }
});
ipcMain.on('check-url-can-open', (event: IpcMessageEvent, url: string) => {
  const canOpen = checkUrlCanOpen(url, config.OpenNewWindow.whiteList);
  event.returnValue = canOpen;
  // if (!canOpen)
  //   showErrorBox(config.OpenNewWindow.message, '错误', null, mainWindow);
});
autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available.');
})
autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
})
autoUpdater.on('error', (err) => {
  sendStatusToWindow('Error in auto-updater. ' + err);
})
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  sendStatusToWindow(log_message);
})
autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded');
  // 下载完成 是否自动安装
  if (config.Update.autoInstall) {
    autoUpdater.quitAndInstall();
  }
});

const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

if (isSecondInstance) {
  app.quit()
}

if (!isDevelopment && config.StartOnLogin) {
  const loginSettings = app.getLoginItemSettings();
  if (!loginSettings.openAtLogin) {
    app.setLoginItemSettings({
      openAtLogin: true
    });
    log.log('设置登录时启动');
  }
}


// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it"s common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createDefaultWindow();
  }
});

app.on('ready', function () {
  // Create the Menu
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  createDefaultWindow();
  const ret = globalShortcut.register('CommandOrControl+W', () => {
    mainWindow.webContents.send('close-window')
  })

  if (!ret) {
    log.warn('registration failed')
  }

  if (config.Update.autoCheck) {
    // autoUpdater.checkForUpdates();
    autoUpdater.checkForUpdatesAndNotify();
  }
});
