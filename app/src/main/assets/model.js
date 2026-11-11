(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) { module.exports = api; }
  if (root && typeof root === 'object') { root.MishiModel = api; }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var SAVE_VERSION = 1;
  var MINUTE = 60000;
  var STAT_KEYS = ['hunger', 'energy', 'mood', 'hygiene'];

  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') { deepFreeze(o[k]); } });
    return Object.freeze(o);
  }

  var CONFIG = deepFreeze({
    maxOfflineMs: 8 * 60 * MINUTE,
    offlineFloor: 15,
    maxNameLength: 16,
    defaultName: 'Mishi',
    maxLevel: 50,
    rates: {
      awake: { hunger: -0.5, energy: -0.3, mood: -0.4, hygiene: -0.2 },
      asleep: { hunger: -0.25, energy: 2.0, mood: -0.05, hygiene: -0.1 }
    },
    cooldowns: { pet: 600, petXp: 4000, feed: 1200, clean: 1200, sleep: 800 },
    game: { durationMs: 20000, countdownMs: 3000, minEnergy: 15, minHunger: 10, maxScore: 120, energyCost: 12, hungerCost: 6, hygieneCost: 5 }
  });

  var FURS = deepFreeze([
    { id: 'naranja', name: 'Naranja', base: '#E08A45', dark: '#A85A26', light: '#F7D9B8', unlockLevel: 1 },
    { id: 'gris', name: 'Gris perla', base: '#A3A7AB', dark: '#666C72', light: '#E6E7E8', unlockLevel: 1 },
    { id: 'crema', name: 'Crema', base: '#E8CFA3', dark: '#B39268', light: '#FBF1DF', unlockLevel: 1 },
    { id: 'negro', name: 'Carbón', base: '#45403F', dark: '#1F1C1B', light: '#78706D', unlockLevel: 2 },
    { id: 'chocolate', name: 'Chocolate', base: '#8A5A3C', dark: '#583520', light: '#C9A07F', unlockLevel: 3 },
    { id: 'nieve', name: 'Nieve', base: '#F5F1EA', dark: '#BDB3A6', light: '#FFFFFF', unlockLevel: 4 }
  ]);
  var PATTERNS = deepFreeze([
    { id: 'liso', name: 'Liso', unlockLevel: 1 },
    { id: 'atigrado', name: 'Atigrado', unlockLevel: 1 },
    { id: 'manchas', name: 'Manchas', unlockLevel: 2 },
    { id: 'calcetines', name: 'Calcetines', unlockLevel: 3 }
  ]);
  var EYES = deepFreeze([
    { id: 'verde', name: 'Verde', color: '#7FA35A', unlockLevel: 1 },
    { id: 'ambar', name: 'Ámbar', color: '#D69A2D', unlockLevel: 1 },
    { id: 'azul', name: 'Azul', color: '#5E8FB8', unlockLevel: 1 }
  ]);

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function num(v, fb) { return isNum(v) ? v : fb; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function clampInt(v, lo, hi, fb) { return isNum(v) ? clamp(Math.floor(v), lo, hi) : fb; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function findOption(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }

  function xpToNext(level) { return 40 + (Math.max(1, level) - 1) * 20; }

  function sanitizeName(raw) {
    if (typeof raw !== 'string') { return ''; }
    var n = raw.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E]/g, '').replace(/\s+/g, ' ').trim();
    return Array.from(n).slice(0, CONFIG.maxNameLength).join('').trim();
  }

  function createDefaultState(now) {
    now = num(now, Date.now());
    return {
      version: SAVE_VERSION,
      name: CONFIG.defaultName,
      fur: 'naranja', pattern: 'atigrado', eyes: 'verde',
      stats: { hunger: 80, energy: 85, mood: 75, hygiene: 90 },
      xp: 0, level: 1,
      sleeping: false, sleepStartedAt: null,
      lastTick: now, createdAt: now,
      bestScore: 0,
      totals: { pets: 0, feeds: 0, cleans: 0, naps: 0, games: 0 },
      settings: { reducedMotion: false },
      gameCounter: 0, activeGameId: null,
      cooldowns: { pet: 0, petXp: 0, feed: 0, clean: 0, sleep: 0 }
    };
  }

  function sanitizeState(raw, now) {
    now = num(now, Date.now());
    var d = createDefaultState(now);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { return d; }
    d.name = sanitizeName(raw.name) || CONFIG.defaultName;
    var st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    STAT_KEYS.forEach(function (k) { d.stats[k] = clamp(num(st[k], d.stats[k]), 0, 100); });
    d.level = clampInt(raw.level, 1, CONFIG.maxLevel, 1);
    d.xp = d.level >= CONFIG.maxLevel ? 0 : clamp(Math.floor(num(raw.xp, 0)), 0, xpToNext(d.level) - 1);
    var fur = findOption(FURS, raw.fur);
    if (fur && fur.unlockLevel <= d.level) { d.fur = fur.id; }
    var pat = findOption(PATTERNS, raw.pattern);
    if (pat && pat.unlockLevel <= d.level) { d.pattern = pat.id; }
    if (findOption(EYES, raw.eyes)) { d.eyes = raw.eyes; }
    d.sleeping = raw.sleeping === true;
    d.sleepStartedAt = d.sleeping ? Math.min(num(raw.sleepStartedAt, now), now) : null;
    var lt = num(raw.lastTick, now);
    d.lastTick = lt > now ? now : lt;
    d.createdAt = Math.min(num(raw.createdAt, now), now);
    d.bestScore = clampInt(raw.bestScore, 0, CONFIG.game.maxScore, 0);
    var tt = raw.totals && typeof raw.totals === 'object' ? raw.totals : {};
    Object.keys(d.totals).forEach(function (k) { d.totals[k] = clampInt(tt[k], 0, 1e9, 0); });
    d.settings.reducedMotion = !!(raw.settings && raw.settings.reducedMotion === true);
    d.gameCounter = clampInt(raw.gameCounter, 0, 1e9, 0);
    return d;
  }

  function serialize(state) {
    var s = clone(state);
    delete s.cooldowns;
    s.activeGameId = null;
    s.version = SAVE_VERSION;
    return JSON.stringify(s);
  }

  function deserialize(text, now) {
    if (typeof text !== 'string' || text === '') { return { ok: false, error: 'empty', state: createDefaultState(now) }; }
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'corrupt', state: createDefaultState(now) }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { return { ok: false, error: 'invalid', state: createDefaultState(now) }; }
    return { ok: true, error: null, state: sanitizeState(parsed, now) };
  }

  function applyStep(s, minutes) {
    var r = s.sleeping ? CONFIG.rates.asleep : CONFIG.rates.awake;
    var st = s.stats;
    var moodDelta = r.mood;
    if (!s.sleeping) {
      if (st.hunger < 25) { moodDelta -= 0.6; }
      if (st.hygiene < 25) { moodDelta -= 0.3; }
      if (st.energy < 15) { moodDelta -= 0.3; }
    }
    st.hunger = clamp(st.hunger + r.hunger * minutes, 0, 100);
    st.energy = clamp(st.energy + r.energy * minutes, 0, 100);
    st.hygiene = clamp(st.hygiene + r.hygiene * minutes, 0, 100);
    st.mood = clamp(st.mood + moodDelta * minutes, 0, 100);
  }

  function tick(state, now, opts) {
    opts = opts || {};
    var s = clone(state);
    var res = { state: s, elapsedMs: 0, appliedMs: 0, capped: false, wokeUp: false, before: clone(s.stats) };
    if (!isNum(now)) { return res; }
    if (!isNum(s.lastTick) || now <= s.lastTick) { s.lastTick = now; return res; }
    var elapsed = now - s.lastTick;
    var applied = Math.min(elapsed, CONFIG.maxOfflineMs);
    res.elapsedMs = elapsed;
    res.appliedMs = applied;
    res.capped = elapsed > CONFIG.maxOfflineMs;
    var remaining = applied;
    while (remaining > 0) {
      var step = Math.min(remaining, MINUTE);
      applyStep(s, step / MINUTE);
      if (s.sleeping && s.stats.energy >= 100) { s.sleeping = false; s.sleepStartedAt = null; res.wokeUp = true; }
      remaining -= step;
    }
    if (opts.offline) {
      STAT_KEYS.forEach(function (k) {
        var floor = Math.min(res.before[k], CONFIG.offlineFloor);
        if (s.stats[k] < floor) { s.stats[k] = floor; }
      });
    }
    s.lastTick = now;
    return res;
  }

  function addXp(s, amount) {
    amount = Math.max(0, Math.floor(num(amount, 0)));
    if (s.level >= CONFIG.maxLevel) { s.xp = 0; return 0; }
    var gained = 0;
    s.xp += amount;
    while (s.level < CONFIG.maxLevel && s.xp >= xpToNext(s.level)) {
      s.xp -= xpToNext(s.level);
      s.level += 1;
      gained += 1;
    }
    if (s.level >= CONFIG.maxLevel) { s.xp = 0; }
    return gained;
  }

  function unlocksBetween(from, to) {
    var out = [];
    FURS.forEach(function (f) { if (f.unlockLevel > from && f.unlockLevel <= to) { out.push({ type: 'fur', id: f.id, name: f.name }); } });
    PATTERNS.forEach(function (p) { if (p.unlockLevel > from && p.unlockLevel <= to) { out.push({ type: 'pattern', id: p.id, name: p.name }); } });
    return out;
  }

  function fail(state, reason) { return { ok: false, reason: reason, state: state, xp: 0, levelsGained: 0, unlocked: [] }; }
  function success(prevLevel, s, xp) {
    var lv = addXp(s, xp);
    return { ok: true, reason: null, state: s, xp: xp, levelsGained: lv, unlocked: lv ? unlocksBetween(prevLevel, s.level) : [] };
  }
  function prepare(state) {
    var s = clone(state);
    if (!s.cooldowns || typeof s.cooldowns !== 'object') { s.cooldowns = {}; }
    return s;
  }
  function onCooldown(s, key, now) {
    var last = num(s.cooldowns[key], 0);
    return now >= last && now - last < CONFIG.cooldowns[key];
  }

  function pet(state, now) {
    var s = prepare(state);
    if (s.sleeping) { return fail(state, 'sleeping'); }
    if (onCooldown(s, 'pet', now)) { return fail(state, 'cooldown'); }
    s.cooldowns.pet = now;
    s.stats.mood = clamp(s.stats.mood + 6, 0, 100);
    s.totals.pets += 1;
    var xp = 0;
    if (!onCooldown(s, 'petXp', now)) { xp = 1; s.cooldowns.petXp = now; }
    return success(state.level, s, xp);
  }

  function feed(state, now) {
    var s = prepare(state);
    if (s.sleeping) { return fail(state, 'sleeping'); }
    if (onCooldown(s, 'feed', now)) { return fail(state, 'cooldown'); }
    if (s.stats.hunger >= 95) { return fail(state, 'full'); }
    s.cooldowns.feed = now;
    s.stats.hunger = clamp(s.stats.hunger + 30, 0, 100);
    s.stats.mood = clamp(s.stats.mood + 4, 0, 100);
    s.stats.hygiene = clamp(s.stats.hygiene - 2, 0, 100);
    s.totals.feeds += 1;
    return success(state.level, s, 4);
  }

  function clean(state, now) {
    var s = prepare(state);
    if (s.sleeping) { return fail(state, 'sleeping'); }
    if (onCooldown(s, 'clean', now)) { return fail(state, 'cooldown'); }
    if (s.stats.hygiene >= 95) { return fail(state, 'alreadyClean'); }
    s.cooldowns.clean = now;
    s.stats.hygiene = clamp(s.stats.hygiene + 50, 0, 100);
    s.stats.mood = clamp(s.stats.mood - 2, 0, 100);
    s.totals.cleans += 1;
    return success(state.level, s, 3);
  }

  function sleep(state, now) {
    var s = prepare(state);
    if (s.sleeping) { return fail(state, 'alreadySleeping'); }
    if (onCooldown(s, 'sleep', now)) { return fail(state, 'cooldown'); }
    if (s.activeGameId != null) { return fail(state, 'gameActive'); }
    if (s.stats.energy >= 90) { return fail(state, 'notTired'); }
    s.cooldowns.sleep = now;
    s.sleeping = true;
    s.sleepStartedAt = now;
    s.totals.naps += 1;
    return success(state.level, s, 0);
  }

  function wake(state, now) {
    var s = prepare(state);
    if (!s.sleeping) { return fail(state, 'notSleeping'); }
    if (onCooldown(s, 'sleep', now)) { return fail(state, 'cooldown'); }
    s.cooldowns.sleep = now;
    s.sleeping = false;
    s.sleepStartedAt = null;
    var grumpy = s.stats.energy < 40;
    if (grumpy) { s.stats.mood = clamp(s.stats.mood - 5, 0, 100); }
    var r = success(state.level, s, 0);
    r.grumpy = grumpy;
    return r;
  }

  function toggleSleep(state, now) { return state.sleeping ? wake(state, now) : sleep(state, now); }

  function canStartGame(state) {
    if (state.sleeping) { return 'sleeping'; }
    if (state.activeGameId != null) { return 'gameActive'; }
    if (state.stats.energy < CONFIG.game.minEnergy) { return 'tired'; }
    if (state.stats.hunger < CONFIG.game.minHunger) { return 'hungry'; }
    return null;
  }

  function startGame(state) {
    var reason = canStartGame(state);
    if (reason) { return fail(state, reason); }
    var s = prepare(state);
    s.gameCounter += 1;
    s.activeGameId = s.gameCounter;
    var r = success(state.level, s, 0);
    r.gameId = s.activeGameId;
    return r;
  }

  function gameRewards(score) {
    var g = CONFIG.game;
    score = clampInt(score, 0, g.maxScore, 0);
    return { xp: Math.min(40, 2 + score * 2), mood: Math.min(30, 4 + score * 2), energy: -g.energyCost, hunger: -g.hungerCost, hygiene: -g.hygieneCost };
  }

  function finishGame(state, gameId, score) {
    if (state.activeGameId == null || state.activeGameId !== gameId) { return fail(state, 'noGame'); }
    var s = prepare(state);
    var sc = clampInt(score, 0, CONFIG.game.maxScore, 0);
    var rw = gameRewards(sc);
    s.stats.energy = clamp(s.stats.energy + rw.energy, 0, 100);
    s.stats.hunger = clamp(s.stats.hunger + rw.hunger, 0, 100);
    s.stats.hygiene = clamp(s.stats.hygiene + rw.hygiene, 0, 100);
    s.stats.mood = clamp(s.stats.mood + rw.mood, 0, 100);
    var newRecord = sc > s.bestScore;
    if (newRecord) { s.bestScore = sc; }
    s.totals.games += 1;
    s.activeGameId = null;
    var r = success(state.level, s, rw.xp);
    r.score = sc;
    r.newRecord = newRecord;
    r.rewards = rw;
    return r;
  }

  function abortGame(state, gameId) {
    if (state.activeGameId == null || state.activeGameId !== gameId) { return fail(state, 'noGame'); }
    var s = prepare(state);
    s.activeGameId = null;
    return success(state.level, s, 0);
  }

  function rename(state, name) {
    var n = sanitizeName(name);
    if (!n) { return fail(state, 'empty'); }
    var s = prepare(state);
    s.name = n;
    return success(state.level, s, 0);
  }

  function setOption(list, field) {
    return function (state, id) {
      var opt = findOption(list, id);
      if (!opt) { return fail(state, 'invalid'); }
      if (opt.unlockLevel > state.level) { return fail(state, 'locked'); }
      var s = prepare(state);
      s[field] = id;
      return success(state.level, s, 0);
    };
  }

  function setReducedMotion(state, value) {
    var s = prepare(state);
    s.settings = s.settings || {};
    s.settings.reducedMotion = value === true;
    return success(state.level, s, 0);
  }

  function getStatus(state) {
    var st = state.stats;
    if (state.sleeping) { return 'durmiendo'; }
    if (st.hunger < 20) { return 'hambriento'; }
    if (st.energy < 20) { return 'agotado'; }
    if (st.hygiene < 20) { return 'sucio'; }
    if (st.mood < 25) { return 'triste'; }
    var avg = (st.hunger + st.energy + st.mood + st.hygiene) / 4;
    if (avg >= 70 && st.mood >= 60) { return 'feliz'; }
    return 'tranquilo';
  }

  return {
    SAVE_VERSION: SAVE_VERSION,
    STAT_KEYS: STAT_KEYS,
    CONFIG: CONFIG,
    FURS: FURS, PATTERNS: PATTERNS, EYES: EYES,
    getFur: function (id) { return findOption(FURS, id) || FURS[0]; },
    getEyes: function (id) { return findOption(EYES, id) || EYES[0]; },
    xpToNext: xpToNext,
    sanitizeName: sanitizeName,
    createDefaultState: createDefaultState,
    sanitizeState: sanitizeState,
    serialize: serialize,
    deserialize: deserialize,
    tick: tick,
    pet: pet, feed: feed, clean: clean,
    sleep: sleep, wake: wake, toggleSleep: toggleSleep,
    canStartGame: canStartGame, startGame: startGame, finishGame: finishGame, abortGame: abortGame, gameRewards: gameRewards,
    rename: rename,
    setFur: setOption(FURS, 'fur'),
    setPattern: setOption(PATTERNS, 'pattern'),
    setEyes: setOption(EYES, 'eyes'),
    setReducedMotion: setReducedMotion,
    getStatus: getStatus
  };
}));
