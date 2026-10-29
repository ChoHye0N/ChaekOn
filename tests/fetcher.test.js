import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPages } from '../src/core/fetcher.js';
import { fakeJpeg } from './helpers/fake-jpeg.js';

const tick = () => new Promise(r => setImmediate(r));
const urlsOf = n => Array.from({ length: n }, (_, i) => `https://viewer.test/p/${i + 1}.jpg`);
const pageOf = url => Number(url.match(/(\d+)\.jpg$/)[1]);

// 가짜 시계: sleep이 시간을 앞당긴다. 실제로 기다리지 않는다.
function makeClock() {
  let t = 0;
  const sleeps = [];
  return {
    now: () => t,
    sleeps,
    sleep: async (ms, signal) => {
      if (signal?.aborted) throw signal.reason;
      sleeps.push(ms);
      const wake = t + ms;
      await tick();
      t = Math.max(t, wake);
    },
  };
}

// handler(page, n번째 호출) → 상태코드 | { status, headers } | undefined(=200). throw하면 네트워크 오류.
function makeFetch(clock, handler = () => 200) {
  const log = [];
  let active = 0;
  const fn = async (url, { signal } = {}) => {
    if (signal?.aborted) throw signal.reason;
    const page = pageOf(url);
    const n = log.filter(l => l.page === page).length + 1;
    log.push({ page, n, t: clock.now(), active });
    active++;
    try {
      await tick();
      const r = await handler(page, n, signal);
      const { status = 200, headers } = typeof r === 'number' ? { status: r } : r ?? {};
      return new Response(status === 200 ? fakeJpeg({ seed: page }) : null, { status, headers });
    } finally {
      active--;
    }
  };
  fn.log = log;
  return fn;
}

const base = clock => ({ intervalMs: 0, sleep: clock.sleep, now: clock.now });

test('결과는 요청 순서가 아니라 페이지 순서로 돌려준다', async () => {
  const clock = makeClock();
  const f = makeFetch(clock, async page => { if (page === 1) await tick(); await tick(); });
  const { results, failed, stopped } = await fetchPages(urlsOf(5), { ...base(clock), fetch: f });
  assert.deepEqual(failed, []);
  assert.equal(stopped, null);
  results.forEach((r, i) => assert.deepEqual(r, fakeJpeg({ seed: i + 1 })));
});

test('동시 요청 수는 concurrency를 넘지 않는다 (기본 2)', async () => {
  const clock = makeClock();
  const f = makeFetch(clock);
  await fetchPages(urlsOf(8), { ...base(clock), fetch: f });
  assert.equal(Math.max(...f.log.map(l => l.active)) + 1, 2);

  const f4 = makeFetch(clock);
  await fetchPages(urlsOf(8), { ...base(clock), fetch: f4, concurrency: 4 });
  assert.equal(Math.max(...f4.log.map(l => l.active)) + 1, 4);
});

test('요청 시작 사이에 intervalMs 이상 간격을 둔다', async () => {
  const clock = makeClock();
  const f = makeFetch(clock);
  await fetchPages(urlsOf(5), { ...base(clock), fetch: f, intervalMs: 100 });
  const starts = f.log.map(l => l.t);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 100, `${i}번째 간격 ${starts[i] - starts[i - 1]}`);
});

test('5xx와 네트워크 오류는 백오프 후 재시도해 성공한다', async () => {
  const clock = makeClock();
  const f = makeFetch(clock, (page, n) => {
    if (page === 2 && n === 1) return 503;
    if (page === 3 && n === 1) throw new TypeError('network');
    if (page === 3 && n === 2) return 500;
  });
  const { results, failed } = await fetchPages(urlsOf(4), { ...base(clock), fetch: f, backoffMs: 1000 });
  assert.deepEqual(failed, []);
  assert.ok(results.every(Boolean));
  assert.deepEqual(f.log.filter(l => l.page === 3).map(l => l.n), [1, 2, 3]);
  assert.ok(clock.sleeps.includes(1000) && clock.sleeps.includes(2000), `백오프 1s, 2s: ${clock.sleeps}`);
});

test('429: Retry-After만큼 전체가 쉬고, 동시 요청 수가 줄어든다', async () => {
  const clock = makeClock();
  let throttledAt = null;
  const f = makeFetch(clock, (page, n) => {
    if (page === 1 && n === 1) { throttledAt = clock.now(); return { status: 429, headers: { 'Retry-After': '30' } }; }
  });
  const { results, failed } = await fetchPages(urlsOf(9), { ...base(clock), fetch: f, concurrency: 3 });
  assert.deepEqual(failed, []);
  assert.ok(results.every(Boolean));
  const after = f.log.filter(l => l.t > throttledAt || (l.page === 1 && l.n === 2));
  assert.ok(after.length > 0);
  assert.ok(after.every(l => l.t >= throttledAt + 30000), '대기 중에 요청이 나갔음');
  assert.ok(Math.max(...after.map(l => l.active)) + 1 <= 2, '동시 요청 수가 줄지 않음');
});

