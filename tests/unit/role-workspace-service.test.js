const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { RoleWorkspaceStore } = require('../../services/role-workspace-service');

function createWorkspacePayload(overrides = {}) {
  return {
    sourceFolderPath: '/Users/jack/Dev/Test/AtomicGroup/Role4',
    sourceFolderName: 'Role4',
    candidateName: 'Candidate One',
    roleTitle: 'Blockchain Developer',
    selectedJdPath: '/Users/jack/Dev/Test/AtomicGroup/Role4/JD4.docx',
    selectedCvPath: '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-1.pdf',
    loadedJdPath: '/Users/jack/Dev/Test/AtomicGroup/Role4/JD4.docx',
    loadedCvPath: '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-1.pdf',
    outputMode: 'named',
    outputLanguage: 'en',
    draftLifecycle: 'generated',
    summary: 'Candidate: Candidate One\nTarget Role: Blockchain Developer\n\nCandidate summary text.',
    briefing: {
      candidate: {
        name: 'Candidate One'
      },
      role: {
        title: 'Blockchain Developer'
      }
    },
    draftVariants: {
      named: {
        en: {
          summary: 'Candidate: Candidate One\nTarget Role: Blockchain Developer\n\nCandidate summary text.',
          briefing: {
            candidate: {
              name: 'Candidate One'
            },
            role: {
              title: 'Blockchain Developer'
            }
          },
          briefingReview: 'Hiring manager briefing review.',
          approvalWarnings: [],
          draftLifecycle: 'generated'
        },
        zh: {
          summary: '候选人：Candidate One\n目标职位：区块链开发工程师\n\n中文摘要。',
          briefing: {
            candidate: {
              name: 'Candidate One'
            },
            role: {
              title: '区块链开发工程师'
            }
          },
          briefingReview: '中文 Hiring Manager Briefing。',
          approvalWarnings: [],
          draftLifecycle: 'generated'
        }
      },
      anonymous: {
        en: null,
        zh: null
      }
    },
    briefingReview: 'Hiring manager briefing review.',
    retrievalEvidence: {
      summary: [
        {
          blockId: 'cv-1',
          documentLabel: 'Candidate CV',
          sourceName: 'CV4-1.pdf',
          sectionLabel: 'Overview',
          preview: 'Candidate overview text.',
          score: 1
        }
      ],
      briefing: [
        {
          blockId: 'jd-2',
          documentLabel: 'Job Description',
          sourceName: 'JD4.docx',
          sectionLabel: 'Requirements',
          preview: 'Blockchain developer requirement text.',
          score: 0.88
        }
      ]
    },
    approvalWarnings: [],
    lastExportPath: '/Users/jack/Documents/AtomicGroup Briefings/candidate-one.docx',
    templateLabel: 'Default Recruiter Profile Template',
    ...overrides
  };
}

