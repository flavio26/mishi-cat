/* Mishi behaviour: autonomous life in the room, drawn as a pixel-art sprite on a canvas. Purely visual, no game state. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const SCENE_W = 360, SCENE_H = 400;
  const FLOOR = { minX: 70, maxX: 300, minY: 314, maxY: 384 };
  const SPOTS = { rug: { x: 182, y: 360 }, bowl: { x: 250, y: 360 }, yarn: { x: 178, y: 384 }, litter: { x: 90, y: 362 }, window: { x: 262, y: 330 } };
  const ANCHOR_X = 0.47, FEET_Y = 44 / 48;
  // act name -> sprite pose and options
  const ACT_POSE = {
    'is-hop': { pose: 'stand', hop: 1 }, 'is-stretch': { pose: 'stretch' }, 'is-look': { pose: 'sit', look: true },
    'is-pounce': { pose: 'pounce', leap: 1 }, 'is-eating': { pose: 'eat' }, 'is-cleaning': { pose: 'groom', shake: 1 },
    'is-purring': { pose: 'sit', eyes: 'happy', purr: 1 }, 'is-licking': { pose: 'sit', eyes: 'happy', mouth: true },
    'is-poop': { pose: 'poop' }, 'is-vomit': { pose: 'vomit' }, 'is-sniff': { pose: 'eat', eyes: 'open' },
    'is-disgust': { pose: 'stand', eyes: 'closed', shake: 1 }, 'is-meow': { pose: 'sit', mouth: true },
    'is-scratch': { pose: 'pounce', scratch: 1 }, 'is-groom': { pose: 'groom' }, 'is-watch': { pose: 'sit', look: 'up' },
    'is-knead': { pose: 'loaf', eyes: 'happy', purr: 1 },
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const now = () => performance.now();

  function create(o) {
    const { cat, room, fx, yarn } = o;
    const canvas = cat.querySelector('canvas'), motion = cat.querySelector('.cat-motion');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let pos = { ...SPOTS.rug }, facing = 1, walk = null, act = null, actTimer = null, idleTimer = null, running = false, lockedUntil = 0;
    let rest = 'sit', blinkUntil = 0, nextBlink = now() + 3000, frame = 0, lastDraw = 0, lastKey = '';
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
      const g = geom(), pad = (cat.offsetWidth * 0.38 + 4) / g.s;
      const visL = -g.ox / g.s, visR = (g.W - g.ox) / g.s;
      return { minX: Math.max(FLOOR.minX, visL + pad), maxX: Math.min(FLOOR.maxX, visR - pad), minY: FLOOR.minY, maxY: FLOOR.maxY };
    }
    function visibleFloor(pad = 24) {
      const g = geom(), visL = -g.ox / g.s, visR = (g.W - g.ox) / g.s;
      return { minX: Math.max(FLOOR.minX, visL + pad), maxX: Math.min(FLOOR.maxX, visR - pad), minY: 330, maxY: 386 };
    }
    function fit(p) { const b = bounds(); return { x: clamp(p.x, b.minX, Math.max(b.minX, b.maxX)), y: clamp(p.y, b.minY, b.maxY) }; }
    function depth(y) { return 0.86 + (y - FLOOR.minY) / (FLOOR.maxY - FLOOR.minY) * 0.14; }
    function span() { return (cat.offsetWidth || 160) / geom().s; }
    function setFace(dir) { facing = dir < 0 ? -1 : 1; cat.dataset.facing = facing < 0 ? 'left' : 'right'; }
    function size() {
      const g = geom();
      // whole-pixel scale keeps the pixel art crisp
      const k = clamp(Math.round(g.s * 2.3), 2, Math.max(2, Math.floor(g.H * 0.55 / 48)));
      cat.style.width = (64 * k) + 'px';
      cat.style.height = (48 * k) + 'px';
      room.style.setProperty('--s', g.s.toFixed(3));
    }
    function place(p) {
      const g = geom();
      cat.style.left = (g.ox + p.x * g.s) + 'px';
      cat.style.bottom = (g.H - (g.oy + p.y * g.s) - cat.offsetHeight * (1 - FEET_Y)) + 'px';
      cat.style.setProperty('--depth', depth(p.y).toFixed(3));
      cat.style.zIndex = p.y > 372 ? '4' : '2';
    }
    function haltWalk() {
      if (!walk) return;
      walk = null; cat.classList.remove('is-walking', 'is-running');
      place(pos);
    }
    function clearAct() { clearTimeout(actTimer); if (act) cat.classList.remove(act.cls); act = null; }
    function setAct(cls, ms, then) {
      clearAct();
      act = { cls, start: now(), ms: o.reduced() ? 60 : ms, ...(ACT_POSE[cls] || { pose: 'stand' }) };
      cat.classList.add(cls);
      actTimer = setTimeout(() => { const a = act; clearAct(); if (a && then) then(); }, act.ms);
    }
    function walkTo(target, opts = {}) {
      const speed = opts.speed || 1, then = opts.then;
      haltWalk(); clearAct();
      const t = opts.free ? target : fit(target);
      if (o.reduced()) { pos = { ...t }; place(pos); if (then) then(); return; }
      const g = geom(), dist = Math.hypot(t.x - pos.x, t.y - pos.y) * g.s;
      if (dist < 6) { if (then) then(); return; }
      if (Math.abs(t.x - pos.x) > 3) setFace(t.x < pos.x ? -1 : 1);
      const ms = Math.round(clamp(dist / (75 * speed) * 1000, 350, 4500));
      walk = { from: { ...pos }, to: t, start: now(), ms, speed, then };
      cat.classList.toggle('is-running', speed >= 1.4);
      cat.classList.add('is-walking');
    }
    function stepWalk(tn) {
      if (!walk) return;
      const k = Math.min(1, (tn - walk.start) / walk.ms);
      pos = { x: walk.from.x + (walk.to.x - walk.from.x) * k, y: walk.from.y + (walk.to.y - walk.from.y) * k };
      place(pos);
      if (k >= 1) { const then = walk.then; walk = null; cat.classList.remove('is-walking', 'is-running'); if (then) then(); }
    }
    function furOpts() {
      const st = o.stats ? o.stats() : { hygiene: 100 };
      const base = o.appearance ? o.appearance() : {};
      return { ...base, dirt: st.hygiene < 28 ? 0.85 : st.hygiene < 60 ? 0.45 : 0 };
    }
    function currentPose(tn) {
      const sleeping = cat.classList.contains('is-sleeping');
      let pose, t = tn / 1000, extra = {}, dx = 0, dy = 0;
      if (act) {
        const at = (tn - act.start) / 1000, k = clamp((tn - act.start) / act.ms, 0, 1);
        pose = act.pose; t = act.pose === 'sit' || act.pose === 'groom' || act.pose === 'eat' || act.pose === 'vomit' ? tn / 1000 : at;
        if (act.eyes) extra.eyes = act.eyes === 'open' ? undefined : act.eyes;
        if (act.mouth) extra.mouth = Math.sin(at * 8) > -0.3;
        if (act.look === true) extra.look = Math.sin(at * 2.6) > 0 ? 1 : -1;
        if (act.look === 'up') extra.look = 1;
        if (act.hop) dy = -Math.sin(Math.PI * k) * 0.35;
        if (act.leap) { dy = k > 0.4 && k < 0.9 ? -Math.sin(Math.PI * (k - 0.4) / 0.5) * 0.25 : 0; dx = k > 0.4 ? Math.min(1, (k - 0.4) / 0.4) * 0.08 : 0; }
        if (act.shake) dx = Math.sin(at * 28) * 0.015;
        if (act.purr) dx = Math.sin(at * 60) * 0.006;
        if (act.scratch) { pose = 'stand'; dx = Math.sin(at * 24) * 0.01; }
      } else if (walk) {
        pose = walk.speed >= 1.7 ? 'run' : walk.speed >= 1.2 ? 'trot' : 'walk';
      } else if (sleeping) pose = 'sleep';
      else pose = rest;
      if (!extra.eyes && pose !== 'sleep') {
        if (tn > nextBlink) { blinkUntil = tn + 140; nextBlink = tn + 2500 + Math.random() * 4000; }
        if (tn < blinkUntil) extra.eyes = 'closed';
        else if (cat.classList.contains('petted') || cat.classList.contains('mood-happy') && pose === 'sit' && Math.sin(tn / 1700) > 0.85) extra.eyes = 'happy';
      }
      return { pose, t, extra, dx, dy };
    }
    function draw(tn) {
      const p = currentPose(tn);
      if (cat.dataset.pose !== p.pose) cat.dataset.pose = p.pose;
      if (motion) motion.style.transform = 'translate(' + (p.dx * 100 * facing).toFixed(2) + '%,' + (p.dy * 100).toFixed(2) + '%) scaleX(' + facing + ')';
      if (!ctx) return;
      const opts = { ...furOpts(), ...p.extra };
      const key = o.reduced() ? p.pose + JSON.stringify(opts) : '';
      if (key && key === lastKey) return;
      lastKey = key;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      window.MishiSprite.render(ctx, p.pose, o.reduced() ? 0.4 : p.t, opts);
    }
    function loop(tn) {
      frame = requestAnimationFrame(loop);
      stepWalk(tn);
      if (tn - lastDraw < 66) return; // ~15 fps, pixel-art cadence
      lastDraw = tn;
      try { draw(tn); } catch (e) { cancelAnimationFrame(frame); frame = 0; throw e; }
    }
    function ensureLoop() { if (!frame && window.MishiSprite) frame = requestAnimationFrame(loop); }

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
    function headPx() {
      const r = cat.getBoundingClientRect(), rr = room.getBoundingClientRect();
      const hx = facing > 0 ? 0.62 : 0.32;
      return { x: r.left - rr.left + r.width * hx, y: r.top - rr.top + r.height * 0.3, r };
    }
    function burst(icon, n) {
      if (!fx || o.reduced()) return;
      const h = headPx();
      for (let i = 0; i < n; i++) fxAt(icon, h.x + (Math.random() - 0.5) * h.r.width * 0.3, h.y, 1, icon === 'i-sparkle' ? 'fx-sparkle' : '');
    }
    function bubble(text) {
      if (!fx) return;
      const h = headPx(), d = document.createElement('div');
      d.className = 'fx-say'; d.textContent = text;
      d.style.left = h.x + 'px';
      d.style.top = (h.y - h.r.height * 0.12) + 'px';
      fx.appendChild(d); setTimeout(() => d.remove(), 1700);
    }
    function meow(text) { setAct('is-meow', 900); bubble(text || '¡Miau!'); if (o.sound) o.sound(760); }
    function rollYarn() { if (!yarn) return; yarn.classList.remove('is-rolling'); void yarn.getBoundingClientRect(); yarn.classList.add('is-rolling'); }
    function randomSpot() { const b = bounds(); return { x: b.minX + Math.random() * (b.maxX - b.minX), y: b.minY + Math.random() * (b.maxY - b.minY) }; }
    function lock(ms) { lockedUntil = Date.now() + (o.reduced() ? 200 : ms); }
    function nearestSpot() { const S = BS(); let best = null, d = 1e9; for (const k of Object.keys(S)) { const q = Math.hypot(S[k].x - pos.x, S[k].y - pos.y); if (q < d) { d = q; best = k; } } return d < 60 ? best : null; }
    const sleeping = () => cat.classList.contains('is-sleeping');
    const walking = () => Boolean(walk);

    function sniffAt(m, then) {
      lock(5000);
      const side = pos.x < m.x ? -1 : 1;
      walkTo({ x: m.x + side * 30, y: m.y - 2 }, { speed: 0.8, then: () => {
        setFace(-side); setAct('is-sniff', 1300, () => setAct('is-disgust', 900, then));
      } });
    }

    let plan = null, planToken = 0;
    const BS = () => (window.MishiBrain ? window.MishiBrain.SPOTS : SPOTS);
    const jitter = (p, r) => ({ x: p.x + (Math.random() - 0.5) * r, y: p.y + (Math.random() - 0.5) * r * 0.4 });
    function finish(token, short) { if (token !== planToken) return; plan = null; schedule(short ? 600 : 1200); }
    function seq(token, steps) {
      const next = () => {
        if (token !== planToken || !running) return;
        const step = steps.shift();
        if (!step) { finish(token, true); return; }
        step(next);
      };
      next();
    }
    const go = (p, speed, opt) => next => walkTo(p, { speed, ...(opt || {}), then: next });
    const doAct = (cls, ms) => next => setAct(cls, ms, next);
    const wait = ms => next => { actTimer = setTimeout(next, o.reduced() ? 50 : ms); };
    const fn = f => next => { f(); next(); };
    function execute(d) {
      const token = ++planToken, S = BS(), st = o.stats();
      plan = { act: d.act, spot: d.spot, start: Date.now() };
      cat.dataset.mind = d.act;
      const target = d.spot && S[d.spot] ? jitter(S[d.spot], 16) : randomSpot();
      const steps = [];
      switch (d.act) {
        case 'explore':
          steps.push(go(target, 0.6 + Math.random() * 0.5));
          if (Math.random() < 0.4) steps.push(doAct('is-sniff', 1100));
          steps.push(fn(() => { rest = pick(['sit', 'stand', 'sit', 'loaf']); if (o.onExplored) o.onExplored(d.spot); }), wait(800 + Math.random() * 1600));
          break;
        case 'patrol':
          steps.push(go(target, 0.8), doAct('is-look', 1600), go(randomSpot(), 0.9), fn(() => { rest = 'stand'; }), wait(600));
          break;
        case 'watch':
          steps.push(go(S.window, 0.8), fn(() => { setFace(1); }), doAct('is-watch', 2600),
            fn(() => { if (Math.random() < 0.5) { bubble(pick(['¡Un pájaro!', '¡Mrrr!', '¿Eh?'])); o.say(name() + ' mira por la ventana. ¡Ha visto un pájaro!'); } }),
            doAct('is-watch', 2200), fn(() => { rest = 'sit'; }));
          break;
        case 'hunt':
          steps.push(go({ x: S.yarn.x - 34, y: S.yarn.y }, 1.4), fn(() => setFace(1)), doAct('is-pounce', 800), fn(rollYarn),
            go({ x: S.yarn.x + 30, y: S.yarn.y - 6 }, 1.8), doAct('is-pounce', 700), fn(() => { rest = 'sit'; }));
          break;
        case 'nap':
          steps.push(go(target, 0.55), doAct('is-stretch', 1500), fn(() => { rest = 'loaf'; o.say(name() + ' se acurruca en ' + (S[d.spot] ? S[d.spot].label : 'el suelo') + '.'); }), wait(5000 + Math.random() * 5000));
          break;
        case 'knead':
          steps.push(go(target, 0.7), doAct('is-knead', 2600), fn(() => { rest = 'loaf'; }), wait(1500));
          break;
        case 'groom':
          steps.push(doAct('is-groom', 2400));
          if (st.hygiene < 45) steps.push(fn(() => o.say(name() + ' se lame el pelo. Le vendría bien un baño.')));
          break;
        case 'beg':
          steps.push(go(S.bowl, 1.1), fn(() => { setFace(1); rest = 'sit'; meow(); o.say(name() + ' maúlla junto a su cuenco. ¡Tiene hambre!'); }), wait(2500));
          break;
        case 'seek':
          steps.push(go(jitter(S.you, 60), 1.1), fn(() => { setFace(Math.random() < 0.5 ? -1 : 1); rest = 'sit'; meow(pick(['¿Miau?', '¡Miau!', 'Mrrau'])); o.say(name() + ' viene a buscarte. ¿Le haces caso?'); if (o.onSeek) o.onSeek(); }), wait(4500));
          break;
        case 'zoomies':
          for (let k = 0; k < 4; k++) steps.push(go(randomSpot(), 2));
          steps.push(doAct('is-hop', 700), fn(() => { rest = 'stand'; o.say('¡' + name() + ' corre como loco por la casa!'); }));
          break;
        case 'scratch':
          steps.push(go(target, 0.9), fn(() => setFace(d.spot === 'plant' ? -1 : 1)), doAct('is-scratch', 1800), fn(() => { rest = 'sit'; }));
          break;
        case 'sniff': {
          const mess = o.mess ? o.mess() : [];
          if (mess.length) steps.push(next => sniffAt(pick(mess), () => { o.say(name() + ' arruga la nariz. ¡Hay que limpiar eso!'); if (o.onMess) o.onMess(d.spot); next(); }));
          break;
        }
        default:
          steps.push(fn(() => { rest = pick(['sit', 'loaf', 'stand']); }), wait(1500 + Math.random() * 1500));
      }
      seq(token, steps);
    }
    function idle() {
      if (!running) return;
      if (o.isBusy() || document.hidden || sleeping() || walking() || plan || act || Date.now() < lockedUntil) { schedule(); return; }
      if (o.tired && o.tired()) { schedule(); return; }
      const d = o.decide ? o.decide() : { act: pick(['explore', 'patrol', 'groom', 'rest', 'hunt']), spot: null };
      execute(d);
    }
    function schedule(ms) {
      clearTimeout(idleTimer);
      if (running) idleTimer = setTimeout(idle, ms != null ? ms : 900 + Math.random() * 1300);
    }
    function interrupt() { planToken++; plan = null; }

    return {
      layout() { size(); pos = fit(pos); place(pos); lastKey = ''; ensureLoop(); if (!frame || o.reduced()) try { draw(now()); } catch (_) { /* sprite unavailable */ } },
      start() { running = true; ensureLoop(); schedule(); },
      stop() { running = false; interrupt(); clearTimeout(idleTimer); haltWalk(); clearAct(); },
      current: () => (plan ? { act: plan.act, spot: plan.spot } : { act: null, spot: nearestSpot() }),
      toPx, toScene, visibleFloor, walkTo, meow, bubble,
      act: setAct,
      setRest(p) { rest = p; },
      pose: () => cat.dataset.pose || '',
      position: () => ({ ...pos }),
      sparkleAt(p) { const q = toPx(p); fxAt('i-sparkle', q.x, q.y, 4, 'fx-sparkle'); },
      react(kind, done, at) {
        lockedUntil = 0; interrupt(); schedule(2500);
        if (kind === 'pet') { haltWalk(); rest = 'sit'; setAct('is-purring', 1600); burst('i-heart', 3); }
        else if (kind === 'feed') { lock(4000); walkTo({ x: SPOTS.bowl.x, y: SPOTS.bowl.y }, { speed: 1.6, then: () => { setFace(1); setAct('is-eating', 2300, () => { rest = 'sit'; setAct('is-licking', 1000); }); } }); }
        else if (kind === 'clean') { haltWalk(); setAct('is-cleaning', 1500); burst('i-sparkle', 4); }
        else if (kind === 'tidy') { haltWalk(); setAct('is-hop', 700, () => setAct('is-purring', 1200)); burst('i-heart', 2); }
        else if (kind === 'sleep') walkTo(SPOTS.rug, { speed: 0.7, then: () => { clearAct(); if (done) done(); } });
        else if (kind === 'wake') setAct('is-stretch', 1600, () => { rest = 'sit'; setAct('is-hop', 700); });
        else if (kind === 'celebrate') { setAct('is-hop', 700, () => setAct('is-hop', 700)); burst('i-heart', 4); }
        else if (kind === 'litter') {
          lock(9000);
          walkTo(SPOTS.litter, { speed: 0.9, free: true, then: () => {
            setFace(1); setAct('is-poop', 1800, () => {
              if (done) done();
              setAct('is-scratch', 1000, () => walkTo({ x: SPOTS.litter.x + 80, y: SPOTS.litter.y }, { speed: 1.2, then: () => { setFace(-1); rest = 'sit'; setAct('is-look', 1400); lockedUntil = 0; } }));
            });
          } });
        } else if (kind === 'poop' && at) {
          lock(9000);
          walkTo({ x: at.x + span() * 0.22, y: at.y - 2 }, { speed: 0.9, then: () => {
            setFace(1); setAct('is-poop', 1800, () => {
              if (done) done();
              setAct('is-scratch', 1000, () => walkTo({ x: at.x - span() * 0.5, y: at.y }, { speed: 1.3, then: () => { setFace(1); setAct('is-look', 1400); lockedUntil = 0; } }));
            });
          } });
        } else if (kind === 'vomit' && at) {
          lock(9000);
          walkTo({ x: at.x - span() * 0.32, y: at.y - 2 }, { speed: 0.95, then: () => {
            setFace(1); setAct('is-vomit', 1900, () => {
              if (done) done();
              walkTo({ x: at.x + (at.x > 185 ? -75 : 75), y: at.y - 12 }, { speed: 0.6, then: () => { setAct('is-disgust', 900); lockedUntil = 0; } });
            });
          } });
        } else if (kind === 'sniff' && at) sniffAt(at);
        else if (done) done();
      },
      chase(p, onCatch) {
        lockedUntil = 0; interrupt();
        haltWalk();
        const side = pos.x <= p.x ? -1 : 1;
        walkTo({ x: p.x + side * 30, y: p.y }, { speed: 1.9, then: () => {
          setFace(-side); setAct('is-pounce', 600, () => { if (onCatch) onCatch(); });
        } });
      },
      call(clientX, clientY) {
        const p = toScene(clientX, clientY);
        lockedUntil = 0; interrupt();
        walkTo(p, { speed: 1.5, then: () => { rest = 'sit'; setAct('is-look', 1400); } });
        schedule();
      },
      busyWalking: walking,
    };
  }
  window.MishiBehavior = { create, SPOTS, FLOOR };
})();
