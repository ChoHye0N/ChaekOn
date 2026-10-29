import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// chrome API 대역: 등록된 리스너를 붙잡아 두고, 호출을 기록한다.
const calls = { inject: [], badge: [], title: [], menus: [], popup: [], opened: [], options: [], tabUpdate: [], winUpdate: [] };
let injectError = null, openPopupError = null, optionsTabs = [];
const listeners = {};
const on = name => ({ addListener: fn => { listeners[name] = fn; } });
globalThis.chrome = {
  action: {
    onClicked: on('action'),
    setBadgeText: o => calls.badge.push(o),
    setBadgeBackgroundColor: () => {},
    setTitle: o => calls.title.push(o),
    setPopup: async o => { calls.popup.push(o); },
    openPopup: async () => { calls.opened.push(true); if (openPopupError) throw openPopupError; },
  },
  runtime: {
    id: 'ext-id',
    getURL: p => 'chrome-extension://ext-id/' + p,
    onInstalled: on('installed'),
    onMessage: on('message'),
    openOptionsPage: async () => { calls.options.push(true); },
  },
  tabs: {
    query: async q => { calls.options.queries = [...(calls.options.queries ?? []), q]; return optionsTabs; },
    update: async (id, props) => { calls.tabUpdate.push({ id, props }); },
  },
  windows: { update: async (id, props) => { calls.winUpdate.push({ id, props }); } },
  contextMenus: { create: o => calls.menus.push(o), onClicked: on('menu') },
  scripting: { executeScript: async o => { calls.inject.push(o); if (injectError) throw injectError; } },
};
await import('../src/background.js');

beforeEach(() => {
  for (const k of Object.keys(calls)) calls[k].length = 0;
  injectError = null;
  openPopupError = null;
  optionsTabs = [];
  delete calls.options.queries;
});

const flush = () => new Promise(r => setImmediate(r));

test('아이콘 클릭: http(s) 탭이면 loader.js를 최상위 프레임에 주입한다', async () => {
  await listeners.action({ id: 7, url: 'https://viewer.test/book/index.html' });
  assert.deepEqual(calls.inject, [{ target: { tabId: 7, frameIds: [0] }, files: ['src/content/loader.js'] }]);
  assert.deepEqual(calls.badge.at(-1), { tabId: 7, text: '' });
  assert.deepEqual(calls.popup, [{ tabId: 7, popup: '' }], '성공하면 이전에 지정한 안내 팝업을 해제한다');
  assert.equal(calls.opened.length, 0);
});

test('chrome:// 페이지에서는 주입하지 않고 안내 팝업을 연다', async () => {
  await listeners.action({ id: 3, url: 'chrome://extensions/' });
  assert.equal(calls.inject.length, 0);
  assert.deepEqual(calls.badge.at(-1), { tabId: 3, text: '!' });
  assert.match(calls.title.at(-1).title, /사용할 수 없습니다/);
  assert.deepEqual(calls.popup, [{ tabId: 3, popup: 'src/ui/unavailable.html?reason=restricted' }]);
  assert.equal(calls.opened.length, 1);
});

test('url을 몰라도 주입이 접근 불가로 거부되면 같은 안내를 연다', async () => {
  injectError = new Error('Cannot access a chrome:// URL');
  await listeners.action({ id: 4 });
  assert.equal(calls.inject.length, 1);
  assert.deepEqual(calls.badge.at(-1), { tabId: 4, text: '!' });
  assert.deepEqual(calls.popup, [{ tabId: 4, popup: 'src/ui/unavailable.html?reason=restricted' }]);
});

test('그 밖의 주입 실패는 다른 문구(reason=failed)로 안내한다', async () => {
  injectError = new Error('Frame with ID 0 was removed.');
  await listeners.action({ id: 5, url: 'https://viewer.test/' });
  assert.deepEqual(calls.popup, [{ tabId: 5, popup: 'src/ui/unavailable.html?reason=failed' }]);
  assert.equal(calls.opened.length, 1);
});

test('팝업을 열 수 없어도 오류를 던지지 않고 배지와 툴팁은 남는다', async () => {
  openPopupError = new Error('Could not find an active browser window.');
  await listeners.action({ id: 6, url: 'chrome://version/' });
  assert.deepEqual(calls.badge.at(-1), { tabId: 6, text: '!' });
  assert.match(calls.title.at(-1).title, /사용할 수 없습니다/);
});

test('안내 팝업 파일과 문구가 있다', () => {
  assert.ok(existsSync('src/ui/unavailable.html'));
  const html = readFileSync('src/ui/unavailable.html', 'utf8');
  assert.match(html, /이 페이지에서는 사용할 수 없습니다/);
  assert.match(html, /<script src="unavailable\.js">/, '인라인 스크립트는 확장 CSP에서 막힌다');
  assert.ok(existsSync('src/ui/unavailable.js'));
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

test('설정 버튼 메시지를 받으면 설정 페이지를 열고, 그 탭이 있는 창을 앞으로 가져온다', async () => {
  optionsTabs = [{ id: 21, windowId: 5 }];   // 책이 툴바 없는 새 창에 있어서 설정 탭이 다른 창(5)에 열린 상황
  listeners.message({ type: 'open-options' }, { id: 'ext-id' });
  await flush();
  assert.equal(calls.options.length, 1);
  assert.deepEqual(calls.options.queries, [{ url: 'chrome-extension://ext-id/src/ui/options.html*' }]);
  assert.deepEqual(calls.tabUpdate, [{ id: 21, props: { active: true } }]);
  assert.deepEqual(calls.winUpdate, [{ id: 5, props: { focused: true } }]);
});

test('설정 탭을 찾지 못하거나 창 전환이 실패해도 오류를 던지지 않는다', async () => {
  listeners.message({ type: 'open-options' }, { id: 'ext-id' });   // optionsTabs 비어 있음
  await flush();
  assert.equal(calls.options.length, 1);
  assert.equal(calls.winUpdate.length, 0);

  optionsTabs = [{ id: 1, windowId: 2 }];
  chrome.windows.update = async () => { throw new Error('No window with id'); };
  listeners.message({ type: 'open-options' }, { id: 'ext-id' });
  await flush();
});

test('다른 확장이나 웹 페이지가 보낸 메시지, 다른 종류의 메시지는 무시한다', async () => {
  listeners.message({ type: 'open-options' }, { id: 'other-ext' });
  listeners.message({ type: 'open-options' }, {});
  listeners.message({ type: 'something-else' }, { id: 'ext-id' });
  listeners.message(undefined, { id: 'ext-id' });
  await flush();
  assert.equal(calls.options.length, 0);
});

test('단축키는 아이콘 클릭과 같은 경로(_execute_action)로 들어온다', () => {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  assert.ok(manifest.commands._execute_action.suggested_key.default);
  assert.equal(manifest.action.default_popup, undefined, '팝업이 있으면 onClicked가 호출되지 않는다');
});
