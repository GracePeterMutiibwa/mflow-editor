const { ipcRenderer } = require('electron');


ipcRenderer.invoke('get-app-version').then((version) => {
    document.getElementById('version').textContent = `v${version}`;
});