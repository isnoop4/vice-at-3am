// VICE AT 3 AM — the editor: state, the photo library, canvas drag
// gestures, and Surprise me. The cover itself is painted by cover.js;
// this file only owns the interactive state around it.

import { GRADES, LAYOUTS } from './cover.js';

export const SAMPLE_PHOTOS = [
  { id: 'cast-driver', name: 'The Driver — convertible', src: 'samples/cast-driver.jpg' },
  { id: 'cast-insider', name: 'The Insider — purple neon', src: 'samples/cast-insider.jpg' },
  { id: 'cast-boss', name: 'The Boss — rooftop', src: 'samples/cast-boss.jpg' },
  { id: 'cast-rider', name: 'The Rider — motorcycle', src: 'samples/cast-rider.jpg' },
  { id: 'cast-courier', name: 'The Courier — neon shop', src: 'samples/cast-courier.jpg' },
  { id: 'scene-street', name: 'Neon boulevard', src: 'samples/scene-street.jpg' },
  { id: 'scene-motel', name: 'Motel sign', src: 'samples/scene-motel.jpg' },
];

export const PANEL_ROLES = ['THE DRIVER', 'THE INSIDER', 'THE BOSS', 'THE RIDER', 'THE COURIER'];

const DEFAULT_CHIPS = [
  { place: 'Neon Blvd', time: '3:12 AM', quip: 'One last ride.' },
  { place: 'The Voodoo Room', time: '1:40 AM', quip: 'She knows everything.' },
  { place: 'Rooftop', time: 'Midnight', quip: 'The city is mine.' },
  { place: 'Ocean Drive', time: '2:05 AM', quip: 'Full throttle.' },
  { place: 'Corner Store', time: '3:33 AM', quip: 'Special delivery.' },
];

export const SURPRISE_TITLES = [
  'VICE AT 3 AM',
  'NEON HARBOR',
  'MIDNIGHT RUNNERS',
  'THE LAST SUMMER',
  'PALM & PAVEMENT',
  'CITY OF STATIC',
];

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
    panels: PANEL_ROLES.map((role, i) => ({
      photoId: SAMPLE_PHOTOS[i].id,
      role,
      chip: { ...DEFAULT_CHIPS[i] },
      zoom: 1,
      ox: 0,
      oy: 0,
      // The rider's face sits high in his photo; anchor his crop near
      // the top so it survives the wide-short panels.
      anchor: i === 3 ? 0.10 : 0.33,
      img: null,
    })),
  };
}

// The photo library: the seven sample photos plus anything the person
// uploads from their own machine. Uploads are read locally with an
// object URL and never leave the browser.
export class PhotoLibrary {
  constructor() {
    this.items = [];
  }

  async loadSamples() {
    const loaded = await Promise.all(
      SAMPLE_PHOTOS.map(async (p) => {
        const img = new Image();
        img.src = p.src;
        try {
          await img.decode();
        } catch {
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }
        return { ...p, img };
      }),
    );
    this.items = loaded;
    return loaded;
  }

  async addFile(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => undefined);
    const item = {
      id: `upload-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: file.name,
      src: url,
      img,
    };
    this.items.push(item);
    return item;
  }

  byId(id) {
    return this.items.find((item) => item.id === id) || null;
  }
}

// Attach the loaded images to the state's panels for one draw.
export function resolvePanels(state, library) {
  return state.panels.map((panel) => {
    const item = library.byId(panel.photoId);
    return { ...panel, img: item ? item.img : null };
  });
}

// Drag the photo inside the selected panel: pointer down on the canvas
// picks the panel under the cursor, dragging pans its crop (ox/oy).
// layout is the panel rects drawCover returned for this canvas size.
export function attachCanvasGestures(canvas, state, getLayout, redraw) {
  let drag = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    const layout = getLayout();
    if (!layout) return;
    const idx = layout.panels.findIndex(
      (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
    );
    if (idx < 0) return;
    state.selected = idx;
    drag = { x: p.x, y: p.y, ox: state.panels[idx].ox, oy: state.panels[idx].oy, w: layout.panels[idx].w, h: layout.panels[idx].h };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pos(e);
    const panel = state.panels[state.selected];
    panel.ox = Math.max(-1, Math.min(1, drag.ox + ((p.x - drag.x) / drag.w) * 2));
    panel.oy = Math.max(-1, Math.min(1, drag.oy + ((p.y - drag.y) / drag.h) * 2));
    redraw();
  });
  const end = () => {
    drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

// Surprise me: a new title, a random grade and layout, and the photos
// shuffled across the panels.
export function surpriseMe(state, library) {
  const titles = SURPRISE_TITLES.filter((t) => t !== state.title);
  state.title = titles[Math.floor(Math.random() * titles.length)];
  const grades = Object.keys(GRADES);
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  const layouts = Object.keys(LAYOUTS);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  const ids = state.panels.map((p) => p.photoId);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.panels.forEach((p, i) => {
    p.photoId = ids[i];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
  });
}
