// VICE AT 3 AM — the cover renderer: draws the whole poster on a canvas.
// Own art only: no Rockstar logo, artwork or font. Title in Anton (OFL),
// subtitle in Yellowtail (OFL), both vendored under app/fonts/.
//
// V2 — the cast cover: five character panels (a hero driver in the middle,
// four cast members around), the giant chrome title OVERLAPPING the middle
// of the panels, a 5-star press-quote band on top, a tagline ribbon under
// the subtitle, and a bottom strip with COMING SOON, a production credit,
// a gold ORIGINAL COVER ART seal and a barcode. The night world stays
// cold blue, warmed by pink and orange neon in the photos and a warm glow
// over the panels.
//
// drawCover(ctx, state, W, H) draws at any size: 1920x1080, 1080x1350,
// 1080x1080. The same function draws the live preview and the export.

export const SIZES = {
  '1920x1080': [1920, 1080],
  '1080x1350': [1080, 1350],
  '1080x1080': [1080, 1080],
};

// One-click colour grades: a canvas filter for the photos plus a tint
// overlay drawn over each panel. Night is the house grade; Ember is the
// warm-neon grade (pink/orange neon, still a night cover).
export const GRADES = {
  night: {
    label: 'Night',
    filter: 'saturate(1.15) contrast(1.06) brightness(0.98)',
    tint: ['rgba(8,30,60,0.10)', 'rgba(2,10,26,0.30)'],
    tintMode: 'source-over',
  },
  ember: {
    label: 'Ember',
    filter: 'saturate(1.4) contrast(1.06) hue-rotate(-22deg)',
    tint: ['rgba(255,110,40,0.16)', 'rgba(200,30,110,0.28)'],
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

// Wide (landscape) art gets the cast grid and the overlapping title; a
// square is NOT landscape.
export function isLandscape(W, H) {
  return W > H * 1.15;
}

export const LAYOUTS = {
  grid: { label: 'Cast Grid' },
  bleed: { label: 'Full Bleed' },
};

// Deterministic pseudo-random: the same cover always draws the same rain
// and glows, so the preview and the export match exactly.
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
const GOLD = '#ffd23e';
const PAPER = '#eaf6ff';

// Photos are framed on their faces: portraits keep their subject near
// the upper third, so a wide-short panel crops the body, never the face.
export const PHOTO_ANCHOR_Y = 0.33;

// Geometry: quote band, panel rectangles, title block and tagline strip
// for a layout and a canvas size. Panel 0 is the hero (THE DRIVER);
// 1..4 are the cast: INSIDER, BOSS, RIDER, COURIER. chipTop marks the
// panels whose role chip sits at the top edge, clear of the overlapping
// title; the rest carry it at the bottom.
export function panelRects(layout, W, H) {
  const quoteH = Math.round(H * (isLandscape(W, H) ? 0.055 : 0.05));
  const stripH = Math.round(H * (isLandscape(W, H) ? 0.075 : 0.06));
  const quoteBand = { x: 0, y: 0, w: W, h: quoteH };
  const strip = { x: 0, y: H - stripH, w: W, h: stripH };
  const panelsH = H - quoteH - stripH;
  const panelsY = quoteH;
  const gap = Math.max(6, Math.round(W * 0.006));
  if (layout === 'bleed') {
    // Hero full-bleed; the four cast panels ride as a film strip across
    // it; the title sits above the strip, the ribbon below it.
    const filmH = Math.round(H * (isLandscape(W, H) ? 0.19 : 0.15));
    const filmY = Math.round(H * (isLandscape(W, H) ? 0.56 : 0.52));
    const fw = (W - gap * 5) / 4;
    const titleSize = Math.round(W * (isLandscape(W, H) ? 0.105 : 0.12));
    return {
      panels: [
        { x: 0, y: 0, w: W, h: H, hero: true, chipTop: false },
        { x: gap, y: filmY, w: fw, h: filmH, chipTop: false },
        { x: gap * 2 + fw, y: filmY, w: fw, h: filmH, chipTop: false },
        { x: gap * 3 + fw * 2, y: filmY, w: fw, h: filmH, chipTop: false },
        { x: gap * 4 + fw * 3, y: filmY, w: fw, h: filmH, chipTop: false },
      ],
      filmStrip: { x: 0, y: filmY, w: W, h: filmH },
      title: {
        cx: W / 2,
        baseline: filmY - Math.round(H * 0.055),
        size: titleSize,
        maxW: W * 0.94,
        subtitleY: filmY - Math.round(H * 0.012),
        ribbonY: filmY + filmH + Math.round(H * 0.018),
        ribbonH: Math.round(H * 0.042),
      },
      quoteBand, strip, panelsH,
    };
  }
  if (isLandscape(W, H)) {
    // Landscape cast grid: hero in the middle, tall; two cast members
    // stacked on each side. The title overlaps the middle of the grid.
    const heroW = Math.round(W * 0.50);
    const sideW = (W - heroW - gap * 2) / 2;
    const rowH = (panelsH - gap) / 2;
    const colL = 0;
    const colC = sideW + gap;
    const colR = colC + heroW + gap;
    const rowT = panelsY;
    const rowB = panelsY + rowH + gap;
    const titleSize = Math.round(W * 0.118);
    const baseline = panelsY + Math.round(panelsH * 0.56);
    return {
      panels: [
        { x: colC, y: panelsY, w: heroW, h: panelsH, hero: true, chipTop: false },
        { x: colL, y: rowT, w: sideW, h: rowH, chipTop: true },
        { x: colR, y: rowT, w: sideW, h: rowH, chipTop: true },
        { x: colL, y: rowB, w: sideW, h: rowH, chipTop: false },
        { x: colR, y: rowB, w: sideW, h: rowH, chipTop: false },
      ],
      title: {
        cx: W / 2,
        baseline,
        size: titleSize,
        maxW: W * 0.94,
        subtitleY: baseline + Math.round(titleSize * 0.62),
        ribbonY: baseline + Math.round(titleSize * 1.02),
        ribbonH: Math.round(H * 0.045),
      },
      quoteBand, strip, panelsH,
    };
  }
  // Portrait / square cast grid: hero on top, the four cast members in
  // a 2x2 grid beneath. The title overlaps the hero/grid boundary.
  const heroH = Math.round(panelsH * 0.56);
  const gridY = panelsY + heroH + gap;
  const gridH = panelsH - heroH - gap;
  const cw = (W - gap) / 2;
  const rh = (gridH - gap) / 2;
  const boundary = panelsY + heroH;
  const titleSize = Math.round(W * 0.13);
  // The title block rides on the hero, clear of the cast grid below:
  // its ribbon ends at the hero's foot, so no grid chip ever meets it.
  const baseline = boundary - Math.round(titleSize * 1.35);
  return {
    panels: [
      { x: 0, y: panelsY, w: W, h: heroH, hero: true, chipTop: true },
      { x: 0, y: gridY, w: cw, h: rh, chipTop: true },
      { x: cw + gap, y: gridY, w: cw, h: rh, chipTop: true },
      { x: 0, y: gridY + rh + gap, w: cw, h: rh, chipTop: false },
      { x: cw + gap, y: gridY + rh + gap, w: cw, h: rh, chipTop: false },
    ],
    title: {
      cx: W / 2,
      baseline,
      size: titleSize,
      maxW: W * 0.94,
      subtitleY: baseline + Math.round(titleSize * 0.60),
      ribbonY: baseline + Math.round(titleSize * 1.0),
      ribbonH: Math.round(H * 0.04),
    },
    quoteBand, strip, panelsH,
  };
}

// Draws one photo to cover a rectangle, with the panel's zoom and offset.
// The crop is anchored at PHOTO_ANCHOR_Y of the spare height, so a tall
// portrait in a wide panel keeps the face, not the middle of the body.
function drawPhotoCover(ctx, img, rect, zoom, ox, oy) {
  if (!img || !img.naturalWidth) return;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - pw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - ph) * PHOTO_ANCHOR_Y + oy * rect.h;
  ctx.drawImage(img, dx, dy, pw, ph);
}

// A cast role chip: the character's role on top, place + time + quip
// beneath. It sits at the bottom of its panel, or at the top when the
// overlapping title would cover the bottom (top-row panels). The fonts
// shrink — and the second line truncates with an ellipsis — until the
// chip fits inside the panel and, for the last panel, clear of the gold
// seal (maxRight).
function drawChip(ctx, rect, chip, scale, top = false, maxRight = null) {
  const pad = 10 * scale;
  const barW = 5 * scale;
  const line1 = (chip.role || chip.place || '').toUpperCase();
  let line2 = `${chip.place.toUpperCase()} · ${chip.time} — ${chip.quip.toUpperCase()}`;
  let fontRole = Math.max(14, Math.round(20 * scale));
  let fontSub = Math.max(10, Math.round(13 * scale));
  const measure = () => {
    ctx.font = `700 ${fontRole}px Anton, 'Arial Black', sans-serif`;
    const w1 = ctx.measureText(line1).width;
    ctx.font = `400 ${fontSub}px system-ui, sans-serif`;
    const w2 = ctx.measureText(line2).width;
    return Math.max(w1, w2) + pad * 2 + barW;
  };
  const x = rect.x + 10 * scale;
  let maxW = rect.w - 16 * scale;
  if (maxRight != null) maxW = Math.min(maxW, maxRight - x);
  let w = measure();
  if (w > maxW) {
    const f = Math.max(0.6, maxW / w);
    fontRole = Math.max(10, Math.round(fontRole * f));
    fontSub = Math.max(8, Math.round(fontSub * f));
    w = measure();
  }
  while (w > maxW && line2.length > 6) {
    line2 = `${line2.slice(0, -2).replace(/…$/, '')}…`;
    w = measure();
  }
  const h = fontRole + fontSub + pad * 2.1;
  const y = top ? rect.y + 10 * scale : rect.y + rect.h - h - 10 * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(3,12,24,0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = CYAN;
  ctx.fillRect(x, y, barW, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${fontRole}px Anton, 'Arial Black', sans-serif`;
  ctx.fillText(line1, x + barW + pad, y + pad + fontRole * 0.9);
  ctx.fillStyle = CYAN;
  ctx.font = `400 ${fontSub}px system-ui, sans-serif`;
  ctx.fillText(line2, x + barW + pad, y + pad + fontRole + fontSub * 1.05);
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

// Warm neon bleed over the panels: soft orange and pink glows at fixed
// seeded spots, so the cold-blue night reads warmer without going sunset.
function drawWarmGlow(ctx, area, seed) {
  const rnd = seededRandom(seed);
  ctx.save();
  const spots = [
    { c: '255,122,26', a: 0.16, r: 0.30 }, // orange headlight glow
    { c: '255,79,216', a: 0.12, r: 0.24 }, // pink neon glow
    { c: '255,170,60', a: 0.10, r: 0.20 }, // warm sign glow
  ];
  for (const s of spots) {
    const cx = area.x + area.w * (0.15 + rnd() * 0.7);
    const cy = area.y + area.h * (0.2 + rnd() * 0.6);
    const rad = Math.max(area.w, area.h) * s.r;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${s.c},${s.a})`);
    g.addColorStop(1, `rgba(${s.c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(area.x, area.y, area.w, area.h);
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

// The gold ORIGINAL COVER ART seal: a serrated rosette with the words
// stacked inside. Drawn straddling the bottom strip's top edge.
function drawGoldSeal(ctx, cx, cy, r) {
  ctx.save();
  // Serrated edge: 24 teeth.
  ctx.beginPath();
  for (let i = 0; i < 48; i++) {
    const ang = (i / 48) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.88;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffe27a');
  g.addColorStop(0.6, '#f5c518');
  g.addColorStop(1, '#c9920e');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1.5, r * 0.03);
  ctx.strokeStyle = 'rgba(58,42,0,0.75)';
  ctx.stroke();
  ctx.fillStyle = '#3a2a00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(r * 0.24)}px Anton, 'Arial Black', sans-serif`;
  ctx.fillText('ORIGINAL', cx, cy - r * 0.26);
  ctx.fillText('COVER ART', cx, cy + r * 0.02);
  ctx.font = `${Math.round(r * 0.20)}px system-ui, sans-serif`;
  ctx.fillText('★★★', cx, cy + r * 0.34);
  ctx.restore();
}

// The whole cover. state: { title, subtitle, tagline, quote,
// quoteSource, grade, layout, panels: [{ photo, zoom, ox, oy,
// chip: { role, place, time, quip } }] }.
// photo is an <img> (or null). Draws at the canvas's own size.
export function drawCover(ctx, state, W, H) {
  const grade = GRADES[state.grade] ?? GRADES.night;
  const { panels, quoteBand, strip, title, panelsH } = panelRects(state.layout, W, H);
  const scale = W / 1920;
  const landscape = isLandscape(W, H);
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  // Top press-quote band: five gold stars, the quote, its source, and
  // the VOL. badge on the right.
  ctx.fillStyle = NAVY_BAND;
  ctx.fillRect(quoteBand.x, quoteBand.y, quoteBand.w, quoteBand.h);
  ctx.save();
  ctx.textBaseline = 'middle';
  const qSize = Math.round(quoteBand.h * 0.52);
  ctx.fillStyle = GOLD;
  ctx.font = `${qSize}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  const stars = '★★★★★';
  const starsX = W * 0.02;
  ctx.fillText(stars, starsX, quoteBand.y + quoteBand.h * 0.54);
  const starsW = ctx.measureText(stars).width;
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${Math.round(quoteBand.h * 0.46)}px Anton, 'Arial Black', sans-serif`;
  const quote = `"${(state.quote || 'RAIN-SOAKED NEON MAYHEM').toUpperCase()}"`;
  ctx.fillText(quote, starsX + starsW + W * 0.012, quoteBand.y + quoteBand.h * 0.54);
  const quoteW = ctx.measureText(quote).width;
  ctx.fillStyle = 'rgba(234,246,255,0.55)';
  ctx.font = `400 ${Math.round(quoteBand.h * 0.34)}px system-ui, sans-serif`;
  ctx.fillText(`— ${state.quoteSource || 'THE NIGHT GAZETTE'}`, starsX + starsW + W * 0.012 + quoteW + W * 0.01, quoteBand.y + quoteBand.h * 0.54);
  // VOL. badge, gold on the right.
  const volH = Math.round(quoteBand.h * 0.62);
  const volW = Math.round(volH * 2.1);
  const volX = W - volW - W * 0.015;
  const volY = quoteBand.y + (quoteBand.h - volH) / 2;
  ctx.beginPath();
  ctx.roundRect(volX, volY, volW, volH, volH * 0.18);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = '#3a2a00';
  ctx.font = `700 ${Math.round(volH * 0.52)}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('VOL. 03', volX + volW / 2, quoteBand.y + quoteBand.h * 0.54);
  ctx.restore();

  // Panels: photo, grade filter, tint, white border, role chip.
  // The gold seal's left edge (computed here, drawn last) bounds the
  // last panel's chip, so no caption ever runs under the seal.
  const sealR = Math.round(strip.h * (landscape ? 0.95 : 0.85));
  const sealCx = W - sealR * 1.15;
  const drawPanel = (i) => {
    const rect = panels[i];
    const panel = state.panels[i];
    if (!panel) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
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
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    if (state.layout === 'bleed' && i === 0) return; // hero carries no chip
    const maxRight = i === state.panels.length - 1 ? sealCx - sealR - 10 * scale : null;
    drawChip(ctx, rect, panel.chip, Math.max(0.55, scale * (landscape ? 1 : 1.15)), rect.chipTop, maxRight);
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
    drawPanel(4);
  } else {
    panels.forEach((_, i) => drawPanel(i));
  }

  // Warm neon bleed, then rain, over the panels.
  drawWarmGlow(ctx, { x: 0, y: quoteBand.h, w: W, h: panelsH }, 43);
  drawRain(ctx, { x: 0, y: quoteBand.h, w: W, h: panelsH }, 31);

  // Title block: a soft dark scrim so the chrome reads over any face,
  // then the giant overlapping title, the neon script, and the ribbon.
  const titleTop = title.baseline - title.size * 1.05;
  const titleBottom = title.ribbonY + title.ribbonH;
  const scrim = ctx.createLinearGradient(0, titleTop, 0, titleBottom);
  scrim.addColorStop(0, 'rgba(3,10,20,0)');
  scrim.addColorStop(0.22, 'rgba(3,10,20,0.52)');
  scrim.addColorStop(0.78, 'rgba(3,10,20,0.52)');
  scrim.addColorStop(1, 'rgba(3,10,20,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, titleTop, W, titleBottom - titleTop);

  drawChromeTitle(ctx, state.title, title.cx, title.baseline, title.size, title.maxW);
  ctx.save();
  ctx.translate(title.cx, title.subtitleY);
  ctx.rotate(-0.025);
  ctx.font = `${Math.round(title.size * 0.26)}px Yellowtail, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = MAGENTA;
  ctx.shadowBlur = Math.round(title.size * 0.16);
  ctx.fillStyle = MAGENTA;
  ctx.fillText(state.subtitle, 0, 0);
  ctx.restore();

  // Tagline ribbon: black bar with pink chevrons at both ends.
  ctx.save();
  const tagSize = Math.round(title.ribbonH * 0.52);
  ctx.font = `700 ${tagSize}px Anton, 'Arial Black', sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, tagSize * 0.08)}px`; } catch { /* older canvas */ }
  const tagW = ctx.measureText(state.tagline).width;
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  const ribPad = Math.round(title.ribbonH * 0.9);
  const ribW = Math.min(tagW + ribPad * 2 + title.ribbonH * 1.4, W * 0.92);
  const ribX = (W - ribW) / 2;
  const ribY = title.ribbonY;
  const ribH = title.ribbonH;
  ctx.fillStyle = 'rgba(2,6,12,0.94)';
  ctx.fillRect(ribX, ribY, ribW, ribH);
  ctx.fillStyle = MAGENTA;
  ctx.fillRect(ribX, ribY, ribW, Math.max(2, ribH * 0.07));
  ctx.fillRect(ribX, ribY + ribH - Math.max(2, ribH * 0.07), ribW, Math.max(2, ribH * 0.07));
  // Chevrons pointing outward at both ends.
  ctx.beginPath();
  ctx.moveTo(ribX + ribH * 0.28, ribY + ribH * 0.22);
  ctx.lineTo(ribX + ribH * 0.55, ribY + ribH / 2);
  ctx.lineTo(ribX + ribH * 0.28, ribY + ribH * 0.78);
  ctx.lineTo(ribX + ribH * 0.44, ribY + ribH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ribX + ribW - ribH * 0.28, ribY + ribH * 0.22);
  ctx.lineTo(ribX + ribW - ribH * 0.55, ribY + ribH / 2);
  ctx.lineTo(ribX + ribW - ribH * 0.28, ribY + ribH * 0.78);
  ctx.lineTo(ribX + ribW - ribH * 0.44, ribY + ribH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${Math.max(1, tagSize * 0.08)}px`; } catch { /* older canvas */ }
  ctx.fillText(state.tagline, W / 2, ribY + ribH * 0.54);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  ctx.restore();

  // Bottom strip: COMING SOON on the left, the production credit in the
  // middle, the gold seal and barcode on the right.
  ctx.fillStyle = '#02060c';
  ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
  ctx.fillStyle = 'rgba(0,229,255,0.55)';
  ctx.fillRect(strip.x, strip.y, strip.w, Math.max(1, 2 * scale));
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = MAGENTA;
  ctx.font = `700 ${Math.round(strip.h * 0.42)}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('COMING SOON', W * 0.02, strip.y + strip.h * 0.54);
  const creditSize = Math.round(strip.h * (landscape ? 0.24 : 0.28));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(234,246,255,0.85)';
  ctx.font = `700 ${creditSize}px Anton, 'Arial Black', sans-serif`;
  if (landscape) {
    ctx.fillText('A VICE AT 3 AM PICTURE  ·  STARRING YOU', W / 2, strip.y + strip.h * 0.34);
    ctx.fillStyle = 'rgba(234,246,255,0.55)';
    ctx.font = `400 ${creditSize}px system-ui, sans-serif`;
    ctx.fillText('SHOT ON YOUR OWN CAMERA  ·  GRADED BY HAND', W / 2, strip.y + strip.h * 0.70);
  } else {
    ctx.fillText('A VICE AT 3 AM PICTURE · STARRING YOU', W / 2, strip.y + strip.h * 0.54);
  }
  ctx.restore();
  // Gold seal straddling the strip's top edge, barcode beside it.
  const sealCy = strip.y;
  if (landscape) {
    drawBarcode(ctx, sealCx - sealR - Math.round(W * 0.075) - Math.round(W * 0.012), strip.y + strip.h * 0.24, Math.round(W * 0.075), strip.h * 0.52, 5);
  }
  drawGoldSeal(ctx, sealCx, sealCy, sealR);
}
