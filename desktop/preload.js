const { contextBridge } = require('electron');

// Expose safe desktop environment metadata to renderer window
contextBridge.exposeInMainWorld('araceDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
});
