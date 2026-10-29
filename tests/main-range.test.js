import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggle } from '../src/content/main.js';
import { fakeJpeg } from './helpers/fake-jpeg.js';

// 가짜 DOM: 패널이 쓰는 부분만 흉내 낸다. 입력칸은 value를 가진다.
function fakeDoc() {
  const els = new Map();
  const el = id => {
    if (!els.has(id)) els.set(id, { id, value: '', disabled: false, textContent: '', style: {}, className: '', classList: { toggle() {}, contains: () => false }, onclick: null });
    return els.get(id);
  };
  const root = { innerHTML: '', getElementById: el };
  const host = { style: {}, attachShadow: () => root, remove() {} };
  return { doc: { baseURI: 'https://viewer.test/book/index.html', getElementById: () => null, createElement: () => host, body: { appendChild() {} } }, el };
}

const PAGES = 6;
const requested = [];
const messages = [];
globalThis.chrome = {
  runtime: { sendMessage: async m => { messages.push(m); } },
  storage: { local: { get: async () => ({ settings: { speed: 'custom', custom: { concurrency: 2, intervalMs: 100, maxRetries: 0, maxConsecutiveFailures: 3 } } }) } },
};
globalThis.fetch = async url => {
  const u = String(url);
  if (u.endsWith('project.json')) {
    return new Response(JSON.stringify({ title: '범위 책', pages: Array.from({ length: PAGES }, (_, i) => ({ i: `assets/page-images/page-rng-${String(i + 1).padStart(4, '0')}.jpg` })) }));
  }
  const k = Number(u.match(/-(\d{4})\.jpg$/)[1]);
  requested.push(k);
  return new Response(fakeJpeg({ seed: k }));
};

const run = async (el, from, to) => {
  el('from').value = from;
  el('to').value = to;
  requested.length = 0;
  await el('start').onclick();
};

test('처음에는 전체 범위(1 ~ 전체)가 채워지고, 범위 입력이 표시된다', async () => {
  const { doc, el } = fakeDoc();
  await toggle(doc);
  assert.equal(el('title').textContent, '범위 책');
  assert.equal(el('from').value, 1);
  assert.equal(el('to').value, PAGES);
  assert.equal(el('rangeOf').textContent, '/ 6쪽');
  el('close').onclick();
});

test('범위를 고르면 그 쪽만 받아 PDF로 만들고, 진행률은 선택한 쪽수 기준이다', async () => {
  const { doc, el } = fakeDoc();
  await toggle(doc);
  await run(el, '2', '4');
  assert.deepEqual(requested.sort(), [2, 3, 4]);
  assert.equal(el('count').textContent, '3 / 3');
  assert.match(el('msg').textContent, /완료 · 3페이지/);
  assert.equal(el('from').disabled, true, '완료 후에는 범위를 잠근다');
  el('close').onclick();
});

test('범위가 올바르지 않으면 요청하지 않고 안내한다', async () => {
  const { doc, el } = fakeDoc();
  await toggle(doc);
  for (const [from, to, pattern] of [['5', '2', /시작 쪽은/], ['0', '3', /1에서 6/], ['1', '99', /1에서 6/], ['', '3', /정수/]]) {
    await run(el, from, to);
    assert.equal(requested.length, 0, `${from}~${to}`);
    assert.match(el('msg').textContent, pattern);
  }
  el('close').onclick();
});

test('범위를 바꿔 다시 시작하면 보관한 페이지를 비우고 새 범위를 받는다', async () => {
  const { doc, el } = fakeDoc();
  await toggle(doc);
  await run(el, '2', '3');
  assert.deepEqual(requested.sort(), [2, 3]);
  await run(el, '1', '2');
  assert.deepEqual(requested.sort(), [1, 2], '이전 범위에서 받은 2쪽도 순번이 달라져 다시 받는다');
  assert.equal(el('count').textContent, '2 / 2');
  el('close').onclick();
});

test('진행 중에는 범위를 잠그고, 진행률을 background에 알린다', async () => {
  messages.length = 0;
  const { doc, el } = fakeDoc();
  await toggle(doc);
  await run(el, '1', '4');
  const progress = messages.filter(m => m.type === 'progress');
  assert.deepEqual(progress.filter(m => m.state === 'running').map(m => m.percent), [0, 25, 50, 75, 100], '시작 시 0%부터 보고한다');
  assert.equal(progress.at(-1).state, 'done');
  el('close').onclick();
  assert.equal(messages.at(-1).state, 'clear', '패널을 닫으면 배지를 지운다');
});
