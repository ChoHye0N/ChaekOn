import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertPages, ConvertError } from '../src/core/convert.js';
import { fakeJpeg } from './helpers/fake-jpeg.js';

const urlsOf = n => Array.from({ length: n }, (_, i) => `https://viewer.test/${i + 1}.jpg`);
const pageOf = url => Number(url.match(/(\d+)\.jpg$/)[1]);
const fast = { intervalMs: 0, sleep: async () => {}, backoffMs: 0 };

test('받은 이미지로 PDF Blob을 만든다', async () => {
  const f = async url => new Response(fakeJpeg({ seed: pageOf(url) }));
  const blob = await convertPages(urlsOf(3), { ...fast, fetch: f });
  assert.equal(blob.type, 'application/pdf');
  assert.match(Buffer.from(await blob.arrayBuffer()).toString('latin1'), /\/Count 3\//);
});

test('받지 못한 페이지가 있으면 ConvertError에 번호를 담는다', async () => {
  const f = async url => (pageOf(url) === 2 ? new Response(null, { status: 500 }) : new Response(fakeJpeg()));
  await assert.rejects(convertPages(urlsOf(4), { ...fast, fetch: f, maxRetries: 0 }), e => {
    assert.ok(e instanceof ConvertError);
    assert.deepEqual(e.failed, [2]);
    assert.equal(e.stopped, null);
    assert.match(e.message, /받지 못한 페이지: 2/);
    return true;
  });
});

test('연속 실패로 중단하면 메시지에 알린다', async () => {
  const f = async () => new Response(null, { status: 500 });
  await assert.rejects(convertPages(urlsOf(6), { ...fast, fetch: f, maxRetries: 0, concurrency: 1 }), e => {
    assert.equal(e.stopped, 'consecutive-failures');
    assert.match(e.message, /연속으로 실패해 중단/);
    return true;
  });
});

test('JPEG가 아닌 응답은 페이지 번호와 함께 에러', async () => {
  const f = async url => new Response(pageOf(url) === 2 ? new Uint8Array([1, 2, 3, 4]) : fakeJpeg());
  await assert.rejects(convertPages(urlsOf(3), { ...fast, fetch: f }), /2페이지/);
});

test('실패 뒤 같은 cache로 다시 호출하면 받은 페이지는 다시 받지 않는다', async () => {
  const cache = new Map();
  let broken = true;
  const seen = [];
  const f = async url => {
    seen.push(pageOf(url));
    return pageOf(url) === 3 && broken ? new Response(null, { status: 500 }) : new Response(fakeJpeg());
  };
  await assert.rejects(convertPages(urlsOf(4), { ...fast, fetch: f, cache, maxRetries: 0, concurrency: 1 }));
  broken = false;
  seen.length = 0;
  const blob = await convertPages(urlsOf(4), { ...fast, fetch: f, cache });
  assert.deepEqual(seen, [3]);
  assert.match(Buffer.from(await blob.arrayBuffer()).toString('latin1'), /\/Count 4\//);
});

test('firstPage: 책의 일부만 받을 때 오류의 페이지 번호는 책의 쪽 번호다', async () => {
  // urls[0]이 책의 10쪽이면, 두 번째 URL(11쪽)이 실패하면 11로 보고한다
  const f = async url => (pageOf(url) === 2 ? new Response(null, { status: 500 }) : new Response(fakeJpeg()));
  await assert.rejects(convertPages(urlsOf(3), { ...fast, fetch: f, maxRetries: 0, firstPage: 10 }), e => {
    assert.deepEqual(e.failed, [11]);
    assert.match(e.message, /받지 못한 페이지: 11/);
    return true;
  });
});

test('firstPage: JPEG를 읽지 못한 쪽 번호도 책의 쪽 번호', async () => {
  const f = async url => new Response(pageOf(url) === 3 ? new Uint8Array([1, 2, 3, 4]) : fakeJpeg());
  await assert.rejects(convertPages(urlsOf(3), { ...fast, fetch: f, firstPage: 40 }), /42페이지/);
});
