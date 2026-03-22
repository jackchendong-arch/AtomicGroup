const { spawn } = require('node:child_process');

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['playwright', 'test', '--headed', ...process.argv.slice(2)];
const child = spawn(command, args, {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    E2E_SLOW_MO_MS: process.env.E2E_SLOW_MO_MS || '350',
    ATOMICGROUP_E2E_DELAY_MS: process.env.ATOMICGROUP_E2E_DELAY_MS || '400'
  }
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
