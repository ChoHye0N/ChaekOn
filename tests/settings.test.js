import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, LIMITS, PRESETS, isGentle, loadSettings, normalizeSettings, saveSettings, toFetchOptions,
} from '../src/core/settings.js';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { data, get: async key => ({ [key]: data[key] }), set: async obj => { Object.assign(data, obj); } };
};

test('기본 설정은 동시 2장, 400ms이고 시작 버튼은 오른쪽에서 켜져 있다', () => {
  assert.deepEqual(normalizeSettings(), DEFAULT_SETTINGS);
  assert.deepEqual(toFetchOptions(DEFAULT_SETTINGS), { concurrency: 2, intervalMs: 400, maxRetries: 3, maxConsecutiveFailures: 3 });
  assert.deepEqual(DEFAULT_SETTINGS.launcher, { enabled: true, position: 'right' });
});

test('프리셋: 매우 천천히, 기본, 조금 빠르게', () => {
  assert.deepEqual(toFetchOptions({ speed: 'slow' }), { concurrency: 1, intervalMs: 800, maxRetries: 3, maxConsecutiveFailures: 3 });
  assert.deepEqual(toFetchOptions({ speed: 'fast' }), { concurrency: 3, intervalMs: 250, maxRetries: 3, maxConsecutiveFailures: 3 });
});

test('직접 설정은 custom 값을 쓰고, 프리셋 선택 중에는 custom 값을 무시한다', () => {
  const custom = { concurrency: 4, intervalMs: 150, maxRetries: 1, maxConsecutiveFailures: 5 };
  assert.deepEqual(toFetchOptions({ speed: 'custom', custom }), custom);
  assert.deepEqual(toFetchOptions({ speed: 'slow', custom }), { ...PRESETS.slow, maxRetries: 3, maxConsecutiveFailures: 3 });
});

test('범위를 벗어난 값은 상한·하한으로 보정한다 (동시 요청은 최대 4)', () => {
  const s = normalizeSettings({ speed: 'custom', custom: { concurrency: 99, intervalMs: 1, maxRetries: -3, maxConsecutiveFailures: 1000 } });
  assert.deepEqual(s.custom, { concurrency: LIMITS.concurrency[1], intervalMs: LIMITS.intervalMs[0], maxRetries: 0, maxConsecutiveFailures: 10 });
});

test('숫자가 아닌 값, 소수, 문자열 숫자를 다룬다', () => {
  const s = normalizeSettings({ custom: { concurrency: '3', intervalMs: 'abc', maxRetries: 2.6, maxConsecutiveFailures: null } });
  assert.deepEqual(s.custom, { concurrency: 3, intervalMs: 400, maxRetries: 3, maxConsecutiveFailures: 3 });
  assert.equal(normalizeSettings({ custom: { concurrency: '' } }).custom.concurrency, 2, '빈 문자열은 기본값');
});

test('깨진 설정은 기본값으로 되돌린다', () => {
  for (const bad of [null, 'x', 5, [], { speed: 'warp', launcher: 'no', custom: 7 }]) {
    assert.deepEqual(normalizeSettings(bad), DEFAULT_SETTINGS);
  }
});

test('시작 버튼 설정: 끄기와 왼쪽 위치만 인정한다', () => {
  assert.deepEqual(normalizeSettings({ launcher: { enabled: false, position: 'left' } }).launcher, { enabled: false, position: 'left' });
  assert.deepEqual(normalizeSettings({ launcher: { enabled: 0, position: 'top' } }).launcher, { enabled: true, position: 'right' });
});

test('isGentle: 기본값보다 빠르면 false', () => {
  assert.equal(isGentle(toFetchOptions({ speed: 'slow' })), true);
  assert.equal(isGentle(toFetchOptions({ speed: 'normal' })), true);
  assert.equal(isGentle(toFetchOptions({ speed: 'fast' })), false);
  assert.equal(isGentle({ concurrency: 2, intervalMs: 300 }), false);
});

test('저장하고 읽는다. 저장 전에는 기본값, 저장소가 없거나 실패해도 기본값', async () => {
  const storage = memoryStorage();
  assert.deepEqual(await loadSettings(storage), DEFAULT_SETTINGS);
  const saved = await saveSettings({ speed: 'fast', launcher: { enabled: false, position: 'left' } }, storage);
  assert.equal(saved.speed, 'fast');
  assert.deepEqual(await loadSettings(storage), saved);
  assert.deepEqual(await loadSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(await loadSettings({ get: async () => { throw new Error('boom'); } }), DEFAULT_SETTINGS);
});

test('저장할 때도 보정해서 저장소에 잘못된 값이 들어가지 않는다', async () => {
  const storage = memoryStorage();
  await saveSettings({ speed: 'custom', custom: { concurrency: 50 } }, storage);
  assert.equal(storage.data.settings.custom.concurrency, 4);
});
