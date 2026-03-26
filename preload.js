const { contextBridge, ipcRenderer, webUtils } = require('electron');

const recruitmentApi = Object.freeze({
  pickDocument(payload) {
    return ipcRenderer.invoke('document:pick', payload);
  },
  importDocument(payload) {
    return ipcRenderer.invoke('document:import', payload);
  },
  pickSourceFolder() {
    return ipcRenderer.invoke('workspace:pick-source-folder');
  },
  listSourceFolder(payload) {
    return ipcRenderer.invoke('workspace:list-source-folder', payload);
  },
  deriveWorkspaceProfile(payload) {
    return ipcRenderer.invoke('workspace:derive-profile', payload);
  },
  listRecentWorkspaces() {
    return ipcRenderer.invoke('workspace:list-recent');
  },
  saveWorkspaceSnapshot(payload) {
    return ipcRenderer.invoke('workspace:save-snapshot', payload);
  },
  loadWorkspaceSnapshot(payload) {
    return ipcRenderer.invoke('workspace:load-snapshot', payload);
  },
  clearRecentWorkspaces() {
    return ipcRenderer.invoke('workspace:clear-recent');
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
  pickBriefingOutputFolder() {
    return ipcRenderer.invoke('template:pick-briefing-output-folder');
  },
  pickReferenceTemplate() {
    return ipcRenderer.invoke('template:pick-reference-template');
  },
  exportHiringManagerWordDraft(payload) {
    return ipcRenderer.invoke('hiring-manager:export-word-draft', payload);
  },
  shareDraftByEmail(payload) {
    return ipcRenderer.invoke('email:share-draft', payload);
  },
  renderBriefingReview(payload) {
    return ipcRenderer.invoke('briefing:render-review', payload);
  },
  translateDraftOutput(payload) {
    return ipcRenderer.invoke('draft:translate-output', payload);
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

contextBridge.exposeInMainWorld('recruitmentApi', recruitmentApi);

if (process.argv.includes('--atomicgroup-e2e-test-api')) {
  contextBridge.exposeInMainWorld('__atomicgroupTestMode', Object.freeze({
    enabled: true,
    setSecureStorageMode(mode) {
      return ipcRenderer.invoke('e2e:set-secure-storage-mode', { mode });
    },
    setMockSummaryMode(mode) {
      return ipcRenderer.invoke('e2e:set-mock-summary-mode', { mode });
    }
  }));
}
