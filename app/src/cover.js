// VICE AT 3 AM — the cover painter.
//
// drawCover(ctx, state, W, H) paints one poster onto a 2d canvas context.
// Everything is drawn from the state object: five photo panels, a giant
// chrome title laid across the middle, a magenta script subtitle, a
// tagline ribbon, and the poster furniture (press quote, VOL. badge,
// COMING SOON, production credit, gold seal, barcode). The drawing is
// deterministic: no Math.random, no time, no network — the same state
// always paints the same pixels, so the exported PNGs are reproducible.

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const GRADES = {
  night: { label: 'Night', desat: 0, passes: [
    { op: 'multiply', color: 'rgb(150,180,255)', alpha: 0.55 },
    { op: 'source-over', color: 'rgba(10,40,90,0.16)', alpha: 1 },
    { op: 'screen', color: 'rgba(0,200,255,0.10)', alpha: 1 },
  ] },
  ember: { label: 'Ember', desat: 0, passes: [
    { op: 'multiply', color: 'rgb(255,205,160)', alpha: 0.6 },
    { op: 'source-over', color: 'rgba(120,40,0,0.12)', alpha: 1 },
    { op: 'screen', color: 'rgba(255,140,40,0.12)', alpha: 1 },
  ] },
  sunset: { label: 'Sunset', desat: 0, passes: [
    { op: 'multiply', color: 'rgb(255,190,170)', alpha: 0.6 },
    { op: 'source-over', color: 'rgba(140,30,70,0.14)', alpha: 1 },
    { op: 'screen', color: 'rgba(255,90,140,0.10)', alpha: 1 },
  ] },
  ink: { label: 'Ink', desat: 1, passes: [
    { op: 'multiply', color: 'rgb(200,200,210)', alpha: 0.7 },
    { op: 'source-over', color: 'rgba(0,0,0,0.10)', alpha: 1 },
  ] },
  duotone: { label: 'Duotone', desat: 1, passes: [
    { op: 'multiply', color: 'rgb(120,220,255)', alpha: 0.75 },
    { op: 'screen', color: 'rgba(255,60,180,0.22)', alpha: 1 },
  ] },
};

export const LAYOUTS = {
  tilted: { label: 'Tilted panels' },
  bleed: { label: 'Bleed hero' },
};

// A tiny deterministic hash: turns an index into a stable 0..1 value so
// rain streaks and the barcode look random but never change.
function hash01(n) {
  const x = (n * 2654435761) >>> 0;
  return ((x ^ (x >>> 13)) * 1274126177 >>> 0) / 4294967295;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Fit text into maxWidth: shrink the font, then truncate with an ellipsis.
function fitText(ctx, text, maxWidth, size, fontFamily, weight) {
  let s = size;
  ctx.font = `${weight || ''} ${s}px ${fontFamily}`.trim();
  let w = ctx.measureText(text).width;
  while (s > 8 && w > maxWidth) {
    s -= 1;
    ctx.font = `${weight || ''} ${s}px ${fontFamily}`.trim();
    w = ctx.measureText(text).width;
  }
  let out = text;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) {
    out = out.slice(0, -2);
    ctx.font = `${weight || ''} ${s}px ${fontFamily}`.trim();
  }
  if (out !== text) out = out.replace(/.$/, '…');
  return { text: out, size: s };
}

