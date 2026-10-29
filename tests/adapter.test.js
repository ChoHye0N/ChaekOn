import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as projectJson from '../src/adapters/project-json.js';
import { pickAdapter } from '../src/adapters/index.js';

const doc = { baseURI: 'https://viewer.test/book/index.html' };
const json = body => async () => new Response(JSON.stringify(body), { status: 200 });

test('페이지 수는 pages.length이고 page-images 문자열 개수가 아니다 (썸네일 포함)', async () => {
  const pages = Array.from({ length: 3 }, (_, i) => ({
    image: `assets/page-images/page-x1-000${i + 1}.jpg`,
    thumb: `assets/page-images/page-x1-000${i + 1}-thumb.jpg`,
  }));
  const d = { baseURI: doc.baseURI + '?a' };
  const list = await projectJson.listPages(d, { fetch: json({ title: 'T', pages }) });
  assert.equal(list.length, 3);
});

test('이미지 URL은 4자리 번호로 만들고 뷰어 위치 기준으로 푼다', async () => {
  const d = { baseURI: doc.baseURI };
  const f = json({ title: '책', pages: [{ i: 'assets/page-images/page-ab_1-0001.jpg' }, {}, {}] });
  const list = await projectJson.listPages(d, { fetch: f });
  assert.deepEqual(list, [
    { url: 'https://viewer.test/book/assets/page-images/page-ab_1-0001.jpg' },
    { url: 'https://viewer.test/book/assets/page-images/page-ab_1-0002.jpg' },
    { url: 'https://viewer.test/book/assets/page-images/page-ab_1-0003.jpg' },
  ]);
  assert.equal(await projectJson.title(d, { fetch: f }), '책');
});

test('detect: project.json이 없거나 이미지 방식이 아니면 false', async () => {
  assert.equal(await projectJson.detect({ baseURI: doc.baseURI }, { fetch: async () => new Response('', { status: 404 }) }), false);
  assert.equal(await projectJson.detect({ baseURI: doc.baseURI }, { fetch: async () => { throw new TypeError('network'); } }), false);
  assert.equal(await projectJson.detect({ baseURI: doc.baseURI }, { fetch: json({ pages: [{}, {}] }) }), false);
  assert.equal(await projectJson.detect({ baseURI: doc.baseURI }, { fetch: json({ pages: [], x: 'assets/page-images/page-a-0001.jpg' }) }), false);
  assert.equal(await projectJson.detect({ baseURI: doc.baseURI }, { fetch: async () => new Response('not json', { status: 200 }) }), false);
});

test('detect가 true일 때 제목이 없으면 ebook', async () => {
  const d = { baseURI: doc.baseURI };
  const f = json({ pages: [{ i: 'assets/page-images/page-q-0001.jpg' }] });
  assert.equal(await projectJson.detect(d, { fetch: f }), true);
  assert.equal(await projectJson.title(d, { fetch: f }), 'ebook');
});

test('listPages: 지원하지 않는 문서에서는 에러', async () => {
  await assert.rejects(projectJson.listPages({ baseURI: doc.baseURI }, { fetch: async () => new Response('', { status: 404 }) }), /지원/);
});

test('같은 문서에서는 project.json을 한 번만 받는다', async () => {
  const d = { baseURI: doc.baseURI };
  let calls = 0;
  const f = async () => { calls++; return new Response(JSON.stringify({ pages: [{ i: 'assets/page-images/page-q-0001.jpg' }] })); };
  await projectJson.detect(d, { fetch: f });
  await projectJson.listPages(d, { fetch: f });
  await projectJson.title(d, { fetch: f });
  assert.equal(calls, 1);
});

test('pickAdapter: 맞는 어댑터를 고르고, 없으면 null', async () => {
  const ok = { baseURI: doc.baseURI };
  const okFetch = json({ pages: [{ i: 'assets/page-images/page-q-0001.jpg' }] });
  assert.equal((await pickAdapter(ok, { fetch: okFetch })).name, 'project-json');
  assert.equal(await pickAdapter({ baseURI: doc.baseURI }, { fetch: async () => new Response('', { status: 404 }) }), null);
});
