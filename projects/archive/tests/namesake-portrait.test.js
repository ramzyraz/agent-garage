const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../../../site/namesake/world.js');
const P = require('../../../site/namesake/portrait.js');

test('paired surface portraits fit both worlds and rings above the caption', () => {
  const kinds = new Set();
  for (let i = 0; i < 400; i++) {
    const w = W.generate('name ' + i), f = W.generate('friend ' + i);
    const p = P.surface(w, f, 17);
    assert.ok(p.focal > 0 && Number.isFinite(p.lookYaw) && Number.isFinite(p.lookPitch));
    for (const dir of p.points) {
      const v = P.project(dir, p.camera, 1080, 1350);
      assert.ok(v.z > 0 && v.x >= 86.39 && v.x <= 993.61 && v.y >= 121.49 && v.y <= 810.01,
        `${w.name}: clipped portrait ${JSON.stringify(v)}`);
    }
    const horizon = P.project([Math.sin(p.camera.yaw), 0, Math.cos(p.camera.yaw)], p.camera, 1080, 1350);
    assert.ok(horizon.y <= 891.01, 'keep ground above the caption');
    assert.ok(p.comp.sun[2] > -0.75, 'friend must have a visible lit face');
    assert.ok(p.labels.some(l => l.name === f.name));
    if (w.kind === 'gas') assert.ok(p.labels.some(l => l.name === w.name));
    kinds.add(w.kind);
  }
  assert.equal(kinds.size, 7);
});

test('visible flavor matches lava, ice, clouds and the presence of cities', () => {
  assert.match(W.description(W.generate('Hello')), /rivers glow orange-red/);
  for (let i = 0; i < 800; i++) {
    const w = W.generate('description ' + i), note = W.description(w);
    if (w.kind === 'lava' && note.includes('rivers glow')) assert.match(note, /glow orange-red/);
    if (w.kind === 'ice' && note.includes('-tinted')) assert.match(note, /blue-tinted/);
    if (w.kind === 'gas' && note.includes('microbes')) assert.match(note, /cloud bands/);
    if (w.kind === 'terran' && !w.render.cities) assert.ok(!note.includes('There are cities'));
  }
});

test('live shared skies fit complete named subjects in the clear UI rectangle', () => {
  for (const [w, h, rect] of [
    [390, 844, { left: 14, right: 376, top: 108, bottom: 494 }],
    [320, 640, { left: 14, right: 306, top: 108, bottom: 314 }],
    [1440, 1000, { left: 446, right: 1426, top: 94, bottom: 956 }]
  ]) for (let i = 0; i < 200; i++) {
    const p = P.surface(W.generate('name '+i), W.generate('friend '+i), 17, w, h, rect);
    for (const d of p.points) {
      const v = P.project(d, p.camera, w, h);
      assert.ok(v.z > 0 && v.x > rect.left && v.x < rect.right && v.y > rect.top && v.y < rect.bottom,
        `${w}x${h}: ${JSON.stringify(v)}`);
    }
    const horizon = P.project([Math.sin(p.camera.yaw), 0, Math.cos(p.camera.yaw)], p.camera, w, h);
    assert.ok(horizon.y < rect.top+0.701*(rect.bottom-rect.top), 'reserve foreground terrain');
  }
});
