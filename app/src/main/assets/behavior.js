/* Mishi behaviour v2: a cat that commits to what it is doing.
   - Locomotion with acceleration and braking; the gait (walk, trot, run, stalk) follows the real speed and
     the leg cycle advances with the distance travelled, so the feet do not slide.
   - Poses blend into each other (sit -> lie down -> sleep) instead of jumping; turning around is animated.
   - Long activities made of natural steps (sniff, look around, circle before lying down, stalk, wiggle, pounce,
     groom afterwards), idle micro-behaviours (look around, ear flick, tail flick, yawn, slow blink) and
     attention to your finger. Purely visual: no game state lives here. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const SCENE_W = 360, SCENE_H = 400;
  const FLOOR = { minX: 70, maxX: 300, minY: 314, maxY: 384 };
  const SPOTS = { rug: { x: 182, y: 360 }, bowl: { x: 250, y: 360 }, yarn: { x: 178, y: 384 }, litter: { x: 90, y: 362 }, window: { x: 262, y: 330 } };
  const FEET_Y = 44 / 48;
  // act class -> pose and face overrides
  const ACT_POSE = {
    'is-hop': { pose: 'stand', hop: 1 }, 'is-stretch': { pose: 'stretch', local: 1 }, 'is-look': { pose: 'sit', around: 1 },
    'is-pounce': { pose: 'pounce', leap: 1 }, 'is-eating': { pose: 'eat' }, 'is-cleaning': { pose: 'groom', shake: 1 },
    'is-purring': { pose: 'sit', eyes: 'happy', purr: 1 }, 'is-licking': { pose: 'sit', eyes: 'happy', lick: 1 },
    'is-poop': { pose: 'poop' }, 'is-vomit': { pose: 'vomit' }, 'is-sniff': { pose: 'sniff' },
    'is-disgust': { pose: 'stand', eyes: 'closed', ears: 0.9, shake: 1 }, 'is-meow': { pose: 'sit', meow: 1, headUp: 0.6 },
    'is-scratch': { pose: 'scratch' }, 'is-dig': { pose: 'bat' }, 'is-groom': { pose: 'groom' },
    'is-watch': { pose: 'sit', headUp: 1, look: 0.7, pupil: 0.75 }, 'is-knead': { pose: 'knead', purr: 1 },
    'is-nap': { pose: 'sleep' }, 'is-wiggle': { pose: 'crouch' }, 'is-bat': { pose: 'bat' },
    'is-chatter': { pose: 'sit', headUp: 1, look: 0.8, pupil: 1, chatter: 1, twitch: 1 },
    'is-loaf': { pose: 'loaf', eyes: 'half' },
  };
  const GAITS = ['walk', 'trot', 'run', 'stalk'];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ease = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const now = () => performance.now();

  function create(o) {
    const { cat, room, fx, yarn } = o;
    const S = () => window.MishiSprite;
    const canvas = cat.querySelector('canvas'), motion = cat.querySelector('.cat-motion');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let pos = { ...SPOTS.rug }, facing = 1, walk = null, vel = 0, phase = 0, gait = 'walk';
    let act = null, actTimer = null, idleTimer = null, running = false, lockedUntil = 0, rest = 'sit';
    let turn = null, frame = 0, lastTick = 0, lastDraw = 0, lastKey = '';
    let curP = null, trans = null, lastPose = '';
    let blinkUntil = 0, nextBlink = now() + 2500, micro = null, nextMicro = now() + 2500;
    const face = { look: 0, headUp: 0, pupil: 0.45, ears: 0, twitch: 0 };
    let attn = null, lure = null;
    const name = () => o.name();

    // ---------- geometry ----------
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
    function unitsPerScene() { const k = (cat.offsetWidth || 160) / 64; return geom().s / k; }
    function size() {
      const g = geom();
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

    // ---------- facing and turning ----------
    function setFace(dir, instant) {
      const f = dir < 0 ? -1 : 1;
      if (f === facing) return;
      if (!instant && !o.reduced() && running) turn = { from: facing, start: now(), ms: 260 };
      facing = f; cat.dataset.facing = f < 0 ? 'left' : 'right';
    }
    function turning(tn) { return turn && tn - turn.start < turn.ms; }
    function visualScale(tn) {
      if (!turn) return facing;
      const k = (tn - turn.start) / turn.ms;
      if (k >= 1) { turn = null; return facing; }
      const c = Math.cos(Math.PI * ease(k));
      return (c >= 0 ? turn.from : -turn.from) * Math.max(0.12, Math.abs(c));
    }

    // ---------- locomotion ----------
    function haltWalk() {
      if (!walk) return;
      walk = null; cat.classList.remove('is-walking', 'is-running');
      place(pos);
    }
    function clearAct() { clearTimeout(actTimer); if (act) cat.classList.remove(act.cls); act = null; }
    function setAct(cls, ms, then) {
      clearAct();
      act = { cls, start: now(), ms: o.reduced() ? 60 : ms, from: { ...pos }, ...(ACT_POSE[cls] || { pose: 'stand' }) };
      cat.classList.add(cls);
      actTimer = setTimeout(() => { const a = act; clearAct(); if (a && then) then(); }, act.ms);
    }
    function walkTo(target, opts = {}) {
      const speed = opts.speed || 1, then = opts.then;
      haltWalk(); clearAct();
      const t = opts.free ? target : fit(target);
      if (o.reduced()) { pos = { ...t }; place(pos); if (Math.abs(t.x - pos.x) > 3) setFace(t.x < pos.x ? -1 : 1, true); if (then) then(); return; }
      const dist = Math.hypot(t.x - pos.x, t.y - pos.y) * geom().s;
      if (dist < 6) { if (then) then(); return; }
      if (Math.abs(t.x - pos.x) > 3) setFace(t.x < pos.x ? -1 : 1);
      walk = { to: t, vmax: 70 * speed, accel: opts.gait === 'stalk' ? 60 : 110 + speed * 120, gait: opts.gait || null, then };
      cat.classList.toggle('is-running', speed >= 1.4);
      cat.classList.add('is-walking');
    }
    function gaitFor() {
      if (walk && walk.gait) return walk.gait;
      if (vel > 118 || (gait === 'run' && vel > 98)) return 'run';
      if (vel > 60 || (gait === 'trot' && vel > 48)) return 'trot';
      return 'walk';
    }
    function stepWalk(dt, tn) {
      if (!walk) { vel = 0; return; }
      if (turning(tn)) return; // plant the feet and turn first
      const dx = walk.to.x - pos.x, dy = walk.to.y - pos.y, d = Math.hypot(dx, dy);
      const brake = walk.accel * 1.15;
      const want = Math.min(walk.vmax, Math.sqrt(2 * brake * Math.max(0, d - 0.4)) + 6);
      vel += clamp(want - vel, -brake * dt, walk.accel * dt);
      const step = Math.min(d, vel * dt);
      gait = gaitFor();
      phase = (phase + step * unitsPerScene() / S().CYCLE[gait]) % 1;
      if (d < 0.5 || step >= d - 0.01) {
        pos = { ...walk.to }; place(pos);
        const then = walk.then; walk = null; vel = 0; cat.classList.remove('is-walking', 'is-running');
        if (then) then();
        return;
      }
      pos = { x: pos.x + dx / d * step, y: pos.y + dy / d * step };
      place(pos);
    }

    // ---------- pose resolution ----------
    function furOpts() {
      const st = o.stats ? o.stats() : { hygiene: 100 };
      const base = o.appearance ? o.appearance() : {};
      return { ...base, dirt: st.hygiene < 28 ? 0.85 : st.hygiene < 60 ? 0.45 : 0 };
    }
    function transMs(a, b) {
      if (GAITS.includes(a) && GAITS.includes(b)) return 220;
      if (a === 'sleep' || b === 'sleep') return 900;
      if ((a === 'sit' && b === 'loaf') || (a === 'loaf' && b === 'sit')) return 600;
      if (b === 'pounce' || a === 'pounce') return 140;
      if (GAITS.includes(b)) return 260;
      return 420;
    }
    const sleeping = () => cat.classList.contains('is-sleeping');
    const walking = () => Boolean(walk);
    function resolve(tn) {
      let pose, t = tn / 1000, k = 0, x = {}, dx = 0, dy = 0;
      const want = { look: 0, headUp: 0, pupil: 0.45, ears: 0, twitch: 0 };
      if (act) {
        const at = (tn - act.start) / 1000; k = clamp((tn - act.start) / act.ms, 0, 1);
        pose = act.pose; if (act.local || act.leap) t = at;
        if (act.eyes) x.eyes = act.eyes;
        for (const key of ['headUp', 'look', 'pupil', 'ears', 'twitch']) if (act[key] != null) want[key] = act[key];
        if (act.meow) x.mouth = at < 0.55 ? 1 : 0;
        if (act.lick) x.mouth = Math.sin(at * 9) > 0.2 ? 1 : 0;
        if (act.chatter) x.mouth = Math.sin(at * 22) > 0 ? 1 : 0;
        if (act.around) { want.look = Math.sin(at * 1.7) > 0 ? 0.9 : -0.9; want.headUp = 0.3 + Math.sin(at * 1.1) * 0.3; }
        if (act.hop) dy = -Math.sin(Math.PI * k) * 0.32;
        if (act.shake) dx = Math.sin(at * 28) * 0.012;
        if (act.purr) dx = Math.sin(at * 60) * 0.004;
        if (act.leap) {
          const a = clamp((k - 0.3) / 0.42, 0, 1);
          pos = fit({ x: act.from.x + facing * 26 * ease(a), y: act.from.y }); place(pos);
        }
      } else if (walk) {
        pose = gaitFor();
        if (pose === 'stalk') { want.pupil = 1; want.ears = 0.25; }
        if (pose === 'run') want.ears = 0.35;
      } else if (sleeping()) pose = 'sleep';
      else pose = rest;
      // idle micro-behaviours keep a resting cat alive
      if (!act && !walk && pose !== 'sleep' && running) {
        if (!micro && tn > nextMicro) startMicro(tn);
        if (micro) {
          if (tn > micro.until) { micro = null; nextMicro = tn + rnd(1800, 4800); }
          else {
            const m = micro;
            if (m.kind === 'look') { want.look = m.look; want.headUp = m.up; }
            else if (m.kind === 'ear') want.ears = 0.6;
            else if (m.kind === 'tail') want.twitch = 1;
            else if (m.kind === 'yawn') { x.eyes = 'closed'; x.mouth = 1; want.headUp = 0.7; want.ears = 0.3; }
            else if (m.kind === 'lips') x.mouth = Math.sin((tn - m.start) / 55) > 0 ? 1 : 0;
            else if (m.kind === 'slowblink') { const q = (tn - m.start) / (m.until - m.start); x.eyes = q < 0.25 || q > 0.8 ? 'half' : 'closed'; }
          }
        }
      }
      // attention: follow your finger with the eyes and head
      if (attn && tn - attn.t < 1600 && pose !== 'sleep' && !x.eyes) {
        const rel = (attn.x - pos.x) * facing;
        want.look = clamp(rel / 30, -1, 1);
        want.headUp = clamp((pos.y - 40 - attn.y) / 60, -0.4, 1);
        want.pupil = Math.max(want.pupil, clamp(attn.speed / 220, 0.45, 1));
        if (attn.speed > 120) want.twitch = Math.max(want.twitch, 0.7);
      }
      // smooth the face so the head and eyes glide
      const r = o.reduced() ? 1 : 0.18;
      for (const key in want) face[key] += (want[key] - face[key]) * r;
      if (!x.eyes && pose !== 'sleep') {
        if (tn > nextBlink) { blinkUntil = tn + 150; nextBlink = tn + rnd(2600, 6500); }
        if (tn < blinkUntil) x.eyes = 'closed';
        else if (cat.classList.contains('petted')) x.eyes = 'happy';
      }
      return { pose, t, k, x, dx, dy };
    }
    function startMicro(tn) {
      const st = o.stats ? o.stats() : {};
      const opts = ['look', 'look', 'look', 'ear', 'tail', 'lips'];
      if ((st.energy || 100) < 60) opts.push('yawn');
      if ((st.mood || 0) > 60) opts.push('slowblink');
      const kind = pick(opts);
      const dur = { look: rnd(1200, 2600), ear: 260, tail: 700, yawn: 1400, lips: 450, slowblink: 1300 }[kind];
      micro = { kind, start: tn, until: tn + dur, look: rnd(-1, 1), up: rnd(-0.3, 0.8) };
      if (kind === 'yawn' && Math.random() < 0.3 && rest === 'sit') rest = 'loaf';
    }
    function draw(tn) {
      const p = resolve(tn), sp = S();
      if (cat.dataset.pose !== p.pose) cat.dataset.pose = p.pose;
      if (motion) motion.style.transform = 'translate(' + (p.dx * 100 * facing).toFixed(2) + '%,' + (p.dy * 100).toFixed(2) + '%) scaleX(' + visualScale(tn).toFixed(3) + ')';
      if (!ctx || !sp) return;
      const base = sp.params(p.pose, p.t, { phase, k: p.k });
      const target = Object.assign(base, p.x, {
        look: face.look, headUp: face.headUp, pupil: Math.max(face.pupil, base.pupil > 0.6 ? base.pupil : 0), ears: Math.max(face.ears, base.ears), twitch: Math.max(face.twitch, base.twitch),
      });
      if (p.pose !== lastPose) {
        if (curP && !o.reduced()) trans = { from: curP, start: tn, ms: transMs(lastPose, p.pose) };
        lastPose = p.pose;
      }
      let P = target;
      if (trans) { const k = (tn - trans.start) / trans.ms; if (k >= 1) trans = null; else P = sp.lerp(trans.from, target, ease(k)); }
      curP = P;
      const opts = { ...furOpts(), time: o.reduced() ? 0.4 : p.t };
      const key = o.reduced() ? p.pose + JSON.stringify(p.x) + JSON.stringify(opts) : '';
      if (key && key === lastKey) return;
      lastKey = key;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sp.draw(ctx, P, opts);
    }
    function loop(tn) {
      frame = requestAnimationFrame(loop);
      const dt = lastTick ? Math.min(0.05, (tn - lastTick) / 1000) : 0.016; lastTick = tn;
      stepWalk(dt, tn);
      if (tn - lastDraw < 32) return; // ~30 fps
      lastDraw = tn;
      try { draw(tn); } catch (e) { cancelAnimationFrame(frame); frame = 0; throw e; }
    }
    function ensureLoop() { if (!frame && window.MishiSprite) frame = requestAnimationFrame(loop); }

    // ---------- effects ----------
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
      const hx = facing > 0 ? 0.66 : 0.3;
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
    function randomSpot() { const b = bounds(); return { x: rnd(b.minX, b.maxX), y: rnd(b.minY, b.maxY) }; }
    function lock(ms) { lockedUntil = Date.now() + (o.reduced() ? 200 : ms); }
    function nearestSpot() { const SP = BS(); let best = null, d = 1e9; for (const k of Object.keys(SP)) { const q = Math.hypot(SP[k].x - pos.x, SP[k].y - pos.y); if (q < d) { d = q; best = k; } } return d < 60 ? best : null; }

    function sniffAt(m, then) {
      lock(6000);
      const side = pos.x < m.x ? -1 : 1;
      walkTo({ x: m.x + side * 30, y: m.y - 2 }, { speed: 0.65, then: () => {
        setFace(-side); setAct('is-sniff', 1600, () => setAct('is-disgust', 900, then));
      } });
    }

    // ---------- plans: a cat commits to one activity and does it properly ----------
    let plan = null, planToken = 0;
    const BS = () => (window.MishiBrain ? window.MishiBrain.SPOTS : SPOTS);
    const jitter = (p, r) => ({ x: p.x + (Math.random() - 0.5) * r, y: p.y + (Math.random() - 0.5) * r * 0.4 });
    function finish(token) { if (token !== planToken) return; plan = null; schedule(rnd(1800, 4200)); }
    function seq(token, steps) {
      const next = () => {
        if (token !== planToken || !running) return;
        const step = steps.shift();
        if (!step) { finish(token); return; }
        step(next);
      };
      next();
    }
    const go = (p, speed, opt) => next => walkTo(p, { speed, ...(opt || {}), then: next });
    const doAct = (cls, ms) => next => setAct(cls, ms, next);
    const wait = ms => next => { actTimer = setTimeout(next, o.reduced() ? 50 : ms); };
    const fn = f => next => { f(); next(); };
    const settle = (pose, ms) => [fn(() => { rest = pose; }), wait(ms)];
    const faceTo = x => fn(() => setFace(x < pos.x ? -1 : 1));
    function nearby(p, r) { return fit({ x: p.x + rnd(-r, r), y: p.y + rnd(-r * 0.3, r * 0.3) }); }

    function execute(d) {
      const token = ++planToken, SP = BS(), st = o.stats();
      plan = { act: d.act, spot: d.spot, start: Date.now() };
      cat.dataset.mind = d.act;
      const target = d.spot && SP[d.spot] ? jitter(SP[d.spot], 16) : randomSpot();
      const steps = [];
      const sayOnce = (txt, p) => fn(() => { if (Math.random() < (p == null ? 0.6 : p)) o.say(txt); });
      switch (d.act) {
        case 'explore': { // wander with stops: sniff, look around, carry on
          const n = 2 + Math.floor(Math.random() * 2);
          for (let i = 0; i < n; i++) {
            steps.push(go(i === n - 1 ? target : randomSpot(), rnd(0.5, 0.75)));
            if (Math.random() < 0.55) steps.push(doAct('is-sniff', rnd(1300, 2200)));
            else steps.push(...settle('stand', rnd(1200, 2400)));
          }
          steps.push(fn(() => { if (o.onExplored) o.onExplored(d.spot); }), ...settle(Math.random() < 0.6 ? 'sit' : 'loaf', rnd(3000, 6000)));
          break;
        }
        case 'patrol': // checks the corners of its territory
          steps.push(go(target, 0.7), doAct('is-look', 2200), go(randomSpot(), 0.75), doAct('is-sniff', 1400), ...settle('sit', rnd(2500, 4500)));
          break;
        case 'watch': { // sits at the window, sometimes spots a bird and chatters
          steps.push(go(SP.window, 0.7), fn(() => setFace(1)), ...settle('sit', 900), doAct('is-watch', rnd(5000, 8000)));
          if (Math.random() < 0.55) steps.push(fn(() => { bubble(pick(['ek-ek-ek', '¡Mrrrp!', 'ek ek'])); }), doAct('is-chatter', 1800), sayOnce(name() + ' ha visto un pájaro por la ventana.', 0.8), doAct('is-watch', rnd(3000, 5000)));
          else steps.push(doAct('is-look', 2400));
          steps.push(...settle(Math.random() < 0.4 ? 'loaf' : 'sit', rnd(2500, 5000)));
          break;
        }
        case 'hunt': { // stalk the yarn: approach, creep, wiggle, pounce, bat it, then groom as if nothing happened
          const y = SP.yarn, side = pos.x <= y.x ? -1 : 1;
          steps.push(go({ x: y.x + side * 78, y: y.y - 4 }, 0.9), faceTo(y.x), doAct('is-watch', 900),
            go({ x: y.x + side * 40, y: y.y - 2 }, 0.32, { gait: 'stalk' }), faceTo(y.x), doAct('is-wiggle', rnd(800, 1400)),
            doAct('is-pounce', 760), fn(rollYarn), doAct('is-bat', 900));
          if (Math.random() < 0.45) steps.push(go({ x: y.x - side * 34, y: y.y - 4 }, 1.5), faceTo(y.x), doAct('is-pounce', 700), fn(rollYarn));
          steps.push(...settle('sit', 600), doAct('is-groom', rnd(2500, 4000)), ...settle('sit', 2000));
          break;
        }
        case 'nap': { // pick a spot, sniff it, circle, lie down, sleep, stretch
          const spot = d.spot && SP[d.spot] ? SP[d.spot] : target;
          steps.push(go(spot, 0.55), doAct('is-sniff', 1200),
            go(nearby(spot, 9), 0.35), go(nearby(spot, 9), 0.35),
            ...settle('loaf', 2200), sayOnce(name() + ' se acurruca en ' + (SP[d.spot] ? SP[d.spot].label : 'el suelo') + '.', 0.5),
            doAct('is-nap', rnd(15000, 32000)), doAct('is-stretch', 1600), ...settle('sit', 2500));
          break;
        }
        case 'knead':
          steps.push(go(target, 0.6), ...settle('loaf', 900), doAct('is-knead', rnd(4500, 7000)), doAct('is-loaf', rnd(3000, 6000)), ...settle('loaf', 1500));
          break;
        case 'groom':
          steps.push(...settle('sit', 700), doAct('is-groom', rnd(5500, 8500)), ...settle('sit', 1500));
          if (st.hygiene < 45) steps.push(sayOnce(name() + ' se lame el pelo. Le vendría bien un baño.', 1));
          break;
        case 'beg':
          steps.push(go(SP.bowl, 1.05), fn(() => setFace(-1)), ...settle('sit', 500),
            fn(() => { meow(); o.say(name() + ' maúlla junto a su cuenco. ¡Tiene hambre!'); }), wait(3200), fn(() => meow('¡Miaaau!')), wait(3500));
          break;
        case 'seek': // trots over with the tail up, sits, slow-blinks and meows at you
          steps.push(go(jitter(SP.you, 60), 0.95), ...settle('sit', 600),
            fn(() => { micro = { kind: 'slowblink', start: now(), until: now() + 1300 }; }), wait(1500),
            fn(() => { meow(pick(['¿Miau?', '¡Miau!', 'Mrrau'])); o.say(name() + ' viene a buscarte. ¿Le haces caso?'); if (o.onSeek) o.onSeek(); }), wait(6500));
          break;
        case 'zoomies': // sudden sprint around the room, then sits and grooms as if nothing happened
          steps.push(doAct('is-wiggle', 500));
          for (let k = 0; k < 4; k++) steps.push(go(randomSpot(), 2.3));
          steps.push(doAct('is-hop', 650), sayOnce('¡' + name() + ' corre como loco por la casa!', 0.7), ...settle('sit', 800), doAct('is-groom', 3000));
          break;
        case 'scratch':
          steps.push(go(target, 0.8), fn(() => setFace(d.spot === 'plant' ? -1 : 1)), doAct('is-scratch', rnd(2200, 3200)), doAct('is-stretch', 1500), ...settle('sit', 2000));
          break;
        case 'sniff': {
          const mess = o.mess ? o.mess() : [];
          if (mess.length) steps.push(next => sniffAt(pick(mess), () => { o.say(name() + ' arruga la nariz. ¡Hay que limpiar eso!'); if (o.onMess) o.onMess(d.spot); next(); }));
          break;
        }
        default: // rest: sit or lie and just be a cat for a while
          steps.push(...settle(Math.random() < 0.55 ? 'sit' : 'loaf', rnd(6000, 12000)));
      }
      seq(token, steps);
    }
    function idle() {
      if (!running) return;
      if (o.isBusy() || document.hidden || sleeping() || walking() || plan || act || Date.now() < lockedUntil) { schedule(); return; }
      if (o.tired && o.tired()) { schedule(); return; }
      if (lure && now() - lure.t < 400 && lure.moved > 1200) { huntLure(); return; }
      const d = o.decide ? o.decide() : { act: pick(['explore', 'patrol', 'groom', 'rest', 'hunt']), spot: null };
      execute(d);
    }
    function schedule(ms) {
      clearTimeout(idleTimer);
      if (running) idleTimer = setTimeout(idle, ms != null ? ms : rnd(700, 1400));
    }
    function interrupt() { planToken++; plan = null; }

    // ---------- your finger: he watches it, and if you keep wiggling it on the floor he stalks it ----------
    function huntLure() {
      const token = ++planToken, p = fit(lure), side = pos.x <= p.x ? -1 : 1;
      plan = { act: 'hunt', spot: null, start: Date.now() }; cat.dataset.mind = 'lure';
      seq(token, [go({ x: p.x + side * 40, y: p.y }, 0.34, { gait: 'stalk' }), faceTo(p.x), doAct('is-wiggle', 900), doAct('is-pounce', 760), ...settle('sit', 1500)]);
    }
    function interesting(e) {
      if (!running || o.reduced() || sleeping()) return;
      if (e.target.closest && e.target.closest('#cat,.panel,button')) return;
      const p = toScene(e.clientX, e.clientY), tn = now();
      const sp = attn ? Math.hypot(p.x - attn.x, p.y - attn.y) / Math.max(0.016, (tn - attn.t) / 1000) : 0;
      attn = { x: p.x, y: p.y, t: tn, speed: attn && tn - attn.t < 300 ? sp * 0.4 + attn.speed * 0.6 : 0 };
      const pressed = e.pointerType === 'mouse' ? (e.buttons & 1) : true;
      if (pressed && p.y > FLOOR.minY - 20) {
        if (!lure || tn - lure.t > 400) lure = { x: p.x, y: p.y, t: tn, moved: 0 };
        else { lure.moved += tn - lure.t; lure.x = p.x; lure.y = p.y; lure.t = tn; }
      }
      // something moved behind him: turn to look if he is not busy
      if (!walk && !act && (p.x - pos.x) * facing < -24 && !turn) setFace(p.x < pos.x ? -1 : 1);
    }
    room.addEventListener('pointermove', interesting, { passive: true });

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
        if (kind === 'pet') { haltWalk(); rest = 'sit'; setAct('is-purring', 1800, () => setAct('is-loaf', 1500)); burst('i-heart', 3); }
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
              setAct('is-dig', 1000, () => walkTo({ x: SPOTS.litter.x + 80, y: SPOTS.litter.y }, { speed: 1.2, then: () => { setFace(-1); rest = 'sit'; setAct('is-look', 1400); lockedUntil = 0; } }));
            });
          } });
        } else if (kind === 'poop' && at) {
          lock(9000);
          walkTo({ x: at.x + span() * 0.22, y: at.y - 2 }, { speed: 0.9, then: () => {
            setFace(1); setAct('is-poop', 1800, () => {
              if (done) done();
              setAct('is-dig', 1000, () => walkTo({ x: at.x - span() * 0.5, y: at.y }, { speed: 1.3, then: () => { setFace(1); setAct('is-look', 1400); lockedUntil = 0; } }));
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
          setFace(-side); setAct('is-pounce', 640, () => { if (onCatch) onCatch(); });
        } });
      },
      call(clientX, clientY) {
        const p = toScene(clientX, clientY);
        lockedUntil = 0; interrupt();
        const napping = act && act.cls === 'is-nap';
        const goThere = () => walkTo(p, { speed: 1.5, then: () => { rest = 'sit'; setAct('is-look', 1400); } });
        if (napping && !o.reduced()) { setFace(p.x < pos.x ? -1 : 1, true); setAct('is-stretch', 900, goThere); }
        else goThere();
        schedule();
      },
      busyWalking: walking,
    };
  }
  window.MishiBehavior = { create, SPOTS, FLOOR };
})();
