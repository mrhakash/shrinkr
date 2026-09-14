import { test } from 'node:test';
import assert from 'node:assert/strict';

test('web smoke: app module loads', async () => {
  const { App } = await import('../src/App.js');
  assert.equal(typeof App, 'function');
});
