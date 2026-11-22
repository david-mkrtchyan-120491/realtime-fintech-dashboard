import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const localGo = join(root, '.tools/go/bin', process.platform === 'win32' ? 'go.exe' : 'go');
const go = process.env.GO_BINARY || (existsSync(localGo) ? localGo : 'go');
const cache = join(root, '.cache/go-build');

mkdirSync(cache, { recursive: true });

const result = spawnSync(go, ['test', '-count=1', './...', ...process.argv.slice(2)], {
  cwd: root,
  env: {
    ...process.env,
    GOCACHE: cache,
    GOTOOLCHAIN: 'local',
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error('Go tests could not start. Install Go 1.24+ or set GO_BINARY to your Go executable.');
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
