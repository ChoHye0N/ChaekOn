import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const packed = workflow.match(/zip -r "[^"]+" ([^\n]+)/)[1].trim().split(/\s+/);

test('릴리스는 v로 시작하는 태그에서만 실행되고, 필요한 권한만 쓴다', () => {
  assert.match(workflow, /tags: \['v\*'\]/);
  assert.match(workflow, /permissions:\s*\n\s+contents: write/);
  assert.doesNotMatch(workflow, /pull_request|branches:/, '브랜치 푸시나 PR에서는 릴리스하지 않는다');
});

test('릴리스 전에 테스트를 돌리고 태그와 manifest 버전이 같은지 확인한다', () => {
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /manifest\.json'\)\.version/);
  assert.match(workflow, /\$GITHUB_REF_NAME/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, '태그 v<버전>과 맞추려면 manifest version이 x.y.z여야 한다');
});

test('zip에는 manifest가 가리키는 모든 파일이 들어가고, 개발용 파일은 들어가지 않는다', () => {
  const inside = path => packed.some(p => path === p || path.startsWith(p + '/'));
  const referenced = [
    manifest.background.service_worker,
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap(c => c.js),
  ];
  for (const f of referenced) assert.ok(inside(f), `${f}가 zip에 없음`);
  // 동적 import로 불러오는 모듈 폴더(web_accessible_resources)
  for (const pattern of manifest.web_accessible_resources.flatMap(r => r.resources)) {
    assert.ok(inside(pattern.slice(0, pattern.lastIndexOf('/'))), `${pattern} 폴더가 zip에 없음`);
  }
  for (const dev of ['tests', 'scripts', '.github', '.git', 'README.md', 'CLAUDE.md', '.claude', 'node_modules']) {
    assert.ok(!packed.includes(dev), `${dev}는 zip에 넣지 않는다`);
  }
});
