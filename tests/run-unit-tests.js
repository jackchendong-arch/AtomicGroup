const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testsDirectory = path.join(__dirname, 'unit');

const testFiles = fs.readdirSync(testsDirectory)
  .filter((entry) => entry.endsWith('.test.js'))
  .sort()
  .map((entry) => path.join(testsDirectory, entry));

if (testFiles.length === 0) {
  console.error('No unit test files were found in tests/unit.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: process.env
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
