import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggle } from '../src/content/main.js';

// 가짜 DOM: 패널이 쓰는 부분(createElement, attachShadow, getElementById)만 흉내 낸다.
function fakeDoc() {
  const els = new Map();
  const el = id => {
    if (!els.has(id)) els.set(id, { id, textContent: '', style: {}, className: '', classList: { toggle() {}, contains: () => false }, onclick: null });
    return els.get(id);
  };
  const root = { innerHTML: '', getElementById: el };
  const host = { style: {}, attachShadow: () => root, remove() {} };
  const doc = {
    baseURI: 'https://viewer.test/book/index.html',
    getElementById: () => null,
    createElement: () => host,
    body: { appendChild() {} },
  };
  return { doc, el };
}

const sent = [];
let sendError = null;
globalThis.chrome = { runtime: { sendMessage: async m => { sent.push(m); if (sendError) throw sendError; } } };
globalThis.fetch = async () => new Response('', { status: 404 });   // project.json이 없는 페이지

test('지원하지 않는 페이지에서도 설정 버튼이 설정 페이지를 연다', async () => {
  const { doc, el } = fakeDoc();
  await toggle(doc);
  assert.equal(el('title').textContent, '지원하지 않는 페이지');
  assert.equal(typeof el('settings').onclick, 'function', '설정 버튼에 동작이 연결돼 있어야 한다');
  await el('settings').onclick();
  assert.deepEqual(sent, [{ type: 'open-options' }]);
  el('close').onclick();   // 패널을 닫아 다음 테스트의 toggle이 새로 열리게 한다
});

test('설정을 열지 못하면 패널에 안내를 보여 준다', async () => {
  sent.length = 0;
  sendError = new Error('Extension context invalidated.');
  const { doc, el } = fakeDoc();
  await toggle(doc);
  await el('settings').onclick();
  assert.match(el('msg').textContent, /설정을 열지 못했습니다/);
  sendError = null;
  el('close').onclick();
});
