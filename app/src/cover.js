// VICE AT 3 AM — the poster painter: draws the whole multi-panel GTA-style
// cover onto any canvas, at any of the three export sizes, in either layout.
// Pure drawing: no DOM, no network, deterministic for a given state.

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const GRADES = {
  night: {
    label: 'Night',
    bgTop: '#0b1a2e', bgBottom: '#050a14',
    strip: '#0a1220', ribbon: '#101c30',
    accent: '#22d3ee', accent2: '#f472b6',
    overlay: 'rgba(8, 32, 64, 0.16)', overlayMode: 'source-over',
    chipBg: 'rgba(5, 10, 20, 0.82)', chipText: '#e2f3ff',
  },
  ember: {
    label: 'Ember',
    bgTop: '#241208', bgBottom: '#120705',
    strip: '#1d0f06', ribbon: '#2a1608',
    accent: '#fb923c', accent2: '#f472b6',
    overlay: 'rgba(255, 110, 30, 0.13)', overlayMode: 'source-over',
    chipBg: 'rgba(20, 8, 4, 0.82)', chipText: '#ffe9d6',
  },
  sunset: {
    label: 'Sunset',
    bgTop: '#3b1550', bgBottom: '#160a24',
    strip: '#241033', ribbon: '#33184a',
    accent: '#fb7185', accent2: '#fbbf24',
    overlay: 'rgba(255, 90, 60, 0.14)', overlayMode: 'source-over',
    chipBg: 'rgba(24, 8, 30, 0.82)', chipText: '#ffe4ec',
  },
  ink: {
    label: 'Ink',
    bgTop: '#141414', bgBottom: '#000000',
    strip: '#0d0d0d', ribbon: '#1c1c1c',
    accent: '#e5e5e5', accent2: '#a3a3a3',
    overlay: 'rgba(0, 0, 0, 0.28)', overlayMode: 'source-over',
    chipBg: 'rgba(0, 0, 0, 0.82)', chipText: '#f5f5f5',
  },
  duotone: {
    label: 'Duotone',
    bgTop: '#0a1030', bgBottom: '#160a2e',
    strip: '#0b0e26', ribbon: '#171238',
    accent: '#22d3ee', accent2: '#e879f9',
    overlay: 'rgba(190, 0, 120, 0.12)', overlayMode: 'source-over',
    chipBg: 'rgba(8, 6, 26, 0.82)', chipText: '#e6fbff',
  },
};

export const LAYOUTS = {
  tilted: { label: 'Tilted panels' },
  bleed: { label: 'Bleed hero' },
};

// Panel geometry for a given canvas size and layout. Order is fixed:
// 0 hero, 1 insider, 2 boss, 3 rider, 4 courier. Each rect carries its
// tilt in degrees and the anchor fraction used when cropping its photo.
export function panelRects(W, H, layout) {
  const landscape = W >= H;
  if (layout === 'bleed') {
    const heroH = Math.round(H * 0.62);
    const rowY = heroH + Math.round(H * 0.02);
    const rowH = H - rowY - Math.round(H * 0.13);
    const gap = Math.round(W * 0.015);
    const pw = Math.round((W - gap * 6) / 4);
    const rects = [{ x: 0, y: 0, w: W, h: heroH, tilt: 0, anchor: 0.42 }];
    for (let i = 0; i < 4; i++) {
      rects.push({
        x: gap + i * (pw + gap), y: rowY, w: pw, h: rowH, tilt: 0, anchor: 0.3,
      });
    }
    return rects;
  }
  if (landscape) {
    const hero = { x: 0.365 * W, y: 0.115 * H, w: 0.27 * W, h: 0.71 * H, tilt: 0, anchor: 0.42 };
    return [
      hero,
      { x: 0.04 * W, y: 0.115 * H, w: 0.30 * W, h: 0.27 * H, tilt: -2.5, anchor: 0.35 },
      { x: 0.66 * W, y: 0.115 * H, w: 0.30 * W, h: 0.27 * H, tilt: 2.5, anchor: 0.35 },
      { x: 0.04 * W, y: 0.565 * H, w: 0.30 * W, h: 0.26 * H, tilt: 2, anchor: 0.25 },
      { x: 0.66 * W, y: 0.565 * H, w: 0.30 * W, h: 0.26 * H, tilt: -2, anchor: 0.3 },
    ];
  }
  // Portrait / square: hero on top, 2x2 grid below.
  const heroH = H * 0.34;
  const gridTop = H * 0.075 + heroH + H * 0.045;
  const gridH = H * 0.20;
  const gridGap = H * 0.018;
  const pw = (W - W * 0.16 - W * 0.02) / 2;
  return [
    { x: W * 0.08, y: H * 0.075, w: W * 0.84, h: heroH, tilt: 0, anchor: 0.42 },
    { x: W * 0.08, y: gridTop, w: pw, h: gridH, tilt: -2, anchor: 0.3 },
    { x: W * 0.08 + pw + W * 0.02, y: gridTop, w: pw, h: gridH, tilt: 2, anchor: 0.3 },
    { x: W * 0.08, y: gridTop + gridH + gridGap, w: pw, h: gridH, tilt: 2, anchor: 0.25 },
    { x: W * 0.08 + pw + W * 0.02, y: gridTop + gridH + gridGap, w: pw, h: gridH, tilt: -2, anchor: 0.3 },
  ];
}

