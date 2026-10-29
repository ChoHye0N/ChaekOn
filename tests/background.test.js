import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// chrome API 대역: 등록된 리스너를 붙잡아 두고, 호출을 기록한다.
const calls = { inject: [], badge: [], title: [], menus: [] };
let injectError = null;
const listeners = {};
const on = name => ({ addListener: fn => { listeners[name] = fn; } });
globalThis.chrome = {
  action: {
    onClicked: on('action'),
    setBadgeText: o => calls.badge.push(o),
    setBadgeBackgroundColor: () => {},
    setTitle: o => calls.title.push(o),
  },
  runtime: { onInstalled: on('installed') },
  contextMenus: { create: o => calls.menus.push(o), onClicked: on('menu') },
  scripting: { executeScript: async o => { calls.inject.push(o); if (injectError) throw injectError; } },
};
await import('../src/background.js');

beforeEach(() => {
  for (const k of Object.keys(calls)) calls[k].length = 0;
  injectError = null;
});

test('아이콘 클릭: http(s) 탭이면 loader.js를 최상위 프레임에 주입한다', async () => {
  await listeners.action({ id: 7, url: 'https://viewer.test/book/index.html' });
  assert.deepEqual(calls.inject, [{ target: { tabId: 7, frameIds: [0] }, files: ['src/content/loader.js'] }]);
  assert.deepEqual(calls.badge.at(-1), { tabId: 7, text: '' });
});

test('chrome:// 페이지에서는 주입하지 않고 오류 없이 배지로 알린다', async () => {
  await listeners.action({ id: 3, url: 'chrome://extensions/' });
  assert.equal(calls.inject.length, 0);
  assert.deepEqual(calls.badge.at(-1), { tabId: 3, text: '!' });
  assert.match(calls.title.at(-1).title, /사용할 수 없습니다/);
});

test('url을 알 수 없어도 주입이 거부되면 오류를 던지지 않고 배지로 알린다', async () => {
  injectError = new Error('Cannot access a chrome:// URL');
  await listeners.action({ id: 4 });
  assert.equal(calls.inject.length, 1);
  assert.deepEqual(calls.badge.at(-1), { tabId: 4, text: '!' });
});

test('설치하면 우클릭 메뉴를 한 번 만든다', () => {
  listeners.installed();
  assert.equal(calls.menus.length, 1);
  assert.equal(calls.menus[0].id, 'chaekon-open');
});

test('우클릭 메뉴: 눌린 프레임에 주입한다 (iframe 안의 뷰어)', async () => {
  await listeners.menu({ menuItemId: 'chaekon-open', frameId: 12 }, { id: 9, url: 'https://viewer.test/' });
  assert.deepEqual(calls.inject[0].target, { tabId: 9, frameIds: [12] });
});

test('다른 메뉴 항목이나 탭 없는 호출은 무시한다', async () => {
  await listeners.menu({ menuItemId: 'other', frameId: 0 }, { id: 9, url: 'https://viewer.test/' });
  await listeners.menu({ menuItemId: 'chaekon-open', frameId: 0 }, undefined);
  assert.equal(calls.inject.length, 0);
});

test('단축키는 아이콘 클릭과 같은 경로(_execute_action)로 들어온다', () => {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  assert.ok(manifest.commands._execute_action.suggested_key.default);
  assert.equal(manifest.action.default_popup, undefined, '팝업이 있으면 onClicked가 호출되지 않는다');
});