// Draw one photo into a panel rect, cover-fit, anchored `anchor` (0..1)
// from the top so faces survive wide-short panels. ox/oy nudge the
// crop (-1..1).
function drawPhoto(ctx, img, px, py, pw, ph, zoom, ox, oy, anchor) {
  if (!img || !img.naturalWidth) return;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(pw / iw, ph / ih) * (zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = px + (pw - dw) / 2 + (ox || 0) * pw * 0.25;
  const dy = py - Math.max(0, dh - ph) * (anchor ?? 0.33) + (oy || 0) * ph * 0.25;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPanel(ctx, panel, rect, tiltDeg, grade) {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((tiltDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  // Drop shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x + w * 0.012, y + h * 0.015, w, h);
  // Photo, clipped to the panel.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (panel.img) {
    drawPhoto(ctx, panel.img, x, y, w, h, panel.zoom, panel.ox, panel.oy, panel.anchor);
  } else {
    ctx.fillStyle = '#101828';
    ctx.fillRect(x, y, w, h);
  }
  // Grade tint on the photo itself, before the frame.
  applyGradePasses(ctx, x, y, w, h, grade);
  ctx.restore();
  // Frame.
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.strokeStyle = 'rgba(240,245,255,0.92)';
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
  // Role chip: dark pill at the panel's top, unrotated so it stays readable.
  drawChip(ctx, panel, x, y, w, h);
  // Quip: small caption at the panel's bottom.
  if (panel.chip && panel.chip.quip) {
    const qs = Math.max(11, h * 0.055);
    const fitted = fitText(ctx, `“${panel.chip.quip}”`, w * 0.9, qs, 'Georgia, serif', 'italic');
    ctx.font = `italic ${fitted.size}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const tw = ctx.measureText(fitted.text).width;
    roundRectPath(ctx, cx - tw / 2 - 8, y + h - fitted.size - 14, tw + 16, fitted.size + 10, 5);
    ctx.fill();
    ctx.fillStyle = '#f2f6ff';
    ctx.fillText(fitted.text, cx, y + h - fitted.size / 2 - 9);
  }
}

function drawChip(ctx, panel, x, y, w, h) {
  const role = (panel.role || '').toUpperCase();
  const chip = panel.chip || {};
  const sub = [chip.place, chip.time].filter(Boolean).join(' · ');
  const pad = Math.max(8, w * 0.03);
  const line1Size = Math.max(12, h * 0.075);
  const line2Size = Math.max(9, h * 0.05);
  const first = fitText(ctx, role, w * 0.92, line1Size, 'Anton, sans-serif');
  const second = sub ? fitText(ctx, sub.toUpperCase(), w * 0.92, line2Size, 'Arial, sans-serif', 'bold') : null;
  const textW = Math.max(
    ctx.measureText(first.text).width,
    second ? ctx.measureText(second.text).width : 0,
  );
  const bw = Math.min(w * 0.96, textW + pad * 2);
  const bh = first.size + (second ? second.size + 6 : 0) + pad * 1.1;
  const bx = x + (w - bw) / 2;
  const by = y + Math.max(6, h * 0.03);
  ctx.save();
  roundRectPath(ctx, bx, by, bw, bh, bh * 0.45);
  ctx.fillStyle = 'rgba(8,12,24,0.88)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${first.size}px Anton, sans-serif`;
  ctx.fillText(first.text, bx + bw / 2, by + pad * 0.55 + first.size / 2);
  if (second) {
    ctx.fillStyle = '#9fd8ff';
    ctx.font = `bold ${second.size}px Arial, sans-serif`;
    ctx.fillText(second.text, bx + bw / 2, by + pad * 0.55 + first.size + 4 + second.size / 2);
  }
  ctx.restore();
}

function applyGradePasses(ctx, x, y, w, h, grade) {
  if (!grade) return;
  if (grade.desat) {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  for (const p of grade.passes) {
    ctx.save();
    ctx.globalCompositeOperation = p.op;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

function drawBackground(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#070d1f');
  g.addColorStop(0.5, '#0a1734');
  g.addColorStop(1, '#04060e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Neon glows: cyan top-left, magenta bottom-right.
  let glow = ctx.createRadialGradient(W * 0.15, H * 0.08, 0, W * 0.15, H * 0.08, W * 0.55);
  glow.addColorStop(0, 'rgba(0,190,255,0.20)');
  glow.addColorStop(1, 'rgba(0,190,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  glow = ctx.createRadialGradient(W * 0.9, H * 0.95, 0, W * 0.9, H * 0.95, W * 0.5);
  glow.addColorStop(0, 'rgba(255,60,180,0.16)');
  glow.addColorStop(1, 'rgba(255,60,180,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // Rain streaks, deterministic.
  ctx.save();
  ctx.strokeStyle = 'rgba(180,220,255,0.10)';
  ctx.lineWidth = Math.max(1, W * 0.0008);
  for (let i = 0; i < 70; i++) {
    const x = hash01(i * 3 + 1) * W;
    const y = hash01(i * 7 + 2) * H;
    const len = H * (0.02 + hash01(i * 11 + 3) * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.12, y + len);
    ctx.stroke();
  }
  ctx.restore();
  // Vignette.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFurniture(ctx, state, W, H, stripY, stripH) {
  // Top strip: five gold stars + press quote, VOL. badge at the right.
  ctx.fillStyle = 'rgba(5,8,18,0.92)';
  ctx.fillRect(0, 0, W, stripH);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, stripH, W, 1);
  // VOL. badge geometry first: the stars + quote centre in the space
  // left of it, so the quote never slides under the badge.
  const badge = 'VOL. 03';
  const bs = Math.max(11, stripH * 0.36);
  ctx.font = `bold ${bs}px Arial, sans-serif`;
  const bw = ctx.measureText(badge).width + 18;
  const bx = W - bw - Math.max(10, W * 0.012);
  const qSize = Math.max(13, stripH * 0.42);
  const quote = `“${state.quote || ''}” — ${state.quoteSource || ''}`;
  const starR = stripH * 0.26;
  const starsW = 5 * starR * 2.4;
  const fitted = fitText(ctx, quote.toUpperCase(), Math.max(60, bx - starsW - 28), qSize, 'Georgia, serif', 'bold');
  const textW = ctx.measureText(fitted.text).width;
  const totalW = starsW + 12 + textW;
  const sx = (bx - 16 - totalW) / 2;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, sx + starR + i * starR * 2.4, stripH / 2, starR, '#f5c542');
  }
  const textX = sx + starsW + 12;
  ctx.fillStyle = '#e8edf5';
  ctx.font = `bold ${fitted.size}px Georgia, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitted.text, textX, stripH / 2 + 1);
  roundRectPath(ctx, bx, (stripH - bs - 12) / 2, bw, bs + 12, 4);
  ctx.fillStyle = '#f5c542';
  ctx.fill();
  ctx.fillStyle = '#1a1200';
  ctx.textAlign = 'center';
  ctx.fillText(badge, bx + bw / 2, stripH / 2 + 1);
  // Gold seal geometry now: the tagline must clear it.
  const bottomY0 = stripY + stripH + Math.max(8, H * 0.012);
  const bh0 = H - bottomY0 - Math.max(8, H * 0.012);
  const sealR = Math.min(stripH * 1.15, bh0 * 1.4);
  const sealCx = W - sealR - Math.max(14, W * 0.02) - 90;
  const sealCy = stripY + stripH / 2;
  // Tagline ribbon.
  ctx.fillStyle = 'rgba(5,8,18,0.94)';
  ctx.fillRect(0, stripY, W, stripH);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, stripY, W, 1);
  ctx.fillRect(0, stripY + stripH, W, 1);
  const tag = (state.tagline || '').toUpperCase();
  // The tagline is centred on the poster, so its half-width must fit
  // between the centre and the seal's left edge.
  const tagMax = Math.min(W * 0.9, 2 * (sealCx - sealR - 16 - W / 2));
  const tf = fitText(ctx, tag, Math.max(60, tagMax), Math.max(13, stripH * 0.44), 'Arial, sans-serif', 'bold');
  ctx.font = `bold ${tf.size}px Arial, sans-serif`;
  ctx.fillStyle = '#dfe9ff';
  ctx.textAlign = 'center';
  ctx.fillText(tf.text, W / 2, stripY + stripH / 2 + 1);
  // Bottom furniture row: COMING SOON left, credit centre, seal + barcode right.
  const bottomY = bottomY0;
  const bh = bh0;
  // COMING SOON box, capped by the poster's width as well as the row.
  const csSize = Math.max(12, Math.min(bh * 0.34, W * 0.021));
  ctx.font = `bold ${csSize}px Arial, sans-serif`;
  const csText = 'COMING SOON';
  const csW = ctx.measureText(csText).width + 20;
  const csX = Math.max(10, W * 0.012);
  roundRectPath(ctx, csX, bottomY + (bh - csSize - 12) / 2, csW, csSize + 12, 3);
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f5c542';
  ctx.textAlign = 'center';
  ctx.fillText(csText, csX + csW / 2, bottomY + bh / 2 + 1);
  // Barcode geometry first, so the credit centres in the free middle.
  const bcW = 84;
  const bcH = bh * 0.72;
  const bcX = W - bcW - Math.max(10, W * 0.012);
  const bcY = bottomY + (bh - bcH) / 2;
  // Production credit, centred between COMING SOON and the barcode.
  const crLeft = csX + csW + 16;
  const crRight = bcX - 16;
  const crSize = Math.max(10, Math.min(bh * 0.26, W * 0.016));
  const credit = 'A NIGHT SHIFT PICTURES PRODUCTION  ·  STARRING YOU';
  const cf = fitText(ctx, credit, Math.max(60, crRight - crLeft), crSize, 'Arial, sans-serif');
  ctx.font = `${cf.size}px Arial, sans-serif`;
  ctx.fillStyle = 'rgba(220,230,250,0.75)';
  ctx.fillText(cf.text, (crLeft + crRight) / 2, bottomY + bh / 2 + 1);
  // Gold seal: straddles the tagline ribbon, bottom-right.
  ctx.save();
  ctx.beginPath();
  ctx.arc(sealCx, sealCy, sealR, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0a02';
  ctx.fill();
  ctx.lineWidth = Math.max(2, sealR * 0.08);
  ctx.strokeStyle = '#d4af37';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sealCx, sealCy, sealR * 0.78, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#e8c85a';
  ctx.textAlign = 'center';
  const ss = sealR * 0.24;
  ctx.font = `bold ${ss}px Arial, sans-serif`;
  ctx.fillText('ORIGINAL', sealCx, sealCy - ss * 0.35);
  ctx.fillText('COVER ART', sealCx, sealCy + ss * 0.75);
  ctx.restore();
  // Barcode, bottom-right corner (geometry computed above).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bcX - 4, bcY - 4, bcW + 8, bcH + 8);
  let bx2 = bcX;
  ctx.fillStyle = '#111111';
  for (let i = 0; i < 28; i++) {
    const bw2 = 1 + Math.floor(hash01(i * 5 + 9) * 3);
    if (hash01(i * 13 + 4) > 0.45) ctx.fillRect(bx2, bcY, bw2, bcH);
    bx2 += bw2 + 1;
    if (bx2 > bcX + bcW) break;
  }
}

function drawTitle(ctx, state, W, H, cy) {
  const title = (state.title || '').toUpperCase();
  const base = Math.min(W * 0.115, H * 0.21);
  let size = base;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const measure = (s) => {
    ctx.font = `${s}px Anton, sans-serif`;
    return ctx.measureText(title).width;
  };
  while (size > 30 && measure(size) > W * 0.96) size -= 2;
  ctx.font = `${size}px Anton, sans-serif`;
  // Chrome fill: silver gradient, dark outline, cyan glow.
  const grad = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, '#c9d2db');
  grad.addColorStop(0.55, '#7c8894');
  grad.addColorStop(0.75, '#eef2f6');
  grad.addColorStop(1, '#96a2af');
  ctx.save();
  ctx.shadowColor = 'rgba(0,210,255,0.85)';
  ctx.shadowBlur = size * 0.16;
  ctx.lineWidth = Math.max(3, size * 0.045);
  ctx.strokeStyle = '#0a1020';
  ctx.lineJoin = 'round';
  ctx.strokeText(title, W / 2, cy);
  ctx.fillStyle = grad;
  ctx.fillText(title, W / 2, cy);
  ctx.restore();
  // Magenta script subtitle, tilted slightly.
  const sub = state.subtitle || '';
  const subSize = Math.max(18, W * 0.038);
  ctx.save();
  ctx.translate(W / 2, cy + size * 0.62);
  ctx.rotate(-0.03);
  ctx.font = `${subSize}px Yellowtail, cursive`;
  ctx.shadowColor = 'rgba(255,60,200,0.7)';
  ctx.shadowBlur = subSize * 0.35;
  ctx.fillStyle = '#ff4fd8';
  ctx.fillText(sub, 0, 0);
  ctx.restore();
  return { y: cy, size };
}

// Panel rects per aspect class and layout. All coordinates are fractions
// of W/H so one layout works at every export size.
function layoutPanels(layout, W, H) {
  const landscape = W > H * 1.2;
  const portrait = H > W * 1.2;
  if (layout === 'bleed') {
    // Full-bleed hero; four small panels in a row near the bottom.
    const rowY = 0.70;
    const rowH = 0.155;
    const gap = 0.015;
    const pw = (0.94 - gap * 3) / 4;
    const panels = [{ x: 0, y: 0, w: 1, h: 1, tilt: 0 }];
    for (let i = 0; i < 4; i++) {
      panels.push({ x: 0.03 + i * (pw + gap), y: rowY, w: pw, h: rowH, tilt: i % 2 === 0 ? -1.5 : 1.5 });
    }
    return { panels, titleY: 0.44, stripY: 0.875, heroBleed: true };
  }
  if (landscape) {
    return {
      panels: [
        { x: 0.30, y: 0.10, w: 0.40, h: 0.76, tilt: -1.2 }, // hero
        { x: 0.03, y: 0.08, w: 0.25, h: 0.36, tilt: -3 }, // insider
        { x: 0.72, y: 0.08, w: 0.25, h: 0.36, tilt: 2.5 }, // boss
        { x: 0.03, y: 0.50, w: 0.25, h: 0.36, tilt: 2 }, // rider
        { x: 0.72, y: 0.50, w: 0.25, h: 0.36, tilt: -2.5 }, // courier
      ],
      titleY: 0.47,
      stripY: 0.885,
      heroBleed: false,
    };
  }
  if (portrait) {
    return {
      panels: [
        { x: 0.05, y: 0.06, w: 0.90, h: 0.38, tilt: -1 }, // hero
        { x: 0.05, y: 0.46, w: 0.435, h: 0.155, tilt: -2 }, // insider
        { x: 0.515, y: 0.46, w: 0.435, h: 0.155, tilt: 2 }, // boss
        { x: 0.05, y: 0.63, w: 0.435, h: 0.155, tilt: 2 }, // rider
        { x: 0.515, y: 0.63, w: 0.435, h: 0.155, tilt: -2 }, // courier
      ],
      titleY: 0.27,
      stripY: 0.815,
      heroBleed: false,
    };
  }
  // Square.
  return {
    panels: [
      { x: 0.05, y: 0.06, w: 0.90, h: 0.38, tilt: -1 }, // hero
      { x: 0.05, y: 0.46, w: 0.435, h: 0.16, tilt: -2 }, // insider
      { x: 0.515, y: 0.46, w: 0.435, h: 0.16, tilt: 2 }, // boss
      { x: 0.05, y: 0.64, w: 0.435, h: 0.16, tilt: 2 }, // rider
      { x: 0.515, y: 0.64, w: 0.435, h: 0.16, tilt: -2 }, // courier
    ],
    titleY: 0.27,
    stripY: 0.83,
    heroBleed: false,
  };
}

export function drawCover(ctx, state, W, H) {
  const grade = GRADES[state.grade] || GRADES.night;
  const lay = layoutPanels(state.layout || 'tilted', W, H);
  const stripH = Math.max(26, H * 0.05);
  drawBackground(ctx, W, H);
  const rects = lay.panels.map((p) => ({
    x: p.x * W,
    y: p.y * H,
    w: p.w * W,
    h: p.h * H,
    tilt: p.tilt,
  }));
  if (lay.heroBleed) {
    // Hero photo fills the whole poster; a dark wash keeps text readable.
    const hero = state.panels[0];
    if (hero && hero.img) {
      drawPhoto(ctx, hero.img, 0, 0, W, H, hero.zoom, hero.ox, hero.oy, hero.anchor);
    }
    applyGradePasses(ctx, 0, 0, W, H, grade);
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(4,7,16,0.55)');
    wash.addColorStop(0.35, 'rgba(4,7,16,0.05)');
    wash.addColorStop(0.65, 'rgba(4,7,16,0.10)');
    wash.addColorStop(1, 'rgba(4,7,16,0.72)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    for (let i = 1; i < rects.length; i++) {
      drawPanel(ctx, state.panels[i], rects[i], rects[i].tilt, grade);
    }
  } else {
    for (let i = 0; i < rects.length; i++) {
      drawPanel(ctx, state.panels[i], rects[i], rects[i].tilt, grade);
    }
  }
  // The title overlaps the panels, across the middle.
  drawTitle(ctx, state, W, H, lay.titleY * H);
  // Furniture: top strip, tagline ribbon, bottom row.
  drawFurniture(ctx, state, W, H, lay.stripY * H, stripH);
  // Panel rects in canvas pixels, for hit-testing drags in the editor.
  return {
    panels: rects,
    titleY: lay.titleY * H,
    stripY: lay.stripY * H,
    stripH,
    heroBleed: lay.heroBleed,
  };
}
