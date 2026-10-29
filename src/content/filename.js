// 책 제목 → 저장할 파일 이름. 파일 시스템에서 쓸 수 없는 문자를 바꾸고 .pdf를 붙인다.
export function pdfFilename(title) {
  const name = String(title ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 100);
  return (name || 'ebook') + '.pdf';
}
