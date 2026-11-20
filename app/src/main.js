// VICE AT 3 AM — the wiring: loads the samples, draws the live preview,
// binds every control, exports the PNG, and runs the fixed scenes the
// screenshots are taken from (?shot=cover / ?shot=editor / ?shot=cover-portrait
// / ?shot=cover-square).

import { drawCover, SIZES, GRADES, LAYOUTS } from './cover.js';
import {
  defaultState, loadImage, PhotoLibrary, resolvePanels,
  attachCanvasGestures, surpriseMe, PANEL_ROLES,
} from './editor.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');
const state = defaultState();
const library = new PhotoLibrary();
const status = $('status');

let previewW = 960;
let previewH = 540;

function sizePreview() {
  const [w, h] = SIZES[state.size];
  const s = Math.min(960 / w, 640 / h);
  previewW = Math.round(w * s);
  previewH = Math.round(h * s);
  canvas.width = previewW;
  canvas.height = previewH;
}

function drawState() {
  drawCover(ctx, { ...state, panels: resolvePanels(state, library) }, previewW, previewH);
}

function redraw() {
  drawState();
  syncPanelControls();
}

// --- Library thumbnails: click one to put it in the selected panel. ---
function renderLibrary() {
  const box = $('library');
  box.innerHTML = '';
  library.items.forEach((item) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = item.name;
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.name;
    b.appendChild(img);
    const cap = document.createElement('span');
    cap.textContent = item.name;
    b.appendChild(cap);
    b.addEventListener('click', () => {
      state.panels[state.selected].photoId = item.id;
      state.panels[state.selected].zoom = 1;
      state.panels[state.selected].ox = 0;
      state.panels[state.selected].oy = 0;
      redraw();
    });
    box.appendChild(b);
  });
}

// --- Panel picker + zoom slider + chip fields for the selected panel. ---
function renderPanels() {
  const box = $('panels');
  box.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-btn' + (state.selected === i ? ' selected' : '');
    b.textContent = `${PANEL_ROLES[i]} — ${panel.chip.place}`;
    b.addEventListener('click', () => {
      state.selected = i;
      redraw();
    });
    box.appendChild(b);
  });
}

function syncPanelControls() {
  renderPanels();
  const panel = state.panels[state.selected];
  $('zoom').value = String(panel.zoom ?? 1);
  $('role').value = panel.role;
  $('chip-place').value = panel.chip.place;
  $('chip-time').value = panel.chip.time;
  $('chip-quip').value = panel.chip.quip;
  document.querySelectorAll('#grades .choice').forEach((b) => {
    b.classList.toggle('selected', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('#layouts .choice').forEach((b) => {
    b.classList.toggle('selected', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#sizes .choice').forEach((b) => {
    b.classList.toggle('selected', b.dataset.size === state.size);
  });
}

function renderChoices() {
  const grades = $('grades');
  Object.entries(GRADES).forEach(([key, g]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.dataset.grade = key;
    b.textContent = g.label;
    b.addEventListener('click', () => { state.grade = key; redraw(); });
    grades.appendChild(b);
  });
  const layouts = $('layouts');
  Object.entries(LAYOUTS).forEach(([key, l]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.dataset.layout = key;
    b.textContent = l.label;
    b.addEventListener('click', () => { state.layout = key; redraw(); });
    layouts.appendChild(b);
  });
  const sizes = $('sizes');
  Object.keys(SIZES).forEach((key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.dataset.size = key;
    b.textContent = key.replace('x', ' × ');
    b.addEventListener('click', () => {
      state.size = key;
      sizePreview();
      redraw();
    });
    sizes.appendChild(b);
  });
}

// --- Export: render the cover at full export size and download the PNG. ---
function exportCover() {
  const [w, h] = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off.getContext('2d'), { ...state, panels: resolvePanels(state, library) }, w, h);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const name = `vice-at-3am-${state.size}.png`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      status.textContent = `Saved ${name} (${w} × ${h}).`;
      window.__lastExport = { width: w, height: h, bytes: blob?.size ?? 0, name };
      resolve(window.__lastExport);
    }, 'image/png');
  });
}

function bindControls() {
  $('title').addEventListener('input', (e) => { state.title = e.target.value.toUpperCase(); redraw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('tagline').addEventListener('input', (e) => { state.tagline = e.target.value.toUpperCase(); redraw(); });
  $('quote').addEventListener('input', (e) => { state.quote = e.target.value.toUpperCase(); redraw(); });
  $('role').addEventListener('input', (e) => { state.panels[state.selected].role = e.target.value.toUpperCase(); redraw(); });
  $('chip-place').addEventListener('input', (e) => { state.panels[state.selected].chip.place = e.target.value; redraw(); });
  $('chip-time').addEventListener('input', (e) => { state.panels[state.selected].chip.time = e.target.value; redraw(); });
  $('chip-quip').addEventListener('input', (e) => { state.panels[state.selected].chip.quip = e.target.value; redraw(); });
  $('zoom').addEventListener('input', (e) => {
    const panel = state.panels[state.selected];
    panel.zoom = Number(e.target.value);
    redraw();
  });
  $('upload').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      const item = await library.addFile(file);
      state.panels[state.selected].photoId = item.id;
    }
    renderLibrary();
    redraw();
  });
  $('surprise').addEventListener('click', () => {
    surpriseMe(state, library);
    $('title').value = state.title;
    $('subtitle').value = state.subtitle;
    $('tagline').value = state.tagline;
    $('quote').value = state.quote;
    sizePreview();
    redraw();
  });
  $('export').addEventListener('click', exportCover);
  attachCanvasGestures(canvas, state, library, redraw, () => ({ w: previewW, h: previewH }));
}

// --- Fixed scenes for screenshots: ?shot=cover shows the cover alone
// at the window's size; ?shot=editor shows the editor with a photo
// loaded. window.__shotReady is set once painted. ---
async function runShot(shot, query) {
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('title')) state.title = query.get('title');
  if (query.get('size')) state.size = query.get('size');
  // Load the display fonts explicitly: canvas text must not fall back
  // to a system font on the first paint.
  await Promise.all([
    document.fonts.load('40px Anton'),
    document.fonts.load('40px Yellowtail'),
    document.fonts.ready,
  ]);
  if (shot === 'cover' || shot === 'cover-portrait' || shot === 'cover-square') {
    document.body.classList.add('shot-cover');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    previewW = canvas.width;
    previewH = canvas.height;
    drawState();
  } else {
    sizePreview();
    drawState();
    syncPanelControls();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

async function boot() {
  await library.loadSamples();
  renderLibrary();
  renderChoices();
  bindControls();
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query);
  } else {
    sizePreview();
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Yellowtail'),
      document.fonts.ready,
    ]);
    redraw();
  }
  window.__viceAt3am = { state, library, exportCover, drawState, loadImage };
}

boot().catch((err) => {
  status.textContent = `Could not start: ${err.message}`;
});
