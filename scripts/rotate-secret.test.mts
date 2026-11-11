import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotateCredential, type RotationOps } from './rotate-secret.mts';

function fixture(failAt?: string, wasLogin = true, rollbackFails = false) {
  const calls: string[] = [];
  let failed = false;
  const call = async (name: string) => {
    calls.push(name);
    if ((!failed && name === failAt) || (rollbackFails && name === 'password:old')) {
      failed = true;
      throw new Error('PRIVATE-ERROR-CANARY');
    }
  };
  const ops: RotationOps = {
    preflight: async () => {
      await call('preflight');
      return { wasLogin };
    },
    begin: () => call('begin'),
    password: (version) => call(`password:${version}`),
    login: (enabled) => call(`login:${enabled}`),
    persist: (version) => call(`persist:${version}`),
    restartApi: () => call('restart'),
    verify: (version, expected) => call(`verify:${version}:${expected}`),
    finish: () => call('finish'),
  };
  return { ops, calls };
}

test('api_ro rotates, reloads consumer, and checks both credentials before cleanup', async () => {
  const { ops, calls } = fixture();
  await rotateCredential('api_ro', false, ops);
  assert.deepEqual(calls, [
    'preflight',
    'begin',
    'password:new',
    'persist:new',
    'restart',
    'verify:new:true',
    'verify:old:false',
    'finish',
  ]);
});
test('invalid roles and implicit NOLOGIN activation fail before mutation', async () => {
  const bad = fixture();
  await assert.rejects(rotateCredential('postgres', false, bad.ops), /role/);
  assert.deepEqual(bad.calls, []);
  const dormant = fixture(undefined, false);
  await assert.rejects(rotateCredential('importer', false, dormant.ops), /activation-required/);
  assert.deepEqual(dormant.calls, ['preflight']);
});
test('explicit importer activation changes LOGIN without restarting API', async () => {
  const { ops, calls } = fixture(undefined, false);
  await rotateCredential('importer', true, ops);
  assert.deepEqual(calls, [
    'preflight',
    'begin',
    'password:new',
    'login:true',
    'persist:new',
    'verify:new:true',
    'verify:old:false',
    'finish',
  ]);
});
for (const phase of [
  'password:new',
  'persist:new',
  'restart',
  'verify:new:true',
  'verify:old:false',
]) {
  test(`failure at ${phase} compensates password, file and consumer without leaking cause`, async () => {
    const { ops, calls } = fixture(phase);
    await assert.rejects(rotateCredential('api_ro', false, ops), (error) => {
      assert.match(String(error), /rotation-failed/);
      assert.doesNotMatch(String(error), /PRIVATE-/);
      assert.equal(Object.hasOwn(error as object, 'cause'), false);
      return true;
    });
    assert.deepEqual(calls.slice(-6), [
      'password:old',
      'login:true',
      'persist:old',
      'restart',
      'verify:old:true',
      'finish',
    ]);
  });
}
test('failed compensation retains recovery material and reports only a code', async () => {
  const { ops, calls } = fixture('persist:new', true, true);
  await assert.rejects(rotateCredential('api_ro', false, ops), /recovery-required/);
  assert.equal(calls.includes('finish'), false);
});
test('failed activation restores NOLOGIN', async () => {
  const { ops, calls } = fixture('persist:new', false);
  await assert.rejects(rotateCredential('importer', true, ops), /rotation-failed/);
  assert.ok(calls.includes('login:false'));
  assert.ok(calls.includes('verify:old:false'));
});
test('failed activation of a disabled API role restores NOLOGIN without requiring readiness', async () => {
  const { ops, calls } = fixture('persist:new', false);
  await assert.rejects(rotateCredential('api_ro', true, ops), /rotation-failed/);
  assert.ok(calls.includes('login:false'));
  assert.ok(calls.includes('verify:old:false'));
  assert.equal(calls.includes('restart'), false);
});
test('preflight and journal failures never touch database or credentials', async () => {
  for (const phase of ['preflight', 'begin']) {
    const { ops, calls } = fixture(phase);
    await assert.rejects(rotateCredential('migrator', false, ops));
    assert.equal(
      calls.some((call) => call.startsWith('password:')),
      false,
    );
  }
});
test('cleanup failure does not roll back an already verified rotation', async () => {
  const { ops, calls } = fixture('finish');
  await assert.rejects(rotateCredential('api_ro', false, ops), /cleanup-required/);
  assert.equal(calls.includes('password:old'), false);
});