test('RoleWorkspaceStore saves and lists recent workspaces in most recent order', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-role-workspaces-'));

  try {
    const store = new RoleWorkspaceStore({ userDataPath: tempRoot, maxEntries: 5 });
    const first = await store.save(createWorkspacePayload());
    const second = await store.save(createWorkspacePayload({
      selectedCvPath: '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-2.pdf',
      loadedCvPath: '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-2.pdf'
    }));

    assert.equal(first.workspace.loadedCvName, 'CV4-1.pdf');
    assert.equal(first.workspace.candidateName, 'Candidate One');
    assert.equal(first.workspace.roleTitle, 'Blockchain Developer');
    assert.equal(second.recentWorkspaces.length, 2);
    assert.equal(second.recentWorkspaces[0].loadedCvName, 'CV4-2.pdf');
    assert.equal(second.recentWorkspaces[1].loadedCvName, 'CV4-1.pdf');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('RoleWorkspaceStore upserts the same role workspace candidate snapshot', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-role-workspaces-'));

  try {
    const store = new RoleWorkspaceStore({ userDataPath: tempRoot, maxEntries: 5 });
    await store.save(createWorkspacePayload());
    const result = await store.save(createWorkspacePayload({
      summary: 'Updated summary text.',
      draftLifecycle: 'approved'
    }));

    assert.equal(result.recentWorkspaces.length, 1);
    assert.equal(result.workspace.draftLifecycle, 'approved');

    const loaded = await store.load(result.workspace.workspaceId);
    assert.equal(loaded.workspace.summary, 'Updated summary text.');
    assert.equal(loaded.workspace.draftLifecycle, 'approved');
    assert.equal(loaded.workspace.retrievalEvidence.summary[0].blockId, 'cv-1');
    assert.equal(loaded.workspace.retrievalEvidence.briefing[0].sourceName, 'JD4.docx');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('RoleWorkspaceStore clears the recent work list', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-role-workspaces-'));

  try {
    const store = new RoleWorkspaceStore({ userDataPath: tempRoot, maxEntries: 5 });
    await store.save(createWorkspacePayload());
    const cleared = await store.clear();

    assert.deepEqual(cleared.recentWorkspaces, []);
    assert.deepEqual((await store.list()).recentWorkspaces, []);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('RoleWorkspaceStore backfills candidate and role labels from older saved snapshots', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-role-workspaces-'));

  try {
    const legacySnapshot = createWorkspacePayload({
      candidateName: '',
      roleTitle: ''
    });
    const filePath = path.join(tempRoot, 'role-workspaces.json');

    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        workspaces: [
          {
            ...legacySnapshot,
            candidateName: '',
            roleTitle: ''
          }
        ]
      }, null, 2),
      'utf8'
    );

    const store = new RoleWorkspaceStore({ userDataPath: tempRoot, maxEntries: 5 });
    const listed = await store.list();

    assert.equal(listed.recentWorkspaces[0].candidateName, 'Candidate One');
    assert.equal(listed.recentWorkspaces[0].roleTitle, 'Blockchain Developer');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('RoleWorkspaceStore load rehydrates the full saved workspace state needed for recent-work reopen', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-role-workspaces-'));

  try {
    const store = new RoleWorkspaceStore({ userDataPath: tempRoot, maxEntries: 5 });
    const saved = await store.save(createWorkspacePayload({
      outputMode: 'anonymous',
      outputLanguage: 'zh',
      draftLifecycle: 'approved',
      briefingReview: 'Restored hiring manager briefing review.',
      approvalWarnings: ['Remove phone number before sharing.'],
      lastExportPath: '/Users/jack/Documents/AtomicGroup Briefings/candidate-one-zh.docx',
      templateLabel: 'Chinese Recruiter Guidance'
    }));

    const reopened = await store.load(saved.workspace.workspaceId);
    const snapshot = reopened.workspace;

    assert.equal(snapshot.sourceFolderPath, '/Users/jack/Dev/Test/AtomicGroup/Role4');
    assert.equal(snapshot.sourceFolderName, 'Role4');
    assert.equal(snapshot.selectedJdPath, '/Users/jack/Dev/Test/AtomicGroup/Role4/JD4.docx');
    assert.equal(snapshot.selectedCvPath, '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-1.pdf');
    assert.equal(snapshot.loadedJdPath, '/Users/jack/Dev/Test/AtomicGroup/Role4/JD4.docx');
    assert.equal(snapshot.loadedCvPath, '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-1.pdf');
    assert.equal(snapshot.candidateName, 'Candidate One');
    assert.equal(snapshot.roleTitle, 'Blockchain Developer');
    assert.equal(snapshot.outputMode, 'anonymous');
    assert.equal(snapshot.outputLanguage, 'zh');
    assert.equal(snapshot.draftLifecycle, 'approved');
    assert.equal(snapshot.summary, 'Candidate: Candidate One\nTarget Role: Blockchain Developer\n\nCandidate summary text.');
    assert.equal(snapshot.briefingReview, 'Restored hiring manager briefing review.');
    assert.deepEqual(snapshot.approvalWarnings, ['Remove phone number before sharing.']);
    assert.equal(snapshot.lastExportPath, '/Users/jack/Documents/AtomicGroup Briefings/candidate-one-zh.docx');
    assert.equal(snapshot.templateLabel, 'Chinese Recruiter Guidance');
    assert.equal(snapshot.briefing.candidate.name, 'Candidate One');
    assert.equal(snapshot.briefing.role.title, 'Blockchain Developer');
    assert.equal(snapshot.draftVariants.named.en.summary, 'Candidate: Candidate One\nTarget Role: Blockchain Developer\n\nCandidate summary text.');
    assert.equal(snapshot.draftVariants.named.zh.summary, '候选人：Candidate One\n目标职位：区块链开发工程师\n\n中文摘要。');
    assert.equal(snapshot.draftVariants.anonymous.en, null);
    assert.equal(snapshot.retrievalEvidence.summary[0].sourceName, 'CV4-1.pdf');
    assert.equal(snapshot.retrievalEvidence.briefing[0].sourceName, 'JD4.docx');
    assert.equal(reopened.recentWorkspaces[0].workspaceId, saved.workspace.workspaceId);
    assert.equal(reopened.recentWorkspaces[0].candidateName, 'Candidate One');
    assert.equal(reopened.recentWorkspaces[0].roleTitle, 'Blockchain Developer');
    assert.equal(reopened.recentWorkspaces[0].hasDraft, true);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('RoleWorkspaceStore load preserves a source-only workspace before summary generation', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-role-workspaces-'));

  try {
    const store = new RoleWorkspaceStore({ userDataPath: tempRoot, maxEntries: 5 });
    const saved = await store.save(createWorkspacePayload({
      candidateName: 'Candidate One',
      roleTitle: 'Blockchain Developer',
      draftLifecycle: 'empty',
      summary: '',
      briefing: null,
      draftVariants: {
        named: {
          en: null,
          zh: null
        },
        anonymous: {
          en: null,
          zh: null
        }
      },
      briefingReview: '',
      retrievalEvidence: {
        summary: [],
        briefing: []
      },
      approvalWarnings: [],
      lastExportPath: '',
      templateLabel: ''
    }));

    const reopened = await store.load(saved.workspace.workspaceId);
    const snapshot = reopened.workspace;

    assert.equal(snapshot.loadedJdPath, '/Users/jack/Dev/Test/AtomicGroup/Role4/JD4.docx');
    assert.equal(snapshot.loadedCvPath, '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-1.pdf');
    assert.equal(snapshot.selectedJdPath, '/Users/jack/Dev/Test/AtomicGroup/Role4/JD4.docx');
    assert.equal(snapshot.selectedCvPath, '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-1.pdf');
    assert.equal(snapshot.summary, '');
    assert.equal(snapshot.briefing, null);
    assert.equal(snapshot.briefingReview, '');
    assert.deepEqual(snapshot.draftVariants, {
      named: {
        en: null,
        zh: null
      },
      anonymous: {
        en: null,
        zh: null
      }
    });
    assert.deepEqual(snapshot.retrievalEvidence, { summary: [], briefing: [] });
    assert.equal(snapshot.draftLifecycle, 'empty');
    assert.equal(reopened.recentWorkspaces[0].hasDraft, false);
    assert.equal(reopened.recentWorkspaces[0].loadedJdName, 'JD4.docx');
    assert.equal(reopened.recentWorkspaces[0].loadedCvName, 'CV4-1.pdf');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
