// 가짜 뷰어 서버: project.json과 가짜 JPEG를 같은 출처로 내려준다. 실제 전자책 이미지는 쓰지 않는다.
import http from 'node:http';
import { fakeJpeg } from './fake-jpeg.js';

export const pageImage = (id, k) => fakeJpeg({ width: 2844, height: 1600, seed: k, payload: 60 + k });

// opts.status(k, n) → 응답 코드(기본 200). k는 1부터 센 페이지 번호, n은 그 페이지의 n번째 요청.
export async function startFakeViewer({ pages = 5, title = '테스트 책', id = 'abc123', status = () => 200 } = {}) {
  const hits = new Map();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/book/project.json') {
      const list = Array.from({ length: pages }, (_, i) => {
        const n = String(i + 1).padStart(4, '0');
        return { image: `assets/page-images/page-${id}-${n}.jpg`, thumb: `assets/page-images/page-${id}-${n}-thumb.jpg` };
      });
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ title, pages: list }));
    }
    const m = url.pathname.match(/^\/book\/assets\/page-images\/page-([\w-]+?)-(\d{4})\.jpg$/);
    if (m && m[1] === id) {
      const k = Number(m[2]);
      const n = (hits.get(k) ?? 0) + 1;
      hits.set(k, n);
      const code = k >= 1 && k <= pages ? status(k, n) : 404;
      res.statusCode = code;
      return res.end(code === 200 ? Buffer.from(pageImage(id, k)) : undefined);
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/book/`;
  return {
    base,
    doc: { baseURI: base + 'index.html' },
    hits,
    close: () => new Promise(r => server.close(r)),
  };
}
