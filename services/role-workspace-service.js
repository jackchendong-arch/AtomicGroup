const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const STORE_VERSION = 1;
const DEFAULT_MAX_RECENT_WORKSPACES = 12;

function createEmptyStore() {
  return {
    version: STORE_VERSION,
    workspaces: []
  };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function cloneJsonValue(value, fallback) {
  if (value == null) {
    return fallback;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return fallback;
  }
}

function normalizeDraftVariantSnapshot(variant) {
  if (!variant || typeof variant !== 'object') {
    return null;
  }

  const summary = String(variant.summary || '').trim();
  const briefing = cloneJsonValue(variant.briefing, null);
  const briefingReview = String(variant.briefingReview || '').trim();
  const approvalWarnings = normalizeStringArray(variant.approvalWarnings);
  const draftLifecycle = normalizeString(variant.draftLifecycle) || (summary ? 'generated' : 'empty');

  if (!summary && !briefing && !briefingReview && approvalWarnings.length === 0) {
    return null;
  }

  return {
    summary,
    briefing,
    briefingReview,
    approvalWarnings,
    draftLifecycle
  };
}

function normalizeDraftVariants(input) {
  const modes = ['named', 'anonymous'];
  const languages = ['en', 'zh'];
  const normalized = {
    named: {
      en: null,
      zh: null
    },
    anonymous: {
      en: null,
      zh: null
    }
  };

  if (!input || typeof input !== 'object') {
    return normalized;
  }

  for (const mode of modes) {
    const modeEntry = input[mode];

    if (!modeEntry || typeof modeEntry !== 'object') {
      continue;
    }

    for (const language of languages) {
      normalized[mode][language] = normalizeDraftVariantSnapshot(modeEntry[language]);
    }
  }

  return normalized;
}

function extractSummaryField(summary, labels) {
  const normalizedSummary = String(summary || '');

  if (!normalizedSummary) {
    return '';
  }

  const lines = normalizedSummary
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const label of labels) {
      const pattern = new RegExp(`^${label}\\s*[:：]\\s*(.+)$`, 'i');
      const match = line.match(pattern);

      if (match) {
        return normalizeString(match[1]);
      }
    }
  }

  return '';
}

function resolveCandidateName(input = {}, briefing, summary) {
  return normalizeString(input.candidateName) ||
    normalizeString(briefing?.candidate?.name) ||
    extractSummaryField(summary, ['Candidate', '候选人']);
}

function resolveRoleTitle(input = {}, briefing, summary) {
  return normalizeString(input.roleTitle) ||
    normalizeString(briefing?.role?.title) ||
    extractSummaryField(summary, ['Target Role', '目标职位']);
}

function resolveWorkspaceName(sourceFolderName, sourceFolderPath, loadedJdPath) {
  if (sourceFolderName) {
    return sourceFolderName;
  }

  if (sourceFolderPath) {
    return path.basename(sourceFolderPath) || sourceFolderPath;
  }

  if (loadedJdPath) {
    return path.basename(loadedJdPath);
  }

  return 'Untitled Workspace';
}

function buildWorkspaceId({
  sourceFolderPath,
  selectedJdPath,
  selectedCvPath,
  loadedJdPath,
  loadedCvPath
}) {
  const identity = [
    normalizeString(sourceFolderPath).toLowerCase(),
    normalizeString(loadedJdPath || selectedJdPath).toLowerCase(),
    normalizeString(loadedCvPath || selectedCvPath).toLowerCase()
  ].join('|');

  return createHash('sha1')
    .update(identity)
    .digest('hex')
    .slice(0, 16);
}

function hasMeaningfulWorkspace(snapshot) {
  return Boolean(
    snapshot.sourceFolderPath ||
    snapshot.loadedJdPath ||
    snapshot.loadedCvPath ||
    snapshot.summary
  );
}

function normalizeWorkspaceSnapshot(input = {}) {
  const sourceFolderPath = normalizeString(input.sourceFolderPath);
  const sourceFolderName = resolveWorkspaceName(
    normalizeString(input.sourceFolderName),
    sourceFolderPath,
    normalizeString(input.loadedJdPath)
  );
  const selectedJdPath = normalizeString(input.selectedJdPath);
  const selectedCvPath = normalizeString(input.selectedCvPath);
  const loadedJdPath = normalizeString(input.loadedJdPath);
  const loadedCvPath = normalizeString(input.loadedCvPath);
  const summary = String(input.summary || '').trim();
  const briefing = cloneJsonValue(input.briefing, null);
  const retrievalEvidence = cloneJsonValue(input.retrievalEvidence, {
    summary: [],
    briefing: []
  });
  const draftVariants = normalizeDraftVariants(input.draftVariants);
  const workspaceId = buildWorkspaceId({
    sourceFolderPath,
    selectedJdPath,
    selectedCvPath,
    loadedJdPath,
    loadedCvPath
  });

  return {
    workspaceId,
    sourceFolderPath,
    sourceFolderName,
    candidateName: resolveCandidateName(input, briefing, summary),
    roleTitle: resolveRoleTitle(input, briefing, summary),
    selectedJdPath,
    selectedCvPath,
    loadedJdPath,
    loadedCvPath,
    outputMode: normalizeString(input.outputMode) === 'anonymous' ? 'anonymous' : 'named',
    outputLanguage: normalizeString(input.outputLanguage) === 'zh' ? 'zh' : 'en',
    draftLifecycle: normalizeString(input.draftLifecycle) || 'empty',
    summary,
    briefing,
    draftVariants,
    retrievalEvidence,
    briefingReview: String(input.briefingReview || '').trim(),
    approvalWarnings: normalizeStringArray(input.approvalWarnings),
    lastExportPath: normalizeString(input.lastExportPath),
    templateLabel: normalizeString(input.templateLabel),
    updatedAt: normalizeString(input.updatedAt) || new Date().toISOString()
  };
}