test('403도 429처럼 속도를 줄이고 기다린다 (Retry-After 없으면 백오프)', async () => {
  const clock = makeClock();
  const f = makeFetch(clock, (page, n) => (page === 1 && n === 1 ? 403 : 200));
  const { failed } = await fetchPages(urlsOf(4), { ...base(clock), fetch: f, backoffMs: 5000 });
  assert.deepEqual(failed, []);
  const retry = f.log.find(l => l.page === 1 && l.n === 2);
  assert.ok(retry.t >= 5000);
});

test('Retry-After를 HTTP 날짜로 줘도 따른다', async () => {
  const clock = makeClock();
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  const date = new Date(t0 + 20000).toUTCString();
  const f = makeFetch(clock, (page, n) => (page === 1 && n === 1 ? { status: 429, headers: { 'Retry-After': date } } : 200));
  await fetchPages(urlsOf(2), { ...base(clock), now: () => t0 + clock.now(), fetch: f });
  assert.ok(clock.sleeps.some(ms => ms >= 20000), `대기: ${clock.sleeps}`);
});

test('연속 실패하면 중단하고 실패한 페이지 번호를 알린다', async () => {
  const clock = makeClock();
  const f = makeFetch(clock, page => (page >= 3 && page <= 5 ? 500 : 200));
  const { results, failed, stopped } = await fetchPages(urlsOf(10), {
    ...base(clock), fetch: f, concurrency: 1, maxRetries: 1, maxConsecutiveFailures: 3,
  });
  assert.equal(stopped, 'consecutive-failures');
  assert.deepEqual(failed, [3, 4, 5]);
  assert.ok(results[0] && results[1]);
  assert.equal(f.log.filter(l => l.page > 5).length, 0, '중단 뒤에도 요청함');
});

test('드문 실패는 중단하지 않고 failed에만 담는다', async () => {
  const clock = makeClock();
  const f = makeFetch(clock, page => (page === 2 ? 500 : page === 4 ? 404 : 200));
  const { results, failed, stopped } = await fetchPages(urlsOf(6), { ...base(clock), fetch: f, maxRetries: 1 });
  assert.equal(stopped, null);
  assert.deepEqual(failed, [2, 4]);
  assert.equal(results[1], undefined);
  assert.equal(f.log.filter(l => l.page === 4).length, 1, '404는 재시도하지 않는다');
});

test('취소하면 abort 사유로 reject하고, 받은 페이지는 cache에 남는다', async () => {
  const clock = makeClock();
  const ctrl = new AbortController();
  const cache = new Map();
  const f = makeFetch(clock);
  const p = fetchPages(urlsOf(10), {
    ...base(clock), fetch: f, signal: ctrl.signal, cache, concurrency: 1,
    onProgress: ({ done }) => { if (done === 3) ctrl.abort(); },
  });
  await assert.rejects(p, { name: 'AbortError' });
  assert.equal(cache.size, 3);
  assert.ok(f.log.length < 10);
});

test('진행 중인 요청도 취소 신호로 끊긴다', async () => {
  const clock = makeClock();
  const ctrl = new AbortController();
  const f = makeFetch(clock, (page, n, signal) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  }));
  const p = fetchPages(urlsOf(3), { ...base(clock), fetch: f, signal: ctrl.signal });
  await tick(); await tick();
  ctrl.abort();
  await assert.rejects(p, { name: 'AbortError' });
});

test('이어받기: 같은 cache로 다시 호출하면 받은 페이지는 요청하지 않는다', async () => {
  const clock = makeClock();
  const cache = new Map();
  const first = makeFetch(clock, page => (page >= 4 ? 500 : 200));
  const r1 = await fetchPages(urlsOf(6), {
    ...base(clock), fetch: first, cache, concurrency: 1, maxRetries: 0, maxConsecutiveFailures: 2,
  });
  assert.equal(r1.stopped, 'consecutive-failures');
  assert.deepEqual([...cache.keys()].sort(), [0, 1, 2]);

  const second = makeFetch(clock);
  const progress = [];
  const r2 = await fetchPages(urlsOf(6), { ...base(clock), fetch: second, cache, onProgress: p => progress.push(p.done) });
  assert.deepEqual(second.log.map(l => l.page).sort(), [4, 5, 6]);
  assert.deepEqual(r2.failed, []);
  assert.ok(r2.results.every(Boolean));
  assert.equal(progress[0], 3, '시작 시 이미 받은 수를 알린다');
  assert.equal(progress.at(-1), 6);
});

test('진행 콜백에 완료 수와 누적 바이트가 담긴다', async () => {
  const clock = makeClock();
  const events = [];
  const f = makeFetch(clock);
  await fetchPages(urlsOf(3), { ...base(clock), fetch: f, concurrency: 1, onProgress: e => events.push(e) });
  const size = fakeJpeg().length;
  assert.deepEqual(events, [
    { done: 0, total: 3, bytes: 0 },
    { done: 1, total: 3, bytes: size },
    { done: 2, total: 3, bytes: size * 2 },
    { done: 3, total: 3, bytes: size * 3 },
  ]);
});
