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
    briefingReview: 'Hiring manager briefing review.',
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