function summarizeWorkspace(snapshot) {
  return {
    workspaceId: snapshot.workspaceId,
    sourceFolderPath: snapshot.sourceFolderPath,
    sourceFolderName: snapshot.sourceFolderName,
    candidateName: snapshot.candidateName,
    roleTitle: snapshot.roleTitle,
    selectedJdPath: snapshot.selectedJdPath,
    selectedCvPath: snapshot.selectedCvPath,
    loadedJdPath: snapshot.loadedJdPath,
    loadedCvPath: snapshot.loadedCvPath,
    loadedJdName: snapshot.loadedJdPath ? path.basename(snapshot.loadedJdPath) : '',
    loadedCvName: snapshot.loadedCvPath ? path.basename(snapshot.loadedCvPath) : '',
    draftLifecycle: snapshot.draftLifecycle,
    outputMode: snapshot.outputMode,
    outputLanguage: snapshot.outputLanguage,
    hasDraft: Boolean(snapshot.summary),
    updatedAt: snapshot.updatedAt
  };
}

class RoleWorkspaceStore {
  constructor({ userDataPath, maxEntries = DEFAULT_MAX_RECENT_WORKSPACES }) {
    this.filePath = path.join(userDataPath, 'role-workspaces.json');
    this.maxEntries = maxEntries;
  }

  async readStore() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed.workspaces)) {
        return createEmptyStore();
      }

      return {
        version: STORE_VERSION,
        workspaces: parsed.workspaces
          .map((workspace) => normalizeWorkspaceSnapshot(workspace))
          .filter(hasMeaningfulWorkspace)
      };
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return createEmptyStore();
      }

      return createEmptyStore();
    }
  }

  async writeStore(store) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(store, null, 2),
      'utf8'
    );
  }

  async list() {
    const store = await this.readStore();

    return {
      recentWorkspaces: store.workspaces.map((workspace) => summarizeWorkspace(workspace))
    };
  }

  async save(snapshotInput = {}) {
    const snapshot = normalizeWorkspaceSnapshot(snapshotInput);
    const store = await this.readStore();

    if (!hasMeaningfulWorkspace(snapshot)) {
      return {
        workspace: null,
        recentWorkspaces: store.workspaces.map((workspace) => summarizeWorkspace(workspace))
      };
    }

    const nextWorkspaces = store.workspaces.filter((workspace) => workspace.workspaceId !== snapshot.workspaceId);
    nextWorkspaces.unshift(snapshot);
    nextWorkspaces.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    const trimmedStore = {
      version: STORE_VERSION,
      workspaces: nextWorkspaces.slice(0, this.maxEntries)
    };

    await this.writeStore(trimmedStore);

    return {
      workspace: summarizeWorkspace(snapshot),
      recentWorkspaces: trimmedStore.workspaces.map((workspace) => summarizeWorkspace(workspace))
    };
  }

  async load(workspaceId) {
    const normalizedWorkspaceId = normalizeString(workspaceId);
    const store = await this.readStore();
    const existingWorkspace = store.workspaces.find((workspace) => workspace.workspaceId === normalizedWorkspaceId);

    if (!existingWorkspace) {
      throw new Error('The selected recent workspace could not be found.');
    }

    const touchedWorkspace = {
      ...existingWorkspace,
      updatedAt: new Date().toISOString()
    };
    const nextWorkspaces = store.workspaces.filter((workspace) => workspace.workspaceId !== normalizedWorkspaceId);
    nextWorkspaces.unshift(touchedWorkspace);

    const nextStore = {
      version: STORE_VERSION,
      workspaces: nextWorkspaces.slice(0, this.maxEntries)
    };

    await this.writeStore(nextStore);

    return {
      workspace: touchedWorkspace,
      recentWorkspaces: nextStore.workspaces.map((workspace) => summarizeWorkspace(workspace))
    };
  }

  async clear() {
    const emptyStore = createEmptyStore();
    await this.writeStore(emptyStore);

    return {
      recentWorkspaces: []
    };
  }
}

module.exports = {
  RoleWorkspaceStore,
  normalizeWorkspaceSnapshot,
  summarizeWorkspace
};
