import { app, BrowserWindow, Menu, dialog, webContents, ipcMain, IpcMessageEvent } from "electron";
import * as path from "path";
import { format } from "url";
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

const getNewWinUrl = (url: string) => format({
  protocol: 'file',
  pathname: path.join(__dirname, "../renderer/win.html"),
  hash: encodeURI(url)
});
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
    fullscreen: false,
    frame: false,
    modal: false,
    x: undefined,
    y: undefined,
    width: undefined,
    height: undefined,
    autoHideMenuBar: true,
    parent: mainWindow,
    center: true,
    webPreferences: {
      nodeIntegration: true
    }
  });
  if(isDevelopment){
    win.webContents.openDevTools();
  }
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('set-window-id', win.id);
  })
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
    alwaysOnTop: config.AlwaysOnTop,
    fullscreenWindowTitle: false,
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
    mainWindow.loadURL(format({
      protocol: 'file',
      pathname: path.join(__dirname, "../renderer/version.html"),
      hash: `v${app.getVersion()}`
    }))
  }
  mainWindow.webContents.session.on('will-download', (event, item)=>{
    event.preventDefault();
    dialog.showErrorBox('错误','禁止下载文件');
  })
  mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    event.preventDefault();
    if (!config.OpenNewWindow.canOpenNewWindow) {
      dialog.showErrorBox('错误', config.OpenNewWindow.message);
      return;
    }
    createClientWindow(url);
  })
  return mainWindow;
}
ipcMain.on('open-new-window', (event: IpcMessageEvent, url: string) => {
  createClientWindow(url);
})
ipcMain.on('close-window', (event:IpcMessageEvent, winId:number) =>{
  const win = BrowserWindow.fromId(winId);
  if(win){
    win.close();
  }
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
