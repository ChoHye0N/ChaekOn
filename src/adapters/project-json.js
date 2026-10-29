// `project.json`을 가진 이미지형 전자책 뷰어 어댑터.
// project.json의 `pages.length`가 페이지 수이고, 이미지는 `assets/page-images/page-<id>-0001.jpg`(4자리 번호) 규칙이다.
// 문자열 `page-images`의 개수는 썸네일까지 세어져 2배가 되므로 페이지 수로 쓰지 않는다.
const IMAGE_PATH = /page-images\/(page-[\w-]+?)-\d{4}\.jpg/;
const cache = new WeakMap();

async function load(doc, doFetch) {
  try {
    const res = await doFetch(new URL('project.json', doc.baseURI));
    if (!res.ok) return null;
    const json = await res.json();
    const m = JSON.stringify(json).match(IMAGE_PATH);
    if (!m || !Array.isArray(json.pages) || !json.pages.length) return null;
    return {
      title: typeof json.title === 'string' && json.title ? json.title : 'ebook',
      count: json.pages.length,
      prefix: new URL('assets/page-images/' + m[1] + '-', doc.baseURI).href,
    };
  } catch {
    return null;
  }
}

function info(doc, { fetch: doFetch = globalThis.fetch } = {}) {
  if (!cache.has(doc)) cache.set(doc, load(doc, doFetch));
  return cache.get(doc);
}

export const name = 'project-json';

export async function detect(doc, opts) {
  return (await info(doc, opts)) !== null;
}

export async function listPages(doc, opts) {
  const book = await info(doc, opts);
  if (!book) throw new Error('지원하는 뷰어가 아닙니다');
  return Array.from({ length: book.count }, (_, k) => ({ url: book.prefix + String(k + 1).padStart(4, '0') + '.jpg' }));
}

export async function title(doc, opts) {
  return (await info(doc, opts))?.title ?? 'ebook';
}
