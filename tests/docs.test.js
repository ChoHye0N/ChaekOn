import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const docs = execSync('git ls-files "*.md"', { encoding: 'utf8' }).split('\n').filter(Boolean);

test('추적 중인 마크다운 문서가 있다', () => {
  assert.ok(docs.includes('README.md'));
});

// GitHub 마크다운은 물결표 한 쌍 사이를 취소선으로 렌더링한다. "1~4, 100~500"처럼 범위를 물결표로 쓰면
// 의도하지 않은 취소선이 생기므로, 문서에서는 물결표를 쓰지 않고 범위는 "1-4" 또는 "1에서 4"로 쓴다.
for (const file of docs) {
  test(`${file}: 취소선이 없다 (물결표, HTML 취소선 태그 모두)`, () => {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    const bad = [];
    lines.forEach((line, i) => {
      if (line.includes('~') || /<(del|s|strike)[\s>]/i.test(line)) bad.push(`${i + 1}: ${line.slice(0, 60)}`);
    });
    assert.deepEqual(bad, [], `취소선이 될 수 있는 표기:\n${bad.join('\n')}`);
  });
}
