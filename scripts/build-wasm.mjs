import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const localGo = join(root, '.tools/go/bin', process.platform === 'win32' ? 'go.exe' : 'go');
const go = process.env.GO_BINARY || (existsSync(localGo) ? localGo : 'go');
const cache = join(root, '.cache/go-build');
const runtimeDirectory = join(root, 'src/runtime/market/generated');

mkdirSync(cache, { recursive: true });
mkdirSync(join(root, 'public/wasm'), { recursive: true });
mkdirSync(runtimeDirectory, { recursive: true });

try {
  const env = {
    ...process.env,
    GOCACHE: cache,
    GOTOOLCHAIN: 'local',
  };
  const goroot = execFileSync(go, ['env', 'GOROOT'], {
    cwd: root,
    env,
    encoding: 'utf8',
  }).trim();

  execFileSync(go, ['build', '-trimpath', '-o', 'public/wasm/market.wasm', './cmd/market'], {
    cwd: root,
    env: {
      ...env,
      GOOS: 'js',
      GOARCH: 'wasm',
      CGO_ENABLED: '0',
    },
    stdio: 'inherit',
  });

  copyFileSync(join(goroot, 'lib/wasm/wasm_exec.js'), join(runtimeDirectory, 'wasm_exec.js'));
  console.log('Built Go market.wasm and copied the matching Go runtime.');
} catch (error) {
  console.error('Wasm build failed. Install Go 1.24+ or set GO_BINARY to your Go executable.');
  console.error(error.message);
  process.exit(1);
}
