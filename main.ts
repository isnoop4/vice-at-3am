// VICE AT 3 AM — the entrypoint.
//
// main.ts hands the entry in: it copies app/ and screenshots/ from this
// repository to /output (or $MAKEFUN_OUTPUT_DIR) and writes
// /output/dossier.json with buildDossier from vendor/makefun-app.ts,
// the kit's library, unchanged.
//
// Before it copies anything, checkEntry() runs a pre-flight gate over
// the source tree, and it runs again over the copy: app/index.html must
// be present, screenshots/ must hold 3–4 images within the byte cap, and
// app/ must stay inside the entry and byte caps with no symlinks. A bad
// tree fails loudly (exit 1) instead of handing in a broken dossier.

import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const DOSSIER_MAX_BYTES = 1572864; // 1.5 MiB, the scorer's cap
const INDEX_HTML_MAX_BYTES = 1024 * 1024;
const SCREENSHOT_NAME = /^[A-Za-z0-9._-]+$/;

function fail(message: string): never {
  console.error(`checkEntry: ${message}`);
  process.exit(1);
}

function isPng(buffer: Buffer): boolean {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

// Walk a directory tree, counting entries and bytes, refusing symlinks.
function walkTree(dir: string, base: string): { entries: number; bytes: number } {
  let entries = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = full.slice(base.length + 1);
    if (Buffer.byteLength(rel, 'utf8') > CAPS.app_path_max_bytes) {
      fail(`path over ${CAPS.app_path_max_bytes} bytes: ${rel}`);
    }
    const st = lstatSync(full);
    if (st.isSymbolicLink()) fail(`symlink in app/: ${rel}`);
    entries += 1;
    if (st.isDirectory()) {
      const sub = walkTree(full, base);
      entries += sub.entries;
      bytes += sub.bytes;
    } else if (st.isFile()) {
      bytes += st.size;
    } else {
      fail(`special file in app/: ${rel}`);
    }
  }
  return { entries, bytes };
}

function checkEntry(root: string): void {
  const appDir = join(root, 'app');
  if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
    fail('app/ is missing');
  }
  const index = join(appDir, 'index.html');
  if (!existsSync(index) || !statSync(index).isFile()) {
    fail('app/index.html is missing');
  }
  if (statSync(index).size > INDEX_HTML_MAX_BYTES) {
    fail(`app/index.html over ${INDEX_HTML_MAX_BYTES} bytes`);
  }
  const { entries, bytes } = walkTree(appDir, appDir);
  if (entries > CAPS.app_max_files) fail(`app/ holds ${entries} entries, over ${CAPS.app_max_files}`);
  if (bytes > CAPS.app_max_bytes) fail(`app/ is ${bytes} bytes, over ${CAPS.app_max_bytes}`);
  const shotsDir = join(root, 'screenshots');
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    fail('screenshots/ is missing');
  }
  const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.'));
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    fail(`screenshots/ holds ${shots.length} images, need 3 to ${CAPS.screenshots.max}`);
  }
  for (const name of shots) {
    if (!SCREENSHOT_NAME.test(name) || name.startsWith('-')) {
      fail(`bad screenshot name: ${name}`);
    }
    const full = join(shotsDir, name);
    if (!statSync(full).isFile()) fail(`screenshot is not a file: ${name}`);
    const size = statSync(full).size;
    if (size > CAPS.screenshots.max_bytes) {
      fail(`screenshot ${name} is ${size} bytes, over ${CAPS.screenshots.max_bytes}`);
    }
    const head = Buffer.alloc(8);
    const fd = openSync(full, 'r');
    try {
      readSync(fd, head, 0, head.length, 0);
    } finally {
      closeSync(fd);
    }
    if (!isPng(head) && !isJpeg(head)) fail(`screenshot ${name} is neither PNG nor JPEG`);
  }
}

function main(): void {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  checkEntry(repoRoot);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const cp = (src: string, dest: string) => {
    mkdirSync(dest, { recursive: true });
    for (const name of readdirSync(src)) {
      const s = join(src, name);
      const d = join(dest, name);
      if (statSync(s).isDirectory()) cp(s, d);
      else copyFileSync(s, d);
    }
  };
  cp(join(repoRoot, 'app'), join(outDir, 'app'));
  cp(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
  checkEntry(outDir);
  const dossier = buildDossier(outDir, CAPS);
  if (Buffer.byteLength(dossier) > DOSSIER_MAX_BYTES) {
    fail(`dossier is ${Buffer.byteLength(dossier)} bytes, over ${DOSSIER_MAX_BYTES}`);
  }
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${join(outDir, 'dossier.json')} (${Buffer.byteLength(dossier)} bytes)`);
}

main();
