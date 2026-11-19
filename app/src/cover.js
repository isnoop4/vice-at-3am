// VICE AT 3 AM — the cover renderer: draws the whole poster on a canvas.
// Own art only: no Rockstar logo, artwork or font. Title in Anton (OFL),
// subtitle in Yellowtail (OFL), both vendored under app/fonts/.
//
// The cover: a cold-blue night world (cyan + magenta neon on deep navy),
// a hero panel + three captioned scene panels, a chrome title with cyan
// glow, a magenta neon-script subtitle, police-radio caption chips, a
// Leonida licence-plate badge and the tagline strip.
//
// drawCover(ctx, state, W, H) draws at any size: 1920x1080, 1080x1350,
// 1080x1080. The same function draws the live preview and the export.

export const SIZES = {
  '1920x1080': [1920, 1080],
  '1080x1350': [1080, 1350],
  '1080x1080': [1080, 1080],
};

// One-click colour grades: a canvas filter for the photos plus a tint
// overlay drawn over each panel. Night is the house grade.
export const GRADES = {
  night: {
    label: 'Night',
    filter: 'saturate(1.15) contrast(1.06) brightness(0.98)',
    tint: ['rgba(8,30,60,0.10)', 'rgba(2,10,26,0.30)'],
    tintMode: 'source-over',
  },
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.35) contrast(1.05) hue-rotate(-18deg)',
    tint: ['rgba(255,110,40,0.20)', 'rgba(200,30,110,0.30)'],
    tintMode: 'source-over',
  },
  ink: {
    label: 'Ink',
    filter: 'grayscale(1) contrast(1.38) brightness(1.03)',
    tint: ['rgba(255,60,170,0.08)', 'rgba(10,10,20,0.22)'],
    tintMode: 'source-over',
  },
  duotone: {
    label: 'Duotone',
    filter: 'grayscale(1) contrast(1.25) brightness(1.02)',
    tint: ['rgba(0,229,255,0.55)', 'rgba(255,79,216,0.55)'],
    tintMode: 'overlay',
  },
};

// Wide (landscape) art gets the side-by-side grid and the title band
// with the plate on the right; anything near square or portrait gets the
// stacked grid and a centred title band. A square is NOT landscape.
export function isLandscape(W, H) {
  return W > H * 1.15;
}

export const LAYOUTS = {
  grid: { label: 'Night Grid' },
  bleed: { label: 'Full Bleed' },
};

// Deterministic pseudo-random: the same cover always draws the same rain
// and skyline, so the preview and the export match exactly.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAVY = '#050d18';
const NAVY_BAND = '#0a1a2e';
const CYAN = '#00e5ff';
const MAGENTA = '#ff4fd8';
const PAPER = '#eaf6ff';

// Geometry: panel rectangles, title band and tagline strip for a layout
// and a canvas size. Panel 0 is the hero; 1..3 are the scene panels.
export function panelRects(layout, W, H) {
  const stripH = Math.round(H * (isLandscape(W, H) ? 0.075 : 0.06));
  const titleH = Math.round(H * (isLandscape(W, H) ? 0.335 : 0.30));
  const panelsH = H - titleH - stripH;
  const gap = Math.max(6, Math.round(W * 0.006));
  const strip = { x: 0, y: H - stripH, w: W, h: stripH };
  const titleBand = { x: 0, y: panelsH, w: W, h: titleH };
  if (layout === 'bleed') {
    // Hero full-bleed; three scene panels ride as a film strip across it.
    const filmH = Math.round(H * (isLandscape(W, H) ? 0.20 : 0.16));
    const filmY = Math.round(H * (isLandscape(W, H) ? 0.50 : 0.46));
    const fw = (W - gap * 4) / 3;
    return {
      panels: [
        { x: 0, y: 0, w: W, h: H, hero: true },
        { x: gap, y: filmY, w: fw, h: filmH },
        { x: gap * 2 + fw, y: filmY, w: fw, h: filmH },
        { x: gap * 3 + fw * 2, y: filmY, w: fw, h: filmH },
      ],
      filmStrip: { x: 0, y: filmY, w: W, h: filmH },
      titleBand, strip, panelsH,
    };
  }
  if (isLandscape(W, H)) {
    // Landscape grid: hero left with a slashed right edge, three scenes
    // stacked in the right column.
    const heroW = Math.round(W * 0.585);
    const colX = Math.round(W * 0.60);
    const colW = W - colX;
    const rh = (panelsH - gap * 2) / 3;
    return {
      panels: [
        { x: 0, y: 0, w: heroW, h: panelsH, hero: true, slant: Math.round(W * 0.018) },
        { x: colX, y: 0, w: colW, h: rh },
        { x: colX, y: rh + gap, w: colW, h: rh },
        { x: colX, y: (rh + gap) * 2, w: colW, h: rh },
      ],
      titleBand, strip, panelsH,
    };
  }
  // Portrait / square grid: hero on top, three scenes in a row beneath.
  const heroH = Math.round(panelsH * 0.62);
  const rowY = heroH + gap;
  const rowH = panelsH - rowY;
  const cw = (W - gap * 2) / 3;
  return {
    panels: [
      { x: 0, y: 0, w: W, h: heroH, hero: true },
      { x: 0, y: rowY, w: cw, h: rowH },
      { x: cw + gap, y: rowY, w: cw, h: rowH },
      { x: (cw + gap) * 2, y: rowY, w: cw, h: rowH },
    ],
    titleBand, strip, panelsH,
  };
}

