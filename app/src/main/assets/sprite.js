/* Mishi pixel-art cat, v2: a small skeletal rig (hips, shoulders, head, four legs, tail).
   Every pose is a set of joint positions, so poses blend smoothly into each other.
   Drawn procedurally at 2x resolution (128x96 pixels for a 64x48 unit frame). No images. */
(() => {
  'use strict';
  const W = 64, H = 48, GROUND = 44, R = 2, PW = W * R, PH = H * R;
  const E = 0, OUT = 1, FUR = 2, DARK = 3, LIGHT = 4, EYE = 5, PINK = 6, SHINE = 7, PUPIL = 8, FAR = 9, SOCK = 10;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = k => k * k * (3 - 2 * k);

  function make(buf) {
    const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < PW && y < PH) buf[y * PW + x] = c; };
    const get = (x, y) => (x >= 0 && y >= 0 && x < PW && y < PH) ? buf[y * PW + x] : E;
    function ellipse(cx, cy, rx, ry, c, only) {
      if (rx <= 0 || ry <= 0) return;
      const x0 = Math.floor((cx - rx) * R) - 1, x1 = Math.ceil((cx + rx) * R) + 1, y0 = Math.floor((cy - ry) * R) - 1, y1 = Math.ceil((cy + ry) * R) + 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = ((x + 0.5) / R - cx) / rx, dy = ((y + 0.5) / R - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (only == null || only.includes(get(x, y)))) px(x, y, c);
      }
    }
    function line(x0, y0, x1, y1, w, c, only, w1) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * R * 1.2));
      for (let i = 0; i <= n; i++) { const t = i / n, r = lerp(w, w1 == null ? w : w1, t) / 2; ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c, only); }
    }
    function poly(pts, c, only) {
      const xs = pts.map(p => p[0] * R), ys = pts.map(p => p[1] * R);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
        let inside = false; const qx = x + 0.5, qy = y + 0.5;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const xi = xs[i], yi = ys[i], xj = xs[j], yj = ys[j];
          if ((yi > qy) !== (yj > qy) && qx < (xj - xi) * (qy - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside && (only == null || only.includes(get(x, y)))) px(x, y, c);
      }
    }
    function outline() {
      const copy = buf.slice();
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
        if (copy[y * PW + x] !== E) continue;
        const n = (xx, yy) => (xx >= 0 && yy >= 0 && xx < PW && yy < PH) ? copy[yy * PW + xx] : E;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) buf[y * PW + x] = OUT;
      }
    }
    return { px, get, ellipse, line, poly, outline };
  }

  // ---------- rig ----------
  // Every pose returns all of these keys, so any two poses can be blended.
  const BASE = {
    hip: [20, 29], sho: [38, 28.5], rh: 7, rs: 7.4, flat: 0.95,
    haunch: [20, 31, 0], head: [46, 19.5], neck: 7,
    hb: [18, 44], hbf: [21.5, 44], fb: [38.5, 44], fbf: [41.5, 44],
    paw: [0, 0, 0],                       // near front paw override [x, y, weight]
    tail: [-2.75, 0.1, 10, 0.12, 1.6],  // base angle, curl per segment, length, wave amplitude, wave speed
    tailAt: [0, 0, 0], tailFront: 0, twitch: 0,
    eyes: 'open', pupil: 0.45, look: 0, headUp: 0, mouth: 0, ears: 0,
  };
  const P = o => Object.assign({}, BASE, o);

  // foot placement for gaits. u in [0,1): stance (foot on the ground sliding back) then swing (lifted forward)
  function foot(hipX, phase, off, stride, lift, stance) {
    const u = ((phase + off) % 1 + 1) % 1;
    if (u < stance) return [hipX + stride * (1 - 2 * u / stance), GROUND];
    const s = (u - stance) / (1 - stance);
    return [hipX - stride + 2 * stride * smooth(s), GROUND - Math.sin(Math.PI * s) * lift];
  }
  // body travel per gait cycle that matches the feet (no foot sliding)
  const CYCLE = { walk: 2 * 3.6 / 0.62, trot: 2 * 5.2 / 0.5, run: 2 * 7 / 0.36, stalk: 2 * 2.6 / 0.7 };

  const POSES = {
    stand: (o, t) => P({ hip: [20, 29 + Math.sin(t * 1.4) * 0.15], tail: [-2.75, 0.1, 10, 0.1, 1.4] }),
    walk(o, t) {
      const ph = o.phase || 0, bob = Math.sin(ph * TAU * 2) * 0.45;
      return P({
        hip: [20, 29.2 + bob], sho: [38, 28.6 - bob * 0.6], head: [46.5, 19.8 + bob * 0.5],
        hb: foot(19, ph, 0, 3.6, 2, 0.62), fb: foot(39, ph, 0.25, 3.6, 2.4, 0.62), hbf: foot(21.5, ph, 0.5, 3.6, 2, 0.62), fbf: foot(41.5, ph, 0.75, 3.6, 2.4, 0.62),
        tail: [-2.55, 0.1, 10, 0.16, 3],
      });
    },
    trot(o, t) {
      const ph = o.phase || 0, bob = Math.abs(Math.sin(ph * TAU)) * 1;
      return P({
        hip: [20, 28.6 + bob], sho: [38.5, 28.2 + bob * 0.7], head: [47.5, 19.6 + bob * 0.6],
        hb: foot(19, ph, 0, 5.2, 3, 0.5), fbf: foot(41.5, ph, 0, 5.2, 3.4, 0.5), hbf: foot(21.5, ph, 0.5, 5.2, 3, 0.5), fb: foot(39, ph, 0.5, 5.2, 3.4, 0.5),
        tail: [-2.6, 0.085, 10, 0.18, 4],
      });
    },
    run(o, t) {
      const ph = o.phase || 0, s = Math.sin(ph * TAU), lift = Math.max(0, Math.sin((ph - 0.6) * TAU)) * 2.4;
      const len = 18.5 + s * 2.6;
      return P({
        hip: [29 - len / 2, 27.5 - lift + s * 0.6], sho: [29 + len / 2, 27 - lift - s * 0.6], rh: 6.6, rs: 7, head: [29 + len / 2 + 8, 20.5 - lift],
        hb: foot(18, ph, 0, 7, 4, 0.36), hbf: foot(20, ph, 0.1, 7, 4, 0.36), fbf: foot(40, ph, 0.45, 7, 4.5, 0.36), fb: foot(42, ph, 0.55, 7, 4.5, 0.36),
        tail: [Math.PI + 0.35, -0.02, 10, 0.12, 6], ears: 0.35, pupil: 0.7,
      });
    },
    stalk(o, t) {
      const ph = o.phase || 0;
      return P({
        hip: [20, 33.2], sho: [38, 34], rh: 6.4, rs: 6.6, head: [47.5, 29.5], neck: 6,
        hb: foot(19.5, ph, 0, 2.6, 1.2, 0.7), fb: foot(39.5, ph, 0.25, 2.6, 1.4, 0.7), hbf: foot(22, ph, 0.5, 2.6, 1.2, 0.7), fbf: foot(42, ph, 0.75, 2.6, 1.4, 0.7),
        tail: [Math.PI + 0.12, -0.012, 10.5, 0.04, 1.2], twitch: 0.5, pupil: 1, ears: 0.25,
      });
    },
    crouch(o, t) { // butt wiggle before the pounce
      const w = Math.sin(t * 15);
      return P({
        hip: [20 + w * 0.7, 31.8 - Math.abs(w) * 0.4], sho: [38, 35], rh: 6.6, rs: 6.4, head: [47, 30.5], neck: 6,
        hb: [19, 44], hbf: [21.5, 44], fb: [41, 44], fbf: [43.5, 44],
        tail: [Math.PI + 0.1, -0.01, 10.5, 0.05, 1], twitch: 1, pupil: 1, ears: 0.3,
      });
    },
    pounce(o, t) {
      const k = clamp(o.k == null ? (t / 0.7) % 1 : o.k, 0, 1);
      if (k < 0.3) { const c = k / 0.3; return P({ hip: [20, 31 + c], sho: [38, 34 + c], head: [47, 30 + c], rh: 6.6, rs: 6.4, hb: [19, 44], hbf: [21, 44], fb: [41, 44], fbf: [43, 44], tail: [Math.PI + 0.1, 0, 10.5, 0.05, 1], twitch: 1, pupil: 1, ears: 0.3 }); }
      if (k < 0.72) { const a = (k - 0.3) / 0.42, up = Math.sin(Math.PI * a) * 7;
        return P({ hip: [18, 30 - up], sho: [38, 25 - up], head: [47, 17 - up], rh: 6.4, rs: 6.8, hb: [11, 41 - up * 0.6], hbf: [13, 42 - up * 0.6], fb: [50, 30 - up], fbf: [52, 31 - up], tail: [Math.PI + 0.25, -0.02, 10.5, 0.1, 3], pupil: 1, mouth: 1, ears: 0.2 }); }
      const l = (k - 0.72) / 0.28;
      return P({ hip: [20, 30 + (1 - l) * 2], sho: [38, 33 - l * 4], head: [47, 30 - l * 9], hb: [19, 44], hbf: [21.5, 44], fb: [43, 44], fbf: [45.5, 44], tail: [-2.6, 0.04, 10, 0.12, 3], pupil: 0.9 });
    },
    bat(o, t) { // swipe with a front paw while standing
      const s = Math.sin(t * 9);
      return P({ hip: [20, 29], sho: [37.5, 27], head: [45.5, 18.5], paw: [47 + s * 3, 33 - Math.max(0, s) * 6, 1], tail: [-2.2, 0.06, 10, 0.2, 4], twitch: 0.6, pupil: 1 });
    },
    sit: (o, t) => P({
      hip: [22, 36.5], sho: [32.5, 25 + Math.sin(t * 1.5) * 0.18], rh: 8.4, rs: 6.2, haunch: [21, 36.2, 7.4], head: [37.5, 15.2], neck: 6.2,
      hb: [28.5, 44], hbf: [25.5, 44], fb: [34.5, 44], fbf: [36.8, 44],
      tail: [Math.PI - 0.02, 0.075, 9.5, 0.06, 1.2], tailAt: [15, 41.4, 1],
    }),
    loaf: (o, t) => { const br = Math.sin(t * 1.3) * 0.3; return P({
      hip: [20, 37 - br * 0.5], sho: [37, 36.6 - br * 0.5], rh: 7 + br, rs: 6.8 + br, haunch: [20, 37.4, 6.2], head: [43, 29.3 - br * 0.4], neck: 6,
      hb: [23, 41], hbf: [25, 40], fb: [40.5, 43.6], fbf: [41.5, 41],
      tail: [0.04, -0.008, 9.5, 0.03, 0.8], tailAt: [13.4, 41.4, 1], tailFront: 1,
    }); },
    sleep: (o, t) => { const br = Math.sin(t * 1.15) * 0.42; return P({
      hip: [21, 38 - br * 0.4], sho: [35, 38.6 - br * 0.3], rh: 7.5 + br, rs: 6.5 + br * 0.6, haunch: [21, 38.2, 7 + br * 0.5], head: [41, 36.6], neck: 5,
      hb: [25, 41], hbf: [27, 40], fb: [38, 42.8], fbf: [38, 40],
      tail: [0.02, -0.03, 12.5, 0.02, 0.5], tailAt: [13.8, 42, 1], tailFront: 1, eyes: 'closed', ears: 0.35,
    }); },
    stretch(o, t) {
      const k = Math.sin(clamp(t / 1.5, 0, 1) * Math.PI);
      return P({
        hip: [20, 29 - k * 2], sho: [37, 29 + k * 6], rs: 7 - k, head: [45 + k * 2, 20 + k * 9],
        fb: [39 + k * 10, 44], fbf: [41.5 + k * 10, 44], hb: [18, 44], hbf: [21, 44],
        tail: [-1.9 - k * 0.4, 0.05, 10, 0.06, 1.5], eyes: k > 0.5 ? 'closed' : 'open', mouth: k > 0.7 ? 1 : 0, ears: k * 0.3,
      });
    },
    groom(o, t) { // alternate licking the paw and wiping the face
      const cyc = (t % 6) / 6, lick = Math.sin(t * 7), wipe = cyc > 0.55;
      const s = POSES.sit(o, t);
      const head = wipe ? [37.5, 16.5] : [38.5 + lick * 0.3, 18.5 + lick * 0.5];
      const paw = wipe ? [40 + Math.sin(t * 4) * 1.5, 13.5 + Math.cos(t * 4) * 2.5, 1] : [42, 22.5 + lick * 0.6, 1];
      return Object.assign(s, { head, paw, eyes: 'closed', mouth: !wipe && lick > 0 ? 1 : 0 });
    },
    eat(o, t) { const c = Math.sin(t * 9) * 0.4;
      return P({ hip: [20, 28.5], sho: [37, 31], head: [46.5, 34.5 + c], neck: 6.4, fb: [38.5, 44], fbf: [41, 44], eyes: 'happy', mouth: c > 0 ? 1 : 0, tail: [-2.5, 0.08, 10, 0.08, 1.2] }); },
    sniff(o, t) { const b = Math.sin(t * 13) * 0.35;
      return P({ hip: [20, 28.8], sho: [37.5, 30.5], head: [47.5, 33 + b], neck: 6.4, fb: [39, 44], fbf: [41.5, 44], tail: [-2.2, 0.07, 10, 0.12, 2], ears: -0.1 }); },
    scratch(o, t) { // standing up against the plant or wall, front paws pulling down
      const s = Math.sin(t * 8);
      return P({ hip: [24, 36], sho: [31, 21], rh: 7.6, rs: 6.4, haunch: [23, 37, 6.4], head: [36, 13], neck: 6,
        hb: [24, 44], hbf: [27, 44], fb: [40, 13 + s * 2.5], fbf: [41.5, 15 - s * 2.5], tail: [Math.PI + 0.5, 0.06, 10, 0.08, 2], eyes: 'happy' }); },
    knead(o, t) { const s = Math.sin(t * 3.6);
      return P({ hip: [20, 36.5], sho: [37, 34], rh: 7, rs: 6.8, haunch: [20, 37, 6.2], head: [43, 26.5], neck: 6,
        hb: [23, 41], hbf: [25, 40], fb: [41, 44 - Math.max(0, s) * 2.6], fbf: [43.2, 44 - Math.max(0, -s) * 2.6],
        tail: [0.05, -0.01, 9.5, 0.04, 0.8], tailAt: [13.4, 41, 1], tailFront: 1, eyes: 'happy' }); },
    poop: (o, t) => P({ hip: [21, 36], sho: [33, 28.5], rh: 7.4, rs: 6.4, haunch: [20.5, 36.5, 6.4], head: [40.5, 20.5], neck: 6,
      hb: [24, 44], hbf: [26, 44], fb: [35.5, 44], fbf: [37.5, 44], tail: [-1.75, 0.02, 10, 0.04, 1.5], eyes: 'half' }),
    vomit(o, t) { const h = Math.max(0, Math.sin(t * 6));
      return P({ hip: [20, 27.5 - h], sho: [37, 31 + h * 1.4], head: [45.5, 32 + h * 2.6], neck: 6.6, fb: [40, 44], fbf: [42.5, 44], eyes: 'closed', mouth: h > 0.5 ? 1 : 0, ears: 0.6, tail: [Math.PI + 0.7, 0.05, 9.5, 0.03, 1] }); },
  };

  function lerpP(a, b, k) {
    if (k >= 1) return b; if (k <= 0) return a;
    const r = {};
    for (const key in b) {
      const x = a[key], y = b[key];
      if (typeof y === 'number') r[key] = lerp(typeof x === 'number' ? x : y, y, k);
      else if (Array.isArray(y)) r[key] = y.map((v, i) => lerp(Array.isArray(x) ? x[i] : v, v, k));
      else r[key] = k < 0.5 && x != null ? x : y;
    }
    return r;
  }
  function params(pose, t, opts) { return (POSES[pose] || POSES.stand)(opts || {}, t || 0); }

  // ---------- drawing ----------
  function tail(g, p, o, t) {
    const T = p.tail, at = p.tailAt[2] > 0.5 ? [p.tailAt[0], p.tailAt[1]] : [p.hip[0] - p.rh * 0.92, p.hip[1] - p.rh * 0.3];
    let x = at[0], y = at[1], a = T[0];
    const n = Math.round(T[2]), seg = 2, pts = [[x, y]];
    for (let i = 0; i < n; i++) {
      const tip = i / n;
      a += T[1] + T[3] * Math.sin(t * T[4] - i * 0.7) * tip + (i > n - 4 ? p.twitch * Math.sin(t * 17 + i) * 0.22 : 0);
      x = x + Math.cos(a) * seg; y = Math.min(GROUND - 1.2, y + Math.sin(a) * seg); pts.push([x, y]);
    }
    const w = i => lerp(3.4, 2.4, i / n);
    if (p.tailFront) for (let i = 0; i < n; i++) g.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w(i) + 1.1, OUT);
    for (let i = 0; i < n; i++) g.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w(i), o.pattern === 'atigrado' && i % 3 === 2 ? DARK : FUR);
  }
  function hindLeg(g, p, hip, f, c, sock) {
    const A = [hip[0] + 0.4, hip[1] + p.rh * 0.35], L = Math.max(0.1, Math.hypot(f[0] - A[0], f[1] - A[1]));
    const d = [(f[0] - A[0]) / L, (f[1] - A[1]) / L], fw = [d[1], -d[0]], bk = [-d[1], d[0]], fold = Math.max(0, 14 - L);
    const knee = [A[0] + (f[0] - A[0]) * 0.4 + fw[0] * (1.6 + fold * 0.3), A[1] + (f[1] - A[1]) * 0.4 + fw[1] * (1.6 + fold * 0.3)];
    const hock = [A[0] + (f[0] - A[0]) * 0.8 + bk[0] * (1.9 + fold * 0.22), A[1] + (f[1] - A[1]) * 0.8 + bk[1] * (1.9 + fold * 0.22)];
    g.line(A[0], A[1], knee[0], knee[1], 5.6, c, null, 4.2);
    g.line(knee[0], knee[1], hock[0], hock[1], 3.4, c, null, 2.6);
    g.line(hock[0], hock[1], f[0], f[1] - 0.8, 2.6, c);
    g.ellipse(f[0] + 0.9, f[1] - 0.8, 2.2, 1.25, sock ? SOCK : c);
  }
  function frontLeg(g, p, sho, f, c, sock) {
    const A = [sho[0] + 0.6, sho[1] + p.rs * 0.35], L = Math.max(0.1, Math.hypot(f[0] - A[0], f[1] - A[1]));
    const d = [(f[0] - A[0]) / L, (f[1] - A[1]) / L], bk = [-d[1], d[0]], fold = Math.max(0, 13 - L);
    const elbow = [A[0] + (f[0] - A[0]) * 0.45 + bk[0] * fold * 0.35, A[1] + (f[1] - A[1]) * 0.45 + bk[1] * fold * 0.35];
    g.line(A[0], A[1], elbow[0], elbow[1], 4.2, c, null, 3.2);
    g.line(elbow[0], elbow[1], f[0], f[1] - 0.8, 3.1, c, null, 2.7);
    g.ellipse(f[0] + 0.9, f[1] - 0.8, 2.2, 1.3, sock ? SOCK : c);
  }
  function ears(g, h, p, near) {
    const e = p.ears;
    if (!near) { g.poly([[h[0] - 7, h[1] - 1.5], [h[0] - 1.5, h[1] - 5.5], [h[0] - 5.8 - e * 3, h[1] - 11.6 + e * 4.5]], FAR); return; }
    g.poly([[h[0] - 0.8, h[1] - 5.6], [h[0] + 6.2, h[1] - 2.8], [h[0] + 3.2 - e * 4, h[1] - 11.8 + e * 5]], FUR);
  }
  function earInner(g, h, p) {
    const e = p.ears;
    g.poly([[h[0] + 0.8, h[1] - 5.2], [h[0] + 4.6, h[1] - 3.6], [h[0] + 3.1 - e * 3.6, h[1] - 9.6 + e * 4.2]], PINK, [FUR]);
  }
  function headShape(g, h) {
    g.ellipse(h[0], h[1], 7.6, 6.5, FUR);
    g.ellipse(h[0] + 5.4, h[1] + 2.5, 3.8, 2.9, FUR);
    g.ellipse(h[0] + 1.5, h[1] + 4.4, 4.2, 2.4, FUR);
  }
  function face(g, h, p, o) {
    if (o.pattern === 'atigrado') { g.line(h[0] - 0.5, h[1] - 6, h[0], h[1] - 3.8, 0.9, DARK, [FUR]); g.line(h[0] + 1.8, h[1] - 6, h[0] + 2, h[1] - 4, 0.9, DARK, [FUR]); g.line(h[0] - 3, h[1] - 5.2, h[0] - 2.2, h[1] - 3.4, 0.9, DARK, [FUR]); }
    if (o.pattern === 'manchas') g.ellipse(h[0] - 3, h[1] - 2, 2.8, 2.4, DARK, [FUR]);
    g.ellipse(h[0] + 5.3, h[1] + 3, 3, 2, LIGHT, [FUR]);
    g.ellipse(h[0] + 1.5, h[1] + 5, 3, 1.4, LIGHT, [FUR]);
    // nose and mouth
    g.ellipse(h[0] + 8.6, h[1] + 1, 0.8, 0.7, PINK);
    if (p.mouth > 0.5) { g.ellipse(h[0] + 6.6, h[1] + 4.6, 1.5, 1.1, PINK); g.ellipse(h[0] + 6.4, h[1] + 4.2, 1.3, 0.5, OUT, [PINK]); }
    else g.line(h[0] + 8.2, h[1] + 2.4, h[0] + 6.6, h[1] + 3.6, 0.5, OUT);
    // eye: almond with vertical slit pupil
    const ex = h[0] + 3.6, ey = h[1] - 1.1;
    if (p.eyes === 'closed') { g.line(ex - 1.8, ey + 0.2, ex, ey + 0.9, 0.55, OUT); g.line(ex, ey + 0.9, ex + 1.8, ey + 0.2, 0.55, OUT); return; }
    if (p.eyes === 'happy') { g.line(ex - 1.8, ey + 0.9, ex, ey, 0.55, OUT); g.line(ex, ey, ex + 1.8, ey + 0.9, 0.55, OUT); return; }
    g.ellipse(ex, ey, 1.9, 1.55, EYE);
    const pw = 0.32 + clamp(p.pupil, 0, 1) * 0.95, lx = clamp(p.look, -1, 1) * 0.6;
    g.ellipse(ex + lx, ey, pw, 1.4, PUPIL, [EYE]);
    g.ellipse(ex + lx - 0.5, ey - 0.6, 0.35, 0.35, SHINE, [EYE, PUPIL]);
    if (p.eyes === 'half') { for (let yy = -2; yy < 0.1; yy += 0.25) g.line(ex - 2, ey + yy, ex + 2, ey + yy, 0.5, FUR, [EYE, PUPIL, SHINE]); g.line(ex - 1.8, ey + 0.1, ex + 1.8, ey + 0.1, 0.5, OUT); }
  }
  function body(g, p) {
    const n = Math.max(2, Math.ceil(Math.hypot(p.sho[0] - p.hip[0], p.sho[1] - p.hip[1]) * 1.5));
    for (let i = 0; i <= n; i++) { const k = i / n, r = lerp(p.rh, p.rs, k); g.ellipse(lerp(p.hip[0], p.sho[0], k), lerp(p.hip[1], p.sho[1], k), r, r * p.flat, FUR); }
    if (p.haunch[2] > 0.3) g.ellipse(p.haunch[0], p.haunch[1], p.haunch[2], p.haunch[2] * 0.95, FUR);
  }
  function bodyDetails(g, p, o) {
    const dx = p.sho[0] - p.hip[0], dy = p.sho[1] - p.hip[1], L = Math.hypot(dx, dy) || 1, d = [dx / L, dy / L], up = [d[1], -d[0]];
    const at = k => [lerp(p.hip[0], p.sho[0], k), lerp(p.hip[1], p.sho[1], k)];
    const c = at(0.62), r = lerp(p.rh, p.rs, 0.62);
    g.ellipse(c[0] - up[0] * r * 0.5, c[1] - up[1] * r * 0.5, Math.max(3, L * 0.38), r * 0.5, LIGHT, [FUR]);
    const ch = at(1);
    g.ellipse(ch[0] + 1 - up[0] * p.rs * 0.2, ch[1] - up[1] * p.rs * 0.2, 2.6, p.rs * 0.55, LIGHT, [FUR]);
    if (o.pattern === 'atigrado') for (let i = 1; i <= 4; i++) { const q = at(i / 5), rr = lerp(p.rh, p.rs, i / 5); g.line(q[0] + up[0] * rr * 0.98, q[1] + up[1] * rr * 0.98, q[0] + up[0] * rr * 0.35 - d[0], q[1] + up[1] * rr * 0.35 - d[1], 1.3, DARK, [FUR]); }
    if (o.pattern === 'atigrado' && p.haunch[2] > 2) { g.line(p.haunch[0] - 4, p.haunch[1] - 2, p.haunch[0] - 1, p.haunch[1] + 1, 1.2, DARK, [FUR]); g.line(p.haunch[0] - 4.5, p.haunch[1] + 2, p.haunch[0] - 1.5, p.haunch[1] + 4, 1.2, DARK, [FUR]); }
    if (o.pattern === 'manchas') { const q = at(0.3); g.ellipse(q[0] + up[0] * 2, q[1] + up[1] * 2, 4.2, 3.2, DARK, [FUR]); const s = at(0.8); g.ellipse(s[0] + up[0] * 3, s[1] + up[1] * 3, 2.8, 2.2, DARK, [FUR]); }
  }

  function hexToRgb(h) { const n = parseInt(String(h).replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(h, k) { return hexToRgb(h).map(v => clamp(Math.round(v * k), 0, 255)); }

  function draw(ctx, p, opts) {
    const o = opts || {}, buf = new Uint8Array(PW * PH), g = make(buf), t = o.time || 0;
    const sock = o.pattern === 'calcetines', h = [p.head[0], p.head[1] - p.headUp * 2];
    // far side first
    hindLeg(g, p, [p.hip[0] + 1.5, p.hip[1]], p.hbf, FAR);
    frontLeg(g, p, [p.sho[0] + 1.5, p.sho[1]], p.fbf, FAR);
    ears(g, h, p, false);
    if (!p.tailFront) tail(g, p, o, t);
    body(g, p);
    g.line(p.sho[0], p.sho[1] - p.rs * 0.2, h[0] - 2.5, h[1] + 2.5, p.neck, FUR);
    ears(g, h, p, true);
    headShape(g, h);
    hindLeg(g, p, p.hip, p.hb, FUR, sock);
    if (p.paw[2] > 0.5) frontLeg(g, p, p.sho, [p.paw[0], p.paw[1]], FUR, sock);
    else frontLeg(g, p, p.sho, p.fb, FUR, sock);
    if (p.tailFront) tail(g, p, o, t);
    bodyDetails(g, p, o);
    earInner(g, h, p);
    face(g, h, p, o);
    if (o.dirt) for (let i = 0; i < buf.length; i++) if ((buf[i] === FUR || buf[i] === LIGHT) && ((i * 2654435761) >>> 0) % 100 < o.dirt * 12) buf[i] = DARK;
    g.outline();
    // whiskers on top of the outline, one pixel thin
    const wc = OUT;
    for (const [dy, ex] of [[-0.6, 4], [0.6, 4.4]]) for (let s = 0; s <= 8; s++) { const k = s / 8; g.px(Math.round((h[0] + 8.4 + ex * k) * R), Math.round((h[1] + 2.6 + dy * k * 2) * R), wc); }
    const fur = o.fur || '#E08A45';
    const pal = [null, hexToRgb(o.outline || '#2B1D17'), hexToRgb(fur), hexToRgb(o.dark || '#A85A26'), hexToRgb(o.light || '#F7D9B8'), hexToRgb(o.eye || '#7FA35A'), hexToRgb('#E89A94'), [255, 255, 255], [26, 18, 16], shade(fur, 0.76), hexToRgb('#FFF8F0')];
    const img = ctx.createImageData(PW, PH), d = img.data;
    for (let i = 0; i < buf.length; i++) { const c = pal[buf[i]]; if (!c) continue; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }
  /** Compatibility helper: draw a named pose at time t. */
  function render(ctx, pose, t, opts) { draw(ctx, params(pose, t, opts), Object.assign({}, opts, { time: t })); }

  window.MishiSprite = { W, H, R, GROUND, CYCLE, POSES: Object.keys(POSES), params, lerp: lerpP, draw, render };
})();
