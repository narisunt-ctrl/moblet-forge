/* Moblet Forge — art.js
 * Procedural drawing for tiles and Moblets. No image assets: everything is
 * drawn on canvas from a palette, so creators can restyle freely.
 * Copyright (c) 2026 Narisan Nakakes. MIT License.
 */
(function (g) {
  'use strict';
  const MF = (g.MF = g.MF || {});

  const BODY = { drop: 'หยดน้ำ', pebble: 'ก้อนกรวด', lantern: 'โคมไฟ', bell: 'ระฆัง' };
  const EYES = { round: 'ตากลม', sleepy: 'ตาง่วง', visor: 'แว่นยาว', cyclops: 'ตาเดียว' };
  const CREST = { none: 'ไม่มี', leaf: 'ใบไม้', antenna: 'หนวดไฟ', flame: 'เปลวไฟ', horns: 'เขาเล็ก' };
  const PATTERN = { none: 'เรียบ', belly: 'พุงขาว', spots: 'จุด', stripes: 'ลายขวาง' };

  function defaultMoblet() {
    return { name: 'ปุ๊กปิ๊ก', body: 'drop', hue: 168, eyes: 'round', crest: 'leaf', pattern: 'belly' };
  }
  function randomMoblet(rand) {
    rand = rand || Math.random;
    const pick = (o) => { const k = Object.keys(o); return k[(rand() * k.length) | 0]; };
    const syl = ['ปุ๊ก', 'ปิ๊ก', 'ตุ้ม', 'มะ', 'ลิ', 'โบ', 'ฟู', 'นิล', 'จุ๋ม', 'ป๋อง', 'แตง', 'หมอก'];
    const name = syl[(rand() * syl.length) | 0] + syl[(rand() * syl.length) | 0];
    return { name, body: pick(BODY), hue: (rand() * 360) | 0, eyes: pick(EYES), crest: pick(CREST), pattern: pick(PATTERN) };
  }

  const hsl = (h, s, l, a) => `hsla(${h},${s}%,${l}%,${a == null ? 1 : a})`;

  function bodyPath(ctx, shape, r) {
    ctx.beginPath();
    switch (shape) {
      case 'pebble':
        ctx.ellipse(0, 0.1 * r, 1.05 * r, 0.85 * r, 0, 0, Math.PI * 2);
        break;
      case 'lantern': {
        const w = 0.85 * r, h = 0.95 * r, k = 0.35 * r;
        ctx.moveTo(-w + k, -h);
        ctx.lineTo(w - k, -h);
        ctx.quadraticCurveTo(w, -h, w, -h + k);
        ctx.lineTo(w, h - k);
        ctx.quadraticCurveTo(w, h, w - k, h);
        ctx.lineTo(-w + k, h);
        ctx.quadraticCurveTo(-w, h, -w, h - k);
        ctx.lineTo(-w, -h + k);
        ctx.quadraticCurveTo(-w, -h, -w + k, -h);
        break;
      }
      case 'bell':
        ctx.moveTo(0, -r);
        ctx.bezierCurveTo(0.7 * r, -r, 0.75 * r, 0.2 * r, 1.05 * r, 0.85 * r);
        ctx.quadraticCurveTo(0, 1.05 * r, -1.05 * r, 0.85 * r);
        ctx.bezierCurveTo(-0.75 * r, 0.2 * r, -0.7 * r, -r, 0, -r);
        break;
      default: // drop
        ctx.moveTo(0, -1.15 * r);
        ctx.bezierCurveTo(0.55 * r, -0.55 * r, 0.95 * r, -0.1 * r, 0.95 * r, 0.3 * r);
        ctx.arc(0, 0.3 * r, 0.95 * r, 0, Math.PI);
        ctx.bezierCurveTo(-0.95 * r, -0.1 * r, -0.55 * r, -0.55 * r, 0, -1.15 * r);
    }
    ctx.closePath();
  }

  // Draw a Moblet centred at (cx, cy). s = cell size. t = seconds.
  function drawMoblet(ctx, cx, cy, s, spec, t, opt) {
    opt = opt || {};
    const r = s * 0.34;
    const bob = Math.sin(t * 4 + (opt.phase || 0)) * s * 0.025;
    const face = opt.facing == null ? 1 : opt.facing; // 0 up 1 right 2 down 3 left
    const lookX = face === 1 ? 0.12 : face === 3 ? -0.12 : 0;
    const lookY = face === 0 ? -0.1 : face === 2 ? 0.08 : 0;
    const h = spec.hue;
    const main = hsl(h, 62, 56), dark = hsl(h, 55, 30), light = hsl(h, 70, 82);
    ctx.save();
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 1.0, r * 0.8, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(cx, cy + bob - r * 0.05);
    const sq = opt.squash || 0;
    ctx.scale(1 + sq * 0.15, 1 - sq * 0.15);

    // feet
    ctx.fillStyle = dark;
    for (const fx of [-0.42, 0.42]) {
      ctx.beginPath();
      ctx.ellipse(fx * r, 0.92 * r, 0.22 * r, 0.13 * r, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // crest (behind body top)
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.lineCap = 'round';
    const topY = spec.body === 'pebble' ? -0.72 * r : spec.body === 'drop' ? -1.05 * r : -0.95 * r;
    if (spec.crest === 'leaf') {
      ctx.fillStyle = hsl((h + 110) % 360, 55, 45);
      ctx.save();
      ctx.translate(0.05 * r, topY);
      ctx.rotate(0.5 + Math.sin(t * 3) * 0.12);
      ctx.beginPath();
      ctx.ellipse(0.22 * r, -0.1 * r, 0.3 * r, 0.13 * r, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (spec.crest === 'antenna') {
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.moveTo(0, topY + 0.1 * r);
      ctx.quadraticCurveTo(0.25 * r, topY - 0.3 * r, 0.1 * r, topY - 0.55 * r);
      ctx.stroke();
      ctx.fillStyle = hsl(48, 95, 60, 0.75 + 0.25 * Math.sin(t * 6));
      ctx.beginPath();
      ctx.arc(0.1 * r, topY - 0.6 * r, 0.14 * r, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.crest === 'flame') {
      const f = 1 + Math.sin(t * 9) * 0.1;
      ctx.fillStyle = hsl(28, 95, 55);
      ctx.beginPath();
      ctx.moveTo(-0.2 * r, topY + 0.1 * r);
      ctx.quadraticCurveTo(-0.25 * r, topY - 0.3 * r * f, 0, topY - 0.6 * r * f);
      ctx.quadraticCurveTo(0.3 * r, topY - 0.25 * r * f, 0.2 * r, topY + 0.1 * r);
      ctx.fill();
      ctx.fillStyle = hsl(50, 100, 70);
      ctx.beginPath();
      ctx.ellipse(0, topY - 0.12 * r, 0.08 * r, 0.18 * r * f, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.crest === 'horns') {
      ctx.fillStyle = light;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 0.3 * r, topY + 0.3 * r);
        ctx.quadraticCurveTo(sx * 0.55 * r, topY - 0.1 * r, sx * 0.5 * r, topY - 0.3 * r);
        ctx.quadraticCurveTo(sx * 0.35 * r, topY + 0.05 * r, sx * 0.12 * r, topY + 0.35 * r);
        ctx.fill();
      }
    }

    // body
    bodyPath(ctx, spec.body, r);
    const grad = ctx.createRadialGradient(-0.35 * r, -0.4 * r, 0.1 * r, 0, 0, 1.3 * r);
    grad.addColorStop(0, light);
    grad.addColorStop(0.45, main);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (spec.pattern === 'belly') {
      ctx.fillStyle = hsl(h, 60, 92, 0.85);
      ctx.beginPath();
      ctx.ellipse(0, 0.6 * r, 0.55 * r, 0.42 * r, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.pattern === 'spots') {
      ctx.fillStyle = hsl(h, 50, 28, 0.45);
      for (const [px, py, pr] of [[-0.55, 0.15, 0.13], [0.6, 0.35, 0.1], [-0.2, 0.7, 0.09], [0.35, -0.45, 0.08]]) {
        ctx.beginPath();
        ctx.arc(px * r, py * r, pr * r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (spec.pattern === 'stripes') {
      ctx.fillStyle = hsl(h, 50, 30, 0.35);
      for (const y of [0.25, 0.6]) ctx.fillRect(-1.2 * r, y * r, 2.4 * r, 0.14 * r);
    }
    ctx.restore();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, r * 0.06);
    bodyPath(ctx, spec.body, r);
    ctx.stroke();

    // eyes
    const blink = (t * 1.3 + (opt.phase || 0)) % 4 > 3.88;
    const ex = lookX * r, ey = (lookY - 0.05) * r;
    ctx.fillStyle = '#16201f';
    ctx.strokeStyle = '#16201f';
    if (spec.eyes === 'visor') {
      ctx.fillStyle = hsl((h + 180) % 360, 70, 25);
      ctx.beginPath();
      ctx.roundRect(-0.6 * r + ex, -0.2 * r + ey, 1.2 * r, 0.3 * r, 0.15 * r);
      ctx.fill();
      ctx.fillStyle = hsl((h + 180) % 360, 90, 75);
      ctx.fillRect(-0.4 * r + ex + Math.sin(t * 2) * 0.2 * r, -0.12 * r + ey, 0.18 * r, 0.1 * r);
    } else if (spec.eyes === 'cyclops') {
      ctx.fillStyle = '#fbfbf5';
      ctx.beginPath();
      ctx.arc(ex, ey, 0.32 * r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16201f';
      ctx.beginPath();
      ctx.arc(ex * 1.6, ey, blink ? 0.03 * r : 0.16 * r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (const sx of [-0.3, 0.3]) {
        const x = sx * r + ex;
        if (spec.eyes === 'sleepy' || blink) {
          ctx.lineWidth = Math.max(1, r * 0.08);
          ctx.beginPath();
          ctx.arc(x, ey - 0.02 * r, 0.12 * r, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(x, ey, 0.1 * r, 0.14 * r, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x + 0.03 * r, ey - 0.05 * r, 0.035 * r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#16201f';
        }
      }
    }
    // cheeks
    ctx.fillStyle = 'rgba(255,120,120,0.35)';
    for (const sx of [-0.55, 0.55]) {
      ctx.beginPath();
      ctx.ellipse(sx * r + ex * 0.5, 0.22 * r + ey, 0.12 * r, 0.07 * r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Tiles --------------------------------------------------------------
  function drawTile(ctx, c, px, py, s, t, P, seed) {
    const cx = px + s / 2, cy = py + s / 2;
    // floor (everything sits on floor)
    ctx.fillStyle = (seed & 1) ? P.floorA : P.floorB;
    ctx.fillRect(px, py, s, s);
    switch (c) {
      case '#': {
        ctx.fillStyle = P.wall;
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = P.wallHi;
        const bh = s / 3;
        for (let row = 0; row < 3; row++) {
          const off = row % 2 ? s / 4 : 0;
          for (let bx = -s / 4 + off; bx < s; bx += s / 2) {
            const x0 = Math.max(px, px + bx + 1.5), x1 = Math.min(px + s, px + bx + s / 2 - 1.5);
            if (x1 > x0) ctx.fillRect(x0, py + row * bh + 1.5, x1 - x0, bh - 3);
          }
        }
        break;
      }
      case 'B': {
        const glow = 0.5 + 0.5 * Math.sin(t * 2.5);
        const rg = ctx.createRadialGradient(cx, cy, 1, cx, cy, s * 0.6);
        rg.addColorStop(0, `rgba(255,210,90,${0.45 + glow * 0.25})`);
        rg.addColorStop(1, 'rgba(255,210,90,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = P.ink;
        ctx.fillRect(cx - s * 0.03, py + s * 0.1, s * 0.06, s * 0.12);
        ctx.fillStyle = P.beacon;
        ctx.beginPath();
        ctx.roundRect(cx - s * 0.17, py + s * 0.22, s * 0.34, s * 0.5, s * 0.08);
        ctx.fill();
        ctx.fillStyle = `rgba(255,245,200,${0.6 + glow * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, s * 0.07, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = P.ink;
        ctx.fillRect(cx - s * 0.2, py + s * 0.72, s * 0.4, s * 0.06);
        break;
      }
      case 'e': {
        const f = 1 + Math.sin(t * 8 + seed) * 0.12;
        ctx.fillStyle = P.emberDark;
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.2, s * 0.18, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = P.ember;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.15, cy + s * 0.18);
        ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.05 * f, cx, cy - s * 0.28 * f);
        ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.05 * f, cx + s * 0.15, cy + s * 0.18);
        ctx.fill();
        ctx.fillStyle = '#ffe9a6';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.06, s * 0.05, s * 0.1 * f, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'x': {
        ctx.fillStyle = P.thorn;
        for (const [ox, oy, k] of [[-0.2, 0.1, 1], [0.15, -0.12, 0.8], [0.2, 0.2, 0.9], [-0.12, -0.2, 0.7]]) {
          const bx = cx + ox * s, by = cy + oy * s, rr = s * 0.13 * k;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            ctx.lineTo(bx + Math.cos(a) * rr * 1.7, by + Math.sin(a) * rr * 1.7);
            ctx.lineTo(bx + Math.cos(a + 0.52) * rr * 0.6, by + Math.sin(a + 0.52) * rr * 0.6);
          }
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'k': {
        const by = cy + Math.sin(t * 3 + seed) * s * 0.04;
        ctx.strokeStyle = P.key;
        ctx.lineWidth = s * 0.08;
        ctx.beginPath();
        ctx.arc(cx - s * 0.12, by, s * 0.12, 0, Math.PI * 2);
        ctx.moveTo(cx, by);
        ctx.lineTo(cx + s * 0.25, by);
        ctx.moveTo(cx + s * 0.18, by);
        ctx.lineTo(cx + s * 0.18, by + s * 0.1);
        ctx.stroke();
        break;
      }
      case 'G': {
        ctx.fillStyle = P.gateBg;
        ctx.fillRect(px + s * 0.08, py + s * 0.08, s * 0.84, s * 0.84);
        ctx.fillStyle = P.key;
        for (let i = 0; i < 4; i++) ctx.fillRect(px + s * (0.16 + i * 0.2), py + s * 0.1, s * 0.06, s * 0.8);
        ctx.fillRect(px + s * 0.1, py + s * 0.45, s * 0.8, s * 0.06);
        break;
      }
      case 'w': {
        ctx.strokeStyle = P.wind;
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const y = py + s * (0.28 + i * 0.22);
          const ph = ((t * 0.8 + i * 0.33 + seed * 0.1) % 1) * s * 0.3;
          ctx.beginPath();
          ctx.moveTo(px + s * 0.12 + ph * 0.3, y);
          ctx.bezierCurveTo(px + s * 0.4, y - s * 0.08, px + s * 0.55, y + s * 0.08, px + s * 0.85, y);
          ctx.stroke();
        }
        break;
      }
      case 'S': {
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.setLineDash([s * 0.08, s * 0.07]);
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
    }
  }

  MF.BODY = BODY;
  MF.EYES = EYES;
  MF.CREST = CREST;
  MF.PATTERN = PATTERN;
  MF.defaultMoblet = defaultMoblet;
  MF.randomMoblet = randomMoblet;
  MF.drawMoblet = drawMoblet;
  MF.drawTile = drawTile;
})(typeof window !== 'undefined' ? window : globalThis);