// Draws one photo to cover a rectangle, with the panel's zoom and offset.
function drawPhotoCover(ctx, img, rect, zoom, ox, oy) {
  if (!img || !img.naturalWidth) return;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - pw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - ph) / 2 + oy * rect.h;
  ctx.drawImage(img, dx, dy, pw, ph);
}

// A police-radio caption chip: place + time + quip, bottom-left of a panel.
function drawChip(ctx, rect, chip, scale) {
  const pad = 10 * scale;
  const barW = 5 * scale;
  const fontPlace = Math.max(13, Math.round(17 * scale));
  const fontQuip = Math.max(11, Math.round(14 * scale));
  ctx.font = `700 ${fontPlace}px Anton, 'Arial Black', sans-serif`;
  const line1 = chip.place.toUpperCase();
  ctx.font = `400 ${fontQuip}px system-ui, sans-serif`;
  const line2 = `${chip.time} — ${chip.quip.toUpperCase()}`;
  ctx.font = `700 ${fontPlace}px Anton, 'Arial Black', sans-serif`;
  const w1 = ctx.measureText(line1).width;
  ctx.font = `400 ${fontQuip}px system-ui, sans-serif`;
  const w2 = ctx.measureText(line2).width;
  const w = Math.max(w1, w2) + pad * 2 + barW;
  const h = fontPlace + fontQuip + pad * 2.1;
  const x = rect.x + 10 * scale;
  const y = rect.y + rect.h - h - 10 * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(3,12,24,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = CYAN;
  ctx.fillRect(x, y, barW, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${fontPlace}px Anton, 'Arial Black', sans-serif`;
  ctx.fillText(line1, x + barW + pad, y + pad + fontPlace * 0.9);
  ctx.fillStyle = CYAN;
  ctx.font = `400 ${fontQuip}px system-ui, sans-serif`;
  ctx.fillText(line2, x + barW + pad, y + pad + fontPlace + fontQuip * 1.05);
  ctx.restore();
}

// The chrome title: dark depth layers, a silver-cyan gradient fill, a
// dark outline and a cyan glow. Fits one line, or two lines on narrow art.
function drawChromeTitle(ctx, text, cx, baseline, size, maxW) {
  const font = (s) => `${s}px Anton, 'Arial Black', sans-serif`;
  ctx.font = font(size);
  let lines = [text];
  if (ctx.measureText(text).width > maxW && text.includes(' ')) {
    // Split at the space that balances the two lines best, never leaving
    // a lone word ("AM") on the second line.
    const words = text.split(' ');
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
      if (!best || w < best.w) best = { lines: [a, b], w };
    }
    lines = best.lines;
  }
  for (const line of lines) {
    ctx.font = font(size);
    while (ctx.measureText(line).width > maxW && size > 10) {
      size -= 2;
      ctx.font = font(size);
    }
  }
  const lineH = size * 1.02;
  const startY = lines.length > 1 ? baseline - lineH / 2 : baseline;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, li) => {
    const y = startY + li * lineH;
    const depth = Math.max(2, size * 0.045);
    ctx.fillStyle = '#030b16';
    for (let i = 5; i >= 1; i--) ctx.fillText(line, cx, y + (depth * i) / 5);
    const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.12);
    g.addColorStop(0, '#f4fbff');
    g.addColorStop(0.32, '#bfe9ff');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(0.58, '#7cc8f5');
    g.addColorStop(0.78, '#d9f2ff');
    g.addColorStop(1, '#8fd4ff');
    ctx.save();
    ctx.shadowColor = 'rgba(0,229,255,0.85)';
    ctx.shadowBlur = size * 0.20;
    ctx.fillStyle = g;
    ctx.fillText(line, cx, y);
    ctx.restore();
    ctx.lineWidth = Math.max(1.5, size * 0.02);
    ctx.strokeStyle = 'rgba(2,12,24,0.85)';
    ctx.strokeText(line, cx, y);
  });
  return { lines, size, lineH };
}

// A Leonida licence plate: the badge the top entries' VOL. 06 never was.
function drawPlate(ctx, x, y, w, h) {
  const r = h * 0.14;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = '#dfe9f2';
  ctx.fill();
  ctx.lineWidth = Math.max(2, h * 0.05);
  ctx.strokeStyle = '#0a2438';
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x + h * 0.08, y + h * 0.10, w - h * 0.16, h - h * 0.20, r * 0.7);
  ctx.strokeStyle = '#3a6b8c';
  ctx.lineWidth = Math.max(1, h * 0.025);
  ctx.stroke();
  ctx.fillStyle = '#0a2438';
  ctx.font = `${Math.round(h * 0.42)}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEONIDA · 3AM', x + w / 2, y + h * 0.52);
  ctx.fillStyle = '#0a2438';
  for (const [bx, by] of [[x + h * 0.16, y + h * 0.18], [x + w - h * 0.16, y + h * 0.18],
    [x + h * 0.16, y + h - h * 0.18], [x + w - h * 0.16, y + h - h * 0.18]]) {
    ctx.beginPath();
    ctx.arc(bx, by, h * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Rain streaks over the panel area, seeded so preview and export agree.
function drawRain(ctx, area, seed) {
  const rnd = seededRandom(seed);
  ctx.save();
  ctx.strokeStyle = 'rgba(180,230,255,0.10)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const n = Math.round(area.w / 14);
  for (let i = 0; i < n; i++) {
    const x = area.x + rnd() * area.w;
    const y = area.y + rnd() * area.h;
    const len = 12 + rnd() * 22;
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.18, y + len);
  }
  ctx.stroke();
  ctx.restore();
}

// A neon skyline silhouette along the top of the title band: buildings
// rise from the base of the skyline zone, inside the band, and the lit
// windows sit inside the buildings — never floating on their own.
function drawSkyline(ctx, band, seed) {
  const rnd = seededRandom(seed + 7);
  const zoneH = band.h * 0.34;
  const base = band.y + zoneH;
  ctx.save();
  const buildings = [];
  let x = band.x;
  while (x < band.x + band.w) {
    const bw = 34 + rnd() * 62;
    const bh = zoneH * (0.35 + rnd() * 0.65);
    buildings.push({ x, y: base - bh, w: bw, h: bh });
    x += bw + 4 + rnd() * 18;
  }
  ctx.fillStyle = '#0e2a44';
  for (const b of buildings) ctx.fillRect(b.x, b.y, b.w, b.h);
  // Lit windows: a few cyan and magenta dots, each inside a building.
  for (let i = 0; i < 34; i++) {
    const b = buildings[Math.floor(rnd() * buildings.length)];
    const wx = b.x + 4 + rnd() * Math.max(1, b.w - 8);
    const wy = b.y + 4 + rnd() * Math.max(1, b.h - 8);
    ctx.fillStyle = rnd() > 0.3 ? 'rgba(0,229,255,0.6)' : 'rgba(255,79,216,0.55)';
    ctx.fillRect(wx, wy, 3, 4);
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seed) {
  const rnd = seededRandom(seed + 21);
  ctx.save();
  ctx.fillStyle = 'rgba(207,233,255,0.85)';
  let bx = x;
  while (bx < x + w) {
    const bw = 2 + rnd() * 4;
    if (rnd() > 0.35) ctx.fillRect(bx, y, bw, h);
    bx += bw + 2 + rnd() * 4;
  }
  ctx.restore();
}

// The whole cover. state: { title, subtitle, tagline, grade, layout,
// panels: [{ photo, zoom, ox, oy, chip: { place, time, quip } }] }.
// photo is an <img> (or null). Draws at the canvas's own size.
export function drawCover(ctx, state, W, H) {
  const grade = GRADES[state.grade] ?? GRADES.night;
  const { panels, titleBand, strip, panelsH } = panelRects(state.layout, W, H);
  const scale = W / 1920;
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  // Panels: photo, grade filter, tint, white border, caption chip.
  const drawPanel = (i) => {
    const rect = panels[i];
    const panel = state.panels[i];
    if (!panel) return;
    ctx.save();
    ctx.beginPath();
    if (rect.slant) {
      ctx.moveTo(rect.x, rect.y);
      ctx.lineTo(rect.x + rect.w, rect.y);
      ctx.lineTo(rect.x + rect.w - rect.slant, rect.y + rect.h);
      ctx.lineTo(rect.x, rect.y + rect.h);
      ctx.closePath();
    } else {
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.clip();
    ctx.filter = grade.filter;
    drawPhotoCover(ctx, panel.photo, rect, panel.zoom ?? 1, panel.ox ?? 0, panel.oy ?? 0);
    ctx.filter = 'none';
    if (grade.tintMode !== 'source-over') ctx.globalCompositeOperation = grade.tintMode;
    const tint = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    tint.addColorStop(0, grade.tint[0]);
    tint.addColorStop(1, grade.tint[1]);
    ctx.fillStyle = tint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // White panel border.
    ctx.save();
    ctx.lineWidth = Math.max(3, 5 * scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    if (rect.slant) {
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y);
      ctx.lineTo(rect.x + rect.w, rect.y);
      ctx.lineTo(rect.x + rect.w - rect.slant, rect.y + rect.h);
      ctx.lineTo(rect.x, rect.y + rect.h);
      ctx.closePath();
      ctx.stroke();
      // Cyan slash along the slanted edge.
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.w + 2, rect.y);
      ctx.lineTo(rect.x + rect.w - rect.slant + 2, rect.y + rect.h);
      ctx.lineWidth = Math.max(2, 3 * scale);
      ctx.strokeStyle = CYAN;
      ctx.stroke();
    } else {
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
    if (state.layout === 'bleed' && i === 0) return; // hero carries no chip
    drawChip(ctx, rect, panel.chip, Math.max(0.55, scale * (isLandscape(W, H) ? 1 : 1.15)));
  };

  if (state.layout === 'bleed') {
    // Hero first, then the scrim that darkens its foot, then the film
    // strip rides on top of the scrim — never under it.
    drawPanel(0);
    const scrim = ctx.createLinearGradient(0, H * 0.42, 0, H);
    scrim.addColorStop(0, 'rgba(3,10,20,0)');
    scrim.addColorStop(1, 'rgba(3,10,20,0.88)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);
    drawPanel(1);
    drawPanel(2);
    drawPanel(3);
  } else {
    panels.forEach((_, i) => drawPanel(i));
  }

  // Rain over the panels.
  drawRain(ctx, { x: 0, y: 0, w: W, h: panelsH }, 31);

  // Title band: skyline, chrome title, neon script, plate, badges.
  const band = titleBand;
  const bandGrad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  bandGrad.addColorStop(0, NAVY_BAND);
  bandGrad.addColorStop(1, '#04090f');
  ctx.fillStyle = bandGrad;
  ctx.fillRect(band.x, band.y, band.w, band.h);
  drawSkyline(ctx, { x: band.x, y: band.y, w: band.w, h: band.h * 0.34 }, 77);
  ctx.fillStyle = 'rgba(0,229,255,0.9)';
  ctx.fillRect(band.x, band.y, band.w, Math.max(2, 3 * scale));

  const landscape = isLandscape(W, H);
  if (landscape) {
    // Wide band: giant title left of centre, script under it, licence
    // plate on the right with VOL / HEAT / EST stacked beneath it.
    const titleSize = Math.round(band.h * 0.46);
    drawChromeTitle(ctx, state.title, W * 0.37, band.y + band.h * 0.52, titleSize, W * 0.68);
    ctx.save();
    ctx.translate(W * 0.37, band.y + band.h * 0.74);
    ctx.rotate(-0.025);
    ctx.font = `${Math.round(band.h * 0.17)}px Yellowtail, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = Math.round(band.h * 0.09);
    ctx.fillStyle = MAGENTA;
    ctx.fillText(state.subtitle, 0, 0);
    ctx.restore();
    const plateW = Math.round(band.h * 1.15);
    const plateH = Math.round(band.h * 0.30);
    const plateX = W - plateW - W * 0.03;
    const plateY = band.y + band.h * 0.24;
    drawPlate(ctx, plateX, plateY, plateW, plateH);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = CYAN;
    ctx.font = `700 ${Math.round(band.h * 0.10)}px Anton, 'Arial Black', sans-serif`;
    const volY = plateY + plateH + band.h * 0.14;
    ctx.fillText('VOL. 03', plateX, volY);
    ctx.fillStyle = '#ffd23e';
    ctx.font = `${Math.round(band.h * 0.10)}px system-ui, sans-serif`;
    ctx.fillText('HEAT ★★★★★', plateX, volY + band.h * 0.13);
    ctx.fillStyle = 'rgba(234,246,255,0.6)';
    ctx.font = `400 ${Math.round(band.h * 0.075)}px system-ui, sans-serif`;
    ctx.fillText('EST. 2026', plateX, volY + band.h * 0.25);
    ctx.restore();
  } else {
    // Portrait / square band: centred title, script under it, and a
    // bottom row with the badges on the left and the plate on the right —
    // nothing overlaps the subtitle.
    const titleSize = Math.round(band.h * 0.30);
    drawChromeTitle(ctx, state.title, W * 0.5, band.y + band.h * 0.46, titleSize, W * 0.92);
    ctx.save();
    ctx.translate(W * 0.5, band.y + band.h * 0.64);
    ctx.rotate(-0.025);
    ctx.font = `${Math.round(band.h * 0.13)}px Yellowtail, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = Math.round(band.h * 0.09);
    ctx.fillStyle = MAGENTA;
    ctx.fillText(state.subtitle, 0, 0);
    ctx.restore();
    const plateH = Math.round(band.h * 0.16);
    const plateW = Math.round(band.h * 0.48);
    const plateX = W - plateW - W * 0.04;
    const plateY = band.y + band.h * 0.79;
    drawPlate(ctx, plateX, plateY, plateW, plateH);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const badgeY = plateY + plateH / 2;
    ctx.fillStyle = CYAN;
    ctx.font = `700 ${Math.round(band.h * 0.085)}px Anton, 'Arial Black', sans-serif`;
    ctx.fillText('VOL. 03', W * 0.04, badgeY);
    const volW = ctx.measureText('VOL. 03  ').width;
    ctx.fillStyle = '#ffd23e';
    ctx.font = `${Math.round(band.h * 0.085)}px system-ui, sans-serif`;
    ctx.fillText('HEAT ★★★★★', W * 0.04 + volW, badgeY);
    const heatW = ctx.measureText('HEAT ★★★★★  ').width;
    ctx.fillStyle = 'rgba(234,246,255,0.6)';
    ctx.fillText('EST. 2026', W * 0.04 + volW + heatW, badgeY);
    ctx.restore();
  }

  // Tagline strip: the line that belongs to this cover's story. On a
  // wide cover the microcopy and barcode flank it; on a narrow one the
  // tagline takes the whole strip so nothing collides.
  ctx.fillStyle = '#02060c';
  ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
  ctx.fillStyle = 'rgba(0,229,255,0.55)';
  ctx.fillRect(strip.x, strip.y, strip.w, Math.max(1, 2 * scale));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PAPER;
  const tagSize = Math.round(strip.h * 0.38);
  ctx.font = `700 ${tagSize}px Anton, 'Arial Black', sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, tagSize * 0.06)}px`; } catch { /* older canvas */ }
  ctx.fillText(state.tagline, W / 2, strip.y + strip.h * 0.54);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  if (landscape) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(234,246,255,0.55)';
    ctx.font = `400 ${Math.round(strip.h * 0.26)}px system-ui, sans-serif`;
    ctx.fillText('A VICE AT 3 AM PICTURE', W * 0.02, strip.y + strip.h * 0.54);
    ctx.textAlign = 'right';
    // Short, so it ends before the barcode and clear of the tagline.
    ctx.fillText('SHOT ON YOUR OWN CAMERA', W * 0.845, strip.y + strip.h * 0.54);
    drawBarcode(ctx, W * 0.86, strip.y + strip.h * 0.22, W * 0.09, strip.h * 0.56, 5);
  }
  ctx.restore();
}
