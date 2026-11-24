/* Mishi behaviour: autonomous life in the room and reactions to care. Purely visual, no game state. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const SCENE_W = 360, SCENE_H = 400;
  const FLOOR = { minX: 70, maxX: 300, minY: 314, maxY: 384 };
  const SPOTS = { rug: { x: 182, y: 360 }, bowl: { x: 238, y: 362 }, yarn: { x: 132, y: 374 } };
  const ACTS = ['is-hop', 'is-stretch', 'is-look', 'is-pounce', 'is-eating', 'is-cleaning', 'is-purring', 'is-licking',
    'is-poop', 'is-vomit', 'is-sniff', 'is-disgust', 'is-meow', 'is-scratch', 'is-groom'];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = list => list[Math.floor(Math.random() * list.length)];

  function create(o) {
    const { cat, room, figure, fx, yarn } = o;
    let pos = { ...SPOTS.rug }, facing = 1, walkTimer = null, actTimer = null, idleTimer = null, running = false, lockedUntil = 0;
    const name = () => o.name();

    function geom() {
      const W = room.clientWidth || 1, H = room.clientHeight || 1;
      const s = Math.max(W / SCENE_W, H / SCENE_H);
      return { W, H, s, ox: (W - SCENE_W * s) / 2, oy: H - SCENE_H * s };
    }
    function toPx(p) { const g = geom(); return { x: g.ox + p.x * g.s, y: g.oy + p.y * g.s }; }
    function toScene(clientX, clientY) {
      const rr = room.getBoundingClientRect(), g = geom();
      return { x: (clientX - rr.left - g.ox) / g.s, y: (clientY - rr.top - g.oy) / g.s };
    }
    function bounds() {
      const g = geom(), padL = (cat.offsetWidth * 0.39 + 4) / g.s, padR = (cat.offsetWidth * 0.61 + 4) / g.s;
      const visL = -g.ox / g.s, visR = (g.W - g.ox) / g.s;
      return { minX: Math.max(FLOOR.minX, visL + padL), maxX: Math.min(FLOOR.maxX, visR - padR), minY: FLOOR.minY, maxY: FLOOR.maxY };
    }
    function visibleFloor(pad = 24) {
      const g = geom(), visL = -g.ox / g.s, visR = (g.W - g.ox) / g.s;
      return { minX: Math.max(FLOOR.minX, visL + pad), maxX: Math.min(FLOOR.maxX, visR - pad), minY: 330, maxY: 386 };
    }
    function fit(p) { const b = bounds(); return { x: clamp(p.x, b.minX, Math.max(b.minX, b.maxX)), y: clamp(p.y, b.minY, b.maxY) }; }
    function depth(y) { return 0.86 + (y - FLOOR.minY) / (FLOOR.maxY - FLOOR.minY) * 0.14; }
    function setFace(dir) { facing = dir < 0 ? -1 : 1; figure.setAttribute('transform', facing < 0 ? 'translate(356 0) scale(-1 1)' : ''); }
    function size() {
      const g = geom();
      cat.style.width = Math.round(Math.min(g.W * 0.42, 190, (g.H * 0.6) / 1.3)) + 'px';
      room.style.setProperty('--s', g.s.toFixed(3));
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
      const ms = Math.round(clamp(dist / (75 * speed) * 1000, 350, 4500));
      cat.classList.toggle('is-running', speed >= 1.4);
      cat.classList.add('is-walking');
      requestAnimationFrame(() => place(t, ms));
      pos = t;
      walkTimer = setTimeout(() => { cat.classList.remove('is-walking', 'is-running'); if (then) then(); }, ms + 40);
    }
    function fxAt(icon, x, y, n, cls) {
      if (!fx || o.reduced()) return;
      for (let i = 0; i < n; i++) {
        const s = document.createElementNS(NS, 'svg');
        s.setAttribute('class', 'fx-heart ' + (cls || ''));
        const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + icon); s.appendChild(u);
        s.style.left = (x + (Math.random() - 0.5) * 40 - 14) + 'px';
        s.style.top = (y + (Math.random() - 0.5) * 24 - 20) + 'px';
        s.style.animationDelay = (i * 0.15) + 's';
        fx.appendChild(s); setTimeout(() => s.remove(), 1400 + i * 150);
      }
    }
    function burst(icon, n) {
      if (!fx || o.reduced()) return;
      const r = cat.getBoundingClientRect(), rr = room.getBoundingClientRect();
      for (let i = 0; i < n; i++) {
        fxAt(icon, r.left - rr.left + r.width * (0.3 + Math.random() * 0.35), r.top - rr.top + r.height * (0.15 + Math.random() * 0.2), 1, icon === 'i-sparkle' ? 'fx-sparkle' : '');
      }
    }
    function bubble(text) {
      if (!fx) return;
      const r = cat.getBoundingClientRect(), rr = room.getBoundingClientRect(), d = document.createElement('div');
      d.className = 'fx-say'; d.textContent = text;
      d.style.left = (r.left - rr.left + r.width * 0.5) + 'px';
      d.style.top = (r.top - rr.top + r.height * 0.02) + 'px';
      fx.appendChild(d); setTimeout(() => d.remove(), 1700);
    }
    function meow(text) { act('is-meow', 900); bubble(text || '¡Miau!'); if (o.sound) o.sound(760); }
    function rollYarn() { if (!yarn) return; yarn.classList.remove('is-rolling'); void yarn.getBoundingClientRect(); yarn.classList.add('is-rolling'); }
    function randomSpot() { const b = bounds(); return { x: b.minX + Math.random() * (b.maxX - b.minX), y: b.minY + Math.random() * (b.maxY - b.minY) }; }
    function lock(ms) { lockedUntil = Date.now() + (o.reduced() ? 200 : ms); }
    const sleeping = () => cat.classList.contains('is-sleeping');
    const walking = () => cat.classList.contains('is-walking');

    function sniffAt(m, then) {
      lock(5000);
      const side = pos.x < m.x ? -1 : 1;
      walkTo({ x: m.x + side * 40, y: m.y - 4 }, { speed: 0.8, then: () => {
        setFace(-side); act('is-sniff', 1300, () => act('is-disgust', 900, then));
      } });
    }

    function idle() {
      if (!running) return;
      if (o.isBusy() || document.hidden || sleeping() || walking() || Date.now() < lockedUntil) { schedule(); return; }
      const st = o.stats(), r = Math.random(), mess = o.mess ? o.mess() : [];
      if (st.energy < 18 && o.tired && r < 0.7 && o.tired()) { schedule(); return; }
      if (st.hunger < 30 && r < 0.5) {
        lock(4500);
        walkTo(SPOTS.bowl, { then: () => { setFace(1); meow(); o.say(name() + ' maúlla junto a su cuenco. ¡Tiene hambre!'); } });
      } else if (mess.length && r < 0.4) {
        sniffAt(pick(mess), () => o.say(name() + ' arruga la nariz. ¡Hay que limpiar eso!'));
      } else if (st.hygiene < 45 && r < 0.35) {
        lock(2400); act('is-groom', 2200); o.say(name() + ' se lame el pelo. Le vendría bien un baño.');
      } else if (st.mood < 28 && r < 0.45) {
        meow('Miau…'); o.say(name() + ' está triste. Juega con él o acarícialo.');
      } else if (st.energy < 25) {
        if (r < 0.6) act('is-stretch', 1600); else walkTo(randomSpot(), { speed: 0.55 });
      } else if (r < 0.36) walkTo(randomSpot(), { speed: 0.8 + Math.random() * 0.6 });
      else if (r < 0.46) act('is-hop', 700);
      else if (r < 0.56) act('is-stretch', 1600);
      else if (r < 0.68) act('is-look', 2400);
      else if (r < 0.76) { act('is-groom', 2000); }
      else if (r < 0.84) meow();
      else { lock(3500); walkTo(SPOTS.yarn, { speed: 1.5, then: () => { setFace(-1); act('is-pounce', 900); rollYarn(); } }); }
      schedule();
    }
    function schedule() {
      clearTimeout(idleTimer);
      if (running && !o.reduced()) idleTimer = setTimeout(idle, 2600 + Math.random() * 4200);
    }

    return {
      layout() { size(); pos = fit(pos); place(pos, 0); },
      start() { running = true; schedule(); },
      stop() { running = false; clearTimeout(idleTimer); syncFromScreen(); clearAct(); },
      toPx, toScene, visibleFloor, walkTo, act, meow, bubble,
      position: () => ({ ...pos }),
      sparkleAt(p) { const q = toPx(p); fxAt('i-sparkle', q.x, q.y, 4, 'fx-sparkle'); },
      react(kind, done, at) {
        lockedUntil = 0; schedule();
        if (kind === 'pet') { syncFromScreen(); act('is-purring', 1600); burst('i-heart', 3); }
        else if (kind === 'feed') { lock(4000); walkTo(SPOTS.bowl, { speed: 1.6, then: () => { setFace(1); act('is-eating', 2300, () => act('is-licking', 1000)); } }); }
        else if (kind === 'clean') { syncFromScreen(); act('is-cleaning', 1500); burst('i-sparkle', 4); }
        else if (kind === 'tidy') { syncFromScreen(); act('is-hop', 700, () => act('is-purring', 1200)); burst('i-heart', 2); }
        else if (kind === 'sleep') walkTo(SPOTS.rug, { speed: 0.7, then: () => { clearAct(); if (done) done(); } });
        else if (kind === 'wake') act('is-stretch', 1600, () => act('is-hop', 700));
        else if (kind === 'celebrate') { act('is-hop', 700, () => act('is-hop', 700)); burst('i-heart', 4); }
        else if (kind === 'poop' && at) {
          lock(9000);
          walkTo({ x: at.x - 30, y: at.y - 3 }, { speed: 0.9, then: () => {
            setFace(1); act('is-poop', 1800, () => {
              if (done) done();
              act('is-scratch', 1000, () => walkTo({ x: at.x - 95, y: at.y }, { speed: 1.3, then: () => { setFace(1); act('is-look', 1400); lockedUntil = 0; } }));
            });
          } });
        } else if (kind === 'vomit' && at) {
          lock(9000);
          walkTo({ x: at.x, y: at.y - 6 }, { speed: 0.95, then: () => {
            act('is-vomit', 1900, () => {
              if (done) done();
              walkTo({ x: at.x + (at.x > 185 ? -75 : 75), y: at.y - 12 }, { speed: 0.6, then: () => { act('is-disgust', 900); lockedUntil = 0; } });
            });
          } });
        } else if (kind === 'sniff' && at) sniffAt(at);
        else if (done) done();
      },
      chase(p, onCatch) {
        lockedUntil = 0;
        syncFromScreen();
        const side = pos.x <= p.x ? -1 : 1;
        walkTo({ x: p.x + side * 26, y: p.y }, { speed: 1.9, then: () => {
          setFace(-side); act('is-pounce', 600, () => { if (onCatch) onCatch(); });
        } });
      },
      call(clientX, clientY) {
        const p = toScene(clientX, clientY);
        lockedUntil = 0;
        walkTo(p, { speed: 1.5, then: () => act('is-look', 1400) });
        schedule();
      },
      busyWalking: walking,
    };
  }
  window.MishiBehavior = { create, SPOTS, FLOOR };
})();
