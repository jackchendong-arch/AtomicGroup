const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('recruitmentApi', {
  pickDocument(payload) {
    return ipcRenderer.invoke('document:pick', payload);
  },
  importDocument(payload) {
    return ipcRenderer.invoke('document:import', payload);
  },
  getLlmProviders() {
    return ipcRenderer.invoke('llm:get-providers');
  },
  loadLlmSettings() {
    return ipcRenderer.invoke('llm:load-settings');
  },
  saveLlmSettings(payload) {
    return ipcRenderer.invoke('llm:save-settings', payload);
  },
  pickWordTemplate() {
    return ipcRenderer.invoke('template:pick-word-template');
  },
  pickReferenceTemplate() {
    return ipcRenderer.invoke('template:pick-reference-template');
  },
  exportHiringManagerWordDraft(payload) {
    return ipcRenderer.invoke('hiring-manager:export-word-draft', payload);
  },
  renderBriefingReview(payload) {
    return ipcRenderer.invoke('briefing:render-review', payload);
  },
  openPath(filePath) {
    return ipcRenderer.invoke('shell:open-path', filePath);
  },
  revealInFolder(filePath) {
    return ipcRenderer.invoke('shell:reveal-in-folder', filePath);
  },
  generateSummary(payload) {
    return ipcRenderer.invoke('summary:generate', payload);
  },
  writeClipboard(value) {
    return ipcRenderer.invoke('clipboard:write-text', value);
  },
  getPathForDroppedFile(file) {
    return file?.path || webUtils.getPathForFile(file) || '';
  }
});
