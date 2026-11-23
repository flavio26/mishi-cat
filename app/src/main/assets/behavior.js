/* Mishi behaviour: walking around the room and reacting to care. Purely visual, no game state. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const SCENE_W = 360, SCENE_H = 400;
  const FLOOR = { minX: 70, maxX: 300, minY: 314, maxY: 384 };
  const SPOTS = { rug: { x: 182, y: 360 }, bowl: { x: 238, y: 362 }, yarn: { x: 132, y: 374 } };
  const ACTS = ['is-hop', 'is-stretch', 'is-look', 'is-pounce', 'is-eating', 'is-cleaning', 'is-purring', 'is-licking'];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function create(o) {
    const { cat, room, figure, fx, yarn } = o;
    let pos = { ...SPOTS.rug }, walkTimer = null, actTimer = null, idleTimer = null, running = false;

    function geom() {
      const W = room.clientWidth || 1, H = room.clientHeight || 1;
      const s = Math.max(W / SCENE_W, H / SCENE_H);
      return { W, H, s, ox: (W - SCENE_W * s) / 2, oy: H - SCENE_H * s };
    }
    function bounds() {
      const g = geom(), padL = (cat.offsetWidth * 0.39 + 4) / g.s, padR = (cat.offsetWidth * 0.61 + 4) / g.s;
      const visL = -g.ox / g.s, visR = (g.W - g.ox) / g.s;
      return { minX: Math.max(FLOOR.minX, visL + padL), maxX: Math.min(FLOOR.maxX, visR - padR), minY: FLOOR.minY, maxY: FLOOR.maxY };
    }
    function fit(p) { const b = bounds(); return { x: clamp(p.x, b.minX, Math.max(b.minX, b.maxX)), y: clamp(p.y, b.minY, b.maxY) }; }
    function depth(y) { return 0.86 + (y - FLOOR.minY) / (FLOOR.maxY - FLOOR.minY) * 0.14; }
    function setFace(dir) { figure.setAttribute('transform', dir < 0 ? 'translate(356 0) scale(-1 1)' : ''); }
    function size() {
      const g = geom();
      cat.style.width = Math.round(Math.min(g.W * 0.42, 190, (g.H * 0.6) / 1.3)) + 'px';
    }
    function place(p, ms) {
      const g = geom();
      cat.style.setProperty('--walk-ms', ms + 'ms');
      cat.style.left = (g.ox + p.x * g.s) + 'px';
      cat.style.bottom = Math.max(0, g.H - (g.oy + p.y * g.s) - cat.offsetHeight * 0.03) + 'px';
      cat.style.setProperty('--depth', depth(p.y).toFixed(3));
    }
    function syncFromScreen() {
      if (!cat.classList.contains('is-walking')) return;
      const g = geom(), cs = getComputedStyle(cat);
      const left = parseFloat(cs.left), bottom = parseFloat(cs.bottom);
      pos = fit({ x: (left - g.ox) / g.s, y: (g.H - bottom - cat.offsetHeight * 0.03 - g.oy) / g.s });
      clearTimeout(walkTimer);
      cat.classList.remove('is-walking', 'is-running');
      place(pos, 0);
    }
    function clearAct() { clearTimeout(actTimer); cat.classList.remove(...ACTS); }
    function act(cls, ms, then) {
      clearAct(); void cat.offsetWidth; cat.classList.add(cls);
      actTimer = setTimeout(() => { cat.classList.remove(cls); if (then) then(); }, o.reduced() ? 60 : ms);
    }
    function walkTo(target, opts = {}) {
      const speed = opts.speed || 1, then = opts.then;
      clearTimeout(walkTimer); syncFromScreen(); clearAct();
      const t = fit(target);
      if (o.reduced()) { pos = t; place(t, 0); if (then) then(); return; }
      const g = geom(), dist = Math.hypot(t.x - pos.x, t.y - pos.y) * g.s;
      if (dist < 6) { if (then) then(); return; }
      if (Math.abs(t.x - pos.x) > 3) setFace(t.x < pos.x ? -1 : 1);
      const ms = Math.round(clamp(dist / (75 * speed) * 1000, 450, 4500));
      cat.classList.toggle('is-running', speed >= 1.4);
      cat.classList.add('is-walking');
      requestAnimationFrame(() => place(t, ms));
      pos = t;
      walkTimer = setTimeout(() => { cat.classList.remove('is-walking', 'is-running'); if (then) then(); }, ms + 40);
    }
    function burst(icon, n) {
      if (!fx || o.reduced()) return;
      const r = cat.getBoundingClientRect(), rr = room.getBoundingClientRect();
      for (let i = 0; i < n; i++) {
        const s = document.createElementNS(NS, 'svg');
        s.setAttribute('class', 'fx-heart' + (icon === 'i-sparkle' ? ' fx-sparkle' : ''));
        const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + icon); s.appendChild(u);
        s.style.left = (r.left - rr.left + r.width * (0.2 + Math.random() * 0.5)) + 'px';
        s.style.top = (r.top - rr.top + r.height * (0.12 + Math.random() * 0.25)) + 'px';
        s.style.animationDelay = (i * 0.2) + 's';
        fx.appendChild(s); setTimeout(() => s.remove(), 1400 + i * 200);
      }
    }
    function rollYarn() { if (!yarn) return; yarn.classList.remove('is-rolling'); void yarn.getBoundingClientRect(); yarn.classList.add('is-rolling'); }
    function randomSpot() { const b = bounds(); return { x: b.minX + Math.random() * (b.maxX - b.minX), y: b.minY + Math.random() * (b.maxY - b.minY) }; }
    const sleeping = () => cat.classList.contains('is-sleeping');

    function idle() {
      if (!running) return;
      if (o.isBusy() || document.hidden || sleeping() || cat.classList.contains('is-walking')) { schedule(); return; }
      const st = o.stats(), r = Math.random();
      if (st.hunger < 30 && r < 0.45) {
        walkTo(SPOTS.bowl, { then: () => { setFace(1); act('is-look', 2400); o.say(o.name() + ' mira su cuenco. Tiene hambre.'); } });
      } else if (st.energy < 25) {
        if (r < 0.6) act('is-stretch', 1600); else walkTo(randomSpot(), { speed: 0.55 });
      } else if (r < 0.4) walkTo(randomSpot(), { speed: 0.8 + Math.random() * 0.6 });
      else if (r < 0.52) act('is-hop', 700);
      else if (r < 0.64) act('is-stretch', 1600);
      else if (r < 0.8) act('is-look', 2400);
      else walkTo(SPOTS.yarn, { speed: 1.5, then: () => { setFace(-1); act('is-pounce', 900); rollYarn(); } });
      schedule();
    }
    function schedule() {
      clearTimeout(idleTimer);
      if (running && !o.reduced()) idleTimer = setTimeout(idle, 3200 + Math.random() * 4800);
    }

    return {
      layout() { size(); pos = fit(pos); place(pos, 0); },
      start() { running = true; schedule(); },
      stop() { running = false; clearTimeout(idleTimer); syncFromScreen(); clearAct(); },
      react(kind, done) {
        schedule();
        if (kind === 'pet') { syncFromScreen(); act('is-purring', 1600); burst('i-heart', 3); }
        else if (kind === 'feed') walkTo(SPOTS.bowl, { speed: 1.6, then: () => { setFace(1); act('is-eating', 2300, () => act('is-licking', 1000)); } });
        else if (kind === 'clean') { syncFromScreen(); act('is-cleaning', 1500); burst('i-sparkle', 4); }
        else if (kind === 'sleep') walkTo(SPOTS.rug, { speed: 0.7, then: () => { clearAct(); if (done) done(); } });
        else if (kind === 'wake') act('is-stretch', 1600, () => act('is-hop', 700));
        else if (kind === 'celebrate') { act('is-hop', 700, () => act('is-hop', 700)); burst('i-heart', 4); }
      },
      call(clientX, clientY) {
        const rr = room.getBoundingClientRect(), g = geom();
        const x = (clientX - rr.left - g.ox) / g.s, y = (clientY - rr.top - g.oy) / g.s;
        walkTo({ x, y }, { speed: 1.5, then: () => act('is-look', 1400) });
        schedule();
      },
      busyWalking: () => cat.classList.contains('is-walking'),
    };
  }
  window.MishiBehavior = { create, SPOTS, FLOOR };
})();
