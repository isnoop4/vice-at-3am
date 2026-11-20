// VICE AT 3 AM — the entry program. Copies app/ and screenshots/ into the
// output directory and writes dossier.json with the kit's buildDossier.
// A pre-flight gate, checkEntry(), refuses a bad entry before anything is
// built, so a broken hand-in fails here instead of on the server.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const SCREENSHOT_MAX_BYTES = 262144;
const SCREENSHOT_MAX_COUNT = 4;
const SCREENSHOT_MIN_COUNT = 3;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 48 * 1024 * 1024;
const DOSSIER_TEXT_MAX_BYTES = 163840;

const CAPS = {
  text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
  screenshots: { max: SCREENSHOT_MAX_COUNT, max_bytes: SCREENSHOT_MAX_BYTES },
  app_max_files: APP_MAX_FILES,
  app_max_bytes: APP_MAX_BYTES,
  app_path_max_bytes: 1000,
};

function isPngOrJpeg(bytes: Buffer): boolean {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  return false;
}

function walkEntries(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const name of readdirSync(current)) {
      const p = join(current, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        files += 1;
        stack.push(p);
      } else if (st.isFile()) {
        files += 1;
        bytes += st.size;
      } else {
        throw new Error(`checkEntry: app/ holds a non-file entry: ${p}`);
      }
    }
  }
  return { files, bytes };
}

// The pre-flight gate: refuse the hand-in loudly when the entry breaks the
// bounty caps, instead of shipping a dossier the server will reject.
export function checkEntry(repoDir: string): void {
  const appDir = join(repoDir, 'app');
  const indexHtml = join(appDir, 'index.html');
  if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) {
    throw new Error('checkEntry: app/index.html is missing: an app is a directory of static files, its index.html at its root');
  }
  const appStats = walkEntries(appDir);
  if (appStats.files > APP_MAX_FILES) {
    throw new Error(`checkEntry: app/ holds ${appStats.files} entries, over the ${APP_MAX_FILES} allowed`);
  }
  if (appStats.bytes > APP_MAX_BYTES) {
    throw new Error(`checkEntry: app/ is ${appStats.bytes} bytes, over the ${APP_MAX_BYTES} allowed`);
  }
  const shotsDir = join(repoDir, 'screenshots');
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    throw new Error('checkEntry: screenshots/ is missing: the entry needs 3 to 4 screenshots');
  }
  const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
  if (shots.length < SCREENSHOT_MIN_COUNT || shots.length > SCREENSHOT_MAX_COUNT) {
    throw new Error(`checkEntry: screenshots/ holds ${shots.length} images, need 3 to 4`);
  }
  for (const name of shots) {
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('-')) {
      throw new Error(`checkEntry: screenshots/${name}: a bad screenshot name`);
    }
    const p = join(shotsDir, name);
    const st = statSync(p);
    if (!st.isFile()) throw new Error(`checkEntry: screenshots/${name} is not a file`);
    if (st.size > SCREENSHOT_MAX_BYTES) {
      throw new Error(`checkEntry: screenshots/${name} is ${st.size} bytes, over ${SCREENSHOT_MAX_BYTES}`);
    }
  }
}

function main(): void {
  const repoDir = process.cwd();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  checkEntry(repoDir);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
}

try {
  main();
} catch (err) {
  console.error(`main.ts: ${(err as Error).message}`);
  process.exit(1);
}
