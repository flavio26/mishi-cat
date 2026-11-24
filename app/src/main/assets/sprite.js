/* Mishi pixel-art cat: procedural side-view sprite drawn pixel by pixel. No images needed. */
(() => {
  'use strict';
  const W = 64, H = 48, GROUND = 44;
  // palette indices
  const E = 0, OUT = 1, FUR = 2, DARK = 3, LIGHT = 4, EYE = 5, PINK = 6, SHINE = 7, PUPIL = 8, FAR = 9, SOCK = 10;
  const TAU = Math.PI * 2;

  function buffer() { return new Uint8Array(W * H); }
  function make(buf) {
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
    const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? buf[y * W + x] : E;
    function ellipse(cx, cy, rx, ry, c, only) {
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (only == null || only.includes(get(x, y)))) set(x, y, c);
      }
    }
    function line(x0, y0, x1, y1, w, c, only) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let i = 0; i <= n; i++) { const t = i / n; ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, w / 2, c, only); }
    }
    function poly(pts, c, only) {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
        let inside = false; const px = x + 0.5, py = y + 0.5;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside && (only == null || only.includes(get(x, y)))) set(x, y, c);
      }
    }
    function outline() {
      const copy = buf.slice();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (copy[y * W + x] !== E) continue;
        const n = (xx, yy) => (xx >= 0 && yy >= 0 && xx < W && yy < H) ? copy[yy * W + xx] : E;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) buf[y * W + x] = OUT;
      }
    }
    return { set, get, ellipse, line, poly, outline };
  }

  // ---- parts ----
  function tail(g, bx, by, base, curl, wave, len, c) {
    let x = bx, y = by, a = base;
    const seg = 2.1, n = Math.round(len);
    for (let i = 0; i < n; i++) {
      a += curl + Math.sin(wave + i * 0.6) * 0.09;
      const nx = x + Math.cos(a) * seg, ny = y + Math.sin(a) * seg;
      g.line(x, y, nx, ny, i > n - 3 ? 2.6 : 3.2, c);
      x = nx; y = ny;
    }
    return { x, y };
  }
  function leg(g, hx, hy, fx, fy, c, sock) {
    const kx = (hx + fx) / 2 + (fx < hx ? 0.6 : -0.6), ky = (hy + fy) / 2;
    g.line(hx, hy, kx, ky, 3.4, c); g.line(kx, ky, fx, fy - 1, 3, c);
    g.ellipse(fx + 0.8, fy - 0.6, 2.2, 1.4, c);
    if (sock) g.ellipse(fx + 0.6, fy - 1.2, 2.2, 2.2, SOCK, [c]);
  }
  function head(g, cx, cy, o) {
    g.poly([[cx - 7, cy - 2], [cx - 5.5, cy - 11.5], [cx - 0.5, cy - 5]], FUR);
    g.poly([[cx + 0.5, cy - 5.5], [cx + 4, cy - 12], [cx + 7, cy - 2.5]], FUR);
    g.ellipse(cx, cy, 8.2, 7, FUR);
    g.ellipse(cx + 5.8, cy + 2.2, 3.8, 3, FUR);
    return () => {
      g.poly([[cx + 2, cy - 5.5], [cx + 4, cy - 9.8], [cx + 5.4, cy - 4]], PINK, [FUR, DARK]);
      g.poly([[cx - 5.6, cy - 3.8], [cx - 4.8, cy - 8.8], [cx - 2.2, cy - 5.2]], PINK, [FUR, DARK]);
      if (o.pattern === 'atigrado') { g.set(cx - 1, cy - 5, DARK); g.set(cx - 1, cy - 4, DARK); g.set(cx + 1, cy - 5, DARK); g.set(cx - 3, cy - 4, DARK); }
      if (o.pattern === 'manchas') g.ellipse(cx - 3, cy - 2, 2.6, 2.2, DARK, [FUR]);
      g.ellipse(cx + 5.4, cy + 2.6, 2.8, 2, LIGHT, [FUR]);
      g.set(cx + 9, cy + 1, PINK); g.set(cx + 9, cy + 0, PINK);
      const ex = cx + 3.5, ey = cy - 1.5;
      if (o.eyes === 'closed') { g.set(ex - 1, ey + 1, OUT); g.set(ex, ey + 1, OUT); g.set(ex + 1, ey + 1, OUT); }
      else if (o.eyes === 'happy') { g.set(ex - 1, ey + 1, OUT); g.set(ex, ey, OUT); g.set(ex + 1, ey + 1, OUT); }
      else {
        for (let yy = 0; yy < 3; yy++) for (let xx = -1; xx <= 1; xx++) g.set(ex + xx, ey + yy, EYE);
        const pxl = (o.look || 0) < 0 ? ex - 1 : ex + (o.look > 0 ? 1 : 0);
        g.set(pxl, ey, PUPIL); g.set(pxl, ey + 1, PUPIL); g.set(pxl, ey + 2, PUPIL); g.set(ex - 1, ey, SHINE);
      }
      if (o.mouth) { g.set(cx + 6, cy + 4, PINK); g.set(cx + 7, cy + 4, PINK); g.set(cx + 6, cy + 5, PINK); }
      g.set(cx + 9, cy + 2, OUT); g.set(cx + 10, cy + 3, OUT);
    };
  }
  function bodyDetails(g, cx, cy, rx, ry, o) {
    g.ellipse(cx + 2, cy + ry * 0.55, rx * 0.75, ry * 0.5, LIGHT, [FUR]);
    if (o.pattern === 'atigrado') for (let i = -2; i <= 2; i++) g.line(cx + i * 4.5, cy - ry + 0.5, cx + i * 4.5 - 1, cy - ry * 0.2, 1.4, DARK, [FUR]);
    if (o.pattern === 'manchas') { g.ellipse(cx - 4, cy - 2, 4, 3, DARK, [FUR]); g.ellipse(cx + 6, cy - 3, 3, 2.4, DARK, [FUR]); }
  }

  // ---- poses: each returns nothing, draws into g ----
  const POSES = {
    stand(g, o, t) { return walkLike(g, o, 0, 0, t); },
    walk(g, o, t) { return walkLike(g, o, (t / 0.9) % 1, 1, t); },
    trot(g, o, t) { return walkLike(g, o, (t / 0.55) % 1, 1.4, t); },
    run(g, o, t) {
      const p = (t / 0.42) % 1, s = Math.sin(p * TAU), fat = o.fat || 0;
      const stretch = s * 2.2, by = 26 - Math.max(0, s) * 2.5;
      const bx = 30, rx = 13 + stretch * 0.6 + fat, ry = 6.5 + fat * 0.6;
      const far = [];
      // back legs together, front legs together (bound)
      const bk = -Math.cos(p * TAU) * 6, fr = Math.cos(p * TAU) * 6;
      leg(g, bx - 9, by + 2, bx - 10 + bk - 1, GROUND - Math.max(0, -s) * 3, FAR);
      leg(g, bx + 10, by + 2, bx + 12 + fr - 1, GROUND - Math.max(0, s) * 3, FAR);
      tail(g, bx - 12, by - 2, Math.PI + 0.25, -0.06, t * 9, 9, FUR);
      g.ellipse(bx, by, rx, ry, FUR);
      const hd = head(g, bx + rx + 1, by - 6 + s, o);
      leg(g, bx - 8, by + 2, bx - 8 + bk + 1, GROUND - Math.max(0, -s) * 3, FUR, o.pattern === 'calcetines');
      leg(g, bx + 11, by + 2, bx + 13 + fr + 1, GROUND - Math.max(0, s) * 3, FUR, o.pattern === 'calcetines');
      return () => { bodyDetails(g, bx, by, rx, ry, o); hd(); far.length = 0; };
    },
    sit(g, o, t) {
      const fat = o.fat || 0, b = Math.sin(t * 1.6) * 0.3;
      tail(g, 18, 42, 0.2, 0.05, t * 1.8, 9, FUR);
      g.ellipse(24, 35, 9 + fat, 8.5 + fat * 0.5, FUR);
      g.line(26, 34, 33, 24, 11 + fat, FUR);
      g.line(34, 28, 35, GROUND - 1, 3.2, FAR); g.ellipse(36, GROUND - 1, 2.2, 1.3, FAR);
      g.ellipse(21, GROUND - 1.5, 6, 2, FUR);
      const hd = head(g, 37, 15 + b, o);
      leg(g, 37, 28, 37.5, GROUND, FUR, o.pattern === 'calcetines');
      return () => {
        g.ellipse(33, 30, 3.5, 6, LIGHT, [FUR]);
        if (o.pattern === 'atigrado') { g.line(18, 30, 21, 33, 1.3, DARK, [FUR]); g.line(17, 35, 21, 37, 1.3, DARK, [FUR]); g.line(24, 26, 26, 29, 1.3, DARK, [FUR]); }
        if (o.pattern === 'manchas') g.ellipse(22, 33, 4, 3, DARK, [FUR]);
        hd();
      };
    },
    loaf(g, o, t) {
      const fat = o.fat || 0, br = Math.sin(t * 1.5) * 0.4;
      tail(g, 17, 41, 0.15, 0.03, t, 8, FUR);
      g.ellipse(29, 37.5 - br, 14 + fat, 7 + br + fat * 0.5, FUR);
      const hd = head(g, 41, 30 - br, o);
      return () => { bodyDetails(g, 29, 37.5 - br, 14, 7, o); g.ellipse(38, GROUND - 1.2, 3.5, 1.4, o.pattern === 'calcetines' ? SOCK : LIGHT, [FUR]); hd(); };
    },
    sleep(g, o, t) {
      const br = Math.sin(t * 1.2) * 0.5, fat = o.fat || 0;
      g.ellipse(30, 37.5 - br * 0.5, 13 + fat, 7 + br + fat * 0.4, FUR);
      g.poly([[34, 31], [35.5, 25.5], [39, 30]], FUR); g.poly([[39, 30.5], [42, 26], [43.5, 32]], FUR);
      g.ellipse(39, 35, 6.5, 5.5, FUR);
      tail(g, 17.5, 41.5, 0.12, -0.035, 0, 10, FUR);
      return () => {
        bodyDetails(g, 30, 37.5, 13, 7, o);
        g.set(40, 35, OUT); g.set(41, 35, OUT); g.set(42, 35, OUT); g.set(44, 37, PINK);
        g.poly([[40, 31], [41.6, 27.6], [42.6, 31.4]], PINK, [FUR]);
      };
    },
    stretch(g, o, t) {
      const k = Math.min(1, Math.sin(Math.min(1, t / 1.4) * Math.PI) * 1.4);
      const by = 26 + k * 2, tilt = k * 5;
      leg(g, 21, by + 1 - tilt, 20, GROUND, FAR);
      leg(g, 39, by + 2 + tilt, 44 + k * 4, GROUND, FAR);
      tail(g, 16, by - 2 - tilt, -Math.PI / 2 - 0.3, 0.06, t * 2, 9, FUR);
      g.line(20, by - tilt, 38, by + tilt, 13, FUR);
      const hd = head(g, 45 + k * 1.5, by + 1 + tilt * 1.4, { ...o, eyes: k > 0.5 ? 'closed' : o.eyes, mouth: k > 0.7 });
      leg(g, 22, by + 1 - tilt, 22, GROUND, FUR, o.pattern === 'calcetines');
      leg(g, 40, by + 2 + tilt, 47 + k * 4, GROUND, FUR, o.pattern === 'calcetines');
      return () => { bodyDetails(g, 29, by, 12, 6, o); hd(); };
    },
    groom(g, o, t) {
      const lick = Math.sin(t * 7);
      tail(g, 18, 42, 0.2, 0.05, t, 9, FUR);
      g.ellipse(24, 35, 9, 8.5, FUR); g.line(26, 34, 33, 25, 11, FUR);
      g.ellipse(21, GROUND - 1.5, 6, 2, FUR);
      g.line(34, 28, 35, GROUND - 1, 3.2, FAR);
      const hd = head(g, 37 + lick * 0.4, 18 + lick * 0.6, { ...o, eyes: 'closed', mouth: lick > 0 });
      g.line(36, 29, 42, 23 + lick, 3.2, FUR); g.ellipse(43, 22.5 + lick, 2.2, 1.8, o.pattern === 'calcetines' ? SOCK : FUR);
      return () => { g.ellipse(33, 31, 3.5, 6, LIGHT, [FUR]); hd(); };
    },
    eat(g, o, t) {
      const chew = Math.sin(t * 9) * 0.6;
      return walkLike(g, o, 0, 0, t, { headDX: 3, headDY: 13 + chew, eyes: 'happy', mouth: chew > 0 });
    },
    pounce(g, o, t) {
      const p = Math.min(1, t / 0.6), crouch = p < 0.5 ? p * 2 : 1 - (p - 0.5) * 2;
      return walkLike(g, o, 0, 0, t, { bodyDY: crouch * 6 - (p > 0.4 && p < 0.9 ? 6 : 0), tailUp: true, butt: crouch * 2 });
    },
    poop(g, o, t) {
      const fat = o.fat || 0;
      tail(g, 16, 34, -Math.PI / 2 - 0.4, 0.04, t * 3, 9, FUR);
      g.ellipse(22, 37, 8 + fat, 6.5, FUR); g.line(23, 35, 34, 27, 10 + fat, FUR);
      g.line(35, 30, 36, GROUND - 1, 3.2, FAR);
      g.ellipse(20, GROUND - 1.2, 5, 1.8, FUR);
      const hd = head(g, 39, 20, { ...o, eyes: 'closed' });
      leg(g, 38, 30, 38.5, GROUND, FUR, o.pattern === 'calcetines');
      return () => { hd(); };
    },
    vomit(g, o, t) {
      const heave = Math.max(0, Math.sin(t * 6));
      return walkLike(g, o, 0, 0, t, { headDX: 3 + heave, headDY: 9 + heave * 3, eyes: 'closed', mouth: heave > 0.5, bodyDY: -heave * 2.5 });
    },
  };

  function walkLike(g, o, p, amp, t, x) {
    x = x || {};
    const fat = o.fat || 0, bob = amp ? Math.round(Math.sin(p * TAU * 2) * 0.6) : 0;
    const bx = 30, by = 29 + bob + (x.bodyDY || 0), rx = 13 + fat, ry = 7.2 + fat * 0.7;
    const stride = 3.4 * amp;
    const foot = (hip, off) => {
      const ph = (p + off) * TAU;
      return [hip + Math.cos(ph) * stride, GROUND - Math.max(0, Math.sin(ph)) * 2.2 * amp];
    };
    const hips = { bn: bx - 9, bf: bx - 7, fn: bx + 9, ff: bx + 11 };
    const yb = by + 3 + (x.butt || 0) * 0;
    let f;
    f = foot(hips.bf, 0.5); leg(g, hips.bf, yb, f[0], f[1], FAR);
    f = foot(hips.ff, 0.75); leg(g, hips.ff, by + 3, f[0], f[1], FAR);
    const tailBase = x.tailUp || amp > 0 ? -Math.PI / 2 - 0.5 : Math.PI + 0.6;
    tail(g, bx - rx + 1, by - 2, tailBase, x.tailUp || amp > 0 ? 0.07 : 0.11, t * (amp ? 3 : 1.6), 9.5, FUR);
    g.ellipse(bx, by, rx, ry, FUR);
    g.line(bx + 7, by - 1, bx + 11, by - 5 + (x.headDY || 0) * 0.5, 7, FUR);
    const hd = head(g, bx + 15 + (x.headDX || 0), by - 9 + (x.headDY || 0), { ...o, eyes: x.eyes || o.eyes, mouth: x.mouth });
    f = foot(hips.bn, 0); leg(g, hips.bn, yb, f[0], f[1], FUR, o.pattern === 'calcetines');
    f = foot(hips.fn, 0.25); leg(g, hips.fn, by + 3, f[0], f[1], FUR, o.pattern === 'calcetines');
    return () => { bodyDetails(g, bx, by, rx, ry, o); hd(); };
  }

  function hexToRgb(h) { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(h, k) { const [r, g, b] = hexToRgb(h); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }

  /** Draw the cat into a 64x48 logical frame. opts: fur, dark, light, eye, pattern, eyes, fat, dirt */
  function render(ctx, pose, t, opts) {
    const o = opts || {};
    const buf = buffer(), g = make(buf);
    const fn = POSES[pose] || POSES.stand;
    const details = fn(g, o, t);
    if (details) details();
    if (o.dirt) for (let i = 0; i < W * H; i++) if ((buf[i] === FUR || buf[i] === LIGHT) && ((i * 2654435761) >>> 0) % 100 < o.dirt * 14) buf[i] = DARK;
    g.outline();
    const pal = [null, o.outline || '#2B1D17', o.fur || '#E08A45', o.dark || '#A85A26', o.light || '#F7D9B8', o.eye || '#7FA35A', '#E89A94', '#FFFFFF', '#1A1210', shade(o.fur || '#E08A45', 0.78), '#FFF8F0'];
    const img = ctx.createImageData(W, H), d = img.data, rgb = pal.map(c => { if (!c) return null; if (c[0] === '#') return hexToRgb(c); const m = c.match(/\d+/g).map(Number); return m; });
    for (let i = 0; i < W * H; i++) { const c = rgb[buf[i]]; if (!c) continue; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }
  window.MishiSprite = { W, H, GROUND, POSES: Object.keys(POSES), render };
})();
