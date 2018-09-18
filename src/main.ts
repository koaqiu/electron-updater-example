import { app, BrowserWindow, Menu, dialog } from "electron";
import * as path from "path";
import { format } from "url";
import * as log from "electron-log";
import { autoUpdater, UpdateCheckResult } from "electron-updater"
import Config from "./config";

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
log.info('App starting...');

function getConfig() {
  if (!isMac && !isWin) {
    dialog.showErrorBox('系统错误', '不支持此操作系统');
    app.quit();
  }
  const configPath = path.join(
    isDevelopment || isWin
      ? app.getAppPath()
      : app.getPath('userData'), isDevelopment ? '.' : (isWin ? '..' : '.'), 'config.json');
  log.info(`configPath=${configPath}`);
  let t = Config.load(configPath);
  if (t == null) {
    t = new Config();
    t.save(configPath);
  }
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
      pathname: path.join(__dirname, "../version.html"),
      hash: `v${app.getVersion()}`
    }))
  }

  mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    // open window as modal
    event.preventDefault()
    Object.assign(options, {
      modal: true,
      x: undefined,
      y: undefined,
      autoHideMenuBar: true,
      parent: mainWindow,
      center: true,
      webPreferences: {
        nodeIntegration: false
      }
    })
    //event.newGuest = new BrowserWindow(options)
    const win = new BrowserWindow(options);
    win.maximize();
    Object.assign(event, {
      newGuest: win
    })
  })
  return mainWindow;
}

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
  sendStatusToWindow(JSON.stringify(config));
  if (config.Update.autoCheck) {
    // autoUpdater.checkForUpdates();
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