// A tiny deterministic pseudo-random stream, so rain streaks and grain
// look the same on every export of the same cover.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitFont(ctx, text, maxWidth, startPx, family, weight) {
  let px = startPx;
  while (px > 12) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 2;
  }
  return px;
}

function drawPhotoCover(ctx, img, rect, panel) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const anchor = panel.anchor ?? 0.33;
  // anchor: which vertical fraction of the photo the panel's centre shows.
  const baseY = rect.y + rect.h / 2 - dh * anchor;
  const baseX = rect.x + rect.w / 2 - dw / 2;
  const ox = (panel.ox || 0) * rect.w;
  const oy = (panel.oy || 0) * rect.h;
  ctx.drawImage(img, baseX + ox, baseY + oy, dw, dh);
}

function drawChip(ctx, x, y, text, grade, px, maxW) {
  ctx.font = `700 ${px}px Anton, sans-serif`;
  let w = ctx.measureText(text).width + px * 1.1;
  if (w > maxW) w = maxW;
  const h = px * 1.7;
  ctx.save();
  ctx.fillStyle = grade.chipBg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = grade.chipText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const shown = text.length > 24 ? text.slice(0, 22) + '…' : text;
  ctx.fillText(shown, x + px * 0.55, y + h / 2 + 1, w - px * 0.8);
  ctx.restore();
  return { w, h };
}

