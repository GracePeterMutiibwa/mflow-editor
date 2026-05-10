const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;
let aboutWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 650,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.setMenu(buildMenu());
}

function buildMenu() {
    return Menu.buildFromTemplate([
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Moldo Flow Editor',
                    click: () => openAboutWindow()
                },
                { type: 'separator' },
                {
                    label: 'Check for Updates',
                    click: () => autoUpdater.checkForUpdates()
                }
            ]
        }
    ]);
}

function openAboutWindow() {
    if (aboutWindow) {
        aboutWindow.focus();
        return;
    }

    aboutWindow = new BrowserWindow({
        width: 400,
        height: 480,
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    aboutWindow.loadFile(path.join(__dirname, 'about', 'about.html'));
    aboutWindow.setMenu(null);

    aboutWindow.on('closed', () => {
        aboutWindow = null;
    });
}


ipcMain.handle('get-app-version', () => app.getVersion());


function setupAutoUpdater() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', () => {
        console.log('Update available — downloading...');
    });

    autoUpdater.on('update-downloaded', () => {
        autoUpdater.quitAndInstall();
    });

    autoUpdater.on('error', (err) => {
        console.error('Auto-updater error:', err.message);
    });

    // check on launch 
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
    }
}

app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});