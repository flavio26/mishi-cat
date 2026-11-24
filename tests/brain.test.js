const assert = require('assert');
const B = require('../app/src/main/assets/brain.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ctx = o => ({ stats: { hunger: 80, energy: 80, mood: 70, hygiene: 90 }, hour: 15, night: false, messCount: 0, sinceInteract: 0, ...o });
t('born with own personality in range', () => { const m = B.create(rng); for (const v of Object.values(m.traits)) assert.ok(v > 0.2 && v < 0.8); });
t('mostly moves around (not stuck sitting)', () => {
  const m = B.create(rng), c = {}; for (let i = 0; i < 400; i++) { const d = B.decide(m, ctx(), rng); c[d.act] = (c[d.act] || 0) + 1; }
  const still = (c.rest || 0) + (c.groom || 0); assert.ok(still < 160, JSON.stringify(c)); assert.ok(Object.keys(c).length >= 7, JSON.stringify(c));
});
t('hungry cat begs at the bowl', () => { const m = B.create(rng); let beg = 0; for (let i = 0; i < 200; i++) if (B.decide(m, ctx({ stats: { hunger: 5, energy: 80, mood: 70, hygiene: 90 } }), rng).act === 'beg') beg++; assert.ok(beg > 30, beg); });
t('tired cat naps more, zoomies at night when rested', () => {
  const m = B.create(rng); let nap = 0, zoom = 0;
  for (let i = 0; i < 200; i++) if (B.decide(m, ctx({ stats: { hunger: 80, energy: 10, mood: 70, hygiene: 90 } }), rng).act === 'nap') nap++;
  for (let i = 0; i < 200; i++) if (B.decide(m, ctx({ night: true, stats: { hunger: 80, energy: 95, mood: 70, hygiene: 90 } }), rng).act === 'zoomies') zoom++;
  assert.ok(nap > 40, nap); assert.ok(zoom > 10, zoom);
});
t('reward reinforces behaviour, spot and usual hour', () => {
  const m = B.create(rng); const w0 = m.acts.watch, s0 = m.spots.window;
  for (let i = 0; i < 10; i++) B.learn(m, 'pet', { act: 'watch', spot: 'window', hour: 18, now: 1 });
  assert.ok(m.acts.watch > w0 && m.spots.window > s0); assert.equal(B.usualHour(m), 18); assert.equal(B.favouriteSpot(m), 'window');
  assert.ok(m.learned.some(x => x.includes('18 h'))); assert.ok(m.learned.some(x => x.includes('la ventana')));
});
t('learned preferences change decisions', () => {
  const a = B.create(() => 0.5), b = B.create(() => 0.5); for (let i = 0; i < 25; i++) B.learn(b, 'play', { hour: 10 });
  let ha = 0, hb = 0; seed = 3; for (let i = 0; i < 300; i++) if (B.decide(a, ctx(), rng).act === 'hunt') ha++;
  seed = 3; for (let i = 0; i < 300; i++) if (B.decide(b, ctx(), rng).act === 'hunt') hb++;
  assert.ok(hb > ha * 1.5, [ha, hb]);
});
t('ignoring lowers it, values stay bounded', () => { const m = B.create(rng); for (let i = 0; i < 500; i++) B.learn(m, 'ignored', { act: 'seek' }); assert.equal(m.acts.seek, 0.2); for (let i = 0; i < 500; i++) B.learn(m, 'pet', { act: 'seek', spot: 'you', hour: 3 }); assert.equal(m.acts.seek, 4); assert.ok(m.hours[3] <= 50); });
t('sanitize survives garbage and roundtrip', () => {
  const m = B.create(rng); B.learn(m, 'pet', { act: 'watch', spot: 'window', hour: 9 });
  const r = B.sanitize(JSON.parse(JSON.stringify(m))); assert.deepEqual(r.acts, m.acts); assert.deepEqual(r.hours, m.hours);
  const g = B.sanitize({ acts: { watch: 1e9, bogus: 3 }, traits: { curious: -5 }, hours: 'x', recent: ['hack', 'nap'] }); assert.equal(g.acts.watch, 4); assert.equal(g.traits.curious, 0.05); assert.equal(g.acts.bogus, undefined); assert.deepEqual(g.recent, ['nap']);
  assert.ok(B.sanitize(null).acts.explore === 1);
});
t('summary readable', () => { const s = B.summary(B.create(rng)); assert.ok(s.stage && s.trait && s.favourite); });
console.log(n + ' brain tests passed');
