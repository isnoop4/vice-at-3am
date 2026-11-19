// VICE AT 3 AM — the editor: state, the photo library, panel picking,
// drag-to-position and zoom, and the Surprise me random cover.
//
// Photos are read on the user's own machine (FileReader / object URLs)
// and never uploaded. Sample photos ship under app/samples/ and are
// image-model-made for this entry.

import { panelRects, PHOTO_ANCHOR_Y } from './cover.js';

export const SAMPLE_PHOTOS = [
  { id: 'cast-driver', name: 'The Driver', role: 'THE DRIVER', src: 'samples/cast-driver.jpg' },
  { id: 'cast-insider', name: 'The Insider', role: 'THE INSIDER', src: 'samples/cast-insider.jpg' },
  { id: 'cast-boss', name: 'The Boss', role: 'THE BOSS', src: 'samples/cast-boss.jpg' },
  { id: 'cast-rider', name: 'The Rider', role: 'THE RIDER', src: 'samples/cast-rider.jpg' },
  { id: 'cast-courier', name: 'The Courier', role: 'THE COURIER', src: 'samples/cast-courier.jpg' },
  { id: 'hero-street', name: 'Neon Street', src: 'samples/hero-street.jpg' },
  { id: 'convertible', name: 'Getaway', src: 'samples/convertible.jpg' },
  { id: 'motel', name: 'Palm Court Motel', src: 'samples/motel.jpg' },
  { id: 'pier-night', name: 'Pier 26', src: 'samples/pier-night.jpg' },
];

const CHIP_QUIPS = [
  'NO WITNESSES', 'LAST EXIT', 'VACANCY', 'GONE FISHING', 'CASH ONLY',
  'WRONG TURN', 'ONE LAST JOB', 'DO NOT DISTURB', 'OUT OF GAS', 'NO SIGNAL',
  'SPECIAL DELIVERY', 'NO QUESTIONS',
];
const CHIP_PLACES = [
  'OCEAN DRIVE', 'INTERSTATE 6', 'PALM COURT MOTEL', 'PIER 26',
  'NEON MILE', 'ROXY BAR', 'MARINA DEL SOL', 'TOWER 2',
];
const SURPRISE_TITLES = [
  'VICE AT 3 AM', 'NEON TIDE', 'LAST EXIT', 'NO WITNESSES',
  'THE LONG NIGHT', 'WET ASPHALT', 'CITY OF NEON',
  'NIGHT SHIFT', 'FIVE AT 3 AM', 'NEON CONFIDENTIAL',
];
const SURPRISE_SUBTITLES = [
  'the city never sleeps', 'one last job', 'cash only, no questions',
  'every light is a witness', 'drive all night', 'rain on neon',
];
const SURPRISE_TAGLINES = [
  'THE CITY NEVER SLEEPS. NEITHER DO WE.',
  'EVERY STREET HAS A PRICE AFTER MIDNIGHT.',
  'ONE LAST JOB. ONE LONG NIGHT.',
  'NO WITNESSES. NO PROBLEM.',
  'RAIN ON NEON. TROUBLE ON WHEELS.',
  'FIVE FRIENDS · ONE CITY · NO WAY BACK.',
];