function drawStars(ctx, x, y, size, count) {
  ctx.save();
  ctx.fillStyle = '#fbbf24';
  for (let i = 0; i < count; i++) {
    const cx = x + i * size * 1.35;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? size / 2 : size / 5;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const px = cx + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSeal(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#fef3c7');
  g.addColorStop(0.55, '#f59e0b');
  g.addColorStop(1, '#92400e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#451a03';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${r * 0.34}px Anton, sans-serif`;
  ctx.fillText('ORIGINAL', cx, cy - r * 0.22);
  ctx.fillText('COVER ART', cx, cy + r * 0.18);
  ctx.font = `${r * 0.3}px Anton, sans-serif`;
  ctx.fillText('★', cx, cy + r * 0.55);
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x, y, w, h);
  const rnd = seeded(7);
  let bx = x + w * 0.06;
  ctx.fillStyle = '#0f172a';
  while (bx < x + w * 0.94) {
    const bw = 2 + rnd() * (w * 0.03);
    if (rnd() > 0.45) ctx.fillRect(bx, y + h * 0.08, bw, h * 0.62);
    bx += bw + 2 + rnd() * 3;
  }
  ctx.fillStyle = '#0f172a';
  ctx.font = `${Math.max(9, h * 0.16)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8 90210 03317', x + w / 2, y + h * 0.86);
  ctx.restore();
}

function drawRain(ctx, W, H, grade) {
  const rnd = seeded(20261120);
  ctx.save();
  ctx.strokeStyle = 'rgba(180, 220, 255, 0.10)';
  ctx.lineWidth = Math.max(1, W / 1400);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const len = H * (0.02 + rnd() * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.12, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCover(ctx, state, W, H) {
  const grade = GRADES[state.grade] || GRADES.night;
  const landscape = W >= H;
  const u = W / 1920; // scale unit, tuned for 1920-wide landscape
  const su = landscape ? u : W / 1080;

  // --- backdrop ---
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, grade.bgTop);
  bg.addColorStop(1, grade.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  drawRain(ctx, W, H, grade);

  const rects = panelRects(W, H, state.layout);
  const panels = state.panels || [];

  // --- top strip: stars + press quote + VOL badge ---
  const stripH = Math.round(H * 0.058);
  ctx.fillStyle = grade.strip;
  ctx.fillRect(0, 0, W, stripH);
  const starSize = stripH * 0.42;
  drawStars(ctx, W * 0.035, stripH / 2, starSize, 5);
  const quoteX = W * 0.035 + starSize * 1.35 * 5 + W * 0.015;
  const badgeW = W * 0.085;
  const quoteMax = W - badgeW - quoteX - W * 0.02;
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const qpx = fitFont(ctx, `"${state.quote}" — ${state.quoteSource}`, quoteMax, stripH * 0.42, 'Anton, sans-serif', 400);
  ctx.font = `400 ${qpx}px Anton, sans-serif`;
  ctx.fillText(`"${state.quote}" — ${state.quoteSource}`, quoteX, stripH / 2 + 1, quoteMax);
  ctx.fillStyle = grade.accent;
  roundRect(ctx, W - badgeW - W * 0.015, stripH * 0.18, badgeW, stripH * 0.64, 4);
  ctx.fill();
  ctx.fillStyle = '#04121f';
  ctx.textAlign = 'center';
  const bpx = fitFont(ctx, 'VOL. 03', badgeW * 0.85, stripH * 0.4, 'Anton, sans-serif', 700);
  ctx.font = `700 ${bpx}px Anton, sans-serif`;
  ctx.fillText('VOL. 03', W - badgeW / 2 - W * 0.015, stripH / 2 + 1);

  // --- panels ---
  panels.forEach((panel, i) => {
    const r = rects[i];
    if (!r) return;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(((r.tilt || 0) * Math.PI) / 180);
    ctx.translate(-r.w / 2, -r.h / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = r.w * 0.04;
    ctx.shadowOffsetY = r.w * 0.015;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, r.w, r.h);
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, r.w, r.h);
    ctx.clip();
    const img = panel.image;
    if (img) {
      drawPhotoCover(ctx, img, { x: 0, y: 0, w: r.w, h: r.h }, { ...panel, anchor: r.anchor });
      ctx.fillStyle = grade.overlay;
      ctx.fillRect(0, 0, r.w, r.h);
    } else {
      const g2 = ctx.createLinearGradient(0, 0, r.w, r.h);
      g2.addColorStop(0, grade.bgTop);
      g2.addColorStop(1, grade.bgBottom);
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, r.w, r.h);
    }
    // inner neon edge
    ctx.strokeStyle = grade.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1.5, r.w * 0.006);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, r.w - ctx.lineWidth, r.h - ctx.lineWidth);
    ctx.globalAlpha = 1;
    ctx.restore();
    // role chip at the panel top
    const chipPx = Math.max(13, Math.min(r.w * 0.075, r.h * 0.085));
    drawChip(ctx, r.w * 0.045, r.h * 0.05, panel.role || '', grade, chipPx, r.w * 0.91);
    // caption line at the panel bottom
    const cap = [panel.chip?.place, panel.chip?.time].filter(Boolean).join(' · ');
    const quip = panel.chip?.quip || '';
    ctx.fillStyle = 'rgba(4, 8, 16, 0.78)';
    const capH = r.h * 0.13;
    ctx.fillRect(0, r.h - capH, r.w, capH);
    ctx.fillStyle = '#f1f5f9';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const cpx = fitFont(ctx, cap, r.w * 0.92, capH * 0.42, 'Anton, sans-serif', 400);
    ctx.font = `400 ${cpx}px Anton, sans-serif`;
    if (cap) ctx.fillText(cap, r.w * 0.045, r.h - capH * 0.62, r.w * 0.92);
    if (quip) {
      ctx.fillStyle = grade.accent2;
      const q2px = fitFont(ctx, quip, r.w * 0.92, capH * 0.34, 'Yellowtail, cursive', 400);
      ctx.font = `400 ${q2px}px Yellowtail, cursive`;
      ctx.fillText(quip, r.w * 0.045, r.h - capH * 0.22, r.w * 0.92);
    }
    ctx.restore();
  });

  // --- chrome title across the middle, overlapping the panels ---
  const titleY = state.layout === 'bleed' ? H * 0.42 : (landscape ? H * 0.48 : H * 0.28);
  const titlePx = fitFont(ctx, state.title, W * 0.94, (landscape ? W * 0.08 : W * 0.10), 'Anton, sans-serif', 400);
  const grad = ctx.createLinearGradient(0, titleY - titlePx * 0.55, 0, titleY + titlePx * 0.55);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, '#dbe7f3');
  grad.addColorStop(0.55, '#7d8ea3');
  grad.addColorStop(0.75, '#eef4fa');
  grad.addColorStop(1, '#93a5b8');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${titlePx}px Anton, sans-serif`;
  ctx.shadowColor = 'rgba(34, 211, 238, 0.75)';
  ctx.shadowBlur = titlePx * 0.22;
  ctx.lineWidth = Math.max(2, titlePx * 0.045);
  ctx.strokeStyle = '#0b1526';
  ctx.strokeText(state.title, W / 2, titleY, W * 0.94);
  ctx.fillStyle = grad;
  ctx.fillText(state.title, W / 2, titleY, W * 0.94);
  ctx.restore();

  // --- script subtitle beneath the title ---
  const subY = titleY + titlePx * 0.62;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = grade.accent2;
  ctx.shadowColor = 'rgba(244, 114, 182, 0.6)';
  ctx.shadowBlur = titlePx * 0.1;
  const spx = fitFont(ctx, state.subtitle, W * 0.7, titlePx * 0.34, 'Yellowtail, cursive', 400);
  ctx.font = `400 ${spx}px Yellowtail, cursive`;
  ctx.fillText(state.subtitle, W / 2, subY);
  ctx.restore();

  // --- tagline ribbon ---
  const ribbonH = Math.round(H * 0.045);
  const ribbonY = H - Math.round(H * 0.115);
  ctx.fillStyle = grade.ribbon;
  ctx.fillRect(0, ribbonY, W, ribbonH);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, ribbonY, W, Math.max(2, ribbonH * 0.07));
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const sealR = ribbonH * 1.05;
  const ribbonTextMax = W - sealR * 2.6 - W * 0.04;
  const tpx = fitFont(ctx, state.tagline, ribbonTextMax, ribbonH * 0.5, 'Anton, sans-serif', 400);
  ctx.font = `400 ${tpx}px Anton, sans-serif`;
  ctx.fillText(state.tagline, W * 0.03, ribbonY + ribbonH / 2 + 1, ribbonTextMax);
  // gold seal straddling the ribbon's right end
  drawSeal(ctx, W - sealR * 1.6, ribbonY + ribbonH / 2, sealR);

  // --- bottom strip: COMING SOON / production credit / barcode ---
  const botY = H - Math.round(H * 0.055);
  const botH = Math.round(H * 0.055);
  ctx.fillStyle = grade.strip;
  ctx.fillRect(0, botY, W, botH);
  ctx.fillStyle = grade.accent2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const cpx = fitFont(ctx, 'COMING SOON', W * 0.2, botH * 0.42, 'Anton, sans-serif', 700);
  ctx.font = `700 ${cpx}px Anton, sans-serif`;
  ctx.fillText('COMING SOON', W * 0.03, botY + botH / 2 + 1);
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'center';
  const ppx = fitFont(ctx, 'A NIGHT SHIFT PICTURES PRODUCTION · STARRING YOU', W * 0.44, botH * 0.34, 'Anton, sans-serif', 400);
  ctx.font = `400 ${ppx}px Anton, sans-serif`;
  ctx.fillText('A NIGHT SHIFT PICTURES PRODUCTION · STARRING YOU', W * 0.5, botY + botH / 2 + 1);
  const bw = W * 0.075;
  drawBarcode(ctx, W - bw - W * 0.02, botY + botH * 0.12, bw, botH * 0.76);
}
