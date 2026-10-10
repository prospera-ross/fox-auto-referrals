import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

// Run locally by the account owner after reviewing the intended Worker config.
// Pipe the key directly into Wrangler; never print it or put it in a shell arg.
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put','QB_TOKEN_KEY','--config','wrangler.worker.jsonc'],{
  stdio:['pipe','inherit','inherit'],windowsHide:true
});
child.stdin.end(randomBytes(32).toString('base64')+'\n');
child.on('error',()=>{console.error('Could not start Wrangler.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
