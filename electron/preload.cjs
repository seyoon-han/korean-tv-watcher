const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  downloadEpisode: (data) => ipcRenderer.send('download-episode', data),
  openFolder: (filePath) => ipcRenderer.send('open-folder', filePath),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
  onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', (event, data) => callback(data)),
  onDownloadFailed: (callback) => ipcRenderer.on('download-failed', (event, data) => callback(data)),
  generateAISubtitle: (data) => ipcRenderer.invoke('generate-ai-subtitle', data),
  uploadCloudSubtitle: (data) => ipcRenderer.invoke('upload-cloud-subtitle', data),
  getCloudSubtitles: (episodeId) => ipcRenderer.invoke('get-cloud-subtitles', episodeId),
  loadPersistentData: () => ipcRenderer.invoke('load-persistent-data'),
  savePersistentData: (data) => ipcRenderer.invoke('save-persistent-data', data),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadAndInstallUpdate: (url) => ipcRenderer.invoke('download-and-install-update', url),
  isElectron: true
});
