// Launches Electron for development, ensuring ELECTRON_RUN_AS_NODE is unset.
// This variable (set by VSCode / CI environments) would prevent Electron from
// initialising its GUI APIs, causing `require('electron').app` to be undefined.
const { spawn } = require('child_process');
const electronPath = require('electron');

const env = { ...process.env, NODE_ENV: 'development' };
delete env.ELECTRON_RUN_AS_NODE;

spawn(electronPath, ['.'], { stdio: 'inherit', env })
  .on('close', code => process.exit(code ?? 0));
