const { spawnSync } = require('node:child_process');

const steps = [
  {
    label: 'Unit tests',
    command: process.execPath,
    args: ['tests/run-unit-tests.js']
  },
  {
    label: 'Playwright E2E',
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['playwright', 'test']
  }
];

for (const step of steps) {
  console.log(`\n=== ${step.label} ===`);
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nRelease hardening smoke suite passed.');
