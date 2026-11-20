// VICE AT 3 AM — the editor state: the photo library, the five panels,
// drag-to-position gestures and the Surprise me randomiser.

import { panelRects } from './cover.js';

export const SAMPLES = [
  { id: 'cast-driver', src: 'samples/cast-driver.jpg', name: 'The Driver — convertible' },
  { id: 'cast-insider', src: 'samples/cast-insider.jpg', name: 'The Insider — neon door' },
  { id: 'cast-boss', src: 'samples/cast-boss.jpg', name: 'The Boss — white suit' },
  { id: 'cast-rider', src: 'samples/cast-rider.jpg', name: 'The Rider — motorcycle' },
  { id: 'cast-courier', src: 'samples/cast-courier.jpg', name: 'The Courier — neon sign' },
  { id: 'scene-street', src: 'samples/scene-street.jpg', name: 'Neon street — rain' },
  { id: 'scene-motel', src: 'samples/scene-motel.jpg', name: 'Motel sign — night' },
];

export const PANEL_ROLES = ['THE DRIVER', 'THE INSIDER', 'THE BOSS', 'THE RIDER', 'THE COURIER'];

export function defaultState() {
  return {
    title: 'VICE AT 3 AM',
    subtitle: 'one last summer in the city',
    tagline: 'FIVE FRIENDS · ONE CITY · NO WAY BACK.',
    quote: 'PURE NEON MAYHEM',
    quoteSource: 'THE HARBOR GAZETTE',
    grade: 'night',
    layout: 'tilted',
    size: '1920x1080',
    selected: 0,
    panels: [
      { photoId: 'cast-driver', role: 'THE DRIVER', chip: { place: 'NEON HARBOR', time: '3:04 AM', quip: 'Catch me if you can.' }, zoom: 1, ox: 0, oy: 0 },
      { photoId: 'cast-insider', role: 'THE INSIDER', chip: { place: 'VELVET ROOM', time: '2:41 AM', quip: 'I know a guy.' }, zoom: 1, ox: 0, oy: 0 },
      { photoId: 'cast-boss', role: 'THE BOSS', chip: { place: 'SKYLINE TOWER', time: '1:58 AM', quip: 'The city is mine.' }, zoom: 1, ox: 0, oy: 0 },
      { photoId: 'cast-rider', role: 'THE RIDER', chip: { place: 'RAMEN ROW', time: '3:33 AM', quip: 'Full throttle.' }, zoom: 1, ox: 0, oy: 0 },
      { photoId: 'cast-courier', role: 'THE COURIER', chip: { place: 'OPEN 24H', time: '4:12 AM', quip: 'Package delivered.' }, zoom: 1, ox: 0, oy: 0 },
    ],
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

export class PhotoLibrary {
  constructor() {
    this.items = [];
  }

  async loadSamples() {
    this.items = await Promise.all(SAMPLES.map(async (s) => {
      const image = await loadImage(s.src);
      return { ...s, image };
    }));
  }

  get(id) {
    return this.items.find((it) => it.id === id) || null;
  }

  async addFile(file) {
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);
    const item = {
      id: `upload-${Date.now()}`,
      src: url,
      name: file.name.replace(/\.[^.]+$/, '') || 'Your photo',
      image,
    };
    this.items.push(item);
    return item;
  }
}

// Attach loaded images to the panels so the painter can draw them.
export function resolvePanels(state, library) {
  return state.panels.map((p) => {
    const item = library.get(p.photoId);
    return { ...p, image: item ? item.image : null };
  });
}

const TITLES = [
  'VICE AT 3 AM', 'NEON HARBOR', 'THE LAST SUMMER', 'MIDNIGHT RUNNERS',
  'CITY OF NEON', 'RAINY VICE', 'THE CREW', 'AFTER DARK',
];
const SUBTITLES = [
  'one last summer in the city', 'the city never sleeps', 'five friends, one night',
  'chase the neon', 'no way back', 'until the sun comes up',
];
const TAGLINES = [
  'FIVE FRIENDS · ONE CITY · NO WAY BACK.',
  'THE CITY NEVER SLEEPS. NEITHER DO WE.',
  'ONE NIGHT. FIVE LIVES. NO BRAKES.',
  'EVERY LIGHT HAS A SHADOW.',
];
const QUOTES = [
  ['PURE NEON MAYHEM', 'THE HARBOR GAZETTE'],
  ['A MIDNIGHT MASTERPIECE', 'VICE WEEKLY'],
  ['FIVE STARS OF PURE CHROME', 'THE NEON TIMES'],
];

function pick(rnd, arr) {
  return arr[Math.floor(rnd() * arr.length)];
}

export function surpriseMe(state, library) {
  const rnd = Math.random;
  state.title = pick(rnd, TITLES);
  state.subtitle = pick(rnd, SUBTITLES);
  state.tagline = pick(rnd, TAGLINES);
  const [quote, source] = pick(rnd, QUOTES);
  state.quote = quote;
  state.quoteSource = source;
  const grades = ['night', 'ember', 'sunset', 'ink', 'duotone'];
  state.grade = pick(rnd, grades);
  state.layout = rnd() < 0.5 ? 'tilted' : 'bleed';
  // Shuffle the cast across the panels, keeping the hero a character.
  const castIds = ['cast-driver', 'cast-insider', 'cast-boss', 'cast-rider', 'cast-courier'];
  for (let i = castIds.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [castIds[i], castIds[j]] = [castIds[j], castIds[i]];
  }
  state.panels.forEach((p, i) => {
    p.photoId = castIds[i];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
  });
}

// Pointer drag on the preview canvas: drag the selected panel's photo
// inside its frame; a click (no drag) selects the panel under the point.
export function attachCanvasGestures(canvas, state, library, redraw, previewSize) {
  let drag = null;

  function panelAt(x, y) {
    const { w, h } = previewSize();
    const rects = panelRects(w, h, state.layout);
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  function toCanvas(e) {
    const box = canvas.getBoundingClientRect();
    const { w, h } = previewSize();
    return {
      x: ((e.clientX - box.left) / box.width) * w,
      y: ((e.clientY - box.top) / box.height) * h,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const idx = panelAt(p.x, p.y);
    if (idx < 0) return;
    state.selected = idx;
    drag = { startX: p.x, startY: p.y, moved: false, panel: state.panels[idx] };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCanvas(e);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    const { w, h } = previewSize();
    const rects = panelRects(w, h, state.layout);
    const r = rects[state.selected];
    if (!r) return;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    drag.panel.ox = clamp(drag.panel.ox + dx / r.w, -0.6, 0.6);
    drag.panel.oy = clamp(drag.panel.oy + dy / r.h, -0.6, 0.6);
    drag.startX = p.x;
    drag.startY = p.y;
    redraw();
  });

  canvas.addEventListener('pointerup', () => {
    drag = null;
    redraw();
  });

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}
