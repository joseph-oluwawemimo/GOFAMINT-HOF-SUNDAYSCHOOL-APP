import test from 'node:test';
import assert from 'node:assert/strict';
import { ScopedTaskCoordinator } from '../src/utils/scopedTaskCoordinator';

test('same-scope hydration requests share the real in-flight result', async () => {
  const coordinator = new ScopedTaskCoordinator<string>();
  let executions = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });

  const first = coordinator.run('teacher:class-a', async () => {
    executions += 1;
    await gate;
    return 'hydrated';
  });
  const second = coordinator.run('teacher:class-a', async () => {
    executions += 1;
    return 'wrong';
  });

  assert.equal(first, second);
  release();
  assert.equal(await second, 'hydrated');
  assert.equal(executions, 1);
});

test('different hydration scopes run sequentially and are never skipped', async () => {
  const coordinator = new ScopedTaskCoordinator<string>();
  const order: string[] = [];
  let releaseFirst!: () => void;
  let markFirstStarted!: () => void;
  const gate = new Promise<void>(resolve => { releaseFirst = resolve; });
  const firstStarted = new Promise<void>(resolve => { markFirstStarted = resolve; });

  const first = coordinator.run('admin', async () => {
    order.push('admin:start');
    markFirstStarted();
    await gate;
    order.push('admin:end');
    return 'admin';
  });
  const second = coordinator.run('workers', async () => {
    order.push('workers:start');
    order.push('workers:end');
    return 'workers';
  });

  await firstStarted;
  assert.deepEqual(order, ['admin:start']);
  releaseFirst();

  assert.equal(await first, 'admin');
  assert.equal(await second, 'workers');
  assert.deepEqual(order, ['admin:start', 'admin:end', 'workers:start', 'workers:end']);
});
