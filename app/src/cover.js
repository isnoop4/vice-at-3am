// VICE AT 3 AM — the poster painter. Draws the multi-panel cover on any
// canvas at any size, from the editor state plus resolved photo images.
// Everything is drawn from numbers: no assets are fetched at draw time.
export const SIZES = {
  '1920x1080': [1920, 1080],
  '1080x1350': [1080, 1350],
  '1080x1080': [1080, 1080],
};

export const GRADES = {
  night: { label: 'Night', wash: 'rgba(12,42,96,0.16)', filter: 'saturate(1.12) brightness(1.02)' },
  ember: { label: 'Ember', wash: 'rgba(255,110,40,0.15)', filter: 'sepia(0.28) saturate(1.45) brightness(1.05)' },
  sunset: { label: 'Sunset', wash: 'rgba(255,120,60,0.18)', filter: 'sepia(0.38) saturate(1.6) hue-rotate(-12deg)' },
  ink: { label: 'Ink', wash: 'rgba(0,0,0,0.05)', filter: 'grayscale(1) contrast(1.22) brightness(1.04)' },
  duotone: { label: 'Duotone', wash: 'rgba(0,190,255,0.10)', filter: 'grayscale(1) contrast(1.15)' },
};

export const LAYOUTS = {
  tilted: { label: 'Tilted panels' },
  bleed: { label: 'Bleed hero' },
};

const GOLD = '#e8b64c';
const INK = '#0a1224';

// --- geometry ------------------------------------------------------------
// One layout function so the editor, the hit test and the painter agree.
export function computeLayout(W, H, layout) {
  const m = Math.round(W * 0.02); // outer margin
  const topH = Math.round(H * 0.058);
  const botH = Math.round(H * 0.055);
  const ribbonH = Math.round(H * 0.052);
  const area = { x: m, y: topH + Math.round(H * 0.012), w: W - 2 * m, h: H - topH - botH - ribbonH - Math.round(H * 0.05) };
  const panels = [];
  if (layout === 'bleed') {
    const rowH = Math.round(H * 0.24);
    const rowY = H - botH - ribbonH - rowH - Math.round(H * 0.01);
    const gap = Math.round(W * 0.012);
    const pw = Math.round((area.w - 3 * gap) / 4);
    const roles = ['THE INSIDER', 'THE BOSS', 'THE RIDER', 'THE COURIER'];
    panels.push({ x: 0, y: 0, w: W, h: H, tilt: 0, hero: true });
    roles.forEach((role, i) => {
      panels.push({ x: area.x + i * (pw + gap), y: rowY, w: pw, h: rowH, tilt: i % 2 === 0 ? 1.5 : -1.5, role });
    });
    return {
      topStrip: { x: 0, y: 0, w: W, h: topH },
      bottomStrip: { x: 0, y: H - botH, w: W, h: botH },
      ribbon: { x: m, y: H - botH - ribbonH - Math.round(H * 0.008), w: W - 2 * m, h: ribbonH },
      panels,
      titleY: Math.round(H * 0.40),
      titleSize: Math.round(W * 0.115),
      subSize: Math.round(W * 0.032),
      hero: true,
    };
  }
  // Tilted panels: hero centre, two stacked panels on each side.
  const gap = Math.round(W * 0.012);
  const portrait = H >= W;
  let hero, side;
  if (portrait) {
    const heroH = Math.round(area.h * 0.56);
    hero = { x: area.x, y: area.y, w: area.w, h: heroH };
    const gridY = area.y + heroH + gap;
    const gridH = area.y + area.h - gridY;
    const pw = Math.round((area.w - gap) / 2);
    const ph = Math.round((gridH - gap) / 2);
    side = [
      { x: area.x, y: gridY, w: pw, h: ph },
      { x: area.x + pw + gap, y: gridY, w: pw, h: ph },
      { x: area.x, y: gridY + ph + gap, w: pw, h: ph },
      { x: area.x + pw + gap, y: gridY + ph + gap, w: pw, h: ph },
    ];
  } else {
    const heroW = Math.round(area.w * 0.34);
    const sideW = Math.round((area.w - heroW - 2 * gap) / 2);
    const halfH = Math.round((area.h - gap) / 2);
    hero = { x: area.x + sideW + gap, y: area.y, w: heroW, h: area.h };
    side = [
      { x: area.x, y: area.y, w: sideW, h: halfH },
      { x: area.x, y: area.y + halfH + gap, w: sideW, h: halfH },
      { x: area.x + sideW + gap + heroW + gap, y: area.y, w: sideW, h: halfH },
      { x: area.x + sideW + gap + heroW + gap, y: area.y + halfH + gap, w: sideW, h: halfH },
    ];
  }
  const roles = ['THE INSIDER', 'THE BOSS', 'THE RIDER', 'THE COURIER'];
  const tilts = [2.2, -1.8, -2.4, 1.9];
  // Role chips sit at the top of top-row panels and at the bottom of
  // bottom-row panels, so the overlapping chrome title never covers one.
  // Landscape side order is [top-left, bottom-left, top-right,
  // bottom-right]; portrait grid order is [top-left, top-right,
  // bottom-left, bottom-right].
  const chipPos = portrait
    ? ['top', 'top', 'bottom', 'bottom']
    : ['top', 'bottom', 'top', 'bottom'];
  panels.push({ ...hero, tilt: -0.8, hero: true, chipPos: 'top' });
  side.forEach((r, i) => panels.push({ ...r, tilt: tilts[i], role: roles[i], chipPos: chipPos[i] }));
  return {
    topStrip: { x: 0, y: 0, w: W, h: topH },
    bottomStrip: { x: 0, y: H - botH, w: W, h: botH },
    ribbon: { x: m, y: area.y + area.h + Math.round(H * 0.012), w: W - 2 * m, h: ribbonH },
    panels,
    titleY: portrait ? Math.round(area.y + area.h * 0.32) : Math.round(H * 0.56),
    titleSize: Math.round(W * (portrait ? 0.125 : 0.10)),
    subSize: Math.round(W * 0.034),
    hero: false,
  };
}

