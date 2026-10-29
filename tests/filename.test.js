import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfFilename } from '../src/content/filename.js';

test('파일 이름에 쓸 수 없는 문자를 바꾼다', () => {
  assert.equal(pdfFilename('A/B:C*D?"E<F>G|H\\I'), 'A_B_C_D__E_F_G_H_I.pdf');
});

test('공백과 앞뒤 점을 정리하고 한글은 그대로 둔다', () => {
  assert.equal(pdfFilename('  자바   프로그래밍 .. '), '자바 프로그래밍.pdf');
});

test('비었거나 문자열이 아니면 ebook', () => {
  assert.equal(pdfFilename(''), 'ebook.pdf');
  assert.equal(pdfFilename(undefined), 'ebook.pdf');
  assert.equal(pdfFilename('...'), 'ebook.pdf');
});

test('너무 긴 제목은 100자로 자른다', () => {
  assert.equal(pdfFilename('가'.repeat(300)).length, 100 + '.pdf'.length);
});
