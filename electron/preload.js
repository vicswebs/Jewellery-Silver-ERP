// Secure preload – expose only safe APIs if needed later
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  appVersion: '1.0.0',
});
