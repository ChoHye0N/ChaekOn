import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRange } from '../src/core/range.js';

test('올바른 범위는 정수로 돌려준다 (문자열 입력도 허용)', () => {
  assert.deepEqual(parseRange(1, 6, 6), { from: 1, to: 6 });
  assert.deepEqual(parseRange('10', ' 50 ', 300), { from: 10, to: 50 });
  assert.deepEqual(parseRange(7, 7, 10), { from: 7, to: 7 }, '한 쪽만 고르는 범위');
});

test('범위를 벗어나면 책의 전체 쪽수를 안내한다', () => {
  assert.match(parseRange(0, 5, 6).error, /1에서 6 사이/);
  assert.match(parseRange(1, 7, 6).error, /1에서 6 사이/);
  assert.match(parseRange(-3, 2, 6).error, /1에서 6 사이/);
});

test('시작이 끝보다 크면 오류', () => {
  assert.match(parseRange(5, 2, 6).error, /시작 쪽은 끝 쪽보다/);
});

test('숫자가 아니거나 소수, 빈 입력은 오류', () => {
  for (const bad of ['', '  ', 'abc', 1.5, null, undefined, NaN, Infinity]) {
    assert.match(parseRange(bad, 3, 6).error, /정수/, `from=${String(bad)}`);
    assert.match(parseRange(1, bad, 6).error, /정수/, `to=${String(bad)}`);
  }
});
