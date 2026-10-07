const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../../../site/namesake/quality.js');

test('surface starts with a pixel budget, orbit keeps its original resolution', () => {
  const q = create(3);
  assert.equal(q.scale('orbit', 1440, 900), 1.5);
  const scale = q.scale('land', 1440, 900);
  assert.ok(Math.abs(1440 * 900 * scale ** 2 - 360000) < 0.01);
  assert.equal(q.scale('land', 390, 844), 1);
});

test('four stalled frames reduce actual surface resolution, preserving orbit', () => {
  const q = create(2), before = q.scale('land', 1440, 900);
  for (let i = 0; i < 3; i++) assert.equal(q.sample('land', 1000), false);
  assert.equal(q.sample('land', 1000), true);
  assert.equal(q.scale('land', 1440, 900), before * 0.75);
  assert.equal(q.scale('orbit', 1440, 900), 1.5);
  for (let i = 0; i < 200; i++) { q.sample('land', 1000); q.scale('land', 1440, 900); }
  assert.equal(q.scale('land', 1440, 900), 0.3);
});

test('smooth frames and isolated hitches do not lower resolution', () => {
  const q = create(1);
  q.sample('land', 1500);
  for (let i = 0; i < 120; i++) assert.equal(q.sample('land', 16), false);
  assert.equal(q.scale('land', 390, 844), 1);
});

test('reset discards background/export/mode samples and HQ stays full size', () => {
  const q = create(1);
  for (let i = 0; i < 3; i++) q.sample('land', 300);
  q.reset();
  assert.equal(q.sample('orbit', 16), false);
  for (let i = 0; i < 60; i++) assert.equal(q.sample('orbit', 16), false);
  assert.equal(q.scale('orbit', 1280, 760), 1);
  const hq = create(2, true);
  for (let i = 0; i < 100; i++) assert.equal(hq.sample('land', 1000), false);
  assert.equal(hq.scale('land', 1440, 900), 1);
  assert.equal(hq.scale('orbit', 1440, 900), 1.5);
});

test('fast frames raise a budgeted surface to full resolution, but never after it struggled', () => {
  const q = create(2), start = q.scale('land', 1920, 1080);
  assert.ok(start < 0.5);
  let steps = 0;
  while (q.scale('land', 1920, 1080) < 1 && steps++ < 50) for (let i = 0; i < 60; i++) q.sample('land', 16);
  assert.equal(q.scale('land', 1920, 1080), 1);
  assert.equal(q.scale('orbit', 1920, 1080), 1.5);
  // One slow stretch drops it and locks out further climbing (the app resets samples on every resize).
  q.reset();
  for (let i = 0; i < 20; i++) q.sample('land', 60);
  const after = q.scale('land', 1920, 1080);
  assert.ok(after < 1);
  for (let i = 0; i < 600; i++) assert.equal(q.sample('land', 16), false);
  assert.equal(q.scale('land', 1920, 1080), after);
  // Ordinary 60 Hz frames with some at 30 Hz do not count as fast.
  const m = create(2), base = m.scale('land', 1920, 1080);
  for (let i = 0; i < 120; i++) m.sample('land', i % 3 ? 16 : 33);
  assert.equal(m.scale('land', 1920, 1080), base);
});
