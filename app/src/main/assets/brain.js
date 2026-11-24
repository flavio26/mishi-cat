/* Mishi brain: utility-based decisions + simple reinforcement learning, all local.
   It learns favourite places, which behaviours you reward, your usual hours and its own personality. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MishiBrain = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VERSION = 1;
  var SPOTS = {
    rug: { x: 182, y: 360, label: 'la alfombra' }, bowl: { x: 250, y: 360, label: 'su cuenco' },
    window: { x: 262, y: 318, label: 'la ventana' }, plant: { x: 84, y: 322, label: 'la planta' },
    shelf: { x: 96, y: 330, label: 'la estantería' }, yarn: { x: 150, y: 384, label: 'el ovillo' },
    you: { x: 182, y: 384, label: 'tu lado' }, corner: { x: 290, y: 380, label: 'el rincón' }
  };
  var ACTS = ['explore', 'patrol', 'watch', 'hunt', 'nap', 'groom', 'beg', 'seek', 'zoomies', 'knead', 'scratch', 'rest', 'sniff'];
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var num = function (v, d) { return typeof v === 'number' && isFinite(v) ? v : d; };

  function create(rng) {
    rng = rng || Math.random;
    var m = { v: VERSION, exp: 0, born: 0, traits: {}, acts: {}, spots: {}, hours: [], recent: [], lastSeen: 0, lastInteract: 0, learned: [] };
    // every cat is born a bit different
    m.traits = { curious: 0.35 + rng() * 0.4, playful: 0.35 + rng() * 0.4, affection: 0.35 + rng() * 0.4, lazy: 0.25 + rng() * 0.4 };
    ACTS.forEach(function (a) { m.acts[a] = 1; });
    Object.keys(SPOTS).forEach(function (s) { m.spots[s] = 1; });
    for (var i = 0; i < 24; i++) m.hours.push(0);
    return m;
  }

  function sanitize(raw, rng) {
    var m = create(rng);
    if (!raw || typeof raw !== 'object') return m;
    m.exp = clamp(Math.floor(num(raw.exp, 0)), 0, 1e7);
    m.born = num(raw.born, 0); m.lastSeen = num(raw.lastSeen, 0); m.lastInteract = num(raw.lastInteract, 0);
    Object.keys(m.traits).forEach(function (k) { if (raw.traits) m.traits[k] = clamp(num(raw.traits[k], m.traits[k]), 0.05, 0.95); });
    ACTS.forEach(function (a) { if (raw.acts) m.acts[a] = clamp(num(raw.acts[a], 1), 0.2, 4); });
    Object.keys(SPOTS).forEach(function (s) { if (raw.spots) m.spots[s] = clamp(num(raw.spots[s], 1), 0.2, 4); });
    if (Array.isArray(raw.hours)) for (var i = 0; i < 24; i++) m.hours[i] = clamp(num(raw.hours[i], 0), 0, 50);
    if (Array.isArray(raw.recent)) m.recent = raw.recent.filter(function (a) { return ACTS.indexOf(a) >= 0; }).slice(-6);
    if (Array.isArray(raw.learned)) m.learned = raw.learned.filter(function (s) { return typeof s === 'string'; }).slice(-12);
    return m;
  }

  function favouriteSpot(m) {
    var best = 'rug', v = -1;
    Object.keys(m.spots).forEach(function (s) { if (s !== 'you' && m.spots[s] > v) { v = m.spots[s]; best = s; } });
    return best;
  }
  function usualHour(m) {
    var best = -1, v = 2.5;
    m.hours.forEach(function (c, h) { if (c > v) { v = c; best = h; } });
    return best;
  }
  function pickSpot(m, rng, exclude) {
    var keys = Object.keys(SPOTS).filter(function (s) { return s !== exclude && s !== 'you'; });
    var total = 0, w = keys.map(function (s) { var x = Math.pow(m.spots[s], 1.6); total += x; return x; });
    var r = rng() * total;
    for (var i = 0; i < keys.length; i++) { r -= w[i]; if (r <= 0) return keys[i]; }
    return keys[keys.length - 1];
  }

  /* ctx: { stats, hour, night, now, messCount, sinceInteract } -> { act, spot, score, scores } */
  function decide(m, ctx, rng) {
    rng = rng || Math.random;
    var st = ctx.stats || {}, T = m.traits, hour = num(ctx.hour, 12), night = !!ctx.night;
    var energy = num(st.energy, 80) / 100, hunger = num(st.hunger, 80) / 100, mood = num(st.mood, 70) / 100, hyg = num(st.hygiene, 90) / 100;
    var lonely = clamp(num(ctx.sinceInteract, 0) / (10 * 60000), 0, 1);
    var expect = clamp(m.hours[hour] / 6, 0, 1);
    var u = {
      explore: 0.55 + T.curious * 0.7 + (1 - T.lazy) * 0.3,
      patrol: 0.35 + T.curious * 0.4 + (m.exp > 40 ? 0.2 : 0),
      watch: night ? 0.15 : 0.3 + T.curious * 0.7,
      hunt: (0.2 + T.playful * 0.9) * energy,
      nap: (1 - energy) * 1.6 + T.lazy * 0.4 + (night ? 0.6 : 0),
      groom: (1 - hyg) * 1.4 + 0.15,
      beg: hunger < 0.35 ? (0.35 - hunger) * 5 : 0,
      seek: (0.15 + T.affection * 0.8) * (0.4 + lonely + expect) + (mood < 0.4 ? 0.4 : 0),
      zoomies: night && energy > 0.6 ? 0.6 + T.playful : energy > 0.85 ? T.playful * 0.4 : 0,
      knead: (T.affection * 0.5) * (mood > 0.6 ? 1 : 0.3),
      scratch: 0.18 + T.playful * 0.2,
      rest: 0.25 + T.lazy * 0.5,
      sniff: ctx.messCount ? 0.5 + T.curious * 0.5 : 0
    };
    var scores = {}, total = 0;
    ACTS.forEach(function (a) {
      var reps = m.recent.filter(function (r) { return r === a; }).length;
      var s = Math.max(0, u[a]) * m.acts[a] * Math.pow(0.72, reps);
      scores[a] = s; total += Math.exp(s * 2.2) * (s > 0 ? 1 : 0);
    });
    var r = rng() * total, act = 'explore';
    for (var i = 0; i < ACTS.length; i++) { if (scores[ACTS[i]] <= 0) continue; r -= Math.exp(scores[ACTS[i]] * 2.2); if (r <= 0) { act = ACTS[i]; break; } }
    var spot = null;
    if (act === 'explore') spot = rng() < 0.35 ? null : pickSpot(m, rng);
    else if (act === 'patrol') spot = pickSpot(m, rng);
    else if (act === 'watch') spot = 'window';
    else if (act === 'hunt') spot = 'yarn';
    else if (act === 'nap' || act === 'knead') spot = rng() < 0.6 ? favouriteSpot(m) : 'rug';
    else if (act === 'beg') spot = 'bowl';
    else if (act === 'seek') spot = 'you';
    else if (act === 'scratch') spot = rng() < 0.5 ? 'plant' : 'corner';
    m.recent.push(act); if (m.recent.length > 6) m.recent.shift();
    return { act: act, spot: spot, score: scores[act], scores: scores };
  }

  function note(m, text) { if (m.learned.indexOf(text) < 0) { m.learned.push(text); if (m.learned.length > 12) m.learned.shift(); return text; } return null; }

  /* kind: pet | play | feed | clean | ignored | mess | wake ; ctx: { act, spot, hour, now } -> message or null */
  function learn(m, kind, ctx) {
    ctx = ctx || {};
    var a = ctx.act, s = ctx.spot, T = m.traits, msg = null;
    var bump = function (obj, k, d, lo, hi) { if (k && obj[k] != null) obj[k] = clamp(obj[k] + d, lo, hi); };
    m.exp += 1;
    if (kind === 'pet' || kind === 'play' || kind === 'feed') {
      if (isFinite(ctx.hour)) { m.hours.forEach(function (c, i) { m.hours[i] = c * 0.995; }); m.hours[ctx.hour] = Math.min(50, m.hours[ctx.hour] + 1); }
      m.lastInteract = num(ctx.now, Date.now());
    }
    if (kind === 'pet') {
      bump(m.acts, a, 0.12, 0.2, 4); bump(m.spots, s, 0.15, 0.2, 4);
      T.affection = clamp(T.affection + 0.01, 0.05, 0.95);
      if (s && m.spots[s] > 1.8) msg = note(m, 'ha descubierto que le encanta que lo acaricies en ' + SPOTS[s].label);
    } else if (kind === 'play') {
      bump(m.acts, 'hunt', 0.15, 0.2, 4); bump(m.spots, 'yarn', 0.1, 0.2, 4);
      T.playful = clamp(T.playful + 0.015, 0.05, 0.95); T.lazy = clamp(T.lazy - 0.008, 0.05, 0.95);
      if (m.acts.hunt > 1.8) msg = note(m, 'ha aprendido que jugar contigo es lo mejor');
    } else if (kind === 'feed') {
      bump(m.spots, 'bowl', 0.12, 0.2, 4);
      if (a === 'beg') { bump(m.acts, 'beg', 0.2, 0.2, 4); msg = note(m, 'ha aprendido a pedir comida maullando en el cuenco'); }
    } else if (kind === 'ignored') {
      bump(m.acts, a, -0.06, 0.2, 4);
      T.affection = clamp(T.affection - 0.006, 0.05, 0.95);
    } else if (kind === 'mess') {
      bump(m.spots, s, -0.2, 0.2, 4);
    } else if (kind === 'clean') {
      T.affection = clamp(T.affection + 0.004, 0.05, 0.95);
    } else if (kind === 'explored') {
      bump(m.spots, s, 0.03, 0.2, 4); T.curious = clamp(T.curious + 0.002, 0.05, 0.95);
    }
    var h = usualHour(m);
    if (!msg && h >= 0) msg = note(m, 'sabe que sueles venir sobre las ' + h + ' h');
    return msg;
  }

  function stage(m) { return m.exp < 30 ? 'Curioseando su casa' : m.exp < 150 ? 'Conociéndote' : m.exp < 500 ? 'Te conoce bien' : 'Inseparable'; }
  function summary(m) {
    var T = m.traits, top = Object.keys(T).sort(function (a, b) { return T[b] - T[a]; })[0];
    var names = { curious: 'curioso', playful: 'juguetón', affection: 'cariñoso', lazy: 'dormilón' };
    var h = usualHour(m);
    return { stage: stage(m), exp: m.exp, trait: names[top], traits: T, favourite: SPOTS[favouriteSpot(m)].label, hour: h, learned: m.learned.slice(-4) };
  }

  return { VERSION: VERSION, SPOTS: SPOTS, ACTS: ACTS, create: create, sanitize: sanitize, decide: decide, learn: learn, summary: summary, favouriteSpot: favouriteSpot, usualHour: usualHour };
}));
