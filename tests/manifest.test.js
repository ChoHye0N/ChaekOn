import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

test('Manifest V3이고 필요한 최소 권한만 요청한다', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting']);
  assert.equal(manifest.host_permissions, undefined, '넓은 호스트 권한을 요청하지 않는다');
  assert.equal(manifest.content_scripts, undefined, '자동 주입 content script를 두지 않는다 (아이콘을 눌렀을 때만 동작)');
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

test('background가 불러오는 content script가 있다', () => {
  const bg = readFileSync(manifest.background.service_worker, 'utf8');
  const file = bg.match(/files:\s*\['([^']+)'\]/)[1];
  assert.ok(existsSync(file), `${file} 없음`);
});
