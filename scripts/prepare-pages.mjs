import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../dist/realtime-fintech-dashboard/browser/', import.meta.url);
const index = new URL('index.html', output);

await mkdir(new URL('settings/', output), { recursive: true });
await copyFile(index, new URL('settings/index.html', output));
await copyFile(index, new URL('404.html', output));
await writeFile(new URL('.nojekyll', output), '');
await writeFile(new URL('deployment.json', output), JSON.stringify({
  commit: process.env.GITHUB_SHA ?? 'local',
  branch: process.env.GITHUB_REF_NAME ?? 'local',
}, null, 2) + '\n');

console.log('Prepared GitHub Pages entry points for Dashboard and Settings.');