// --- small drawing helpers ----------------------------------------------
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFont(ctx, text, maxW, px, family, weight = '') {
  let size = px;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, w, h, zoom, ox, oy, anchorY) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  // anchorY: fraction of the image height that sits at the panel centre.
  const cy = dh * anchorY + oy * h * 0.2;
  const cx = dw / 2 + ox * w * 0.2;
  ctx.drawImage(img, x + w / 2 - cx, y + h / 2 - cy, dw, dh);
}

function chromeText(ctx, text, cx, y, maxW, size) {
  const s = fitFont(ctx, text, maxW, size, 'Anton, sans-serif');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, y - s * 0.55, 0, y + s * 0.55);
  g.addColorStop(0, '#f8fbff');
  g.addColorStop(0.32, '#c9d6e8');
  g.addColorStop(0.5, '#7e93b0');
  g.addColorStop(0.56, '#eef3fa');
  g.addColorStop(0.78, '#9fb2cc');
  g.addColorStop(1, '#e8eef7');
  ctx.font = `${s}px Anton, sans-serif`;
  ctx.shadowColor = 'rgba(0,220,255,0.85)';
  ctx.shadowBlur = s * 0.08;
  ctx.lineWidth = Math.max(3, s * 0.055);
  ctx.strokeStyle = '#0a1224';
  ctx.strokeText(text, cx, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = g;
  ctx.fillText(text, cx, y);
  ctx.restore();
  return s;
}

function pill(ctx, x, y, text, size, fg = '#f4f7ff', bg = 'rgba(8,14,30,0.82)') {
  ctx.font = `bold ${size}px Anton, sans-serif`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.9;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size * 0.55, y + h / 2 + 1);
  return w;
}

function drawBarcode(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#f4f7ff';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = '#0a1224';
  let bx = x;
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  while (bx < x + w) {
    const bw = 2 + Math.floor(rnd() * 7);
    if (rnd() > 0.42) ctx.fillRect(bx, y, bw, h);
    bx += bw + 2;
  }
  ctx.restore();
}

function drawSeal(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.55, GOLD);
  g.addColorStop(1, '#a87c1e');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.strokeStyle = '#7a5a10';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#3a2a00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const s = Math.max(8, Math.round(r * 0.24));
  ctx.font = `bold ${s}px Anton, sans-serif`;
  ctx.fillText('ORIGINAL', cx, cy - s * 0.62);
  ctx.fillText('COVER ART', cx, cy + s * 0.62);
  star(ctx, cx, cy, r * 0.2);
  ctx.fillStyle = '#3a2a00';
  ctx.fill();
  ctx.restore();
}

