import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { showLauncher } from '../src/content/launcher-ui.js';

// launcher.js는 모듈이 아닌 classic script라서 vm에서 가짜 window로 실행한다.
function runLauncher(win) {
  const urls = [];
  const self = { ...win };
  self.top = self;
  const chrome = { runtime: { getURL: p => { urls.push(p); return 'chrome-extension://test/' + p; } } };
  vm.runInNewContext(readFileSync('src/content/launcher.js', 'utf8'), { window: self, chrome });
  return urls;
}

test('일반 탭·창(툴바 있음)에서는 아무것도 하지 않는다', () => {
  assert.deepEqual(runLauncher({ toolbar: { visible: true }, locationbar: { visible: true } }), []);
  assert.deepEqual(runLauncher({}), [], '정보가 없으면 일반 창으로 본다');
});

test('툴바가 없는 새 창이면 버튼 모듈을 불러온다', () => {
  assert.deepEqual(runLauncher({ toolbar: { visible: false }, locationbar: { visible: true } }), ['src/content/launcher-ui.js']);
  assert.deepEqual(runLauncher({ toolbar: { visible: true }, locationbar: { visible: false } }), ['src/content/launcher-ui.js']);
});

test('프레임 안에서는 버튼을 띄우지 않는다', () => {
  const win = { toolbar: { visible: false }, locationbar: { visible: false } };
  const urls = [];
  const self = { ...win };
  self.top = {};   // 최상위가 아님
  vm.runInNewContext(readFileSync('src/content/launcher.js', 'utf8'), { window: self, chrome: { runtime: { getURL: p => urls.push(p) } } });
  assert.deepEqual(urls, []);
});

test('launcher.js는 네트워크 요청이나 페이지 읽기를 하지 않는다', () => {
  const src = readFileSync('src/content/launcher.js', 'utf8');
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon|document\.(cookie|querySelector|body\.innerText)/);
});

// 가짜 DOM: showLauncher가 쓰는 부분만 흉내 낸다.
function fakeDoc() {
  const handlers = {};
  const appended = [];
  const root = {
    innerHTML: '',
    getElementById: id => (id === 'b' ? { addEventListener: (type, fn) => { handlers[type] = fn; } } : null),
  };
  const doc = {
    ids: new Set(),
    body: { appendChild: el => { appended.push(el); doc.ids.add(el.id); } },
    getElementById: id => (doc.ids.has(id) ? {} : null),
    createElement: () => ({ style: {}, attachShadow: () => root }),
  };
  return { doc, handlers, appended, root };
}

test('showLauncher: 버튼을 한 번만 만들고, 누르면 onClick을 호출한다', () => {
  const { doc, handlers, appended, root } = fakeDoc();
  let clicks = 0;
  const host = showLauncher(doc, { onClick: () => clicks++ });
  assert.equal(host.id, 'chaekon-launcher');
  assert.equal(appended.length, 1);
  assert.match(root.innerHTML, /PDF 저장/);
  assert.match(root.innerHTML, /aria-label="ChaekOn: 이 책을 PDF로 저장"/);
  handlers.click();
  assert.equal(clicks, 1);
  assert.equal(showLauncher(doc, { onClick: () => {} }), null, '이미 있으면 다시 만들지 않는다');
  assert.equal(appended.length, 1);
});
