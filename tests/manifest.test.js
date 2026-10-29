import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

test('Manifest V3이고 필요한 최소 권한만 요청한다', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'contextMenus', 'scripting']);
  assert.equal(manifest.host_permissions, undefined, '넓은 호스트 권한을 요청하지 않는다');
});

// 툴바가 없는 새 창에서 시작 버튼을 띄우려고 모든 http(s) 페이지에 로드되는 content script가 하나 있다.
// 이 스크립트는 일반 탭에서는 아무것도 하지 않아야 하고, 프레임·about:blank로 넓어지면 안 된다.
test('content script는 작은 시작 버튼용 launcher.js 하나뿐이다', () => {
  assert.equal(manifest.content_scripts.length, 1);
  const [cs] = manifest.content_scripts;
  assert.deepEqual(cs.js, ['src/content/launcher.js']);
  assert.equal(cs.css, undefined);
  assert.equal(cs.all_frames, undefined);
  assert.equal(cs.match_about_blank, undefined);
  assert.deepEqual(cs.matches, ['http://*/*', 'https://*/*']);
  assert.ok(existsSync(cs.js[0]));
});

test('manifest가 가리키는 파일이 모두 있다', () => {
  const files = [
    manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  for (const f of files) assert.ok(existsSync(f), `${f} 없음`);
});

test('web_accessible_resources 패턴이 실제 모듈 파일과 맞고, loader.js가 불러오는 main.js를 포함한다', () => {
  const patterns = manifest.web_accessible_resources.flatMap(r => r.resources);
  for (const p of patterns) {
    const [dir, glob] = [p.slice(0, p.lastIndexOf('/')), p.slice(p.lastIndexOf('/') + 1)];
    assert.equal(glob, '*.js');
    assert.ok(readdirSync(dir).some(f => f.endsWith('.js')), `${p}에 해당하는 파일 없음`);
  }
  assert.ok(patterns.includes('src/content/*.js'));
  const loader = readFileSync(join('src', 'content', 'loader.js'), 'utf8');
  assert.match(loader, /src\/content\/main\.js/);
});

// main.js가 정적 import로 끌어오는 모든 모듈은 web_accessible_resources로 열려 있어야 한다.
// 하나라도 빠지면 크롬이 chrome-extension://invalid/ (ERR_BLOCKED_BY_CLIENT)로 막고 패널이 뜨지 않는다.
test('main.js가 import하는 모든 모듈이 web_accessible_resources에 포함된다', () => {
  const patterns = manifest.web_accessible_resources.flatMap(r => r.resources)
    .map(p => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'));
  const seen = new Set();
  const visit = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^import\s[^'"]*['"](\.[^'"]+)['"]/gm)) {
      visit(join(file, '..', m[1]).replaceAll('\\', '/'));
    }
  };
  visit('src/content/main.js');
  visit('src/content/launcher-ui.js');
  assert.ok(seen.size > 5, '의존성 그래프를 읽지 못함');
  for (const f of seen) assert.ok(patterns.some(re => re.test(f)), `${f}가 web_accessible_resources에 없음`);
});

// use_dynamic_url을 켜면 main.js는 열리지만 그 안의 상대 경로 import가 정적 주소로 요청돼 막힌다.
test('use_dynamic_url을 쓰지 않는다 (모듈 상대 경로 import가 막힘)', () => {
  for (const r of manifest.web_accessible_resources) assert.equal(r.use_dynamic_url, undefined);
});

test('background가 불러오는 content script가 있다', () => {
  const bg = readFileSync(manifest.background.service_worker, 'utf8');
  const file = bg.match(/files:\s*\['([^']+)'\]/)[1];
  assert.ok(existsSync(file), `${file} 없음`);
});
