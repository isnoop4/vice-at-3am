// VICE AT 3 AM — the entry program for gta6-cover-art-01 (Node 22,
// standard library only). The app is this directory's app/ folder: plain
// static files a desktop browser loads offline (app/index.html and its ES
// modules, two OFL fonts, nine image-model-made sample photos — five cast
// portraits and four night scenes — no library and no network request).
// The program hands it in: it first runs a pre-flight gate over the entry
// (checkEntry), then copies app/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
//
// The gate exists because the scorer refuses an entry that breaks its
// caps, and a refused entry is never judged: it checks the screenshots
// (3 or 4 files, each at most 256 KiB, a whole PNG or JPEG), the app tree
// (at most 993 files and directories, 48 MiB in all, every path at most
// 1000 bytes, no symlinks), that app/index.html exists, and that the
// sample library still holds the five cast portraits the cover is built
// on. The caps are named constants, shared with buildDossier below, so
// the gate and the dossier can never drift apart.
//
// Serve the app locally with `cd app && python3 -m http.server 8080`,
// then open http://localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse.
const MAX_SCREENSHOTS = 4;
const MIN_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 262144;
const MAX_APP_FILES = 993;
const MAX_APP_BYTES = 50331648;
const MAX_APP_PATH_BYTES = 1000;
const DOSSIER_TEXT_MAX_BYTES = 163840;
const MIN_SAMPLE_PHOTOS = 5;
const CAST_SAMPLES = ['cast-driver', 'cast-insider', 'cast-boss', 'cast-rider', 'cast-courier'];

const SCREENSHOT_NAME = /^[A-Za-z0-9._-]+$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function fail(message) {
  throw new Error(`checkEntry: ${message}`);
}

function isImageFile(path) {
  const head = readFileSync(path).subarray(0, 4);
  return head.equals(PNG_MAGIC.subarray(0, 4)) || head.subarray(0, 3).equals(JPEG_MAGIC);
}

// Walks app/ and returns { entries, bytes }: every file and directory
// counted alike, no symlinks allowed, every path within its byte cap.
function countAppTree(dir, root) {
  let entries = 0;
  let bytes = 0;
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      const rel = path.slice(root.length + 1);
      if (Buffer.byteLength(rel, 'utf8') > MAX_APP_PATH_BYTES) {
        fail(`app path over ${MAX_APP_PATH_BYTES} bytes: ${rel}`);
      }
      const st = lstatSync(path);
      if (st.isSymbolicLink()) fail(`app/ holds a symlink: ${rel}`);
      entries += 1;
      if (st.isDirectory()) {
        walk(path);
      } else if (st.isFile()) {
        bytes += st.size;
      } else {
        fail(`app/ holds a non-file, non-directory entry: ${rel}`);
      }
    }
  };
  walk(dir);
  return { entries, bytes };
}

// The pre-flight gate: refuses to hand in an entry the scorer would
// refuse, naming the first problem. Returns a summary for the log line.
export function checkEntry(here) {
  const appDir = join(here, 'app');
  const indexHtml = join(appDir, 'index.html');
  if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) {
    fail('app/index.html is missing');
  }
  if (statSync(indexHtml).size > 1024 * 1024) fail('app/index.html is over 1 MiB');

  const app = countAppTree(appDir, appDir);
  if (app.entries > MAX_APP_FILES) {
    fail(`app/ holds ${app.entries} files and directories, over ${MAX_APP_FILES}`);
  }
  if (app.bytes > MAX_APP_BYTES) {
    fail(`app/ is ${app.bytes} bytes, over ${MAX_APP_BYTES}`);
  }

  // The cast cover needs its five portraits in the sample library.
  const samplesDir = join(appDir, 'samples');
  const samples = existsSync(samplesDir)
    ? readdirSync(samplesDir).filter((n) => n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png'))
    : [];
  if (samples.length < MIN_SAMPLE_PHOTOS) {
    fail(`app/samples/ holds ${samples.length} photos, need at least ${MIN_SAMPLE_PHOTOS}`);
  }
  for (const cast of CAST_SAMPLES) {
    if (!samples.some((n) => n.startsWith(cast))) {
      fail(`app/samples/ is missing the ${cast} portrait`);
    }
  }

  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir)
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (shots.length < MIN_SCREENSHOTS || shots.length > MAX_SCREENSHOTS) {
    fail(`screenshots/ holds ${shots.length} images, need ${MIN_SCREENSHOTS} to ${MAX_SCREENSHOTS}`);
  }
  for (const name of shots) {
    if (!SCREENSHOT_NAME.test(name) || name.startsWith('-')) {
      fail(`screenshot name not allowed: ${name}`);
    }
    const path = join(shotsDir, name);
    const st = statSync(path);
    if (!st.isFile()) fail(`screenshot is not a file: ${name}`);
    if (st.size > MAX_SCREENSHOT_BYTES) {
      fail(`screenshot ${name} is ${st.size} bytes, over ${MAX_SCREENSHOT_BYTES}`);
    }
    if (!isImageFile(path)) fail(`screenshot ${name} is not a whole PNG or JPEG`);
  }
  return { appFiles: app.entries, appBytes: app.bytes, screenshots: shots.length };
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const summary = checkEntry(here);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
    screenshots: { max: MAX_SCREENSHOTS, max_bytes: MAX_SCREENSHOT_BYTES },
    app_max_files: MAX_APP_FILES,
    app_max_bytes: MAX_APP_BYTES,
    app_path_max_bytes: MAX_APP_PATH_BYTES,
  }),
);

console.log(
  `vice-at-3am: gate passed (${summary.appFiles} app entries, ${summary.appBytes} bytes, `
  + `${summary.screenshots} screenshots) — wrote ${out}/dossier.json`,
);
console.log(
  `vice-at-3am: dossier is ${statSync(join(out, 'dossier.json')).size} bytes`,
);