// The default cover: the five cast portraits, each with its role chip.
// The hero (panel 0) is THE DRIVER; the bottom-row panels sit a touch
// lower in their frames so their faces clear the overlapping title.
export function defaultState() {
  return {
    title: 'VICE AT 3 AM',
    subtitle: 'the city never sleeps',
    tagline: 'FIVE FRIENDS · ONE CITY · NO WAY BACK.',
    quote: 'RAIN-SOAKED NEON MAYHEM',
    quoteSource: 'THE NIGHT GAZETTE',
    grade: 'night',
    layout: 'grid',
    size: '1920x1080',
    selected: 0,
    panels: [
      { photoId: 'cast-driver', zoom: 1, ox: 0, oy: 0, chip: { role: 'THE DRIVER', place: 'OCEAN DRIVE', time: '03:12 AM', quip: 'NO WITNESSES' } },
      { photoId: 'cast-insider', zoom: 1, ox: 0, oy: 0, chip: { role: 'THE INSIDER', place: 'NEON MILE', time: '02:47 AM', quip: 'CASH ONLY' } },
      { photoId: 'cast-boss', zoom: 1, ox: 0, oy: 0, chip: { role: 'THE BOSS', place: 'TOWER 2', time: '03:33 AM', quip: 'NO QUESTIONS' } },
      { photoId: 'cast-rider', zoom: 1, ox: 0, oy: 0.35, chip: { role: 'THE RIDER', place: 'INTERSTATE 6', time: '03:27 AM', quip: 'LAST EXIT' } },
      { photoId: 'cast-courier', zoom: 1, ox: 0, oy: 0, chip: { role: 'THE COURIER', place: 'PIER 26', time: '03:41 AM', quip: 'SPECIAL DELIVERY' } },
    ],
  };
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// The photo library: sample photos plus anything the user adds.
export class PhotoLibrary {
  constructor() {
    this.items = [];
    this.byId = new Map();
  }
  async loadSamples() {
    for (const sample of SAMPLE_PHOTOS) {
      const img = await loadImage(sample.src);
      const item = { ...sample, img };
      this.items.push(item);
      this.byId.set(item.id, item);
    }
  }
  async addFile(file) {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    const item = { id: `user-${this.items.length}-${Date.now()}`, name: file.name, src: url, img };
    this.items.push(item);
    this.byId.set(item.id, item);
    return item;
  }
  get(id) {
    return this.byId.get(id) ?? null;
  }
}

// Resolve a state's panels to drawable images for the renderer.
export function resolvePanels(state, library) {
  return state.panels.map((p) => ({
    ...p,
    photo: library.get(p.photoId)?.img ?? null,
  }));
}

// Which panel, if any, sits under a point on the preview canvas.
export function panelAt(state, canvasW, canvasH, x, y) {
  const { panels } = panelRects(state.layout, canvasW, canvasH);
  for (let i = panels.length - 1; i >= 0; i--) {
    const r = panels[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

// Clamp a panel's offset so its photo still covers the panel. The
// vertical range is anchor-aware: the crop sits at PHOTO_ANCHOR_Y of
// the spare height, so the photo can travel further up than down.
export function clampOffset(panel, img, rect) {
  if (!img || !img.naturalWidth) return;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * (panel.zoom ?? 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const maxOx = Math.max(0, (pw - rect.w) / 2 / rect.w);
  const slackY = Math.max(0, (ph - rect.h) / rect.h);
  const minOy = -slackY * (1 - PHOTO_ANCHOR_Y);
  const maxOy = slackY * PHOTO_ANCHOR_Y;
  panel.ox = Math.max(-maxOx, Math.min(maxOx, panel.ox ?? 0));
  panel.oy = Math.max(minOy, Math.min(maxOy, panel.oy ?? 0));
}

// Wire pointer drag (move the photo) and wheel (zoom) on the preview.
export function attachCanvasGestures(canvas, state, library, redraw) {
  let dragging = null;
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const i = panelAt(state, canvas.width, canvas.height, p.x, p.y);
    if (i < 0) return;
    state.selected = i;
    dragging = { i, x: p.x, y: p.y };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toCanvas(e);
    const panel = state.panels[dragging.i];
    const { panels } = panelRects(state.layout, canvas.width, canvas.height);
    const rect = panels[dragging.i];
    panel.ox = (panel.ox ?? 0) + (p.x - dragging.x) / rect.w;
    panel.oy = (panel.oy ?? 0) + (p.y - dragging.y) / rect.h;
    clampOffset(panel, library.get(panel.photoId)?.img, rect);
    dragging = { ...dragging, x: p.x, y: p.y };
    redraw();
  });
  const endDrag = () => { dragging = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toCanvas(e);
    const i = panelAt(state, canvas.width, canvas.height, p.x, p.y);
    if (i < 0) return;
    const panel = state.panels[i];
    state.selected = i;
    panel.zoom = Math.max(1, Math.min(3, (panel.zoom ?? 1) * Math.pow(1.0015, -e.deltaY)));
    const { panels } = panelRects(state.layout, canvas.width, canvas.height);
    clampOffset(panel, library.get(panel.photoId)?.img, panels[i]);
    redraw();
  }, { passive: false });
}

// Surprise me: a whole new random cover in one click — grade, layout,
// title, subtitle, tagline, photos and chips all re-rolled.
export function surpriseMe(state, library) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  state.grade = pick(['night', 'night', 'sunset', 'ink', 'duotone']);
  state.layout = pick(['grid', 'grid', 'bleed']);
  state.title = pick(SURPRISE_TITLES);
  state.subtitle = pick(SURPRISE_SUBTITLES);
  state.tagline = pick(SURPRISE_TAGLINES);
  const ids = library.items.map((it) => it.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.panels.forEach((panel, i) => {
    panel.photoId = ids[i % ids.length];
    const role = library.get(panel.photoId)?.role;
    if (role) panel.chip.role = role;
    panel.zoom = 1 + Math.random() * 0.35;
    panel.ox = (Math.random() - 0.5) * 0.2;
    panel.oy = (Math.random() - 0.5) * 0.2;
    const hour = 2 + Math.floor(Math.random() * 2);
    const min = Math.floor(Math.random() * 60);
    panel.chip = {
      role: panel.chip.role,
      place: pick(CHIP_PLACES),
      time: `0${hour}:${String(min).padStart(2, '0')} AM`,
      quip: pick(CHIP_QUIPS),
    };
  });
}