// --- the painter ----------------------------------------------------------
export function drawCover(ctx, state, resolved, W, H) {
  const grade = GRADES[state.grade] || GRADES.night;
  const L = computeLayout(W, H, state.layout);
  const u = W / 1920; // unit scale

  // Night backdrop: deep navy gradient, faint rain, vignette.
  const bg = ctx.createLinearGradient(0, 0, W * 0.25, H);
  bg.addColorStop(0, '#060b1a');
  bg.addColorStop(0.55, '#0a1a38');
  bg.addColorStop(1, '#05080f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = 'rgba(140,200,255,0.07)';
  ctx.lineWidth = Math.max(1, 1.4 * u);
  for (let i = 0; i < 46; i++) {
    const x = ((i * 173) % 100) / 100 * W;
    const y = ((i * 97) % 100) / 100 * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 14 * u, y + 44 * u);
    ctx.stroke();
  }
  ctx.restore();

  // Panels.
  ctx.save();
  resolved.forEach((p, i) => {
    const r = L.panels[i];
    if (!r) return;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate((r.tilt * Math.PI) / 180);
    ctx.translate(-r.w / 2, -r.h / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18 * u;
    ctx.shadowOffsetY = 6 * u;
    ctx.fillStyle = '#0a1224';
    ctx.fillRect(0, 0, r.w, r.h);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.rect(0, 0, r.w, r.h);
    ctx.clip();
    if (p.img) {
      ctx.filter = grade.filter;
      drawImageCover(ctx, p.img, 0, 0, r.w, r.h, p.zoom || 1, p.ox || 0, p.oy || 0, p.anchor ?? 0.33);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#16233d';
      ctx.fillRect(0, 0, r.w, r.h);
    }
    // Grade wash per panel, so the grade tints the photos, not the chrome.
    ctx.fillStyle = grade.wash;
    ctx.fillRect(0, 0, r.w, r.h);
    // Caption strip, bottom of the panel: place + time, then the quip.
    // In the bleed layout the hero is the whole canvas, so its strip is
    // sized to the panel row and parked just above it instead of at the
    // very bottom, where it would cross the tagline ribbon and bottom strip.
    let capH = Math.round(r.h * 0.2);
    let capY = r.h - capH;
    if (state.layout === 'bleed' && r.hero && L.panels[1]) {
      capH = Math.round(L.panels[1].h * 0.2);
      capY = L.panels[1].y - capH;
    }
    // Role chip: top of top-row panels, just above the caption strip of
    // bottom-row panels, so the title never covers it.
    const chipSize = Math.max(13, Math.round(r.h * 0.075));
    const label = (p.role || '').toUpperCase();
    if (label) {
      const chipY = r.chipPos === 'bottom'
        ? r.h - capH - Math.round(chipSize * 1.9) - Math.round(r.h * 0.03)
        : Math.round(r.h * 0.045);
      pill(ctx, Math.round(r.w * 0.04), chipY, label, chipSize);
    }
    ctx.fillStyle = 'rgba(6,10,22,0.78)';
    ctx.fillRect(0, capY, r.w, capH);
    const pad = Math.round(r.w * 0.045);
    const line1 = `${(p.chip?.place || '').toUpperCase()}${p.chip?.time ? '  ·  ' + p.chip.time.toUpperCase() : ''}`;
    const fs1 = fitFont(ctx, line1, r.w - 2 * pad, Math.max(12, Math.round(capH * 0.32)), 'Anton, sans-serif');
    ctx.fillStyle = '#eaf2ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(line1, pad, capY + capH * 0.32);
    if (p.chip?.quip) {
      const fs2 = fitFont(ctx, p.chip.quip, r.w - 2 * pad, Math.max(11, Math.round(capH * 0.28)), 'Yellowtail, cursive');
      ctx.fillStyle = '#ffd7f2';
      ctx.fillText(p.chip.quip, pad, capY + capH * 0.74);
      void fs2;
    }
    void fs1;
    ctx.restore();
    // Thin frame around the tilted panel.
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate((r.tilt * Math.PI) / 180);
    ctx.strokeStyle = 'rgba(230,240,255,0.55)';
    ctx.lineWidth = Math.max(1.5, 2.5 * u);
    ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
    ctx.restore();
  });
  ctx.restore();

  // Top strip: five gold stars + press quote, VOL. badge clear of it.
  const ts = L.topStrip;
  ctx.fillStyle = 'rgba(5,9,20,0.92)';
  ctx.fillRect(ts.x, ts.y, ts.w, ts.h);
  ctx.fillStyle = INK;
  const starR = ts.h * 0.26;
  const starY = ts.h / 2;
  let sx = Math.round(W * 0.02);
  for (let i = 0; i < 5; i++) {
    star(ctx, sx + starR, starY, starR);
    ctx.fillStyle = GOLD;
    ctx.fill();
    sx += starR * 2.4;
  }
  const badgeW = Math.round(W * 0.085);
  const quoteMax = W - sx - starR - badgeW - Math.round(W * 0.04);
  const quote = `“${state.quote}” — ${state.quoteSource}`;
  const qSize = fitFont(ctx, quote, quoteMax, Math.max(14, Math.round(ts.h * 0.42)), 'Anton, sans-serif');
  ctx.fillStyle = '#f4f7ff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(quote, sx + starR * 1.2, starY);
  void qSize;
  pill(ctx, W - badgeW - Math.round(W * 0.015), Math.round(ts.h * 0.16), 'VOL. 03', Math.max(13, Math.round(ts.h * 0.34)), '#0a1224', GOLD);

  // The giant chrome title, overlapping the panels.
  const title = (state.title || 'VICE AT 3 AM').toUpperCase();
  chromeText(ctx, title, W / 2, L.titleY, W * 0.94, L.titleSize);
  const subSize = fitFont(ctx, state.subtitle || '', W * 0.7, L.subSize, 'Yellowtail, cursive');
  ctx.fillStyle = '#ff5fd0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,95,208,0.7)';
  ctx.shadowBlur = 12 * u;
  ctx.fillText(state.subtitle || '', W / 2, L.titleY + L.titleSize * 0.48 + subSize * 0.5);
  ctx.shadowBlur = 0;
  void subSize;

  // Tagline ribbon.
  const rb = L.ribbon;
  ctx.fillStyle = 'rgba(5,9,20,0.94)';
  rr(ctx, rb.x, rb.y, rb.w, rb.h, Math.min(10, rb.h / 2));
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,182,76,0.7)';
  ctx.lineWidth = Math.max(1.5, 2 * u);
  ctx.stroke();
  const tgSize = fitFont(ctx, state.tagline || '', rb.w * 0.82, Math.max(14, Math.round(rb.h * 0.44)), 'Anton, sans-serif');
  ctx.fillStyle = '#f4f7ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.tagline || '', rb.x + rb.w / 2, rb.y + rb.h / 2 + 1);
  void tgSize;

  // Gold seal straddling the ribbon's right end, clear of the tagline text.
  const sealR = Math.round(rb.h * 0.95);
  drawSeal(ctx, rb.x + rb.w - sealR * 0.4, rb.y + rb.h / 2, sealR);

  // Bottom strip: COMING SOON, production credit, barcode.
  const bs = L.bottomStrip;
  ctx.fillStyle = 'rgba(5,9,20,0.92)';
  ctx.fillRect(bs.x, bs.y, bs.w, bs.h);
  const bSize = Math.max(13, Math.round(bs.h * 0.4));
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${bSize}px Anton, sans-serif`;
  ctx.fillText('COMING SOON', Math.round(W * 0.02), bs.y + bs.h / 2);
  const credit = 'A NIGHT SHIFT PICTURES PRODUCTION  ·  STARRING YOU';
  const cSize = fitFont(ctx, credit, W * 0.52, Math.max(12, Math.round(bs.h * 0.36)), 'Anton, sans-serif');
  ctx.fillStyle = '#c8d4ea';
  ctx.textAlign = 'center';
  ctx.fillText(credit, W / 2, bs.y + bs.h / 2);
  void cSize;
  drawBarcode(ctx, W - Math.round(W * 0.085), bs.y + bs.h * 0.22, Math.round(W * 0.055), bs.h * 0.56);
}
