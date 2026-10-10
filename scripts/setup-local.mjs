import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

// Exclusive create: never overwrite credentials or rotate an existing token key.
const target = new URL('../.dev.vars', import.meta.url);
const template = await readFile(new URL('../.dev.vars.example', import.meta.url),'utf8');
try {
  await writeFile(target,template.replace('QB_TOKEN_KEY=""',`QB_TOKEN_KEY="${randomBytes(32).toString('base64')}"`),{flag:'wx',mode:0o600});
  console.log('Created .dev.vars with a private local token key. Fill the empty fields in your editor. QuickBooks remains disabled.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.dev.vars already exists; preserved all values and the token key.');
}
