import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSlidingWindowRateLimiter,
  fastClone,
  mapWithConcurrency,
  RequestTimeoutError,
  withTimeout,
} from './perfUtils';

test('mapWithConcurrency preserves output order and never exceeds concurrency limit', async () => {
  let active = 0;
  let maxActive = 0;
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const results = await mapWithConcurrency(items, 3, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, (11 - item) * 2));
    active -= 1;
    return item * 10;
  });

  assert.deepEqual(results, [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.ok(maxActive <= 3, `expected max concurrency <= 3, got ${maxActive}`);
  assert.equal(active, 0);
});

test('createSlidingWindowRateLimiter enforces limit, expires window, and caps tracked keys', () => {
  const limiter = createSlidingWindowRateLimiter(2, 1000, 10);
  assert.equal(limiter.isLimited('1.1.1.1', 100), false);
  assert.equal(limiter.isLimited('1.1.1.1', 200), false);
  assert.equal(limiter.isLimited('1.1.1.1', 300), true);
  // After window expires
  assert.equal(limiter.isLimited('1.1.1.1', 1250), false);

  // Bounded memory under IP churn
  for (let i = 0; i < 40; i += 1) {
    limiter.isLimited(`10.0.0.${i}`, 2000 + i);
  }
  assert.ok(limiter.size() <= 10, `expected <= 10 tracked keys, got ${limiter.size()}`);
});

test('withTimeout resolves fast promises and rejects stalled promises with RequestTimeoutError', async () => {
  const fast = await withTimeout(Promise.resolve('ok'), 200);
  assert.equal(fast, 'ok');

  await assert.rejects(
    () => withTimeout(new Promise((resolve) => setTimeout(() => resolve('late'), 200)), 25, 'Timeout!'),
    (err: unknown) => err instanceof RequestTimeoutError && err.message === 'Timeout!',
  );
});

test('fastClone returns an isolated deep copy', () => {
  const original = { a: 1, nested: { list: [1, 2, 3] } };
  const cloned = fastClone(original);
  cloned.nested.list.push(4);
  assert.deepEqual(original.nested.list, [1, 2, 3]);
  assert.deepEqual(cloned.nested.list, [1, 2, 3, 4]);
});
