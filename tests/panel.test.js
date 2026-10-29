import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/ui/panel.js', 'utf8');
const button = id => src.match(new RegExp(`<button[^>]*id="${id}"[\\s\\S]*?</button>`))[0];

// 설정·닫기 버튼은 같은 크기의 정사각형 버튼 안에 같은 크기의 SVG 아이콘이어야 정렬이 맞는다.
test('설정·닫기 버튼은 같은 클래스와 같은 SVG 아이콘 구조를 쓴다 (글자 × 사용 안 함)', () => {
  for (const id of ['settings', 'close']) {
    const html = button(id);
    assert.match(html, /class="icon"/, `${id} 버튼 클래스`);
    assert.match(html, /<svg viewBox="0 0 24 24"/, `${id} 아이콘은 SVG`);
    assert.doesNotMatch(html.replace(/<svg[\s\S]*?<\/svg>/, ''), /[×x]\s*<\/button>/i, `${id} 버튼에 글자 아이콘이 남아 있음`);
  }
  assert.match(src, /\.icon \{ width: 28px; height: 28px;/);
  assert.match(src, /\.icon svg \{ width: 16px; height: 16px;/);
});

test('설정 아이콘은 선과 원(노드)으로 된 슬라이더 모양이다', () => {
  const html = button('settings');
  assert.equal((html.match(/<circle/g) || []).length, 3);
  assert.match(html, /<path d="M3 6h5\.5/);
});

test('패널은 외부 이미지나 폰트를 불러오지 않는다', () => {
  assert.doesNotMatch(src, /https?:\/\/|url\(|<img|@import/);
});
