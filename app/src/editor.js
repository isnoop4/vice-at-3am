// VICE AT 3 AM — editor state: the default poster, the photo library,
// pointer-drag positioning, and the Surprise me randomiser.
import { computeLayout } from './cover.js';

export const SAMPLE_PHOTOS = [
  { id: 'cast-driver', src: 'samples/cast-driver.jpg', name: 'The Driver — convertible, night' },
  { id: 'cast-insider', src: 'samples/cast-insider.jpg', name: 'The Insider — violet neon' },
  { id: 'cast-boss', src: 'samples/cast-boss.jpg', name: 'The Boss — downtown' },
  { id: 'cast-rider', src: 'samples/cast-rider.jpg', name: 'The Rider — motorcycle' },
  { id: 'cast-courier', src: 'samples/cast-courier.jpg', name: 'The Courier — floral shirt' },
  { id: 'scene-street', src: 'samples/scene-street.jpg', name: 'Neon street — rain' },
  { id: 'scene-motel', src: 'samples/scene-motel.jpg', name: 'Motel sign — night' },
];

const ROLES = ['THE DRIVER', 'THE INSIDER', 'THE BOSS', 'THE RIDER', 'THE COURIER'];
const CAST_IDS = ['cast-driver', 'cast-insider', 'cast-boss', 'cast-rider', 'cast-courier'];
const CHIPS = [
  { place: 'VICE CITY', time: '3:00 AM', quip: '“One last job.”' },
  { place: 'THE PIER', time: '11:47 PM', quip: '“I know a guy.”' },
  { place: 'DOWNTOWN', time: '2:15 AM', quip: '“This city is mine.”' },
  { place: 'THE STRIP', time: '1:05 AM', quip: '“Catch me if you can.”' },
  { place: 'LITTLE HAVANA', time: '4:20 AM', quip: '“Special delivery.”' },
];
const ANCHORS = [0.33, 0.33, 0.33, 0.12, 0.33];

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
    panels: ROLES.map((role, i) => ({
      photoId: CAST_IDS[i],
      role,
      chip: { ...CHIPS[i] },
      zoom: 1,
      ox: 0,
      oy: 0,
      anchor: ANCHORS[i],
    })),
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
    this.items = SAMPLE_PHOTOS.map((p) => ({ ...p }));
    this.images = new Map();
  }

  async loadSamples() {
    await Promise.all(this.items.map(async (item) => {
      const img = await loadImage(item.src);
      this.images.set(item.id, img);
    }));
  }

  async addFile(file) {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    const item = { id: `upload-${Date.now()}`, src: url, name: file.name || 'Your photo' };
    this.items.push(item);
    this.images.set(item.id, img);
    return item;
  }

  image(id) {
    return this.images.get(id) || null;
  }
}

// Resolve panel photo ids to loaded images for the painter.
export function resolvePanels(state, library) {
  return state.panels.map((p) => ({ ...p, img: library.image(p.photoId) }));
}

// Which panel sits under a point on the preview canvas, in preview pixels.
export function panelAtPoint(state, px, py, previewW, previewH) {
  const L = computeLayout(previewW, previewH, state.layout);
  const sx = previewW / 1920;
  const sy = previewH / 1080;
  void sx;
  void sy;
  // The painter scales the whole layout to the preview size, so recompute
  // the layout at the preview size and test each panel rect directly.
  for (let i = L.panels.length - 1; i >= 0; i--) {
    const r = L.panels[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

// Pointer drag on the canvas repositions the selected panel's photo.
export function attachCanvasGestures(canvas, state, library, redraw) {
  let drag = null;
  const toLocal = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toLocal(e);
    const hit = panelAtPoint(state, p.x, p.y, canvas.width, canvas.height);
    if (hit >= 0) {
      state.selected = hit;
      drag = { x: p.x, y: p.y, ox: state.panels[hit].ox, oy: state.panels[hit].oy };
      canvas.setPointerCapture(e.pointerId);
      redraw();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toLocal(e);
    const panel = state.panels[state.selected];
    const L = computeLayout(canvas.width, canvas.height, state.layout);
    const r = L.panels[state.selected];
    panel.ox = Math.max(-1, Math.min(1, drag.ox + ((p.x - drag.x) / r.w) * 4));
    panel.oy = Math.max(-1, Math.min(1, drag.oy + ((p.y - drag.y) / r.h) * 4));
    redraw();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

const SURPRISE_TITLES = [
  'VICE AT 3 AM',
  'NEON HARBOR',
  'MIDNIGHT RUN',
  'PALM & PISTOL',
  'THE LONG NIGHT',
  'CITY OF NEON',
];
const SURPRISE_SUBS = [
  'one last summer in the city',
  'the city never sleeps. neither do we.',
  'five friends. one score. no way back.',
  'every light hides a story.',
];
const GRADES = ['night', 'ember', 'sunset', 'ink', 'duotone'];
const LAYOUTS = ['tilted', 'bleed'];

export function surpriseMe(state, library) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  state.title = pick(SURPRISE_TITLES);
  state.subtitle = pick(SURPRISE_SUBS);
  state.grade = pick(GRADES);
  state.layout = pick(LAYOUTS);
  const ids = [...library.items.map((i) => i.id)];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.panels.forEach((p, i) => {
    p.photoId = ids[i % ids.length];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
  });
}
