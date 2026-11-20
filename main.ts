// VICE AT 3 AM — the entrypoint program: it hands the app in. It copies
// app/ and screenshots/ from this repository to the output directory and
// writes the dossier there with buildDossier from vendor/makefun-app.ts.
// Node 22, standard library only. Run it as: MAKEFUN_OUTPUT_DIR=out node main.ts
// (the grader runs it twice; both runs must write the same bytes).

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const MAX_SCREENSHOTS = 4;
const MIN_SCREENSHOTS = 3;
const SCREENSHOT_MAX_BYTES = 262144;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 48 * 1024 * 1024;
const APP_PATH_MAX_BYTES = 1000;
const INDEX_HTML_MAX_BYTES = 1024 * 1024;
const DOSSIER_MAX_BYTES = 1572864; // 1.5 MiB, the gate's dossier cap
const TEXT_MAX_BYTES = 163840; // 160 KiB, the dossier text cap

const SCREENSHOT_NAME = /^[A-Za-z0-9._-]{1,128}$/;

function fail(message: string): never {
  throw new Error(`checkEntry: ${message}`);
}

function countAppEntries(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = join(d, entry.name);
      if (entry.isSymbolicLink()) fail(`app/ holds a symlink: ${full}`);
      if (entry.isDirectory()) {
        files += 1;
        walk(full);
      } else if (entry.isFile()) {
        files += 1;
        bytes += statSync(full).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

// The pre-flight gate: refuse to build a dossier from a broken hand-in,
// so a bad copy fails loudly here instead of at the sealed scorer.
function checkEntry(repoRoot: string): void {
  const appDir = join(repoRoot, 'app');
  const shotsDir = join(repoRoot, 'screenshots');

  const indexHtml = join(appDir, 'index.html');
  if (!existsSync(indexHtml)) fail('app/index.html is missing');
  const indexStat = lstatSync(indexHtml);
  if (!indexStat.isFile()) fail('app/index.html is not a regular file');
  if (indexStat.size > INDEX_HTML_MAX_BYTES) {
    fail(`app/index.html is ${indexStat.size} bytes, over ${INDEX_HTML_MAX_BYTES}`);
  }

  if (!existsSync(appDir)) fail('app/ is missing');
  const app = countAppEntries(appDir);
  if (app.files > APP_MAX_FILES) fail(`app/ holds ${app.files} entries, over ${APP_MAX_FILES}`);
  if (app.bytes > APP_MAX_BYTES) fail(`app/ is ${app.bytes} bytes, over ${APP_MAX_BYTES}`);

  // Every path under app/ must fit the 1,000-byte cap.
  const checkPaths = (d: string, prefix: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (Buffer.byteLength(rel, 'utf8') > APP_PATH_MAX_BYTES) {
        fail(`app/${rel} is over ${APP_PATH_MAX_BYTES} bytes long`);
      }
      if (entry.isDirectory()) checkPaths(join(d, entry.name), rel);
    }
  };
  checkPaths(appDir, '');

  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  if (shots.length < MIN_SCREENSHOTS) {
    fail(`screenshots/ holds ${shots.length} images, need ${MIN_SCREENSHOTS} to ${MAX_SCREENSHOTS}`);
  }
  if (shots.length > MAX_SCREENSHOTS) {
    fail(`screenshots/ holds ${shots.length} images, need ${MIN_SCREENSHOTS} to ${MAX_SCREENSHOTS}`);
  }
  for (const name of shots) {
    if (!SCREENSHOT_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
    const size = statSync(join(shotsDir, name)).size;
    if (size > SCREENSHOT_MAX_BYTES) {
      fail(`screenshots/${name} is ${size} bytes, over ${SCREENSHOT_MAX_BYTES}`);
    }
  }
}

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: false });
}

function main(): void {
  const repoRoot = resolve(process.cwd());
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

  checkEntry(repoRoot);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree(join(repoRoot, 'app'), join(outDir, 'app'));
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: MAX_SCREENSHOTS, max_bytes: SCREENSHOT_MAX_BYTES },
    app_max_files: APP_MAX_FILES,
    app_max_bytes: APP_MAX_BYTES,
    app_path_max_bytes: APP_PATH_MAX_BYTES,
  });
  if (dossier.length > DOSSIER_MAX_BYTES) {
    fail(`dossier.json is ${dossier.length} bytes, over ${DOSSIER_MAX_BYTES}`);
  }
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
}

main();
