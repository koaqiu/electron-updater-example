import { app, BrowserWindow, Menu, dialog, webContents, ipcMain, IpcMessageEvent } from "electron";
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
  function cb (reponse: number, checkBoxChecked: boolean) {
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

const getNewWinUrl = (url: string) => formatUrl({
  protocol: 'file',
  pathname: path.join(__dirname, "../renderer/win.html"),
  hash: encodeURI(url)
});
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

function createClientWindow(url: string) {
  const win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    // modal: true,
    autoHideMenuBar: true,
    parent: mainWindow,
    center: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true
    }
  });
  if (isDevelopment) {
    win.webContents.openDevTools();
  }
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('set-window-id', win.id);
  })
  win.webContents.on('did-get-redirect-request', (event, oldURL, newURL, isMainFrame, httpResoponseCode, requestMethod, referrer, headers) => {
    log.warn('did-get-redirect-request', newURL, httpResoponseCode, event);
  });
  win.loadURL(getNewWinUrl(url));

  // win.on('resize', () => {
  //   const [width, height] = win.getContentSize()

  //   for (let wc of webContents.getAllWebContents()) {
  //     // Check if `wc` belongs to a webview in the `win` window.
  //     if (wc.hostWebContents &&
  //       wc.hostWebContents.id === win.webContents.id) {
  //         console.log(width, height);
  //       wc.setSize({
  //         normal: {
  //           width: width,
  //           height: height
  //         }
  //       })
  //     }
  //   }
  // })
  return win;
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
      // nodeIntegration:false,
      nativeWindowOpen: true,
    }
  });
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  if (config.Url) {
    mainWindow.loadURL(config.Url);
  } else {
    mainWindow.loadURL(formatUrl({
      protocol: 'file',
      pathname: path.join(__dirname, "../renderer/version.html"),
      hash: `v${app.getVersion()}`
    }))
  }
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
      createClientWindow(url);
    } else {
      showErrorBox(config.OpenNewWindow.message, '错误', null, mainWindow);
    }
  })
  return mainWindow;
}
ipcMain.on('open-new-window', (event: IpcMessageEvent, url: string) => {
  if (checkUrlCanOpen(url, config.OpenNewWindow.whiteList)) {
    createClientWindow(url);
  } else {
    showErrorBox(config.OpenNewWindow.message, '错误', null, mainWindow);
  }
})
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
  if (config.Update.autoCheck) {
    // autoUpdater.checkForUpdates();
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
