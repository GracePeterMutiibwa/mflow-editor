const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1300,
        height: 650,
    });

    // load
    mainWindow.loadFile(path.join(__dirname, 'engine', 'core', 'entry.html'));

    mainWindow.setMenu(null)

    // Open the DevTools (optional, for debugging)
    // mainWindow.webContents.openDevTools();
}


app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        // darwin support
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});


app.on('window-all-closed', function () {
    // Quit when all windows are closed, except on macOS.
    if (process.platform !== 'darwin') app.quit();
});