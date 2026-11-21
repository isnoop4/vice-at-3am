// VICE AT 3 AM — entrypoint for the make.fun gta6-cover-art-01 bounty.
//
// Copies the cover studio (app/) and its screenshots (screenshots/) into
// the output directory and writes the dossier there, using the kit's
// buildDossier.
//
// The repository root is taken from this file's own location
// (fileURLToPath(new URL('.', import.meta.url))), never from the working
// directory: the grader runs `node main.ts` from an arbitrary directory,
// so resolving the root from process.cwd() would look in the wrong place.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root: the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// Where the entry goes: the caller's directory, or /output by default.
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The bounty's caps, from its gate.json.
const INDEX_HTML_MAX_BYTES = 1024 * 1024;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 48 * 1024 * 1024;
const APP_PATH_MAX_BYTES = 1000;
const SHOTS_MIN = 3;
const SHOTS_MAX = 4;
const SHOT_NAME = /^[A-Za-z0-9._-]{1,128}$/;
const SHOT_MAX_BYTES = 256 * 1024;
const DOSSIER_MAX_BYTES = 1536 * 1024;
const TEXT_MAX_BYTES = 163840;

function fail(reason) {
  throw new Error(`checkEntry: ${reason}`);
}

// The pre-flight gate: refuse anything the scorer would refuse, before
// any output is written.
function checkEntry() {
  const appDir = join(repoRoot, 'app');
  const shotsDir = join(repoRoot, 'screenshots');

  // app/index.html: the page, a plain file, at most 1 MiB.
  const indexPath = join(appDir, 'index.html');
  let indexStat;
  try {
    indexStat = lstatSync(indexPath);
  } catch {
    fail('app/index.html is missing');
  }
  if (!indexStat.isFile()) fail('app/index.html is not a regular file');
  if (indexStat.size > INDEX_HTML_MAX_BYTES) {
    fail(`app/index.html is ${indexStat.size} bytes, over the ${INDEX_HTML_MAX_BYTES} allowed`);
  }

  // app/: a directory of plain files and directories, within the caps.
  let appStat;
  try {
    appStat = lstatSync(appDir);
  } catch {
    fail('app/ is missing');
  }
  if (!appStat.isDirectory()) fail('app/ is not a directory');
  let entries = 0;
  let totalBytes = 0;
  // A sorted walk, counted the platform's way: every file and every
  // directory under app/ is one entry. lstatSync never follows a link,
  // so a symlink is seen as a link and refused, not as its target.
  const walk = (dir, rel) => {
    const names = readdirSync(dir, { withFileTypes: true }).map((d) => d.name).sort();
    for (const name of names) {
      const relPath = rel === '' ? name : `${rel}/${name}`;
      if (Buffer.byteLength(relPath, 'utf8') > APP_PATH_MAX_BYTES) {
        fail(`app/${relPath}: a path of more than ${APP_PATH_MAX_BYTES} bytes`);
      }
      const child = join(dir, name);
      const st = lstatSync(child);
      entries += 1;
      if (entries > APP_MAX_FILES) {
        fail(`app/: holds more than the ${APP_MAX_FILES} files and directories allowed`);
      }
      if (st.isSymbolicLink()) fail(`app/${relPath}: a symbolic link (app/ holds plain files and directories only)`);
      if (st.isDirectory()) {
        walk(child, relPath);
      } else if (st.isFile()) {
        totalBytes += st.size;
        if (totalBytes > APP_MAX_BYTES) {
          fail(`app/: its files come to more than the ${APP_MAX_BYTES} bytes allowed`);
        }
      } else {
        fail(`app/${relPath}: a special file (app/ holds plain files and directories only)`);
      }
    }
  };
  walk(appDir, '');

  // screenshots/: 3 or 4 plain image files, sensibly named and sized.
  let shotsStat;
  try {
    shotsStat = lstatSync(shotsDir);
  } catch {
    fail('screenshots/ is missing');
  }
  if (!shotsStat.isDirectory()) fail('screenshots/ is not a directory');
  const shots = readdirSync(shotsDir, { withFileTypes: true })
    .filter((d) => !d.name.startsWith('.'));
  if (shots.length < SHOTS_MIN || shots.length > SHOTS_MAX) {
    fail(`screenshots/ holds ${shots.length} files, not ${SHOTS_MIN} to ${SHOTS_MAX}`);
  }
  for (const shot of shots) {
    const st = lstatSync(join(shotsDir, shot.name));
    if (!st.isFile()) fail(`screenshots/${shot.name} is not a regular file`);
    if (!SHOT_NAME.test(shot.name)) fail(`screenshots/${shot.name}: a name outside [A-Za-z0-9._-]{1,128}`);
    if (st.size > SHOT_MAX_BYTES) {
      fail(`screenshots/${shot.name} is ${st.size} bytes, over the ${SHOT_MAX_BYTES} allowed`);
    }
  }
}

function main() {
  checkEntry();

  // A clean output directory, then the entry's files.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true, dereference: false });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true, dereference: false });

  const dossier = buildDossier(outDir, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: SHOTS_MAX, max_bytes: SHOT_MAX_BYTES },
    app_max_files: APP_MAX_FILES,
    app_max_bytes: APP_MAX_BYTES,
    app_path_max_bytes: APP_PATH_MAX_BYTES,
  });
  if (dossier.length > DOSSIER_MAX_BYTES) {
    fail(`dossier.json is ${dossier.length} bytes, over the ${DOSSIER_MAX_BYTES} allowed`);
  }
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  console.log(`wrote ${dossierPath} (${dossier.length} bytes)`);
}

main();
