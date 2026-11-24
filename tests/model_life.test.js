const assert = require('assert');
const M = require('../app/src/main/assets/model.js');
const T0 = 1e12, MIN = 60000, rng = () => 0.5; let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const fresh = () => M.createDefaultState(T0);
t('feeding schedules poop after digestion', () => {
  let s = fresh(); s.stats.hunger = 40;
  s = M.feed(s, T0).state; assert.equal(s.poopDueAt, T0 + M.CONFIG.mess.digestMs); assert.equal(s.vomitDueAt, null);
  let r = M.tick(s, T0 + MIN, { rng }); assert.equal(r.events.length, 0);
  r = M.tick(r.state, T0 + 2 * MIN + 1, { rng }); assert.deepEqual(r.events.map(e => e.type), ['poop']);
  assert.equal(r.state.mess.length, 1); assert.equal(r.state.poopDueAt, null);
});
t('overfeeding causes vomit and hunger loss', () => {
  let s = fresh(); s.stats.hunger = 88; const fed = M.feed(s, T0); assert.ok(fed.ok && fed.overfed);
  const r = M.tick(fed.state, T0 + 9000, { rng }); assert.ok(r.events.some(e => e.type === 'vomit'));
  assert.ok(r.state.stats.hunger < fed.state.stats.hunger - 20);
});
t('full still refuses food', () => { const s = fresh(); s.stats.hunger = 99; assert.equal(M.feed(s, T0).reason, 'full'); });
t('no events while sleeping, held or in game', () => {
  let s = fresh(); s.poopDueAt = T0; s.sleeping = true;
  assert.equal(M.tick(s, T0 + 1000, { rng }).events.length, 0);
  s.sleeping = false; assert.equal(M.tick(s, T0 + 1000, { rng, holdEvents: true }).events.length, 0);
  s.activeGameId = 1; assert.equal(M.tick(s, T0 + 1000, { rng }).events.length, 0);
});
t('hairball when very dirty, rate limited', () => {
  let s = fresh(); s.stats.hygiene = 10;
  let r = M.tick(s, T0 + 1000, { rng }); assert.ok(r.events.some(e => e.type === 'hairball'));
  r = M.tick(r.state, T0 + 2 * MIN, { rng }); assert.ok(!r.events.some(e => e.type === 'hairball'));
});
t('mess lowers mood and hygiene over time', () => {
  const a = fresh(), b = fresh(); b.mess = [{ id: 1, type: 'poop', x: 100, y: 350, at: T0 }, { id: 2, type: 'poop', x: 200, y: 350, at: T0 }];
  const ra = M.tick(a, T0 + 10 * MIN, { holdEvents: true }).state, rb = M.tick(b, T0 + 10 * MIN, { holdEvents: true }).state;
  assert.ok(rb.stats.mood < ra.stats.mood - 3); assert.ok(rb.stats.hygiene < ra.stats.hygiene - 3);
});
t('clean one and all mess', () => {
  let s = fresh(); s.mess = [{ id: 1, type: 'poop', x: 100, y: 350, at: T0 }, { id: 2, type: 'vomit', x: 200, y: 350, at: T0 }];
  const one = M.cleanMess(s, T0, 1); assert.ok(one.ok); assert.deepEqual(one.state.mess.map(m => m.id), [2]);
  const all = M.cleanMess(one.state, T0); assert.ok(all.ok); assert.equal(all.state.mess.length, 0);
  assert.equal(M.cleanMess(all.state, T0).reason, 'noMess'); assert.equal(M.cleanMess(s, T0, 99).reason, 'noMess');
});
t('mess capped', () => { let s = fresh(); s.mess = [1, 2, 3, 4].map(id => ({ id, type: 'poop', x: 100, y: 350, at: T0 })); s.messCounter = 4; s.poopDueAt = T0; const r = M.tick(s, T0 + 1, { rng }); assert.equal(r.state.mess.length, 4); assert.equal(r.events.length, 0); });
t('save roundtrip and sanitize mess', () => {
  let s = fresh(); s.mess = [{ id: 3, type: 'poop', x: 120, y: 350, at: T0 }]; s.messCounter = 3; s.poopDueAt = T0 + 5000;
  const d = M.deserialize(M.serialize(s), T0).state; assert.equal(d.mess.length, 1); assert.equal(d.poopDueAt, T0 + 5000);
  const bad = M.deserialize(JSON.stringify({ mess: [{ id: 'x', type: 'poop' }, { id: 5, type: 'bomb' }, { id: 7, type: 'vomit', x: -1e9, y: 1e9 }], poopDueAt: T0 + 1e12 }), T0).state;
  assert.equal(bad.mess.length, 1); assert.equal(bad.mess[0].x, M.CONFIG.mess.area.minX); assert.equal(bad.messCounter, 7); assert.equal(bad.poopDueAt, T0 + M.CONFIG.mess.digestMs);
  const old = M.deserialize(JSON.stringify({ name: 'Luna', stats: { hunger: 50 } }), T0).state; assert.deepEqual(old.mess, []); assert.equal(old.poopDueAt, null);
});
console.log(n + ' life tests passed');
