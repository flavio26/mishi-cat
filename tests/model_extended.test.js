const assert = require('assert');
const M = require('../app/src/main/assets/model.js');
const H = 3600e3; let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const T0 = 1e12;
t('defaults', () => { const s = M.createDefaultState(T0); assert.equal(s.name, 'Mishi'); assert.equal(s.level, 1); assert.equal(M.getStatus(s), 'feliz'); });
t('tick decays and caps 8h', () => {
  const s = M.createDefaultState(T0);
  const a = M.tick(s, T0 + 8 * H).state, b = M.tick(s, T0 + 48 * H);
  assert.deepEqual(a.stats, b.state.stats); assert.ok(b.capped); assert.equal(b.appliedMs, 8 * H);
});
t('offline floor only lowers to 15, keeps already-low', () => {
  const s = M.createDefaultState(T0); s.stats.hunger = 5;
  const r = M.tick(s, T0 + 8 * H, { offline: true }).state;
  assert.equal(r.stats.hunger, 5); assert.equal(r.stats.energy, 15);
});
t('clock backwards no-op', () => { const s = M.createDefaultState(T0); const r = M.tick(s, T0 - H); assert.equal(r.state.lastTick, T0 - H); assert.deepEqual(r.state.stats, s.stats); });
t('tick immutability', () => { const s = M.createDefaultState(T0); M.tick(s, T0 + H); assert.equal(s.stats.hunger, 80); });
t('sleep restores energy and auto-wakes', () => {
  let s = M.createDefaultState(T0); s.stats.energy = 20;
  s = M.sleep(s, T0).state; assert.ok(s.sleeping);
  const r = M.tick(s, T0 + H); assert.ok(r.wokeUp); assert.ok(!r.state.sleeping); assert.ok(r.state.stats.energy >= 90 && r.state.stats.energy < 100);
});
t('cooldown blocks double pet/feed', () => {
  let s = M.createDefaultState(T0); s.stats.hunger = 30;
  const a = M.feed(s, T0); assert.ok(a.ok); assert.equal(M.feed(a.state, T0 + 100).reason, 'cooldown');
  const p = M.pet(s, T0); assert.ok(p.ok); assert.equal(M.pet(p.state, T0 + 50).reason, 'cooldown');
  const p2 = M.pet(p.state, T0 + 700); assert.ok(p2.ok); assert.equal(p2.xp, 0);
});
t('reasons', () => {
  let s = M.createDefaultState(T0); s.stats.hunger = 99; s.stats.hygiene = 99; s.stats.energy = 95;
  assert.equal(M.feed(s, T0).reason, 'full'); assert.equal(M.clean(s, T0).reason, 'alreadyClean'); assert.equal(M.sleep(s, T0).reason, 'notTired');
  s.sleeping = true; assert.equal(M.pet(s, T0).reason, 'sleeping'); assert.equal(M.canStartGame(s), 'sleeping');
});
t('game finish exactly once', () => {
  let s = M.createDefaultState(T0);
  const st = M.startGame(s); assert.ok(st.ok); s = st.state;
  assert.equal(M.startGame(s).reason, 'gameActive');
  const f = M.finishGame(s, st.gameId, 10); assert.ok(f.ok); assert.ok(f.newRecord); assert.equal(f.state.bestScore, 10); assert.equal(f.xp, 22);
  assert.equal(M.finishGame(f.state, st.gameId, 10).reason, 'noGame');
  assert.equal(M.finishGame(s, 999, 5).reason, 'noGame');
  assert.equal(M.finishGame(M.startGame(f.state).state, 2, 1e9).score, 120);
});
t('tired cannot play', () => { const s = M.createDefaultState(T0); s.stats.energy = 10; assert.equal(M.canStartGame(s), 'tired'); });
t('xp leveling and unlocks', () => {
  let s = M.createDefaultState(T0); s.xp = 39;
  const st = M.startGame(s); const f = M.finishGame(st.state, st.gameId, 0);
  assert.equal(f.levelsGained, 1); assert.equal(f.state.level, 2); assert.ok(f.unlocked.some(u => u.id === 'negro'));
  assert.equal(M.setFur(s, 'negro').reason, 'locked'); assert.ok(M.setFur(f.state, 'negro').ok); assert.equal(M.setFur(s, 'x').reason, 'invalid');
});
t('rename sanitizes', () => {
  const s = M.createDefaultState(T0);
  assert.equal(M.rename(s, '   ').reason, 'empty');
  assert.equal(M.rename(s, '  Don\u0000  Gato  ').state.name, 'Don Gato');
  assert.equal(Array.from(M.rename(s, 'ñ'.repeat(40)).state.name).length, 16);
});
t('serialize roundtrip + corrupt', () => {
  let s = M.createDefaultState(T0); s.name = 'Luna'; s.level = 3; s.fur = 'chocolate';
  const d = M.deserialize(M.serialize(s), T0); assert.ok(d.ok); assert.equal(d.state.name, 'Luna'); assert.equal(d.state.fur, 'chocolate'); assert.equal(d.state.activeGameId, null);
  assert.equal(M.deserialize('{bad', T0).error, 'corrupt'); assert.equal(M.deserialize(null, T0).error, 'empty'); assert.equal(M.deserialize('[1]', T0).error, 'invalid');
  const h = M.deserialize(JSON.stringify({ stats: { hunger: 'x', energy: 900, mood: -4, hygiene: NaN }, level: 1, fur: 'chocolate', lastTick: T0 + H, xp: 1e9 }), T0).state;
  assert.equal(h.stats.hunger, 80); assert.equal(h.stats.energy, 100); assert.equal(h.stats.mood, 0); assert.equal(h.fur, 'naranja'); assert.equal(h.lastTick, T0); assert.equal(h.xp, 39);
});
t('CONFIG frozen', () => { assert.ok(Object.isFrozen(M.CONFIG.rates.awake)); });
console.log(n + ' tests passed');
